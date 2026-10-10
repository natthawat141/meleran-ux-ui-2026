import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    q?: string,
    category?: string,
    level?: string,
    priceType?: string,
    limit = 20,
    cursor?: string,
  ) {
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

    const where: any = {
      status: 'published',
      publishedAt: { not: null },
    };

    if (q) where.title = { contains: q };
    if (category) where.category = category;
    if (level) where.level = level;
    if (priceType === 'free') {
      where.OR = [{ priceMinor: null }, { priceMinor: 0 }];
    } else if (priceType === 'paid') {
      where.priceMinor = { gt: 0 };
    } else if (priceType) {
      throw ApiException.validationFailed('price_type ไม่ถูกต้อง');
    }

    const courses = await this.prisma.course.findMany({
      where,
      include: {
        instructor: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = courses.length > limit;
    const items = courses.slice(0, limit).map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      cover_url: c.coverUrl,
      category: c.category,
      level: c.level,
      price: c.priceMinor && c.priceMinor > 0
        ? { amount_minor: c.priceMinor, currency: 'THB' }
        : null,
      instructor: {
        id: c.instructor.id,
        display_name: c.instructor.displayName,
        avatar_url: c.instructor.avatarUrl,
      },
      published_at: c.publishedAt,
    }));

    const nextCursor = hasMore
      ? Buffer.from((offset + limit).toString()).toString('base64')
      : null;

    return { items, next_cursor: nextCursor };
  }

  async getById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        instructor: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        chapters: {
          orderBy: { position: 'asc' },
          include: {
            items: {
              orderBy: { position: 'asc' },
              select: { id: true, title: true, type: true },
            },
          },
        },
      },
    });

    if (!course || course.status !== 'published' || !course.publishedAt) {
      throw ApiException.notFound('ไม่พบคอร์ส');
    }

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      cover_url: course.coverUrl,
      category: course.category,
      level: course.level,
      price: course.priceMinor && course.priceMinor > 0
        ? { amount_minor: course.priceMinor, currency: 'THB' }
        : null,
      instructor: {
        id: course.instructor.id,
        display_name: course.instructor.displayName,
        avatar_url: course.instructor.avatarUrl,
      },
      published_at: course.publishedAt,
      description: course.description,
      outcomes: JSON.parse(course.outcomesJson || '[]'),
      outline: course.chapters.map((ch) => ({
        id: ch.id,
        title: ch.title,
        items: ch.items.map((i) => ({
          id: i.id,
          title: i.title,
          type: i.type,
        })),
      })),
    };
  }
}
