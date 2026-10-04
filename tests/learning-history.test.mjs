import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentHasHistory, assignmentSaveIssue, canManageCourse, contentRemovalIssue } from '../src/lib/learning-history.ts';

const teacher = { id: 'teacher', role: 'instructor' };
const other = { id: 'other', role: 'instructor' };
const course = { id: 'course', instructorId: teacher.id, chapters: [{ id: 'chapter', items: [{ id: 'item', type: 'quiz', quizId: 'quiz' }] }] };
const assignment = { id: 'assignment', courseId: course.id, quizId: 'quiz', title: 'Practice', assigneeType: 'specific', assigneeIds: ['learner'] };
const data = { courses: [course], quizzes: [{ id: 'quiz', courseId: course.id }], users: [teacher, other, { id: 'learner', role: 'learner' }, { id: 'unenrolled', role: 'learner' }], assignments: [], attempts: [], enrollments: [{ courseId: course.id, userId: 'learner' }], progress: {} };

test('assignment writes require ownership, a linked quiz and enrolled learner recipients', () => {
  assert.equal(canManageCourse(other, course), false);
  assert.equal(assignmentSaveIssue(data, teacher, assignment), null);
  assert.ok(assignmentSaveIssue(data, other, assignment));
  assert.ok(assignmentSaveIssue(data, teacher, { ...assignment, quizId: 'foreign' }));
  assert.ok(assignmentSaveIssue(data, teacher, { ...assignment, assigneeIds: ['unenrolled'] }));
  assert.ok(assignmentSaveIssue(data, teacher, { ...assignment, assigneeIds: [] }));
});

test('explicit and older untagged attempts both protect assignment history', () => {
  assert.equal(assignmentHasHistory({ attempts: [{ quizId: 'quiz', assignmentId: assignment.id, userId: 'learner' }] }, assignment), true);
  const state = { ...data, assignments: [assignment], attempts: [{ quizId: 'quiz', userId: 'learner' }] };
  assert.equal(assignmentHasHistory(state, assignment), true);
  assert.ok(assignmentSaveIssue(state, teacher, assignment, assignment.id));
  assert.equal(assignmentHasHistory({ attempts: [{ quizId: 'quiz', assignmentId: 'different', userId: 'learner' }] }, assignment), false);
});

test('content removal preserves progress, answers and assignment references', () => {
  const items = course.chapters[0].items;
  assert.equal(contentRemovalIssue(data, teacher, course.id, items), null);
  assert.ok(contentRemovalIssue(data, other, course.id, items));
  assert.ok(contentRemovalIssue({ ...data, progress: { 'course:item': { learner: true } } }, teacher, course.id, items));
  assert.ok(contentRemovalIssue({ ...data, attempts: [{ quizId: 'quiz' }] }, teacher, course.id, items));
  assert.ok(contentRemovalIssue({ ...data, assignments: [assignment] }, teacher, course.id, items));
});
