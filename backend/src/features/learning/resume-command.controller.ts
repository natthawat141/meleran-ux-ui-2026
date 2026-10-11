import { Body, Controller, Param, Put } from '@nestjs/common';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { ResumeCommandService } from './resume-command.service';
import { ResumeInput, ResumePipe } from './dto/resume.pipe';

@Controller('learn/items')
@AuthoritativeAudience('web')
@Roles('learner','instructor')
export class ResumeCommandController {
  constructor(private readonly resume:ResumeCommandService){}
  @Put(':id/resume')
  save(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new ResumePipe()) input:ResumeInput) {
    return this.resume.save(actor.session,id,input);
  }
}
