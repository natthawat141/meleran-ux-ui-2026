import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EntitlementWriter } from './public/entitlement-writer.service';
import { AuthModule } from '../auth/auth.module';
import { FreeEnrollmentService } from './free-enrollment.service';
import { ResumeWriter } from './public/resume-writer.service';
import { OwnEnrollmentListService } from './own-enrollment-list.service';
import { CompletionCoordinator } from './public/completion-coordinator';
import { CertificatesModule } from '../certificates/certificates.module';
import { AssessmentsModule } from '../assessments/assessments.module';

@Module({
  imports: [AuthModule,CertificatesModule,AssessmentsModule],
  controllers: [EnrollmentsController],
  providers: [EntitlementWriter, FreeEnrollmentService, ResumeWriter, OwnEnrollmentListService,CompletionCoordinator],
  exports: [EntitlementWriter, ResumeWriter,CompletionCoordinator],
})
export class EnrollmentsModule {}
