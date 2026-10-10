import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { Prisma } from '@prisma/client';

type JsonObject = Record<string, unknown>;
const record = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value);
const shortString = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 255;

/** Stable JSON: key ordering/whitespace on a fresh signed retry is immaterial. */
function stableJson(value: unknown, depth = 0): string {
  if (depth > 64) throw new Error('Invalid event');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid event');
  if (Array.isArray(value)) return '[' + value.map(item => stableJson(item, depth + 1)).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key], depth + 1)).join(',') + '}';
  return JSON.stringify(value);
}

export interface VerifiedStripeReceipt {
  eventId: string;
  type: string;
  checkoutSessionId: string | null;
  snapshot: Prisma.InputJsonObject;
  fingerprint: string;
}

/** Called ONLY after signature verification. No metadata/PII is promoted to proof. */
export function decodeStripeReceipt(body: Buffer, mode: 'test' | 'live'): VerifiedStripeReceipt {
  const event: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  if (!record(event) || !shortString(event.id) || !/^evt_[A-Za-z0-9_]+$/.test(event.id) || event.object !== 'event' ||
      !shortString(event.type) || !/^[a-z0-9_.]+$/.test(event.type) ||
      !Number.isSafeInteger(event.created) || (event.created as number) < 0 ||
      typeof event.livemode !== 'boolean' || event.livemode !== (mode === 'live') ||
      !(event.api_version === null || shortString(event.api_version)) ||
      !record(event.data) || !record(event.data.object) ||
      !shortString(event.data.object.id) || !shortString(event.data.object.object)) throw new Error('Invalid event');

  // This component handles account-scoped v1 snapshot events, not Connect/v2 thin.
  if (event.account != null || event.context != null) throw new Error('Invalid event');
  const object = event.data.object;
  const projection: Record<string, Prisma.InputJsonValue | null> = { id: object.id as string, object: object.object as string };
  const session = object.object === 'checkout.session';
  if (session) {
    for (const key of ['mode', 'status', 'payment_status', 'currency']) {
      if (object[key] !== undefined) {
        if (!(object[key] === null || shortString(object[key]))) throw new Error('Invalid event');
        projection[key] = object[key] as string | null;
      }
    }
    if (object.amount_total !== undefined) {
      if (!(object.amount_total === null || (Number.isSafeInteger(object.amount_total) && (object.amount_total as number) >= 0))) throw new Error('Invalid event');
      projection.amount_total = object.amount_total as number | null;
    }
    if (object.payment_intent !== undefined) {
      if (!(object.payment_intent === null || shortString(object.payment_intent) ||
          (record(object.payment_intent) && shortString(object.payment_intent.id)))) throw new Error('Invalid event');
      projection.payment_intent = record(object.payment_intent) ? object.payment_intent.id as string : object.payment_intent as string | null;
    }
  }
  // Stripe guarantees event.data is immutable. pending_webhooks is delivery state,
  // not event identity; request/other transport fields are not payment authority.
  const fingerprint = createHash('sha256').update(stableJson({ id: event.id, object: event.object,
    type: event.type, api_version: event.api_version, created: event.created,
    livemode: event.livemode, data: event.data })).digest('hex');
  return { eventId: event.id, type: event.type, checkoutSessionId: session ? object.id as string : null,
    fingerprint, snapshot: { receipt_version: 1, payload_sha256: fingerprint,
      event: { id: event.id, type: event.type, api_version: event.api_version as string | null,
        created: event.created as number, livemode: event.livemode }, object: projection } };
}
