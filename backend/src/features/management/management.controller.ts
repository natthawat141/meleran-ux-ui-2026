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
import { Roles } from '../../shared/auth/session.guard';
import { ApiException } from '../../shared/errors/api-exception';

@Roles('admin')
@Controller('admin')
export class ManagementController {
  constructor(private readonly managementService: ManagementService) {}

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
  @HttpCode(HttpStatus.OK)
  async assignInstructor(
    @CurrentUser() actor: any,
    @Param('id') id: string,
    @Headers('x-melearn-app') appHeader?: string,
  ) {
    this.checkAdminAudience(appHeader);
    return this.managementService.assignInstructor(actor.id, id);
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
