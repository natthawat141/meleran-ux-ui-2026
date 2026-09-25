import React from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Popconfirm, Radio, Select, Space, Table, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { RichDocument } from '../../components/chapter/RichTextEditor.jsx';
import { PageTitle, StatusTag } from '../../components/common.jsx';
import { WrittenAnswerView } from '../../components/WrittenAnswer.jsx';

const { Text, Title } = Typography;

function QuestionEditor({ form, name, field }) {
  const type = Form.useWatch(['questions', name, 'type'], form) ?? field.type ?? 'choice';
  return <Card size="small" className="question-editor-card" title={`ข้อ ${name + 1}`} extra={<Form.Item name={[field.name, 'type']} noStyle><Select aria-label="ชนิดคำถาม" style={{ width: 180 }} options={[{ value: 'choice', label: 'เลือกตอบ' }, { value: 'essay', label: 'ข้อเขียน / ส่งงาน' }]}/></Form.Item>}>
    <Form.Item name={[field.name, 'prompt']} label="คำถาม" rules={[{ required: true, message: 'เขียนคำถาม' }]}><Input.TextArea rows={2}/></Form.Item>
    <Form.Item name={[field.name, 'points']} label="คะแนน" rules={[{ required: true, message: 'ระบุคะแนน' }]}><InputNumber min={1} max={100}/></Form.Item>
    {type === 'essay' && <Form.Item name={[field.name, 'responseMode']} label="รับคำตอบแบบไหน" initialValue="either"><Select options={[{ value: 'either', label: 'ข้อเขียนหรือรูปภาพ (แนบพร้อมกันได้)' }, { value: 'text', label: 'ข้อเขียนเท่านั้น' }, { value: 'image', label: 'ส่งงานเป็นรูปภาพ' }]}/></Form.Item>}
    {type === 'choice' && <><Form.Item name={[field.name, 'choiceA']} label="ตัวเลือก A" rules={[{ required: true, message: 'เพิ่มตัวเลือก' }]}><Input/></Form.Item><Form.Item name={[field.name, 'choiceB']} label="ตัวเลือก B" rules={[{ required: true, message: 'เพิ่มตัวเลือก' }]}><Input/></Form.Item><Form.Item name={[field.name, 'choiceC']} label="ตัวเลือก C"><Input/></Form.Item><Form.Item name={[field.name, 'correctIndex']} label="คำตอบที่ถูก" rules={[{ required: true, message: 'เลือกคำตอบที่ถูก' }]}><Select options={[{ value: 0, label: 'A' }, { value: 1, label: 'B' }, { value: 2, label: 'C' }]}/></Form.Item></>}
  </Card>;
}

export function QuizManagerPage() {
  const { data, currentUser, removeQuiz } = useLms();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const myCourses = data.courses.filter((course) => (currentUser.role === 'admin' || course.instructorId === currentUser.id) && (!courseId || course.id === courseId));
  const quizzes = data.quizzes.filter((quiz) => myCourses.some((course) => course.id === quiz.courseId));
  const columns = [
    { title: 'แบบทดสอบ', render: (_, quiz) => <div className="table-course-name"><strong>{quiz.title}</strong><Text type="secondary">{quiz.questions.length} ข้อ · เกณฑ์ผ่าน {quiz.passPercent}%</Text></div> },
    { title: 'คอร์ส', render: (_, quiz) => myCourses.find((course) => course.id === quiz.courseId)?.title },
    { title: 'คำตอบ', render: (_, quiz) => data.attempts.filter((attempt) => attempt.quizId === quiz.id).length },
    { title: 'จัดการ', render: (_, quiz) => <Space><Button onClick={() => navigate(`/teach/quizzes/${quiz.id}/attempts`)}>ดูคำตอบ</Button><Button type="primary" onClick={() => navigate(`/teach/quizzes/${quiz.id}`)}>แก้ไข</Button><Popconfirm title="ลบแบบทดสอบนี้หรือไม่" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => { removeQuiz(quiz.id); message.success('ลบแบบทดสอบแล้ว'); }}><Button danger>ลบ</Button></Popconfirm></Space> },
  ];
  return <><PageTitle eyebrow="ผู้สอน" title="แบบทดสอบและงานตรวจ" subtitle="แก้คำถาม ดูคำตอบ และตรวจงานข้อเขียนจากแบบทดสอบที่คุณสร้าง" actions={<Link to="/teach/courses"><Button>ไปยังคอร์ส</Button></Link>}/><Table rowKey="id" dataSource={quizzes} columns={columns} pagination={{ pageSize: 8 }} locale={{ emptyText: 'ยังไม่มีแบบทดสอบในคอร์สของคุณ' }}/></>;
}

