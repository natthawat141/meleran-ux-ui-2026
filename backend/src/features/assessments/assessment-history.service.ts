import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { PageQuery,decodeCursor,encodeCursor } from '../../shared/pagination/keyset';
import { AttemptReadService } from './attempt-read.service';
import { BestResultReader,ManagedAttemptReader } from './public/index';

@Injectable() export class AssessmentHistoryService{
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService,private readonly views:AttemptReadService,
    private readonly best:BestResultReader,private readonly managed:ManagedAttemptReader){}
  results(reference:VerifiedSessionReference,itemId:string){
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireSelfRead(tx,reference);if(reference.audience!=='web')throw ApiException.forbidden();
      const quiz=await tx.quiz.findUnique({where:{itemId},select:{id:true,courseId:true}});if(!quiz)throw ApiException.notFound();
      const grants=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM enrollments WHERE "accountId"=${actor.accountId} AND "courseId"=${quiz.courseId} FOR SHARE`);
      if(!grants.length)throw ApiException.notFound();
      const rows=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM quiz_attempts WHERE "enrollmentId"=${grants[0].id}
        AND "quizId"=${quiz.id} AND "courseId"=${quiz.courseId} ORDER BY number DESC,id ASC FOR SHARE`);
      const attempts=[];
      for(const row of rows){const v=await this.views.readLocked(tx,row.id,itemId);attempts.push({attempt_id:v.id,number:v.number,status:v.status,
        submitted_at:v.submitted_at,graded_at:v.graded_at,earned:v.earned,max:v.max,percent:v.percent,passed:v.passed});}
      const result=await this.best.read(tx,grants[0].id,quiz.courseId,itemId);
      return {attempts,best:result?{attempt_id:result.attempt_id,earned:Number(result.earned),max:Number(result.max),percent:result.percent,passed:result.passed}:null,
        completed:result?.passed??false};
    },{timeout:20000});
  }
  queue(reference:VerifiedSessionReference,query:PageQuery){
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAuthoring(tx,reference);
      if(reference.audience!=='web'||actor.roles.includes('admin')||!actor.roles.includes('instructor'))throw ApiException.forbidden();
      const route='grading-queue',cursor=decodeCursor(route,query,actor.accountId);
      // Locks freeze owner assignment throughout this list. No cross-owner IDs selected.
      const courses=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM courses WHERE "instructorId"=${actor.accountId} ORDER BY id FOR SHARE`);
      const where:Prisma.QuizAttemptWhereInput={courseId:{in:courses.map(c=>c.id)},status:'pending_review',submittedAt:{not:null},
        snapshotQuestions:{some:{type:{in:['essay','image']},answer:{is:{score:null}}}}};
      if(cursor)where.OR=[{submittedAt:{lt:cursor.at}},{submittedAt:cursor.at,id:{gt:cursor.id}}];
      const rows=await tx.quizAttempt.findMany({where,orderBy:[{submittedAt:'desc'},{id:'asc'}],take:query.limit+1,select:{id:true,courseId:true,submittedAt:true}});
      const selected=rows.slice(0,query.limit),items=[];
      for(const row of selected){
        const view=await this.managed.read(tx,{id:row.id,courseId:row.courseId});
        if(!view.submitted_at)throw Error('Missing queue submission');
        const questions=view.questions.filter(q=>['essay','image'].includes(q.type)&&!view.grades[q.id]);
        items.push({attempt_id:view.id,course_id:view.course_id,item_id:view.item_id,user_id:view.user_id,learner_display_name:view.learner_display_name,
          submitted_at:view.submitted_at,questions_to_grade:questions.map(q=>({question_id:q.id,type:q.type,prompt:q.prompt,max:q.points,
            answer:{...(view.answers[q.id]?.text!==undefined?{text:view.answers[q.id].text}:{}),...(view.answers[q.id]?.image_url!==undefined?{image_url:view.answers[q.id].image_url}:{})}}))});
      }
      const last=selected[selected.length-1];return {items,next_cursor:rows.length>query.limit&&last?encodeCursor(route,query,{id:last.id,at:last.submittedAt!},actor.accountId):null};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:20000});
  }
}
