import { Controller, Post, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CurrentUser } from '../../shared/auth/current-user.decorator';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('courses/:id/enroll')
  @HttpCode(HttpStatus.OK)
  async enrollFree(@CurrentUser() user: any, @Param('id') id: string) {
    return this.enrollmentsService.enrollFree(user.id, id);
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
