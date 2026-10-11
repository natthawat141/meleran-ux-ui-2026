import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { Page,PageQuery,decodeCursor,page } from '../../shared/pagination/keyset';
import { CourseMetadata } from './dto/course-metadata.pipe';
import { ManagedCourseDto,managedCourse,managementSelect } from './dto/managed-course.dto';

@Injectable()
export class CourseDirectoryService{
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  create(reference:VerifiedSessionReference,input:CourseMetadata,admin:boolean):Promise<ManagedCourseDto>{
    return this.prisma.$transaction(async tx=>{
      const actor=admin?await this.principals.requireAdmin(tx,reference):await this.principals.requireAuthoring(tx,reference);
      if(!admin&&(actor.roles.includes('admin')||!actor.roles.includes('instructor')))throw ApiException.forbidden();
      const instructorId=admin?input.instructor_id!:actor.accountId;
      // Preserve grant proof until commit; no compatibility CSV/Frontend entity authority.
      const grants=await tx.$queryRaw<Array<{accountId:string}>>(Prisma.sql`
        SELECT "accountId" FROM user_roles WHERE "accountId"=${instructorId} AND role='instructor' FOR SHARE`);
      if(!grants.length)throw ApiException.validationFailed('ต้องเลือกบัญชีที่มีสิทธิ์ Instructor');
      const id=randomUUID();
      const row=await tx.course.create({data:{id,slug:'course-'+id,title:input.title,subtitle:input.subtitle,description:input.description,
        coverUrl:input.cover_url,category:input.category,level:input.level,priceMinor:input.price?.amount_minor??null,currency:'THB',
        outcomesJson:JSON.stringify(input.outcomes),instructorId,createdBy:actor.accountId,status:'draft',revision:1,aiEnabled:false},select:managementSelect});
      return managedCourse(row);
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
  list(reference:VerifiedSessionReference,query:PageQuery,admin:boolean):Promise<Page<ManagedCourseDto>>{
    const status=query.filters.status;if(status!==undefined&&!['draft','pending_review','approved','published','archived'].includes(status))
      throw ApiException.validationFailed('สถานะคอร์สไม่ถูกต้อง');
    return this.prisma.$transaction(async tx=>{
      const actor=admin?await this.principals.requireAdmin(tx,reference):await this.principals.requireAuthoring(tx,reference);
      if(!admin&&(actor.roles.includes('admin')||!actor.roles.includes('instructor')))throw ApiException.forbidden();
      const route=admin?'admin-courses':'owned-courses',cursor=decodeCursor(route,query,actor.accountId);
      const where:Prisma.CourseWhereInput={...(admin?{}:{instructorId:actor.accountId}),...(status!==undefined?{status}:{})};
      if(cursor)where.OR=[{createdAt:{lt:cursor.at}},{createdAt:cursor.at,id:{gt:cursor.id}}];
      const rows=await tx.course.findMany({where,select:managementSelect,orderBy:[{createdAt:'desc'},{id:'asc'}],take:query.limit+1});
      return page(route,query,rows,row=>({id:row.id,at:row.createdAt}),managedCourse,actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
