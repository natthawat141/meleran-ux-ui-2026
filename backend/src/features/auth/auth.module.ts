import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrincipalService } from './public/principal.service';
import { SelfProfileReader } from './public/self-profile.reader';
import { LogoutService } from './logout.service';
import { InstructorGrantWriter } from './public/instructor-grant.writer';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrincipalService, SelfProfileReader, LogoutService, InstructorGrantWriter],
  exports: [AuthService, PrincipalService, SelfProfileReader, InstructorGrantWriter],
})
export class AuthModule {}
