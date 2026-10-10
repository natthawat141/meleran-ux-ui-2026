import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../../shared/errors/api-exception';
import { PrincipalService, VerifiedSessionReference, AccountRole } from './principal.service';
import { SelfProfileDto } from './self-profile.reader';
import { accountView, identityViewSelect } from '../account-view';

export interface InstructorGrantDto { user: SelfProfileDto; added_by: string | null; added_at: string | null }

/** Auth owns all identity writes. Caller supplies the transaction, never actor claims. */
@Injectable()
export class InstructorGrantWriter {
  constructor(private readonly principals: PrincipalService) {}
  async grant(tx: Prisma.TransactionClient, reference: VerifiedSessionReference, id: string): Promise<InstructorGrantDto> {
    if (reference.audience !== 'admin') throw new ApiException('audience_not_allowed', 403, 'ต้องเข้าสู่ระบบฝั่ง Admin');
    const sessions = await tx.$queryRaw<Array<{ accountId: string }>>(Prisma.sql`
      SELECT "accountId" FROM app_sessions WHERE "tokenHash"=${reference.tokenHash} FOR SHARE`);
    if (!sessions.length) throw ApiException.unauthorized();
    // Sorted Account UPDATE locks precede any Account SHARE/role locks. Avoid
    // opposite Admin-target requests deadlocking during SHARE -> UPDATE upgrade.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM accounts WHERE id IN (${sessions[0].accountId},${id}) ORDER BY id FOR UPDATE`);
    const actor = await this.principals.requireAdmin(tx, reference);
    const target = await tx.account.findUnique({ where: { id }, select: {
      ...identityViewSelect, disabled: true, instructorAddedBy: true, instructorAddedAt: true,
    } });
    if (!target) throw ApiException.notFound('ไม่พบบัญชีผู้ใช้');
    const grants = await tx.$queryRaw<Array<{ role: string }>>(Prisma.sql`
      SELECT role FROM user_roles WHERE "accountId"=${id} ORDER BY role FOR SHARE`);
    const roles = grants.map(row => row.role);
    if (roles.some(role => !['learner', 'instructor', 'admin'].includes(role)) || roles.length === 0) throw new Error('Invalid persisted roles');
    if (roles.includes('admin')) throw new ApiException('invalid_state', 409, 'บัญชี Admin เป็น Instructor ไม่ได้');
    let addedBy = target.instructorAddedBy, addedAt = target.instructorAddedAt;
    if ((addedBy === null) !== (addedAt === null) || (!roles.includes('instructor') && (addedBy !== null || addedAt !== null))) {
      throw new Error('Inconsistent persisted Instructor audit');
    }
    if (!roles.includes('instructor')) {
      // Use one PostgreSQL instant for normalized grant and original audit.
      const instant = (await tx.$queryRaw<Array<{ instant: Date }>>`SELECT clock_timestamp() AS instant`)[0].instant;
      await tx.userRole.create({ data: { accountId: id, role: 'instructor', grantedAt: instant } });
      roles.push('instructor'); roles.sort();
      await tx.account.update({ where: { id }, data: { roles: roles.join(','), instructorAddedBy: actor.accountId,
        instructorAddedAt: instant, revision: { increment: 1 } } });
      addedBy = actor.accountId; addedAt = instant;
    }
    return { user: accountView(target, roles as AccountRole[], !target.disabled && (target.origin === 'admin_created' || target.emailVerified)),
      added_by: addedBy, added_at: addedAt?.toISOString() ?? null };
  }
}
