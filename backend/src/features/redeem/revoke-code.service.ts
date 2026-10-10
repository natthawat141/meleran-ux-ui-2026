import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { RedeemWriter } from './redeem-writer.service';

@Injectable()
export class RevokeCodeService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService,
    private readonly codes: RedeemWriter) {}

  async revoke(reference: VerifiedSessionReference, codeId: string) {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireAdmin(tx, reference);
      return this.codes.revoke(tx, codeId, actor.accountId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
