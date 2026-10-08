import assert from 'node:assert/strict';
import test from 'node:test';
import { accounts, createWorld } from './support/provisional-api.mjs';

async function enableCourse(world) {
  const admin = world.browser();
  await admin.login(accounts.admin, { audience: 'admin' });
  return { admin, result: await admin.patch('admin/courses/crs_mock_001/ai-support', { ai_enabled: true }) };
}

async function learnerWithCourse(world) {
  const learner = world.browser();
  await learner.login(accounts.learner);
  const enrolled = await learner.post('courses/crs_mock_001/enroll');
  assert.ok([200, 201].includes(enrolled.status));
  return learner;
}

function finish(world) {
  assert.deepEqual(world.api.unexpectedErrors, []);
}

test('AI settings and transcripts are Admin-only and isolated from authoring state', async () => {
  const world = createWorld();
  const instructor = world.browser();
  await instructor.login(accounts.instructorA);
  assert.equal((await instructor.patch('admin/courses/crs_mock_001/ai-support', { ai_enabled: true })).status, 403);
  assert.equal((await instructor.put('admin/courses/crs_mock_001/videos/itm_mock_001_1/ai-transcript', { text: 'x' })).status, 403);

  const before = structuredClone(world.db.courses.get('crs_mock_001'));
  const { admin, result } = await enableCourse(world);
  assert.deepEqual(result.body, { course_id: 'crs_mock_001', ai_enabled: true });
  const after = world.db.courses.get('crs_mock_001');
  assert.equal(after.status, before.status);
  assert.equal(after.revision, before.revision);
  assert.deepEqual([...world.db.enrollments.values()], []);

  const text = 'บรรทัดที่ 1\n00:01:02 SECRET\nบรรทัดที่ 3';
  const saved = await admin.put('admin/courses/crs_mock_001/videos/itm_mock_001_1/ai-transcript', { text });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.text, text);
  assert.equal(saved.body.edited_by, 'usr_admin');
  assert.equal(saved.body.edited_at, '2026-10-08T09:00:00Z');
  assert.equal((await admin.get('admin/courses/crs_mock_001/videos/itm_mock_001_1/ai-transcript')).body.text, text);
  assert.equal((await admin.get('admin/courses/crs_mock_001/videos/crs_mock_001_2/ai-transcript')).status, 404);
  assert.equal((await admin.get('admin/courses/crs_mock_001/videos/itm_mock_001_3/ai-transcript')).status, 404);
  finish(world);
});

test('conversation ownership, rename validation, search isolation and delete retain usage', async () => {
  const world = createWorld();
  await enableCourse(world);
  const learner = await learnerWithCourse(world);
  const other = world.browser();
  await other.login(accounts.adminCreatedLearner);
  const created = await learner.post('me/ai/conversations', { title: 'ค้นหาได้', course_id: 'crs_mock_001' });
  assert.equal(created.status, 200);
  const id = created.body.id;
  assert.equal((await other.get(`me/ai/conversations/${id}/messages`)).status, 404);
  assert.equal((await learner.patch(`me/ai/conversations/${id}`, { title: '   ' })).status, 422);
  assert.equal((await learner.patch(`me/ai/conversations/${id}`, { title: 'x'.repeat(81) })).status, 422);
  const sent = await learner.post(`me/ai/conversations/${id}/messages`, { content: 'ข้อความลับเฉพาะของฉัน', request_id: 'request-own-01' });
  assert.equal(sent.status, 200);
  assert.equal((await learner.get('me/ai/conversations?q=เฉพาะของฉัน')).body.items.length, 1);
  assert.equal((await other.get('me/ai/conversations?q=เฉพาะของฉัน')).body.items.length, 0);
  assert.equal((await learner.del(`me/ai/conversations/${id}`)).status, 204);
  assert.equal((await learner.get('me/ai/usage')).body.used, 1);
  finish(world);
});

test('course context is gated at create and send, and chat never echoes transcript secrets', async () => {
  const world = createWorld();
  const { admin } = await enableCourse(world);
  const learner = world.browser();
  await learner.login(accounts.learner);
  assert.equal((await learner.post('me/ai/conversations', { course_id: 'crs_mock_001' })).status, 403);
  assert.equal((await learner.post('me/ai/conversations', { course_id: 'missing' })).status, 404);
  assert.equal((await admin.put('admin/courses/crs_mock_001/videos/itm_mock_001_1/ai-transcript', { text: 'SECRET transcript text' })).status, 200);
  await learner.post('courses/crs_mock_001/enroll');
  const conversation = await learner.post('me/ai/conversations', { course_id: 'crs_mock_001' });
  assert.equal(conversation.status, 200);
  await admin.patch('admin/courses/crs_mock_001/ai-support', { ai_enabled: false });
  const sent = await learner.post(`me/ai/conversations/${conversation.body.id}/messages`, { content: 'ช่วยตอบ', request_id: 'request-disabled-1' });
  assert.equal(sent.status, 409);
  await admin.patch('admin/courses/crs_mock_001/ai-support', { ai_enabled: true });
  const answer = await learner.post(`me/ai/conversations/${conversation.body.id}/messages`, { content: 'ช่วยตอบ', request_id: 'request-secret-1' });
  assert.equal(answer.status, 200);
  assert.ok(!answer.text.includes('SECRET'));
  assert.match(answer.body.message.content, /แหล่งความรู้ 3 แหล่ง/);
  const history = await learner.get(`me/ai/conversations/${conversation.body.id}/messages`);
  assert.ok(!history.text.includes('SECRET'));
  finish(world);
});

