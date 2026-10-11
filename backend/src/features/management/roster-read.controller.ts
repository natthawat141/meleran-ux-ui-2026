import { Controller,Get,Param,Query } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { PageQuery,PageQueryPipe } from '../../shared/pagination/keyset';
import { RosterReadService } from './roster-read.service';

@Controller() export class RosterReadController{
  constructor(private readonly roster:RosterReadService){}
  @Get('courses/:id/learners') @AuthoritativeAudience('web','admin')
  course(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Query(new PageQueryPipe()) query:PageQuery){return this.roster.list(actor.session,query,{kind:'course',id});}
  @Get('admin/users/:id/enrollments') @AuthoritativeAudience('admin')
  account(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Query(new PageQueryPipe()) query:PageQuery){return this.roster.list(actor.session,query,{kind:'account',id});}
  @Get('instructor/learners') @AuthoritativeAudience('web')
  instructor(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe()) query:PageQuery){return this.roster.list(actor.session,query,{kind:'instructor'});}
  @Get('admin/learners') @AuthoritativeAudience('admin')
  admin(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe()) query:PageQuery){return this.roster.list(actor.session,query,{kind:'admin'});}
}
