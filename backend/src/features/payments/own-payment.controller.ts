import { Controller, Get, Param } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { OwnPaymentReadService } from './own-payment-read.service';

@Controller('me/payments')
@AuthoritativeAudience('web', 'admin')
export class OwnPaymentController {
  constructor(private readonly payments: OwnPaymentReadService) {}
  @Get(':id')
  read(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string) {
    return this.payments.read(actor.session, id);
  }
}
