import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { EntitlementWriter } from './public/entitlement-writer.service';

@Injectable()
export class FreeEnrollmentService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService,
    private readonly entitlements: EntitlementWriter) {}

  async enroll(reference: VerifiedSessionReference, courseId: string) {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireLearning(tx, reference);
      // Hold lifecycle/price/owner stable until the grant commits. Authoring must
      // take its exclusive Course lock before mutating the same definition.
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; publishedAt: Date | null;
        instructorId: string; priceMinor: number | null }>>(Prisma.sql`
        SELECT id,status,"publishedAt","instructorId","priceMinor" FROM courses
        WHERE id=${courseId} FOR SHARE`);
      const course = rows[0];
      if (!course || course.status !== 'published' || !course.publishedAt) throw ApiException.notFound('ไม่พบคอร์ส');
      if (course.instructorId === actor.accountId) {
        throw new ApiException('own_course_not_allowed', 403, 'ลงเรียนคอร์สของตนเองไม่ได้');
      }
      if (course.priceMinor !== null && course.priceMinor > 0) {
        throw new ApiException('paid_course_requires_checkout', 409, 'คอร์สนี้ต้องชำระเงินหรือแลกโค้ด');
      }
      const grant = await this.entitlements.grantEntitlement(tx, actor.accountId, course.id, 'free');
      return grant.enrollment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
