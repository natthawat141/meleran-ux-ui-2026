import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { PageQuery, decodeCursor, encodeCursor, page } from '../../shared/pagination/keyset';
import { ConversationCreateInput } from './dto/conversation-create.pipe';
import { AiConversationDto } from './dto/rename-conversation.dto';
import { MessageHistoryDto, messageMetadata, projectPractice } from './dto/message-history.dto';

const selectConversation={id:true,title:true,courseId:true,createdAt:true,updatedAt:true} as const;
const project=(r:{id:string;title:string|null;courseId:string|null;createdAt:Date;updatedAt:Date}):AiConversationDto=>{
  if(r.title===null)throw Error('Missing stored conversation title');
  return {id:r.id,title:r.title,course_id:r.courseId,created_at:r.createdAt.toISOString(),updated_at:r.updatedAt.toISOString()};
};
@Injectable()
export class ConversationHistoryService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  create(reference:VerifiedSessionReference,input:ConversationCreateInput):Promise<AiConversationDto> {
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireSelfWrite(tx,reference);
      if(input.course_id!==undefined) {
        // Upgrade eligibility before Course locks. Admin/owner management access
        // is separate from learning and never grants an Enrollment.
        const rows=await tx.$queryRaw<Array<{id:string;instructorId:string;status:string;publishedAt:Date|null;aiEnabled:boolean}>>(Prisma.sql`
          SELECT id,"instructorId",status,"publishedAt","aiEnabled" FROM courses WHERE id=${input.course_id} FOR SHARE`);
        const c=rows[0];if(!c)throw ApiException.notFound('ไม่พบคอร์ส');
        const management=actor.roles.includes('admin')||(actor.roles.includes('instructor')&&c.instructorId===actor.accountId);
        if(!management) {
          if(reference.audience!=='web'||actor.roles.includes('admin')||!actor.roles.some(role=>role==='learner'||role==='instructor'))throw ApiException.forbidden();
          if(!actor.learningEligible)throw new ApiException('email_not_verified',403,'กรุณายืนยันอีเมลก่อนใช้ AI ของคอร์ส');
          if(c.status!=='published'||!c.publishedAt)throw ApiException.notFound('ไม่พบคอร์ส');
          const grant=await tx.enrollment.findUnique({where:{accountId_courseId:{accountId:actor.accountId,courseId:c.id}},select:{id:true}});
          if(!grant)throw ApiException.forbidden('ยังไม่มีสิทธิ์อ่านคอร์สนี้');
        }
        if(!c.aiEnabled)throw new ApiException('ai_disabled',403,'คอร์สยังไม่เปิด AI');
      }
      return project(await tx.aIConversation.create({data:{accountId:actor.accountId,title:input.title??'แชตใหม่',
        courseId:input.course_id??null,contextSnapshot:{version:1}},select:selectConversation}));
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
  list(reference:VerifiedSessionReference,query:PageQuery) {
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireSelfRead(tx,reference),cursor=decodeCursor('own-ai-conversations',query,actor.accountId);
      const where:Prisma.AIConversationWhereInput={accountId:actor.accountId,deletedAt:null};
      const conditions:Prisma.AIConversationWhereInput[]=[];
      if(query.filters.q)conditions.push({OR:[{title:{contains:query.filters.q,mode:'insensitive'}},
        {messages:{some:{accountId:actor.accountId,content:{contains:query.filters.q,mode:'insensitive'}}}}]});
      if(cursor)conditions.push({OR:[{updatedAt:{lt:cursor.at}},{updatedAt:cursor.at,id:{gt:cursor.id}}]});
      if(conditions.length)where.AND=conditions;
      const rows=await tx.aIConversation.findMany({where,select:selectConversation,orderBy:[{updatedAt:'desc'},{id:'asc'}],take:query.limit+1});
      return page('own-ai-conversations',query,rows,row=>({id:row.id,at:row.updatedAt}),project,actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  messages(reference:VerifiedSessionReference,id:string,query:PageQuery) {
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireSelfRead(tx,reference);
      const conversations=await tx.$queryRaw<Array<{createdAt:Date}>>(Prisma.sql`
        SELECT "createdAt" FROM ai_conversations WHERE id=${id} AND "accountId"=${actor.accountId} AND "deletedAt" IS NULL FOR SHARE`);
      if(!conversations.length)throw ApiException.notFound();
      const route='ai-messages:'+id,cursor=decodeCursor(route,query,actor.accountId);
      if(cursor&&(!/^(0|[1-9][0-9]*)$/.test(cursor.id)||!Number.isSafeInteger(Number(cursor.id))||
        Number(cursor.id)>2147483647||cursor.at.getTime()!==conversations[0].createdAt.getTime()))throw ApiException.validationFailed('cursor ไม่ถูกต้อง');
      type Row={id:string;role:string;content:string;createdAt:Date;position:number;metadata:unknown};
      const rows=await tx.$queryRaw<Row[]>(Prisma.sql`
        SELECT id,role,content,"createdAt",position,"contextSnapshot"->'_wire' AS metadata FROM ai_messages
        WHERE "conversationId"=${id} AND "accountId"=${actor.accountId}
          AND position>${cursor?Number(cursor.id):-1} ORDER BY position ASC LIMIT ${query.limit+1}`);
      const selected=rows.slice(0,query.limit),items:MessageHistoryDto[]=[];
      for(const row of selected) {
        if(!['user','assistant'].includes(row.role))throw Error('Invalid stored message role');
        const metadata=messageMetadata(row.metadata);
        const practice=metadata.kind==='practice_set'?await tx.aIPractice.findFirst({where:{messageId:row.id,conversationId:id,accountId:actor.accountId},
          select:{id:true,payloadSnapshot:true,answers:true}}):null;
        if(metadata.kind==='practice_set'&&(!practice||row.role!=='assistant'||metadata.status!=='succeeded'))throw Error('Invalid stored practice linkage');
        items.push({id:row.id,role:row.role as 'user'|'assistant',content:row.content,request_id:metadata.request_id,kind:metadata.kind,
          status:metadata.status,completed_at:metadata.completed_at,error_code:metadata.error_code,created_at:row.createdAt.toISOString(),
          practice:practice?projectPractice(practice.id,practice.payloadSnapshot,practice.answers):null});
      }
      return {items,next_cursor:rows.length>query.limit?encodeCursor(route,query,{id:String(selected[selected.length-1].position),
        at:conversations[0].createdAt},actor.accountId):null};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  remove(reference:VerifiedSessionReference,id:string) {
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireSelfRead(tx,reference);
      const rows=await tx.$queryRaw<Array<{deletedAt:Date|null}>>(Prisma.sql`
        SELECT "deletedAt" FROM ai_conversations WHERE id=${id} AND "accountId"=${actor.accountId} FOR UPDATE`);
      if(!rows.length)throw ApiException.notFound();
      if(rows[0].deletedAt!==null)return;
      const now=(await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS now`)[0].now;
      await tx.aIConversation.update({where:{id},data:{deletedAt:now,updatedAt:now}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
}
