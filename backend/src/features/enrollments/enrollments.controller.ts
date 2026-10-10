import { Body, Controller, Post, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CurrentPrincipal, CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { AuthPrincipal } from '../auth/public/index';
import { FreeEnrollmentService } from './free-enrollment.service';
import { EmptyRequestPipe } from './dto/empty-request.pipe';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService, private readonly freeEnrollment: FreeEnrollmentService) {}

  @Post('courses/:id/enroll')
  @AuthoritativeAudience('web')
  @Roles('learner', 'instructor')
  @HttpCode(HttpStatus.OK)
  async enrollFree(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string,
    @Body(new EmptyRequestPipe()) _body: unknown) {
    return this.freeEnrollment.enroll(actor.session, id);
  }

  @Get('me/enrollments')
  async getMyEnrollments(
    @CurrentUser() user: any,
    @Query('limit') limit = 20,
    @Query('cursor') cursor?: string,
  ) {
    return this.enrollmentsService.getMyEnrollments(user.id, Number(limit), cursor);
  }
}
