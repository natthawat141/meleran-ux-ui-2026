import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { AdminAiController } from './admin-ai.controller';
import { AdminAiService } from './admin-ai.service';
import { PracticeAnswerController } from './practice-answer.controller';
import { PracticeAnswerService } from './practice-answer.service';

@Module({ imports: [AuthModule, CoursesModule], controllers: [AdminAiController, PracticeAnswerController], providers: [AdminAiService, PracticeAnswerService] })
export class AiModule {}
