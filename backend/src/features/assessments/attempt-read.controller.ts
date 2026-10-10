import { Controller, Get, Param } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { AttemptReadService } from './attempt-read.service';

@Controller('learn/attempts')
@AuthoritativeAudience('web')
export class AttemptReadController {
  constructor(private readonly attempts: AttemptReadService) {}
  @Get(':id')
  read(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string) {
    return this.attempts.read(actor.session, id);
  }
}
