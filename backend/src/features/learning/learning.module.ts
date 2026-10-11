import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LearningController } from './learning.controller';
import { LearningReadService } from './learning-read.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ResumeCommandController } from './resume-command.controller';
import { ResumeCommandService } from './resume-command.service';
import { CompleteItemController } from './complete-item.controller';
import { CompleteItemService } from './complete-item.service';
import { OwnProgressService } from './own-progress.service';
import { OwnProgressController } from './own-progress.controller';

@Module({ imports: [AuthModule, EnrollmentsModule], controllers: [LearningController, ResumeCommandController,CompleteItemController,OwnProgressController],
  providers: [LearningReadService, ResumeCommandService,CompleteItemService,OwnProgressService] })
export class LearningModule {}
