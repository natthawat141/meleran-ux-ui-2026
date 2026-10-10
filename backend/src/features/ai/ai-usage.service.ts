import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { AI_DAILY_PROMPT_LIMIT } from './ai.config';
import { AiUsageDto } from './dto/ai-usage.dto';
import { quotaWindow } from './quota-window';

@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}

  async read(reference: VerifiedSessionReference): Promise<AiUsageDto> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireSelfRead(tx, reference);
      const instant = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
      const window = await quotaWindow(tx, instant);
      const stored = await tx.aIUsageDaily.findUnique({ where: {
        accountId_usageDate: { accountId: actor.accountId, usageDate: window.usageDate },
      }, select: { successCount: true } });
      const used = stored?.successCount ?? 0;
      if (!Number.isSafeInteger(used) || used < 0 || used > AI_DAILY_PROMPT_LIMIT) throw new Error('Invalid persisted AI usage');
      // Pending reservations are not successful prompts; this read grants no slot.
      // Missing today never inserts/resets historical rows or calls the provider.
      return { limit: AI_DAILY_PROMPT_LIMIT, used, remaining: AI_DAILY_PROMPT_LIMIT - used,
        reset_at: window.resetAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
