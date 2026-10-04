import React, { useRef, useState } from 'react';
import { Breadcrumb, Button, Dropdown, Empty, Form, Input, Modal, message } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, DeleteOutlined, DownOutlined, EditOutlined, EyeOutlined, FileTextOutlined, HolderOutlined, MoreOutlined, PlayCircleOutlined, PlusOutlined, QuestionCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { ContentTypeIcon } from '../../components/common.jsx';
import './curriculum-workspace.css';

const contentKinds = [
  { key: 'video', label: 'วิดีโอ', icon: <PlayCircleOutlined/> },
  { key: 'article', label: 'บทอ่าน', icon: <FileTextOutlined/> },
  { key: 'quiz', label: 'แบบฝึกหัด', icon: <QuestionCircleOutlined/> },
];

function chapterSummary(chapter) {
  return contentKinds.map(({ key, label }) => {
    const count = chapter.items.filter((item) => item.type === key).length;
    return count ? `${count} ${label}` : null;
  }).filter(Boolean).join(' · ') || 'ยังไม่มีเนื้อหา';
}

function itemSummary(item, quizzes) {
  if (item.type === 'video') return `วิดีโอ · ${item.duration || 'ยังไม่ระบุเวลา'}`;
  if (item.type === 'article') return `บทอ่าน · ${item.readingMinutes ? `${item.readingMinutes} นาที` : 'ยังไม่ระบุเวลาอ่าน'}`;
  const quiz = quizzes.find((entry) => entry.id === item.quizId);
  return `แบบฝึกหัด · ${quiz?.questions.length ?? 0} ข้อ`;
}

function orderMenu(index, length, deleteLabel, locked) {
  return [
    { key: 'edit', label: 'เปิดแก้ไข', icon: <EditOutlined/> },
    { type: 'divider' },
    { key: 'up', label: 'เลื่อนขึ้น', icon: <ArrowUpOutlined/>, disabled: index === 0 },
    { key: 'down', label: 'เลื่อนลง', icon: <ArrowDownOutlined/>, disabled: index === length - 1 },
    { type: 'divider' },
    { key: 'delete', label: locked ? `${deleteLabel}ไม่ได้ — มีประวัติเรียน` : deleteLabel, icon: <DeleteOutlined/>, danger: true, disabled: locked },
  ];
}

function moveIds(entries, id, to) {
  const ids = entries.map((entry) => entry.id);
  const from = ids.indexOf(id);
  if (from < 0 || to < 0 || to >= ids.length || from === to) return null;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  return ids;
}

