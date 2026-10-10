import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../shared/errors/api-exception';
import { EntitlementWriter, GrantedEntitlement } from '../enrollments/public/index';

export interface RedeemedEntitlement { already_enrolled: boolean; enrollment: GrantedEntitlement }
export interface RevokedCode { id: string; status: 'revoked'; revoked_at: string }

/** Internal transaction participant. Redeem caller establishes fresh eligibility,
 * course lifecycle/type/ownership and holds Course shared lock before Code lock.
 * No independent commit, expiry, code normalization, provider call or public API.
 */
@Injectable()
export class RedeemWriter {
  constructor(private readonly entitlements: EntitlementWriter) {}

  async redeem(tx: Prisma.TransactionClient, codeId: string, accountId: string, courseId: string): Promise<RedeemedEntitlement> {
    const codes = await tx.$queryRaw<Array<{ id: string; courseId: string; status: string }>>(Prisma.sql`
      SELECT id,"courseId",status FROM redeem_codes WHERE id=${codeId} FOR UPDATE`);
    const code = codes[0];
    if (!code || code.courseId !== courseId || code.status !== 'unused') {
      throw new ApiException('redeem_code_unavailable', 404, 'ไม่พบรหัสแลกสิทธิ์ที่ใช้งานได้');
    }
    const grant = await this.entitlements.grantEntitlement(tx, accountId, courseId, 'redeem');
    // A concurrent free/Stripe/other-code winner returns its original lifetime
    // grant. This still-Unused code must not be consumed or replace provenance.
    if (grant.created) {
      const consumed = await tx.$executeRaw(Prisma.sql`
        UPDATE redeem_codes SET status='used',"usedBy"=${accountId},"usedAt"=clock_timestamp(),"enrollmentId"=${grant.enrollment.id}
        WHERE id=${code.id} AND status='unused'`);
      if (consumed !== 1) throw new Error('Redeem transition failed');
    }
    return { already_enrolled: !grant.created, enrollment: grant.enrollment };
  }

  /** Caller has fresh Admin authority held in this transaction. No Course lock
   * is required: revoke never acquires Course/Enrollment after locking the code.
   */
  async revoke(tx: Prisma.TransactionClient, codeId: string, adminId: string): Promise<RevokedCode> {
    const codes = await tx.$queryRaw<Array<{ id: string; status: string; revokedAt: Date | null }>>(Prisma.sql`
      SELECT id,status,"revokedAt" FROM redeem_codes WHERE id=${codeId} FOR UPDATE`);
    const code = codes[0];
    if (!code) throw ApiException.notFound('ไม่พบรหัส');
    if (code.status === 'used') throw new ApiException('invalid_state', 409, 'รหัสถูกใช้แล้ว', { reason: 'used' });
    // Reading back the existing terminal result is not a second transition.
    // Preserve the Draft replay response without changing original actor/time.
    if (code.status === 'revoked' && code.revokedAt) {
      return { id: code.id, status: 'revoked', revoked_at: code.revokedAt.toISOString() };
    }
    if (code.status !== 'unused') throw new Error('Invalid stored code state');
    const rows = await tx.$queryRaw<Array<{ id: string; revokedAt: Date }>>(Prisma.sql`
      UPDATE redeem_codes SET status='revoked',"revokedBy"=${adminId},"revokedAt"=clock_timestamp()
      WHERE id=${code.id} AND status='unused' RETURNING id,"revokedAt"`);
    if (rows.length !== 1) throw new Error('Revoke transition failed');
    return { id: rows[0].id, status: 'revoked', revoked_at: rows[0].revokedAt.toISOString() };
  }
}
