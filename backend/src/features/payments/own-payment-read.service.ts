import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { GrantedEntitlement } from '../enrollments/public/index';
import { ApiException } from '../../shared/errors/api-exception';

export interface OwnPaymentView {
  payment_id: string;
  course_id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  fulfillment_status: 'pending' | 'failed' | 'granted';
  enrollment: GrantedEntitlement | null;
}

/** Historical status only. Never contacts Stripe or invokes an entitlement writer. */
@Injectable()
export class OwnPaymentReadService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}

  read(reference: VerifiedSessionReference, paymentId: string): Promise<OwnPaymentView> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireSelfRead(tx, reference);
      // Resolve self ownership before selecting financial or enrollment fields.
      // Payment -> Enrollment matches fulfillment's resource order; no Course
      // lock/Published check is added to an already-owned historical record.
      const owned = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM payments WHERE id=${paymentId} AND "accountId"=${actor.accountId} FOR SHARE`);
      if (!owned.length) throw ApiException.notFound('ไม่พบรายการชำระเงิน');
      const row = await tx.payment.findUniqueOrThrow({ where: { id: owned[0].id }, select: {
        id: true, courseId: true, status: true, fulfillmentStatus: true, enrollmentId: true,
      } });
      if (!['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired'].includes(row.status) ||
          !['pending', 'failed', 'granted'].includes(row.fulfillmentStatus) ||
          (row.fulfillmentStatus === 'granted') !== (row.enrollmentId !== null) ||
          (row.fulfillmentStatus === 'granted' && row.status !== 'succeeded')) throw new Error('Invalid stored payment state');
      let enrollment: GrantedEntitlement | null = null;
      if (row.enrollmentId) {
        const links = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id FROM enrollments WHERE id=${row.enrollmentId} AND "accountId"=${actor.accountId}
          AND "courseId"=${row.courseId} FOR SHARE`);
        if (!links.length) throw new Error('Missing payment entitlement proof');
        const stored = await tx.enrollment.findUniqueOrThrow({ where: { id: links[0].id }, select: {
          id: true, courseId: true, source: true, grantedAt: true,
        } });
        if (!['free', 'redeem', 'stripe'].includes(stored.source)) throw new Error('Invalid stored entitlement source');
        enrollment = { id: stored.id, course_id: stored.courseId, source: stored.source as GrantedEntitlement['source'],
          access: 'lifetime', granted_at: stored.grantedAt.toISOString() };
      }
      return { payment_id: row.id, course_id: row.courseId, status: row.status as OwnPaymentView['status'],
        fulfillment_status: row.fulfillmentStatus as OwnPaymentView['fulfillment_status'], enrollment };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
