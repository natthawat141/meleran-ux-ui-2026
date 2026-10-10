import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { AiConversationDto, RenameConversationInput } from './dto/rename-conversation.dto';

@Injectable()
export class RenameConversationService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}
  async rename(reference: VerifiedSessionReference, id: string, input: RenameConversationInput): Promise<AiConversationDto> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireSelfRead(tx, reference);
      const conversations = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM ai_conversations WHERE id=${id} AND "accountId"=${actor.accountId}
        AND "deletedAt" IS NULL FOR UPDATE`);
      if (!conversations.length) throw ApiException.notFound();
      const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
      const saved = await tx.aIConversation.update({ where: { id }, data: { title: input.title, updatedAt: now },
        select: { id: true, title: true, courseId: true, createdAt: true, updatedAt: true } });
      if (saved.title === null) throw new Error('Invalid persisted conversation title');
      return { id: saved.id, title: saved.title, course_id: saved.courseId,
        created_at: saved.createdAt.toISOString(), updated_at: saved.updatedAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
