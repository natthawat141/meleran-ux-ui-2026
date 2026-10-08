/** Scoped management read models, never a whole-application data snapshot. */
import type { Route, RequestContext } from './http.ts';
import { ok, notFound, requireRole, paginate, queryProblems } from './http.ts';
import type { UserRecord, CourseRecord, AttemptRecord } from './db.ts';
import { toCurrentUser, progressSummary, toCourseDetail } from './domain.ts';
import { canManage } from './flow-e-authoring.ts';
import type {
  AdminUserSummaryDto,
  ManagedAttemptDto,
  LearnerRosterDto,
  DashboardDto,
} from '../../packages/contracts/src/management-http.ts';
export function adminUser(user: UserRecord): AdminUserSummaryDto {
  return {
    id: user.id,
    display_name: user.display_name,
    username: user.username,
    email: user.email,
    email_verified: user.email_verified,
    avatar_url: user.avatar_url,
    roles: [...user.roles],
    origin: user.origin,
    created_at: user.created_at,
    status: user.origin === 'self_email' && !user.email_verified ? 'pending' : 'active',
  };
}
function course(context: RequestContext, id: string): CourseRecord {
  const c = context.db.courses.get(id);
  if (!c) throw notFound();
  canManage(context, c);
  return c;
}
function roster(context: RequestContext, c: CourseRecord): LearnerRosterDto[] {
  return [...context.db.enrollments.values()]
    .filter((e) => e.course_id === c.id)
    .map((e) => {
      const p = progressSummary(context.db, e, c);
      const cert = [...context.db.certificates.values()].find((x) => x.enrollment_id === e.id);
      return {
        id: e.id,
        course_id: c.id,
        user_id: e.user_id,
        learner_display_name: context.db.users.get(e.user_id)?.display_name ?? '',
        granted_at: e.granted_at,
        ...p,
        percent: p.total_items ? Math.floor((p.completed_items / p.total_items) * 100) : 0,
        certificate: cert
          ? { id: cert.id, code: cert.code, learner_name: cert.learner_name, issued_at: cert.issued_at }
          : null,
      };
    });
}
function attempt(context: RequestContext, a: AttemptRecord): ManagedAttemptDto {
  const choice = a.snapshot.filter((q) => q.type === 'single_choice' || q.type === 'multiple_choice');
  return {
    id: a.id,
    course_id: a.course_id,
    item_id: a.item_id,
    user_id: a.user_id,
    learner_display_name: context.db.users.get(a.user_id)?.display_name ?? '',
    status: a.status,
    started_at: a.started_at,
    submitted_at: a.submitted_at,
    graded_at: a.graded_at,
    earned: a.earned,
    max: a.max,
    passed: a.passed,
    choice_earned: choice.reduce((n, q) => n + (a.grades[q.id]?.score ?? 0), 0),
    choice_max: choice.reduce((n, q) => n + q.points, 0),
    questions: a.snapshot.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      prompt_doc: q.prompt_doc ?? null,
      rubric: q.rubric ?? null,
      response_mode: q.response_mode ?? (q.type === 'image' ? 'image' : 'either'),
      ...(q.options ? { options: q.options.map((o) => ({ id: o.id, text: o.text })) } : {}),
    })),
    answers: structuredClone(a.answers),
    grades: Object.fromEntries(
      Object.entries(a.grades).map(([id, g]) => [id, { score: g.score, comment: g.comment }]),
    ),
  };
}
function page<T>(context: RequestContext, rows: T[]) {
  return ok(paginate(rows, context.query, context.config, queryProblems(context.query, ['limit', 'cursor'])));
}
export const managementRoutes: Route[] = [
  {
    method: 'GET',
    path: 'admin/users/:id',
    handler: (c) => {
      requireRole(c, 'admin');
      const u = c.db.users.get(c.params.id);
      if (!u) throw notFound();
      const me = toCurrentUser(u);
      return ok({ ...adminUser(u), profile: me.profile, auth_methods: me.auth_methods });
    },
  },
  {
    method: 'GET',
    path: 'admin/users/:id/enrollments',
    handler: (c) => {
      requireRole(c, 'admin');
      if (!c.db.users.has(c.params.id)) throw notFound();
      return page(
        c,
        [...c.db.courses.values()].flatMap((x) => roster(c, x)).filter((e) => e.user_id === c.params.id),
      );
    },
  },
  {
    method: 'GET',
    path: 'admin/users/:id/attempts',
    handler: (c) => {
      requireRole(c, 'admin');
      if (!c.db.users.has(c.params.id)) throw notFound();
      return page(
        c,
        [...c.db.attempts.values()].filter((a) => a.user_id === c.params.id).map((a) => attempt(c, a)),
      );
    },
  },
  { method: 'GET', path: 'courses/:id/learners', handler: (c) => page(c, roster(c, course(c, c.params.id))) },
  {
    method: 'GET',
    path: 'courses/:id/attempts',
    handler: (c) => {
      const x = course(c, c.params.id);
      return page(
        c,
        [...c.db.attempts.values()].filter((a) => a.course_id === x.id).map((a) => attempt(c, a)),
      );
    },
  },
  {
    method: 'GET',
    path: 'instructor/learners',
    handler: (c) => {
      const u = requireRole(c, 'instructor');
      return page(
        c,
        [...c.db.courses.values()].filter((x) => x.instructor_id === u.id).flatMap((x) => roster(c, x)),
      );
    },
  },
  {
    method: 'GET',
    path: 'admin/learners',
    handler: (c) => {
      requireRole(c, 'admin');
      return page(
        c,
        [...c.db.courses.values()].flatMap((x) => roster(c, x)),
      );
    },
  },
  {
    method: 'GET',
    path: 'managed-quizzes/:id',
    handler: (c) => {
      const x = [...c.db.courses.values()].find((x) =>
        x.chapters.some((ch) => ch.items.some((i) => i.id === c.params.id && i.type === 'quiz')),
      );
      if (!x) throw notFound();
      canManage(c, x);
      return ok({ course_id: x.id, item_id: c.params.id });
    },
  },
  {
    method: 'GET',
    path: 'instructor/attempts/:id',
    handler: (c) => {
      const u = requireRole(c, 'instructor');
      const a = c.db.attempts.get(c.params.id);
      if (!a || c.db.courses.get(a.course_id)?.instructor_id !== u.id) throw notFound();
      return ok(attempt(c, a));
    },
  },
  ...(['admin', 'instructor'] as const).map((role) => ({
    method: 'GET',
    path: role + '/summary',
    handler: (c: RequestContext) => {
      const u = requireRole(c, role);
      const courses = [...c.db.courses.values()].filter((x) => role === 'admin' || x.instructor_id === u.id);
      const ids = new Set(courses.map((x) => x.id));
      const es = [...c.db.enrollments.values()].filter((e) => ids.has(e.course_id));
      const result: DashboardDto = {
        course_count: courses.length,
        enrollment_count: es.length,
        learner_count: new Set(es.map((e) => e.user_id)).size,
        pending_grading_count: [...c.db.attempts.values()].filter(
          (a) => ids.has(a.course_id) && a.status === 'pending_review',
        ).length,
        ...(role === 'admin'
          ? {
              user_count: c.db.users.size,
              pending_course_count: courses.filter((x) => x.status === 'pending_review').length,
            }
          : {}),
      };
      return ok(result);
    },
  })),
  {
    method: 'GET',
    path: 'instructors/:id/courses',
    handler: (c) => {
      const u = c.db.users.get(c.params.id);
      if (!u || !u.roles.includes('instructor')) throw notFound();
      return page(
        c,
        [...c.db.courses.values()]
          .filter((x) => x.instructor_id === u.id && x.status === 'published')
          .map((x) => toCourseDetail(c.db, x)),
      );
    },
  },
  {
    method: 'GET',
    path: 'instructors/:id',
    handler: (c) => {
      const u = c.db.users.get(c.params.id);
      if (!u || !u.roles.includes('instructor')) throw notFound();
      return ok({
        id: u.id,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        bio: u.profile?.bio ?? null,
      });
    },
  },
];
