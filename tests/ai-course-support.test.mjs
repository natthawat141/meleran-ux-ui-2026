import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiKnowledgeCounts,
  canUseCourseAi,
  preserveCourseAiMetadata,
  preserveVideoTranscripts,
  saveVideoTranscript,
  setCourseAiEnabled,
} from '../packages/store/src/lib/ai-course-support.ts';

const course = {
  id: 'course-1', instructorId: 'instructor-1', status: 'approved', aiEnabled: false,
  reviewHistory: [{ action: 'approved', actorId: 'admin-1', at: '2026-10-01T00:00:00.000Z' }],
  chapters: [{ id: 'chapter-1', title: 'บท 1', items: [
    { id: 'video-1', type: 'video', title: 'วิดีโอ', videoUrl: 'https://example.test/video.mp4', transcript: '30:00 ต้นฉบับ\n30:06 ต่อเนื่อง', transcriptUpdatedAt: '2026-10-05T00:00:00.000Z', transcriptUpdatedBy: 'admin-1' },
    { id: 'article-1', type: 'article', title: 'บทอ่าน', articleBody: 'ข้อความ' },
  ] }],
};

test('only admin can change AI metadata and these actions retain course review state', () => {
  assert.equal(setCourseAiEnabled(course, 'instructor', true).ok, false);
  const enabled = setCourseAiEnabled(course, 'admin', true);
  assert.equal(enabled.ok, true);
  assert.equal(enabled.course.aiEnabled, true);
  assert.equal(enabled.course.status, 'approved');
  assert.deepEqual(enabled.course.reviewHistory, course.reviewHistory);
  assert.equal(saveVideoTranscript(course, 'learner', 'chapter-1', 'video-1', 'injected', 'learner-1', '2026-10-06T00:00:00.000Z').ok, false);
  const edited = saveVideoTranscript(course, 'admin', 'chapter-1', 'video-1', ' 30:00 exact\n30:06 exact  ', 'admin-1', '2026-10-06T00:00:00.000Z');
  assert.equal(edited.ok, true);
  assert.equal(edited.course.chapters[0].items[0].transcript, ' 30:00 exact\n30:06 exact  ');
  assert.equal(edited.course.chapters[0].items[0].transcriptUpdatedBy, 'admin-1');
  assert.equal(edited.course.chapters[0].items[0].transcriptUpdatedAt, '2026-10-06T00:00:00.000Z');
  assert.equal(saveVideoTranscript(course, 'admin', 'course-2-chapter', 'video-1', 'x', 'admin-1', '2026-10-06T00:00:00.000Z').ok, false);
  assert.equal(saveVideoTranscript(course, 'admin', 'chapter-1', 'article-1', 'x', 'admin-1', '2026-10-06T00:00:00.000Z').ok, false);
  assert.equal(edited.course.status, 'approved');
});

test('generic course and curriculum payloads cannot inject AI flag or replace a video transcript', () => {
  const forgedCourse = preserveCourseAiMetadata(course, { ...course, aiEnabled: true, status: 'draft' });
  assert.equal(forgedCourse.aiEnabled, false);
  const incoming = structuredClone(course);
  incoming.aiEnabled = true;
  incoming.chapters[0].items[0] = { ...incoming.chapters[0].items[0], title: 'แก้ชื่อวิดีโอ', transcript: 'FORGED' };
  const merged = preserveVideoTranscripts(course, incoming);
  assert.equal(preserveCourseAiMetadata(course, merged).aiEnabled, false);
  assert.equal(merged.chapters[0].items[0].title, 'แก้ชื่อวิดีโอ');
  assert.equal(merged.chapters[0].items[0].transcript, '30:00 ต้นฉบับ\n30:06 ต่อเนื่อง');
  assert.equal(merged.chapters[0].items[0].transcriptUpdatedBy, 'admin-1');
  assert.equal(merged.chapters[0].items[0].transcriptUpdatedAt, '2026-10-05T00:00:00.000Z');
  const newVideo = preserveVideoTranscripts(undefined, { ...course, chapters: [{ id: 'new-chapter', title: 'บทใหม่', items: [{ id: 'new-video', type: 'video', transcript: 'spoof', transcriptUpdatedAt: 'spoof', transcriptUpdatedBy: 'spoof' }] }] });
  assert.equal(newVideo.chapters[0].items[0].transcript, undefined);
  assert.equal(newVideo.chapters[0].items[0].transcriptUpdatedBy, undefined);
});

test('AI course eligibility includes only enabled owner, admin, or enrolled contexts', () => {
  const enrolled = new Set(['course-1']);
  assert.equal(canUseCourseAi({ ...course, aiEnabled: true }, enrolled, 'learner', 'learner-1'), true);
  assert.equal(canUseCourseAi({ ...course, aiEnabled: false }, enrolled, 'learner', 'learner-1'), false);
  assert.equal(canUseCourseAi({ ...course, aiEnabled: true }, new Set(), 'instructor', 'instructor-1'), true);
  assert.equal(canUseCourseAi({ ...course, aiEnabled: true }, new Set(), 'instructor', 'other'), false);
  assert.equal(canUseCourseAi({ ...course, aiEnabled: true }, new Set(), 'admin', 'admin-1'), true);
  assert.equal(canUseCourseAi({ ...course, aiEnabled: true }, enrolled, undefined, undefined), false);
  assert.equal(canUseCourseAi({ ...course, aiEnabled: true }, enrolled, 'learner', 'learner-1', false), false);
});

test('long transcript text and emptying preserve exact whitespace and count only populated articles', () => {
  const longTranscript = `${'บทบรรยาย\n'.repeat(12000)}30:00 เริ่ม\n30:06 ต่อ`;
  const result = saveVideoTranscript(course, 'admin', 'chapter-1', 'video-1', longTranscript, 'admin-1', '2026-10-06T00:00:00.000Z');
  assert.equal(result.course.chapters[0].items[0].transcript, longTranscript);
  const cleared = saveVideoTranscript(result.course, 'admin', 'chapter-1', 'video-1', '', 'admin-1', '2026-10-06T00:01:00.000Z');
  assert.equal(cleared.course.chapters[0].items[0].transcript, '');
  assert.equal(aiKnowledgeCounts({ ...course, chapters: [{ id: 'ch', title: 'บท', items: [
    { id: 'empty', type: 'article', title: 'ว่าง', articleDoc: { type: 'doc', content: [{ type: 'text', text: ' ' }] } },
    { id: 'filled', type: 'article', title: 'มีข้อความ', articleDoc: { type: 'doc', content: [{ type: 'text', text: 'เนื้อหา' }] } },
  ] }] }).articles, 1);
});
