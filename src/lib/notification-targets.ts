import type { Course, Notification, QuizAttempt, User } from '../types';

const APP_ORIGIN = 'https://melearn.local';
const ROUTE_ID_PATTERN = '[A-Za-z0-9_-]+';

type NotificationTargetCourses = readonly Pick<Course, 'id' | 'instructorId'>[];
type NotificationTargetAttempts = readonly Pick<
  QuizAttempt,
  'id' | 'courseId' | 'userId' | 'status' | 'essayStatus'
>[];

function parseSafeRelativeUrl(value: string): URL | null {
  if (
    !value
    || value !== value.trim()
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || value.includes('#')
    || /[\u0000-\u001F\u007F]/.test(value)
  ) return null;

  try {
    const parsed = new URL(value, APP_ORIGIN);
    const queryIndex = value.indexOf('?');
    const rawPath = queryIndex < 0 ? value : value.slice(0, queryIndex);
    if (parsed.origin !== APP_ORIGIN || parsed.hash || parsed.pathname !== rawPath) return null;
    return parsed;
  } catch {
    return null;
  }
}

function decodeStrictly(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function findUnique<T>(items: readonly T[], matches: (item: T) => boolean): T | null {
  const found = items.filter(matches);
  return found.length === 1 ? found[0] : null;
}

function getReviewTarget(
  href: string,
  currentUser: Pick<User, 'id' | 'role'>,
  courses: NotificationTargetCourses,
  attempts: NotificationTargetAttempts,
): string | null {
  if (currentUser.role !== 'instructor') return null;

  const parsedHref = parseSafeRelativeUrl(href);
  const reviewMatch = new RegExp(`^/teach/attempts/(${ROUTE_ID_PATTERN})/grade\\?returnTo=([^&]+)$`).exec(href);
  if (!parsedHref || !reviewMatch || parsedHref.searchParams.size !== 1) return null;

  const attemptId = reviewMatch[1];
  const encodedReturnTo = reviewMatch[2];
  if (!attemptId || !encodedReturnTo) return null;

  const returnTo = decodeStrictly(encodedReturnTo);
  if (!returnTo || encodeURIComponent(returnTo) !== encodedReturnTo) return null;

  const parsedReturnTo = parseSafeRelativeUrl(returnTo);
  if (!parsedReturnTo || parsedReturnTo.pathname !== '/teach/reviews' || parsedReturnTo.searchParams.size !== 1) {
    return null;
  }

  const attempt = findUnique(attempts, (item) => item.id === attemptId);
  if (
    !attempt
    || attempt.status !== 'submitted'
    || attempt.essayStatus !== 'pending'
  ) return null;

  const course = findUnique(courses, (item) => item.id === attempt.courseId);
  if (!course || course.instructorId !== currentUser.id) return null;

  const returnCourseIds = parsedReturnTo.searchParams.getAll('course');
  if (returnCourseIds.length !== 1 || returnCourseIds[0] !== course.id) return null;

  return href;
}

function getGradeResultTarget(
  href: string,
  currentUser: Pick<User, 'id' | 'role'>,
  courses: NotificationTargetCourses,
  attempts: NotificationTargetAttempts,
): string | null {
  if (currentUser.role !== 'learner' && currentUser.role !== 'instructor') return null;

  const parsedHref = parseSafeRelativeUrl(href);
  const resultMatch = new RegExp(`^/learn/attempts/(${ROUTE_ID_PATTERN})/result$`).exec(href);
  if (!parsedHref || !resultMatch || parsedHref.search || parsedHref.hash) return null;

  const attemptId = resultMatch[1];
  if (!attemptId) return null;

  const attempt = findUnique(attempts, (item) => item.id === attemptId);
  if (
    !attempt
    || attempt.userId !== currentUser.id
    || attempt.status !== 'submitted'
    || attempt.essayStatus !== 'graded'
  ) return null;

  const course = findUnique(courses, (item) => item.id === attempt.courseId);
  return course ? href : null;
}

/** Returns a validated same-app destination for a retained notification, or null when it is not actionable. */
export function getNotificationTarget(
  notification: Pick<Notification, 'userId' | 'type' | 'href'>,
  currentUser: Pick<User, 'id' | 'role'> | null,
  courses: NotificationTargetCourses,
  attempts: NotificationTargetAttempts,
): string | null {
  if (!currentUser || notification.userId !== currentUser.id || !notification.href) return null;

  if (notification.type === 'review_submitted') {
    return getReviewTarget(notification.href, currentUser, courses, attempts);
  }
  if (notification.type === 'grade_completed') {
    return getGradeResultTarget(notification.href, currentUser, courses, attempts);
  }
  return null;
}
