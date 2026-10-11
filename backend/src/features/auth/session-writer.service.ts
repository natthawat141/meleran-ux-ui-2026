import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { ApiException } from '../../shared/errors/api-exception';
import { accountView, identityViewSelect } from './account-view';
import { AccountRole, AppAudience } from './public/principal.service';
import { SelfProfileDto } from './public/self-profile.reader';
import { LocalPasswordService } from './local-password.service';

export const APP_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export interface LocalCredentialProof { accountId: string; passwordHash: string }
export interface SessionIssue { secret: string; expiresAt: Date; user: SelfProfileDto }

/** Auth-only participants. Callers prove credentials/reset authority, own the
 * transaction, and invoke these before acquiring any Account/session row lock.
 * Not exported through the cross-feature public barrel or exposed over HTTP. */
@Injectable()
export class SessionWriter {
  constructor(private readonly passwords: LocalPasswordService) {}

  private async serializeAccount(tx: Prisma.TransactionClient, accountId: string): Promise<void> {
    // Serializes issuance against all-session reset/revocation, including rows
    // created after the revoker's initial session scan. Collision only serializes.
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`melearn:auth-session-write:${accountId}`},0))::text`);
  }

  async issueVerifiedLocal(tx: Prisma.TransactionClient, proof: LocalCredentialProof, audience: AppAudience): Promise<SessionIssue> {
    if (!['web', 'admin'].includes(audience)) throw ApiException.validationFailed('พื้นที่เข้าสู่ระบบไม่ถูกต้อง');
    await this.serializeAccount(tx, proof.accountId);
    const accounts = await tx.$queryRaw<Array<{ id: string; disabled: boolean }>>(Prisma.sql`
      SELECT id,disabled FROM accounts WHERE id=${proof.accountId} FOR SHARE`);
    const credentials = await tx.$queryRaw<Array<{ passwordHash: string }>>(Prisma.sql`
      SELECT "passwordHash" FROM local_credentials WHERE "accountId"=${proof.accountId} FOR SHARE`);
    if (!accounts.length || !credentials.length || credentials[0].passwordHash !== proof.passwordHash ||
        !this.passwords.isEncoded(proof.passwordHash)) throw ApiException.unauthorized('ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
    if (accounts[0].disabled) throw new ApiException('account_disabled', 403, 'บัญชีนี้ถูกระงับ');
    const grants = await tx.$queryRaw<Array<{ role: string }>>(Prisma.sql`
      SELECT role FROM user_roles WHERE "accountId"=${proof.accountId} ORDER BY role FOR SHARE`);
    if (!grants.length || grants.some(g => !['learner', 'instructor', 'admin'].includes(g.role))) throw new Error('Invalid normalized role grants');
    const roles = grants.map(g => g.role) as AccountRole[];
    if (audience === 'admin' && !roles.includes('admin')) throw new ApiException('audience_not_allowed', 403, 'บัญชีนี้เข้าส่วนผู้ดูแลไม่ได้');
    const account = await tx.account.findUniqueOrThrow({ where: { id: proof.accountId }, select: identityViewSelect });
    const eligible = !roles.includes('admin') && roles.some(r => r === 'learner' || r === 'instructor') &&
      (account.origin === 'admin_created' || account.emailVerified);
    const user = accountView(account, roles, eligible);
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    const secret = randomBytes(32).toString('hex'), expiresAt = new Date(now.getTime() + APP_SESSION_TTL_MS);
    await tx.appSession.create({ data: { accountId: proof.accountId, audience, expiresAt,
      tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase() } });
    return { secret, expiresAt, user };
  }

  private async lockForRevocation(tx: Prisma.TransactionClient, accountId: string): Promise<void> {
    await this.serializeAccount(tx, accountId);
    // Matches existing readers' Session -> Account lock order. Advisory lock
    // excludes new kernel issuance; do not acquire Account first in the caller.
    await tx.$queryRaw(Prisma.sql`SELECT "tokenHash" FROM app_sessions WHERE "accountId"=${accountId} ORDER BY "tokenHash" FOR UPDATE`);
    const accounts = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM accounts WHERE id=${accountId} FOR UPDATE`);
    if (!accounts.length) throw ApiException.notFound();
  }

  private async revokeLocked(tx: Prisma.TransactionClient, accountId: string): Promise<void> {
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    await tx.appSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: now } });
  }

  async revokeAll(tx: Prisma.TransactionClient, accountId: string): Promise<void> {
    await this.lockForRevocation(tx, accountId);
    await this.revokeLocked(tx, accountId);
  }

  /** Trusted local reset participant, not proof verification or Firebase reset. */
  async replaceLocalPassword(tx: Prisma.TransactionClient, proof: LocalCredentialProof, replacementHash: string): Promise<void> {
    if (!this.passwords.isEncoded(replacementHash)) throw new Error('Invalid prepared local credential');
    await this.lockForRevocation(tx, proof.accountId);
    const credentials = await tx.$queryRaw<Array<{ passwordHash: string }>>(Prisma.sql`
      SELECT "passwordHash" FROM local_credentials WHERE "accountId"=${proof.accountId} FOR UPDATE`);
    if (!credentials.length || credentials[0].passwordHash !== proof.passwordHash) throw ApiException.unauthorized();
    await tx.localCredential.update({ where: { accountId: proof.accountId }, data: { passwordHash: replacementHash } });
    await this.revokeLocked(tx, proof.accountId);
  }
}
