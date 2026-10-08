import React, { Suspense, lazy } from 'react';
import { Alert, Button, Space, Tag, Typography, message } from 'antd';
import { ArrowRightOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '@melearn/store';
import { PageTitle, CourseOutline, UserAvatar, formatPrice, instructorFor } from '@melearn/ui';

const DevCourseDetailPage = import.meta.env.DEV
  ? lazy(() => import('./DevCourseDetailPage.tsx').then((module) => ({ default: module.DevCourseDetailPage })))
  : null;

export function PublicCourseDetailPage() {
  if (import.meta.env.DEV && DevCourseDetailPage) {
    return (
      <Suspense fallback={<div className="public-page"><Typography.Text>กำลังโหลดคอร์ส</Typography.Text></div>}>
        <DevCourseDetailPage />
      </Suspense>
    );
  }
  return <LocalCourseDetailPage />;
}

function LocalCourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data, currentUser, enrollFree } = useLms();
  const course = data.courses.find(
    (item) => (item.slug === slug || item.id === slug) && item.status === 'published'
  );

  if (!course) {
    return (
      <div className="public-page">
        <PageTitle title="ไม่พบคอร์สนี้" />
        <Link to="/courses">กลับไปดูคอร์ส</Link>
      </div>
    );
  }

  const teacher = instructorFor(data, course);
  const enrolled = data.enrollments.some(
    (entry) => entry.courseId === course.id && entry.userId === currentUser?.id
  );
  const login = `/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`;
  const start = () => {
    if (!currentUser) {
      navigate(login);
    } else if (currentUser.role !== 'admin' && currentUser.emailVerified === false) {
      navigate('/verify-email');
    } else if (enrolled) {
      navigate(`/learn/courses/${course.id}`);
    } else if (course.price === 0) {
      const result = enrollFree(course.id);
      if (result.ok) navigate(`/learn/courses/${course.id}`);
      else message.info(result.message);
    } else {
      navigate(`/checkout/${course.id}`);
    }
  };

  return (
    <div className="public-page course-detail-page">
      <div className="detail-hero">
        <div className="detail-hero-copy">
          <Space>
            <Tag>{course.category}</Tag>
            <Typography.Text type="secondary">ระดับ {course.level}</Typography.Text>
          </Space>
          <Typography.Title>{course.title}</Typography.Title>
          <Typography.Paragraph>{course.subtitle}</Typography.Paragraph>
          <div className="teacher-byline">
            <UserAvatar user={teacher} />
            <div>
              <Typography.Text type="secondary">สอนโดย</Typography.Text>
              <Link to={`/instructors/${teacher?.id}`}>{teacher?.name}</Link>
            </div>
          </div>
          <div className="detail-hero-actions">
            <Button type="primary" size="large" onClick={start}>
              {enrolled
                ? 'ไปยังบทเรียน'
                : currentUser
                  ? course.price === 0 ? 'ลงเรียนฟรี' : 'ซื้อคอร์ส'
                  : `เข้าสู่ระบบเพื่อ${course.price === 0 ? 'ลงเรียนฟรี' : 'ซื้อคอร์ส'}`}{' '}
              <ArrowRightOutlined aria-hidden="true" />
            </Button>
            <Typography.Text className="detail-price">
              {formatPrice(course.price)}
            </Typography.Text>
          </div>
        </div>
        <div className="detail-cover">
          <img src={course.cover} alt={`ภาพประกอบคอร์ส ${course.title}`} />
          <span><PlayCircleOutlined aria-hidden="true" /> เรียนด้วยตัวเอง</span>
        </div>
      </div>
      {currentUser?.emailVerified === false && <Alert className="top-space" type="info" showIcon message="ยืนยันอีเมลก่อนลงเรียนหรือซื้อคอร์ส" description={<Link to="/verify-email">เปิดหน้าส่งลิงก์ยืนยันจำลอง</Link>} />}
      <div className="detail-content-grid">
        <main>
          <CourseOutline course={course} />
          <section className="detail-section">
            <Typography.Title level={3}>ผู้สอน</Typography.Title>
            <Typography.Text>{teacher?.name}</Typography.Text>
            <Typography.Paragraph>{teacher?.bio}</Typography.Paragraph>
          </section>
        </main>
        <aside className="detail-side-note">
          <Typography.Title level={4}>เริ่มเรียนในจังหวะของคุณ</Typography.Title>
          <Typography.Paragraph>
            เข้าสู่ระบบเพื่อสมัครคอร์ส เก็บความคืบหน้า และกลับมาเรียนต่อ
          </Typography.Paragraph>
          <Button block type="primary" onClick={start}>
            {enrolled ? 'เรียนต่อ' : currentUser ? 'เริ่มเรียน' : 'เข้าสู่ระบบเพื่อเริ่มเรียน'}
          </Button>
        </aside>
      </div>
    </div>
  );
}
