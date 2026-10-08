import assert from 'node:assert/strict';
import test from 'node:test';
import { accounts, createWorld } from './support/provisional-api.mjs';

const noUnexpected = (world) => assert.deepEqual(world.api.unexpectedErrors, []);

async function signedIn(world, account, options) {
  const browser = world.browser();
  await browser.login(account, options);
  return browser;
}

const choose = (attempt, questionId, ...optionIds) => ({ [questionId]: { option_ids: optionIds } });

test('free course journey: enroll, learn, pass the quiz after grading, complete once, one certificate', async () => {
  const world = createWorld();
  const learner = await signedIn(world, accounts.learner);
  const owner = await signedIn(world, accounts.instructorA);
  assert.equal((await learner.post('courses/crs_mock_001/enroll')).status, 201);

  const course = await learner.get('learn/courses/crs_mock_001');
  assert.equal(course.status, 200);
  assert.deepEqual(course.body.progress, { completed_items: 0, total_items: 3, completed_at: null });
  assert.equal(course.body.certificate_id, null);

  assert.equal((await learner.post('learn/items/itm_mock_001_1/complete')).status, 200);
  const article = await learner.post('learn/items/itm_mock_001_2/complete');
  assert.equal(article.body.progress.completed_items, 2);
  assert.equal(article.body.certificate_id, null);

  const started = await learner.post('learn/items/itm_mock_001_3/attempts');
  assert.equal(started.status, 201);
  assert.ok(!started.text.includes('correct_option'), 'the answer key never reaches the learner');
  const attemptId = started.body.id;
  await learner.put(`learn/attempts/${attemptId}/answers`, { answers: {
    ...choose(started.body, 'qst_mock_001_1', 'opt_001_1_b'),
    ...choose(started.body, 'qst_mock_001_2', 'opt_001_2_a', 'opt_001_2_c'),
    qst_mock_001_3: { text: 'แผนบทเรียนของฉัน' },
  } });
  const submitted = await learner.post(`learn/attempts/${attemptId}/submit`);
  assert.equal(submitted.body.status, 'pending_review');
  assert.equal(submitted.body.passed, null);
  assert.equal((await learner.get('learn/courses/crs_mock_001')).body.progress.completed_items, 2, 'a pending attempt completes nothing');
  assert.equal((await learner.get('me/certificates')).body.items.length, 0);

  const other = await signedIn(world, accounts.instructorB);
  assert.equal((await other.get('instructor/grading-queue')).body.items.length, 0);
  assert.ok([403, 404].includes((await other.put(`instructor/attempts/${attemptId}/questions/qst_mock_001_3/grade`, { score: 2, comment: null })).status));
  const admin = await signedIn(world, accounts.admin, { audience: 'admin' });
  assert.equal((await admin.put(`instructor/attempts/${attemptId}/questions/qst_mock_001_3/grade`, { score: 2, comment: null })).status, 403);
  assert.equal((await learner.put(`instructor/attempts/${attemptId}/questions/qst_mock_001_3/grade`, { score: 2, comment: null })).status, 403);

  const queue = await owner.get('instructor/grading-queue');
  assert.equal(queue.body.items.length, 1);
  assert.equal((await owner.put(`instructor/attempts/${attemptId}/questions/qst_mock_001_3/grade`, { score: 3, comment: null })).status, 422, 'score above the maximum');
  assert.equal((await owner.put(`instructor/attempts/${attemptId}/questions/qst_mock_001_3/grade`, { score: 2, comment: 'ดีมาก', passed: true })).status, 422, 'passed is server-owned');
  const graded = await owner.put(`instructor/attempts/${attemptId}/questions/qst_mock_001_3/grade`, { score: 2, comment: 'ดีมาก' });
  assert.equal(graded.body.status, 'graded');
  assert.equal(graded.body.passed, true);

  const done = await learner.get('learn/courses/crs_mock_001');
  assert.deepEqual(done.body.progress.completed_items, 3);
  assert.ok(done.body.progress.completed_at);
  const certificates = (await learner.get('me/certificates')).body.items;
  assert.equal(certificates.length, 1);
  assert.equal(done.body.certificate_id, certificates[0].id);
  for (let index = 0; index < 3; index += 1) {
    await learner.post('learn/items/itm_mock_001_1/complete');
    await learner.get('learn/courses/crs_mock_001');
  }
  assert.equal([...world.db.certificates.values()].length, 1, 'repeating commands never issues a second certificate');
  assert.equal((await other.get(`me/certificates/${certificates[0].id}`)).status, 404);
  assert.equal((await learner.get(`me/certificates/${certificates[0].id}/download`)).status, 200);

  const completedAt = done.body.progress.completed_at;
  world.db.courses.get('crs_mock_001').chapters[0].items.push({ id: 'itm_added_later', type: 'article', title: 'บทเสริม', body: 'เนื้อหาเสริม' });
  const after = await learner.get('learn/courses/crs_mock_001');
  assert.equal(after.body.progress.total_items, 4);
  assert.equal(after.body.progress.completed_at, completedAt, 'a course already completed stays completed');
  assert.equal((await learner.get('me/certificates')).body.items.length, 1);
  noUnexpected(world);
});

