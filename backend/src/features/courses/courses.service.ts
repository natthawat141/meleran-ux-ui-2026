import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';
import { CourseDetailDto, storedItemType, storedOutcomes } from './dto/course-detail.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<CourseDetailDto> {
    const course = await this.prisma.course.findFirst({
      where: { id, status: 'published', publishedAt: { not: null } },
      select: {
        id: true, slug: true, title: true, subtitle: true, coverUrl: true,
        category: true, level: true, priceMinor: true, publishedAt: true,
        description: true, outcomesJson: true,
        instructor: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        chapters: {
          orderBy: { position: 'asc' },
          select: {
            id: true, title: true,
            items: {
              orderBy: { position: 'asc' },
              select: { id: true, title: true, type: true },
            },
          },
        },
      },
    });

    if (!course || !course.publishedAt) {
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
      published_at: course.publishedAt.toISOString(),
      description: course.description,
      outcomes: storedOutcomes(course.outcomesJson),
      outline: course.chapters.map((ch) => ({
        id: ch.id,
        title: ch.title,
        items: ch.items.map((i) => ({
          id: i.id,
          title: i.title,
          type: storedItemType(i.type),
        })),
      })),
    };
  }
}
