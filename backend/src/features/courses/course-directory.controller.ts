import { Body,Controller,Get,Post,Query } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { PageQuery,PageQueryPipe } from '../../shared/pagination/keyset';
import { CourseMetadata,CourseMetadataPipe } from './dto/course-metadata.pipe';
import { CourseDirectoryService } from './course-directory.service';

@Controller() export class CourseDirectoryController{
  constructor(private readonly courses:CourseDirectoryService){}
  @Post('instructor/courses') @AuthoritativeAudience('web')
  instructorCreate(@CurrentPrincipal() actor:AuthPrincipal,@Body(new CourseMetadataPipe()) input:CourseMetadata){return this.courses.create(actor.session,input,false);}
  @Post('admin/courses') @AuthoritativeAudience('admin')
  adminCreate(@CurrentPrincipal() actor:AuthPrincipal,@Body(new CourseMetadataPipe(true)) input:CourseMetadata){return this.courses.create(actor.session,input,true);}
  @Get('instructor/courses') @AuthoritativeAudience('web')
  instructorList(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe(['status'])) query:PageQuery){return this.courses.list(actor.session,query,false);}
  @Get('admin/courses') @AuthoritativeAudience('admin')
  adminList(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe(['status'])) query:PageQuery){return this.courses.list(actor.session,query,true);}
}