test('a failed or lower later attempt never undoes a pass; the highest graded attempt decides', async () => {
  const world = createWorld();
  const learner = await signedIn(world, accounts.learner);
  await learner.post('courses/crs_mock_001/enroll');
  // Make the quiz choice-only so attempts grade instantly: q1 (1 point) and q2 (1 point).
  const quiz = world.db.courses.get('crs_mock_001').chapters[0].items[2].quiz;
  quiz.questions = quiz.questions.filter((question) => question.type !== 'essay');

  const first = (await learner.post('learn/items/itm_mock_001_3/attempts')).body;
  await learner.put(`learn/attempts/${first.id}/answers`, { answers: { ...choose(first, 'qst_mock_001_1', 'opt_001_1_b'), ...choose(first, 'qst_mock_001_2', 'opt_001_2_a', 'opt_001_2_c') } });
  const passed = await learner.post(`learn/attempts/${first.id}/submit`);
  assert.deepEqual([passed.body.status, passed.body.earned, passed.body.max, passed.body.passed], ['graded', 2, 2, true]);
  const again = await learner.post(`learn/attempts/${first.id}/submit`);
  assert.deepEqual(again.body, passed.body, 'submitting twice returns the same result');

  const second = (await learner.post('learn/items/itm_mock_001_3/attempts')).body;
  assert.equal(second.number, 2);
  await learner.put(`learn/attempts/${second.id}/answers`, { answers: { ...choose(second, 'qst_mock_001_1', 'opt_001_1_a'), ...choose(second, 'qst_mock_001_2', 'opt_001_2_b') } });
  const worse = await learner.post(`learn/attempts/${second.id}/submit`);
  assert.deepEqual([worse.body.earned, worse.body.passed], [0, false]);
  const results = await learner.get('learn/items/itm_mock_001_3/results');
  assert.equal(results.body.best.attempt_id, first.id);
  assert.equal(results.body.completed, true);
  assert.equal((await learner.put(`learn/attempts/${first.id}/answers`, { answers: {} })).status, 409);
  noUnexpected(world);
});

