import assert from 'node:assert/strict';
import test from 'node:test';
import type { Course, LmsData, Quiz, QuizAttempt, User } from '../packages/store/src/types.ts';
import { getReviewQueue } from '../packages/store/src/lib/assessment-review.ts';
import { getGradingReturnTo } from '../packages/store/src/lib/grading-navigation.ts';

const makeCourse = (id: string, instructorId: string): Course => ({
  id,
  slug: id,
  title: id,
  category: 'practice',
  level: 'beginner',
  price: 0,
  instructorId,
  status: 'published',
  cover: '',
  chapters: [],
});

const makeQuiz = (id: string, courseId: string): Quiz => ({
  id,
  courseId,
  title: id,
  passPercent: 70,
  questions: [{ id: `${id}-essay`, type: 'essay', prompt: 'Explain your answer', points: 1 }],
});

const makeAttempt = (
  id: string,
  quizId: string,
  courseId: string,
  submittedAt: string,
  answers: QuizAttempt['answers'] = { essay: 'A written response' },
  status: QuizAttempt['status'] = 'submitted',
  essayStatus: QuizAttempt['essayStatus'] = 'pending'
): QuizAttempt => ({
  id,
  quizId,
  courseId,
  userId: 'learner-1',
  answers,
  essayStatus,
  passed: null,
  status,
  submittedAt,
});

const instructor: User = { id: 'instructor-1', name: 'Instructor', email: 'instructor@example.test', role: 'instructor' };
const otherInstructor: User = { id: 'instructor-2', name: 'Other Instructor', email: 'other@example.test', role: 'instructor' };
const learner: User = { id: 'learner-1', name: 'Learner', email: 'learner@example.test', role: 'learner' };

const reviewData: LmsData = {
  users: [instructor, otherInstructor, learner],
  currentUserId: null,
  courses: [makeCourse('owned-course', instructor.id), makeCourse('foreign-course', otherInstructor.id)],
  blogPosts: [],
  quizzes: [
    makeQuiz('owned-quiz', 'owned-course'),
    makeQuiz('foreign-quiz', 'foreign-course'),
    makeQuiz('mismatched-quiz', 'foreign-course'),
  ],
  attempts: [
    makeAttempt('newer-image', 'owned-quiz', 'owned-course', '2026-10-03T10:00:00.000Z', {
      essay: { images: [{ id: 'image-1', url: '/answer.png' }] },
    }),
    makeAttempt('oldest-text', 'owned-quiz', 'owned-course', '2026-10-01T10:00:00.000Z'),
    makeAttempt('middle-image', 'owned-quiz', 'owned-course', '2026-10-02T10:00:00.000Z', {
      essay: { image: '/second-answer.png' },
    }),
    makeAttempt('in-progress', 'owned-quiz', 'owned-course', '2026-10-01T09:00:00.000Z', undefined, 'in_progress'),
    makeAttempt('already-graded', 'owned-quiz', 'owned-course', '2026-10-01T08:00:00.000Z', undefined, 'submitted', 'graded'),
    makeAttempt('foreign-course', 'foreign-quiz', 'foreign-course', '2026-10-01T07:00:00.000Z'),
    makeAttempt('quiz-course-mismatch', 'mismatched-quiz', 'owned-course', '2026-10-01T06:00:00.000Z'),
  ],
  enrollments: [],
  redeemCodes: [],
  certificates: [],
  progress: {},
};

test('review queue returns only submitted pending attempts for a correctly linked owned course', () => {
  const queue = getReviewQueue(reviewData, { role: 'instructor', instructorId: instructor.id });

  assert.deepEqual(queue.map((item) => item.id), ['oldest-text', 'middle-image', 'newer-image']);
  assert.equal(queue[0].course?.id, 'owned-course');
  assert.equal(queue[0].quiz?.courseId, queue[0].course?.id);
  assert.equal(getReviewQueue(reviewData, { role: 'instructor', instructorId: instructor.id, courseId: 'foreign-course' }).length, 0);
});

test('review queue requires the explicit Instructor role and identity', () => {
  assert.deepEqual(getReviewQueue(reviewData), []);
  assert.deepEqual(getReviewQueue(reviewData, { role: 'instructor' }), []);
  assert.deepEqual(getReviewQueue(reviewData, { role: 'instructor', instructorId: '' }), []);
  assert.deepEqual(getReviewQueue(reviewData, { role: 'admin', instructorId: instructor.id }), []);
  assert.deepEqual(getReviewQueue(reviewData, { role: 'instructor', instructorId: 'unknown-instructor' }), []);
});

test('review queue preserves image filtering and FIFO ordering', () => {
  const all = getReviewQueue(reviewData, { role: 'instructor', instructorId: instructor.id });
  const images = getReviewQueue(reviewData, { role: 'instructor', instructorId: instructor.id, responseMode: 'image' });

  assert.deepEqual(all.map((item) => item.mode), ['text', 'image', 'image']);
  assert.deepEqual(images.map((item) => item.id), ['middle-image', 'newer-image']);
});

test('grading return paths preserve query and hash for retained local routes', () => {
  assert.equal(
    getGradingReturnTo('/teach/reviews?course=owned-course&mode=image#newer-image', 'owned-quiz'),
    '/teach/reviews?course=owned-course&mode=image#newer-image'
  );
  assert.equal(
    getGradingReturnTo('/teach/quizzes/owned-quiz/attempts?sort=oldest#attempt-1', 'owned-quiz'),
    '/teach/quizzes/owned-quiz/attempts?sort=oldest#attempt-1'
  );
});

test('grading return paths fall back for external, malformed, or retired destinations', () => {
  const fallback = '/teach/quizzes/owned-quiz/attempts';
  for (const destination of [
    'https://example.test/teach/reviews',
    '//example.test/teach/reviews',
    '/teach/analytics?tab=overview',
    '/admin/certificates',
    '/teach/reviews/extra',
    '/teach\\reviews',
  ]) {
    assert.equal(getGradingReturnTo(destination, 'owned-quiz'), fallback, destination);
  }
  assert.equal(getGradingReturnTo(null), '/teach/quizzes');
});
