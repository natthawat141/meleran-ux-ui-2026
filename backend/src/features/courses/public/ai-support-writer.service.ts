import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../../shared/errors/api-exception';

/** Course-owned write; caller holds authority/resource locks in its transaction. */
@Injectable()
export class AiSupportWriter {
  async set(tx: Prisma.TransactionClient, courseId: string, enabled: boolean): Promise<{ course_id: string; ai_enabled: boolean }> {
    const rows = await tx.$queryRaw<Array<{ id: string; aiEnabled: boolean }>>(Prisma.sql`
      UPDATE courses SET "aiEnabled"=${enabled} WHERE id=${courseId} RETURNING id,"aiEnabled"`);
    if (!rows.length) throw ApiException.notFound('ไม่พบคอร์ส');
    // Intentionally no revision, updatedAt, approval or learning-content mutation.
    return { course_id: rows[0].id, ai_enabled: rows[0].aiEnabled };
  }
}
