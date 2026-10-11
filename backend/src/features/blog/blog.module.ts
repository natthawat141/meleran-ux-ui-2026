import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlogService } from './blog.service';
import { PublicBlogController,AdminBlogController } from './blog.controller';
@Module({imports:[AuthModule],controllers:[PublicBlogController,AdminBlogController],providers:[BlogService]})
export class BlogModule{}