test('paid course journey: checkout never grants; only a signed webhook does; the status page only reads', async () => {
  const world = createWorld();
  const learner = await signedIn(world, accounts.learner);
  const checkout = await learner.post('me/payments/checkout', { course_id: 'crs_mock_002', request_id: 'req-integration-1' });
  assert.equal(checkout.status, 201);
  const paymentId = checkout.body.payment_id;
  assert.equal((await learner.get('learn/courses/crs_mock_002')).status, 403, 'no access before the webhook');
  assert.equal((await learner.get(`me/payments/${paymentId}`)).body.enrollment, null);
  assert.equal([...world.db.enrollments.values()].length, 0);

  const forged = await learner.post('webhooks/stripe', JSON.stringify({ id: 'evt_forged', type: 'checkout.session.completed', data: { payment_id: paymentId } }), { 'stripe-signature': 'mock-sig:00000000' });
  assert.equal(forged.status, 400);
  const event = world.api.stripe.completed(paymentId);
  const webhook = await world.browser().post('webhooks/stripe', event.body, event.headers);
  assert.equal(webhook.status, 200);
  const status = await learner.get(`me/payments/${paymentId}`);
  assert.deepEqual([status.body.status, status.body.fulfillment_status, status.body.enrollment.source], ['succeeded', 'granted', 'stripe']);
  assert.equal((await learner.get('learn/courses/crs_mock_002')).status, 200);
  const replay = await world.browser().post('webhooks/stripe', event.body, event.headers);
  assert.equal(replay.body.duplicate, true);
  assert.equal([...world.db.enrollments.values()].length, 1);
  assert.equal((await learner.post('me/payments/checkout', { course_id: 'crs_mock_002', request_id: 'req-integration-2' })).body.already_enrolled, true);
  assert.equal([...world.db.payments.values()].length, 1);
  noUnexpected(world);
});

test('redeem answers never reveal whether a code exists and one code has exactly one winner', async () => {
  const world = createWorld();
  const unverified = await signedIn(world, accounts.unverified);
  const unknown = await unverified.post('me/redeem', { code: 'NOT-A-CODE' });
  const real = await unverified.post('me/redeem', { code: 'MOCK-UNUSED-0001' });
  assert.deepEqual([unknown.status, unknown.body.error.code], [real.status, real.body.error.code], 'account checks come before the code lookup');

  const admin = await signedIn(world, accounts.admin, { audience: 'admin' });
  const adminUnknown = await admin.post('me/redeem', { code: 'NOT-A-CODE' });
  const adminReal = await admin.post('me/redeem', { code: 'MOCK-UNUSED-0001' });
  assert.deepEqual([adminUnknown.status, adminUnknown.body.error.code], [adminReal.status, adminReal.body.error.code]);

  const first = await signedIn(world, accounts.learner);
  const second = await signedIn(world, accounts.adminCreatedLearner);
  const outcomes = await Promise.all([first.post('me/redeem', { code: 'mock-unused-0001' }), second.post('me/redeem', { code: 'MOCK-UNUSED-0001' })]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [201, 404]);
  const loser = outcomes.find((outcome) => outcome.status === 404);
  const revoked = await first.post('me/redeem', { code: 'MOCK-REVOKED-0001' });
  assert.equal(loser.body.error.message, revoked.body.error.message, 'used and revoked look the same as unknown');
  assert.equal([...world.db.enrollments.values()].length, 1);
  assert.equal([...world.db.enrollments.values()][0].source, 'redeem');

  const used = [...world.db.redeemCodes.values()].find((code) => code.status === 'used');
  assert.equal((await admin.post(`admin/redeem-codes/${used.id}/revoke`)).status, 409);
  assert.equal([...world.db.enrollments.values()].length, 1, 'revoking a used code never removes the enrollment');
  noUnexpected(world);
});

test('learner-facing responses never carry answer keys, private notes or AI transcripts', async () => {
  const world = createWorld();
  const learner = await signedIn(world, accounts.learner);
  await learner.post('courses/crs_mock_001/enroll');
  world.db.courses.get('crs_mock_001').chapters[0].items[0].ai_transcript = { text: 'TRANSCRIPT-MARKER', edited_by: 'usr_admin', edited_at: '2026-10-01T00:00:00Z' };
  const started = (await learner.post('learn/items/itm_mock_001_3/attempts')).body;
  const bodies = [
    await learner.get('learn/courses/crs_mock_001'),
    await learner.get('learn/courses/crs_mock_001/items/itm_mock_001_1'),
    await learner.get('learn/courses/crs_mock_001/items/itm_mock_001_2'),
    await learner.get('learn/courses/crs_mock_001/items/itm_mock_001_3'),
    await learner.get(`learn/attempts/${started.id}`),
    await learner.get('learn/items/itm_mock_001_3/results'),
    await learner.get('me/progress'),
    await learner.get('me/enrollments'),
    await learner.get('courses/crs_mock_001'),
  ];
  for (const { status, text } of bodies) {
    assert.equal(status, 200);
    for (const forbidden of ['correct_option', 'answer_key', 'internal_review_notes', 'TRANSCRIPT-MARKER', 'ai_transcript', 'SECRET internal', 'SECRET answer']) {
      assert.ok(!text.includes(forbidden), `leaked ${forbidden}`);
    }
  }
  noUnexpected(world);
});