export function QuizEditorPage() {
  const { quizId } = useParams();
  const [search] = useSearchParams();
  const { data, currentUser, saveQuiz, removeQuiz } = useLms();
  const navigate = useNavigate();
  const quiz = data.quizzes.find((item) => item.id === quizId);
  const isNew = quizId === 'new';
  const courses = data.courses.filter((course) => currentUser.role === 'admin' || course.instructorId === currentUser.id);
  const selectedCourse = search.get('course') ?? quiz?.courseId ?? courses[0]?.id;
  const course = courses.find((item) => item.id === selectedCourse);
  const initial = quiz ? { title: quiz.title, passPercent: quiz.passPercent, courseId: quiz.courseId, chapterId: course?.chapters.find((chapter) => chapter.items.some((item) => item.quizId === quiz.id))?.id, questions: quiz.questions.map((question) => ({ ...question, choiceA: question.options?.[0], choiceB: question.options?.[1], choiceC: question.options?.[2], correctIndex: question.answer })) } : { title: '', passPercent: 60, courseId: selectedCourse, chapterId: search.get('chapter') ?? course?.chapters[0]?.id, questions: [{ type: 'choice', prompt: '', points: 1, choiceA: '', choiceB: '', choiceC: '', correctIndex: 0 }] };
  const [form] = Form.useForm();
  const watchedCourseId = Form.useWatch('courseId', form) ?? selectedCourse;
  const submit = (values) => {
    if (!values.questions?.length) { message.error('เพิ่มคำถามอย่างน้อย 1 ข้อ'); return; }
    const questions = values.questions.map((question) => question.type === 'choice'
      ? { id: question.id ?? `q-${Math.random().toString(36).slice(2, 8)}`, type: 'choice', prompt: question.prompt, points: Number(question.points || 1), options: [question.choiceA, question.choiceB, question.choiceC].filter(Boolean), answer: Number(question.correctIndex ?? 0) }
      : { id: question.id ?? `q-${Math.random().toString(36).slice(2, 8)}`, type: 'essay', responseMode: question.responseMode ?? 'either', prompt: question.prompt, points: Number(question.points || 1) });
    const id = saveQuiz({ title: values.title, passPercent: values.passPercent, courseId: values.courseId, chapterId: values.chapterId, questions }, quiz?.id);
    message.success(isNew ? 'สร้างแบบทดสอบแล้ว' : 'บันทึกแบบทดสอบแล้ว');
    navigate(`/teach/quizzes/${id}`);
  };
  if (!isNew && !quiz) return <Empty description="ไม่พบแบบทดสอบนี้"/>;
  if (!courses.length) return <Alert type="info" showIcon message="สร้างคอร์สก่อนจึงจะเพิ่มแบบทดสอบได้" action={<Link to="/teach/courses/new">สร้างคอร์ส</Link>}/>;
  return <><PageTitle eyebrow="ตัวแก้แบบทดสอบ" title={isNew ? 'สร้างแบบทดสอบ' : quiz.title} subtitle="จัดคำถาม คะแนน และเกณฑ์ผ่านในที่เดียว" actions={<Link to="/teach/quizzes"><Button>กลับรายการแบบทดสอบ</Button></Link>}/><div className="quiz-editor"><Form form={form} layout="vertical" initialValues={initial} onFinish={submit} key={quiz?.id ?? 'new'}><div className="quiz-editor-top"><Form.Item name="title" label="ชื่อแบบทดสอบ" rules={[{ required: true, message: 'กรอกชื่อแบบทดสอบ' }]}><Input size="large"/></Form.Item><div className="form-columns"><Form.Item name="courseId" label="คอร์ส" rules={[{ required: true }]}><Select options={courses.map((item) => ({ value: item.id, label: item.title }))} onChange={() => form.setFieldValue('chapterId', undefined)}/></Form.Item><Form.Item name="chapterId" label="บทเรียนที่วางแบบทดสอบ" rules={[{ required: true, message: 'เลือกบท' }]}><Select options={(courses.find((item) => item.id === watchedCourseId)?.chapters ?? []).map((chapter) => ({ value: chapter.id, label: chapter.title }))}/></Form.Item><Form.Item name="passPercent" label="เกณฑ์ผ่าน (%)" rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: '100%' }}/></Form.Item></div></div><Title level={4}>คำถาม</Title><Form.List name="questions">{(fields, { add, remove, move }) => <>{fields.map((field, index) => <div className="question-editor-wrap" key={field.key}><QuestionEditor form={form} name={index} field={field}/><Space className="question-order-actions"><Button disabled={index === 0} onClick={() => move(index, index - 1)}>เลื่อนขึ้น</Button><Button disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>เลื่อนลง</Button><Button danger onClick={() => remove(field.name)}>ลบคำถาม</Button></Space></div>)}<Button className="top-space" icon={<PlusOutlined/>} onClick={() => add({ type: 'choice', points: 1, correctIndex: 0 })}>เพิ่มคำถาม</Button></>}</Form.List><Alert className="top-space" type="info" showIcon message="คำถามเลือกตอบตรวจอัตโนมัติ ส่วนข้อเขียนจะเข้าคิวตรวจของผู้สอนก่อนสรุปผลและออกใบรับรอง"/><div className="content-editor-actions"><Button type="primary" htmlType="submit">บันทึกแบบทดสอบ</Button>{!isNew && <Link to={`/teach/quizzes/${quiz.id}/attempts`}><Button>ดูคำตอบ</Button></Link>}{!isNew && <Popconfirm title="ลบแบบทดสอบนี้หรือไม่" description="คำตอบตัวอย่างที่ส่งมาในแบบทดสอบนี้จะไม่ถูกแสดง" okText="ลบแบบทดสอบ" cancelText="ยกเลิก" onConfirm={() => { removeQuiz(quiz.id); navigate('/teach/quizzes'); }}><Button danger>ลบแบบทดสอบ</Button></Popconfirm>}</div></Form></div></>;
}

