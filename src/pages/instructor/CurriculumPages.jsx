import React from 'react';
import { Alert, Button, Collapse, Empty, Form, Input, Modal, Popconfirm, Space, Typography, message } from 'antd';
import { EditOutlined, FileAddOutlined, PlayCircleOutlined, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { ContentTypeIcon, PageTitle, StatusTag } from '../../components/common.jsx';
import { formatPrice } from '../../data.js';

const { Text, Title } = Typography;

export function CurriculumPage() {
  const { courseId } = useParams();
  const { data, saveChapter, removeChapter, removeItem } = useLms();
  const navigate = useNavigate();
  const course = data.courses.find((item) => item.id === courseId);
  const [chapterForm] = Form.useForm();
  if (!course) return <Empty description="ไม่พบคอร์สนี้"/>;
  const createChapter = () => Modal.confirm({ title: 'เพิ่มบทเรียน', icon: null, content: <Form form={chapterForm} layout="vertical" className="modal-form"><Form.Item name="title" label="ชื่อบท" rules={[{ required: true, message: 'กรอกชื่อบท' }]}><Input autoFocus placeholder="เช่น เริ่มจากพื้นฐาน"/></Form.Item><Form.Item name="description" label="คำอธิบาย"><Input.TextArea rows={2}/></Form.Item></Form>, okText: 'เพิ่มบท', cancelText: 'ยกเลิก', onOk: async () => { try { const values = await chapterForm.validateFields(); saveChapter(course.id, values); chapterForm.resetFields(); message.success('เพิ่มบทแล้ว'); } catch { return Promise.reject(); } } });
  const makeItemPath = (type, chapterId) => type === 'quiz' ? `/teach/quizzes/new?course=${course.id}&chapter=${chapterId}` : `/teach/courses/${course.id}/${type === 'video' ? 'videos' : 'articles'}/new?chapter=${chapterId}`;
  return <><PageTitle eyebrow="จัดการคอร์ส" title="โครงสร้างบทเรียน" subtitle={`${course.title} · ราคา ${formatPrice(course.price)}`} actions={<Space><Link to={`/teach/courses/${course.id}`}><Button>ภาพรวม</Button></Link><Button type="primary" icon={<PlusOutlined/>} onClick={createChapter}>เพิ่มบท</Button></Space>}/><div className="curriculum-help">จัดบทเรียนจากบนลงล่าง เพิ่มวิดีโอ บทความ หรือแบบทดสอบไว้ภายในบท แล้วเปิดดูตัวอย่างก่อนเผยแพร่</div>
    {course.chapters.length ? <div className="curriculum-chapters">{course.chapters.map((chapter, index) => <section className="curriculum-chapter" key={chapter.id}><div className="curriculum-chapter-head"><div><Text type="secondary">บทที่ {index + 1}</Text><Title level={4}>{chapter.title}</Title><Text type="secondary">{chapter.description}</Text></div><Space wrap><Button icon={<EditOutlined/>} onClick={() => navigate(`/teach/courses/${course.id}/chapters/${chapter.id}`)}>แก้บท</Button><Popconfirm title="ลบบทนี้หรือไม่" description="รายการเรียนรู้ภายในบทจะถูกนำออกจากคอร์ส" okText="ลบบท" cancelText="ยกเลิก" onConfirm={() => { removeChapter(course.id, chapter.id); message.success('ลบบทแล้ว'); }}><Button danger>ลบ</Button></Popconfirm></Space></div>
        <div className="curriculum-items">{chapter.items.map((item) => <div className="curriculum-item" key={item.id}><ContentTypeIcon type={item.type}/><div><strong>{item.title}</strong><Text type="secondary">{item.type === 'video' ? `วิดีโอ · ${item.duration || 'ไม่ระบุเวลา'}` : item.type === 'article' ? `บทความ · ${item.readingMinutes || 0} นาที` : `แบบทดสอบ · ${data.quizzes.find((quiz) => quiz.id === item.quizId)?.questions.length ?? 0} ข้อ`}</Text></div><Button onClick={() => navigate(item.type === 'quiz' ? `/teach/quizzes/${item.quizId}` : `/teach/courses/${course.id}/${item.type === 'video' ? 'videos' : 'articles'}/${item.id}?chapter=${chapter.id}`)}>แก้ไข</Button><Popconfirm title="ลบรายการนี้หรือไม่" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => { removeItem(course.id, chapter.id, item.id); message.success('ลบรายการแล้ว'); }}><Button danger>ลบ</Button></Popconfirm></div>)}</div>
        <div className="chapter-content-count"><span>{chapter.items.filter((item) => item.type === 'video').length} วิดีโอ</span><span>{chapter.items.filter((item) => item.type === 'quiz').length} แบบฝึกหัด</span><span>{chapter.items.filter((item) => item.type === 'article').length} บทความ</span></div>
        <div className="add-learning-content"><div><Text strong>เพิ่มเนื้อหาในบทนี้</Text><p>เพิ่มวิดีโอและแบบฝึกหัดได้หลายรายการในบทเดียว</p></div><Space wrap><Button icon={<PlusOutlined/>} onClick={() => navigate(makeItemPath('video', chapter.id))}>เพิ่มวิดีโอ</Button><Button icon={<PlusOutlined/>} onClick={() => navigate(makeItemPath('article', chapter.id))}>เพิ่มบทความ</Button><Button icon={<PlusOutlined/>} onClick={() => navigate(makeItemPath('quiz', chapter.id))}>เพิ่มแบบฝึกหัด</Button></Space></div>
      </section>)}</div> : <div className="learning-empty"><Empty description="เริ่มต้นด้วยการเพิ่มบทแรก"><Button type="primary" onClick={createChapter}>เพิ่มบท</Button></Empty></div>}
    <div className="curriculum-footer"><Link to={`/teach/courses/${course.id}/preview`}><Button type="primary">ดูตัวอย่างคอร์ส</Button></Link><Link to={`/teach/courses/${course.id}/settings`}><Button>ตั้งค่าคอร์ส</Button></Link></div>
  </>;
}

