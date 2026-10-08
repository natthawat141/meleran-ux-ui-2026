// PROVISIONAL MOCK — Flow C (learning, progress and resume), development/test only.
//
// Mock-only assumptions:
// - Learning routes expose the course summary fields used by the catalog, plus the learner-only state below.
// - A resume write creates a progress row, but viewing an item never does.

import type { CourseRecord, EnrollmentRecord, ItemRecord, ProgressRecord, UserRecord } from './db.ts';
import { iso } from './db.ts';
import {
  courseItems, evaluateCompletion, findEnrollment, getProgress, isPublished, progressSummary, toCourseSummary,
  toEnrollment, upsertProgress,
} from './domain.ts';
import {
  ApiError, created, notFound, ok, paginate, queryProblems, readObject, rejectUnknownFields, requireEligible,
  requireUser, validationFailed,
} from './http.ts';
import type { FieldError, RequestContext, Route } from './http.ts';

export interface LearningAccess {
  user: UserRecord;
  course: CourseRecord;
  enrollment: EnrollmentRecord;
}

export function findItem(db: RequestContext['db'], itemId: string): { course: CourseRecord; item: ItemRecord } | undefined {
  for (const course of db.courses.values()) {
    const item = courseItems(course).find((candidate) => candidate.id === itemId);
    if (item) return { course, item };
  }
  return undefined;
}

export function requireLearningAccess(context: RequestContext, course: CourseRecord): LearningAccess {
  const user = requireEligible(context);
  if (user.roles.includes('admin')) throw new ApiError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานส่วนนี้');
  const enrollment = findEnrollment(context.db, user.id, course.id);
  if (!enrollment) throw new ApiError(403, 'forbidden', 'ไม่มีสิทธิ์เข้าถึงคอร์สนี้');
  return { user, course, enrollment };
}

export function requireLearningCourse(context: RequestContext, courseId: string): LearningAccess {
  const course = context.db.courses.get(courseId);
  if (!course || !isPublished(course)) throw notFound();
  return requireLearningAccess(context, course);
}

function itemState(context: RequestContext, enrollment: EnrollmentRecord, item: ItemRecord) {
  const progress = getProgress(context.db, enrollment.id, item.id);
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    completed_at: progress?.completed_at ?? null,
    resume: progress?.resume ? { position_seconds: progress.resume.position_seconds, updated_at: progress.resume.updated_at } : null,
  };
}

export function resumeItemId(context: RequestContext, enrollment: EnrollmentRecord, course: CourseRecord): string | null {
  const items = courseItems(course);
  let latest: { id: string; updated_at: string } | undefined;
  for (const item of items) {
    const resume = getProgress(context.db, enrollment.id, item.id)?.resume;
    if (resume && (!latest || resume.updated_at > latest.updated_at)) latest = { id: item.id, updated_at: resume.updated_at };
  }
  if (latest) return latest.id;
  return items.find((item) => !getProgress(context.db, enrollment.id, item.id)?.completed_at)?.id ?? null;
}

export function toAttemptCertificate(context: RequestContext, enrollment: EnrollmentRecord) {
  const certificate = [...context.db.certificates.values()].find((candidate) => candidate.enrollment_id === enrollment.id);
  return certificate?.id ?? null;
}

function learningCourse(context: RequestContext, access: LearningAccess) {
  return {
    ...toCourseSummary(context.db, access.course),
    access: { mode: 'enrolled' as const, enrollment: toEnrollment(access.enrollment) },
    outline: access.course.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      items: chapter.items.map((item) => itemState(context, access.enrollment, item)),
    })),
    progress: progressSummary(context.db, access.enrollment, access.course),
    resume_item_id: resumeItemId(context, access.enrollment, access.course),
    certificate_id: toAttemptCertificate(context, access.enrollment),
  };
}

function validatePosition(item: ItemRecord, body: Record<string, unknown>): number | null | undefined {
  const position = body.position_seconds;
  if (position === undefined) return undefined;
  if (position === null) return null;
  if (item.type !== 'video' || typeof position !== 'number' || !Number.isInteger(position) || position < 0) {
    throw validationFailed([{ field: 'position_seconds', code: 'invalid' }]);
  }
  return position;
}