test('failed and idempotent prompts do not consume quota, including replay after quota', async () => {
  const world = createWorld({ config: { aiDailyPromptLimit: 2 } });
  const learner = await learnerWithCourse(world);
  const conversation = await learner.post('me/ai/conversations');
  const id = conversation.body.id;
  const failed = await learner.post(`me/ai/conversations/${id}/messages`, { content: '__mock_ai_fail__', request_id: 'request-failed-1' });
  assert.equal(failed.body.message.status, 'failed');
  assert.equal((await learner.get('me/ai/usage')).body.used, 0);
  const first = await learner.post(`me/ai/conversations/${id}/messages`, { content: 'one', request_id: 'request-good-1' });
  const replay = await learner.post(`me/ai/conversations/${id}/messages`, { content: 'one changed', request_id: 'request-good-1' });
  assert.deepEqual(replay.body.message, first.body.message);
  await learner.post(`me/ai/conversations/${id}/messages`, { content: 'two', request_id: 'request-good-2' });
  assert.equal((await learner.post(`me/ai/conversations/${id}/messages`, { content: 'three', request_id: 'request-good-3' })).status, 429);
  assert.equal((await learner.get(`me/ai/conversations/${id}/messages`)).body.items.length, 6);
  assert.equal((await learner.post(`me/ai/conversations/${id}/messages`, { content: 'two changed', request_id: 'request-good-2' })).status, 200);
  finish(world);
});

test('practice snapshots hide answer keys, preserve IDs, support latest answers and do not affect progress', async () => {
  const world = createWorld();
  const learner = await learnerWithCourse(world);
  const conversation = await learner.post('me/ai/conversations');
  const id = conversation.body.id;
  const generated = await learner.post(`me/ai/conversations/${id}/messages`, { content: '/quiz เศษส่วน', request_id: 'request-practice-1' });
  assert.equal(generated.body.message.kind, 'practice_set');
  assert.ok(!generated.text.includes('correct_option'));
  assert.ok(!generated.text.includes('explanation'));
  const messageId = generated.body.message.id;
  const practice = generated.body.message.practice;
  const question = practice.questions[0];
  const beforeProgress = [...world.db.progress.entries()];
  const answer = await learner.put(`me/ai/conversations/${id}/messages/${messageId}/practice/answers`, { question_id: question.id, option_id: question.options[0].id });
  assert.equal(answer.status, 200);
  const reread = await learner.get(`me/ai/conversations/${id}/messages`);
  assert.deepEqual(reread.body.items.find((item) => item.id === messageId).practice.questions.map((item) => item.id), practice.questions.map((item) => item.id));
  assert.ok(reread.body.items.find((item) => item.id === messageId).practice.questions[0].result);
  assert.deepEqual([...world.db.progress.entries()], beforeProgress);
  assert.equal((await learner.get('me/ai/usage')).body.used, 1);
  finish(world);
});

test('quota uses the Bangkok accepted date and concurrent sends reserve atomically', async () => {
  const world = createWorld({ now: new Date('2026-10-08T16:59:00Z'), config: { aiDailyPromptLimit: 3 } });
  const learner = await learnerWithCourse(world);
  const conversation = await learner.post('me/ai/conversations');
  const id = conversation.body.id;
  const results = await Promise.all(Array.from({ length: 4 }, (_, index) => learner.post(`me/ai/conversations/${id}/messages`, { content: `q${index}`, request_id: `request-concurrent-${index}` })));
  assert.equal(results.filter((result) => result.status === 200).length, 3);
  assert.equal(results.filter((result) => result.status === 429).length, 1);
  assert.equal((await learner.get('me/ai/usage')).body.used, 3);
  world.clock.advance(2 * 60 * 1000);
  assert.equal((await learner.get('me/ai/usage')).body.used, 0);
  const fresh = await learner.post(`me/ai/conversations/${id}/messages`, { content: 'new day', request_id: 'request-new-day-1' });
  assert.equal(fresh.status, 200);
  assert.equal((await learner.get('me/ai/usage')).body.used, 1);
  finish(world);
});
