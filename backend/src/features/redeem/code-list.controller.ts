import { Controller, Get, Query } from '@nestjs/common';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { PageQuery, PageQueryPipe } from '../../shared/pagination/keyset';
import { CodeListService } from './code-list.service';

@Controller('admin/redeem-codes')
@AuthoritativeAudience('admin')
@Roles('admin')
export class CodeListController {
  constructor(private readonly codes:CodeListService){}
  @Get()
  list(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe(['course_id','status'])) query:PageQuery) {
    return this.codes.list(actor.session,query);
  }
}
