export type FeatureStatus = 'prototype' | 'integration' | 'released' | 'disabled';
export type FeatureEnvironment = 'development' | 'preview' | 'staging' | 'production';

// Runtime status records the current prototype evidence; phase is a proposed delivery order.
export const FEATURES = {
  publicSite: { status: 'prototype', phase: 1 },
  auth: { status: 'prototype', phase: 1 },
  courseCatalog: { status: 'prototype', phase: 1 },
  learning: { status: 'prototype', phase: 1 },
  profile: { status: 'prototype', phase: 1 },
  instructorOnboarding: { status: 'prototype', phase: 2 },
  instructorCourses: { status: 'prototype', phase: 2 },
  assessment: { status: 'prototype', phase: 3 },
  certificates: { status: 'prototype', phase: 3 },
  payments: { status: 'prototype', phase: 4 },
  redeem: { status: 'prototype', phase: 4 },
  commerce: { status: 'prototype', phase: 4 },
  operations: { status: 'prototype', phase: 5 },
  analytics: { status: 'prototype', phase: 6 },
  finance: { status: 'prototype', phase: 6 },
  inbox: { status: 'prototype', phase: 6 },
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
  '/invite/:token': 'instructorOnboarding',
  '/verify-email': 'auth',
  '/forgot-password': 'auth',
  '/reset-password': 'auth',

  '/courses': 'courseCatalog',
  '/courses/:slug': 'courseCatalog',
  '/courses/:slug/preview': 'courseCatalog',
  '/explore/courses': 'courseCatalog',
  '/explore/courses/:slug': 'courseCatalog',

  '/learn': 'learning',
  '/learn/courses': 'learning',
  '/learn/courses/:courseId': 'learning',
  '/learn/courses/:courseId/videos/:itemId': 'learning',
  '/learn/courses/:courseId/articles/:itemId': 'learning',

  '/account/profile': 'profile',

  '/become-instructor': 'instructorOnboarding',
  '/admin/instructors': 'instructorOnboarding',
  '/admin/instructors/:id': 'instructorOnboarding',

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

  '/learn/assignments': 'assessment',
  '/learn/courses/:courseId/quizzes/:itemId': 'assessment',
  '/learn/quizzes/:quizId': 'assessment',
  '/learn/attempts/:attemptId': 'assessment',
  '/learn/attempts/:attemptId/result': 'assessment',
  '/teach/assignments': 'assessment',
  '/teach/quizzes/:quizId/attempts': 'assessment',
  '/teach/attempts/:attemptId/grade': 'assessment',
  '/teach/reviews': 'assessment',
  '/admin/assignments': 'assessment',

  '/account/certificates': 'certificates',
  '/account/certificates/:certificateId': 'certificates',
  '/admin/certificates': 'certificates',
  '/admin/certificates/:certificateId': 'certificates',
  '/certificates/verify/:code': 'certificates',

  '/learn/redeem': 'redeem',
  '/checkout/:courseId': 'payments',
  '/checkout/:orderId/result': 'payments',
  '/account/orders': 'commerce',
  '/account/cart': 'commerce',
  '/account/orders/:orderId': 'commerce',
  '/admin/orders': 'commerce',
  '/admin/orders/:orderId': 'commerce',
  '/admin/access-codes': 'redeem',

  '/admin': 'operations',
  '/admin/users': 'operations',
  '/admin/users/:id': 'operations',

  '/teach/analytics': 'analytics',
  '/teach/courses/:courseId/analytics': 'analytics',
  '/teach/courses/:courseId/analytics/learners/:learnerId': 'analytics',
  '/teach/courses/:courseId/learners': 'instructorCourses',
  '/teach/learners': 'instructorCourses',
  '/admin/business-analytics': 'analytics',
  '/admin/analytics': 'analytics',
  '/admin/analytics/courses/:courseId': 'analytics',
  '/admin/analytics/courses/:courseId/learners/:learnerId': 'analytics',

  '/teach/finance': 'finance',
  '/admin/finance': 'finance',
  '/admin/reports/finance': 'finance',

  '/learn/inbox': 'inbox',
  '/teach/inbox': 'inbox',
  '/admin/inbox': 'inbox',

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
