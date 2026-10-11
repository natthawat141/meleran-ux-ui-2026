import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { PageQuery,decodeCursor,page } from '../../shared/pagination/keyset';
import { BlogWrite,safeContentUrl } from './dto/blog-request.pipe';
import { adminSelect,adminView,detail,detailSelect,summary,summarySelect } from './dto/blog.dto';

@Injectable()
export class BlogService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  publicList(query:PageQuery){
    const route='public-blog',cursor=decodeCursor(route,query),q=query.filters.q;
    const where:Prisma.BlogPostWhereInput={status:'published',deletedAt:null,publishedAt:{not:null},
      ...(query.filters.category!==undefined?{category:query.filters.category}:{}),
      ...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{excerpt:{contains:q,mode:'insensitive'}},{content:{contains:q,mode:'insensitive'}}]}:{})};
    if(cursor)where.AND=[{OR:[{publishedAt:{lt:cursor.at}},{publishedAt:cursor.at,id:{gt:cursor.id}}]}];
    return this.prisma.blogPost.findMany({where,select:summarySelect,orderBy:[{publishedAt:'desc'},{id:'asc'}],take:query.limit+1})
      .then(rows=>page(route,query,rows,row=>({id:row.id,at:row.publishedAt!}),summary));
  }
  async publicDetail(slug:string){const row=await this.prisma.blogPost.findFirst({where:{slug,status:'published',deletedAt:null,publishedAt:{not:null}},select:detailSelect});
    if(!row)throw ApiException.notFound();return detail(row);}
  adminList(reference:VerifiedSessionReference,query:PageQuery){
    if(query.filters.status!==undefined&&!['draft','published'].includes(query.filters.status))throw ApiException.validationFailed('สถานะบทความไม่ถูกต้อง');
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAdmin(tx,reference),route='admin-blog',cursor=decodeCursor(route,query,actor.accountId),q=query.filters.q;
      const where:Prisma.BlogPostWhereInput={deletedAt:null,...(query.filters.status?{status:query.filters.status}:{}),
        ...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{excerpt:{contains:q,mode:'insensitive'}},{content:{contains:q,mode:'insensitive'}}]}:{})};
      if(cursor)where.AND=[{OR:[{updatedAt:{lt:cursor.at}},{updatedAt:cursor.at,id:{gt:cursor.id}}]}];
      const rows=await tx.blogPost.findMany({where,select:adminSelect,orderBy:[{updatedAt:'desc'},{id:'asc'}],take:query.limit+1});
      return page(route,query,rows,row=>({id:row.id,at:row.updatedAt}),adminView,actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  preview(reference:VerifiedSessionReference,id:string){return this.prisma.$transaction(async tx=>{
    await this.principals.requireAdmin(tx,reference);const row=await tx.blogPost.findFirst({where:{id,deletedAt:null},select:adminSelect});
    if(!row)throw ApiException.notFound();return adminView(row);
  });}
  async create(reference:VerifiedSessionReference,input:BlogWrite){
    try{return await this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAdmin(tx,reference);
      const row=await tx.blogPost.create({data:{title:input.title!,slug:input.slug!,category:input.category??'',coverUrl:input.cover_url??null,excerpt:input.excerpt??null,
        content:input.content!,contentDoc:input.content_doc??Prisma.JsonNull,readingMinutes:this.readingMinutes(input.content!),authorId:actor.accountId,editorId:actor.accountId,
        status:'draft',revision:1},select:adminSelect});return adminView(row);
    });}catch(error){this.slugConflict(error);throw error;}
  }
  private readingMinutes(content:string){return Math.max(1,Math.ceil([...content].length/1000));}
  private slugConflict(error:unknown):void {
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'&&String(error.meta?.target).includes('slug'))
      throw ApiException.conflict('slug_taken','Slug นี้ถูกใช้แล้ว');
  }
  private publishable(content:string,document:Prisma.JsonValue|null):boolean{
    if(content.trim())return true;
    const hasContent=(value:Prisma.JsonValue|undefined):boolean=>{
      if(Array.isArray(value))return value.some(hasContent);
      if(value&&typeof value==='object'){
        const attrs=value.attrs;
        const image=value.type==='image'&&attrs&&typeof attrs==='object'&&!Array.isArray(attrs)&&typeof attrs.src==='string'&&safeContentUrl(attrs.src,true);
        return (typeof value.text==='string'&&!!value.text.trim())||!!image||Object.values(value).some(hasContent);
      }
      return false;
    };return hasContent(document);
  }
  async mutate(reference:VerifiedSessionReference,id:string,input:BlogWrite,command:'patch'|'publish'|'unpublish'|'delete'){
    try{return await this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAdmin(tx,reference);
      const found=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM blog_posts WHERE id=${id} AND "deletedAt" IS NULL FOR UPDATE`);
      if(!found.length)throw ApiException.notFound();
      const row=await tx.blogPost.findUniqueOrThrow({where:{id},select:adminSelect});adminView(row);
      if(row.revision!==input.expected_revision)throw new ApiException('revision_conflict',409,'บทความเปลี่ยนแปลงแล้ว กรุณาโหลดล่าสุด',{current_revision:row.revision});
      if(row.revision===2147483647)throw ApiException.conflict('invalid_state','Revision เกินขอบเขตที่รองรับ');
      const [{now}]=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS now`;
      const data:Prisma.BlogPostUpdateInput={revision:{increment:1},updatedAt:now,editor:{connect:{id:actor.accountId}}};
      if(command==='patch'){
        if(input.slug!==undefined&&row.publishedAt&&input.slug!==row.slug)throw ApiException.conflict('invalid_state','บทความที่เคยเผยแพร่แล้วเปลี่ยน Slug ไม่ได้');
        for(const key of ['title','slug','category','content'] as const)if(input[key]!==undefined)data[key]=input[key];
        if(input.cover_url!==undefined)data.coverUrl=input.cover_url;if(input.excerpt!==undefined)data.excerpt=input.excerpt;
        if(input.content_doc!==undefined)data.contentDoc=input.content_doc??Prisma.JsonNull;
        if(input.content!==undefined)data.readingMinutes=this.readingMinutes(input.content);
      }else if(command==='publish'){
        if(!row.title.trim()||!this.publishable(row.content!,row.contentDoc))throw ApiException.validationFailed('บทความยังไม่มีชื่อหรือเนื้อหาที่พร้อมเผยแพร่');
        data.status='published';if(!row.publishedAt)data.publishedAt=now;
      }else if(command==='unpublish')data.status='draft';
      else{data.deletedAt=now;data.deleter={connect:{id:actor.accountId}};}
      const updated=await tx.blogPost.update({where:{id},data,select:adminSelect});
      return command==='delete'?{id,deleted:true as const}:adminView(updated);
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});}catch(error){this.slugConflict(error);throw error;}
  }
}