test('authoring to catalog: a course is public only after review, approval and Admin publish; edits then show at once', async () => {
  const world = createWorld();
  const owner = await signedIn(world, accounts.instructorA);
  const admin = await signedIn(world, accounts.admin, { audience: 'admin' });
  const guest = world.browser();

  const created = await owner.post('instructor/courses', { title: 'คอร์สใหม่ของผู้สอน', category: 'การสอนออนไลน์', level: 'เริ่มต้น', price: null });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal(created.body.status, 'draft');
  assert.equal((await owner.post('instructor/courses', { title: 'x', status: 'published' })).status, 422);
  assert.equal((await owner.post('instructor/courses', { title: 'x', ai_enabled: true })).status, 422);

  const edited = await owner.patch(`courses/${id}`, {
    expected_revision: 1,
    chapters: [{ title: 'บทที่ 1', items: [
      { type: 'video', title: 'วิดีโอแนะนำ', video_url: 'https://youtu.be/dQw4w9WgXcQ' },
      { type: 'article', title: 'บทอ่าน', body: 'เนื้อหาบทอ่านเฉพาะผู้เรียน' },
    ] }],
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.revision, 2);
  assert.equal((await owner.patch(`courses/${id}`, { expected_revision: 1, title: 'stale' })).body.error.code, 'revision_conflict');
  assert.equal((await owner.patch(`courses/${id}`, { expected_revision: 2, chapters: [{ title: 'b', items: [{ type: 'video', title: 'v', video_url: 'https://evil.example/x' }] }] })).status, 422);
  assert.equal((await owner.post(`courses/${id}/videos/uploads`, {})).status, 503);

  const publicStatuses = async () => [(await guest.get(`courses/${id}`)).status, (await guest.get('courses')).body.items.some((course) => course.id === id)];
  assert.deepEqual(await publicStatuses(), [404, false]);
  assert.equal((await owner.post(`courses/${id}/publish`, {})).status, 403, 'Instructors cannot publish');

  const review = await owner.post(`courses/${id}/submit-review`, { expected_revision: 2 });
  assert.equal(review.status, 201);
  assert.deepEqual(await publicStatuses(), [404, false]);
  assert.equal((await owner.post(`admin/course-reviews/${review.body.id}/approve`, { expected_revision: 2 })).status, 403);
  assert.equal((await admin.post(`courses/${id}/publish`, {})).status, 409, 'cannot publish before approval');

  // Editing while pending makes the review stale: approval must fail and the course returns to draft.
  await owner.patch(`courses/${id}`, { expected_revision: 2, subtitle: 'เพิ่มคำโปรย' });
  assert.equal((await admin.post(`admin/course-reviews/${review.body.id}/approve`, { expected_revision: 3 })).status, 409);
  const second = await owner.post(`courses/${id}/submit-review`, { expected_revision: 3 });
  assert.equal((await admin.post(`admin/course-reviews/${second.body.id}/return`, { reason: 'ขอปรับคำอธิบาย' })).status, 200);
  assert.equal((await owner.get(`courses/${id}/authoring`)).body.latest_review.reason, 'ขอปรับคำอธิบาย');
  assert.deepEqual(await publicStatuses(), [404, false]);
  const third = await owner.post(`courses/${id}/submit-review`, { expected_revision: 3 });
  assert.equal((await admin.post(`admin/course-reviews/${third.body.id}/approve`, { expected_revision: 3 })).status, 200);
  assert.deepEqual(await publicStatuses(), [404, false], 'approved is still not public');
  assert.equal((await admin.post(`courses/${id}/publish`, {})).status, 200);

  const publicDetail = await guest.get(`courses/${id}`);
  assert.equal(publicDetail.status, 200);
  assert.deepEqual(publicDetail.body.outline[0].items.map((item) => Object.keys(item).sort().join()), ['id,title,type', 'id,title,type']);
  for (const hidden of ['video_url', 'dQw4w9WgXcQ', 'เนื้อหาบทอ่านเฉพาะผู้เรียน', 'internal_review_notes', 'revision', 'latest_review', 'ลับ']) assert.ok(!publicDetail.text.includes(hidden), hidden);

  const learner = await signedIn(world, accounts.learner);
  assert.equal((await learner.post(`courses/${id}/enroll`)).status, 201);
  const itemId = publicDetail.body.outline[0].items[1].id;
  assert.equal((await learner.get(`learn/courses/${id}/items/${itemId}`)).body.body, 'เนื้อหาบทอ่านเฉพาะผู้เรียน');

  assert.equal((await owner.patch(`courses/${id}`, { expected_revision: 3, title: 'ชื่อใหม่หลังเผยแพร่' })).status, 200);
  assert.equal((await guest.get(`courses/${id}`)).body.title, 'ชื่อใหม่หลังเผยแพร่', 'published edits are visible immediately');
  assert.equal((await owner.get(`courses/${id}/authoring`)).body.status, 'published');

  const stranger = await signedIn(world, accounts.instructorB);
  assert.equal((await stranger.get(`courses/${id}/authoring`)).status, 404);
  assert.equal((await stranger.patch(`courses/${id}`, { expected_revision: 4, title: 'hijack' })).status, 404);
  assert.equal([...world.db.progress.values()].length, 0, 'previews and reads never create progress');
  noUnexpected(world);
});

test('AI support: Admin-only switches and transcripts never reach learners, and the quota is enforced', async () => {
  const world = createWorld({ config: { aiDailyPromptLimit: 2 } });
  const admin = await signedIn(world, accounts.admin, { audience: 'admin' });
  const learner = await signedIn(world, accounts.learner);
  const owner = await signedIn(world, accounts.instructorA);
  await learner.post('courses/crs_mock_001/enroll');

  assert.equal((await owner.patch('admin/courses/crs_mock_001/ai-support', { ai_enabled: true })).status, 403);
  assert.equal((await learner.put('admin/courses/crs_mock_001/videos/itm_mock_001_1/ai-transcript', { text: 'x' })).status, 403);
  const before = { ...world.db.courses.get('crs_mock_001') };
  assert.equal((await learner.post('me/ai/conversations', { course_id: 'crs_mock_001' })).body.error.details.reason, 'ai_disabled');
  assert.equal((await admin.patch('admin/courses/crs_mock_001/ai-support', { ai_enabled: true })).status, 200);
  const course = world.db.courses.get('crs_mock_001');
  assert.deepEqual([course.status, course.revision, course.published_at], [before.status, before.revision, before.published_at]);
  const transcript = 'TRANSCRIPT-LINE-1\n00:01 TRANSCRIPT-LINE-2';
  assert.equal((await admin.put('admin/courses/crs_mock_001/videos/itm_mock_001_1/ai-transcript', { text: transcript })).body.text, transcript);
  assert.equal(world.db.courses.get('crs_mock_001').revision, before.revision, 'saving a transcript does not touch the course draft');

  const conversation = (await learner.post('me/ai/conversations', { course_id: 'crs_mock_001' })).body;
  const outputs = [];
  for (const [index, content] of ['สวัสดี', '/quiz บทที่ 1'].entries()) {
    outputs.push(await learner.post(`me/ai/conversations/${conversation.id}/messages`, { content, request_id: `request-number-${index + 1}` }));
  }
  assert.deepEqual(outputs.map((output) => output.status), [200, 200]);
  const practice = outputs[1].body.message;
  assert.equal(practice.kind, 'practice_set');
  assert.ok(!outputs[1].text.includes('correct_option') && !outputs[1].text.includes('explanation'), 'no key before answering');
  const quota = await learner.post(`me/ai/conversations/${conversation.id}/messages`, { content: 'อีกหนึ่งข้อ', request_id: 'request-number-3' });
  assert.equal(quota.status, 429);
  assert.equal(quota.body.error.code, 'ai_quota_exceeded');
  assert.equal((await learner.post(`me/ai/conversations/${conversation.id}/messages`, { content: 'สวัสดี', request_id: 'request-number-1' })).status, 200, 'a replayed request is served even over quota');
  assert.equal((await learner.get('me/ai/usage')).body.used, 2);

  const question = practice.practice.questions[0];
  const answered = await learner.put(`me/ai/conversations/${conversation.id}/messages/${practice.id}/practice/answers`, { question_id: question.id, option_id: question.options[0].id });
  assert.equal(answered.status, 200);
  assert.equal([...world.db.attempts.values()].length, 0);
  assert.equal((await learner.get('me/ai/usage')).body.used, 2, 'answering a practice question costs nothing');

  const responses = [
    await learner.get('learn/courses/crs_mock_001'), await learner.get('learn/courses/crs_mock_001/items/itm_mock_001_1'),
    await learner.get(`me/ai/conversations/${conversation.id}/messages`), await learner.get('me/ai/conversations'),
    await owner.get('courses/crs_mock_001/authoring'), await owner.get('courses/crs_mock_001/authoring-preview'),
    await world.browser().get('courses/crs_mock_001'),
  ];
  for (const { text } of responses) assert.ok(!text.includes('TRANSCRIPT-LINE'), 'transcript text only travels through the Admin transcript route');
  assert.equal((await owner.get('courses/crs_mock_001/authoring')).body.chapters[0].items[0].has_ai_transcript, true);
  const stranger = await signedIn(world, accounts.adminCreatedLearner);
  assert.equal((await stranger.get(`me/ai/conversations/${conversation.id}/messages`)).status, 404);
  assert.equal((await stranger.post('me/ai/conversations', { course_id: 'crs_mock_001' })).status, 403, 'AI context needs access to the course');
  noUnexpected(world);
});

test('Blog: only published posts are public and only Admin writes', async () => {
  const world = createWorld();
  const guest = world.browser();
  const list = await guest.get('blog');
  assert.deepEqual(list.body.items.map((post) => post.slug), ['mock-second-post', 'mock-first-post']);
  assert.ok(!list.text.includes('SECRET') && !list.text.includes('"content"'));
  assert.equal((await guest.get('blog/mock-secret-draft-post')).status, 404);
  assert.equal((await guest.get('blog/nothing')).status, 404);
  const learner = await signedIn(world, accounts.learner);
  const owner = await signedIn(world, accounts.instructorA);
  for (const browser of [learner, owner]) {
    assert.equal((await browser.post('admin/blog', { title: 'x', slug: 'xxx', content: 'c' })).status, 403);
    assert.equal((await browser.get('admin/blog')).status, 403);
  }
  const admin = await signedIn(world, accounts.admin, { audience: 'admin' });
  const draft = await admin.post('admin/blog', { title: 'บทความใหม่', slug: 'new-post', content: 'เนื้อหา' });
  assert.equal(draft.status, 201);
  assert.equal((await guest.get('blog/new-post')).status, 404);
  assert.equal((await admin.post('admin/blog', { title: 'ซ้ำ', slug: 'new-post', content: 'c' })).status, 409);
  assert.equal((await admin.post(`admin/blog/${draft.body.id}/publish`, {})).status, 200);
  assert.equal((await guest.get('blog/new-post')).body.content, 'เนื้อหา');
  await admin.patch(`admin/blog/${draft.body.id}`, { content: 'แก้แล้ว' });
  assert.equal((await guest.get('blog/new-post')).body.content, 'แก้แล้ว');
  noUnexpected(world);
});