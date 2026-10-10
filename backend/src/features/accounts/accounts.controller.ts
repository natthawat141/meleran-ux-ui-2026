import { Controller, Get, Patch, Body } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CurrentUser } from '../../shared/auth/current-user.decorator';

@Controller('me')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async getProfile(@CurrentUser() user: any) {
    return this.accountsService.getProfile(user.id);
  }

  @Patch()
  async updateProfile(@CurrentUser() user: any, @Body() patch: any) {
    return this.accountsService.updateProfile(user.id, patch);
  }
}
