import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dropdown, Empty, Form, Input, InputNumber, Modal, Radio, Select, Tooltip, message } from 'antd';
import type { FormInstance, FormListFieldData } from 'antd';
import { ArrowDownOutlined, ArrowLeftOutlined, ArrowUpOutlined, CheckCircleOutlined, CopyOutlined, DeleteOutlined, DownOutlined, EllipsisOutlined, EyeOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLms } from '@melearn/store';
import { createId, RichDocument } from '@melearn/ui';
import { RichTextEditor } from '../components/chapter/RichTextEditor';
import type { Question, Quiz } from '@melearn/contracts';
import '../styles/quiz-editor-workspace.css';

interface QuestionDraft {
  id: string;
  type: 'choice' | 'essay';
  prompt: string;
  promptDoc?: unknown;
  rubric?: string;
  points: number;
  options: string[];
  correctIndex?: number;
  responseMode: 'either' | 'text' | 'image';
}

interface QuizDraft {
  title: string;
  courseId: string;
  chapterId?: string;
  passPercent: number;
  questions: QuestionDraft[];
}

function newQuestion(): QuestionDraft {
  return { id: createId('q'), type: 'choice', prompt: '', points: 1, options: ['', ''], responseMode: 'either' };
}

function isComplete(question?: QuestionDraft) {
  if (!question?.prompt?.trim() || !(question.points >= 1)) return false;
  return question.type === 'essay' || (
    question.options?.length >= 2 && question.options.every((option) => option.trim()) &&
    question.correctIndex !== undefined && Boolean(question.options[question.correctIndex]?.trim())
  );
}

function QuestionFields({ form, field }: { form: FormInstance<QuizDraft>; field: FormListFieldData }) {
  const type = Form.useWatch(['questions', field.name, 'type'], form);
  const promptDoc = Form.useWatch(['questions', field.name, 'promptDoc'], { form, preserve: true });
  return (
    <>
      <Form.Item name={[field.name, 'id']} hidden><Input /></Form.Item>
      <div className="qe-question-meta">
        <Form.Item name={[field.name, 'type']} label="ประเภทคำถาม">
          <Select options={[{ value: 'choice', label: 'เลือกตอบ' }, { value: 'essay', label: 'ข้อเขียน / ส่งงาน' }]} />
        </Form.Item>
        <Form.Item name={[field.name, 'points']} label="คะแนนเต็ม" rules={[{ required: true, message: 'ระบุคะแนนเต็ม' }, { type: 'number', min: 1, max: 100, message: 'ใช้คะแนน 1–100' }]}>
          <InputNumber min={1} max={100} precision={0} />
        </Form.Item>
      </div>
      <Form.Item name={[field.name, 'prompt']} label="โจทย์คำถาม" rules={[{ required: true, whitespace: true, message: 'เขียนโจทย์คำถาม' }]}>
        {promptDoc ? <RichPrompt document={promptDoc} onDocumentChange={(document) => form.setFieldValue(['questions', field.name, 'promptDoc'], document)} /> : <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} placeholder="เขียนสิ่งที่ต้องการถามผู้เรียน" />}
      </Form.Item>
      {type === 'essay' ? (
        <>
          <Form.Item name={[field.name, 'responseMode']} label="รูปแบบคำตอบ">
            <Select options={[{ value: 'either', label: 'ข้อความและรูปภาพ' }, { value: 'text', label: 'ข้อความเท่านั้น' }, { value: 'image', label: 'รูปภาพเท่านั้น' }]} />
          </Form.Item>
          <p className="qe-help">คำตอบข้อนี้จะเข้าคิวให้ผู้สอนตรวจและให้คะแนน</p>
        </>
      ) : (
        <>
          <div className="qe-options-heading"><strong>ตัวเลือกและเฉลย</strong><span>เลือกวงกลมข้างคำตอบที่ถูก</span></div>
          <Form.Item name={[field.name, 'correctIndex']} rules={[{ required: true, message: 'เลือกคำตอบที่ถูก' }, {
            validator: (_, value: unknown) => {
              const options = form.getFieldValue(['questions', field.name, 'options']) as string[];
              return Number.isInteger(value) && Number(value) >= 0 && Number(value) < options.length
                ? Promise.resolve() : Promise.reject(new Error('เลือกคำตอบที่มีอยู่ในรายการ'));
            },
          }]}>
            <ChoiceOptions field={field} />
          </Form.Item>
        </>
      )}
    </>
  );
}

