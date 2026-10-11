import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { summarizeSubmittedScores } from '../submitted-score';
import { answerComplete } from '../answer-completeness';

export interface BestQuizResult {
  attempt_id: string; earned: string; max: string; percent: number; passed: boolean;
  graded_at: string;
}
interface Candidate { id:string; maxScore:Prisma.Decimal; earnedScore:Prisma.Decimal; passed:boolean; gradedAt:Date; submittedAt:Date|null }
interface Grade { type:string; maxScore:Prisma.Decimal; score:Prisma.Decimal|null; response:Prisma.JsonValue|null;gradedBy:string|null;gradedAt:Date|null;responseMode?:unknown }
const Exact = Prisma.Decimal.clone({precision:200});
function answered(row:Grade):boolean {
  return answerComplete(row.type,row.response,row.responseMode);
}

/** Assessment-owned trusted proof. Caller holds Course SHARE then Enrollment UPDATE;
 * future grading must use this same lock order. No current answer keys leave this owner. */
@Injectable()
export class BestResultReader {
  async read(tx:Prisma.TransactionClient,enrollmentId:string,courseId:string,itemId:string):Promise<BestQuizResult|null> {
    const candidates=await tx.$queryRaw<Candidate[]>(Prisma.sql`
      SELECT a.id,a."maxScore",a."earnedScore",a.passed,a."gradedAt",a."submittedAt"
      FROM quiz_attempts a JOIN quizzes q ON q.id=a."quizId" AND q."courseId"=a."courseId"
      WHERE a."enrollmentId"=${enrollmentId} AND a."courseId"=${courseId} AND q."itemId"=${itemId}
        AND a.status='graded' ORDER BY a.number,a.id FOR SHARE OF a`);
    let best:Candidate|null=null;
    for(const candidate of candidates){
      const grades=await tx.$queryRaw<Grade[]>(Prisma.sql`
        SELECT q.type,q."maxScore",q."payloadSnapshot"->'response_mode' AS "responseMode",a.score,a.response,a."gradedBy",a."gradedAt" FROM attempt_questions q
        LEFT JOIN answers a ON a."attemptId"=q."attemptId" AND a."questionId"=q."questionId"
        WHERE q."attemptId"=${candidate.id} ORDER BY q.position,q."questionId"`);
      if(!candidate.submittedAt||!candidate.gradedAt||grades.some(g=>!answered(g)||
        (['essay','image'].includes(g.type)&&(!g.gradedBy||!g.gradedAt))))throw Error('Incomplete graded attempt');
      const computed=summarizeSubmittedScores(grades);
      if(computed.status!=='graded'||!computed.maxScore.eq(candidate.maxScore)||!computed.score.eq(candidate.earnedScore)||computed.passed!==candidate.passed)
        throw Error('Inconsistent stored attempt result');
      if(!computed.maxScore.gt(0))continue;
      // Compare exact rational scores across different definition maxima. Stable first tie wins.
      if(!best||new Exact(candidate.earnedScore).times(best.maxScore).gt(new Exact(best.earnedScore).times(candidate.maxScore)))best=candidate;
    }
    return best?{attempt_id:best.id,earned:best.earnedScore.toString(),max:best.maxScore.toString(),
      percent:new Exact(best.earnedScore).dividedBy(best.maxScore).times(100).toNumber(),passed:best.passed,graded_at:best.gradedAt.toISOString()}:null;
  }
}
