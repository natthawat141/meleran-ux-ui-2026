import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';
import { PrincipalService, VerifiedSessionReference } from './public/principal.service';

/** Ends exactly the verified current session; no issuance/TTL/reset policy. */
@Injectable()
export class LogoutService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}

  async logout(reference: VerifiedSessionReference): Promise<void> {
    await this.prisma.$transaction(async tx => {
      // Acquire exclusive Session first: two shared readers must not both try
      // upgrading to UPDATE. Other commands use Session -> Account -> roles too.
      const sessions = await tx.$queryRaw<Array<{ tokenHash: string }>>(Prisma.sql`
        SELECT "tokenHash" FROM app_sessions WHERE "tokenHash"=${reference.tokenHash}
        AND audience=${reference.audience} FOR UPDATE`);
      if (!sessions.length) throw ApiException.unauthorized();
      await this.principals.requireSelfRead(tx, reference);
      const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
      await tx.appSession.update({ where: { tokenHash: reference.tokenHash }, data: { revokedAt: now } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
