import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EntitlementWriter } from './public/entitlement-writer.service';
import { AuthModule } from '../auth/auth.module';
import { FreeEnrollmentService } from './free-enrollment.service';
import { ResumeWriter } from './public/resume-writer.service';
import { OwnEnrollmentListService } from './own-enrollment-list.service';

@Module({
  imports: [AuthModule],
  controllers: [EnrollmentsController],
  providers: [EntitlementWriter, FreeEnrollmentService, ResumeWriter, OwnEnrollmentListService],
  exports: [EntitlementWriter, ResumeWriter],
})
export class EnrollmentsModule {}
