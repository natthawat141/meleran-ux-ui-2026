import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrincipalService } from './public/principal.service';
import { SelfProfileReader } from './public/self-profile.reader';
import { LogoutService } from './logout.service';
import { InstructorGrantWriter } from './public/instructor-grant.writer';
import { AdminUserDetailReader } from './public/admin-user-detail.reader';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrincipalService, SelfProfileReader, LogoutService, InstructorGrantWriter, AdminUserDetailReader],
  exports: [AuthService, PrincipalService, SelfProfileReader, InstructorGrantWriter, AdminUserDetailReader],
})
export class AuthModule {}