export function QuizAttemptsPage() {
  const { quizId } = useParams();
  const { data } = useLms();
  const quiz = data.quizzes.find((item) => item.id === quizId);
  const attempts = data.attempts.filter((attempt) => attempt.quizId === quizId && attempt.status === 'submitted');
  if (!quiz) return <Empty description="ไม่พบแบบทดสอบ"/>;
  const columns = [
    { title: 'ผู้เรียน', render: (_, attempt) => data.users.find((user) => user.id === attempt.userId)?.name },
    { title: 'วันที่ส่ง', dataIndex: 'submittedAt', render: (date) => date ? new Date(date).toLocaleDateString('th-TH') : '—' },
    { title: 'คะแนนตัวเลือก', render: (_, attempt) => `${attempt.score ?? 0}/${attempt.maxChoice ?? 0}` },
    { title: 'ข้อเขียน', render: (_, attempt) => <StatusTag status={attempt.essayStatus === 'pending' ? 'pending' : attempt.essayStatus === 'graded' ? 'graded' : '—'}/> },
    { title: '', render: (_, attempt) => attempt.essayStatus === 'pending' ? <Link to={`/teach/attempts/${attempt.id}/grade`}><Button type="primary">ตรวจข้อเขียน</Button></Link> : <Text type="secondary">{attempt.finalPercent ?? attempt.percent}%</Text> },
  ];
  return <><PageTitle eyebrow="ผลแบบทดสอบ" title={quiz.title} subtitle="คำตอบข้อเขียนที่ยังไม่ตรวจจะแสดงไว้ก่อน" actions={<Link to={`/teach/quizzes/${quiz.id}`}><Button>แก้แบบทดสอบ</Button></Link>}/><Table rowKey="id" dataSource={attempts} columns={columns} pagination={{ pageSize: 10 }} locale={{ emptyText: 'ยังไม่มีผู้เรียนส่งคำตอบ' }}/></>;
}

