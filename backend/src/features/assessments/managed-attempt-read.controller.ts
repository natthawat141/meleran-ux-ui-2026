import { Controller,Get,Param } from '@nestjs/common';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthoritativeAudience,Roles } from '../../shared/auth/session.guard';
import { AuthPrincipal } from '../auth/public/index';
import { ManagedAttemptReadService } from './managed-attempt-read.service';
@Controller('instructor/attempts')
@AuthoritativeAudience('web')
@Roles('instructor')
export class ManagedAttemptReadController {
  constructor(private readonly attempts:ManagedAttemptReadService){}
  @Get(':id')read(@CurrentPrincipal() actor:AuthPrincipal,@Param('id')id:string){return this.attempts.read(actor.session,id);}
}
