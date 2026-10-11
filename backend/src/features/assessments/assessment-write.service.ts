import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { CompletionCoordinator } from '../enrollments/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { AttemptReadService } from './attempt-read.service';
import { SaveAnswers,ManualGrade } from './dto/assessment-write.pipe';
import { answerComplete } from './answer-completeness';
import { summarizeSubmittedScores } from './submitted-score';

const Exact=Prisma.Decimal.clone({precision:100});
const object=(v:unknown):v is Record<string,Prisma.JsonValue>=>!!v&&typeof v==='object'&&!Array.isArray(v);
interface LearningScope{enrollmentId:string;courseId:string;itemId:string}

@Injectable() export class AssessmentWriteService{
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService,
    private readonly views:AttemptReadService,private readonly completion:CompletionCoordinator){}

  private async learning(tx:Prisma.TransactionClient,reference:VerifiedSessionReference,locator:{itemId?:string;attemptId?:string}):Promise<LearningScope>{
    const actor=await this.principals.requireLearning(tx,reference);
    const found=locator.itemId?await tx.courseItem.findUnique({where:{id:locator.itemId},select:{id:true,courseId:true}}):
      await tx.quizAttempt.findUnique({where:{id:locator.attemptId},select:{courseId:true,definitionSnapshot:true}});
    if(!found)throw ApiException.notFound();
    const courses=await tx.$queryRaw<Array<{instructorId:string;status:string;publishedAt:Date|null}>>(Prisma.sql`
      SELECT "instructorId",status,"publishedAt" FROM courses WHERE id=${found.courseId} FOR SHARE`);
    const course=courses[0];if(!course||course.status!=='published'||!course.publishedAt)throw ApiException.notFound();
    if(course.instructorId===actor.accountId)throw ApiException.forbidden();
    const grants=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
      SELECT id FROM enrollments WHERE "courseId"=${found.courseId} AND "accountId"=${actor.accountId} FOR UPDATE`);
    if(!grants.length)throw ApiException.forbidden('ยังไม่มีสิทธิ์เรียนคอร์สนี้');
    if(locator.attemptId){
      const attempts=await tx.$queryRaw<Array<{itemId:unknown}>>(Prisma.sql`
        SELECT "definitionSnapshot"->'item_id' AS "itemId" FROM quiz_attempts WHERE id=${locator.attemptId}
          AND "enrollmentId"=${grants[0].id} AND "courseId"=${found.courseId} FOR UPDATE`);
      if(!attempts.length)throw ApiException.notFound();
      if(typeof attempts[0].itemId!=='string')throw Error('Invalid attempt item snapshot');
      return {enrollmentId:grants[0].id,courseId:found.courseId,itemId:attempts[0].itemId};
    }
    const item=await tx.courseItem.findFirst({where:{id:locator.itemId,courseId:found.courseId,type:'quiz'},select:{id:true}});
    if(!item)throw ApiException.notFound();
    return {enrollmentId:grants[0].id,courseId:found.courseId,itemId:item.id};
  }

  start(reference:VerifiedSessionReference,itemId:string){
    return this.prisma.$transaction(async tx=>{
      const scope=await this.learning(tx,reference,{itemId});
      const quiz=await tx.quiz.findFirst({where:{itemId,courseId:scope.courseId},select:{id:true,questions:{orderBy:[{position:'asc'},{id:'asc'}],select:{id:true,type:true,position:true,prompt:true,options:true,correctKey:true,maxScore:true}}}});
      if(!quiz)throw ApiException.notFound();
      const existing=await tx.quizAttempt.findMany({where:{enrollmentId:scope.enrollmentId,quizId:quiz.id,status:'in_progress'},select:{id:true}});
      if(existing.length>1)throw Error('Multiple active attempts require explicit repair');
      if(existing.length)return {created:false,view:await this.views.readLocked(tx,existing[0].id,itemId)};
      if(!quiz.questions.length)throw ApiException.conflict('quiz_not_ready','แบบฝึกหัดยังไม่พร้อม');
      const snapshots=quiz.questions.map(q=>{
        const meta=typeof q.prompt==='string'?{prompt:q.prompt}:q.prompt;
        if(!object(meta)||typeof meta.prompt!=='string'||!['single_choice','multiple_choice','essay','image'].includes(q.type)||!Array.isArray(q.options)||q.maxScore.isNegative())throw Error('Invalid quiz definition');
        const payload:Record<string,Prisma.JsonValue>={...meta,options:q.options,correct_key:q.correctKey};
        if(q.type.endsWith('choice')){
          const ids=q.options.map(o=>{if(!object(o)||typeof o.id!=='string'||!o.id||typeof o.text!=='string')throw Error('Invalid choice definition');return o.id;});
          const key=q.correctKey;if(!object(key)||!Array.isArray(key.option_ids)||!key.option_ids.length||
            key.option_ids.some(id=>typeof id!=='string'||!ids.includes(id))||new Set(key.option_ids).size!==key.option_ids.length||
            new Set(ids).size!==ids.length||(q.type==='single_choice'&&key.option_ids.length!==1))throw Error('Invalid frozen choice key');
        }
        return {questionId:q.id,type:q.type,position:q.position,maxScore:q.maxScore,payloadSnapshot:payload as Prisma.InputJsonObject};
      });
      const max=snapshots.reduce((sum,q)=>sum.plus(q.maxScore),new Exact(0));
      if(!max.isFinite()||!max.gt(0)||max.gte('1e35'))throw ApiException.conflict('quiz_not_ready','คะแนนเต็มไม่พร้อม');
      const previous=await tx.quizAttempt.aggregate({where:{enrollmentId:scope.enrollmentId,quizId:quiz.id},_max:{number:true}});
      const number=(previous._max.number??0)+1;if(number>2147483647)throw ApiException.conflict('attempt_limit_reached','จำนวนครั้งเกินขอบเขตข้อมูล');
      const row=await tx.quizAttempt.create({data:{enrollmentId:scope.enrollmentId,courseId:scope.courseId,quizId:quiz.id,number,
        maxScore:max,definitionSnapshot:{version:1,item_id:itemId},snapshotQuestions:{create:snapshots}},select:{id:true}});
      return {created:true,view:await this.views.readLocked(tx,row.id,itemId)};
    },{timeout:20000});
  }

  save(reference:VerifiedSessionReference,id:string,body:SaveAnswers){
    return this.prisma.$transaction(async tx=>{
      const scope=await this.learning(tx,reference,{attemptId:id});
      const attempt=await tx.quizAttempt.findUniqueOrThrow({where:{id},select:{status:true,submittedAt:true}});
      if(attempt.status!=='in_progress'||attempt.submittedAt)throw ApiException.conflict('attempt_frozen','ส่งคำตอบแล้ว');
      const questions=await tx.attemptQuestion.findMany({where:{attemptId:id},select:{questionId:true,type:true,payloadSnapshot:true}}),byId=new Map(questions.map(q=>[q.questionId,q]));
      for(const [questionId,a]of Object.entries(body.answers)){
        const q=byId.get(questionId);if(!q)throw ApiException.validationFailed('Question ID ไม่ได้อยู่ในครั้งนี้');
        if(!object(q.payloadSnapshot)||!Array.isArray(q.payloadSnapshot.options))throw Error('Invalid question snapshot');
        if(q.type.endsWith('choice')){
          const ids=q.payloadSnapshot.options.map(o=>object(o)?o.id:null);
          if(a.text!==undefined||a.image_url!==undefined||(a.option_ids??[]).some(option=>!ids.includes(option))||
            (q.type==='single_choice'&&(a.option_ids?.length??0)>1))throw ApiException.validationFailed('คำตอบไม่ตรงกับคำถาม');
        }else if(a.option_ids!==undefined||(q.type==='image'&&a.text!==undefined))throw ApiException.validationFailed('รูปแบบคำตอบไม่ตรงกับคำถาม');
      }
      for(const [questionId,response]of Object.entries(body.answers))await tx.answer.upsert({where:{attemptId_questionId:{attemptId:id,questionId}},
        create:{attemptId:id,questionId,response:response as Prisma.InputJsonObject},update:{response:response as Prisma.InputJsonObject,revision:{increment:1}}});
      return this.views.readLocked(tx,id,scope.itemId);
    },{timeout:20000});
  }

  submit(reference:VerifiedSessionReference,id:string){
    return this.prisma.$transaction(async tx=>{
      const scope=await this.learning(tx,reference,{attemptId:id});
      const attempt=await tx.quizAttempt.findUniqueOrThrow({where:{id},select:{status:true,submittedAt:true}});
      if(attempt.status!=='in_progress'){
        if(!['pending_review','graded'].includes(attempt.status)||!attempt.submittedAt)throw Error('Invalid submitted state');
        return this.views.readLocked(tx,id,scope.itemId);
      }
      const questions=await tx.attemptQuestion.findMany({where:{attemptId:id},orderBy:{position:'asc'},include:{answer:true}});
      if(!questions.length)throw Error('Missing attempt snapshot');
      for(const q of questions)if(!object(q.payloadSnapshot)||!q.answer||!answerComplete(q.type,q.answer.response,q.payloadSnapshot.response_mode))
        throw ApiException.validationFailed('กรุณาตอบคำถามให้ครบก่อนส่ง');
      const now=new Date();
      for(const q of questions){
        if(!q.type.endsWith('choice'))continue;
        const payload=q.payloadSnapshot as Record<string,Prisma.JsonValue>,key=payload.correct_key,response=q.answer!.response;
        if(!object(key)||!Array.isArray(key.option_ids)||!key.option_ids.length||!object(response)||!Array.isArray(response.option_ids)||!Array.isArray(payload.options))throw Error('Invalid frozen choice proof');
        const valid=payload.options.map(o=>object(o)?o.id:null);
        if(response.option_ids.some(o=>!valid.includes(o))||key.option_ids.some(o=>!valid.includes(o)))throw Error('Invalid stored choice IDs');
        const correctIds=key.option_ids;
        const correct=response.option_ids.length===correctIds.length&&response.option_ids.every(o=>correctIds.includes(o));
        await tx.answer.update({where:{attemptId_questionId:{attemptId:id,questionId:q.questionId}},data:{score:correct?q.maxScore:0,gradedAt:now,gradedBy:null,comment:null,revision:{increment:1}}});
      }
      await tx.quizAttempt.update({where:{id},data:{submittedAt:now}});
      await this.summarize(tx,id,now);
      const updated=await tx.quizAttempt.findUniqueOrThrow({where:{id},select:{status:true}});
      if(updated.status==='graded')await this.completion.evaluate(tx,scope.enrollmentId,scope.courseId,now);
      return this.views.readLocked(tx,id,scope.itemId);
    },{timeout:20000});
  }

  private async summarize(tx:Prisma.TransactionClient,id:string,now:Date){
    const rows=await tx.attemptQuestion.findMany({where:{attemptId:id},select:{maxScore:true,answer:{select:{score:true}}}});
    const result=summarizeSubmittedScores(rows.map(q=>({maxScore:q.maxScore,score:q.answer?.score??null})));
    await tx.quizAttempt.update({where:{id},data:{status:result.status,earnedScore:result.score,passed:result.passed,
      gradedAt:result.status==='graded'?now:null,revision:{increment:1}}});
  }

  grade(reference:VerifiedSessionReference,id:string,questionId:string,body:ManualGrade){
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAuthoring(tx,reference);
      if(reference.audience!=='web'||actor.roles.includes('admin')||!actor.roles.includes('instructor'))throw ApiException.forbidden();
      const courses=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT c.id FROM courses c JOIN quiz_attempts a ON a."courseId"=c.id
        WHERE a.id=${id} AND c."instructorId"=${actor.accountId} FOR SHARE OF c`);
      if(!courses.length)throw ApiException.notFound();
      const grants=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT e.id FROM enrollments e JOIN quiz_attempts a ON a."enrollmentId"=e.id AND a."courseId"=e."courseId"
        WHERE a.id=${id} AND e."courseId"=${courses[0].id} FOR UPDATE OF e`);
      if(!grants.length)throw ApiException.notFound();
      const attempts=await tx.$queryRaw<Array<{status:string;submittedAt:Date|null;itemId:unknown}>>(Prisma.sql`
        SELECT status,"submittedAt","definitionSnapshot"->'item_id' AS "itemId" FROM quiz_attempts WHERE id=${id} FOR UPDATE`);
      const attempt=attempts[0];if(!attempt||typeof attempt.itemId!=='string')throw Error('Invalid grade target');
      if(!attempt.submittedAt||!['pending_review','graded'].includes(attempt.status))throw ApiException.conflict('attempt_not_submitted','ยังไม่ได้ส่งคำตอบ');
      const q=await tx.attemptQuestion.findUnique({where:{attemptId_questionId:{attemptId:id,questionId}},include:{answer:true}});
      if(!q)throw ApiException.notFound();
      if(!['essay','image'].includes(q.type)||new Exact(body.score).gt(q.maxScore))throw ApiException.validationFailed('คะแนนเกินเต็มหรือเป็นข้ออัตโนมัติ');
      if(!q.answer||!object(q.payloadSnapshot)||!answerComplete(q.type,q.answer.response,q.payloadSnapshot.response_mode))throw Error('Missing submitted manual answer');
      if(q.answer.score!==null){
        if(!q.answer.gradedBy||!q.answer.gradedAt)throw Error('Missing manual grade provenance');
        if(!q.answer.score.eq(body.score)||q.answer.comment!==body.comment)throw ApiException.conflict('grade_already_recorded','คะแนนถูกบันทึกแล้ว');
        return this.views.readLocked(tx,id,attempt.itemId);
      }
      if(attempt.status!=='pending_review')throw Error('Missing final grade proof');
      const now=new Date();
      await tx.answer.update({where:{id:q.answer.id},data:{score:body.score,comment:body.comment,gradedBy:actor.accountId,gradedAt:now,revision:{increment:1}}});
      await this.summarize(tx,id,now);
      const updated=await tx.quizAttempt.findUniqueOrThrow({where:{id},select:{status:true}});
      if(updated.status==='graded')await this.completion.evaluate(tx,grants[0].id,courses[0].id,now);
      return this.views.readLocked(tx,id,attempt.itemId);
    },{timeout:20000});
  }
}
