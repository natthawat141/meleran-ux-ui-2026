import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { AdminAiController } from './admin-ai.controller';
import { AdminAiService } from './admin-ai.service';

@Module({ imports: [AuthModule, CoursesModule], controllers: [AdminAiController], providers: [AdminAiService] })
export class AiModule {}
