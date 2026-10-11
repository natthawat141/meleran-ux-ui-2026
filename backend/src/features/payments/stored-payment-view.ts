import { Prisma } from '@prisma/client';
import { GrantedEntitlement } from '../enrollments/public/index';

export interface StoredPaymentState {
  id: string; accountId: string; courseId: string; status: string;
  fulfillmentStatus: string; enrollmentId: string | null;
}
export interface OwnPaymentView {
  payment_id: string; course_id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  fulfillment_status: 'pending' | 'failed' | 'granted'; enrollment: GrantedEntitlement | null;
}

/** Transaction participant: caller establishes self/Admin authority before selecting a Payment. */
export async function projectStoredPayment(tx: Prisma.TransactionClient, row: StoredPaymentState): Promise<OwnPaymentView> {
  if (!['pending','processing','succeeded','failed','cancelled','expired'].includes(row.status) ||
      !['pending','failed','granted'].includes(row.fulfillmentStatus) ||
      (row.fulfillmentStatus === 'granted') !== (row.enrollmentId !== null) ||
      (row.fulfillmentStatus === 'granted' && row.status !== 'succeeded')) throw Error('Invalid stored payment state');
  let enrollment: GrantedEntitlement | null = null;
  if (row.enrollmentId) {
    const links = await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
      SELECT id FROM enrollments WHERE id=${row.enrollmentId} AND "accountId"=${row.accountId}
      AND "courseId"=${row.courseId} FOR SHARE`);
    if (!links.length) throw Error('Missing payment entitlement proof');
    const stored = await tx.enrollment.findUniqueOrThrow({where:{id:links[0].id},select:{id:true,courseId:true,source:true,grantedAt:true}});
    if (!['free','redeem','stripe'].includes(stored.source)) throw Error('Invalid stored entitlement source');
    enrollment={id:stored.id,course_id:stored.courseId,source:stored.source as GrantedEntitlement['source'],access:'lifetime',granted_at:stored.grantedAt.toISOString()};
  }
  return {payment_id:row.id,course_id:row.courseId,status:row.status as OwnPaymentView['status'],
    fulfillment_status:row.fulfillmentStatus as OwnPaymentView['fulfillment_status'],enrollment};
}
