import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrincipalService } from './public/principal.service';
import { SelfProfileReader } from './public/self-profile.reader';
import { LogoutService } from './logout.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrincipalService, SelfProfileReader, LogoutService],
  exports: [AuthService, PrincipalService, SelfProfileReader],
})
export class AuthModule {}
