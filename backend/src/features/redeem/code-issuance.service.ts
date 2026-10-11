import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { IssueCodesInput } from './dto/code-requests.pipe';

@Injectable()
export class CodeIssuanceService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}
  async issue(reference: VerifiedSessionReference, input: IssueCodesInput) {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireAdmin(tx, reference);
      const courses = await tx.$queryRaw<Array<{ id: string; status: string; publishedAt: Date | null; priceMinor: number | null }>>(Prisma.sql`
        SELECT id,status,"publishedAt","priceMinor" FROM courses WHERE id=${input.course_id} FOR SHARE`);
      const course = courses[0];
      if (!course || course.status !== 'published' || !course.publishedAt) throw ApiException.notFound('ไม่พบคอร์ส');
      if (course.priceMinor === null || course.priceMinor <= 0) {
        throw new ApiException('invalid_state', 409, 'คอร์สฟรีไม่สามารถออกโค้ดขายได้', { reason: 'course_free' });
      }
      const items = [];
      // Omitted count issues one code. No mutation replay or partial batches.
      for (let i = 0; i < (input.count ?? 1); i++) {
        const row = await tx.redeemCode.create({ data: { code: 'MLN-' + randomBytes(16).toString('hex').toUpperCase(),
          courseId: course.id, issuedBy: actor.accountId }, select: { id: true, code: true, courseId: true, status: true, issuedAt: true } });
        items.push({ id: row.id, code: row.code, course_id: row.courseId, status: 'unused' as const, created_at: row.issuedAt.toISOString() });
      }
      return { items };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
  }
}
