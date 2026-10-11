import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { PublicInstructorController } from './public-instructor.controller';
import { PublicInstructorService } from './public-instructor.service';
import { AiSupportWriter } from './public/ai-support-writer.service';
import { AuthModule } from '../auth/auth.module';
import { VideoUploadController } from './video-upload.controller';
import { VideoUploadService } from './video-upload.service';
import { CatalogListService } from './catalog-list.service';
import { CourseDirectoryService } from './course-directory.service';
import { CourseDirectoryController } from './course-directory.controller';
import { AuthoringReadService } from './authoring-read.service';
import { AuthoringReadController } from './authoring-read.controller';
import { AuthoringWriteController } from './authoring-write.controller';
import { AuthoringWriteService } from './authoring-write.service';
import { CourseReviewController } from './course-review.controller';
import { CourseReviewService } from './course-review.service';

@Module({
  imports: [AuthModule],
  controllers: [CoursesController, PublicInstructorController, VideoUploadController,CourseDirectoryController,AuthoringReadController,AuthoringWriteController,CourseReviewController],
  providers: [CoursesService, PublicInstructorService, AiSupportWriter, VideoUploadService, CatalogListService,CourseDirectoryService,AuthoringReadService,AuthoringWriteService,CourseReviewService],
  exports: [CoursesService, AiSupportWriter],
})
export class CoursesModule {}