export const learningRoutes: Route[] = [
  {
    method: 'GET', path: 'learn/courses/:id',
    handler: (context) => ok(learningCourse(context, requireLearningCourse(context, context.params.id))),
  },
  {
    method: 'GET', path: 'learn/courses/:id/items/:item_id',
    handler: (context) => {
      const access = requireLearningCourse(context, context.params.id);
      const item = courseItems(access.course).find((candidate) => candidate.id === context.params.item_id);
      if (!item) throw notFound();
      const content: Record<string, unknown> = {
        id: item.id, type: item.type, title: item.title,
      };
      // Learners with access may read lesson content. Seed SECRET markers live in this content on purpose: they
      // are leak detectors for PUBLIC routes, and must not be scrubbed here.
      if (item.type === 'video') content.video_url = item.video_url ?? null;
      if (item.type === 'article') {content.body = item.body ?? null;content.body_doc=item.body_doc??null;}
      if (item.type === 'quiz') content.quiz = {
        question_count: item.quiz?.questions.length ?? 0,
        max_score: item.quiz?.questions.reduce((sum, question) => sum + question.points, 0) ?? 0,
      };
      return ok(content);
    },
  },
  {
    method: 'GET', path: 'me/progress',
    handler: (context) => {
      const user = requireUser(context);
      const problems = queryProblems(context.query, ['limit', 'cursor']);
      const rows = [...context.db.enrollments.values()]
        .filter((enrollment) => enrollment.user_id === user.id)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((enrollment) => {
          const course = context.db.courses.get(enrollment.course_id);
          return course ? {
            course_id: course.id,
            enrollment_id: enrollment.id,
            progress: progressSummary(context.db, enrollment, course),
            resume_item_id: resumeItemId(context, enrollment, course),
            completed_at: enrollment.completed_at,
          } : null;
        }).filter((row): row is NonNullable<typeof row> => row !== null);
      const page = paginate(rows, context.query, context.config, problems);
      return ok(page);
    },
  },
  {
    method: 'POST', path: 'learn/items/:id/complete',
    handler: (context) => {
      const user = requireEligible(context);
      const body = context.body === undefined ? undefined : readObject(context);
      if (body) rejectUnknownFields(body, []);
      const found = findItem(context.db, context.params.id);
      if (!found || !isPublished(found.course)) throw notFound();
      const access = requireLearningAccess(context, found.course);
      if (found.item.type === 'quiz') {
        throw new ApiError(409, 'invalid_state', 'แบบฝึกหัดต้องส่งคำตอบก่อน', { details: { reason: 'quiz_requires_attempt' } });
      }
      const progress = upsertProgress(context.db, access.enrollment.id, found.item.id);
      if (!progress.completed_at) progress.completed_at = iso(context.clock.now());
      const certificate = evaluateCompletion(context.db, context.clock, access.enrollment);
      return ok({
        item_id: found.item.id,
        completed_at: progress.completed_at,
        progress: progressSummary(context.db, access.enrollment, found.course),
        course_completed_at: access.enrollment.completed_at,
        certificate_id: certificate?.id ?? null,
      });
    },
  },
  {
    method: 'PUT', path: 'learn/items/:id/resume',
    handler: (context) => {
      const body = readObject(context);
      rejectUnknownFields(body, ['position_seconds']);
      const found = findItem(context.db, context.params.id);
      if (!found || !isPublished(found.course)) throw notFound();
      const access = requireLearningAccess(context, found.course);
      const position = validatePosition(found.item, body);
      if (position === undefined && found.item.type === 'video') {
        throw validationFailed([{ field: 'position_seconds', code: 'required' }]);
      }
      if (found.item.type !== 'video' && position !== undefined && position !== null) {
        throw validationFailed([{ field: 'position_seconds', code: 'invalid' }]);
      }
      const progress = upsertProgress(context.db, access.enrollment.id, found.item.id);
      progress.resume = { position_seconds: position ?? null, updated_at: iso(context.clock.now()) };
      return ok({ item_id: found.item.id, resume: progress.resume });
    },
  },
];
