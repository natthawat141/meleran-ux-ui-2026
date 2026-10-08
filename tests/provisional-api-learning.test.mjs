import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from './support/provisional-api.mjs';

async function enrolledWorld() {
  const world = createWorld();
  const learner = world.browser();
  await learner.login('learner@example.test');
  assert.equal((await learner.post('courses/crs_mock_001/enroll')).status, 201);
  return { world, learner };
}

function quizWithoutEssay(course) {
  const quiz = course.chapters[0].items.find((item) => item.type === 'quiz');
  quiz.quiz.questions = quiz.quiz.questions.filter((question) => question.type !== 'essay');
  return quiz;
}

test('learning access gates guest, unverified learner, admin and unenrolled learner', async () => {
  const world = createWorld();
  const guest = world.browser();
  assert.equal((await guest.get('learn/courses/crs_mock_001')).status, 401);
  const unverified = world.browser();
  await unverified.login('unverified@example.test');
  assert.equal((await unverified.get('learn/courses/crs_mock_001')).body.error.code, 'email_not_verified');
  const admin = world.browser();
  await admin.login('admin', { audience: 'admin' });
  assert.equal((await admin.get('learn/courses/crs_mock_001')).body.error.code, 'forbidden');
  const learner = world.browser();
  await learner.login('learner@example.test');
  assert.equal((await learner.get('learn/courses/crs_mock_001')).body.error.code, 'forbidden');
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('viewing does not create progress, while completion is idempotent and quiz completion is rejected', async () => {
  const { world, learner } = await enrolledWorld();
  const before = world.db.progress.size;
  assert.equal((await learner.get('learn/courses/crs_mock_001')).status, 200);
  assert.equal((await learner.get('learn/courses/crs_mock_001/items/itm_mock_001_2')).status, 200);
  assert.equal(world.db.progress.size, before);
  const complete = await learner.post('learn/items/itm_mock_001_2/complete');
  assert.equal(complete.status, 200);
  const again = await learner.post('learn/items/itm_mock_001_2/complete');
  assert.equal(again.body.completed_at, complete.body.completed_at);
  const quiz = await learner.post('learn/items/itm_mock_001_3/complete');
  assert.equal(quiz.status, 409);
  assert.equal(quiz.body.error.details.reason, 'quiz_requires_attempt');
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('stores resume and returns the latest resume item and progress denominator', async () => {
  const { world, learner } = await enrolledWorld();
  const course = world.db.courses.get('crs_mock_001');
  course.chapters[0].items.splice(0, 1, { id: 'itm_extra_video', type: 'video', title: 'เพิ่มวิดีโอ', video_url: 'https://example.test/video' });
  const resume = await learner.put('learn/items/itm_extra_video/resume', { position_seconds: 12 });
  assert.equal(resume.status, 200);
  assert.equal(resume.body.resume.position_seconds, 12);
  await learner.post('learn/items/itm_mock_001_1/complete');
  await learner.post('learn/items/itm_mock_001_2/complete');
  const progress = await learner.get('me/progress');
  assert.equal(progress.body.items[0].progress.total_items, 3);
  assert.equal(progress.body.items[0].resume_item_id, 'itm_extra_video');
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('freezes the quiz snapshot and rejects answer keys from learner responses', async () => {
  const { world, learner } = await enrolledWorld();
  const quiz = quizWithoutEssay(world.db.courses.get('crs_mock_001'));
  const started = await learner.post(`learn/items/${quiz.id}/attempts`);
  assert.equal(started.status, 201);
  world.db.courses.get('crs_mock_001').chapters[0].items.find((item) => item.id === quiz.id).quiz.questions[0].prompt = 'CHANGED SECRET';
  assert.equal(started.body.questions[0].prompt.includes('CHANGED'), false);
  assert.equal(JSON.stringify(started.body).includes('correct_option_ids'), false);
  assert.equal(JSON.stringify(await learner.get(`learn/attempts/${started.body.id}`)).includes('SECRET'), false);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('auto-grades choices, makes exact 70 percent fail, and accepts 71 percent', async () => {
  const { world, learner } = await enrolledWorld();
  const course = world.db.courses.get('crs_mock_001');
  const quiz = quizWithoutEssay(course);
  quiz.quiz.questions[0].points = 70;
  quiz.quiz.questions[1].points = 30;
  quiz.quiz.questions.push({
    id: 'qst_extra', type: 'single_choice', prompt: 'เพิ่มข้อ', points: 1,
    options: [{ id: 'extra_yes', text: 'ใช่' }, { id: 'extra_no', text: 'ไม่ใช่' }],
    correct_option_ids: ['extra_yes'],
  });
  const start = async () => (await learner.post(`learn/items/${quiz.id}/attempts`)).body;
  const submit = async (first, second, third) => {
    const attempt = await start();
    await learner.put(`learn/attempts/${attempt.id}/answers`, {
      answers: {
        [quiz.quiz.questions[0].id]: { option_ids: [first] },
        [quiz.quiz.questions[1].id]: { option_ids: Array.isArray(second) ? second : [second] },
        [quiz.quiz.questions[2].id]: { option_ids: [third] },
      },
    });
    return learner.post(`learn/attempts/${attempt.id}/submit`);
  };
  const exact = await submit('opt_001_1_b', 'opt_001_2_b', 'extra_no');
  assert.equal(exact.body.earned, 70);
  assert.equal(exact.body.passed, false);
  const above = await submit('opt_001_1_b', 'opt_001_2_b', 'extra_yes');
  assert.equal(above.body.earned, 71);
  assert.equal(above.body.passed, true);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('resubmit is idempotent and submitted answers cannot be changed', async () => {
  const { world, learner } = await enrolledWorld();
  const quiz = quizWithoutEssay(world.db.courses.get('crs_mock_001'));
  const attempt = (await learner.post(`learn/items/${quiz.id}/attempts`)).body;
  await learner.put(`learn/attempts/${attempt.id}/answers`, {
    answers: {
      [quiz.quiz.questions[0].id]: { option_ids: ['opt_001_1_b'] },
      [quiz.quiz.questions[1].id]: { option_ids: ['opt_001_2_a', 'opt_001_2_c'] },
    },
  });
  const first = await learner.post(`learn/attempts/${attempt.id}/submit`);
  const second = await learner.post(`learn/attempts/${attempt.id}/submit`);
  assert.deepEqual(second.body, first.body);
  assert.equal((await learner.put(`learn/attempts/${attempt.id}/answers`, { answers: {} })).status, 409);
  assert.equal(world.db.attempts.size, 1);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('essay attempts wait for owner grading and do not complete the quiz early', async () => {
  const { world, learner } = await enrolledWorld();
  const quiz = world.db.courses.get('crs_mock_001').chapters[0].items.find((item) => item.type === 'quiz');
  const attempt = (await learner.post(`learn/items/${quiz.id}/attempts`)).body;
  await learner.put(`learn/attempts/${attempt.id}/answers`, {
    answers: {
      [quiz.quiz.questions[0].id]: { option_ids: ['opt_001_1_b'] },
      [quiz.quiz.questions[1].id]: { option_ids: ['opt_001_2_a', 'opt_001_2_c'] },
      [quiz.quiz.questions[2].id]: { text: 'คำตอบ' },
    },
  });
  const submitted = await learner.post(`learn/attempts/${attempt.id}/submit`);
  assert.equal(submitted.body.status, 'pending_review');
  assert.equal(submitted.body.earned, null);
  assert.equal((await learner.get(`learn/items/${quiz.id}/results`)).body.completed, false);
  const instructor = world.browser();
  await instructor.login('instructor-a@example.test');
  const queue = await instructor.get('instructor/grading-queue');
  assert.equal(queue.body.items.length, 1);
  const grade = await instructor.put(`instructor/attempts/${attempt.id}/questions/${quiz.quiz.questions[2].id}/grade`, { score: 2, comment: 'ดี' });
  assert.equal(grade.body.status, 'graded');
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('certificate is private, downloadable and issued once after full completion', async () => {
  const { world, learner } = await enrolledWorld();
  const course = world.db.courses.get('crs_mock_001');
  const quiz = quizWithoutEssay(course);
  await learner.post('learn/items/itm_mock_001_1/complete');
  await learner.post('learn/items/itm_mock_001_2/complete');
  const attempt = (await learner.post(`learn/items/${quiz.id}/attempts`)).body;
  await learner.put(`learn/attempts/${attempt.id}/answers`, {
    answers: {
      [quiz.quiz.questions[0].id]: { option_ids: ['opt_001_1_b'] },
      [quiz.quiz.questions[1].id]: { option_ids: ['opt_001_2_a', 'opt_001_2_c'] },
    },
  });
  await learner.post(`learn/attempts/${attempt.id}/submit`);
  const certs = await learner.get('me/certificates');
  assert.equal(certs.body.items.length, 1);
  const download = await learner.get(`me/certificates/${certs.body.items[0].id}/download`);
  assert.equal(download.body.content_type, 'text/plain');
  assert.equal((await learner.get('me/certificates')).body.items.length, 1);
  const other = world.browser();
  await other.login('learner-admin');
  assert.equal((await other.get(`me/certificates/${certs.body.items[0].id}`)).status, 404);
  assert.deepEqual(world.api.unexpectedErrors, []);
});
