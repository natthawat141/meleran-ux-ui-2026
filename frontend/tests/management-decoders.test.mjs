import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeManagementResponse as decode } from '../packages/contracts/src/management-decoders.ts';
import { restoreQuizDraft } from '../packages/course-authoring/src/quiz-draft.ts';
import { createWorld, accounts } from './support/provisional-api.mjs';
import { createHttpClient, HttpClientError } from '../packages/api-client/src/index.ts';

test('canonical QuizResults preserves pending nulls and fractional result; rejects score leakage fields', () => {
  const attempt={attempt_id:'a',number:1,status:'pending_review',submitted_at:'2026-10-11T00:00:00Z',graded_at:null,earned:null,max:3.75,percent:null,passed:null};
  const results={attempts:[attempt],best:null,completed:false};
  assert.doesNotThrow(()=>decode('learn/items/q/results','GET',results));
  assert.throws(()=>decode('learn/items/q/results','GET',{...results,attempts:[{...attempt,correct_key:['x']}]}));
  assert.throws(()=>decode('learn/items/q/results','GET',{...results,attempts:[{...attempt,max:'3.75'}]}));
});
test('canonical zero-point manual question and grade decode without positive-only assumption', () => {
  const queue={items:[{attempt_id:'a',course_id:'c',item_id:'i',user_id:'u',learner_display_name:'Learner',submitted_at:'2026-10-11T00:00:00Z',
    questions_to_grade:[{question_id:'q',type:'image',prompt:'Image',max:0,answer:{image_url:'https://example.test/a.png'}}]}],next_cursor:null};
  assert.doesNotThrow(()=>decode('instructor/grading-queue','GET',queue));
});

async function context() {
  const w = createWorld();
  const owner = w.browser(),
    admin = w.browser(),
    learner = w.browser();
  await owner.login(accounts.instructorA);
  await admin.login(accounts.admin, { audience: 'admin' });
  await learner.login(accounts.learner);
  const read = async (browser, path, method = 'GET', body) => {
    const r = await browser.call(method, path, body);
    assert.ok([200, 201].includes(r.status), path);
    assert.doesNotThrow(() => decode(path, method, r.body), path);
    return r.body;
  };
  return { ...w, owner, admin, learner, read };
}
test('real scoped summaries, account details, authoring, public profiles and transcript responses decode', async () => {
  const w = await context();
  await w.read(w.admin, 'admin/summary');
  await w.read(w.owner, 'instructor/summary');
  const users = await w.read(w.admin, 'admin/users?limit=50');
  await w.read(w.admin, 'admin/instructors');
  for (const u of users.items) await w.read(w.admin, 'admin/users/' + u.id);
  for (const role of ['admin', 'instructor']) {
    const browser = role === 'admin' ? w.admin : w.owner;
    const courses = await w.read(browser, role + '/courses');
    for (const course of courses.items) {
      const full = await w.read(browser, 'courses/' + course.id + '/authoring');
      await w.read(browser, 'courses/' + course.id + '/learners');
      await w.read(browser, 'courses/' + course.id + '/attempts');
      for (const i of full.chapters.flatMap((c) => c.items)) {
        if (i.type === 'quiz') await w.read(browser, 'managed-quizzes/' + i.id);
        if (role === 'admin' && i.type === 'video')
          await w.read(w.admin, `admin/courses/${course.id}/videos/${i.id}/ai-transcript`);
      }
    }
  }
  const ownerId = w.db.courses.get('crs_mock_001').instructor_id;
  await w.read(w.browser(), 'instructors/' + ownerId);
  await w.read(w.browser(), 'instructors/' + ownerId + '/courses');
  await w.read(w.admin, 'admin/blog');
  await w.read(w.browser(), 'blog');
  for (const u of users.items) {
    await w.read(w.admin, `admin/users/${u.id}/enrollments`);
    await w.read(w.admin, `admin/users/${u.id}/attempts`);
  }
});
test('pending/graded attempt and roster response checks accept the full server-owned grading journey', async () => {
  const w = await context();
  await w.learner.post('courses/crs_mock_001/enroll');
  const start = await w.learner.post('learn/items/itm_mock_001_3/attempts');
  assert.equal(start.status, 201);
  await w.learner.put(`learn/attempts/${start.body.id}/answers`, {
    answers: {
      qst_mock_001_1: { option_ids: ['opt_001_1_b'] },
      qst_mock_001_2: { option_ids: ['opt_001_2_a', 'opt_001_2_c'] },
      qst_mock_001_3: { text: 'answer' },
    },
  });
  assert.equal((await w.learner.post(`learn/attempts/${start.body.id}/submit`)).status, 200);
  await w.read(w.owner, 'instructor/grading-queue');
  const before = await w.read(w.owner, 'instructor/attempts/' + start.body.id);
  assert.equal(before.passed, null);
  const grade = await w.read(
    w.owner,
    `instructor/attempts/${start.body.id}/questions/qst_mock_001_3/grade`,
    'PUT',
    { score: 2, comment: null },
  );
  assert.equal(grade.status, 'graded');
  assert.equal(grade.passed, true);
  await w.read(w.owner, 'instructor/attempts/' + start.body.id);
  await w.read(w.admin, 'courses/crs_mock_001/attempts');
  await w.read(w.owner, 'courses/crs_mock_001/learners');
  assert.deepEqual(w.api.unexpectedErrors, []);
});
test('malformed nested DTO fields and unregistered operations are rejected before HTTP success reaches UI', async () => {
  const w = await context();
  const full = (await w.owner.get('courses/crs_mock_001/authoring')).body;
  const cases = [
    (v) => (v.revision = '2'),
    (v) => (v.created_at = 'yesterday'),
    (v) => (v.instructor.avatar_url = 23),
    (v) => (v.price = { amount_minor: -1, currency: 'THB' }),
    (v) => (v.chapters[0].items[0].has_history = 'false'),
    (v) =>
      (v.chapters[0].items.find((i) => i.type === 'quiz').quiz.questions[0].correct_option_ids = [
        'foreign',
      ]),
    (v) => v.chapters.push(structuredClone(v.chapters[0])),
  ];
  for (const mutate of cases) {
    const bad = structuredClone(full);
    mutate(bad);
    assert.throws(() => decode('courses/x/authoring', 'GET', bad), TypeError);
  }
  const user = (await w.admin.get('admin/users')).body;
  for (const mutate of [
    (v) => (v.items[0].roles = ['superadmin']),
    (v) => (v.items[0].email_verified = 'true'),
    (v) => (v.next_cursor = 3),
  ]) {
    const bad = structuredClone(user);
    mutate(bad);
    assert.throws(() => decode('admin/users', 'GET', bad), TypeError);
  }
  assert.throws(() => decode('unknown-operation', 'GET', {}), /Unregistered/);
  const http = createHttpClient({
    baseUrl: '/api/v1',
    headers: {},
    credentials: 'omit',
    timeoutMs: null,
    fetcher: async () =>
      new Response(JSON.stringify({ ...full, revision: null }), {
        headers: { 'content-type': 'application/json' },
      }),
  });
  await assert.rejects(
    http.request('courses/x/authoring', {
      decoder: (v) => decode('courses/x/authoring', 'GET', v),
    }),
    (e) => e instanceof HttpClientError && e.kind === 'invalid_payload',
  );
});
test('quiz draft restoration preserves incomplete work and rejects stale, corrupt and malformed storage', () => {
  const values = {
    title: '',
    courseId: 'course',
    chapterId: 'chapter',
    passPercent: 70,
    questions: [
      { id: 'q', type: 'choice', prompt: '', points: 1, options: ['', ''], responseMode: 'either' },
    ],
  };
  const raw = JSON.stringify({ baseline: 'current', values });
  assert.deepEqual(restoreQuizDraft(raw, 'current'), values);
  assert.equal(restoreQuizDraft(raw, 'changed'), null);
  assert.equal(restoreQuizDraft('{bad', 'current'), null);
  for (const change of [
    (v) => (v.questions = [null]),
    (v) => (v.questions[0].options = {}),
    (v) => (v.questions[0].type = 'unknown'),
    (v) => (v.questions[0].points = '1'),
    (v) => (v.passPercent = 50),
    (v) => v.questions.push({ ...v.questions[0] }),
  ]) {
    const bad = structuredClone(values);
    change(bad);
    assert.equal(
      restoreQuizDraft(JSON.stringify({ baseline: 'current', values: bad }), 'current'),
      null,
    );
  }
  const emptyNumber = structuredClone(values);
  emptyNumber.questions[0].points = null;
  assert.equal(
    restoreQuizDraft(JSON.stringify({ baseline: 'current', values: emptyNumber }), 'current')
      .questions[0].points,
    0,
  );
});

