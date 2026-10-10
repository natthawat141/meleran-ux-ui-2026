import { Controller, Get, Patch, Body } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CurrentUser, CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { AuthPrincipal } from '../auth/public/index';
import { SelfProfileService } from './self-profile.service';

@Controller('me')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService, private readonly selfProfile: SelfProfileService) {}

  @Get()
  @AuthoritativeAudience('web', 'admin')
  async getProfile(@CurrentPrincipal() actor: AuthPrincipal) {
    return this.selfProfile.read(actor.session);
  }

  @Patch()
  async updateProfile(@CurrentUser() user: any, @Body() patch: any) {
    return this.accountsService.updateProfile(user.id, patch);
  }
}
