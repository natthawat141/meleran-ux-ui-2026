import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyRedeemCodes, preparePrototypeRedeem, quoteRedeemCode } from '../src/lib/redeem-code.ts';
import type { Course, Enrollment, LmsData, RedeemCode, User } from '../src/types/index.ts';

const learner: User = { id: 'learner-1', name: 'Learner', email: 'learner@example.test', role: 'learner', status: 'active' };
const admin: User = { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'admin', status: 'active' };
const instructor: User = { id: 'teacher-1', name: 'Teacher', email: 'teacher@example.test', role: 'instructor', status: 'active' };
const course: Course = {
  id: 'course-1', slug: 'course-1', title: 'Course', category: 'General', level: 'Beginner', price: 500,
  instructorId: instructor.id, status: 'published', cover: '', chapters: [],
};
const redeemCode: RedeemCode = {
  id: 'redeem-1', code: 'COURSE-ONE', courseId: course.id, status: 'unused',
  createdAt: '2026-10-06T00:00:00.000Z', createdBy: admin.id,
};

test('redeem quote normalizes code and rejects used, revoked, and wrong-course codes', () => {
  assert.deepEqual(quoteRedeemCode([redeemCode], ' course-one ', course.id), { ok: true, code: redeemCode });
  assert.equal(quoteRedeemCode([{ ...redeemCode, status: 'used' }], redeemCode.code, course.id).ok, false);
  assert.equal(quoteRedeemCode([{ ...redeemCode, status: 'revoked' }], redeemCode.code, course.id).ok, false);
  assert.equal(quoteRedeemCode([redeemCode], redeemCode.code, 'other-course').ok, false);
});

test('prototype redemption returns a used code and matching enrollment in one transition', () => {
  const result = preparePrototypeRedeem({
    codes: [redeemCode], enrollments: [], courses: [course], user: learner,
    rawCode: 'course-one', now: '2026-10-06T01:00:00.000Z', enrollmentId: 'enrollment-1',
  });
  assert.equal(result.result.ok, true);
  assert.deepEqual(result.enrollment, {
    id: 'enrollment-1', courseId: course.id, userId: learner.id, createdAt: '2026-10-06T01:00:00.000Z',
  });
  assert.equal(result.redeemCode?.status, 'used');
  assert.equal(result.redeemCode?.usedByUserId, learner.id);
  assert.equal(result.redeemCode?.enrollmentId, 'enrollment-1');
  const replay = preparePrototypeRedeem({
    codes: result.redeemCode ? [result.redeemCode] : [], enrollments: [result.enrollment!], courses: [course], user: learner,
    rawCode: redeemCode.code, now: '2026-10-06T02:00:00.000Z', enrollmentId: 'enrollment-2',
  });
  assert.equal(replay.result.ok, true);
  assert.equal(replay.result.ok && replay.result.alreadyEnrolled, true);
  assert.equal(replay.redeemCode?.status, 'used');
  assert.equal(replay.enrollment?.id, 'enrollment-1');
});

test('already-enrolled learners receive their existing enrollment without consuming an unused code', () => {
  const existing: Enrollment = { id: 'existing-enrollment', courseId: course.id, userId: learner.id, createdAt: '2026-10-01T00:00:00.000Z' };
  const result = preparePrototypeRedeem({
    codes: [redeemCode], enrollments: [existing], courses: [course], user: learner,
    rawCode: redeemCode.code, now: '2026-10-06T01:00:00.000Z', enrollmentId: 'new-enrollment',
  });
  assert.deepEqual(result.result, { ok: true, enrollmentId: existing.id, redeemCodeId: redeemCode.id, alreadyEnrolled: true });
  assert.equal(result.redeemCode?.status, 'unused');
  assert.equal(result.enrollment, existing);
});

test('redemption keeps learner role, verification, account state, course ownership, and paid-public course checks', () => {
  const attempt = (user: User | null, courseOverride: Partial<Course> = {}) => preparePrototypeRedeem({
    codes: [redeemCode], enrollments: [], courses: [{ ...course, ...courseOverride }], user,
    rawCode: redeemCode.code, now: '2026-10-06T01:00:00.000Z', enrollmentId: 'enrollment-1',
  });
  assert.equal(attempt(null).result.ok, false);
  assert.equal(attempt(admin).result.ok, false);
  assert.equal(attempt({ ...learner, emailVerified: false }).result.ok, false);
  assert.equal(attempt({ ...learner, status: 'suspended' }).result.ok, false);
  assert.equal(attempt({ ...instructor, id: course.instructorId }).result.ok, false);
  assert.equal(attempt(learner, { price: 0 }).result.ok, false);
  assert.equal(attempt(learner, { status: 'draft' }).result.ok, false);
});

