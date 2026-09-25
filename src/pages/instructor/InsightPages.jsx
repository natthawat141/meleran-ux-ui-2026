import React from 'react';
import { Alert, Avatar, Button, Empty, Progress, Table, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { PageTitle, StatusTag } from '../../components/common.jsx';
import { flattenItems } from '../../data.js';

const { Text, Title } = Typography;

export function CoursePreviewPage() {
  const { courseId } = useParams();
  const { data, saveCourse } = useLms();
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) return <Empty description="ไม่พบคอร์สนี้"/>;
  const checks = [
    ['มีชื่อและคำอธิบายคอร์ส', Boolean(course.title && course.description)],
    ['มีอย่างน้อยหนึ่งบท', course.chapters.length > 0],
    ['มีเนื้อหาในบทเรียน', flattenItems(course).length > 0],
    ['แบบทดสอบมีคำถาม', data.quizzes.filter((quiz) => quiz.courseId === courseId).every((quiz) => quiz.questions.length > 0)],
  ];
  const ready = checks.every(([, pass]) => pass);
  return <><PageTitle eyebrow="ตัวอย่างสำหรับผู้เรียน" title={course.title} subtitle="ตรวจเนื้อหาและข้อมูลที่ผู้เรียนจะเห็นก่อนเผยแพร่" actions={<Link to={`/teach/courses/${course.id}/curriculum`}><Button>กลับไปแก้เนื้อหา</Button></Link>}/><div className="preview-layout"><main className="preview-main"><img className="preview-course-image" src={course.cover} alt=""/><div className="preview-course-info"><Tag>{course.category}</Tag><StatusTag status={course.status}/><Title level={3}>{course.title}</Title><Text type="secondary">{course.subtitle}</Text><p>{course.description}</p><strong>{course.price ? `฿${course.price}` : 'เรียนฟรี'}</strong></div><div className="preview-outline">{course.chapters.map((chapter, index) => <div key={chapter.id}><strong>บทที่ {index + 1} · {chapter.title}</strong>{chapter.items.map((item) => <div key={item.id}>{item.type === 'video' ? 'วิดีโอ' : item.type === 'article' ? 'บทความ' : 'แบบทดสอบ'} · {item.title}</div>)}</div>)}</div></main><aside className="preview-readiness"><Title level={4}>ความพร้อมก่อนเผยแพร่</Title>{checks.map(([label, pass]) => <div className="readiness-item" key={label}>{pass ? <CheckCircleOutlined className="is-ready"/> : <ExclamationCircleOutlined className="needs-work"/>}<Text>{label}</Text></div>)}<Alert className="top-space" type={ready ? 'success' : 'warning'} showIcon message={ready ? 'ตรวจเบื้องต้นครบแล้ว' : 'ยังมีรายการที่ต้องเติม'}/><Button className="top-space" block type="primary" disabled={!ready || course.status === 'published'} onClick={() => { saveCourse({ ...course, status: 'published' }, course.id); message.success('เผยแพร่คอร์สแล้ว'); }}>{course.status === 'published' ? 'เผยแพร่แล้ว' : 'เผยแพร่คอร์ส'}</Button></aside></div></>;
}

export function InstructorLearnersPage() {
  const { courseId } = useParams();
  const { data, currentUser } = useLms();
  const courses = data.courses.filter((course) => course.instructorId === currentUser.id && (!courseId || course.id === courseId));
  const courseIds = courses.map((course) => course.id);
  const enrollments = data.enrollments.filter((item) => courseIds.includes(item.courseId));
  const rows = enrollments.map((enrollment) => {
    const course = data.courses.find((item) => item.id === enrollment.courseId);
    const learner = data.users.find((item) => item.id === enrollment.userId);
    const items = flattenItems(course);
    const completed = items.filter((item) => item.type === 'quiz' ? data.attempts.some((attempt) => attempt.quizId === item.quizId && attempt.userId === learner.id && attempt.passed) : data.progress[`${course.id}:${item.id}`]?.[learner.id]).length;
    return { id: enrollment.id, learner, course, completed, total: items.length, percent: items.length ? Math.round(completed / items.length * 100) : 0, certificate: data.certificates.some((cert) => cert.userId === learner.id && cert.courseId === course.id) };
  });
  const columns = [
    { title: 'ผู้เรียน', render: (_, row) => <div className="learner-table-person"><Avatar>{row.learner?.name?.slice(0,1)}</Avatar><span><strong>{row.learner?.name}</strong><Text type="secondary">{row.learner?.email}</Text></span></div> },
    { title: 'คอร์ส', render: (_, row) => row.course?.title },
    { title: 'ความคืบหน้า', render: (_, row) => <div className="learner-progress-cell"><Progress percent={row.percent} size="small"/><Text type="secondary">{row.completed}/{row.total}</Text></div> },
    { title: 'ใบรับรอง', render: (_, row) => row.certificate ? <Tag color="success">ออกแล้ว</Tag> : <Tag>ยังไม่ครบ</Tag> },
  ];
  return <><PageTitle eyebrow="ข้อมูลผู้เรียน" title={courseId ? courses[0]?.title ?? 'ผู้เรียน' : 'ผู้เรียนในคอร์สของฉัน'} subtitle="ความคืบหน้าและสถานะใบรับรองมาจากกิจกรรมที่เกิดขึ้นในต้นแบบ"/><Table rowKey="id" dataSource={rows} columns={columns} pagination={{ pageSize: 10 }} locale={{ emptyText: 'ยังไม่มีผู้เรียนลงทะเบียน' }}/></>;
}
