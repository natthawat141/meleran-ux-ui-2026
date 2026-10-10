import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeStripeReceipt } from './providers/stripe-receipt';
import { verifyStripeSignature } from './providers/stripe-signature';

export type StripeReceiptOutcome = 'unconfigured' | 'invalid' | 'conflict' | 'pending' | 'processed';

@Injectable()
export class StripeWebhookService {
  constructor(private readonly prisma: PrismaService) {}

  async receive(body: unknown, signature: string | string[] | undefined): Promise<StripeReceiptOutcome> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const mode = process.env.STRIPE_WEBHOOK_MODE || 'test';
    // A Checkout API key is NOT an endpoint signing secret. Fail closed.
    if (!secret?.startsWith('whsec_') || secret.length <= 6 || !['test', 'live'].includes(mode)) return 'unconfigured';
    if (!Buffer.isBuffer(body) || !verifyStripeSignature(body, signature, secret)) return 'invalid';
    let receipt: ReturnType<typeof decodeStripeReceipt>;
    try { receipt = decodeStripeReceipt(body, mode as 'test' | 'live'); }
    catch { return 'invalid'; }

    // One insert/no-op + one read. Unique eventId converges under concurrent delivery;
    // the original verified proof, timestamp and processing outcome are never overwritten.
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO payment_events ("eventId", type, "checkoutSessionId", "eventSnapshot")
      VALUES (${receipt.eventId}, ${receipt.type}, ${receipt.checkoutSessionId}, ${JSON.stringify(receipt.snapshot)}::jsonb)
      ON CONFLICT ("eventId") DO NOTHING`);
    const stored = await this.prisma.paymentEvent.findUniqueOrThrow({ where: { eventId: receipt.eventId },
      select: { type: true, checkoutSessionId: true, eventSnapshot: true, status: true } });
    const snapshot = stored.eventSnapshot as Prisma.JsonObject;
    if (stored.type !== receipt.type || stored.checkoutSessionId !== receipt.checkoutSessionId ||
        snapshot?.payload_sha256 !== receipt.fingerprint) return 'conflict';
    // Financial interpretation/fulfillment is a separate D08/D10 component. Until
    // it exists, a durable receipt is NOT a successful processing ACK to Stripe.
    return stored.status === 'processed' ? 'processed' : 'pending';
  }
}
