import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNotificationTarget } from '../src/lib/notification-targets.ts';

const instructor = { id: 'instructor-1', role: 'instructor' as const };
const learner = { id: 'learner-1', role: 'learner' as const };
const admin = { id: 'admin-1', role: 'admin' as const };
const courses = [
  { id: 'course-1', instructorId: instructor.id },
  { id: 'course-2', instructorId: 'instructor-2' },
];
const attempts = [
  { id: 'attempt-pending', courseId: 'course-1', userId: learner.id, status: 'submitted' as const, essayStatus: 'pending' as const },
  { id: 'attempt-graded', courseId: 'course-1', userId: learner.id, status: 'submitted' as const, essayStatus: 'graded' as const },
  { id: 'attempt-other-course', courseId: 'course-2', userId: learner.id, status: 'submitted' as const, essayStatus: 'pending' as const },
];

function notification(type: string, userId: string | undefined, href: string | undefined) {
  return { type, userId, href };
}

const reviewHref = `/teach/attempts/attempt-pending/grade?returnTo=${encodeURIComponent('/teach/reviews?course=course-1')}`;

test('review submissions target only the owning instructor and matching pending attempt', () => {
  assert.equal(
    getNotificationTarget(notification('review_submitted', instructor.id, reviewHref), instructor, courses, attempts),
    reviewHref,
  );
  assert.equal(
    getNotificationTarget(
      notification('review_submitted', 'instructor-2', reviewHref),
      { id: 'instructor-2', role: 'instructor' },
      courses,
      attempts,
    ),
    null,
  );
  assert.equal(
    getNotificationTarget(
      notification('review_submitted', instructor.id, `/teach/attempts/attempt-other-course/grade?returnTo=${encodeURIComponent('/teach/reviews?course=course-1')}`),
      instructor,
      courses,
      attempts,
    ),
    null,
  );
  assert.equal(
    getNotificationTarget(
      notification('review_submitted', instructor.id, `/teach/attempts/attempt-graded/grade?returnTo=${encodeURIComponent('/teach/reviews?course=course-1')}`),
      instructor,
      courses,
      attempts,
    ),
    null,
  );
});

test('completed grades target only the recipient’s own submitted result', () => {
  const resultHref = '/learn/attempts/attempt-graded/result';
  assert.equal(
    getNotificationTarget(notification('grade_completed', learner.id, resultHref), learner, courses, attempts),
    resultHref,
  );
  assert.equal(
    getNotificationTarget(notification('grade_completed', instructor.id, '/learn/attempts/attempt-graded/result'), instructor, courses, [
      ...attempts,
      { id: 'attempt-instructor', courseId: 'course-1', userId: instructor.id, status: 'submitted', essayStatus: 'graded' },
    ]),
    null,
  );
  assert.equal(
    getNotificationTarget(notification('grade_completed', instructor.id, '/learn/attempts/attempt-instructor/result'), instructor, courses, [
      ...attempts,
      { id: 'attempt-instructor', courseId: 'course-1', userId: instructor.id, status: 'submitted', essayStatus: 'graded' },
    ]),
    '/learn/attempts/attempt-instructor/result',
  );
  assert.equal(
    getNotificationTarget(notification('grade_completed', learner.id, '/learn/attempts/attempt-pending/result'), learner, courses, attempts),
    null,
  );
});

test('retired notification types and Admin grading notifications have no target', () => {
  const retiredNotifications = [
    ['inbox_message', '/inbox'],
    ['assignment_created', '/learn/assignments'],
    ['assignment_updated', '/learn/assignments'],
    ['order_paid', '/admin/orders'],
    ['analytics_ready', '/admin/analytics'],
  ] as const;
  for (const [type, href] of retiredNotifications) {
    assert.equal(getNotificationTarget(notification(type, learner.id, href), learner, courses, attempts), null, type);
  }
  assert.equal(getNotificationTarget(notification('review_submitted', admin.id, reviewHref), admin, courses, attempts), null);
  assert.equal(
    getNotificationTarget(
      notification('grade_completed', admin.id, '/learn/attempts/attempt-graded/result'),
      admin,
      courses,
      attempts,
    ),
    null,
  );
});

test('notification recipient and same-app route validation fail closed', () => {
  for (const href of [
    'https://example.test/teach/attempts/attempt-pending/grade',
    '//example.test/teach/attempts/attempt-pending/grade',
    '/teach/attempts/attempt-pending/grade?returnTo=%2F%2Fevil.test%2F',
    '/teach/attempts/attempt-pending/grade?returnTo=%ZZ',
    '/teach/attempts/attempt-pending/grade?returnTo=%2Fteach%2Freviews%3Fcourse%3Dcourse-2',
    `${reviewHref}&returnTo=${encodeURIComponent('/teach/reviews?course=course-1')}`,
    '/teach/attempts/../attempt-pending/grade?returnTo=%2Fteach%2Freviews%3Fcourse%3Dcourse-1',
  ]) {
    assert.equal(getNotificationTarget(notification('review_submitted', instructor.id, href), instructor, courses, attempts), null, href);
  }
  assert.equal(getNotificationTarget(notification('grade_completed', learner.id, '/learn/attempts/attempt-graded/result?next=/inbox'), learner, courses, attempts), null);
  assert.equal(getNotificationTarget(notification('grade_completed', 'learner-2', '/learn/attempts/attempt-graded/result'), learner, courses, attempts), null);
  assert.equal(getNotificationTarget(notification('grade_completed', undefined, '/learn/attempts/attempt-graded/result'), learner, courses, attempts), null);
  assert.equal(getNotificationTarget(notification('grade_completed', learner.id, '/learn/attempts/attempt-graded/result'), null, courses, attempts), null);
});