// Form.Item binds the answer at the question level; Form.List binds each option separately.
function ChoiceOptions({ field, value, onChange }: {
  field: FormListFieldData; value?: number; onChange?: (value: number | undefined) => void;
}) {
  return <Form.List name={[field.name, 'options']}>
          {(options, { add, remove }) => (
            <>
                <Radio.Group className="qe-options" aria-label="คำตอบที่ถูก" value={value} onChange={(event) => onChange?.(event.target.value as number)}>
                  {options.map((option, index) => (
                    <div className="qe-option" key={option.key}>
                      <Radio value={index} aria-label={`เลือกตัวเลือก ${index + 1} เป็นเฉลย`} />
                      <Form.Item name={option.name} rules={[{ required: true, whitespace: true, message: 'เขียนตัวเลือก หรือเอาตัวเลือกที่ไม่ใช้ออก' }]}>
                        <Input aria-label={`ตัวเลือก ${index + 1}`} placeholder={`ตัวเลือก ${index + 1}`} />
                      </Form.Item>
                      <Tooltip title="เอาตัวเลือกออก">
                        <Button type="text" icon={<DeleteOutlined />} aria-label={`ลบตัวเลือก ${index + 1}`} disabled={options.length <= 2} onClick={() => {
                          remove(option.name);
                          onChange?.(value === index ? undefined : value !== undefined && value > index ? value - 1 : value);
                        }} />
                      </Tooltip>
                    </div>
                  ))}
                </Radio.Group>
              <Button type="text" icon={<PlusOutlined />} onClick={() => add('')}>เพิ่มตัวเลือก</Button>
            </>
          )}
        </Form.List>;
}

function RichPrompt({ document, value, onChange, onDocumentChange }: {
  document: unknown; value?: string; onChange?: (value: string) => void; onDocumentChange: (document: unknown) => void;
}) {
  return <RichTextEditor document={document} text={value} label="โจทย์คำถาม" onChange={(nextDocument, text) => { onDocumentChange(nextDocument); onChange?.(text); }} />;
}

export function QuizEditorPage() {
  const { quizId = 'new' } = useParams();
  const [search] = useSearchParams();
  const { currentUser } = useLms();
  // Remount the draft when moving between quizzes or demo accounts.
  return <QuizWorkspace key={`${currentUser?.id}:${quizId}:${search.get('course') ?? search.get('courseId') ?? ''}:${search.get('chapter') ?? ''}`} quizId={quizId} />;
}

