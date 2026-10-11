import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { AttemptView, StoredQuestionRead, projectAttempt } from './dto/attempt-view';

@Injectable()
export class AttemptReadService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}
  read(reference: VerifiedSessionReference, attemptId: string): Promise<AttemptView> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireSelfRead(tx, reference);
      if (reference.audience !== 'web') throw ApiException.forbidden();
      // Historical self result, not Course content/preview. Auth -> Enrollment
      // -> Attempt matches academic writers, without consulting current Quiz.
      const grants = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT e.id FROM enrollments e JOIN quiz_attempts a ON a."enrollmentId"=e.id
        AND a."courseId"=e."courseId" WHERE a.id=${attemptId} AND e."accountId"=${actor.accountId} FOR SHARE OF e`);
      if (!grants.length) throw ApiException.notFound('ไม่พบการทำแบบฝึกหัด');
      const locked = await tx.$queryRaw<Array<{ id: string; itemId: unknown }>>(Prisma.sql`
        SELECT id,"definitionSnapshot"->'item_id' AS "itemId" FROM quiz_attempts
        WHERE id=${attemptId} AND "enrollmentId"=${grants[0].id} FOR SHARE`);
      if (!locked.length) throw ApiException.notFound('ไม่พบการทำแบบฝึกหัด');
      return this.readLocked(tx,locked[0].id,locked[0].itemId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  /** Assessment-local participant: caller holds scoped Enrollment/Attempt locks and fresh authority. */
  async readLocked(tx:Prisma.TransactionClient,attemptId:string,itemId:unknown):Promise<AttemptView>{
      const row = await tx.quizAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: {
        id: true, courseId: true, number: true, status: true, startedAt: true, submittedAt: true, gradedAt: true,
        maxScore: true, earnedScore: true, passed: true,
      } });
      // JSON public projection in SQL avoids reading correct_key/whole definition
      // into a serializer. Parent Attempt lock is mandatory for future writers.
      const questions = await tx.$queryRaw<StoredQuestionRead[]>(Prisma.sql`
        SELECT q."questionId",q.type,q."maxScore",q."payloadSnapshot"->'prompt' AS prompt,
          q."payloadSnapshot"->'options' AS options,(q."payloadSnapshot" ? 'prompt_doc') AS "hasPromptDoc",
          q."payloadSnapshot"->'prompt_doc' AS "promptDoc",q."payloadSnapshot"->'response_mode' AS "responseMode",a.id AS "answerId",a.response,a.score,a.comment
        FROM attempt_questions q LEFT JOIN answers a ON a."attemptId"=q."attemptId" AND a."questionId"=q."questionId"
        WHERE q."attemptId"=${row.id} ORDER BY q.position ASC,q."questionId" ASC`);
      return projectAttempt({ ...row, itemId }, questions);
  }
}
