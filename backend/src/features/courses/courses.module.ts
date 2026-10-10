import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { PublicInstructorController } from './public-instructor.controller';
import { PublicInstructorService } from './public-instructor.service';

@Module({
  controllers: [CoursesController, PublicInstructorController],
  providers: [CoursesService, PublicInstructorService],
  exports: [CoursesService],
})
export class CoursesModule {}
