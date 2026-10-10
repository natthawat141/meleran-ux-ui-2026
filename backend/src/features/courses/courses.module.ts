import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { PublicInstructorController } from './public-instructor.controller';
import { PublicInstructorService } from './public-instructor.service';
import { AiSupportWriter } from './public/ai-support-writer.service';
import { AuthModule } from '../auth/auth.module';
import { VideoUploadController } from './video-upload.controller';
import { VideoUploadService } from './video-upload.service';

@Module({
  imports: [AuthModule],
  controllers: [CoursesController, PublicInstructorController, VideoUploadController],
  providers: [CoursesService, PublicInstructorService, AiSupportWriter, VideoUploadService],
  exports: [CoursesService, AiSupportWriter],
})
export class CoursesModule {}
