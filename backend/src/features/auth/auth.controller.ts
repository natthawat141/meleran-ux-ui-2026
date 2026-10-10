import {
  Controller,
  Post,
  Body,
  Headers,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { Public } from '../../shared/auth/session.guard';
import { CurrentSession } from '../../shared/auth/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequestDto,
    @Headers('x-melearn-app') appHeader: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const issue = await this.authService.login(
      body.identifier,
      body.password,
      body.audience,
      appHeader,
    );

    response.cookie(`melearn_${body.audience}_session`, issue.secret, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/v1',
      expires: issue.expiresAt,
    });

    return { user: issue.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentSession() session: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (session) {
      await this.authService.logout(session.tokenHash);
      response.clearCookie(`melearn_${session.audience}_session`, {
        path: '/api/v1',
      });
    }
  }
}