export function GradeEssayPage() {
  const { attemptId } = useParams();
  const { data, gradeAttempt } = useLms();
  const navigate = useNavigate();
  const attempt = data.attempts.find((item) => item.id === attemptId);
  const quiz = data.quizzes.find((item) => item.id === attempt?.quizId);
  const learner = data.users.find((item) => item.id === attempt?.userId);
  const essayQuestions = quiz?.questions.filter((question) => question.type === 'essay') ?? [];
  const [form] = Form.useForm();
  if (!attempt || !quiz) return <Empty description="ไม่พบคำตอบนี้"/>;
  if (attempt.essayStatus !== 'pending') return <Alert type="info" showIcon message="คำตอบนี้ตรวจแล้ว" description={`ผลคะแนน ${attempt.finalPercent ?? attempt.percent}%`} action={<Button onClick={() => navigate(`/teach/quizzes/${quiz.id}/attempts`)}>กลับรายการคำตอบ</Button>}/>;
  const max = essayQuestions.reduce((sum, question) => sum + Number(question.points || 1), 0);
  const submit = (values) => { gradeAttempt(attempt.id, values); message.success('บันทึกคะแนนและแจ้งผลให้ผู้เรียนแล้ว'); navigate(`/teach/quizzes/${quiz.id}/attempts`); };
  return <><PageTitle eyebrow="ตรวจคำตอบและภาพงาน" title="ตรวจงานผู้เรียน" subtitle={`${learner?.name} · ${quiz.title}`} actions={<Link to={`/teach/quizzes/${quiz.id}/attempts`}><Button>กลับรายการคำตอบ</Button></Link>}/><div className="grading-layout"><main><Title level={4}>คำตอบของผู้เรียน</Title>{essayQuestions.map((question, index) => <section className="essay-response" key={question.id}><Text type="secondary">ข้อ {index + 1} · {question.points} คะแนน</Text>{question.promptDoc ? <RichDocument document={question.promptDoc}/> : <Title level={5}>{question.prompt}</Title>}{question.rubric && <p><strong>เกณฑ์ตรวจ: </strong>{question.rubric}</p>}<WrittenAnswerView value={attempt.answers[question.id]}/></section>)}</main><aside className="grading-panel"><Title level={4}>ให้คะแนน</Title><Text type="secondary">คะแนนเต็มส่วนส่งงาน {max} คะแนน</Text><Form form={form} layout="vertical" onFinish={submit}><Form.Item name="score" label="คะแนนที่ให้" rules={[{ required: true, message: 'ใส่คะแนน' }, { type: 'number', min: 0, max, message: `คะแนนต้องอยู่ระหว่าง 0 ถึง ${max}` }]}><InputNumber min={0} max={max} style={{ width: '100%' }}/></Form.Item><Form.Item name="feedback" label="ความคิดเห็นถึงผู้เรียน"><Input.TextArea rows={5} placeholder="อธิบายจุดแข็งและสิ่งที่ควรปรับ"/></Form.Item><Alert type="info" message="คะแนนนี้จะนำไปรวมกับคะแนนเลือกตอบเพื่อตัดสินผลผ่าน และการออกใบรับรอง"/><Button className="top-space" type="primary" block htmlType="submit">บันทึกคะแนน</Button></Form></aside></div></>;
}
