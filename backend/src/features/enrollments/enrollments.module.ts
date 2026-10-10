import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { EntitlementWriter } from './public/entitlement-writer.service';
import { AuthModule } from '../auth/auth.module';
import { FreeEnrollmentService } from './free-enrollment.service';

@Module({
  imports: [AuthModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EntitlementWriter, FreeEnrollmentService],
  exports: [EnrollmentsService, EntitlementWriter],
})
export class EnrollmentsModule {}
