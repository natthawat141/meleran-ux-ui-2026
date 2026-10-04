import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildPairedAssessmentRows, firstSubmittedAttempt, getFinalScorePercent } from '../src/api/assessmentComparison';
import { getAssessmentSummaries, getInstructorLearners, getInstructorPair, safeComparisonSet, scopeInstructorData } from '../src/api/instructorAnalytics';
import { instructorComparisonDemoRows } from '../src/mocks/instructorComparisonDemo';
import type { InstructorAnalyticsData } from '../src/api/instructorAnalytics';

const data: InstructorAnalyticsData = {
  users: [
    { id: 'teacher-a', name: 'Teacher A', role: 'instructor' },
    { id: 'teacher-b', name: 'Teacher B', role: 'instructor' },
    { id: 'learner-a', name: 'Learner A', role: 'learner' },
    { id: 'learner-b', name: 'Learner B', role: 'learner' },
    { id: 'learner-c', name: 'Learner C', role: 'learner' },
    { id: 'learner-d', name: 'Learner D', role: 'learner' },
    { id: 'learner-e', name: 'Learner E', role: 'learner' },
  ],
  courses: [
    { id: 'course-a', title: 'Owned', instructorId: 'teacher-a', chapters: [{ items: [{ id: 'pre-item', type: 'quiz', quizId: 'pre' }, { id: 'watch', type: 'video' }] }] },
    { id: 'course-b', title: 'Foreign', instructorId: 'teacher-b', chapters: [] },
  ],
  quizzes: [
    { id: 'pre', courseId: 'course-a', title: 'Pre', assessmentStage: 'pre_test', questions: [{ id: 'q1', type: 'choice', prompt: 'Q', options: ['A', 'B'], answer: 1 }] },
    { id: 'post', courseId: 'course-a', title: 'Post', assessmentStage: 'post_test', questions: [] },
    { id: 'foreign-quiz', courseId: 'course-b', title: 'Foreign', questions: [] },
  ],
  enrollments: [
    { id: 'ea', courseId: 'course-a', userId: 'learner-a' }, { id: 'ea-duplicate', courseId: 'course-a', userId: 'learner-a' },
    { id: 'eb', courseId: 'course-a', userId: 'learner-b' }, { id: 'ec', courseId: 'course-a', userId: 'learner-c' }, { id: 'ed', courseId: 'course-a', userId: 'learner-d' }, { id: 'ee', courseId: 'course-a', userId: 'learner-e' },
    { id: 'af', courseId: 'course-b', userId: 'learner-a' },
  ],
  comparisonSets: [{ id: 'set-a', courseId: 'course-a', title: 'Before/after', preQuizId: 'pre', postQuizId: 'post' }],
  progress: { 'course-a:watch': { 'learner-a': true } },
  attempts: [
    { id: 'a-pre-zero', courseId: 'course-a', quizId: 'pre', userId: 'learner-a', status: 'submitted', submittedAt: '2026-01-01', essayStatus: 'none', percent: 0, passed: false },
    { id: 'a-pre-later', courseId: 'course-a', quizId: 'pre', userId: 'learner-a', status: 'submitted', submittedAt: '2026-02-01', essayStatus: 'none', percent: 80, passed: true, answers: { q1: 1 } },
    { id: 'a-post', courseId: 'course-a', quizId: 'post', userId: 'learner-a', status: 'submitted', submittedAt: '2026-03-01', essayStatus: 'none', percent: 40, passed: false },
    { id: 'b-pre', courseId: 'course-a', quizId: 'pre', userId: 'learner-b', status: 'submitted', submittedAt: '2026-01-02', essayStatus: 'none', percent: 50, passed: false, answers: { q1: -1 } },
    { id: 'b-post-pending', courseId: 'course-a', quizId: 'post', userId: 'learner-b', status: 'submitted', submittedAt: '2026-03-02', essayStatus: 'pending', percent: 90, passed: true },
    { id: 'c-pre', courseId: 'course-a', quizId: 'pre', userId: 'learner-c', status: 'submitted', submittedAt: '2026-01-03', essayStatus: 'none', percent: 0, passed: false, answers: { q1: 9 } },
    { id: 'd-post', courseId: 'course-a', quizId: 'post', userId: 'learner-d', status: 'submitted', submittedAt: '2026-03-04', essayStatus: 'none', percent: 0, passed: false },
    { id: 'foreign-course-ref', courseId: 'course-a', quizId: 'foreign-quiz', userId: 'learner-a', status: 'submitted', submittedAt: '2026-01-01', essayStatus: 'none', percent: 100, passed: true },
    { id: 'foreign-user-course-ref', courseId: 'course-b', quizId: 'foreign-quiz', userId: 'learner-a', status: 'submitted', submittedAt: '2026-04-01', essayStatus: 'none', percent: 100, passed: true },
    { id: 'draft', courseId: 'course-a', quizId: 'pre', userId: 'learner-c', status: 'draft', submittedAt: '2025-12-01', essayStatus: 'none', percent: 100, passed: true },
  ],
};

