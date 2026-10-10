import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { ManagedQuizLocatorDto } from './dto/managed-quiz-locator';

@Injectable()
export class ManagedQuizLocatorService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}
  read(reference: VerifiedSessionReference, itemId: string): Promise<ManagedQuizLocatorDto> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireAuthoring(tx, reference);
      // Canonical authoring exposes CourseItem IDs. Internal Quiz UUIDs are not
      // accepted as a second namespace or used as an unscoped lookup fallback.
      const rows = await tx.$queryRaw<ManagedQuizLocatorDto[]>(Prisma.sql`
        SELECT c.id AS course_id,i.id AS item_id
        FROM courses c JOIN course_items i ON i."courseId"=c.id
        JOIN quizzes q ON q."itemId"=i.id AND q."courseId"=c.id
        WHERE i.id=${itemId} AND i.type='quiz'
          AND (${actor.roles.includes('admin')} OR c."instructorId"=${actor.accountId})
        FOR SHARE OF c`);
      if (!rows.length) throw ApiException.notFound('ไม่พบแบบฝึกหัด');
      // Lock parent Course before Item/Quiz, and recheck the same-course link.
      // Future authoring replacement/deletion must use this parent-first order.
      const linked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT i.id FROM course_items i JOIN quizzes q ON q."itemId"=i.id AND q."courseId"=i."courseId"
        WHERE i.id=${itemId} AND i."courseId"=${rows[0].course_id} AND i.type='quiz'
        FOR SHARE OF i,q`);
      if (!linked.length) throw ApiException.notFound('ไม่พบแบบฝึกหัด');
      return { course_id: rows[0].course_id, item_id: linked[0].id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
