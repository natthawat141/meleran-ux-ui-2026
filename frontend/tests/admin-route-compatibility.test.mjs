import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAdminCompatibilityRoute } from '../apps/admin/src/route-compatibility.ts';

test('Admin old authoring links migrate to their Admin-owned canonical routes', () => {
  assert.equal(resolveAdminCompatibilityRoute('/teach/courses/new'), '/admin/courses/new');
  assert.equal(resolveAdminCompatibilityRoute('/teach/courses/course-7/settings'), '/admin/courses/course-7/settings');
  assert.equal(resolveAdminCompatibilityRoute('/teach/courses/course-7/curriculum'), '/admin/courses/course-7/curriculum');
  assert.equal(resolveAdminCompatibilityRoute('/teach/courses/course-7/preview'), '/admin/courses/course-7/preview');
  assert.equal(resolveAdminCompatibilityRoute('/teach/learners'), '/admin/learners');
});

test('Admin route migration preserves route context and encodes path ids', () => {
  assert.equal(
    resolveAdminCompatibilityRoute('/teach/courses/course%207/chapters/chapter%202', '?item=lesson-3', '#editor'),
    '/admin/courses/course%207/chapters/chapter%202?item=lesson-3#editor'
  );
});

test('Admin migration denies Instructor grading routes, quiz attempt review, and malformed path ids', () => {
  assert.equal(resolveAdminCompatibilityRoute('/teach/reviews'), null);
  assert.equal(resolveAdminCompatibilityRoute('/teach/attempts/attempt-4/grade'), null);
  assert.equal(resolveAdminCompatibilityRoute('/teach/quizzes/quiz-4/attempts'), null);
  assert.equal(resolveAdminCompatibilityRoute('/teach/courses/%2e%2e/settings'), null);
});
