import assert from 'node:assert/strict';
import test from 'node:test';
import { accounts, createWorld, mockPassword } from './support/provisional-api.mjs';

async function loggedIn(world, identifier, audience = 'web') {
  const browser = world.browser();
  await browser.login(identifier, { audience, password: mockPassword });
  return browser;
}

const chapter = (title = 'บทแรก') => ({
  title,
  items: [
    { type: 'video', title: 'วิดีโอ', video_url: 'https://youtu.be/ABCDEFGHIJK' },
    { type: 'article', title: 'บทอ่าน', body: 'เนื้อหา' },
  ],
});

async function createCourse(world, owner = accounts.instructorA) {
  const instructor = await loggedIn(world, owner);
  const created = await instructor.post('instructor/courses', {
    title: 'คอร์สทดสอบ', category: 'เทคโนโลยี', level: 'เริ่มต้น', outcomes: [],
  });
  assert.equal(created.status, 201, created.text);
  const patched = await instructor.patch(`courses/${created.body.id}`, { expected_revision: 1, chapters: [chapter()] });
  assert.equal(patched.status, 200, patched.text);
  return { instructor, course: patched.body };
}

test('authoring creation rejects server-owned fields and enforces ownership visibility', async () => {
  const world = createWorld();
  const instructor = await loggedIn(world, accounts.instructorA);
  for (const field of ['status', 'published_at', 'revision', 'ai_enabled', 'instructor_id']) {
    const response = await instructor.post('instructor/courses', { title: 'x', [field]: field === 'revision' ? 9 : 'x' });
    assert.equal(response.status, 422, field);
  }
  const created = await instructor.post('instructor/courses', { title: 'ของฉัน' });
  assert.equal(created.status, 201);
  const other = await loggedIn(world, accounts.instructorB);
  assert.equal((await other.get(`courses/${created.body.id}/authoring`)).status, 404);
  const admin = await loggedIn(world, accounts.admin, 'admin');
  assert.equal((await admin.get(`courses/${created.body.id}/authoring`)).status, 200);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('nested replacement validates YouTube and answer keys, then preserves existing IDs', async () => {
  const world = createWorld();
  const { instructor, course } = await createCourse(world);
  const before = await instructor.get(`courses/${course.id}/authoring`);
  const savedChapter = before.body.chapters[0];
  const savedItem = savedChapter.items[0];
  const badVideo = await instructor.patch(`courses/${course.id}`, {
    expected_revision: before.body.revision,
    chapters: [{ title: 'ใหม่', items: [{ type: 'video', title: 'ผิด', video_url: 'https://example.test/video' }] }],
  });
  assert.equal(badVideo.status, 422);
  const badKey = await instructor.patch(`courses/${course.id}`, {
    expected_revision: before.body.revision,
    chapters: [{ ...chapter(), items: [{ type: 'quiz', title: 'แบบฝึกหัด', quiz: {
      questions: [{ type: 'single_choice', prompt: 'q', points: 1, options: [{ text: 'a' }, { text: 'b' }], correct_option_ids: ['missing'] }],
    } }] }],
  });
  assert.equal(badKey.status, 422);
  const replacement = await instructor.patch(`courses/${course.id}`, {
    expected_revision: before.body.revision,
    chapters: [{ id: savedChapter.id, title: 'บทแก้', items: [{ id: savedItem.id, type: 'video', title: 'วิดีโอแก้', video_url: 'https://youtu.be/ABCDEFGHIJK' }] }],
  });
  assert.equal(replacement.status, 200, replacement.text);
  assert.equal(replacement.body.chapters[0].id, savedChapter.id);
  assert.equal(replacement.body.chapters[0].items[0].id, savedItem.id);
  assert.equal((await instructor.patch(`courses/${course.id}`, { expected_revision: before.body.revision, title: 'ชนกัน' })).status, 409);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('preview and upload are side-effect free and preview hides answer keys', async () => {
  const world = createWorld();
  const { instructor, course } = await createCourse(world);
  const before = { enrollments: world.db.enrollments.size, progress: world.db.progress.size, attempts: world.db.attempts.size, certificates: world.db.certificates.size };
  const preview = await instructor.get(`courses/${course.id}/authoring-preview`);
  assert.equal(preview.status, 200);
  assert.equal(JSON.stringify(preview.body).includes('correct_option_ids'), false);
  assert.equal(JSON.stringify(preview.body).includes('ABCDEFGHIJK'), true);
  assert.deepEqual({ enrollments: world.db.enrollments.size, progress: world.db.progress.size, attempts: world.db.attempts.size, certificates: world.db.certificates.size }, before);
  const upload = await instructor.post(`courses/${course.id}/videos/uploads`, {});
  assert.equal(upload.status, 503);
  assert.equal(world.db.courses.get(course.id).revision, course.revision);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('course lifecycle hides every pre-publish state from public catalog', async () => {
  const world = createWorld();
  const { instructor, course } = await createCourse(world);
  const admin = await loggedIn(world, accounts.admin, 'admin');
  assert.equal((await world.browser().get('courses')).body.items.some((item) => item.id === course.id), false);
  const submitted = await instructor.post(`courses/${course.id}/submit-review`, { expected_revision: course.revision });
  assert.equal(submitted.status, 201);
  assert.equal((await world.browser().get(`courses/${course.id}`)).status, 404);
  const approved = await admin.post(`admin/course-reviews/${submitted.body.id}/approve`, { expected_revision: course.revision });
  assert.equal(approved.status, 200);
  assert.equal((await world.browser().get(`courses/${course.id}`)).status, 404);
  const published = await admin.post(`courses/${course.id}/publish`, {});
  assert.equal(published.status, 200);
  assert.equal((await world.browser().get(`courses/${course.id}`)).status, 200);
  assert.ok((await world.browser().get('courses')).body.items.some((item) => item.id === course.id));
  assert.equal((await instructor.post(`courses/${course.id}/publish`, {})).status, 200);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('approved and pending edits require another review and stale approval fails', async () => {
  const world = createWorld();
  const { instructor, course } = await createCourse(world);
  const admin = await loggedIn(world, accounts.admin, 'admin');
  const submitted = await instructor.post(`courses/${course.id}/submit-review`, { expected_revision: course.revision });
  await admin.post(`admin/course-reviews/${submitted.body.id}/approve`, { expected_revision: course.revision });
  const approvedEdit = await instructor.patch(`courses/${course.id}`, { expected_revision: course.revision, title: 'แก้หลังอนุมัติ' });
  assert.equal(approvedEdit.body.status, 'draft');
  const pending = await instructor.post(`courses/${course.id}/submit-review`, { expected_revision: approvedEdit.body.revision });
  const pendingEdit = await instructor.patch(`courses/${course.id}`, { expected_revision: approvedEdit.body.revision, title: 'แก้ระหว่างตรวจ' });
  assert.equal(pendingEdit.body.status, 'draft');
  assert.equal((await admin.post(`admin/course-reviews/${pending.body.id}/approve`, { expected_revision: pending.body.revision })).status, 409);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('admin can create on behalf of an instructor and blog drafts stay private', async () => {
  const world = createWorld();
  const admin = await loggedIn(world, accounts.admin, 'admin');
  const created = await admin.post('admin/courses', { instructor_id: 'usr_instructor_b', title: 'แทนผู้สอน', category: 'หมวด', level: 'เริ่มต้น' });
  assert.equal(created.status, 201);
  assert.equal(created.body.instructor.id, 'usr_instructor_b');
  const draft = await admin.post('admin/blog', { title: 'บทความ', slug: 'draft-post', content: 'ลับ' });
  assert.equal(draft.status, 201);
  assert.equal((await world.browser().get('blog/draft-post')).status, 404);
  assert.equal((await world.browser().get('blog')).body.items.some((item) => item.slug === 'draft-post'), false);
  assert.equal((await admin.post(`admin/blog/${draft.body.id}/publish`, { expected_revision: draft.body.revision })).status, 200);
  assert.equal((await world.browser().get('blog/draft-post')).status, 200);
  assert.deepEqual(world.api.unexpectedErrors, []);
});
