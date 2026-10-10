import { Module } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { AuthModule } from '../auth/auth.module';
import { OwnPaymentController } from './own-payment.controller';
import { OwnPaymentReadService } from './own-payment-read.service';

@Module({ imports: [AuthModule], controllers: [StripeWebhookController, OwnPaymentController],
  providers: [StripeWebhookService, OwnPaymentReadService] })
export class PaymentsModule {}
