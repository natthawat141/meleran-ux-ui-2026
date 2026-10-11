import { Body, Controller, Post, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { AuthPrincipal } from '../auth/public/index';
import { FreeEnrollmentService } from './free-enrollment.service';
import { EmptyRequestPipe } from './dto/empty-request.pipe';
import { OwnEnrollmentListService } from './own-enrollment-list.service';
import { PageQuery, PageQueryPipe } from '../../shared/pagination/keyset';

@Controller()
export class EnrollmentsController {
  constructor(private readonly freeEnrollment: FreeEnrollmentService,
    private readonly ownList: OwnEnrollmentListService) {}

  @Post('courses/:id/enroll')
  @AuthoritativeAudience('web')
  @Roles('learner', 'instructor')
  @HttpCode(HttpStatus.OK)
  async enrollFree(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string,
    @Body(new EmptyRequestPipe()) _body: unknown) {
    return this.freeEnrollment.enroll(actor.session, id);
  }

  @Get('me/enrollments')
  @AuthoritativeAudience('web', 'admin')
  async getMyEnrollments(
    @CurrentPrincipal() actor: AuthPrincipal,
    @Query(new PageQueryPipe()) query: PageQuery,
  ) {
    return this.ownList.list(actor.session, query);
  }
}
