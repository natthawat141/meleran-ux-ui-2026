import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const editorPath = new URL('../src/features/course-authoring/CourseMetadataEditor.tsx', import.meta.url);
const hostPath = new URL('../src/pages/instructor/CoursePages.tsx', import.meta.url);

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
  assert.doesNotMatch(editor, /useLms|useNavigate|useParams|saveChapterWorkspace|saveVideoTranscript|Transcript|Melearn AI/);
});

test('the host retains route, draft loading, persistence, and Admin capabilities', async () => {
  const host = await readFile(hostPath, 'utf8');
  const editorHost = host.slice(host.indexOf('export function CourseEditorPage'), host.indexOf('export function InstructorCourseOverviewPage'));
  assert.match(editorHost, /useLms\(\)/);
  assert.match(editorHost, /Form\.useForm<CourseMetadataFormValues>/);
  assert.match(editorHost, /saveCourse\(/);
  assert.match(editorHost, /navigate\(/);
  assert.match(editorHost, /setCourseAiEnabled\(/);
  assert.match(editorHost, /Melearn AI สำหรับคอร์สนี้/);
  assert.match(editorHost, /submitCourseForReview\(/);
  assert.match(editorHost, /publishCourse\(/);
  assert.match(editorHost, /<CourseMetadataEditor/);
});
