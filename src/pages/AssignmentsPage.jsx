import React, { useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { ArrowRightOutlined, PlusOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useLms } from '../store.jsx';
import { PageTitle } from '../components/common.jsx';
import './assignments-analytics.css';

const { Text } = Typography;

export function AssignmentsPage() {
  const { data, currentUser, saveAssignment, removeAssignment, cancelAssignment } = useLms();
  return currentUser?.role === 'learner'
    ? <LearnerAssignments data={data} currentUser={currentUser}/>
    : <ManageAssignments data={data} currentUser={currentUser} saveAssignment={saveAssignment} removeAssignment={removeAssignment} cancelAssignment={cancelAssignment}/>;
}

function ManageAssignments({ data, currentUser, saveAssignment, removeAssignment, cancelAssignment }) {
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const watchedCourseId = Form.useWatch('courseId', form);
  const courses = data.courses.filter((course) => currentUser.role === 'admin' || course.instructorId === currentUser.id);
  const assignmentRows = data.assignments.filter((entry) => courses.some((course) => course.id === entry.courseId));
  const quizzes = data.quizzes.filter((quiz) => quiz.courseId === watchedCourseId);
  const eligibleLearners = data.enrollments.filter((entry) => entry.courseId === watchedCourseId).map((entry) => data.users.find((user) => user.id === entry.userId)).filter((user) => user?.role === 'learner');
  const attemptsFor = (assignmentId) => data.attempts.filter((attempt) => attempt.assignmentId === assignmentId);

  const openCreate = () => {
    const course = courses[0];
    const quiz = data.quizzes.find((item) => item.courseId === course?.id);
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ courseId: course?.id, quizId: quiz?.id, learnerIds: [] });
    setOpen(true);
  };
  const openEdit = (assignment) => {
    setEditing(assignment);
    form.setFieldsValue({ ...assignment, learnerIds: assignment.learnerIds });
    setOpen(true);
  };
  const close = () => { setOpen(false); setEditing(null); form.resetFields(); };
  const save = (values) => {
    const result = saveAssignment(values, editing?.id);
    if (!result.ok) { message.error(result.message); return; }
    message.success(editing ? 'บันทึกการมอบหมายแล้ว' : 'มอบหมายแบบฝึกหัดแล้ว');
    close();
  };
  const remove = (assignment) => {
    const result = removeAssignment(assignment.id);
    if (!result.ok) { message.error(result.message); return; }
    message.success('ลบรายการมอบหมายแล้ว');
  };

  const columns = [
    { title: 'งานที่มอบหมาย', render: (_, row) => <div className="assignment-primary"><strong>{row.title}</strong><Text type="secondary">{data.quizzes.find((quiz) => quiz.id === row.quizId)?.title ?? 'ไม่พบแบบฝึกหัด'}</Text></div> },
    { title: 'คอร์ส / ผู้สอน', render: (_, row) => { const course = courses.find((item) => item.id === row.courseId); return <div>{course?.title}{currentUser.role === 'admin' && <Text type="secondary" className="assignment-block">{data.users.find((user) => user.id === course?.instructorId)?.name}</Text>}</div>; } },
    { title: 'ผู้เรียน', render: (_, row) => { const count = row.learnerIds.length; const names = row.learnerIds.map((id) => data.users.find((user) => user.id === id)?.name).filter(Boolean); return <Tooltip title={names.join('、')}><span>{count} คน{names.length ? <Text type="secondary" className="assignment-block">{names.slice(0, 2).join('、')}{names.length > 2 ? ` และอีก ${names.length - 2} คน` : ''}</Text> : null}</span></Tooltip>; } },
    { title: 'สถานะ / คำตอบ', render: (_, row) => <Space direction="vertical" size={4}><Tag color={row.status === 'active' ? 'blue' : 'default'}>{row.status === 'active' ? 'กำลังมอบหมาย' : 'ยกเลิกแล้ว'}</Tag><Text type="secondary">{attemptsFor(row.id).length} รอบ</Text></Space> },
    { title: 'จัดการ', render: (_, row) => { const hasHistory = attemptsFor(row.id).length > 0; return <Space wrap>
      <Tooltip title={hasHistory ? 'มีประวัติคำตอบแล้ว จึงแก้รายชื่อและโจทย์ไม่ได้' : undefined}><Button disabled={hasHistory || row.status !== 'active'} onClick={() => openEdit(row)}>แก้ไข</Button></Tooltip>
      {row.status === 'active' && <Popconfirm title="ยกเลิกงานนี้?" description="ผู้เรียนจะเริ่มรอบใหม่ไม่ได้ แต่ประวัติที่ส่งแล้วจะยังอยู่" okText="ยกเลิกงาน" cancelText="กลับ" onConfirm={() => { const result = cancelAssignment(row.id); result.ok ? message.success('ยกเลิกงานแล้ว') : message.error(result.message); }}><Button>ยกเลิกงาน</Button></Popconfirm>}
      {!hasHistory && <Popconfirm title="ลบรายการมอบหมาย?" description="รายการนี้จะหายจากกล่องงานของผู้เรียน" okText="ลบรายการ" cancelText="กลับ" okButtonProps={{ danger: true }} onConfirm={() => remove(row)}><Button danger>ลบ</Button></Popconfirm>}
    </Space>; } },
  ];

  if (!courses.length) return <><PageTitle eyebrow="งานแบบฝึกหัด" title="มอบหมายแบบฝึกหัด" subtitle="เลือกคอร์ส แบบฝึกหัด และผู้เรียนที่ลงทะเบียนในคอร์สนั้น"/><Empty description="ยังไม่มีคอร์สในขอบเขตที่คุณจัดการ"/></>;
  return <div className="assignment-page">
    <PageTitle eyebrow={currentUser.role === 'admin' ? 'จัดการระบบ' : 'พื้นที่ผู้สอน'} title="มอบหมายแบบฝึกหัด" subtitle="ผู้เรียนจะเห็นเฉพาะงานที่ระบุบัญชีไว้และลงทะเบียนในคอร์สนั้น" actions={<Button type="primary" icon={<PlusOutlined/>} onClick={openCreate}>มอบหมายงาน</Button>}/>
    <Alert showIcon type="info" message="กำหนดผู้รับจากรายชื่อผู้เรียนที่ลงทะเบียนแล้ว" description="วันครบกำหนดและจำนวนครั้งที่ทำได้ยังไม่ได้กำหนด จึงยังไม่แสดงในต้นแบบนี้"/>
    <div className="assignment-table-wrap"><Table rowKey="id" columns={columns} dataSource={assignmentRows} pagination={{ pageSize: 8 }} scroll={{ x: 900 }} locale={{ emptyText: 'ยังไม่มีงานที่มอบหมาย' }}/></div>
    <Modal title={editing ? 'แก้ไขการมอบหมาย' : 'มอบหมายแบบฝึกหัด'} open={open} onCancel={close} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save} className="assignment-form">
        <Form.Item name="courseId" label="คอร์ส" rules={[{ required: true, message: 'เลือกคอร์ส' }]}><Select disabled={Boolean(editing)} options={courses.map((course) => ({ value: course.id, label: course.title }))} onChange={(courseId) => { const firstQuiz = data.quizzes.find((quiz) => quiz.courseId === courseId); form.setFieldsValue({ quizId: firstQuiz?.id, learnerIds: [] }); }}/></Form.Item>
        <Form.Item name="quizId" label="แบบฝึกหัด" rules={[{ required: true, message: 'เลือกแบบฝึกหัด' }]}><Select disabled={Boolean(editing)} options={quizzes.map((quiz) => ({ value: quiz.id, label: quiz.title }))} placeholder="เลือกแบบฝึกหัดในคอร์ส"/></Form.Item>
        <Form.Item name="title" label="ชื่อที่ผู้เรียนเห็น" rules={[{ required: true, whitespace: true, message: 'กรอกชื่องาน' }]}><Input maxLength={100} placeholder="เช่น แบบฝึกหัดท้ายบทที่ 2"/></Form.Item>
        <Form.Item name="instructions" label="คำชี้แจงเพิ่มเติม"><Input.TextArea rows={3} maxLength={500} placeholder="บอกผู้เรียนว่าควรเตรียมตัวหรือส่งอะไร"/></Form.Item>
        <Form.Item name="learnerIds" label="มอบหมายให้ผู้เรียน" rules={[{ required: true, type: 'array', min: 1, message: 'เลือกผู้เรียนอย่างน้อยหนึ่งคน' }]} extra="แสดงเฉพาะผู้เรียนที่ลงทะเบียนในคอร์สนี้"><Select mode="multiple" maxTagCount="responsive" options={eligibleLearners.map((learner) => ({ value: learner.id, label: `${learner.name} · ${learner.email}` }))} placeholder={eligibleLearners.length ? 'ค้นหาและเลือกผู้เรียน' : 'ยังไม่มีผู้เรียนลงทะเบียน'} disabled={!eligibleLearners.length}/></Form.Item>
        {!eligibleLearners.length && <Alert type="warning" showIcon message="คอร์สนี้ยังไม่มีผู้เรียนที่ลงทะเบียน" description="เพิ่มการลงทะเบียนก่อนจึงจะมอบหมายงานได้"/>}
        <div className="assignment-form-actions"><Button onClick={close}>ยกเลิก</Button><Button type="primary" htmlType="submit" disabled={!eligibleLearners.length}>{editing ? 'บันทึกการเปลี่ยนแปลง' : 'มอบหมายงาน'}</Button></div>
      </Form>
    </Modal>
  </div>;
}

