import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { RedeemWriter } from './redeem-writer.service';

const unavailable = () => new ApiException('redeem_code_unavailable', 404, 'ไม่พบรหัสแลกสิทธิ์ที่ใช้งานได้');

@Injectable()
export class RedeemCodeService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService, private readonly writer: RedeemWriter) {}
  async redeem(reference: VerifiedSessionReference, code: string) {
    return this.prisma.$transaction(async tx => {
      // Identity/eligibility before code lookup: no existence oracle for denied users.
      const actor = await this.principals.requireLearning(tx, reference);
      const candidate = await tx.redeemCode.findUnique({ where: { code }, select: { id: true, courseId: true } });
      if (!candidate) throw unavailable();
      // Preserve shared Course -> exclusive Code -> entitlement order.
      const courses = await tx.$queryRaw<Array<{ id: string; status: string; publishedAt: Date | null; priceMinor: number | null; instructorId: string }>>(Prisma.sql`
        SELECT id,status,"publishedAt","priceMinor","instructorId" FROM courses WHERE id=${candidate.courseId} FOR SHARE`);
      const course = courses[0];
      if (!course || course.status !== 'published' || !course.publishedAt || course.priceMinor === null || course.priceMinor <= 0) throw unavailable();
      if (course.instructorId === actor.accountId) {
        throw new ApiException('enrollment_not_allowed', 403, 'ไม่สามารถแลกรหัสคอร์สของตนเองได้', { reason: 'own_course' });
      }
      return this.writer.redeem(tx, candidate.id, actor.accountId, course.id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