test('legacy migration creates redeem rights only from cash codes and retains all used/revoked evidence', () => {
  const enrolled: Enrollment = { id: 'paid-enrollment', courseId: course.id, userId: learner.id, createdAt: '2026-10-04T00:00:00.000Z' };
  const migrated = migrateLegacyRedeemCodes({
    rawCodes: [
      { id: 'discount', code: 'LESS20', courseId: course.id, kind: 'percent', status: 'active' },
      { id: 'cash-unused', code: 'UNUSED', courseId: course.id, kind: 'cash', status: 'active', createdAt: '2026-10-01', createdBy: 'admin', maxUses: 4 },
      { id: 'cash-count-used', code: 'COUNT-USED', courseId: course.id, kind: 'cash', status: 'active', usedCount: 1, userId: learner.id },
      { id: 'cash-order-used', code: 'ORDER-USED', courseId: course.id, kind: 'cash', status: 'active' },
      { id: 'cash-marked-used', code: 'MARKED-USED', courseId: course.id, kind: 'cash', status: 'used' },
      { id: 'cash-revoked', code: 'REVOKED', courseId: course.id, kind: 'cash', status: 'inactive' },
    ],
    rawOrders: [{ id: 'old-order', courseId: course.id, userId: learner.id, status: 'paid', source: 'cash_code', accessCodeId: 'cash-order-used', createdAt: '2026-10-04T00:00:00.000Z' }],
    enrollments: [enrolled],
    now: '2026-10-06T00:00:00.000Z',
  });
  assert.deepEqual(migrated.map((item) => [item.id, item.status]), [
    ['cash-unused', 'unused'],
    ['cash-count-used', 'used'],
    ['cash-order-used', 'used'],
    ['cash-marked-used', 'used'],
    ['cash-revoked', 'revoked'],
  ]);
  assert.equal(migrated.find((item) => item.id === 'cash-order-used')?.enrollmentId, enrolled.id);
});

test('legacy data retains paid course rights through existing enrollments only', async () => {
  const { normalizePrototypeSnapshot } = await import('../src/lib/prototype-snapshot.ts');
  const initial: LmsData = {
    users: [learner, instructor, admin], currentUserId: learner.id, courses: [course], blogPosts: [], quizzes: [],
    attempts: [], enrollments: [], redeemCodes: [], certificates: [], progress: {},
  };
  const enrollment = { id: 'existing-enrollment', courseId: course.id, userId: learner.id, createdAt: '2026-10-02T00:00:00.000Z', referralCode: 'OLD' };
  const migrated = normalizePrototypeSnapshot({
    users: [{ ...learner, baseSharePercent: 70 }], courses: [course], blogPosts: [], quizzes: [],
    attempts: [{ id: 'attempt-1', quizId: 'quiz-1', courseId: course.id, userId: learner.id, answers: {}, essayStatus: 'none', passed: true, status: 'submitted', assignmentId: 'assignment-1' }],
    enrollments: [enrollment], certificates: [], progress: {},
    assignments: [{ id: 'assignment-1', title: 'Legacy' }],
    orders: [{ id: 'old-order', courseId: course.id, userId: learner.id, status: 'paid', source: 'cash_code', accessCodeId: 'old-code' }],
    accessCodes: [{ id: 'old-code', code: 'OLD-1', courseId: course.id, kind: 'cash', status: 'active', usedCount: 1, userId: learner.id }],
  }, initial, '2026-10-06T00:00:00.000Z');
  assert.equal(migrated.attempts.length, 1);
  assert.equal('assignmentId' in migrated.attempts[0], false);
  assert.deepEqual(migrated.legacyPrototype?.collections.attemptAssignmentRefs, [{ id: 'attempt-1', assignmentId: 'assignment-1' }]);
  assert.deepEqual(migrated.enrollments, [{ id: enrollment.id, courseId: course.id, userId: learner.id, createdAt: enrollment.createdAt }]);
  assert.equal(migrated.legacyPrototype?.collections.orders instanceof Array, true);
  assert.equal(migrated.legacyPrototype?.collections.assignments instanceof Array, true);
  assert.equal(migrated.redeemCodes[0].status, 'used');
  assert.equal(migrated.redeemCodes[0].enrollmentId, enrollment.id);
});

