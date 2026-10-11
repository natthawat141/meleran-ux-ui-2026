import { Controller, Get, Patch, Body } from '@nestjs/common';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { AuthPrincipal } from '../auth/public/index';
import { SelfProfileService } from './self-profile.service';
import { SelfProfileUpdateService } from './self-profile-update.service';
import { SelfProfilePatchPipe } from './dto/self-profile-patch.pipe';
import { SelfProfilePatch } from '../auth/public/index';

@Controller('me')
export class AccountsController {
  constructor(private readonly selfProfile: SelfProfileService,
    private readonly updates: SelfProfileUpdateService) {}

  @Get()
  @AuthoritativeAudience('web', 'admin')
  async getProfile(@CurrentPrincipal() actor: AuthPrincipal) {
    return this.selfProfile.read(actor.session);
  }

  @Patch()
  @AuthoritativeAudience('web', 'admin')
  async updateProfile(@CurrentPrincipal() actor: AuthPrincipal, @Body(new SelfProfilePatchPipe()) patch: SelfProfilePatch) {
    return this.updates.update(actor.session, patch);
  }
}
