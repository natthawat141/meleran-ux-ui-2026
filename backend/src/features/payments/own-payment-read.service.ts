import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { OwnPaymentView, projectStoredPayment } from './stored-payment-view';
export type { OwnPaymentView } from './stored-payment-view';

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
        id: true, accountId: true, courseId: true, status: true, fulfillmentStatus: true, enrollmentId: true,
      } });
      return projectStoredPayment(tx, row);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
