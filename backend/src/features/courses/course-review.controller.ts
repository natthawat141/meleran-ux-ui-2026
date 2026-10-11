import { Body,Controller,Get,HttpCode,Param,Post,Query } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { PageQuery,PageQueryPipe } from '../../shared/pagination/keyset';
import { ReviewRevisionPipe,ReviewReturnPipe,EmptyCourseCommandPipe } from './dto/course-patch.pipe';
import { CourseReviewService } from './course-review.service';
@Controller()
export class CourseReviewController{
  constructor(private readonly reviews:CourseReviewService){}
  @Get('admin/course-reviews') @AuthoritativeAudience('admin')
  list(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe(['status'])) query:PageQuery){return this.reviews.list(actor.session,query);}
  @Get('admin/course-reviews/:id') @AuthoritativeAudience('admin')
  detail(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string){return this.reviews.detail(actor.session,id);}
  @Post('admin/course-reviews/:id/approve') @HttpCode(200) @AuthoritativeAudience('admin')
  approve(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new ReviewRevisionPipe()) input:{expected_revision:number}){return this.reviews.decide(actor.session,id,input,'approved');}
  @Post('admin/course-reviews/:id/return') @HttpCode(200) @AuthoritativeAudience('admin')
  return(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new ReviewReturnPipe()) input:{reason:string}){return this.reviews.decide(actor.session,id,input,'returned');}
  @Post('courses/:id/publish') @HttpCode(200) @AuthoritativeAudience('web','admin')
  publish(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new EmptyCourseCommandPipe()) _input:Record<string,never>){return this.reviews.publish(actor.session,id);}
}
