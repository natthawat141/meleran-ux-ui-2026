import React, { useEffect, useRef, useState } from 'react';
import { Alert, Breadcrumb, Button, Dropdown, Empty, Input, Modal, Space, Tag, message } from 'antd';
import { ArrowDownOutlined, ArrowLeftOutlined, ArrowUpOutlined, CheckCircleOutlined, DeleteOutlined, EyeOutlined, FileTextOutlined, HolderOutlined, MoreOutlined, PlayCircleOutlined, PlusOutlined, QuestionCircleOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { createId } from '../../data.js';
import { RichTextEditor } from '../../components/chapter/RichTextEditor.jsx';
import { VideoEditor } from '../../components/chapter/VideoEditor.jsx';
import { AssessmentEditor, newQuestion } from '../../components/chapter/AssessmentEditor.jsx';
import { ChapterPreview } from '../../components/chapter/ChapterPreview.jsx';
import './chapter-workspace.css';

const kinds = { video: { label: 'วิดีโอ', icon: <PlayCircleOutlined/> }, article: { label: 'บทอ่าน', icon: <FileTextOutlined/> }, quiz: { label: 'แบบฝึกหัด', icon: <QuestionCircleOutlined/> } };

export function ChapterWorkspace() {
  const { courseId, chapterId } = useParams();
  const { data } = useLms();
  const course = data.courses.find((entry) => entry.id === courseId);
  const chapter = course?.chapters.find((entry) => entry.id === chapterId);
  if (!chapter) return <Empty description="ไม่พบบทนี้"/>;
  return <Workspace key={`${courseId}:${chapterId}`} course={course} initial={chapter}/>;
}

function Workspace({ course, initial }) {
  const { data, saveChapterWorkspace, removeChapter } = useLms();
  const navigate = useNavigate();
  const initialQuizzes = () => initial.items.filter((item) => item.quizId).map((item) => data.quizzes.find((quiz) => quiz.id === item.quizId)).filter(Boolean);
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [quizzes, setQuizzes] = useState(() => structuredClone(initialQuizzes()));
  const [baseline, setBaseline] = useState(() => JSON.stringify({ chapter: initial, quizzes: initialQuizzes() }));
  const [selected, setSelected] = useState(initial.items[0]?.id || 'settings');
  const [preview, setPreview] = useState(false);
  const [adding, setAdding] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [undo, setUndo] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dragging = useRef(null);
  const dirty = JSON.stringify({ chapter: draft, quizzes }) !== baseline;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const item = draft.items.find((entry) => entry.id === selected);
  const quiz = item?.quizId ? quizzes.find((entry) => entry.id === item.quizId) : null;
  const locked = quiz && data.attempts.some((entry) => entry.quizId === quiz.id);
  const hasHistory = (entry) => Boolean(Object.values(data.progress[`${course.id}:${entry.id}`] || {}).some(Boolean) || (entry.quizId && data.attempts.some((attempt) => attempt.quizId === entry.quizId)));
  const updateItem = (values) => { setError(''); setDraft((current) => ({ ...current, items: current.items.map((entry) => entry.id === selected ? { ...entry, ...values } : entry) })); if (values.title !== undefined && quiz) setQuizzes((current) => current.map((entry) => entry.id === quiz.id ? { ...entry, title: values.title } : entry)); };
  const updateQuiz = (values) => { if (!locked) setQuizzes((current) => current.map((entry) => entry.id === quiz.id ? { ...entry, ...values } : entry)); };

  useEffect(() => {
    const beforeUnload = (event) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event) => {
      const anchor = event.target.closest?.('a[href]');
      if (!dirtyRef.current || !anchor || anchor.target === '_blank' || new URL(anchor.href).pathname === location.pathname) return;
      if (!window.confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการออกและทิ้งการเปลี่ยนแปลงหรือไม่?')) { event.preventDefault(); event.stopPropagation(); }
    };
    // Browser Back needs its own guard because this prototype uses BrowserRouter.
    const original = location.pathname + location.search + location.hash;
    const pop = (event) => { if (location.pathname + location.search + location.hash === original) return; if (dirtyRef.current && !window.confirm('ออกจากบทและทิ้งการเปลี่ยนแปลงที่ยังไม่บันทึกหรือไม่?')) { event.stopImmediatePropagation(); history.pushState(history.state, '', original); } };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    // Run before React Router's window bubble listener.
    window.addEventListener('popstate', pop, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true); window.removeEventListener('popstate', pop, true); };
  }, []);

  const validate = () => {
    if (!draft.title.trim()) return 'กรอกชื่อบทก่อนบันทึก';
    for (const entry of draft.items) {
      if (!entry.title.trim()) { setSelected(entry.id); return 'รายการเนื้อหาต้องมีชื่อ'; }
      if (entry.type === 'video' && !/^(https?:\/\/|data:video\/(mp4|webm);base64,)/i.test(entry.videoUrl || '')) { setSelected(entry.id); return `เพิ่มวิดีโอให้ “${entry.title}” ก่อนบันทึก`; }
      if (entry.type === 'article' && !entry.articleBody?.trim() && !JSON.stringify(entry.articleDoc || {}).includes('"image"')) { setSelected(entry.id); return `เพิ่มเนื้อหาให้ “${entry.title}” ก่อนบันทึก`; }
      if (entry.type === 'quiz') {
        const assessment = quizzes.find((value) => value.id === entry.quizId);
        if (!assessment?.questions.length || !(assessment.passPercent >= 1 && assessment.passPercent <= 100) || assessment.questions.some((question) => !question.prompt?.trim() || !(question.points >= 1) || (question.type === 'choice' && (question.options.length < 2 || question.options.some((text) => !text.trim()) || !question.options[question.answer]?.trim())))) { setSelected(entry.id); return `ตรวจโจทย์ ตัวเลือก คะแนน และเกณฑ์ผ่านของ “${entry.title}” ให้ครบ`; }
      }
    }
    return '';
  };
  const save = () => {
    const problem = validate();
    if (problem) { setError(problem); return false; }
    setSaving(true);
    const result = saveChapterWorkspace(course.id, draft, quizzes, baseline);
    setSaving(false);
    if (!result.ok) { setError(result.message); return false; }
    setBaseline(JSON.stringify({ chapter: draft, quizzes })); dirtyRef.current = false; setUndo(null); setError(''); message.success('บันทึกบทและเนื้อหาแล้ว'); return true;
  };
  const back = () => {
    const go = () => { dirtyRef.current = false; navigate(`/teach/courses/${course.id}/curriculum`); };
    if (!dirty) { go(); return; }
    Modal.confirm({ title: 'บันทึกก่อนกลับไหม?', content: 'มีการเปลี่ยนแปลงในบทนี้ที่ยังไม่บันทึก', okText: 'บันทึกแล้วกลับ', cancelText: 'อยู่ต่อ', onOk: () => { if (save()) go(); else return Promise.reject(); }, footer: (_, { OkBtn, CancelBtn }) => <Space><Button danger onClick={() => { Modal.destroyAll(); go(); }}>ทิ้งการเปลี่ยนแปลง</Button><CancelBtn/><OkBtn/></Space> });
  };
  const add = () => {
    if (!newTitle.trim()) return;
    const entry = { id: createId('item'), type: adding, title: newTitle.trim() };
    if (adding === 'quiz') { entry.quizId = createId('quiz'); setQuizzes((current) => [...current, { id: entry.quizId, title: entry.title, courseId: course.id, chapterId: draft.id, passPercent: 60, questions: [newQuestion()] }]); }
    setDraft((current) => ({ ...current, items: [...current.items, entry] })); setSelected(entry.id); setAdding(null); setNewTitle(''); setUndo(null);
  };
  const move = (id, index) => setDraft((current) => { const items = [...current.items]; const from = items.findIndex((entry) => entry.id === id); const [entry] = items.splice(from, 1); items.splice(index, 0, entry); return { ...current, items }; });
  const remove = (entry) => {
    if (hasHistory(entry)) { message.info('รายการนี้มีประวัติการเรียนหรือคำตอบ จึงยังนำออกไม่ได้'); return; }
    setUndo({ item: entry, index: draft.items.indexOf(entry), quiz: quizzes.find((value) => value.id === entry.quizId) });
    setDraft((current) => ({ ...current, items: current.items.filter((value) => value.id !== entry.id) }));
    setQuizzes((current) => current.filter((value) => value.id !== entry.quizId));
    if (selected === entry.id) setSelected('settings');
  };
  return <div className="chapter-workspace">
    <Breadcrumb items={[{ title: <Link to={data.users.find((user) => user.id === data.currentUserId)?.role === 'admin' ? '/admin/courses' : '/teach/courses'}>คอร์สทั้งหมด</Link> }, { title: course.title }, { title: `บทที่ ${course.chapters.findIndex((entry) => entry.id === draft.id) + 1}` }]}/>
    <header className="chapter-workspace-header"><div><Button type="text" icon={<ArrowLeftOutlined/>} onClick={back}>กลับโครงสร้างคอร์ส</Button><h1>{draft.title || 'บทเรียนไม่มีชื่อ'}</h1><span className="chapter-save-status" role="status">{dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : <><CheckCircleOutlined/> บันทึกแล้ว</>} · {draft.items.length} รายการเรียนรู้</span></div><Space wrap><Button icon={<EyeOutlined/>} onClick={() => setPreview(true)}>ดูตัวอย่าง</Button><Button type="primary" icon={<SaveOutlined/>} disabled={!dirty} loading={saving} onClick={save}>บันทึกการเปลี่ยนแปลง</Button><Dropdown trigger={['click']} menu={{ items: [{ key: 'delete', label: 'ลบบททั้งบท', danger: true, icon: <DeleteOutlined/> }], onClick: () => {
      if (initial.items.some(hasHistory)) { message.info('บทนี้มีประวัติการเรียนหรือคำตอบ จึงยังลบไม่ได้'); return; }
      Modal.confirm({ title: `ลบบท “${draft.title}”?`, content: `เนื้อหาที่บันทึกไว้ ${initial.items.length} รายการจะถูกนำออก การแก้ไขที่ยังไม่บันทึกจะถูกทิ้ง`, okText: 'ลบบท', okButtonProps: { danger: true }, cancelText: 'ยกเลิก', onOk: () => { dirtyRef.current = false; removeChapter(course.id, draft.id); navigate(`/teach/courses/${course.id}/curriculum`); } });
    } }}><Button aria-label="เมนูเพิ่มเติมของบท" icon={<MoreOutlined/>}/></Dropdown></Space></header>
    {error && <Alert type="error" showIcon title={error} closable onClose={() => setError('')}/>}
    {undo && <Alert type="info" title={`นำ “${undo.item.title}” ออกจากฉบับที่กำลังแก้`} action={<Button size="small" onClick={() => { setDraft((current) => { const items = [...current.items]; items.splice(undo.index, 0, undo.item); return { ...current, items }; }); if (undo.quiz) setQuizzes((current) => [...current, undo.quiz]); setSelected(undo.item.id); setUndo(null); }}>เลิกทำ</Button>}/>}
    <div className="chapter-workspace-grid">
      <aside className="chapter-outline" aria-label="รายการเนื้อหาในบท"><button type="button" className={`chapter-settings-link ${selected === 'settings' ? 'is-active' : ''}`} onClick={() => setSelected('settings')}><SettingOutlined/> ข้อมูลบท</button><div className="chapter-outline-label">เนื้อหาในบท <span>{draft.items.length}</span></div>
        <div className="chapter-outline-items">{draft.items.map((entry, index) => <div key={entry.id} className={`chapter-outline-row ${selected === entry.id ? 'is-active' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragging.current) move(dragging.current, index); dragging.current = null; }}>
          <span className="chapter-drag-handle" draggable onDragStart={(event) => { dragging.current = entry.id; event.dataTransfer.setData('text/plain', entry.id); }} onDragEnd={() => { dragging.current = null; }} title="ลากเพื่อเรียง หรือใช้เมนูเลื่อนขึ้น–ลง"><HolderOutlined/></span>
          <button className="chapter-outline-select" aria-current={selected === entry.id ? 'true' : undefined} onClick={() => setSelected(entry.id)}><span className="chapter-item-kind">{kinds[entry.type]?.icon} {kinds[entry.type]?.label} · {index + 1}</span><strong>{entry.title}</strong></button>
          <Dropdown trigger={['click']} menu={{ items: [{ key: 'up', label: 'เลื่อนขึ้น', icon: <ArrowUpOutlined/>, disabled: index === 0 }, { key: 'down', label: 'เลื่อนลง', icon: <ArrowDownOutlined/>, disabled: index === draft.items.length - 1 }, { key: 'remove', label: 'นำออกจากบท', icon: <DeleteOutlined/>, danger: true, disabled: hasHistory(entry) }], onClick: ({ key }) => key === 'remove' ? remove(entry) : move(entry.id, index + (key === 'up' ? -1 : 1)) }}><Button type="text" size="small" aria-label={`จัดการ ${entry.title}`} icon={<MoreOutlined/>}/></Dropdown>
        </div>)}</div>
        {!draft.items.length && <p className="chapter-empty-hint">เริ่มจากเพิ่มวิดีโอ บทอ่าน หรือแบบฝึกหัดแรกของบทนี้</p>}
        <Dropdown trigger={['click']} menu={{ items: Object.entries(kinds).map(([key, value]) => ({ key, label: `เพิ่ม${value.label}`, icon: value.icon })), onClick: ({ key }) => { setAdding(key); setNewTitle(''); } }}><Button block type="dashed" icon={<PlusOutlined/>}>เพิ่มเนื้อหา</Button></Dropdown><p className="chapter-outline-note">เรียงจากบนลงล่างตามลำดับที่ผู้เรียนจะเห็น</p>
      </aside>
      <section className="chapter-editor-surface" aria-label="พื้นที่แก้ไขบทเรียน">
        {selected === 'settings' || !item ? <><div className="chapter-editor-heading"><Tag>ข้อมูลบท</Tag><h2>จุดเริ่มต้นของบทเรียน</h2><p>บอกผู้เรียนว่าบทนี้เกี่ยวกับอะไร เนื้อหาสอนให้เพิ่มเป็นรายการทางซ้าย</p></div><div className="chapter-field-stack"><label>ชื่อบท<Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="เช่น เริ่มจากสิ่งที่อยากบอก"/></label><label>คำอธิบายสั้น<Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="สิ่งที่ผู้เรียนจะได้จากบทนี้"/><small>แสดงใต้ชื่อบทในโครงสร้างคอร์ส ไม่ใช่พื้นที่เขียนเนื้อหาสอน</small></label></div></> : <div key={item.id}><div className="chapter-editor-heading"><Tag icon={kinds[item.type].icon}>{kinds[item.type].label}</Tag><h2>{item.title}</h2><p>{item.type === 'video' ? 'เลือกวิดีโอ แล้วตรวจตัวอย่างก่อนบันทึก' : item.type === 'article' ? 'เขียนให้อ่านง่าย จัดหัวข้อ และแทรกภาพประกอบได้' : 'จัดคำถามทีละข้อ พร้อมวิธีตอบและเกณฑ์คะแนน'}</p></div><div className="chapter-field-stack"><label>ชื่อ{kinds[item.type].label}<Input disabled={locked} value={item.title} onChange={(event) => updateItem({ title: event.target.value })}/></label>
          {item.type === 'video' && <VideoEditor item={item} onChange={updateItem}/>}
          {item.type === 'article' && <div><label className="chapter-field-label">เนื้อหาบทอ่าน</label><RichTextEditor document={item.articleDoc} text={item.articleBody} onChange={(articleDoc, articleBody) => updateItem({ articleDoc, articleBody, readingMinutes: Math.max(1, Math.ceil(articleBody.length / 500)) })}/><small>รูปภาพ JPG, PNG, WebP ไม่เกิน 5 MB · ปรับขนาดให้เหมาะกับต้นแบบอัตโนมัติ</small></div>}
          {quiz && <AssessmentEditor quiz={quiz} onChange={updateQuiz} locked={locked}/>}
        </div></div>}
      </section>
    </div>
    <Modal title={`เพิ่ม${kinds[adding]?.label || 'เนื้อหา'}`} open={Boolean(adding)} okText="เพิ่มและเริ่มเขียน" cancelText="ยกเลิก" okButtonProps={{ disabled: !newTitle.trim() }} onOk={add} onCancel={() => setAdding(null)} destroyOnHidden><label className="chapter-field-label">ชื่อ{kinds[adding]?.label}<Input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onPressEnter={() => { if (newTitle.trim()) add(); }} placeholder="ตั้งชื่อให้ผู้เรียนรู้ว่าจะได้เรียนอะไร"/></label></Modal>
    <ChapterPreview chapter={draft} quizzes={quizzes} open={preview} onClose={() => setPreview(false)} dirty={dirty}/>
  </div>;
}
