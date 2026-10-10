import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyEnrollments(accountId: string, limit = 20, cursor?: string) {
    if (limit < 1 || limit > 50) {
      throw ApiException.validationFailed('Limit ต้องอยู่ระหว่าง 1 ถึง 50');
    }

    let offset = 0;
    if (cursor) {
      try {
        const raw = Buffer.from(cursor, 'base64').toString('utf-8');
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed >= 0) offset = parsed;
        else throw new Error();
      } catch {
        throw ApiException.validationFailed('Cursor ไม่ถูกต้อง');
      }
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { accountId },
      include: {
        course: {
          include: {
            instructor: { select: { id: true, displayName: true, avatarUrl: true } },
            chapters: { include: { items: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = enrollments.length > limit;
    const items = enrollments.slice(0, limit).map((e) => {
      const totalItems = e.course.chapters.reduce((sum, ch) => sum + ch.items.length, 0);
      return {
        enrollment: {
          id: e.id,
          course_id: e.courseId,
          source: e.source,
          access: 'lifetime',
          granted_at: e.grantedAt,
        },
        course: {
          id: e.course.id,
          slug: e.course.slug,
          title: e.course.title,
          subtitle: e.course.subtitle,
          cover_url: e.course.coverUrl,
          category: e.course.category,
          level: e.course.level,
          price: e.course.priceMinor && e.course.priceMinor > 0
            ? { amount_minor: e.course.priceMinor, currency: 'THB' }
            : null,
          instructor: {
            id: e.course.instructor.id,
            display_name: e.course.instructor.displayName,
            avatar_url: e.course.instructor.avatarUrl,
          },
          published_at: e.course.publishedAt,
        },
        progress: {
          completed_items: e.completedItems,
          total_items: totalItems,
          completed_at: e.completedAt,
        },
      };
    });

    const nextCursor = hasMore
      ? Buffer.from((offset + limit).toString()).toString('base64')
      : null;

    return { items, next_cursor: nextCursor };
  }
}
