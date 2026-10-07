import React from 'react';
import { Alert, Avatar, Button, Collapse, Divider, Empty, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { ContentTypeIcon, PageTitle, StoryParagraphs } from '../../components/common';
import { flattenItems, instructorFor } from '../../data';
import type { ArticleItem, Course, CourseItem, LmsData, VideoItem } from '../../types';

const { Title, Text, Paragraph } = Typography;

function getCourseItem(data: LmsData, courseId?: string, itemId?: string) {
  const course = data.courses.find((item) => item.id === courseId);
  const chapter = course?.chapters.find((part) => part.items.some((item) => item.id === itemId));
  const item = chapter?.items.find((entry) => entry.id === itemId);
  const sequence = course ? flattenItems(course) : [];
  const index = sequence.findIndex((entry) => entry.id === itemId);
  return { course, chapter, item, sequence, index };
}

interface LessonSidebarProps {
  course: Course;
  currentItem: CourseItem;
  data: LmsData;
}

function LessonSidebar({ course, currentItem, data }: LessonSidebarProps) {
  const chapters = course.chapters.map((chapter, index) => ({
    key: chapter.id,
    label: `บทที่ ${index + 1} · ${chapter.title}`,
    children: chapter.items.map((item) => (
      <Link
        className={`lesson-nav-item${item.id === currentItem.id ? ' active' : ''}`}
        key={item.id}
        to={`/learn/courses/${course.id}/${
          item.type === 'video' ? 'videos' : item.type === 'article' ? 'articles' : 'quizzes'
        }/${item.id}`}
      >
        <ContentTypeIcon type={item.type} />
        <span>{item.title}</span>
      </Link>
    )),
  }));

  return (
    <aside className="lesson-contents">
      <Text className="page-eyebrow">เนื้อหาคอร์ส</Text>
      <Title level={5}>{course.title}</Title>
      <Collapse ghost items={chapters} />
    </aside>
  );
}

export function LearnerCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data, currentUser } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const course = data.courses.find((item) => item.id === courseId);
  const enrolled = data.enrollments.some(
    (entry) => entry.courseId === courseId && entry.userId === currentUserId
  );

  if (!course) return <Empty description="ไม่พบคอร์สนี้" />;
  if (!enrolled) {
    return (
      <Alert
        type="warning"
        showIcon
        message="ต้องลงเรียนก่อนจึงจะเปิดเนื้อหาได้"
        action={<Space><Link to={`/courses/${course.slug}`}>รายละเอียดและสมัคร</Link></Space>}
      />
    );
  }

  const items = flattenItems(course);
  const first = items[0];
  const teacher = instructorFor(data, course);

  return (
    <>
      <PageTitle
        eyebrow="ภาพรวมคอร์ส"
        title={course.title}
        subtitle={course.subtitle}
        actions={
          first && (
            <Link
              to={`/learn/courses/${course.id}/${
                first.type === 'video'
                  ? 'videos'
                  : first.type === 'article'
                  ? 'articles'
                  : 'quizzes'
              }/${first.id}`}
            >
              <Button type="primary">
                เริ่มเรียน <ArrowRightOutlined />
              </Button>
            </Link>
          )
        }
      />
      <div className="learning-course-header">
        <img src={course.cover} alt="" />
        <div>
          <Tag>{course.category}</Tag>
          <Text type="secondary">
            ผู้สอน {teacher?.name} · {items.length} รายการเรียนรู้
          </Text>
        </div>
      </div>
      <div className="learning-chapter-list">
        {course.chapters.map((chapter, index) => (
          <section className="learning-chapter" key={chapter.id}>
            <div className="learning-chapter-title">
              <div>
                <Text type="secondary">บทที่ {index + 1}</Text>
                <Title level={4}>{chapter.title}</Title>
                <Text type="secondary">{chapter.description}</Text>
              </div>
            </div>
            {chapter.items.map((item) => (
              <Link
                className="learning-content-row"
                key={item.id}
                to={`/learn/courses/${course.id}/${
                  item.type === 'video'
                    ? 'videos'
                    : item.type === 'article'
                    ? 'articles'
                    : 'quizzes'
                }/${item.id}`}
              >
                <ContentTypeIcon type={item.type} />
                <span>{item.title}</span>
                <Text type="secondary">
                  {item.type === 'video'
                    ? item.duration
                    : item.type === 'article'
                    ? (item.readingMinutes ? `${item.readingMinutes} นาที` : '')
                    : 'แบบทดสอบ'}
                </Text>
                <ArrowRightOutlined />
              </Link>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

export function VideoLessonPage() {
  const { courseId, itemId } = useParams<{ courseId: string; itemId: string }>();
  const navigate = useNavigate();
  const { data, currentUser, markContentDone } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const { course, chapter, item, sequence, index } = getCourseItem(data, courseId, itemId);

  if (!course || !chapter || !item || item.type !== 'video') {
    return <Empty description="ไม่พบวิดีโอนี้" />;
  }
  const enrolled = data.enrollments.some((entry) => entry.courseId === course.id && entry.userId === currentUser?.id);
  if (!enrolled) {
    return <Alert type="warning" showIcon message="บทนี้เปิดหลังสมัครคอร์ส" description={<Link to={`/explore/courses/${course.slug}`}>ดูรายละเอียดและสมัครเรียน</Link>} />;
  }

  const videoItem = item as VideoItem;
  const done = Boolean(data.progress[`${courseId}:${itemId}`]?.[currentUserId]);
  const teacher = instructorFor(data, course);
  const next = sequence[index + 1];
  const nextPath =
    next &&
    `/learn/courses/${course.id}/${
      next.type === 'video' ? 'videos' : next.type === 'article' ? 'articles' : 'quizzes'
    }/${next.id}`;

  return (
    <>
      <div className="lesson-breadcrumb">
        <Link to={`/learn/courses/${course.id}`}>
          <ArrowLeftOutlined /> {course.title}
        </Link>
        <span>/</span>
        <Text type="secondary">{chapter.title}</Text>
      </div>
      <div className="lesson-layout">
        <main className="lesson-main">
          <div className="video-frame">
            <video
              controls
              preload="metadata"
              playsInline
              src={videoItem.videoUrl}
              aria-label={videoItem.title}
              onEnded={() => markContentDone(course.id, videoItem.id)}
            >
              เบราว์เซอร์นี้ไม่รองรับวิดีโอ
            </video>
          </div>
          <div className="lesson-copy">
            <Space>
              <Tag>{chapter.title}</Tag>
              {done && <Tag color="success">เรียนแล้ว</Tag>}
            </Space>
            <Title level={3}>{videoItem.title}</Title>
            <Text type="secondary">
              โดย {teacher?.name} · {videoItem.duration ?? 'วิดีโอประกอบบทเรียน'}
            </Text>
            <Divider />
            <Paragraph>{videoItem.description || course.description}</Paragraph>
            <div className="lesson-footer">
              <Button
                disabled={done}
                onClick={() => markContentDone(course.id, videoItem.id)}
                icon={<CheckCircleOutlined />}
              >
                {done ? 'ทำเครื่องหมายแล้ว' : 'ทำเครื่องหมายว่าเรียนจบ'}
              </Button>
              {nextPath && (
                <Button type="primary" onClick={() => navigate(nextPath)}>
                  ไปบทถัดไป <ArrowRightOutlined />
                </Button>
              )}
            </div>
          </div>
        </main>
        <LessonSidebar course={course} currentItem={videoItem} data={data} />
      </div>
    </>
  );
}

export function ArticleLessonPage() {
  const { courseId, itemId } = useParams<{ courseId: string; itemId: string }>();
  const navigate = useNavigate();
  const { data, currentUser, markContentDone } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const { course, chapter, item, sequence, index } = getCourseItem(data, courseId, itemId);

  if (!course || !chapter || !item || item.type !== 'article') {
    return <Empty description="ไม่พบบทความนี้" />;
  }
  const enrolled = data.enrollments.some((entry) => entry.courseId === course.id && entry.userId === currentUser?.id);
  if (!enrolled) {
    return <Alert type="warning" showIcon message="บทนี้เปิดหลังสมัครคอร์ส" description={<Link to={`/explore/courses/${course.slug}`}>ดูรายละเอียดและสมัครเรียน</Link>} />;
  }

  const articleItem = item as ArticleItem;
  const teacher = instructorFor(data, course);
  const next = sequence[index + 1];
  const nextPath =
    next &&
    `/learn/courses/${course.id}/${
      next.type === 'video' ? 'videos' : next.type === 'article' ? 'articles' : 'quizzes'
    }/${next.id}`;
  const done = Boolean(data.progress[`${courseId}:${itemId}`]?.[currentUserId]);

  return (
    <>
      <div className="lesson-breadcrumb">
        <Link to={`/learn/courses/${course.id}`}>
          <ArrowLeftOutlined /> {course.title}
        </Link>
        <span>/</span>
        <Text type="secondary">{chapter.title}</Text>
      </div>
      <div className="lesson-layout article-layout">
        <article className="article-reader">
          <div className="article-cover">
            <img src={course.cover} alt="" />
          </div>
          <div className="article-reader-content">
            <div className="article-kicker">
              {chapter.title} · อ่าน {articleItem.readingMinutes ?? 5} นาที
            </div>
            <Title>{articleItem.title}</Title>
            <div className="article-author">
              <Avatar>{teacher?.name?.slice(0, 1)}</Avatar>
              <span>
                <Text strong>{teacher?.name}</Text>
                <Text type="secondary">
                  ผู้สอน · {course.title}
                </Text>
              </span>
            </div>
            <Divider />
            <StoryParagraphs text={articleItem.articleBody} document={articleItem.articleDoc} />
            <Alert type="info" showIcon message="ลองจดหนึ่งแนวคิดที่คุณจะนำไปใช้หลังอ่านจบ" />
            <div className="lesson-footer">
              <Button
                disabled={done}
                onClick={() => markContentDone(course.id, articleItem.id)}
                icon={<CheckCircleOutlined />}
              >
                {done ? 'อ่านจบแล้ว' : 'ทำเครื่องหมายว่าอ่านจบ'}
              </Button>
              {nextPath && (
                <Button type="primary" onClick={() => navigate(nextPath)}>
                  อ่านต่อ <ArrowRightOutlined />
                </Button>
              )}
            </div>
          </div>
        </article>
        <LessonSidebar course={course} currentItem={articleItem} data={data} />
      </div>
    </>
  );
}