test('first valid submission is deterministic, preserves real zero, and pending has no final score', () => {
  assert.equal(firstSubmittedAttempt(data.attempts.filter((row) => row.userId === 'learner-a' && row.quizId === 'pre'))?.id, 'a-pre-zero');
  assert.equal(firstSubmittedAttempt([
    { ...data.attempts[0], id: 'tie-z', submittedAt: '2026-01-01' },
    { ...data.attempts[0], id: 'tie-a', submittedAt: '2026-01-01' },
  ])?.id, 'tie-a');
  assert.equal(getFinalScorePercent(data.attempts.find((row) => row.id === 'a-pre-zero')), 0);
  assert.equal(getFinalScorePercent(data.attempts.find((row) => row.id === 'b-post-pending')), null);
  assert.equal(getFinalScorePercent({ ...data.attempts[0], percent: Number.NaN }), null);
});

test('owner scope rejects foreign course, cross-course quiz reference, unregistered pair, and foreign attempt history', () => {
  const scope = scopeInstructorData(data, 'teacher-a');
  assert.deepEqual(scope.courses.map((course) => course.id), ['course-a']);
  assert.equal(scope.attempts.some((attempt) => attempt.id === 'foreign-course-ref'), false);
  assert.equal(scope.attempts.some((attempt) => attempt.id === 'foreign-user-course-ref'), false);
  assert.equal(scope.attempts.some((attempt) => attempt.id === 'draft'), true);
  assert.equal(safeComparisonSet(data, scope, 'course-a', 'foreign-set'), null);
  const learners = getInstructorLearners(scope, 'all');
  const learnerA = learners.find((row) => row.learnerId === 'learner-a');
  assert.deepEqual(learnerA?.attemptHistory.map((attempt) => attempt.id), ['a-pre-zero', 'a-pre-later', 'a-post']);
  assert.equal(learnerA?.progressByCourse[0]?.percent, 100);
  const learnerB = learners.find((row) => row.learnerId === 'learner-b');
  assert.equal(learnerB?.latestScore, 50);
  assert.equal(learnerB?.latestAttempt?.id, 'b-pre');
});

test('paired results keep zero and first attempts; pending, incomplete, and unmatched remain separate', () => {
  const scope = scopeInstructorData(data, 'teacher-a');
  const set = data.comparisonSets?.[0];
  assert.ok(set);
  const comparison = getInstructorPair(scope, set);
  assert.equal(comparison.matchedN, 1);
  assert.equal(comparison.rows.find((row) => row.learnerId === 'learner-a')?.preScore, 0);
  assert.equal(comparison.rows.find((row) => row.learnerId === 'learner-a')?.diff, 40);
  assert.equal(comparison.rows.find((row) => row.learnerId === 'learner-b')?.status, 'pending_grading');
  assert.equal(comparison.rows.find((row) => row.learnerId === 'learner-c')?.status, 'pre_only');
  assert.equal(comparison.rows.find((row) => row.learnerId === 'learner-d')?.status, 'post_only');
  assert.equal(comparison.totalEnrolled, 5);
  assert.equal(comparison.unmatchedCount, 3);
  assert.equal(comparison.rows.find((row) => row.learnerId === 'learner-e')?.status, 'neither');
  const pendingOnlyData: InstructorAnalyticsData = { ...data,
    enrollments: data.enrollments.filter((row) => row.userId === 'learner-b'),
    attempts: data.attempts.filter((row) => row.userId === 'learner-b'),
  };
  const pendingOnly = getInstructorPair(scopeInstructorData(pendingOnlyData, 'teacher-a'), set);
  assert.equal(pendingOnly.matchedN, 0);
  assert.equal(pendingOnly.averageGain, null);
  const rows = buildPairedAssessmentRows({ courseId: 'course-a', preQuizId: 'pre', postQuizId: 'post', enrollments: [{ courseId: 'course-a', userId: 'learner-x' }], attempts: [{ ...data.attempts[3], userId: 'learner-x', percent: Number.NaN }, { ...data.attempts[4], userId: 'learner-x', essayStatus: 'none', percent: 40 }] });
  assert.equal(rows[0]?.status, 'missing');
});

test('assessment summaries deduplicate learner enrollment and count invalid choice indices as skipped', () => {
  const scope = scopeInstructorData(data, 'teacher-a');
  const pre = getAssessmentSummaries(scope, 'all').find((row) => row.quiz.id === 'pre');
  assert.equal(pre?.submitters, 3);
  assert.equal(pre?.choices[0]?.correct, 0);
  assert.equal(pre?.choices[0]?.skipped, 3);
});

test('read-only comparison example covers positive, negative, zero, pending, missing, and incomplete states', () => {
  assert.deepEqual(instructorComparisonDemoRows.map((row) => row.status), [
    'matched', 'matched', 'matched', 'pending_grading', 'pre_only', 'post_only', 'neither', 'missing',
  ]);
  assert.equal(instructorComparisonDemoRows[0]?.diff, 40);
  assert.equal(instructorComparisonDemoRows[2]?.preScore, 0);
});
