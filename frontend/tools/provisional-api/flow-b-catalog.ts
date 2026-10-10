// PROVISIONAL MOCK — Flow B (Catalog and Enrollment), operations FB1–FB4 of
// docs/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md. Draft, not a contract.
//
// Rules this mock enforces so Frontend code cannot grow to depend on behaviour nobody has agreed to:
// - Only `published` courses are public; every other id answers the same 404 as a missing one.
// - Public fields are copied from an explicit allow-list (see domain.ts).
// - Anything the draft does not specify (sort, slug lookup, extra query names) is rejected rather than guessed.
// - Enroll takes no body: price and "free" come from the course record, never from the Client.

import { iso } from './db.ts';
import type { CourseRecord } from './db.ts';
import { findEnrollment, grantEnrollment, isPublished, progressSummary, toCourseDetail, toCourseSummary, toEnrollment } from './domain.ts';
import { ApiError, created, notFound, ok, paginate, queryProblems, rejectUnknownFields, requireUser, validationFailed } from './http.ts';
import type { Route } from './http.ts';

const listParams: readonly string[] = ['q', 'category', 'level', 'price_type', 'limit', 'cursor'];

const publishedCourse = (courses: Iterable<CourseRecord>, id: string): CourseRecord | undefined => {
  for (const course of courses) if (course.id === id && isPublished(course)) return course;
  return undefined;
};

export const catalogRoutes: Route[] = [
  {
    // FB1
    method: 'GET', path: 'courses',
    handler: ({ db, query, config }) => {
      const problems = queryProblems(query, listParams);
      const priceType = query.get('price_type');
      if (priceType !== null && priceType !== 'free' && priceType !== 'paid') problems.push({ field: 'price_type', code: 'invalid' });

      const q = query.get('q')?.trim().toLowerCase() ?? '';
      const category = query.get('category');
      const level = query.get('level');
      const matches = [...db.courses.values()]
        .filter(isPublished)
        .filter((course) => !q || `${course.title} ${course.subtitle ?? ''}`.toLowerCase().includes(q))
        .filter((course) => category === null || course.category === category)
        .filter((course) => level === null || course.level === level)
        .filter((course) => priceType === null || (priceType === 'free') === (course.price === null))
        .sort((a, b) => (b.published_at as string).localeCompare(a.published_at as string) || a.id.localeCompare(b.id));
      const page = paginate(matches, query, config, problems);
      return ok({ items: page.items.map((course) => toCourseSummary(db, course)), next_cursor: page.next_cursor });
    },
  },
  {
    // FB2: id only, no slug lookup (draft question).
    method: 'GET', path: 'courses/:id',
    handler: ({ db, params }) => {
      const course = publishedCourse(db.courses.values(), params.id);
      if (!course) throw notFound();
      return ok(toCourseDetail(db, course));
    },
  },
  {
    // FB3
    method: 'POST', path: 'courses/:id/enroll',
    handler: ({ db, clock, params, body, principal }) => {
      if (!principal) throw new ApiError(401, 'unauthenticated', 'กรุณาเข้าสู่ระบบ');
      const user = principal;
      if (body !== undefined) {
        if (body === null || typeof body !== 'object' || Array.isArray(body)) throw validationFailed([{ field: 'body', code: 'object_required' }]);
        rejectUnknownFields(body as Record<string, unknown>, []);
      }
      const course = publishedCourse(db.courses.values(), params.id);
      if (!course) throw notFound();
      if (user.origin === 'self_email' && !user.email_verified) throw new ApiError(403, 'email_not_verified', 'กรุณายืนยันอีเมลก่อนลงเรียน');
      if (user.roles.includes('admin')) throw new ApiError(403, 'enrollment_not_allowed', 'บัญชีนี้ลงเรียนไม่ได้', { details: { reason: 'admin' } });
      if (course.instructor_id === user.id) throw new ApiError(403, 'enrollment_not_allowed', 'ลงเรียนคอร์สของตนเองไม่ได้', { details: { reason: 'own_course' } });
      const existing = findEnrollment(db, user.id, course.id);
      if (existing) return ok(toEnrollment(existing));
      if (course.price !== null) throw new ApiError(409, 'course_not_free', 'คอร์สนี้ไม่ใช่คอร์สฟรี');
      const { enrollment } = grantEnrollment(db, clock, user.id, course.id, 'free');
      return created(toEnrollment(enrollment));
    },
  },
  {
    // FB4
    method: 'GET', path: 'me/enrollments',
    handler: (context) => {
      const user = requireUser(context);
      const { db, query, config } = context;
      const problems = queryProblems(query, ['limit', 'cursor']);
      const mine = [...db.enrollments.values()]
        .filter((enrollment) => enrollment.user_id === user.id && db.courses.has(enrollment.course_id))
        .sort((a, b) => b.granted_at.localeCompare(a.granted_at) || a.id.localeCompare(b.id));
      const page = paginate(mine, query, config, problems);
      return ok({
        items: page.items.map((enrollment) => {
          const course = db.courses.get(enrollment.course_id) as CourseRecord;
          return {
            enrollment: toEnrollment(enrollment),
            course: toCourseSummary(db, { ...course, published_at: course.published_at ?? iso(new Date(enrollment.granted_at)) }),
            progress: progressSummary(db, enrollment, course),
          };
        }),
        next_cursor: page.next_cursor,
      });
    },
  },
];
