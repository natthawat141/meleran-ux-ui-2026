import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export type EntitlementSource = 'free' | 'redeem' | 'stripe';
export interface GrantedEntitlement {
  id: string;
  course_id: string;
  source: EntitlementSource;
  access: 'lifetime';
  granted_at: string;
}

/** Internal persistence participant, never a controller-facing permission API.
 * The caller supplies its existing transaction AFTER server eligibility, course
 * lifecycle/type/owner checks and source proof verification. It must acquire
 * Course and Payment/Code locks in the documented order before calling here.
 * No provider calls, independent commits, retries, expiry or grant-source edits.
 * ReadCommitted supports concurrent create-or-return; serialization failures at
 * stricter isolation propagate to the owning command's transaction retry policy.
 */
@Injectable()
export class EntitlementWriter {
  async grantEntitlement(
    tx: Prisma.TransactionClient, accountId: string, courseId: string, source: EntitlementSource,
  ): Promise<{ created: boolean; enrollment: GrantedEntitlement }> {
    if (!['free','redeem','stripe'].includes(source)) throw new Error('Invalid entitlement source');
    // ON CONFLICT avoids a uniqueness exception aborting the caller's transaction.
    // The next statement observes a concurrent committed winner at ReadCommitted.
    const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "enrollments" ("id", "accountId", "courseId", "source", "grantedAt", "completedItems")
      VALUES (${randomUUID()}, ${accountId}, ${courseId}, ${source}, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), 0)
      ON CONFLICT ("accountId", "courseId") DO NOTHING RETURNING "id"
    `);
    const row = await tx.enrollment.findUnique({ where: { accountId_courseId: { accountId, courseId } },
      select: { id: true, courseId: true, source: true, grantedAt: true } });
    if (!row || !['free','redeem','stripe'].includes(row.source)) throw new Error('Invalid stored entitlement');
    return { created: inserted.length === 1, enrollment: { id: row.id, course_id: row.courseId,
      source: row.source as EntitlementSource, access: 'lifetime', granted_at: row.grantedAt.toISOString() } };
  }
}
