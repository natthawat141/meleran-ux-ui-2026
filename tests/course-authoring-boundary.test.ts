import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const editorPath = new URL('../packages/course-authoring/src/CourseMetadataEditor.tsx', import.meta.url);
const webHostPath = new URL('../apps/web/src/features/course-authoring/pages/CourseEditorPage.tsx', import.meta.url);
const adminHostPath = new URL('../apps/admin/src/features/course-authoring/pages/CourseEditorPage.tsx', import.meta.url);

test('course metadata editor stays controlled and independent from prototype app services', async () => {
  const editor = await readFile(editorPath, 'utf8');
  assert.match(editor, /FormInstance<CourseMetadataFormValues>/);
  assert.match(editor, /onFinish: \(values: CourseMetadataFormValues\) => void/);
  assert.match(editor, /onSubmitForReview: \(\) => void/);
  assert.match(editor, /onPublish: \(\) => void/);
  assert.match(editor, /adminExtension\?: ReactNode/);
  assert.match(editor, /previewAction: ReactNode/);
  assert.match(editor, /ImageUploadField: ComponentType/);
  assert.match(editor, /StatusTag: ComponentType/);
  assert.doesNotMatch(editor, /from ['"][^'"]*\/(store|router|data|mocks|types|pages|layouts)(\/|['"])/);
  assert.doesNotMatch(editor, /@legacy\/|@melearn\/(?:web|admin)/);
  assert.doesNotMatch(editor, /useLms|useNavigate|useParams|saveChapterWorkspace|saveVideoTranscript|Transcript|Melearn AI/);
});

test('Instructor page host owns Web draft, persistence, review, and navigation', async () => {
  const host = await readFile(webHostPath, 'utf8');
  assert.match(host, /useAuthoringWorkspace\(\)/);
  assert.match(host, /Form\.useForm<CourseMetadataFormValues>/);
  assert.match(host, /saveCourse\(/);
  assert.match(host, /navigate\('\/teach\/courses\/' \+ savedId\)/);
  assert.match(host, /submitCourseForReview\(/);
  assert.match(host, /publishCourse\(/);
  assert.match(host, /<CourseMetadataEditor/);
  assert.doesNotMatch(host, /setCourseAiEnabled|adminExtension|data\.users/);
});

test('Admin page host owns Admin instructor assignment, AI setting, and navigation', async () => {
  const host = await readFile(adminHostPath, 'utf8');
  assert.match(host, /useAuthoringWorkspace\(\)/);
  assert.match(host, /saveCourse\(/);
  assert.match(host, /navigate\('\/admin\/courses\/' \+ savedId \+ '\/overview'\)/);
  assert.match(host, /data\.users/);
  assert.match(host, /setCourseAiEnabled\(/);
  assert.match(host, /Melearn AI สำหรับคอร์สนี้/);
  assert.match(host, /<CourseMetadataEditor/);
  assert.match(host, /\/admin\/courses\/' \+ course\.id \+ '\/preview/);
});