export function CurriculumPage() {
  const { courseId } = useParams();
  const { data, currentUser, saveChapter, removeChapter, removeItem, reorderCurriculum } = useLms();
  const navigate = useNavigate();
  const [closed, setClosed] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const draggingChapter = useRef(null);
  const course = data.courses.find((entry) => entry.id === courseId);
  if (!course) return <Empty description="ไม่พบคอร์สนี้"/>;
  const canEdit = currentUser?.role === 'admin' || (currentUser?.role === 'instructor' && currentUser.id === course.instructorId);
  if (!canEdit) return <Empty description="ไม่มีสิทธิ์จัดการคอร์สนี้"/>;

  const coursePath = `/teach/courses/${course.id}`;
  const total = course.chapters.reduce((sum, chapter) => sum + chapter.items.length, 0);
  const someOpen = course.chapters.some((chapter) => !closed.has(chapter.id));
  const hasHistory = (item) => Object.values(data.progress[`${course.id}:${item.id}`] || {}).some(Boolean)
    || Boolean(item.quizId && data.attempts.some((attempt) => attempt.quizId === item.quizId));
  const openChapter = (chapter, query) => navigate(`${coursePath}/chapters/${chapter.id}?${new URLSearchParams(query)}`);
  const toggle = (id) => setClosed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const reorder = (chapterId, entries, id, to) => {
    const ids = moveIds(entries, id, to);
    if (!ids) return;
    const result = reorderCurriculum(course.id, chapterId, ids);
    if (result.ok) message.success('บันทึกลำดับใหม่แล้ว'); else message.error(result.message);
  };
  const confirmRemoval = (chapter, item) => {
    if ((item ? [item] : chapter.items).some(hasHistory)) {
      message.info('มีประวัติการเรียนหรือคำตอบ จึงยังลบรายการนี้ไม่ได้');
      return;
    }
    Modal.confirm({
      title: item ? `นำ “${item.title}” ออกจากบท?` : `ลบบท “${chapter.title}”?`,
      content: item ? 'รายการนี้จะถูกนำออกจากคอร์ส การลบไม่สามารถเลิกทำได้' : `เนื้อหา ${chapter.items.length} รายการในบทนี้จะถูกลบด้วย การลบไม่สามารถเลิกทำได้`,
      okText: item ? 'นำออกจากบท' : 'ลบบท', cancelText: 'ยกเลิก', okButtonProps: { danger: true },
      onOk: () => {
        const result = item ? removeItem(course.id, chapter.id, item.id) : removeChapter(course.id, chapter.id);
        if (!result.ok) { message.error(result.message); return Promise.reject(); }
        message.success(item ? 'นำเนื้อหาออกแล้ว' : 'ลบบทแล้ว');
      },
    });
  };
  const chapterAction = (chapter, index, key) => {
    if (key === 'edit') openChapter(chapter, { view: 'settings' });
    else if (key === 'delete') confirmRemoval(chapter);
    else reorder(null, course.chapters, chapter.id, index + (key === 'up' ? -1 : 1));
  };
  const itemAction = (chapter, item, index, key) => {
    if (key === 'edit') openChapter(chapter, { item: item.id });
    else if (key === 'delete') confirmRemoval(chapter, item);
    else reorder(chapter.id, chapter.items, item.id, index + (key === 'up' ? -1 : 1));
  };
  const createChapter = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    saveChapter(course.id, { title: values.title.trim(), description: values.description?.trim() || '' });
    setCreating(false); form.resetFields(); message.success('เพิ่มบทแล้ว เลือกเพิ่มเนื้อหาเพื่อเริ่มเขียน');
  };

  return <div className="course-curriculum">
    <Breadcrumb items={[
      { title: <Link to={currentUser.role === 'admin' ? '/admin/courses' : '/teach/courses'}>คอร์สทั้งหมด</Link> },
      { title: <Link to={coursePath}>{course.title}</Link> },
      { title: 'โครงสร้างคอร์ส' },
    ]}/>
    <header className="curriculum-page-header">
      <div><h1>โครงสร้างคอร์ส</h1><p>{course.title}</p></div>
      <div className="curriculum-page-actions">
        <Link to={`${coursePath}/preview`}><Button icon={<EyeOutlined/>}>ดูตัวอย่าง</Button></Link>
        <Button type="primary" icon={<PlusOutlined/>} onClick={() => setCreating(true)}>เพิ่มบท</Button>
      </div>
    </header>
    <div className="curriculum-outline-toolbar">
      <div><strong>{course.chapters.length} บท <span>·</span> {total} รายการเรียนรู้</strong><p>เรียงตามลำดับที่ผู้เรียนจะเห็น · กดชื่อเนื้อหาเพื่อเปิดแก้ไข</p></div>
      {course.chapters.length > 0 && <Button type="text" size="small" onClick={() => setClosed(someOpen ? new Set(course.chapters.map((chapter) => chapter.id)) : new Set())}>{someOpen ? 'ยุบทุกบท' : 'เปิดทุกบท'}</Button>}
    </div>
    {course.chapters.length ? <div className="curriculum-outline-list">
      {course.chapters.map((chapter, index) => <CurriculumChapter
        key={chapter.id} chapter={chapter} index={index} length={course.chapters.length}
        expanded={!closed.has(chapter.id)} onToggle={() => toggle(chapter.id)}
        quizzes={data.quizzes} hasHistory={hasHistory} coursePath={coursePath}
        onManage={() => openChapter(chapter, { view: 'settings' })}
        onAdd={(type) => openChapter(chapter, { add: type })}
        onChapterAction={(key) => chapterAction(chapter, index, key)}
        onItemAction={(item, itemIndex, key) => itemAction(chapter, item, itemIndex, key)}
        onReorderItem={(id, to) => reorder(chapter.id, chapter.items, id, to)}
        onDragChapter={() => { draggingChapter.current = chapter.id; }}
        onEndDragChapter={() => { draggingChapter.current = null; }}
        onDropChapter={() => {
          if (draggingChapter.current) reorder(null, course.chapters, draggingChapter.current, index);
          draggingChapter.current = null;
        }}
      />)}
    </div> : <div className="curriculum-outline-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีบทในคอร์สนี้"><p>เริ่มจากตั้งชื่อบท แล้วค่อยเพิ่มวิดีโอ บทอ่าน หรือแบบฝึกหัด</p><Button type="primary" icon={<PlusOutlined/>} onClick={() => setCreating(true)}>เพิ่มบทแรก</Button></Empty></div>}
    <p className="curriculum-order-note"><CheckCircleOutlined/> การเรียงลำดับบันทึกทันที · เขียนและบันทึกเนื้อหาในหน้าจัดการบท</p>
    <Modal title="เพิ่มบทใหม่" open={creating} okText="เพิ่มบท" cancelText="ยกเลิก" onOk={createChapter} onCancel={() => { setCreating(false); form.resetFields(); }}>
      <Form form={form} layout="vertical" className="modal-form">
        <Form.Item name="title" label="ชื่อบท" rules={[{ required: true, whitespace: true, message: 'กรอกชื่อบท' }]}><Input autoFocus placeholder="เช่น เริ่มจากพื้นฐาน" maxLength={160}/></Form.Item>
        <Form.Item name="description" label="คำอธิบายสั้น"><Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="บทนี้ผู้เรียนจะได้เรียนรู้อะไร"/></Form.Item>
      </Form>
    </Modal>
  </div>;
}

