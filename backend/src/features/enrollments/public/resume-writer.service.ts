import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { storedResume } from './stored-resume';

export interface SavedResume {
  item_id: string;
  resume: { position_seconds: number | null; updated_at: string };
}

/** Caller must establish fresh learner/own-course access, hold Course shared and
 * Enrollment exclusive locks, and decide the canonical optional-input mapping.
 * This participant persists an explicit server-validated position; it never
 * grants access, completes an item, or guesses omitted-position policy.
 */
@Injectable()
export class ResumeWriter {
  async save(tx: Prisma.TransactionClient, enrollmentId: string, itemId: string, courseId: string,
    position: number | null): Promise<SavedResume> {
    if (position !== null && (typeof position !== 'number' || !Number.isFinite(position) || position < 0)) {
      throw new Error('Invalid trusted resume position');
    }
    const input = JSON.stringify({ position_seconds: position });
    const rows = await tx.$queryRaw<Array<{ itemId: string; resumeData: Prisma.JsonValue; updatedAt: Date }>>(Prisma.sql`
      WITH saved AS (SELECT date_trunc('milliseconds',clock_timestamp()) AS at),
      ordering AS (SELECT COALESCE(MAX(CASE WHEN "resumeData" ? '_resume_order'
        THEN ("resumeData"->>'_resume_order')::bigint ELSE 0 END),0)+1 AS ordinal
        FROM progress WHERE "enrollmentId"=${enrollmentId})
      INSERT INTO progress (id,"enrollmentId","itemId","courseId","resumeData","updatedAt")
      SELECT ${randomUUID()},${enrollmentId},${itemId},${courseId},
        ${input}::jsonb || jsonb_build_object('updated_at',to_char(saved.at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          '_resume_order',ordering.ordinal::text),saved.at
      FROM saved CROSS JOIN ordering
      ON CONFLICT ("enrollmentId","itemId") DO UPDATE
        SET "resumeData"=EXCLUDED."resumeData","updatedAt"=EXCLUDED."updatedAt"
      RETURNING "itemId","resumeData","updatedAt"`);
    if (rows.length !== 1) throw new Error('Missing persisted resume');
    const parsed = storedResume(rows[0].resumeData, rows[0].updatedAt);
    if (!parsed || parsed.order === null) throw new Error('Invalid persisted resume');
    return { item_id: rows[0].itemId, resume: parsed.wire };
  }
}
