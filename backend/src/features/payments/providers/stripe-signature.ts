import { createHmac, timingSafeEqual } from 'node:crypto';

export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

/** Stripe's documented manual v1 verification; never serialize a parsed body. */
export function verifyStripeSignature(
  body: Buffer, header: string | string[] | undefined, secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!Buffer.isBuffer(body) || !body.length || !secret || typeof header !== 'string' || header.length > 8192) return false;
  const parts = header.split(',').map(part => part.trim());
  const timestamps = parts.filter(part => part.startsWith('t=')).map(part => part.slice(2));
  // Ambiguous timestamps are rejected; multiple v1 signatures support rotation.
  if (timestamps.length !== 1 || !/^\d{1,12}$/.test(timestamps[0])) return false;
  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(nowSeconds) || Math.abs(nowSeconds - timestamp) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(timestamps[0] + '.').update(body).digest();
  let valid = false;
  for (const part of parts) {
    if (!/^v1=[a-fA-F0-9]{64}$/.test(part)) continue;
    // Evaluate all eligible signatures, using constant-time comparison.
    valid = timingSafeEqual(expected, Buffer.from(part.slice(3), 'hex')) || valid;
  }
  return valid;
}
