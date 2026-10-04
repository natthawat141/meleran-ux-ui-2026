import React from 'react';
import { Alert, Button, Empty, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { PageTitle, StoryParagraphs } from '../../components/common';
import { useLms } from '../../store';
import { getCoursePreviewLesson } from '../../lib/course-preview';
import { formatPrice } from '../../data';

const { Text, Title } = Typography;

export function CourseLessonPreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useLms();
  const course = data.courses.find((entry) => (entry.slug === slug || entry.id === slug) && entry.status === 'published');

  if (!course) return <Empty description="ไม่พบคอร์สที่เผยแพร่" />;
  const preview = getCoursePreviewLesson(course);

  if (!preview) {
    return (
      <div className="public-page">
        <PageTitle title={course.title} subtitle="คอร์สนี้ยังไม่มีวิดีโอหรือบทความสำหรับทดลองเรียน" />
        <Link to={`/courses/${course.slug}`}><Button>กลับไปหน้าคอร์ส</Button></Link>
      </div>
    );
  }

  return (
    <div className="public-page course-detail-page">
      <Link className="lesson-breadcrumb" to={`/courses/${course.slug}`}>
        <ArrowLeftOutlined /> กลับหน้าคอร์ส
      </Link>
      <PageTitle
        eyebrow="ทดลองเรียน · ดูได้โดยไม่ต้องสมัคร"
        title={course.title}
        subtitle={`${preview.chapter.title} · ${preview.item.title}`}
        actions={<Link to={`/courses/${course.slug}`}><Button type="primary">ดูรายละเอียดและสมัคร</Button></Link>}
      />
      <article className="article-reader">
        {preview.item.type === 'video' ? (
          <div className="video-frame">
            {preview.item.videoUrl ? (
              <video controls preload="metadata" playsInline src={preview.item.videoUrl} aria-label={preview.item.title}>
                เบราว์เซอร์นี้ไม่รองรับวิดีโอ
              </video>
            ) : (
              <Empty description="ยังไม่มีวิดีโอสำหรับบทเรียนนี้" />
            )}
          </div>
        ) : (
          <div className="article-reader-content">
            <Tag>{preview.chapter.title}</Tag>
            <Title level={2}>{preview.item.title}</Title>
            <Text type="secondary">ตัวอย่างบทเรียนจาก {course.title}</Text>
            <StoryParagraphs text={preview.item.articleBody || preview.item.content} document={preview.item.articleDoc} />
          </div>
        )}
        <div className="article-reader-content">
          {preview.item.type === 'video' && (
            <>
              <Tag>{preview.chapter.title}</Tag>
              <Title level={3}>{preview.item.title}</Title>
              <Typography.Paragraph>{preview.item.description || course.description}</Typography.Paragraph>
            </>
          )}
          <Alert
            showIcon
            icon={<LockOutlined />}
            type="info"
            message="นี่คือตัวอย่างบทแรก"
            description={`สมัครคอร์สเพื่อเรียนต่อ · ${formatPrice(course.price)}`}
            action={<Link to={`/courses/${course.slug}`}><Button size="small">สมัครเรียน</Button></Link>}
          />
        </div>
      </article>
    </div>
  );
}