test('legacy redeem result adapter maps an old order id only when existing enrollment grants access', async () => {
  const { resolveRedeemResult } = await import('../src/lib/redeem-code.ts');
  const data: LmsData = {
    users: [learner], currentUserId: learner.id, courses: [course], blogPosts: [], quizzes: [], attempts: [],
    enrollments: [{ id: 'enrollment-1', courseId: course.id, userId: learner.id, createdAt: '2026-10-01' }],
    redeemCodes: [], certificates: [], progress: {},
    legacyPrototype: { collections: {
      orders: [{ id: 'old-order', courseId: course.id, userId: learner.id, status: 'paid', source: 'cash_code', accessCodeId: 'legacy-code' }],
      accessCodes: [{ id: 'legacy-code', code: 'OLD-1', courseId: course.id, kind: 'cash' }],
    } },
  };
  assert.deepEqual(resolveRedeemResult(data, 'old-order', learner.id), {
    state: 'granted', courseId: course.id, enrollmentId: 'enrollment-1', redeemCodeId: 'legacy-code', isLegacy: true,
  });
  assert.equal(resolveRedeemResult({ ...data, enrollments: [] }, 'old-order', learner.id)?.state, 'not_granted');
  assert.equal(resolveRedeemResult({ ...data, legacyPrototype: { collections: { orders: [{ id: 'stripe', courseId: course.id, userId: learner.id, status: 'paid', method: 'Stripe' }] } } }, 'stripe', learner.id), null);
});


test('stored snapshots never refill missing collections from fixtures and retain rejected history', async () => {
  const { normalizePrototypeSnapshot } = await import('../src/lib/prototype-snapshot.ts');
  const initial: LmsData = {
    users: [learner], currentUserId: learner.id, courses: [course], blogPosts: [], quizzes: [],
    attempts: [], enrollments: [], redeemCodes: [redeemCode], certificates: [], progress: { demo: { learner: true } },
  };
  const rejectedAttempt = { id: 'old-partial-attempt', answers: { untouched: 'answer' } };
  const result = normalizePrototypeSnapshot({ attempts: [rejectedAttempt], progress: { old: { marker: 42 } } }, initial, '2026-10-07');
  assert.deepEqual(result.users, []);
  assert.deepEqual(result.courses, []);
  assert.deepEqual(result.redeemCodes, []);
  assert.equal(result.currentUserId, null);
  assert.deepEqual(result.attempts, []);
  assert.deepEqual(result.legacyPrototype?.collections.rejectedSnapshotFields, {
    attempts: [rejectedAttempt], progress: { old: { marker: 42 } },
  });
  assert.deepEqual(normalizePrototypeSnapshot(result, initial, '2026-10-08'), result);
});

test('migration round trips active learning records, immutable answers and retired assignment metadata', async () => {
  const { normalizePrototypeSnapshot } = await import('../src/lib/prototype-snapshot.ts');
  const attempt = { id: 'history', quizId: 'quiz', courseId: course.id, userId: learner.id,
    answers: { essay: 'original answer' }, essayStatus: 'graded' as const, passed: true,
    status: 'submitted' as const, score: 99, submittedAt: '2026-09-01', assignmentId: 'legacy-assignment' };
  const snapshot: LmsData = { users: [learner], currentUserId: learner.id, courses: [course], blogPosts: [], quizzes: [],
    attempts: [attempt], enrollments: [{ id: 'rights', courseId: course.id, userId: learner.id, createdAt: '2026-09-01' }],
    redeemCodes: [{ ...redeemCode, status: 'used', usedByUserId: learner.id, enrollmentId: 'rights' }],
    certificates: [{ id: 'certificate', code: 'CERT', courseId: course.id, userId: learner.id, issuedAt: '2026-09-02' }],
    progress: { lesson: { [learner.id]: true } },
  };
  const migrated = normalizePrototypeSnapshot(snapshot, snapshot, '2026-10-07');
  assert.deepEqual(migrated.attempts[0].answers, attempt.answers);
  assert.equal(migrated.attempts[0].score, 99);
  assert.deepEqual(migrated.enrollments, snapshot.enrollments);
  assert.deepEqual(migrated.certificates, snapshot.certificates);
  assert.deepEqual(migrated.progress, snapshot.progress);
  assert.deepEqual(migrated.redeemCodes, snapshot.redeemCodes);
  assert.deepEqual(migrated.legacyPrototype?.collections.attemptAssignmentRefs,
    [{ id: 'history', assignmentId: 'legacy-assignment' }]);
  assert.deepEqual(normalizePrototypeSnapshot(migrated, snapshot, '2026-10-08'), migrated);
});


test('a malformed saved root is quarantined without sample users or course rights', async () => {
  const { normalizePrototypeSnapshot } = await import('../src/lib/prototype-snapshot.ts');
  const initial: LmsData = { users: [learner], currentUserId: learner.id, courses: [course], blogPosts: [],
    quizzes: [], attempts: [], enrollments: [], redeemCodes: [redeemCode], certificates: [], progress: {} };
  const result = normalizePrototypeSnapshot('unreadable old snapshot', initial, '2026-10-07');
  assert.deepEqual(result.users, []);
  assert.deepEqual(result.enrollments, []);
  assert.deepEqual(result.redeemCodes, []);
  assert.equal(result.legacyPrototype?.collections.unreadableStoredSnapshot, 'unreadable old snapshot');
});
