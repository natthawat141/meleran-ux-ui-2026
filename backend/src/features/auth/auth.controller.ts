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
import { Public, AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from './public/principal.service';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { LogoutService } from './logout.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly logoutService: LogoutService) {}

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
      secure: process.env.NODE_ENV === 'production',
      path: '/api/v1',
      expires: issue.expiresAt,
    });

    return { user: issue.user };
  }

  @Post('logout')
  @AuthoritativeAudience('web', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentPrincipal() actor: AuthPrincipal,
    @Body(new EmptyRequestPipe()) _body: void,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.logoutService.logout(actor.session);
    // Retain the existing cookie name/path; broader transport policy is D01.
    response.clearCookie(`melearn_${actor.session.audience}_session`, { path: '/api/v1' });
  }
}
