export type FeatureStatus = 'prototype' | 'integration' | 'released' | 'disabled';
export type FeatureEnvironment = 'development' | 'preview' | 'staging' | 'production';

// Runtime status records the current prototype evidence; phase is a proposed delivery order.
export const FEATURES = {
  publicSite: { status: 'prototype', phase: 1 },
  auth: { status: 'prototype', phase: 1 },
  courseCatalog: { status: 'prototype', phase: 1 },
  learning: { status: 'prototype', phase: 1 },
  profile: { status: 'prototype', phase: 1 },
  instructorCourses: { status: 'prototype', phase: 2 },
  assessment: { status: 'prototype', phase: 3 },
  certificates: { status: 'prototype', phase: 3 },
  payments: { status: 'prototype', phase: 4 },
  redeem: { status: 'prototype', phase: 4 },
  operations: { status: 'prototype', phase: 5 },
  blog: { status: 'prototype', phase: 6 },
  aiTeacher: { status: 'prototype', phase: 6 },
} as const satisfies Record<string, { status: FeatureStatus; phase: number }>;

export type FeatureKey = keyof typeof FEATURES;

export const ROUTE_FEATURES = {
  '/': 'publicSite',
  '/about': 'publicSite',
  '/instructors/:id': 'publicSite',

  '/login': 'auth',
  '/register': 'auth',
  '/verify-email': 'auth',
  '/forgot-password': 'auth',
  '/reset-password': 'auth',

  '/courses': 'courseCatalog',
  '/courses/:slug': 'courseCatalog',
  '/explore/courses': 'courseCatalog',
  '/explore/courses/:slug': 'courseCatalog',

  '/learn': 'learning',
  '/learn/courses': 'learning',
  '/learn/courses/:courseId': 'learning',
  '/learn/courses/:courseId/videos/:itemId': 'learning',
  '/learn/courses/:courseId/articles/:itemId': 'learning',

  '/account/profile': 'profile',

  '/admin/instructors': 'operations',

  '/teach': 'instructorCourses',
  '/teach/courses': 'instructorCourses',
  '/teach/courses/new': 'instructorCourses',
  '/teach/courses/:courseId': 'instructorCourses',
  '/teach/courses/:courseId/settings': 'instructorCourses',
  '/teach/courses/:courseId/curriculum': 'instructorCourses',
  '/teach/courses/:courseId/chapters/:chapterId': 'instructorCourses',
  '/teach/courses/:courseId/videos/:itemId': 'instructorCourses',
  '/teach/courses/:courseId/articles/:itemId': 'instructorCourses',
  '/teach/courses/:courseId/quizzes': 'instructorCourses',
  '/teach/quizzes': 'instructorCourses',
  '/teach/quizzes/:quizId': 'instructorCourses',
  '/teach/courses/:courseId/preview': 'instructorCourses',
  '/admin/courses': 'instructorCourses',
  '/admin/courses/reviews': 'instructorCourses',
  '/admin/courses/:courseId': 'instructorCourses',

  '/learn/courses/:courseId/quizzes/:itemId': 'assessment',
  '/learn/quizzes/:quizId': 'assessment',
  '/learn/attempts/:attemptId': 'assessment',
  '/learn/attempts/:attemptId/result': 'assessment',
  '/teach/quizzes/:quizId/attempts': 'assessment',
  '/teach/attempts/:attemptId/grade': 'assessment',
  '/teach/reviews': 'assessment',

  '/account/certificates': 'certificates',
  '/account/certificates/:certificateId': 'certificates',

  '/learn/redeem': 'redeem',
  '/checkout/:courseId': 'payments',
  '/checkout/:orderId/result': 'payments',
  '/admin/access-codes': 'redeem',
  '/admin/payments': 'payments',
  '/admin/ai': 'aiTeacher',

  '/admin': 'operations',
  '/admin/users': 'operations',
  '/admin/users/:id': 'operations',

  '/teach/courses/:courseId/learners': 'instructorCourses',
  '/teach/learners': 'instructorCourses',

  '/articles': 'blog',
  '/articles/:id': 'blog',
  '/admin/articles': 'blog',
  '/admin/articles/new': 'blog',
  '/admin/articles/:id/edit': 'blog',

  '/learn/ai': 'aiTeacher',
} as const satisfies Record<string, FeatureKey>;

export type FeatureRoutePath = keyof typeof ROUTE_FEATURES;

const ENVIRONMENTS = ['development', 'preview', 'staging', 'production'] as const satisfies readonly FeatureEnvironment[];
const STATUS_RANK: Record<FeatureStatus, number> = { prototype: 0, integration: 1, released: 2, disabled: -1 };
export function getFeatureEnvironment(input: { mode: string; dev: boolean; appEnvironment?: string }): FeatureEnvironment {
  const explicit = input.appEnvironment;
  if (explicit !== undefined) return ENVIRONMENTS.includes(explicit as FeatureEnvironment) ? explicit as FeatureEnvironment : 'production';
  if (input.dev) return 'development';
  if (input.mode === 'preview') return 'preview';
  if (input.mode === 'staging') return 'staging';
  return 'production';
}

export function isFeatureEnabled(status: FeatureStatus, environment: FeatureEnvironment): boolean {
  if (status === 'disabled') return false;
  if (environment === 'production') return status === 'released';
  if (environment === 'staging') return status === 'integration' || status === 'released';
  return STATUS_RANK[status] >= STATUS_RANK.prototype;
}
