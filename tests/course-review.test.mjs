import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditCourse,
  canPublishCourse,
  canReviewCourse,
  canSubmitCourse,
  coursePublicationIssue,
  invalidateCourseReview,
} from '../src/lib/course-review.ts';

const teacher = { id: 'teacher-1', role: 'instructor' };
const otherTeacher = { id: 'teacher-2', role: 'instructor' };
const admin = { id: 'admin-1', role: 'admin' };
const course = {
  id: 'course-1', title: 'คอร์สทดสอบ', instructorId: teacher.id, status: 'approved',
  chapters: [{ id: 'chapter-1', title: 'บทแรก', items: [{ id: 'item-1', type: 'article', title: 'อ่าน' }] }],
  reviewHistory: [{ action: 'approved', actorId: admin.id, at: '2026-10-01T00:00:00.000Z' }],
};
const users = [teacher, admin];

test('submit, review, and publish permissions follow the course owner and state', () => {
  assert.equal(canEditCourse(otherTeacher, course), false);
  assert.equal(canSubmitCourse(teacher, { ...course, status: 'draft' }), true);
  assert.equal(canSubmitCourse(otherTeacher, { ...course, status: 'draft' }), false);
  assert.equal(canSubmitCourse(admin, { ...course, status: 'draft' }), true);
  assert.equal(canReviewCourse(teacher, { ...course, status: 'pending_review' }), false);
  assert.equal(canReviewCourse(admin, { ...course, status: 'pending_review' }), true);
  assert.equal(canPublishCourse(teacher, course), true);
  assert.equal(canPublishCourse(otherTeacher, course), false);
  assert.equal(canPublishCourse(admin, course), true);
  assert.equal(canPublishCourse(admin, { ...course, status: 'draft' }), false);
});

test('editing an approved or pending course returns it to draft and preserves review history', () => {
  const edited = invalidateCourseReview(course, teacher.id, '2026-10-06T00:00:00.000Z');
  assert.equal(edited.status, 'draft');
  assert.equal(edited.reviewHistory.length, 2);
  assert.equal(edited.reviewHistory[1].action, 'approval_invalidated');
  assert.equal(invalidateCourseReview({ ...course, status: 'published' }, teacher.id, 'now').status, 'published');
});

test('review readiness requires an instructor and at least one content item', () => {
  assert.equal(coursePublicationIssue(course, users, []), null);
  assert.match(coursePublicationIssue({ ...course, instructorId: 'missing' }, users, []), /ผู้สอน/);
  assert.match(coursePublicationIssue({ ...course, chapters: [{ id: 'empty', title: 'ว่าง', items: [] }] }, users, []), /เนื้อหา/);
  assert.match(coursePublicationIssue({ ...course, chapters: [{ id: 'quiz', title: 'แบบทดสอบ', items: [{ id: 'qi', type: 'quiz', quizId: 'missing' }] }] }, users, []), /แบบทดสอบ/);
});
