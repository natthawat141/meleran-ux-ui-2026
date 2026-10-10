import { Controller, Param, Post } from '@nestjs/common';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { VideoUploadService } from './video-upload.service';

@AuthoritativeAudience('web', 'admin')
@Roles('instructor', 'admin')
@Controller('courses')
export class VideoUploadController {
  constructor(private readonly videos: VideoUploadService) {}

  @Post(':id/videos/uploads')
  upload(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string) {
    return this.videos.unavailable(actor.session, id);
  }
}
