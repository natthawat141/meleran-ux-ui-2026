import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { AiSupportWriter } from '../courses/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { AdminTranscriptDto } from './dto/admin-ai.dto';

@Injectable()
export class AdminAiService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService,
    private readonly support: AiSupportWriter) {}

  async setSupport(session: VerifiedSessionReference, courseId: string, enabled: boolean) {
    return this.prisma.$transaction(async tx => {
      await this.principals.requireAdmin(tx, session);
      await this.lockCourse(tx, courseId, true);
      return this.support.set(tx, courseId, enabled);
    });
  }

  async getTranscript(session: VerifiedSessionReference, courseId: string, itemId: string): Promise<AdminTranscriptDto> {
    return this.prisma.$transaction(async tx => {
      await this.principals.requireAdmin(tx, session);
      await this.lockVideo(tx, courseId, itemId);
      const transcript = await tx.videoTranscript.findUnique({ where: { itemId }, select: { text: true, editedBy: true, editedAt: true } });
      return { item_id: itemId, text: transcript?.text ?? '', edited_by: transcript?.editedBy ?? null,
        edited_at: transcript?.editedAt.toISOString() ?? null };
    });
  }

  async putTranscript(session: VerifiedSessionReference, courseId: string, itemId: string, text: string): Promise<AdminTranscriptDto> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireAdmin(tx, session);
      await this.lockVideo(tx, courseId, itemId);
      // One atomic provider-free write. Empty string is an explicit replacement;
      // timestamps/newlines/spacing are preserved, never trimmed or summarized.
      const rows = await tx.$queryRaw<Array<{ text: string; editedBy: string; editedAt: Date }>>(Prisma.sql`
        INSERT INTO video_transcripts ("itemId","itemType",text,"editedBy","editedAt")
        VALUES (${itemId},'video',${text},${actor.accountId},clock_timestamp())
        ON CONFLICT ("itemId") DO UPDATE SET text=EXCLUDED.text,"editedBy"=EXCLUDED."editedBy","editedAt"=EXCLUDED."editedAt"
        RETURNING text,"editedBy","editedAt"`);
      return { item_id: itemId, text: rows[0].text, edited_by: rows[0].editedBy, edited_at: rows[0].editedAt.toISOString() };
    });
  }

  private async lockCourse(tx: Prisma.TransactionClient, courseId: string, exclusive = false): Promise<void> {
    const rows = exclusive
      ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM courses WHERE id=${courseId} FOR UPDATE`)
      : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM courses WHERE id=${courseId} FOR SHARE`);
    if (!rows.length) throw ApiException.notFound('ไม่พบคอร์ส');
  }

  private async lockVideo(tx: Prisma.TransactionClient, courseId: string, itemId: string): Promise<void> {
    await this.lockCourse(tx, courseId);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT i.id FROM course_items i JOIN course_chapters c ON c.id=i."chapterId" AND c."courseId"=i."courseId"
      WHERE i.id=${itemId} AND i."courseId"=${courseId} AND i.type='video' FOR SHARE OF c,i`);
    if (!rows.length) throw ApiException.notFound('ไม่พบวิดีโอ');
  }
}
