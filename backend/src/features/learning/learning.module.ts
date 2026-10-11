import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LearningController } from './learning.controller';
import { LearningReadService } from './learning-read.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ResumeCommandController } from './resume-command.controller';
import { ResumeCommandService } from './resume-command.service';

@Module({ imports: [AuthModule, EnrollmentsModule], controllers: [LearningController, ResumeCommandController],
  providers: [LearningReadService, ResumeCommandService] })
export class LearningModule {}
