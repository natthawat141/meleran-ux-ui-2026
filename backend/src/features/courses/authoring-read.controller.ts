import { Controller,Get,Param,Query } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { AuthoringReadService } from './authoring-read.service';

@Controller('courses') @AuthoritativeAudience('web','admin')
export class AuthoringReadController{
  constructor(private readonly courses:AuthoringReadService){}
  @Get(':id/authoring') read(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Query(new EmptyRequestPipe()) _query:void){return this.courses.read(actor.session,id,false);}
  @Get(':id/authoring-preview') preview(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Query(new EmptyRequestPipe()) _query:void){return this.courses.read(actor.session,id,true);}
}
