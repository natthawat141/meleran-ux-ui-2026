import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';
import { LocalPasswordService, normalizedLocalUsername } from './local-password.service';
import { SessionWriter, SessionIssue } from './session-writer.service';
import { AppAudience } from './public/principal.service';

@Injectable()
export class LocalAuthenticationService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: LocalPasswordService,
    private readonly sessions: SessionWriter) {}

  /** Username branch only. HTTP Login must also implement the Firebase Email
   * branch before claiming AUTH-01; this internal method does not replace it. */
  async loginUsername(identifier: string, password: string, audience: AppAudience): Promise<SessionIssue> {
    if (!['web', 'admin'].includes(audience)) throw ApiException.validationFailed('พื้นที่เข้าสู่ระบบไม่ถูกต้อง');
    const normalized = normalizedLocalUsername(identifier);
    const account = normalized ? await this.prisma.account.findUnique({ where: { normalizedUsername: normalized },
      select: { id: true, localCredential: { select: { passwordHash: true } } } }) : null;
    const passwordHash = account?.localCredential?.passwordHash;
    const valid = await this.passwords.verify(passwordHash, password);
    if (!account || !passwordHash || !valid) throw ApiException.unauthorized('ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
    return this.prisma.$transaction(tx => this.sessions.issueVerifiedLocal(tx, { accountId: account.id, passwordHash }, audience),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
