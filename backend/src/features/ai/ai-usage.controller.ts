import { Controller, Get } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { AiUsageService } from './ai-usage.service';

@AuthoritativeAudience('web', 'admin')
@Controller('me/ai')
export class AiUsageController {
  constructor(private readonly usage: AiUsageService) {}
  @Get('usage')
  read(@CurrentPrincipal() actor: AuthPrincipal) { return this.usage.read(actor.session); }
}
