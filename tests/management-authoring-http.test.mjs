import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, accounts } from './support/provisional-api.mjs';
import { authoringForm, authoringWrite } from '../packages/course-authoring/src/http-view.ts';
const doc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'หัวเรื่อง', marks: [{ type: 'bold' }] }],
    },
    { type: 'image', attrs: { src: 'https://example.test/image.png', align: 'wide', alt: 'ภาพ' } },
  ],
};
async function world() {
  const w = createWorld();
  const owner = w.browser();
  await owner.login(accounts.instructorA);
  const admin = w.browser();
  await admin.login(accounts.admin, { audience: 'admin' });
  const other = w.browser();
  await other.login(accounts.instructorB);
  return { ...w, owner, admin, other };
}
async function create(w) {
  const r = await w.owner.post('instructor/courses', {
    title: 'คอร์ส Editor',
    category: 'การเรียนรู้',
    level: 'เริ่มต้น',
  });
  assert.equal(r.status, 201, r.text);
  return r.body;
}
const chapter = () => ({
  title: 'บทใหม่',
  description: 'คำอธิบายบท',
  items: [
    { type: 'article', title: 'บทอ่าน', body: 'หัวเรื่อง', body_doc: doc },
    {
      type: 'quiz',
      title: 'แบบฝึกหัด',
      quiz: {
        pass_percent: 70,
        questions: [
          {
            type: 'single_choice',
            prompt: 'ตอบอะไร',
            prompt_doc: doc,
            points: 2,
            options: [{ text: 'ก' }, { text: 'ข' }],
            correct_option_indices: [1],
          },
          {
            type: 'essay',
            prompt: 'อธิบาย',
            response_mode: 'either',
            rubric: 'ความเข้าใจ',
            points: 2,
          },
        ],
      },
    },
  ],
});
test('form DTO roundtrip creates server IDs and preserves documents, order and answer keys', async () => {
  const w = await world();
  const c = await create(w);
  let r = await w.owner.patch('courses/' + c.id, { expected_revision: 1, chapters: [chapter()] });
  assert.equal(r.status, 200, r.text);
  const f = authoringForm(r.body);
  assert.deepEqual(f.course.chapters[0].items[0].articleDoc, doc);
  assert.equal(f.quizzes[0].questions[0].answer, 1);
  assert.equal(f.quizzes[0].passPercent, 70);
  assert.equal(f.quizzes[0].questions[1].rubric, 'ความเข้าใจ');
  const before = r.body;
  r = await w.owner.patch('courses/' + c.id, {
    expected_revision: 2,
    chapters: authoringWrite(f.course, f.quizzes, before),
  });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.body.chapters, before.chapters);
  assert.deepEqual(w.api.unexpectedErrors, []);
});
test('failed nested validation is atomic and stale writes do not overwrite metadata', async () => {
  const w = await world();
  const c = await create(w);
  const bad = await w.owner.patch('courses/' + c.id, {
    expected_revision: 1,
    title: 'ห้ามเปลี่ยน',
    chapters: [
      {
        title: 'บท',
        items: [{ type: 'video', title: 'ผิด', video_url: 'https://example.test/video' }],
      },
    ],
  });
  assert.equal(bad.status, 422);
  assert.equal((await w.owner.get('courses/' + c.id + '/authoring')).body.title, c.title);
  assert.equal(
    (await w.owner.patch('courses/' + c.id, { expected_revision: 1, title: 'ฉบับใหม่' })).status,
    200,
  );
  assert.equal(
    (await w.owner.patch('courses/' + c.id, { expected_revision: 1, title: 'ฉบับเก่า' })).status,
    409,
  );
  assert.equal((await w.owner.get('courses/' + c.id + '/authoring')).body.title, 'ฉบับใหม่');
});
test('server protects history from removal and quiz edits while accepting an unchanged saved definition', async () => {
  const w = await world();
  const c = await create(w);
  const saved = (
    await w.owner.patch('courses/' + c.id, { expected_revision: 1, chapters: [chapter()] })
  ).body;
  const quiz = saved.chapters[0].items[1];
  w.db.attempts.set('history', {
    id: 'history',
    item_id: quiz.id,
    course_id: c.id,
    user_id: 'user',
    enrollment_id: 'enr',
    status: 'in_progress',
    snapshot: [],
    answers: {},
    grades: {},
  });
  const f = authoringForm(saved);
  const unchanged = await w.owner.patch('courses/' + c.id, {
    expected_revision: 2,
    chapters: authoringWrite(f.course, f.quizzes, saved),
  });
  assert.equal(unchanged.status, 200, unchanged.text);
  f.quizzes[0].questions[0].prompt = 'โจทย์ใหม่';
  assert.equal(
    (
      await w.owner.patch('courses/' + c.id, {
        expected_revision: 3,
        chapters: authoringWrite(f.course, f.quizzes, saved),
      })
    ).status,
    409,
  );
  assert.equal(
    (await w.owner.patch('courses/' + c.id, { expected_revision: 3, chapters: [] })).status,
    409,
  );
});
test('new choices reject ambiguous/invalid answer indices and foreign or duplicated resource IDs', async () => {
  const w = await world();
  const c = await create(w);
  const ch = chapter();
  ch.items[1].quiz.questions[0].correct_option_indices = [1, 1];
  assert.equal(
    (await w.owner.patch('courses/' + c.id, { expected_revision: 1, chapters: [ch] })).status,
    422,
  );
  ch.items[1].quiz.questions[0].correct_option_indices = [2];
  assert.equal(
    (await w.owner.patch('courses/' + c.id, { expected_revision: 1, chapters: [ch] })).status,
    422,
  );
  const valid = (
    await w.owner.patch('courses/' + c.id, { expected_revision: 1, chapters: [chapter()] })
  ).body;
  const duplicate = { title: 'Duplicate', items: [valid.chapters[0].items[0]] };
  const f = authoringForm(valid);
  const write = authoringWrite(f.course, f.quizzes, valid);
  assert.equal(
    (
      await w.owner.patch('courses/' + c.id, {
        expected_revision: 2,
        chapters: [...write, duplicate],
      })
    ).status,
    422,
  );
  assert.equal((await w.other.get('managed-quizzes/' + valid.chapters[0].items[1].id)).status, 404);
});
test('management read models enforce role/ownership and do not leak secrets to public instructor profiles', async () => {
  const w = await world();
  const summary = await w.admin.get('admin/summary');
  assert.equal(summary.status, 200);
  assert.equal(summary.body.user_count, w.db.users.size);
  const users = await w.admin.get('admin/users');
  assert.ok(users.body.items.every((u) => u.roles && u.status && u.created_at));
  assert.ok(!users.text.includes('password'));
  const learner = users.body.items.find(
    (u) => u.roles.includes('learner') && !u.roles.includes('instructor'),
  );
  assert.equal((await w.owner.get('admin/users/' + learner.id)).status, 403);
  const role = await w.admin.post('admin/users/' + learner.id + '/instructor', {});
  assert.equal(role.status, 200);
  assert.ok(
    role.body.user.roles.includes('learner') && role.body.user.roles.includes('instructor'),
  );
  const own = (await w.owner.get('instructor/courses')).body.items[0];
  assert.equal((await w.other.get('courses/' + own.id + '/learners')).status, 404);
  assert.equal((await w.admin.get('courses/' + own.id + '/learners')).status, 200);
  const pub = await w.browser().get('instructors/' + own.instructor.id);
  assert.equal(pub.status, 200);
  for (const key of ['email', 'username', 'roles', 'password', 'phone', 'birthDate'])
    assert.equal(key in pub.body, false);
  assert.ok(
    (await w.browser().get('instructors/' + own.instructor.id + '/courses')).body.items.every(
      (c) => c.published_at,
    ),
  );
  assert.deepEqual(w.api.unexpectedErrors, []);
});
test('owner may publish only after current approval and cannot publish another owner course', async () => {
  const w = await world();
  const c = await create(w);
  const saved = (
    await w.owner.patch('courses/' + c.id, { expected_revision: 1, chapters: [chapter()] })
  ).body;
  assert.equal((await w.owner.post('courses/' + c.id + '/publish', {})).status, 409);
  const review = await w.owner.post('courses/' + c.id + '/submit-review', {
    expected_revision: saved.revision,
  });
  assert.equal(review.status, 201);
  assert.equal(
    (
      await w.admin.post('admin/course-reviews/' + review.body.id + '/approve', {
        expected_revision: saved.revision,
      })
    ).status,
    200,
  );
  assert.equal((await w.other.post('courses/' + c.id + '/publish', {})).status, 404);
  assert.equal((await w.owner.post('courses/' + c.id + '/publish', {})).status, 200);
  assert.equal((await w.browser().get('courses/' + c.id)).status, 200);
});
test('Blog rich draft remains private, publishes complete content, protects stale writes and can return to draft/delete', async () => {
  const w = await world();
  const created = await w.admin.post('admin/blog', {
    title: 'บทความ',
    slug: 'rich-article',
    category: 'การเรียนรู้',
    content: 'หัวเรื่อง',
    content_doc: doc,
  });
  assert.equal(created.status, 201, created.text);
  const post = created.body;
  assert.deepEqual((await w.admin.get('admin/blog/' + post.id + '/preview')).body.content_doc, doc);
  assert.equal((await w.browser().get('blog/rich-article')).status, 404);
  const publish = await w.admin.post('admin/blog/' + post.id + '/publish', {
    expected_revision: post.revision,
  });
  assert.equal(publish.status, 200, publish.text);
  const pub = await w.browser().get('blog/rich-article');
  assert.deepEqual(pub.body.content_doc, doc);
  assert.equal(pub.body.category, 'การเรียนรู้');
  assert.ok(pub.body.author.display_name);
  assert.equal(
    (
      await w.admin.patch('admin/blog/' + post.id, {
        expected_revision: post.revision,
        title: 'stale',
      })
    ).status,
    409,
  );
  const back = await w.admin.post('admin/blog/' + post.id + '/unpublish', {
    expected_revision: publish.body.revision,
  });
  assert.equal(back.status, 200);
  assert.equal((await w.browser().get('blog/rich-article')).status, 404);
  assert.equal(
    (
      await w.admin.patch('admin/blog/' + post.id, {
        expected_revision: back.body.revision,
        slug: 'changed-slug',
      })
    ).status,
    409,
  );
  assert.equal((await w.owner.call('DELETE', 'admin/blog/' + post.id, {})).status, 403);
  assert.equal(
    (
      await w.admin.call('DELETE', 'admin/blog/' + post.id, {
        expected_revision: back.body.revision,
      })
    ).status,
    200,
  );
  assert.equal((await w.admin.get('admin/blog/' + post.id + '/preview')).status, 404);
  assert.deepEqual(w.api.unexpectedErrors, []);
});
test('Blog rejects missing title and unsafe rich document URLs without partial writes', async () => {
  const w = await world();
  assert.equal(
    (await w.admin.post('admin/blog', { slug: 'missing-title', content: 'c' })).status,
    422,
  );
  assert.equal(
    (await w.admin.post('admin/blog', { title: 'x'.repeat(121), slug: 'long-title', content: 'c' }))
      .status,
    422,
  );
  const unsafe = {
    type: 'doc',
    content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }],
  };
  assert.equal(
    (
      await w.admin.post('admin/blog', {
        title: 'x',
        slug: 'unsafe-content',
        content: 'c',
        content_doc: unsafe,
      })
    ).status,
    422,
  );
  assert.deepEqual(w.api.unexpectedErrors, []);
});
