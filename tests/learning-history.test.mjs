import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageCourse, contentRemovalIssue } from '../src/lib/learning-history.ts';

const teacher = { id: 'teacher', role: 'instructor' };
const otherTeacher = { id: 'other', role: 'instructor' };
const admin = { id: 'admin', role: 'admin' };
const course = { id: 'course', instructorId: teacher.id, chapters: [{ id: 'chapter', items: [{ id: 'item', type: 'quiz', title: 'Quiz', quizId: 'quiz' }] }] };
const data = { courses: [course], attempts: [], progress: {} };

test('course editing permission remains owner-scoped while admin can manage content', () => {
  assert.equal(canManageCourse(teacher, course), true);
  assert.equal(canManageCourse(otherTeacher, course), false);
  assert.equal(canManageCourse(admin, course), true);
});

test('content removal preserves progress and submitted attempt history', () => {
  const items = course.chapters[0].items;
  assert.equal(contentRemovalIssue(data, teacher, course.id, items), null);
  assert.ok(contentRemovalIssue({ ...data, progress: { 'course:item': { learner: true } } }, teacher, course.id, items));
  assert.ok(contentRemovalIssue({ ...data, attempts: [{ quizId: 'quiz', userId: 'learner', assignmentId: 'legacy-assignment' }] }, teacher, course.id, items));
  assert.ok(contentRemovalIssue(data, otherTeacher, course.id, items));
  assert.equal(contentRemovalIssue({ ...data, attempts: [{ quizId: 'other-quiz' }] }, teacher, course.id, items), null);
});
