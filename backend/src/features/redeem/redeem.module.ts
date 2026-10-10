import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { RedeemWriter } from './redeem-writer.service';
import { RevokeCodeService } from './revoke-code.service';
import { RevokeCodeController } from './revoke-code.controller';

@Module({
  imports: [AuthModule, EnrollmentsModule],
  controllers: [RevokeCodeController],
  providers: [RedeemWriter, RevokeCodeService],
})
export class RedeemModule {}