function CurriculumChapter({ chapter, index, length, expanded, onToggle, quizzes, hasHistory, coursePath, onManage, onAdd, onChapterAction, onItemAction, onReorderItem, onDragChapter, onEndDragChapter, onDropChapter }) {
  const draggingItem = useRef(null);
  const panelId = `curriculum-panel-${chapter.id}`;
  return <section className="curriculum-outline-chapter" aria-label={`บทที่ ${index + 1}: ${chapter.title}`}>
    <div className="curriculum-outline-heading" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDropChapter(); }}>
      <span className="curriculum-reorder-handle curriculum-chapter-handle" aria-hidden="true" title="ลากเพื่อเรียงบท หรือใช้เมนูเลื่อนขึ้น–ลง" draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', chapter.id); onDragChapter(); }} onDragEnd={onEndDragChapter}><HolderOutlined/></span>
      <button className="curriculum-chapter-toggle" type="button" aria-label={`${expanded ? 'ยุบ' : 'เปิด'}บท ${chapter.title}`} aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>
        <span className="curriculum-chapter-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="curriculum-chapter-copy"><h2>{chapter.title}</h2>{chapter.description && <span className="curriculum-chapter-description">{chapter.description}</span>}<span className="curriculum-chapter-meta">{chapterSummary(chapter)}</span></span>
        <span className="curriculum-expand-icon">{expanded ? <DownOutlined/> : <RightOutlined/>}</span>
      </button>
      <div className="curriculum-chapter-actions">
        <Button onClick={onManage}>จัดการบท</Button>
        <Dropdown trigger={['click']} menu={{ items: orderMenu(index, length, 'ลบบท', chapter.items.some(hasHistory)), onClick: ({ key }) => onChapterAction(key) }}><Button type="text" className="curriculum-menu-button" icon={<MoreOutlined/>} aria-label={`เมนูบท ${chapter.title}`}/></Dropdown>
      </div>
    </div>
    <div id={panelId} hidden={!expanded}>
      <div className="curriculum-outline-contents">
        {chapter.items.length ? chapter.items.map((item, itemIndex) => <div key={item.id} className="curriculum-content-row" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggingItem.current) onReorderItem(draggingItem.current, itemIndex); draggingItem.current = null; }}>
          <span className="curriculum-reorder-handle" aria-hidden="true" title="ลากเพื่อเรียงเนื้อหา หรือใช้เมนูเลื่อนขึ้น–ลง" draggable onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData('text/plain', item.id); draggingItem.current = item.id; }} onDragEnd={() => { draggingItem.current = null; }}><HolderOutlined/></span>
          <ContentTypeIcon type={item.type}/>
          <Link className="curriculum-content-link" to={`${coursePath}/chapters/${chapter.id}?${new URLSearchParams({ item: item.id })}`}><span>{item.title}</span><small>{itemSummary(item, quizzes)}</small></Link>
          <Dropdown trigger={['click']} menu={{ items: orderMenu(itemIndex, chapter.items.length, 'นำออกจากบท', hasHistory(item)), onClick: ({ key }) => onItemAction(item, itemIndex, key) }}><Button type="text" className="curriculum-menu-button" icon={<MoreOutlined/>} aria-label={`เมนูเนื้อหา ${item.title}`}/></Dropdown>
        </div>) : <p className="curriculum-empty-chapter">ยังไม่มีเนื้อหาในบทนี้ เลือกเพิ่มเนื้อหาด้านล่างเพื่อเริ่มต้น</p>}
      </div>
      <div className="curriculum-chapter-bottom">
        <Dropdown trigger={['click']} menu={{ items: contentKinds.map((kind) => ({ ...kind, label: `เพิ่ม${kind.label}` })), onClick: ({ key }) => onAdd(key) }}><Button type="text" icon={<PlusOutlined/>} className="curriculum-add-content">เพิ่มเนื้อหา <DownOutlined/></Button></Dropdown>
        <span>{chapter.items.length} รายการเรียนรู้</span>
      </div>
    </div>
  </section>;
}
