import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ResumeWriter, SavedResume, storedResume } from '../enrollments/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { ResumeInput } from './dto/resume.pipe';

@Injectable()
export class ResumeCommandService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService,private readonly writer:ResumeWriter){}
  save(reference:VerifiedSessionReference,itemId:string,input:ResumeInput):Promise<SavedResume> {
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireLearning(tx,reference);
      const location=await tx.courseItem.findUnique({where:{id:itemId},select:{courseId:true}});
      if(!location)throw ApiException.notFound('ไม่พบเนื้อหา');
      const courses=await tx.$queryRaw<Array<{id:string;status:string;publishedAt:Date|null;instructorId:string}>>(Prisma.sql`
        SELECT id,status,"publishedAt","instructorId" FROM courses WHERE id=${location.courseId} FOR SHARE`);
      const course=courses[0];
      if(!course||course.status!=='published'||!course.publishedAt)throw ApiException.notFound('ไม่พบคอร์ส');
      if(course.instructorId===actor.accountId)throw ApiException.forbidden('ใช้หน้า Preview เพื่อจัดการคอร์สตนเอง');
      const grants=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
        SELECT id FROM enrollments WHERE "courseId"=${course.id} AND "accountId"=${actor.accountId} FOR UPDATE`);
      if(!grants.length)throw ApiException.forbidden('ยังไม่มีสิทธิ์เรียนคอร์สนี้');
      const item=await tx.courseItem.findFirst({where:{id:itemId,courseId:course.id},select:{type:true}});
      if(!item)throw ApiException.notFound('ไม่พบเนื้อหา');
      if(!['video','article','quiz'].includes(item.type))throw Error('Invalid stored item type');
      if(typeof input.position_seconds==='number'&&item.type!=='video')throw ApiException.validationFailed('ตำแหน่งวินาทีใช้กับวิดีโอเท่านั้น');
      let position=input.position_seconds;
      if(position===undefined) {
        const previous=await tx.progress.findUnique({where:{enrollmentId_itemId:{enrollmentId:grants[0].id,itemId}},select:{resumeData:true,updatedAt:true}});
        position=previous?storedResume(previous.resumeData,previous.updatedAt)?.wire.position_seconds??null:null;
      }
      return this.writer.save(tx,grants[0].id,itemId,course.id,position);
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
}
