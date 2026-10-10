import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrincipalService } from './public/principal.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrincipalService],
  exports: [AuthService, PrincipalService],
})
export class AuthModule {}
