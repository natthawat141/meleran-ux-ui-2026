import React, { useMemo, useState } from 'react';
import { Alert, Avatar, Button, Col, Input, Row, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined, BookOutlined, CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../store.jsx';
import { CourseCard, PageTitle, SectionHeading } from '../components/common.jsx';
import { CourseCartButton } from '../components/CourseCartButton.jsx';
import { getCoursePreviewLesson } from '../lib/course-preview.ts';
import { formatPrice, flattenItems, instructorFor } from '../data.js';

const { Title, Text, Paragraph } = Typography;

export function CatalogPage() {
  const { data } = useLms();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ทั้งหมด');
  const categories = ['ทั้งหมด', ...new Set(data.courses.filter((course) => course.status === 'published').map((course) => course.category))];
  const filtered = useMemo(() => data.courses.filter((course) => course.status === 'published' && (category === 'ทั้งหมด' || course.category === category) && `${course.title} ${course.subtitle} ${course.category}`.toLowerCase().includes(query.toLowerCase())), [data.courses, category, query]);
  return <div className="public-page catalog-page"><PageTitle eyebrow="สำรวจคอร์ส" title="เลือกเรื่องที่อยากเรียนรู้" subtitle="ดูภาพรวม เนื้อหา ผู้สอน และเวลาเรียน ก่อนตัดสินใจเริ่มคอร์ส"/><div className="catalog-controls"><Input aria-label="ค้นหาคอร์ส" prefix={<SearchOutlined />} placeholder="ค้นหาชื่อคอร์สหรือหัวข้อ" value={query} onChange={(event) => setQuery(event.target.value)} allowClear/><Space wrap>{categories.map((item) => <Button key={item} type={category === item ? 'primary' : 'default'} onClick={() => setCategory(item)}>{item}</Button>)}</Space></div><Text type="secondary" className="result-count">{filtered.length} คอร์ส</Text>{filtered.length ? <Row gutter={[22, 22]} className="catalog-grid">{filtered.map((course) => <Col xs={24} sm={12} xl={8} key={course.id}><CourseCard course={course} data={data} action={course.price > 0 ? <CourseCartButton course={course} block/> : null}/></Col>)}</Row> : <div className="empty-page">ไม่พบคอร์ส ลองเปลี่ยนคำค้นหรือหมวดหมู่</div>}</div>;
}

export function CourseDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, currentUser, enrollFree } = useLms();
  const course = data.courses.find((item) => (item.slug === slug || item.id === slug) && item.status === 'published');
  if (!course) return <div className="public-page"><PageTitle title="ไม่พบคอร์สนี้"/><Link to="/courses">กลับไปดูคอร์ส</Link></div>;
  const teacher = instructorFor(data, course);
  const hasPreview = Boolean(getCoursePreviewLesson(course));
  const enrolled = data.enrollments.some((entry) => entry.courseId === course.id && entry.userId === currentUser?.id);
  const referralCode = new URLSearchParams(location.search).get('ref')?.trim();
  const referralQuery = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : '';
  const start = () => {
    if (!currentUser) { navigate(`/login?next=${encodeURIComponent(`/courses/${course.slug}${referralQuery}`)}`); return; }
    if (course.price === 0) { enrollFree(course.id, undefined, referralCode); navigate(`/learn/courses/${course.id}`); }
    else navigate(`/checkout/${course.id}${referralQuery}`);
  };
  return <div className="public-page course-detail-page">
    <div className="detail-hero"><div className="detail-hero-copy"><Space><Tag>{course.category}</Tag><Text type="secondary">ระดับ {course.level}</Text></Space><Title>{course.title}</Title><Paragraph>{course.subtitle}</Paragraph><div className="teacher-byline"><Avatar>{teacher?.name?.slice(0, 1)}</Avatar><div><Text type="secondary">สอนโดย</Text><Link to={`/instructors/${teacher?.id}`}>{teacher?.name}</Link></div></div><div className="detail-hero-actions"><Button size="large" type="primary" onClick={enrolled ? () => navigate(`/learn/courses/${course.id}`) : start}>{enrolled ? 'ไปยังบทเรียน' : course.price === 0 ? 'ลงเรียนฟรี' : 'ซื้อคอร์ส'} <ArrowRightOutlined /></Button>{course.price > 0 && !enrolled && <CourseCartButton course={course} referralCode={referralCode} size="large"/>}{hasPreview && <Link to={`/courses/${course.slug}/preview`}><Button>ทดลองเรียนบทแรก</Button></Link>}<Text className="detail-price">{formatPrice(course.price)}</Text></div></div><div className="detail-cover"><img src={course.cover} alt={`ภาพประกอบคอร์ส ${course.title}`}/><span><PlayCircleOutlined /> เรียนด้วยตัวเอง</span></div></div>
    <div className="detail-content-grid"><main><section className="detail-section"><Title level={3}>คุณจะได้เรียนรู้อะไร</Title><ul className="outcome-list">{course.outcomes?.map((outcome) => <li key={outcome}><CheckCircleOutlined /> {outcome}</li>)}</ul></section><section className="detail-section"><Title level={3}>เนื้อหาในคอร์ส</Title><Text type="secondary">{course.chapters.length} บท · {flattenItems(course).length} รายการเรียนรู้</Text><div className="public-course-outline">{course.chapters.map((chapter, index) => <div key={chapter.id}><div className="outline-chapter-head"><strong>บทที่ {index + 1} · {chapter.title}</strong><Text type="secondary">{chapter.items.length} รายการ</Text></div>{chapter.items.map((item) => <div className="outline-lesson" key={item.id}><span>{item.type === 'video' ? 'วิดีโอ' : item.type === 'article' ? 'บทความ' : 'แบบทดสอบ'}</span><span>{item.title}</span><Text type="secondary">{item.duration ?? (item.readingMinutes ? `${item.readingMinutes} นาที` : '')}</Text></div>)}</div>)}</div></section><section className="detail-section"><Title level={3}>ผู้สอน</Title><Link className="instructor-inline" to={`/instructors/${teacher?.id}`}><Avatar size={52}>{teacher?.name?.slice(0, 1)}</Avatar><div><Text strong>{teacher?.name}</Text><Text type="secondary">{teacher?.bio}</Text></div><ArrowRightOutlined /></Link></section></main><aside className="detail-side-note"><div><ClockCircleOutlined /> เรียนเมื่อไรก็ได้</div><div><BookOutlined /> เข้าเรียนได้ทุกบทเมื่อสมัครแล้ว</div><div><CheckCircleOutlined /> มีแบบทดสอบและติดตามความคืบหน้า</div><Button block type="primary" size="large" onClick={enrolled ? () => navigate(`/learn/courses/${course.id}`) : start}>{enrolled ? 'เรียนต่อ' : course.price === 0 ? 'ลงเรียนฟรี' : `ซื้อคอร์ส · ${formatPrice(course.price)}`}</Button></aside></div>
  </div>;
}

export function InstructorProfilePage() {
  const { id } = useParams();
  const { data } = useLms();
  const teacher = data.users.find((user) => user.id === id);
  if (!teacher) return <div className="public-page"><PageTitle title="ไม่พบโปรไฟล์ผู้สอน"/></div>;
  const courses = data.courses.filter((course) => course.instructorId === id && course.status === 'published');
  return <div className="public-page instructor-profile"><section className="instructor-profile-head"><Avatar size={88}>{teacher.name.slice(0, 1)}</Avatar><div><Tag>ผู้สอน</Tag><Title>{teacher.name}</Title><Paragraph>{teacher.bio || 'ผู้สอนที่ร่วมแบ่งปันความรู้และประสบการณ์'}</Paragraph></div></section><SectionHeading title="คอร์สที่สอน" description={`${courses.length} คอร์ส`}/><Row gutter={[22, 22]}>{courses.map((course) => <Col xs={24} sm={12} lg={8} key={course.id}><CourseCard course={course} data={data}/></Col>)}</Row></div>;
}
