import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrincipalService } from './public/principal.service';
import { SelfProfileReader } from './public/self-profile.reader';
import { SelfProfileWriter } from './public/self-profile.writer';
import { LogoutService } from './logout.service';
import { InstructorGrantWriter } from './public/instructor-grant.writer';
import { AdminUserDetailReader } from './public/admin-user-detail.reader';
import { LocalPasswordService } from './local-password.service';
import { LocalAuthenticationService } from './local-authentication.service';
import { SessionWriter } from './session-writer.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrincipalService, SelfProfileReader, LogoutService, InstructorGrantWriter, AdminUserDetailReader,
    LocalPasswordService, LocalAuthenticationService, SessionWriter, SelfProfileWriter],
  exports: [AuthService, PrincipalService, SelfProfileReader, InstructorGrantWriter, AdminUserDetailReader, SelfProfileWriter],
})
export class AuthModule {}