export function ChapterEditorPage() {
  const { courseId, chapterId } = useParams();
  const { data, saveChapter, removeChapter } = useLms();
  const navigate = useNavigate();
  const course = data.courses.find((item) => item.id === courseId);
  const chapter = course?.chapters.find((item) => item.id === chapterId);
  const [form] = Form.useForm();
  if (!course || !chapter) return <Empty description="ไม่พบบทนี้"/>;
  const submit = (values) => { saveChapter(course.id, { ...values, id: chapter.id, items: chapter.items }); message.success('บันทึกบทแล้ว'); navigate(`/teach/courses/${course.id}/curriculum`); };
  return <><PageTitle eyebrow="แก้บทเรียน" title={chapter.title} subtitle={`อยู่ในคอร์ส ${course.title}`} actions={<Link to={`/teach/courses/${course.id}/curriculum`}><Button>กลับโครงสร้างบท</Button></Link>}/><div className="content-editor-panel"><Form form={form} layout="vertical" initialValues={chapter} onFinish={submit}><Form.Item label="ชื่อบท" name="title" rules={[{ required: true, message: 'กรอกชื่อบท' }]}><Input size="large"/></Form.Item><Form.Item label="คำอธิบาย" name="description"><Input.TextArea rows={4}/></Form.Item><Button type="primary" htmlType="submit">บันทึกบท</Button><Popconfirm title="ลบบทนี้หรือไม่" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => { removeChapter(course.id, chapter.id); navigate(`/teach/courses/${course.id}/curriculum`); }}><Button danger className="left-space">ลบบท</Button></Popconfirm></Form></div></>;
}

export function ContentEditorPage({ type }) {
  const { courseId, itemId } = useParams();
  const [search] = useSearchParams();
  const { data, saveItem } = useLms();
  const navigate = useNavigate();
  const course = data.courses.find((item) => item.id === courseId);
  const found = course?.chapters.flatMap((chapter) => chapter.items.map((item) => ({ ...item, chapterId: chapter.id }))).find((item) => item.id === itemId);
  const chapterId = found?.chapterId ?? search.get('chapter');
  const chapter = course?.chapters.find((item) => item.id === chapterId);
  const initial = found ?? { type, title: '', duration: '', readingMinutes: 5, videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', articleBody: '' };
  const [form] = Form.useForm();
  if (!course || !chapter) return <Empty description="ไม่พบบทที่จะเพิ่มเนื้อหา"/>;
  const isNew = itemId === 'new';
  const submit = (values) => { saveItem(course.id, chapter.id, { ...values, type, id: isNew ? undefined : itemId }); message.success('บันทึกเนื้อหาแล้ว'); navigate(`/teach/courses/${course.id}/curriculum`); };
  return <><PageTitle eyebrow={type === 'video' ? 'วิดีโอ' : 'บทความ'} title={isNew ? `เพิ่ม${type === 'video' ? 'วิดีโอ' : 'บทความ'}` : `แก้${type === 'video' ? 'วิดีโอ' : 'บทความ'}`} subtitle={`${course.title} · ${chapter.title}`} actions={<Link to={`/teach/courses/${course.id}/curriculum`}><Button>กลับโครงสร้างบท</Button></Link>}/><div className="content-editor-panel"><Form form={form} layout="vertical" initialValues={initial} onFinish={submit}><Form.Item name="title" label="ชื่อเนื้อหา" rules={[{ required: true, message: 'กรอกชื่อเนื้อหา' }]}><Input size="large"/></Form.Item>{type === 'video' ? <><Form.Item name="videoUrl" label="URL วิดีโอ" rules={[{ required: true, type: 'url', message: 'ใส่ URL วิดีโอที่เปิดได้' }]}><Input placeholder="https://..."/></Form.Item><Form.Item name="duration" label="ความยาววิดีโอ"><Input placeholder="เช่น 08:20"/></Form.Item><Form.Item name="description" label="คำอธิบาย"><Input.TextArea rows={3}/></Form.Item><Alert type="info" showIcon message="ตัวอย่างวิดีโอเปิดให้เล่นได้ในหน้าเรียน ใช้ URL สาธารณะที่เบราว์เซอร์เข้าถึงได้"/></> : <><Form.Item name="readingMinutes" label="เวลาอ่านโดยประมาณ (นาที)"><Input type="number" min={1}/></Form.Item><Form.Item name="articleBody" label="เนื้อหาบทความ" rules={[{ required: true, message: 'เพิ่มเนื้อหาบทความ' }]}><Input.TextArea rows={14} placeholder="แบ่งย่อหน้าด้วยการเว้นบรรทัด"/></Form.Item><Text type="secondary">หน้าเรียนจะแสดงบทความแบบอ่านเต็มความกว้าง พร้อมข้อมูลผู้เขียนและบทเรียนถัดไป</Text></>}<div className="content-editor-actions"><Button type="primary" htmlType="submit">บันทึกเนื้อหา</Button><Button onClick={() => navigate(`/teach/courses/${course.id}/preview`)}>ดูตัวอย่างคอร์ส</Button></div></Form></div></>;
}
