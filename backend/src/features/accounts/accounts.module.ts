import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AuthModule } from '../auth/auth.module';
import { SelfProfileService } from './self-profile.service';
import { SelfProfileUpdateService } from './self-profile-update.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountsController],
  providers: [AccountsService, SelfProfileService, SelfProfileUpdateService],
  exports: [AccountsService],
})
export class AccountsModule {}
