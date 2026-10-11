import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../../shared/errors/api-exception';
import { AnswerView,AttemptQuestionView,StoredQuestionRead,projectAttempt } from '../dto/attempt-view';
interface ManagedQuestion extends Omit<AttemptQuestionView,'options'>{options?:Array<{id:string;text:string}>;rubric?:string|null;response_mode?:'text'|'image'|'either'}
export interface ManagedAttemptDto{
  id:string;course_id:string;item_id:string;user_id:string;learner_display_name:string;
  status:'in_progress'|'pending_review'|'graded'|'submitted';started_at:string;submitted_at:string|null;graded_at:string|null;
  earned:number|null;max:number;passed:boolean|null;choice_earned:number;choice_max:number;
  questions:ManagedQuestion[];answers:Record<string,AnswerView>;grades:Record<string,{score:number;comment:string|null}>;
}
interface ManagedSnapshot extends StoredQuestionRead{hasRubric:boolean;rubric:unknown;hasResponseMode:boolean;responseMode:unknown}
const Decimal=Prisma.Decimal.clone({precision:100});
const number=(d:Prisma.Decimal)=>{const n=d.toNumber();if(!d.isFinite()||!Number.isFinite(n))throw Error('Invalid stored score');return n;};

/** Trusted transaction participant. Caller proves fresh owner/Admin authority and
 * scopes the Attempt ID before invoking. Rechecks Course/Enrollment/Attempt links;
 * locks Course -> Enrollment -> Attempt, never selects current or snapshot keys. */
@Injectable()
export class ManagedAttemptReader{
  async read(tx:Prisma.TransactionClient,scope:{id:string;courseId:string}):Promise<ManagedAttemptDto>{
    const courses=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM courses WHERE id=${scope.courseId} FOR SHARE`);
    if(!courses.length)throw ApiException.notFound();
    const grants=await tx.$queryRaw<Array<{id:string;userId:string;displayName:string}>>(Prisma.sql`
      SELECT e.id,e."accountId" AS "userId",u."displayName" AS "displayName" FROM enrollments e
      JOIN quiz_attempts a ON a."enrollmentId"=e.id AND a."courseId"=e."courseId" JOIN accounts u ON u.id=e."accountId"
      WHERE a.id=${scope.id} AND e."courseId"=${scope.courseId} FOR SHARE OF e`);
    if(!grants.length)throw ApiException.notFound();
    const locks=await tx.$queryRaw<Array<{itemId:unknown}>>(Prisma.sql`
      SELECT "definitionSnapshot"->'item_id' AS "itemId" FROM quiz_attempts WHERE id=${scope.id} AND "enrollmentId"=${grants[0].id} FOR SHARE`);
    if(!locks.length)throw ApiException.notFound();
    const row=await tx.quizAttempt.findUniqueOrThrow({where:{id:scope.id},select:{id:true,courseId:true,number:true,status:true,
      startedAt:true,submittedAt:true,gradedAt:true,maxScore:true,earnedScore:true,passed:true}});
    if(!['in_progress','pending_review','graded','submitted'].includes(row.status))throw Error('Invalid stored attempt state');
    const snapshots=await tx.$queryRaw<ManagedSnapshot[]>(Prisma.sql`
      SELECT q."questionId",q.type,q."maxScore",q."payloadSnapshot"->'prompt' AS prompt,q."payloadSnapshot"->'options' AS options,
        q."payloadSnapshot"?'prompt_doc' AS "hasPromptDoc",q."payloadSnapshot"->'prompt_doc' AS "promptDoc",
        q."payloadSnapshot"?'rubric' AS "hasRubric",q."payloadSnapshot"->'rubric' AS rubric,
        q."payloadSnapshot"?'response_mode' AS "hasResponseMode",q."payloadSnapshot"->'response_mode' AS "responseMode",
        a.id AS "answerId",a.response,a.score,a.comment FROM attempt_questions q
      LEFT JOIN answers a ON a."attemptId"=q."attemptId" AND a."questionId"=q."questionId"
      WHERE q."attemptId"=${scope.id} ORDER BY q.position,q."questionId"`);
    const view=projectAttempt({...row,itemId:locks[0].itemId,status:row.status==='submitted'?'pending_review':row.status},snapshots);
    const questions:ManagedQuestion[]=view.questions.map((q,i)=>{
      const source=snapshots[i],result:ManagedQuestion={...q};
      if(source.hasRubric){if(source.rubric!==null&&typeof source.rubric!=='string')throw Error('Invalid stored rubric');result.rubric=source.rubric as string|null;}
      if(source.hasResponseMode){if(!['text','image','either'].includes(source.responseMode as string))throw Error('Invalid stored response mode');result.response_mode=source.responseMode as 'text'|'image'|'either';}
      return result;
    });
    const choice=snapshots.filter(q=>q.type==='single_choice'||q.type==='multiple_choice');
    return {id:row.id,course_id:row.courseId,item_id:view.item_id,user_id:grants[0].userId,learner_display_name:grants[0].displayName,
      status:row.status as ManagedAttemptDto['status'],started_at:view.started_at,submitted_at:view.submitted_at,graded_at:view.graded_at,
      earned:row.earnedScore===null?null:number(row.earnedScore),max:view.max,passed:row.passed,
      choice_max:number(choice.reduce((sum,q)=>sum.plus(q.maxScore),new Decimal(0))),choice_earned:number(choice.reduce((sum,q)=>sum.plus(q.score??0),new Decimal(0))),
      questions,answers:view.answers,grades:Object.fromEntries(snapshots.filter(q=>q.score!==null).map(q=>[q.questionId,{score:number(q.score!),comment:q.comment}]))};
  }
}