function QuizWorkspace({ quizId }: { quizId: string }) {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { data, currentUser, saveQuiz, removeQuiz } = useLms();
  const quiz = data.quizzes.find((entry) => entry.id === quizId);
  const courses = data.courses.filter((course) => currentUser?.role === 'admin' || course.instructorId === currentUser?.id);
  const isNew = quizId === 'new';
  const selectedCourse = quiz?.courseId ?? search.get('course') ?? search.get('courseId') ?? courses[0]?.id ?? '';
  const initialCourse = courses.find((entry) => entry.id === selectedCourse);
  const linkedChapter = initialCourse?.chapters.find((chapter) => chapter.items.some((item) => item.type === 'quiz' && item.quizId === quizId));
  const draftKey = `melearn-quiz-draft:${currentUser?.id}:${quizId}:${isNew ? `${selectedCourse}:${search.get('chapter') ?? ''}` : ''}`;
  const [initial] = useState<QuizDraft>(() => ({
    title: quiz?.title ?? '', courseId: selectedCourse, passPercent: quiz?.passPercent ?? 60,
    chapterId: quiz ? linkedChapter?.id ?? quiz.chapterId : search.get('chapter') ?? initialCourse?.chapters[0]?.id,
    questions: quiz ? quiz.questions.map((question) => ({
      id: question.id, type: question.type, prompt: question.prompt, promptDoc: question.promptDoc, points: question.points,
      rubric: question.type === 'essay' ? question.rubric : undefined,
      options: question.type === 'choice' ? [...question.options] : ['', ''],
      correctIndex: question.type === 'choice' ? question.answer : undefined,
      responseMode: question.type === 'essay' ? question.responseMode ?? 'either' : 'either',
    })) : [newQuestion()],
  }));
  const [restored] = useState<QuizDraft | null>(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return null;
      const entry = JSON.parse(raw) as { baseline?: string; values?: QuizDraft };
      // Do not replace changes saved by a different tab with a stale draft.
      return entry.baseline === JSON.stringify(initial) && Array.isArray(entry.values?.questions) ? entry.values! : null;
    } catch { return null; }
  });
  const [form] = Form.useForm<QuizDraft>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(isNew || !initial.chapterId);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dirty, setDirty] = useState(Boolean(restored));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [draftError, setDraftError] = useState(false);
  const watched = Form.useWatch([], { form, preserve: true }) as QuizDraft | undefined;
  const values = watched ?? restored ?? initial;
  const questions = values.questions ?? [];
  const course = courses.find((entry) => entry.id === values.courseId);
  const totalPoints = questions.reduce((sum, question) => sum + Number(question?.points ?? 0), 0);
  const baselineRef = useRef(JSON.stringify(initial));

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty || !watched) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ baseline: baselineRef.current, values: form.getFieldsValue(true) }));
      setDraftError(false);
    } catch { setDraftError(true); }
  }, [dirty, watched, draftKey, form]);

  const retainDraft = () => setDirty(true);

  const goTo = (path: string) => {
    if (!dirty) { navigate(path); return; }
    Modal.confirm({
      title: 'ยังมีการแก้ไขที่ไม่ได้บันทึก',
      content: draftError ? 'เก็บฉบับร่างไม่สำเร็จ หากออกตอนนี้การแก้ไขจะหาย' : 'ฉบับร่างจะอยู่ในแท็บนี้ คุณกลับมาแก้ต่อได้',
      okText: 'ออกจากหน้า', cancelText: 'แก้ต่อ', onOk: () => navigate(path),
    });
  };

  const submit = (draft: QuizDraft) => {
    if (!courses.some((entry) => entry.id === draft.courseId) || !course?.chapters.some((entry) => entry.id === draft.chapterId)) {
      setSettingsOpen(true); message.error('เลือกคอร์สและบทเรียนที่คุณจัดการได้'); return;
    }
    if (!draft.questions.length) { message.error('เพิ่มคำถามอย่างน้อย 1 ข้อ'); return; }
    const nextQuestions: Question[] = draft.questions.map((question) => {
      const common = { id: question.id, prompt: question.prompt, points: question.points, promptDoc: question.promptDoc };
      return question.type === 'choice'
        ? { ...common, type: 'choice', options: [...question.options], answer: question.correctIndex! }
        : { ...common, type: 'essay', responseMode: question.responseMode, rubric: question.rubric };
    });
    setSaving(true);
    try {
      const id = saveQuiz({ title: draft.title, courseId: draft.courseId, chapterId: draft.chapterId, passPercent: draft.passPercent, questions: nextQuestions }, quiz?.id);
      if (!id) { setSaving(false); message.error('บันทึกไม่ได้: ไม่มีสิทธิ์หรือแบบฝึกหัดมีประวัติคำตอบแล้ว'); return; }
      // The prototype store persists in an effect. Confirm persistence before clearing the draft.
      window.setTimeout(() => {
        try {
          const stored = JSON.parse(localStorage.getItem('stay-elearn-ux-v2') ?? '{}') as { quizzes?: Quiz[] };
          const saved = stored.quizzes?.find((entry) => entry.id === id);
          if (!saved || saved.title !== draft.title || saved.courseId !== draft.courseId || saved.chapterId !== draft.chapterId || saved.passPercent !== draft.passPercent || JSON.stringify(saved.questions) !== JSON.stringify(nextQuestions)) {
            throw new Error('Quiz not persisted');
          }
          sessionStorage.removeItem(draftKey);
          baselineRef.current = JSON.stringify(draft);
          setDirty(false); setDraftError(false);
          setSavedAt(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
          message.success(isNew ? 'สร้างแบบทดสอบแล้ว' : 'บันทึกแบบทดสอบแล้ว');
          if (isNew) navigate(`/admin/quizzes/${id}`, { replace: true });
        } catch {
          retainDraft(); message.error('ยังบันทึกลงเบราว์เซอร์ไม่สำเร็จ การแก้ไขยังอยู่ในหน้านี้ กรุณาลองอีกครั้ง');
        } finally { setSaving(false); }
      }, 0);
    } catch { setSaving(false); message.error('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
  };

  if (!isNew && !quiz) return <Empty description="ไม่พบแบบทดสอบนี้" />;
  if (!courses.length) return <Alert type="info" title="สร้างคอร์สก่อนจึงจะเพิ่มแบบทดสอบได้" action={<Link to="/admin/courses/new">สร้างคอร์ส</Link>} />;

  return (
    <div className="quiz-editor-workspace">
      <Form form={form} name="quiz-workspace" layout="vertical" initialValues={restored ?? initial} onValuesChange={retainDraft} onFinish={submit} onFinishFailed={({ errorFields }) => {
        const questionError = errorFields.find((entry) => entry.name[0] === 'questions');
        if (questionError && typeof questionError.name[1] === 'number') setActiveIndex(questionError.name[1]);
        if (errorFields.some((entry) => entry.name[0] !== 'questions')) setSettingsOpen(true);
        window.setTimeout(() => form.scrollToField(errorFields[0]?.name ?? [], { focus: true, block: 'center' }), 0);
        message.error('ตรวจช่องที่ยังไม่ครบก่อนบันทึก');
      }}>
        <header className="qe-toolbar">
          <div className="qe-heading">
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label="กลับรายการแบบทดสอบ" onClick={() => goTo('/admin/quizzes')} />
            <div><span className="qe-eyebrow">ตัวแก้แบบทดสอบ</span><h1>{values.title?.trim() || 'สร้างแบบทดสอบ'}</h1>
              <p>{questions.length} ข้อ · {totalPoints} คะแนน <span role="status">{dirty ? '· ยังไม่บันทึก' : savedAt ? `· บันทึกแล้ว ${savedAt}` : '· ไม่มีการแก้ไขค้าง'}</span></p>
            </div>
          </div>
          <div className="qe-toolbar-actions">
            <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>ดูตัวอย่าง</Button>
            <Button type="primary" htmlType="submit" loading={saving}>บันทึกแบบทดสอบ</Button>
            {!isNew && quiz && <Dropdown trigger={['click']} menu={{ items: [
              { key: 'delete', label: 'ลบแบบทดสอบ', danger: true, icon: <DeleteOutlined />, onClick: () => Modal.confirm({
                title: 'ลบแบบทดสอบนี้หรือไม่', content: `“${quiz.title}” จะถูกนำออกจากบทเรียน และคำตอบจะไม่ปรากฏในรายการแบบทดสอบนี้`,
                okText: 'ลบแบบทดสอบ', cancelText: 'ยกเลิก', okButtonProps: { danger: true },
                onOk: () => { const result = removeQuiz(quiz.id); if (!result.ok) { message.error(result.message); return; } sessionStorage.removeItem(draftKey); navigate('/admin/quizzes'); },
              }) },
            ] }}><Button type="text" icon={<EllipsisOutlined />} aria-label="จัดการแบบทดสอบ" /></Dropdown>}
          </div>
        </header>

        {draftError && <Alert className="qe-draft-alert" type="warning" showIcon title="เก็บฉบับร่างในแท็บไม่สำเร็จ โปรดบันทึกก่อนออกจากหน้า" />}
        {restored && dirty && !draftError && <p className="qe-restored">คืนฉบับร่างในแท็บนี้แล้ว การแก้ไขยังไม่ถูกบันทึก</p>}
        <section className="qe-settings">
          <Button type="text" className="qe-settings-toggle" icon={<SettingOutlined />} aria-expanded={settingsOpen} aria-controls="qe-settings-fields" onClick={() => setSettingsOpen(!settingsOpen)}>
            <span><strong>ตั้งค่าแบบทดสอบ</strong><small>{course?.title ?? 'เลือกคอร์ส'} · เกณฑ์ผ่าน {values.passPercent ?? '—'}%</small></span><DownOutlined rotate={settingsOpen ? 180 : 0} />
          </Button>
          <div id="qe-settings-fields" className="qe-settings-fields" hidden={!settingsOpen}>
            <Form.Item name="title" label="ชื่อแบบทดสอบ" rules={[{ required: true, whitespace: true, message: 'กรอกชื่อแบบทดสอบ' }]}><Input /></Form.Item>
            <div className="qe-settings-grid">
              <Form.Item name="courseId" label="คอร์ส" rules={[{ required: true, message: 'เลือกคอร์ส' }]}>
                <Select options={courses.map((entry) => ({ value: entry.id, label: entry.title }))} onChange={() => form.setFieldValue('chapterId', undefined)} />
              </Form.Item>
              <Form.Item name="chapterId" label="บทเรียนที่วางแบบทดสอบ" rules={[{ required: true, message: 'เลือกบทเรียน' }]}>
                <Select placeholder="เลือกบทเรียน" options={(course?.chapters ?? []).map((entry) => ({ value: entry.id, label: entry.title }))} />
              </Form.Item>
              <Form.Item name="passPercent" label="เกณฑ์ผ่าน (%)" rules={[{ required: true, message: 'ระบุเกณฑ์ผ่าน' }, { type: 'number', min: 1, max: 100, message: 'ใช้ค่า 1–100%' }]}><InputNumber min={1} max={100} precision={0} /></Form.Item>
            </div>
          </div>
        </section>

        <Form.List name="questions">
          {(fields, { add, remove, move }) => (
            <div className="qe-layout">
              <aside className="qe-question-list" aria-label="รายการคำถาม">
                <div className="qe-list-heading"><h2>คำถาม</h2><span>{fields.length} ข้อ</span></div>
                <div className="qe-question-items">
                  {fields.map((field, index) => <button type="button" className={`qe-question-link${index === activeIndex ? ' is-active' : ''}`} key={field.key} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => { setActiveIndex(index); }}>
                    <span className="qe-question-number">{index + 1}</span><span className="qe-question-summary"><strong>{questions[index]?.prompt?.trim() || 'คำถามใหม่'}</strong><small>{questions[index]?.type === 'essay' ? 'ข้อเขียน / ส่งงาน' : 'เลือกตอบ'} · {questions[index]?.points ?? 0} คะแนน</small></span>
                    {isComplete(questions[index]) ? <CheckCircleOutlined aria-label="ข้อมูลครบ" /> : <span className="qe-incomplete" aria-label="ยังกรอกไม่ครบ">—</span>}
                  </button>)}
                </div>
                <Button icon={<PlusOutlined />} block onClick={() => { add(newQuestion()); setActiveIndex(fields.length); }}>เพิ่มคำถาม</Button>
              </aside>

              <div className="qe-question-panel">
                {!fields.length && <Empty description="ยังไม่มีคำถาม เพิ่มข้อแรกจากรายการด้านซ้าย" />}
                {fields.map((field, index) => <section className="qe-question-section" key={field.key} hidden={activeIndex !== index} aria-label={`แก้คำถามข้อ ${index + 1}`}>
                  <div className="qe-question-heading"><div><span className="qe-eyebrow">คำถาม {index + 1} จาก {fields.length}</span><h2>แก้ไขคำถาม</h2></div>
                    <Dropdown trigger={['click']} menu={{ items: [
                      { key: 'up', label: 'เลื่อนขึ้น', icon: <ArrowUpOutlined />, disabled: index === 0, onClick: () => { move(index, index - 1); setActiveIndex(index - 1); } },
                      { key: 'down', label: 'เลื่อนลง', icon: <ArrowDownOutlined />, disabled: index === fields.length - 1, onClick: () => { move(index, index + 1); setActiveIndex(index + 1); } },
                      { key: 'copy', label: 'ทำสำเนาคำถาม', icon: <CopyOutlined />, onClick: () => { add({ ...structuredClone(form.getFieldValue(['questions', index])), id: createId('q') }, index + 1); setActiveIndex(index + 1); } },
                      { type: 'divider' },
                      { key: 'delete', label: 'ลบคำถาม', icon: <DeleteOutlined />, danger: true, onClick: () => Modal.confirm({ title: `ลบคำถามข้อ ${index + 1} หรือไม่`, content: 'คำถามนี้จะถูกนำออกจากฉบับร่าง การเปลี่ยนแปลงจะมีผลเมื่อบันทึก', okText: 'ลบคำถาม', cancelText: 'ยกเลิก', okButtonProps: { danger: true }, onOk: () => { remove(index); setActiveIndex(Math.max(0, Math.min(index, fields.length - 2))); } }) },
                    ] }}><Button type="text" icon={<EllipsisOutlined />} aria-label={`จัดการคำถามข้อ ${index + 1}`} /></Dropdown>
                  </div>
                  <QuestionFields form={form} field={field} />
                  <footer className="qe-question-footer"><span>แก้ทีละข้อ · บันทึกทุกข้อพร้อมกัน</span><div>
                    <Button disabled={index === 0} onClick={() => setActiveIndex(index - 1)}>ข้อก่อนหน้า</Button>
                    <Button disabled={index === fields.length - 1} onClick={() => setActiveIndex(index + 1)}>ข้อถัดไป</Button>
                  </div></footer>
                </section>)}
              </div>
            </div>
          )}
        </Form.List>
      </Form>

      <Modal open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={<Button onClick={() => setPreviewOpen(false)}>กลับไปแก้ไข</Button>} title="ตัวอย่างจากฉบับร่าง" width={760}>
        <div className="qe-preview"><h2>{values.title || 'แบบทดสอบใหม่'}</h2><p>{questions.length} ข้อ · {totalPoints} คะแนน · เกณฑ์ผ่าน {values.passPercent}%</p>
          {questions.map((question, index) => <section key={question.id}>
            <h3>ข้อ {index + 1} <small>{question.points} คะแนน</small></h3>
            {question.promptDoc ? <RichDocument document={question.promptDoc} /> : <p className="qe-preview-prompt">{question.prompt || 'ยังไม่ได้เขียนโจทย์'}</p>}
            {question.type === 'choice' ? <Radio.Group className="qe-preview-options" aria-label={`คำตอบตัวอย่างข้อ ${index + 1}`}>{question.options.map((option, optionIndex) => <Radio key={optionIndex} value={optionIndex}>{option || `ตัวเลือก ${optionIndex + 1}`}</Radio>)}</Radio.Group>
              : <p className="qe-help">{question.responseMode === 'image' ? 'พื้นที่ส่งคำตอบเป็นรูปภาพ' : question.responseMode === 'text' ? 'พื้นที่ส่งคำตอบเป็นข้อความ' : 'พื้นที่ส่งคำตอบเป็นข้อความและรูปภาพ'} · ผู้สอนตรวจให้คะแนน</p>}
          </section>)}
        </div>
      </Modal>
    </div>
  );
}
