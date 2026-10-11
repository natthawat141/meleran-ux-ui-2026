import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttemptReadController } from './attempt-read.controller';
import { AttemptReadService } from './attempt-read.service';
import { ManagedAttemptReadService } from './managed-attempt-read.service';
import { ManagedAttemptReadController } from './managed-attempt-read.controller';
import { AssessmentReadModule } from './assessment-read.module';
import { CompletionModule } from '../enrollments/completion.module';
import { AssessmentWriteController } from './assessment-write.controller';
import { AssessmentWriteService } from './assessment-write.service';
import { AssessmentHistoryService } from './assessment-history.service';

@Module({ imports: [AuthModule,AssessmentReadModule,CompletionModule], controllers: [AttemptReadController,ManagedAttemptReadController,AssessmentWriteController], providers: [AttemptReadService,ManagedAttemptReadService,AssessmentWriteService,AssessmentHistoryService], exports:[AssessmentReadModule] })
export class AssessmentsModule {}
