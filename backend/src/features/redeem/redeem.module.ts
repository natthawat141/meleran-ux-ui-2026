import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { RedeemWriter } from './redeem-writer.service';
import { RevokeCodeService } from './revoke-code.service';
import { RevokeCodeController } from './revoke-code.controller';
import { CodeCommandsController } from './code-commands.controller';
import { CodeIssuanceService } from './code-issuance.service';
import { RedeemCodeService } from './redeem-code.service';
import { CodeListController } from './code-list.controller';
import { CodeListService } from './code-list.service';

@Module({
  imports: [AuthModule, EnrollmentsModule],
  controllers: [RevokeCodeController, CodeCommandsController, CodeListController],
  providers: [RedeemWriter, RevokeCodeService, CodeIssuanceService, RedeemCodeService, CodeListService],
})
export class RedeemModule {}
