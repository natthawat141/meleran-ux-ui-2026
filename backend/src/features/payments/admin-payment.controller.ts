import { Controller,Get,Param } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { AdminPaymentReadService } from './admin-payment-read.service';

@Controller('admin/payments')
export class AdminPaymentController {
  constructor(private readonly payments:AdminPaymentReadService){}
  @Get(':id') @AuthoritativeAudience('admin')
  read(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string){return this.payments.read(actor.session,id);}
}
