import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ManagementService } from './management.service';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { ApiException } from '../../shared/errors/api-exception';
import { AuthPrincipal } from '../auth/public/index';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { AssignInstructorService } from './assign-instructor.service';

@Roles('admin')
@Controller('admin')
export class ManagementController {
  constructor(private readonly managementService: ManagementService, private readonly instructorGrants: AssignInstructorService) {}

  private checkAdminAudience(appHeader?: string) {
    if (appHeader !== 'admin') {
      throw new ApiException('audience_not_allowed', 403, 'ต้องเข้าสู่ระบบฝั่ง Admin');
    }
  }

  @Get('users')
  async listUsers(
    @Query('q') q?: string,
    @Query('limit') limit = 20,
    @Query('cursor') cursor?: string,
    @Headers('x-melearn-app') appHeader?: string,
  ) {
    this.checkAdminAudience(appHeader);
    return this.managementService.listUsers(q, Number(limit), cursor);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @CurrentUser() actor: any,
    @Body() body: any,
    @Headers('x-melearn-app') appHeader?: string,
  ) {
    this.checkAdminAudience(appHeader);
    return this.managementService.createUser(actor.id, body);
  }

  @Get('users/:id')
  async getUserDetail(
    @Param('id') id: string,
    @Headers('x-melearn-app') appHeader?: string,
  ) {
    this.checkAdminAudience(appHeader);
    return this.managementService.getUserDetail(id);
  }

  @Post('users/:id/instructor')
  @AuthoritativeAudience('admin')
  @HttpCode(HttpStatus.OK)
  async assignInstructor(
    @CurrentPrincipal() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body(new EmptyRequestPipe()) _body: void,
  ) {
    return this.instructorGrants.assign(actor.session, id);
  }

  @Get('instructors')
  async listInstructors(
    @Query('limit') limit = 20,
    @Query('cursor') cursor?: string,
    @Headers('x-melearn-app') appHeader?: string,
  ) {
    this.checkAdminAudience(appHeader);
    return this.managementService.listInstructors(Number(limit), cursor);
  }
}
