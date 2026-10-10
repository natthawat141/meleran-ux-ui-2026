import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { AdminAiController } from './admin-ai.controller';
import { AdminAiService } from './admin-ai.service';
import { PracticeAnswerController } from './practice-answer.controller';
import { PracticeAnswerService } from './practice-answer.service';
import { AiUsageController } from './ai-usage.controller';
import { AiUsageService } from './ai-usage.service';
import { RenameConversationController } from './rename-conversation.controller';
import { RenameConversationService } from './rename-conversation.service';

@Module({ imports: [AuthModule, CoursesModule], controllers: [AdminAiController, PracticeAnswerController, AiUsageController, RenameConversationController], providers: [AdminAiService, PracticeAnswerService, AiUsageService, RenameConversationService] })
export class AiModule {}
