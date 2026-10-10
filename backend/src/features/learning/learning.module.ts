import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LearningController } from './learning.controller';
import { LearningReadService } from './learning-read.service';

@Module({ imports: [AuthModule], controllers: [LearningController], providers: [LearningReadService] })
export class LearningModule {}
