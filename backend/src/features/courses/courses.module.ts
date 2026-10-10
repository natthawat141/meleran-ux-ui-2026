import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { PublicInstructorController } from './public-instructor.controller';
import { PublicInstructorService } from './public-instructor.service';
import { AiSupportWriter } from './public/ai-support-writer.service';

@Module({
  controllers: [CoursesController, PublicInstructorController],
  providers: [CoursesService, PublicInstructorService, AiSupportWriter],
  exports: [CoursesService, AiSupportWriter],
})
export class CoursesModule {}
