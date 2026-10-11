import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';

export interface DashboardDto {course_count:number;enrollment_count:number;learner_count:number;pending_grading_count:number;
  user_count?:number;pending_course_count?:number}
interface Counts {course:bigint;enrollment:bigint;learner:bigint;grading:bigint;users:bigint;pending:bigint}
@Injectable()
export class SummaryService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  read(reference:VerifiedSessionReference,admin:boolean):Promise<DashboardDto> {
    return this.prisma.$transaction(async tx=>{
      const actor=admin?await this.principals.requireAdmin(tx,reference):await this.principals.requireAuthoring(tx,reference);
      if(!admin&&(reference.audience!=='web'||!actor.roles.includes('instructor')||actor.roles.includes('admin')))throw ApiException.forbidden();
      // One SQL statement provides coherent counts without row-by-row joins or
      // duplicate learner/attempt inflation. Bounded projections never expose PII.
      const rows=await tx.$queryRaw<Counts[]>(Prisma.sql`
        WITH scoped AS (SELECT id,status FROM courses WHERE ${admin} OR "instructorId"=${actor.accountId}),
        grants AS (SELECT e.id,e."accountId" FROM enrollments e JOIN scoped c ON c.id=e."courseId"),
        waiting AS (SELECT a.id FROM quiz_attempts a JOIN scoped c ON c.id=a."courseId"
          WHERE a.status='pending_review' AND EXISTS (
            SELECT 1 FROM attempt_questions q LEFT JOIN answers ans
              ON ans."attemptId"=q."attemptId" AND ans."questionId"=q."questionId"
            WHERE q."attemptId"=a.id AND q.type IN ('essay','image') AND ans.score IS NULL))
        SELECT (SELECT count(*) FROM scoped) AS course,(SELECT count(*) FROM grants) AS enrollment,
          (SELECT count(DISTINCT "accountId") FROM grants) AS learner,(SELECT count(*) FROM waiting) AS grading,
          (SELECT count(*) FROM accounts) AS users,(SELECT count(*) FROM scoped WHERE status='pending_review') AS pending`);
      const r=rows[0],count=(v:bigint)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid aggregate');return n;};
      return {course_count:count(r.course),enrollment_count:count(r.enrollment),learner_count:count(r.learner),
        pending_grading_count:count(r.grading),...(admin?{user_count:count(r.users),pending_course_count:count(r.pending)}:{})};
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
}
