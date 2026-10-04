import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findCourseCommand, removeCourseCommand } from '../src/pages/learner/ai-course-command.ts';

test('slash and slash-space open an unfiltered course command', () => {
  assert.equal(findCourseCommand('/', 1)?.query, '');
  assert.equal(findCourseCommand('/ ', 2)?.query, '');
});

test('Thai titles and titles containing spaces can be searched', () => {
  const draft = '/  คณิตศาสตร์ พื้นฐาน ';
  assert.equal(findCourseCommand(draft, draft.length)?.query, 'คณิตศาสตร์ พื้นฐาน');
});

test('selecting a course preserves the question before and after the command', () => {
  const draft = 'ช่วยอธิบายข้อนี้\n/คณิต\nให้ที';
  const caret = draft.indexOf('\nให้ที');
  const command = findCourseCommand(draft, caret);
  assert.ok(command);
  assert.equal(removeCourseCommand(draft, command), 'ช่วยอธิบายข้อนี้\n\nให้ที');
});

test('a slash in arithmetic, a fraction, or a URL is ordinary question text', () => {
  for (const draft of ['1/2 + 1/3', 'คำนวณ 6 / 2', 'https://melearn.io/course', '/a/b']) {
    assert.equal(findCourseCommand(draft, draft.length), null);
  }
});

test('the command follows the caret instead of deleting the rest of a draft', () => {
  const draft = '  /Math คำถามที่เหลือ';
  const command = findCourseCommand(draft, 7);
  assert.ok(command);
  assert.equal(command.query, 'math');
  assert.equal(removeCourseCommand(draft, command), '   คำถามที่เหลือ');
  assert.equal(findCourseCommand(draft, 1), null);
});
