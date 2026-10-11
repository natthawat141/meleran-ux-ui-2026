import { Controller,Get,Param,Query } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { PageQuery,PageQueryPipe } from '../../shared/pagination/keyset';
import { AttemptListService } from './attempt-list.service';
@Controller() export class AttemptListController{
  constructor(private readonly attempts:AttemptListService){}
  @Get('courses/:id/attempts') @AuthoritativeAudience('web','admin')
  course(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Query(new PageQueryPipe()) query:PageQuery){return this.attempts.list(actor.session,query,{kind:'course',id});}
  @Get('admin/users/:id/attempts') @AuthoritativeAudience('admin')
  account(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Query(new PageQueryPipe()) query:PageQuery){return this.attempts.list(actor.session,query,{kind:'account',id});}
}
