import { Module } from '@nestjs/common';
import { AssessmentReadModule } from '../assessments/assessment-read.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { CompletionCoordinator } from './public/completion-coordinator';

/** Enrollment-owned writer consumes read proofs; assessment writers can call it without a module cycle. */
@Module({imports:[AssessmentReadModule,CertificatesModule],providers:[CompletionCoordinator],exports:[CompletionCoordinator]})
export class CompletionModule{}
