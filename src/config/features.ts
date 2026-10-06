export type FeatureStatus = 'prototype' | 'integration' | 'released' | 'disabled';
export type FeatureEnvironment = 'development' | 'preview' | 'staging' | 'production';
export type FeaturePhase = 1 | 'later';

// Phase 1 is confirmed in Final 1.5; later means outside that scope, with no committed date.
// Runtime status reflects the current browser-local prototype evidence, not planned delivery scope.
export const FEATURES = {
  publicSite: { status: 'prototype', phase: 1 },
  auth: { status: 'prototype', phase: 1 },
  courseCatalog: { status: 'prototype', phase: 1 },
  learning: { status: 'prototype', phase: 1 },
  profile: { status: 'prototype', phase: 1 },
  instructorOnboarding: { status: 'prototype', phase: 'later' },
  instructorCourses: { status: 'prototype', phase: 1 },
  assessment: { status: 'prototype', phase: 1 },
  assignments: { status: 'prototype', phase: 'later' },
  certificates: { status: 'prototype', phase: 1 },
  accessCodes: { status: 'prototype', phase: 1 },
  commerce: { status: 'prototype', phase: 'later' },
  operations: { status: 'prototype', phase: 1 },
  analytics: { status: 'prototype', phase: 'later' },
  finance: { status: 'prototype', phase: 'later' },
  inbox: { status: 'prototype', phase: 'later' },
  blog: { status: 'prototype', phase: 1 },
  aiTeacher: { status: 'prototype', phase: 1 },
} as const satisfies Record<string, { status: FeatureStatus; phase: FeaturePhase }>;

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
  '/invite/:token': 'instructorOnboarding',
  '/courses': 'courseCatalog',
  '/courses/:slug': 'courseCatalog',
  '/courses/:slug/preview': 'courseCatalog',
  '/explore/courses': 'courseCatalog',
  '/explore/courses/:slug': 'courseCatalog',
  '/articles': 'blog',
  '/articles/:id': 'blog',
  '/admin/articles': 'blog',
  '/admin/articles/new': 'blog',
  '/admin/articles/:id/edit': 'blog',
  '/become-instructor': 'instructorOnboarding',
  '/learn': 'learning',
  '/learn/courses': 'learning',
  '/learn/courses/:courseId': 'learning',
  '/learn/courses/:courseId/videos/:itemId': 'learning',
  '/learn/courses/:courseId/articles/:itemId': 'learning',
  '/learn/redeem': 'accessCodes',
  '/admin/access-codes': 'accessCodes',
  '/learn/assignments': 'assignments',
  '/teach/assignments': 'assignments',
  '/admin/assignments': 'assignments',
  '/learn/ai': 'aiTeacher',
  '/learn/inbox': 'inbox',
  '/teach/inbox': 'inbox',
  '/admin/inbox': 'inbox',
  '/learn/courses/:courseId/quizzes/:itemId': 'assessment',
  '/learn/quizzes/:quizId': 'assessment',
  '/learn/attempts/:attemptId': 'assessment',
  '/learn/attempts/:attemptId/result': 'assessment',
  '/teach/reviews': 'assessment',
  '/teach/quizzes/:quizId/attempts': 'assessment',
  '/teach/attempts/:attemptId/grade': 'assessment',
  '/teach/courses/:courseId/quizzes': 'instructorCourses',
  '/teach/quizzes': 'instructorCourses',
  '/teach/quizzes/:quizId': 'instructorCourses',
  '/teach': 'instructorCourses',
  '/teach/courses': 'instructorCourses',
  '/teach/courses/new': 'instructorCourses',
  '/teach/courses/:courseId': 'instructorCourses',
  '/teach/courses/:courseId/settings': 'instructorCourses',
  '/teach/courses/:courseId/curriculum': 'instructorCourses',
  '/teach/courses/:courseId/chapters/:chapterId': 'instructorCourses',
  '/teach/courses/:courseId/videos/:itemId': 'instructorCourses',
  '/teach/courses/:courseId/articles/:itemId': 'instructorCourses',
  '/teach/courses/:courseId/preview': 'instructorCourses',
  '/admin/courses': 'instructorCourses',
  '/admin/courses/reviews': 'instructorCourses',
  '/admin/courses/:courseId': 'instructorCourses',
  '/account/profile': 'profile',
  '/account/certificates': 'certificates',
  '/account/certificates/:certificateId': 'certificates',
  '/admin/certificates': 'certificates',
  '/admin/certificates/:certificateId': 'certificates',
  '/certificates/verify/:code': 'certificates',
  '/checkout/:courseId': 'commerce',
  '/checkout/:orderId/result': 'commerce',
  '/account/orders': 'commerce',
  '/account/cart': 'commerce',
  '/account/orders/:orderId': 'commerce',
  '/admin/orders': 'commerce',
  '/admin/orders/:orderId': 'commerce',
  '/admin': 'operations',
  '/admin/users': 'operations',
  '/admin/users/:id': 'operations',
  '/admin/instructors': 'instructorOnboarding',
  '/admin/instructors/:id': 'instructorOnboarding',
  '/teach/analytics': 'analytics',
  '/teach/courses/:courseId/analytics': 'analytics',
  '/teach/courses/:courseId/analytics/learners/:learnerId': 'analytics',
  '/teach/courses/:courseId/learners': 'analytics',
  '/teach/learners': 'analytics',
  '/admin/business-analytics': 'analytics',
  '/admin/analytics': 'analytics',
  '/admin/analytics/courses/:courseId': 'analytics',
  '/admin/analytics/courses/:courseId/learners/:learnerId': 'analytics',
  '/teach/finance': 'finance',
  '/admin/finance': 'finance',
  '/admin/reports/finance': 'finance',
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
