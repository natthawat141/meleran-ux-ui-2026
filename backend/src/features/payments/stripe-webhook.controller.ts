import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../shared/auth/session.guard';
import { ApiException } from '../../shared/errors/api-exception';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(private readonly webhook: StripeWebhookService) {}

  @Public() // Provider authentication is Stripe-Signature, never a browser session.
  @Post('stripe')
  async receive(@Req() request: Request, @Res() response: Response): Promise<void> {
    const outcome = await this.webhook.receive(request.body, request.headers['stripe-signature']);
    if (outcome === 'invalid') throw new ApiException('validation_failed', 400, 'ข้อมูล Webhook ไม่ถูกต้อง');
    if (outcome === 'conflict') throw ApiException.conflict('conflict', 'ข้อมูลเหตุการณ์ไม่ตรงกับรายการเดิม');
    if (outcome === 'processed') { response.status(200).json({ received: true }); return; }
    // Provider-specific local response, not an invented canonical browser API.
    // Retry-After is advisory; provider retries remain controlled by Stripe.
    response.setHeader('Retry-After', '60');
    response.status(503).json({ received: outcome === 'pending', processing: 'pending' });
  }
}
