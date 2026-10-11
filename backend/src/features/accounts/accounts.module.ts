import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AuthModule } from '../auth/auth.module';
import { SelfProfileService } from './self-profile.service';
import { SelfProfileUpdateService } from './self-profile-update.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountsController],
  providers: [SelfProfileService, SelfProfileUpdateService],
})
export class AccountsModule {}
