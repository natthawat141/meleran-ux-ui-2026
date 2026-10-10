import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { storedResume } from '../enrollments/public/index';
import { LearningCourseDto, LearningItemContentDto, learningItemType, learningResume } from './dto/learning.dto';

const ExactDecimal = Prisma.Decimal.clone({ precision: 100 });

@Injectable()
export class LearningReadService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}

  private async authorize(tx: Prisma.TransactionClient, reference: VerifiedSessionReference, courseId: string) {
    const actor = await this.principals.requireLearning(tx, reference);
    const courses = await tx.$queryRaw<Array<{ instructorId: string; status: string; publishedAt: Date | null }>>(Prisma.sql`
      SELECT "instructorId",status,"publishedAt" FROM courses WHERE id=${courseId} FOR SHARE`);
    const course = courses[0];
    if (!course || course.status !== 'published' || !course.publishedAt) throw ApiException.notFound('ไม่พบคอร์ส');
    if (course.instructorId === actor.accountId) throw ApiException.forbidden('ใช้สิทธิ์ดูเพื่อจัดการผ่านหน้า Preview');
    const grants = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM enrollments WHERE "accountId"=${actor.accountId} AND "courseId"=${courseId} FOR SHARE`);
    if (!grants.length) throw ApiException.forbidden('ยังไม่มีสิทธิ์เรียนคอร์สนี้');
    return grants[0].id;
  }

  async course(reference: VerifiedSessionReference, courseId: string): Promise<LearningCourseDto> {
    return this.prisma.$transaction(async tx => {
      const enrollmentId = await this.authorize(tx, reference, courseId);
      // Explicit bounded read joins are declared in LEARNING_READ_COMPONENT;
      // no answer keys, full account/entity, transcript or foreign progress.
      const course = await tx.course.findUniqueOrThrow({ where: { id: courseId }, select: {
        id: true, slug: true, title: true, subtitle: true, coverUrl: true, category: true, level: true,
        priceMinor: true, currency: true, publishedAt: true,
        instructor: { select: { id: true, displayName: true, avatarUrl: true } },
        chapters: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, title: true,
          items: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, type: true, title: true } } } },
      } });
      const enrollment = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, select: {
        id: true, courseId: true, source: true, grantedAt: true, completedAt: true,
        certificate: { select: { id: true } },
        progress: { orderBy: [{ updatedAt: 'desc' }, { itemId: 'asc' }], select: {
          itemId: true, completedAt: true, resumeData: true, updatedAt: true,
        } },
      } });
      if (!['free', 'stripe', 'redeem'].includes(enrollment.source) || course.currency !== 'THB') throw new Error('Invalid learning wire metadata');
      const progress = new Map(enrollment.progress.map(row => [row.itemId, row]));
      const outline = course.chapters.map(chapter => ({ id: chapter.id, title: chapter.title, items: chapter.items.map(item => {
        const stored = progress.get(item.id);
        return { id: item.id, type: learningItemType(item.type), title: item.title,
          completed_at: stored?.completedAt?.toISOString() ?? null,
          resume: stored ? learningResume(stored.resumeData, stored.updatedAt) : null };
      }) }));
      const items = outline.flatMap(chapter => chapter.items);
      const resumeOrders = new Map(enrollment.progress.map(row => [row.itemId, storedResume(row.resumeData, row.updatedAt)?.order ?? null]));
      const latestResume = items.filter(item => item.resume !== null).sort((left, right) => {
        const leftOrder = resumeOrders.get(left.id) ?? null, rightOrder = resumeOrders.get(right.id) ?? null;
        if (leftOrder !== rightOrder) {
          if (leftOrder === null) return 1; if (rightOrder === null) return -1;
          return leftOrder < rightOrder ? 1 : -1;
        }
        return Date.parse(right.resume!.updated_at) - Date.parse(left.resume!.updated_at) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
      })[0];
      return { id: course.id, slug: course.slug, title: course.title, subtitle: course.subtitle, cover_url: course.coverUrl,
        category: course.category, level: course.level,
        price: course.priceMinor !== null && course.priceMinor > 0 ? { amount_minor: course.priceMinor, currency: 'THB' } : null,
        published_at: course.publishedAt!.toISOString(),
        instructor: { id: course.instructor.id, display_name: course.instructor.displayName, avatar_url: course.instructor.avatarUrl },
        access: { mode: 'enrolled', enrollment: { id: enrollment.id, course_id: enrollment.courseId,
          source: enrollment.source as 'free' | 'stripe' | 'redeem', access: 'lifetime', granted_at: enrollment.grantedAt.toISOString() } },
        outline, progress: { completed_items: items.filter(item => item.completed_at !== null).length,
          total_items: items.length, completed_at: enrollment.completedAt?.toISOString() ?? null },
        resume_item_id: latestResume?.id ?? null, certificate_id: enrollment.certificate?.id ?? null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async item(reference: VerifiedSessionReference, courseId: string, itemId: string): Promise<LearningItemContentDto> {
    return this.prisma.$transaction(async tx => {
      await this.authorize(tx, reference, courseId);
      const item = await tx.courseItem.findFirst({ where: { id: itemId, courseId }, select: {
        id: true, type: true, title: true, videoUrl: true, contentDoc: true,
        quiz: { select: { questions: { select: { maxScore: true } } } },
      } });
      if (!item) throw ApiException.notFound('ไม่พบเนื้อหาในคอร์ส');
      const type = learningItemType(item.type), base = { id: item.id, type, title: item.title };
      if (type === 'video') return { ...base, video_url: item.videoUrl };
      if (type === 'article') return { ...base, body: null, body_doc: item.contentDoc };
      if (!item.quiz) throw new Error('Missing stored quiz definition');
      const maximum = item.quiz.questions.reduce((sum, question) => sum.plus(question.maxScore), new ExactDecimal(0)).toNumber();
      if (!Number.isFinite(maximum) || maximum < 0) throw new Error('Invalid stored quiz maximum');
      return { ...base, quiz: { question_count: item.quiz.questions.length, max_score: maximum } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