function LearnerAssignments({ data, currentUser }) {
  const navigate = useNavigate();
  const assignments = useMemo(() => data.assignments.filter((entry) => entry.learnerIds.includes(currentUser.id)).map((assignment) => ({
    ...assignment,
    course: data.courses.find((course) => course.id === assignment.courseId),
    quiz: data.quizzes.find((quiz) => quiz.id === assignment.quizId),
    attempt: data.attempts.find((attempt) => attempt.assignmentId === assignment.id && attempt.userId === currentUser.id),
  })), [data, currentUser.id]);
  const activeCount = assignments.filter((entry) => entry.status === 'active').length;
  return <div className="assignment-page">
    <PageTitle eyebrow="พื้นที่เรียนรู้" title="งานแบบฝึกหัดของฉัน" subtitle="งานที่ผู้สอนมอบหมายให้คุณโดยตรง"/>
    {!assignments.length ? <Empty description="ยังไม่มีงานที่มอบหมายถึงคุณ"/> : <>
      <p className="assignment-count">มีงานที่ยังเปิดอยู่ {activeCount} รายการ</p>
      <div className="learner-assignment-list">{assignments.map((entry) => {
        const attempt = entry.attempt;
        const pending = attempt?.essayStatus === 'pending';
        const state = entry.status !== 'active' ? ['ยกเลิกแล้ว', 'default'] : attempt?.status === 'in_progress' ? ['กำลังทำ', 'processing'] : pending ? ['รอตรวจข้อเขียน', 'warning'] : attempt?.status === 'submitted' ? [attempt.passed ? 'ผ่านแล้ว' : attempt.passed === false ? 'ยังไม่ผ่าน' : 'ส่งแล้ว', attempt.passed ? 'success' : 'blue'] : ['ยังไม่เริ่ม', 'default'];
        const destination = !entry.quiz ? null : attempt?.status === 'in_progress' ? `/learn/attempts/${attempt.id}` : attempt?.status === 'submitted' ? `/learn/attempts/${attempt.id}/result` : `/learn/quizzes/${entry.quiz.id}?assignmentId=${encodeURIComponent(entry.id)}`;
        return <article className="learner-assignment-card" key={entry.id}>
          <div className="learner-assignment-copy"><div className="learner-assignment-meta"><Tag color={state[1]}>{state[0]}</Tag><Text type="secondary">{entry.course?.title ?? 'ไม่พบคอร์ส'}</Text></div><h2>{entry.title}</h2><p>{entry.instructions || entry.quiz?.title || 'แบบฝึกหัดที่ได้รับมอบหมาย'}</p><Text type="secondary">{entry.quiz?.questions.length ?? 0} ข้อ · ผู้สอน {data.users.find((user) => user.id === entry.course?.instructorId)?.name ?? 'ไม่ทราบชื่อ'}</Text></div>
          {destination ? <Button onClick={() => navigate(destination)} disabled={entry.status !== 'active' && !attempt} type={attempt?.status === 'in_progress' ? 'primary' : undefined} icon={<ArrowRightOutlined/>}>{attempt?.status === 'in_progress' ? 'ทำต่อ' : attempt?.status === 'submitted' ? 'ดูผลล่าสุด' : entry.status === 'active' ? 'เริ่มทำ' : 'ดูงาน'}</Button> : <Text type="secondary">แบบฝึกหัดนี้ไม่พร้อมใช้งาน</Text>}
        </article>;
      })}</div>
    </>}
  </div>;
}
