import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApiException } from '../../../shared/errors/api-exception';

export type AppAudience = 'web' | 'admin';
export type AccountRole = 'learner' | 'instructor' | 'admin';
export interface VerifiedSessionReference { tokenHash: string; audience: AppAudience }
export interface AuthPrincipal {
  accountId: string;
  roles: AccountRole[];
  learningEligible: boolean;
  session: VerifiedSessionReference;
}

/** Resolution only: no cookie/TTL/password/provider policy, issuance or writes. */
@Injectable()
export class PrincipalService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(secret: unknown, audience: AppAudience): Promise<AuthPrincipal | null> {
    if (!['web', 'admin'].includes(audience) || typeof secret !== 'string' || !secret || secret.length > 4096) return null;
    const tokenHash = createHash('sha256').update(secret).digest('hex').toUpperCase();
    return this.resolveHash(this.prisma, { tokenHash, audience });
  }

  private async resolveHash(client: PrismaService | Prisma.TransactionClient, reference: VerifiedSessionReference): Promise<AuthPrincipal | null> {
    const session = await client.appSession.findUnique({ where: { tokenHash: reference.tokenHash }, select: {
      audience: true, expiresAt: true, revokedAt: true,
      account: { select: { id: true, disabled: true, origin: true, emailVerified: true,
        roleGrants: { select: { role: true }, orderBy: { role: 'asc' } } } },
    } });
    if (!session || session.audience !== reference.audience || session.revokedAt ||
        session.expiresAt <= new Date() || session.account.disabled) return null;
    const { account } = session;
    if (!['admin_created', 'self_email', 'google'].includes(account.origin)) return null;
    const roles = account.roleGrants.map(grant => grant.role);
    if (roles.some(role => !['learner', 'instructor', 'admin'].includes(role))) return null;
    // Google enrollment readiness requires the provider-owned verified flag;
    // account origin alone is not a substitute for verified Google proof.
    const learningEligible = !roles.includes('admin') && roles.some(role => ['learner', 'instructor'].includes(role)) &&
      (account.origin === 'admin_created' || account.emailVerified);
    return { accountId: account.id, roles: roles as AccountRole[], learningEligible, session: { ...reference } };
  }

  /** Re-check/hold authority throughout the caller's resource transaction. */
  async requireLearning(tx: Prisma.TransactionClient, reference: VerifiedSessionReference): Promise<AuthPrincipal> {
    if (reference.audience !== 'web') throw new ApiException('audience_not_allowed', 403, 'ต้องเข้าสู่ระบบฝั่ง Web');
    // UPDATE on Account also blocks an FK-backed new Admin role grant while a
    // learning mutation is in flight; locking existing role rows alone misses it.
    const accounts = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT a.id FROM app_sessions s JOIN accounts a ON a.id=s."accountId"
      WHERE s."tokenHash"=${reference.tokenHash} FOR SHARE OF s FOR UPDATE OF a`);
    if (!accounts.length) throw ApiException.unauthorized();
    await tx.$queryRaw(Prisma.sql`SELECT role FROM user_roles WHERE "accountId"=${accounts[0].id} ORDER BY role FOR SHARE`);
    const principal = await this.resolveHash(tx, reference);
    if (!principal) throw ApiException.unauthorized();
    if (principal.roles.includes('admin') || !principal.roles.some(role => role === 'learner' || role === 'instructor')) {
      throw ApiException.forbidden('บัญชีนี้ลงเรียนไม่ได้');
    }
    if (!principal.learningEligible) throw new ApiException('email_not_verified', 403, 'กรุณายืนยันอีเมลก่อนลงเรียน');
    return principal;
  }

  async requireAdmin(tx: Prisma.TransactionClient, reference: VerifiedSessionReference): Promise<AuthPrincipal> {
    if (reference.audience !== 'admin') throw new ApiException('audience_not_allowed', 403, 'ต้องเข้าสู่ระบบฝั่ง Admin');
    // Auth locks precede resource locks: session/account, normalized role rows.
    const accounts = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT a.id FROM app_sessions s JOIN accounts a ON a.id=s."accountId"
      WHERE s."tokenHash"=${reference.tokenHash} FOR SHARE OF s,a`);
    if (!accounts.length) throw ApiException.unauthorized();
    await tx.$queryRaw(Prisma.sql`SELECT role FROM user_roles WHERE "accountId"=${accounts[0].id} ORDER BY role FOR SHARE`);
    const principal = await this.resolveHash(tx, reference);
    if (!principal) throw ApiException.unauthorized();
    if (!principal.roles.includes('admin')) throw ApiException.forbidden();
    return principal;
  }
}
