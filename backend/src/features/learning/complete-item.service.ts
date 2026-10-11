import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { CompletionCoordinator } from '../enrollments/public/index';
import { ApiException } from '../../shared/errors/api-exception';

export interface CompleteResponse {item_id:string;completed_at:string;progress:{completed_items:number;total_items:number;completed_at:string|null};course_completed_at:string|null;certificate_id:string|null}
@Injectable()
export class CompleteItemService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService,private readonly completion:CompletionCoordinator){}
  complete(reference:VerifiedSessionReference,itemId:string):Promise<CompleteResponse>{
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireLearning(tx,reference);
      const location=await tx.courseItem.findUnique({where:{id:itemId},select:{courseId:true}});
      if(!location)throw ApiException.notFound('ไม่พบเนื้อหา');
      const courses=await tx.$queryRaw<Array<{id:string;status:string;publishedAt:Date|null;instructorId:string}>>(Prisma.sql`
        SELECT id,status,"publishedAt","instructorId" FROM courses WHERE id=${location.courseId} FOR SHARE`);
      const course=courses[0];if(!course||course.status!=='published'||!course.publishedAt)throw ApiException.notFound('ไม่พบคอร์ส');
      if(course.instructorId===actor.accountId)throw ApiException.forbidden('ใช้หน้า Preview เพื่อจัดการคอร์สตนเอง');
      const grants=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
        SELECT id FROM enrollments WHERE "courseId"=${course.id} AND "accountId"=${actor.accountId} FOR UPDATE`);
      if(!grants.length)throw ApiException.forbidden('ยังไม่มีสิทธิ์เรียนคอร์สนี้');
      const item=await tx.courseItem.findFirst({where:{id:itemId,courseId:course.id},select:{type:true}});
      if(!item)throw ApiException.notFound('ไม่พบเนื้อหา');
      if(item.type==='quiz')throw ApiException.conflict('quiz_completion_requires_result','แบบฝึกหัดจบจากผลตรวจที่ผ่านเท่านั้น');
      if(!['video','article'].includes(item.type))throw Error('Invalid stored item type');
      const result=await this.completion.completeManual(tx,grants[0].id,course.id,itemId);
      return {item_id:itemId,completed_at:result.completed_at,progress:{completed_items:result.state.completed_items,
        total_items:result.state.total_items,completed_at:result.state.completed_at},course_completed_at:result.state.completed_at,
        certificate_id:result.state.certificate_id};
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
}