test('canonical authoring preview accepts minimal draft content without management audit fields', () => {
  const preview = {
    id: 'course', title: 'Draft', revision: 1,
    chapters: [{ id: 'chapter', title: '', items: [
      { id: 'video', type: 'video', title: '', has_history: false },
      { id: 'article', type: 'article', title: '', has_history: false, reading_minutes: 0.5 },
      { id: 'quiz', type: 'quiz', title: '', has_history: false, quiz: {
        pass_percent: 70, questions: [{ id: 'question', type: 'single_choice', prompt: 'Q', points: 1,
          options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }],
      } },
    ] }],
  };
  assert.equal(decode('courses/course/authoring-preview', 'GET', preview), preview);
  for (const mutate of [
    (v) => { v.created_by = 'actor'; },
    (v) => { v.chapters[0].items[2].quiz.questions[0].correct_option_ids = ['a']; },
    (v) => { v.chapters[0].items.push(structuredClone(v.chapters[0].items[0])); },
    (v) => { v.revision = 0; },
  ]) {
    const invalid = structuredClone(preview);
    mutate(invalid);
    assert.throws(() => decode('courses/course/authoring-preview', 'GET', invalid), TypeError);
  }
});

test('review queue and detail decode canonical submitted course shapes and reject missing or corrupt revision/content', async () => {
  const w = await context();
  const courses = await w.read(w.owner, 'instructor/courses');
  const summaryCourse = courses.items[0];
  const full = await w.read(w.owner, 'courses/' + summaryCourse.id + '/authoring');
  const review = { id: 'review', revision: full.revision, status: 'pending', submitted_by: full.instructor.id,
    submitted_at: '2026-10-11T00:00:00.000Z', decided_by: null, decided_at: null, reason: null };
  const page = { items: [{ ...review, course: summaryCourse }], next_cursor: null };
  const detail = { ...review, course: full };
  assert.equal(decode('admin/course-reviews?status=pending', 'GET', page), page);
  assert.equal(decode('admin/course-reviews/review', 'GET', detail), detail);
  for (const change of [
    (v) => { delete v.course; },
    (v) => { v.status = 'unknown'; },
    (v) => { v.course.revision = 0; },
    (v) => { v.course.chapters = 'invalid'; },
  ]) {
    const invalid = structuredClone(detail); change(invalid);
    assert.throws(() => decode('admin/course-reviews/review', 'GET', invalid), TypeError);
  }
  const invalidPage = structuredClone(page); invalidPage.items[0].submitted_at = 'invalid';
  assert.throws(() => decode('admin/course-reviews', 'GET', invalidPage), TypeError);
});
