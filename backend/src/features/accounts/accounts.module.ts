import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AuthModule } from '../auth/auth.module';
import { SelfProfileService } from './self-profile.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountsController],
  providers: [AccountsService, SelfProfileService],
  exports: [AccountsService],
})
export class AccountsModule {}
