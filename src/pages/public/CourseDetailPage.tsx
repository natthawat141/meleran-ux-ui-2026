import React from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle } from '../../components/common';
import { CourseOutline } from '../../components/CourseOutline';
import { UserAvatar } from '../../components/UserAvatar';
import { formatPrice, instructorFor } from '../../data';
import { getCoursePreviewLesson } from '../../lib/course-preview';

export function PublicCourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useLms();
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
  const hasPreview = Boolean(getCoursePreviewLesson(course));
  const login = `/login?next=${encodeURIComponent(`/explore/courses/${course.slug}`)}`;

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
            <Link to={login}>
              <Button type="primary" size="large">
                เข้าสู่ระบบเพื่อ{course.price === 0 ? 'ลงเรียนฟรี' : 'ซื้อคอร์ส'}{' '}
                <ArrowRightOutlined aria-hidden="true" />
              </Button>
            </Link>
            {hasPreview && (
              <Link to={`/courses/${course.slug}/preview`}>
                <Button size="large">ทดลองเรียนบทแรก</Button>
              </Link>
            )}
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
          <Link to={login}>
            <Button block type="primary">เข้าสู่ระบบเพื่อเริ่มเรียน</Button>
          </Link>
          {hasPreview && (
            <Link to={`/courses/${course.slug}/preview`}>
              <Button block className="top-space">ทดลองเรียนบทแรก</Button>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
