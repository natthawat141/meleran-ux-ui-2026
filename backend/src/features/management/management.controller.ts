import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { AuthPrincipal } from '../auth/public/index';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { AssignInstructorService } from './assign-instructor.service';
import { AdminUserDetailService } from './admin-user-detail.service';
import { AdminAccountCreateService } from './admin-account-create.service';
import { AccountDirectoryService } from './account-directory.service';
import { CreateUserInput, CreateUserPipe } from './dto/create-user.pipe';
import { PageQuery, PageQueryPipe } from '../../shared/pagination/keyset';

@Roles('admin')
@Controller('admin')
export class ManagementController {
  constructor(private readonly instructorGrants: AssignInstructorService,
    private readonly userDetails: AdminUserDetailService, private readonly accounts:AdminAccountCreateService,
    private readonly directory:AccountDirectoryService) {}

  @Get('users')
  @AuthoritativeAudience('admin')
  async listUsers(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe(['q'])) query:PageQuery) {
    return this.directory.list(actor.session,query,false);
  }

  @Post('users')
  @AuthoritativeAudience('admin')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @CurrentPrincipal() actor: AuthPrincipal,
    @Body(new CreateUserPipe()) body: CreateUserInput,
  ) {
    return this.accounts.create(actor.session,body);
  }

  @Get('users/:id')
  @AuthoritativeAudience('admin')
  async getUserDetail(
    @CurrentPrincipal() actor: AuthPrincipal,
    @Param('id') id: string,
  ) {
    return this.userDetails.read(actor.session, id);
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
  @AuthoritativeAudience('admin')
  async listInstructors(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe()) query:PageQuery) {
    return this.directory.list(actor.session,query,true);
  }
}
