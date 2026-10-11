import { Body,Controller,Param,Patch,Post } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { CoursePatch,CoursePatchPipe,ReviewRevisionPipe } from './dto/course-patch.pipe';
import { AuthoringWriteService } from './authoring-write.service';
@Controller('courses')
export class AuthoringWriteController{
  constructor(private readonly authoring:AuthoringWriteService){}
  @Patch(':id') @AuthoritativeAudience('web','admin')
  patch(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new CoursePatchPipe()) input:CoursePatch){return this.authoring.patch(actor.session,id,input);}
  @Post(':id/submit-review') @AuthoritativeAudience('web')
  submit(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new ReviewRevisionPipe()) input:{expected_revision:number}){return this.authoring.submit(actor.session,id,input.expected_revision);}
}
