import { Body,Controller,Delete,Get,HttpCode,Param,Patch,Post,Query } from '@nestjs/common';
import { Public,AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { PageQuery,PageQueryPipe } from '../../shared/pagination/keyset';
import { BlogService } from './blog.service';
import { BlogRequestPipe,BlogWrite } from './dto/blog-request.pipe';

@Controller('blog')
export class PublicBlogController{
  constructor(private readonly blog:BlogService){}
  @Public() @Get() list(@Query(new PageQueryPipe(['q','category'])) query:PageQuery){return this.blog.publicList(query);}
  @Public() @Get(':slug') detail(@Param('slug') slug:string,@Query(new EmptyRequestPipe()) _query:void){return this.blog.publicDetail(slug);}
}
@Controller('admin/blog') @AuthoritativeAudience('admin')
export class AdminBlogController{
  constructor(private readonly blog:BlogService){}
  @Get() list(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe(['q','status'])) query:PageQuery){return this.blog.adminList(actor.session,query);}
  @Get(':id/preview') preview(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Query(new EmptyRequestPipe()) _query:void){return this.blog.preview(actor.session,id);}
  @Post() create(@CurrentPrincipal() actor:AuthPrincipal,@Body(new BlogRequestPipe('create')) input:BlogWrite){return this.blog.create(actor.session,input);}
  @Patch(':id') patch(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new BlogRequestPipe('patch')) input:BlogWrite){return this.blog.mutate(actor.session,id,input,'patch');}
  @Post(':id/publish') @HttpCode(200) publish(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new BlogRequestPipe('revision')) input:BlogWrite){return this.blog.mutate(actor.session,id,input,'publish');}
  @Post(':id/unpublish') @HttpCode(200) unpublish(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new BlogRequestPipe('revision')) input:BlogWrite){return this.blog.mutate(actor.session,id,input,'unpublish');}
  @Delete(':id') remove(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new BlogRequestPipe('revision')) input:BlogWrite){return this.blog.mutate(actor.session,id,input,'delete');}
}
