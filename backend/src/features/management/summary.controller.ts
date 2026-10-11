import { Controller, Get, Query } from '@nestjs/common';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { SummaryService } from './summary.service';

@Controller()
export class SummaryController {
  constructor(private readonly summary:SummaryService){}
  @Get('admin/summary')
  @AuthoritativeAudience('admin')
  @Roles('admin')
  admin(@CurrentPrincipal() actor:AuthPrincipal,@Query(new EmptyRequestPipe()) _query:unknown) {
    return this.summary.read(actor.session,true);
  }
  @Get('instructor/summary')
  @AuthoritativeAudience('web')
  @Roles('instructor')
  instructor(@CurrentPrincipal() actor:AuthPrincipal,@Query(new EmptyRequestPipe()) _query:unknown) {
    return this.summary.read(actor.session,false);
  }
}
