import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../../shared/errors/api-exception';
import { PrincipalService, VerifiedSessionReference, AccountRole } from './principal.service';
import { SelfProfileDto } from './self-profile.reader';
import { accountView, identityViewSelect } from '../account-view';

export interface AdminUserDetailDto extends Omit<SelfProfileDto, 'learning_eligible'> {
  status: 'pending' | 'active'; created_at: string;
}

/** Auth-owned bounded identity read; caller supplies a transaction, not actor claims. */
@Injectable()
export class AdminUserDetailReader {
  constructor(private readonly principals: PrincipalService) {}
  async read(tx: Prisma.TransactionClient, reference: VerifiedSessionReference, id: string): Promise<AdminUserDetailDto> {
    if (reference.audience !== 'admin') throw new ApiException('audience_not_allowed', 403, 'ต้องเข้าสู่ระบบฝั่ง Admin');
    const sessions = await tx.$queryRaw<Array<{ accountId: string }>>(Prisma.sql`
      SELECT "accountId" FROM app_sessions WHERE "tokenHash"=${reference.tokenHash} FOR SHARE`);
    if (!sessions.length) throw ApiException.unauthorized();
    // Match grant-writer ordering before requireAdmin acquires an Account lock.
    // An Admin reading another Admin must not deadlock with an opposite grant.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM accounts WHERE id IN (${sessions[0].accountId},${id}) ORDER BY id FOR SHARE`);
    await this.principals.requireAdmin(tx, reference);
    const grants = await tx.$queryRaw<Array<{ role: string }>>(Prisma.sql`
      SELECT role FROM user_roles WHERE "accountId"=${id} ORDER BY role FOR SHARE`);
    const target = await tx.account.findUnique({ where: { id }, select: { ...identityViewSelect, createdAt: true } });
    if (!target) throw ApiException.notFound('ไม่พบบัญชีผู้ใช้');
    const roles = grants.map(grant => grant.role);
    if (!roles.length || roles.some(role => !['learner', 'instructor', 'admin'].includes(role))) throw new Error('Invalid persisted roles');
    // AdminUserDetailDto's inline profile has no array cap; CurrentUser's
    // AccountProfile keeps its canonical 30-item cap through the default.
    const view = accountView(target, roles as AccountRole[], false, null);
    // Retain Draft pending/active projection, not a login/learning capability.
    // Disabled accounts still require independent Principal guards.
    return { id: view.id, display_name: view.display_name, username: view.username,
      email: view.email, email_verified: view.email_verified, avatar_url: view.avatar_url,
      roles: view.roles, origin: view.origin, profile: view.profile, auth_methods: view.auth_methods,
      status: view.origin === 'self_email' && !view.email_verified ? 'pending' : 'active',
      created_at: target.createdAt.toISOString() };
  }
}
