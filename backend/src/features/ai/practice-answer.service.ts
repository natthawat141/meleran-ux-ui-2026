import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { PracticeAnswerDto, PracticeAnswerInput } from './dto/practice-answer.dto';
import { practiceAnswers, practiceSnapshot } from './practice-snapshot';

@Injectable()
export class PracticeAnswerService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}

  async answer(reference: VerifiedSessionReference, conversationId: string, messageId: string,
    input: PracticeAnswerInput): Promise<PracticeAnswerDto> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireSelfRead(tx, reference);
      const conversations = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM ai_conversations WHERE id=${conversationId} AND "accountId"=${actor.accountId}
        AND "deletedAt" IS NULL FOR UPDATE`);
      if (!conversations.length) throw ApiException.notFound();
      const messages = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM ai_messages WHERE id=${messageId} AND "conversationId"=${conversationId}
        AND "accountId"=${actor.accountId} AND role='assistant' FOR SHARE`);
      if (!messages.length) throw ApiException.notFound();
      const practices = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM ai_practice WHERE "messageId"=${messageId} AND "conversationId"=${conversationId}
        AND "accountId"=${actor.accountId} FOR UPDATE`);
      // An unlinked legacy practice is not a guessed match for messageId.
      if (!practices.length) throw ApiException.notFound();
      const stored = await tx.aIPractice.findUniqueOrThrow({ where: { id: practices[0].id }, select: { payloadSnapshot: true, answers: true } });
      const questions = practiceSnapshot(stored.payloadSnapshot), answers = practiceAnswers(questions, stored.answers);
      const question = questions.find(candidate => candidate.id === input.question_id);
      if (!question) throw ApiException.validationFailed('ไม่พบข้อฝึกหัดที่ขอ', { fields: [{ field: 'question_id', code: 'invalid' }] });
      if (!question.options.some(option => option.id === input.option_id)) {
        throw ApiException.validationFailed('ตัวเลือกไม่อยู่ในข้อฝึกหัดนี้', { fields: [{ field: 'option_id', code: 'invalid' }] });
      }
      const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
      answers.set(question.id, { option_id: input.option_id, answered_at: now.toISOString() });
      await tx.aIPractice.update({ where: { id: practices[0].id }, data: { answers: Object.fromEntries(answers) } });
      // Answering is activity; retain manually set title and all context/proofs.
      await tx.aIConversation.update({ where: { id: conversationId }, data: { updatedAt: now } });
      return { question_id: question.id, correct: question.correct_option_id === input.option_id,
        explanation: question.explanation, summary: answers.size === questions.length ? {
          answered: answers.size, total: questions.length,
          correct_count: questions.filter(candidate => answers.get(candidate.id)?.option_id === candidate.correct_option_id).length,
        } : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
