import React from 'react';
import { Button, Col, Empty, Row, Typography } from 'antd';
import { ArrowRightOutlined, BookOutlined, ClockCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useLms } from '../../store';
import { CourseCard, CourseProgress, PageTitle, SectionHeading } from '../../components/common';
import { flattenItems, instructorFor } from '../../data';
import type { Course, LmsData } from '../../types';

const { Title, Text } = Typography;

function learnerCourses(data: LmsData, userId: string): Course[] {
  const ids = data.enrollments.filter((item) => item.userId === userId).map((item) => item.courseId);
  return data.courses.filter((course) => ids.includes(course.id));
}

export function LearnerDashboardPage() {
  const { data, currentUser } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const courses = learnerCourses(data, currentUserId);
  const active = courses.find((course) =>
    flattenItems(course).some((item) => !data.progress[`${course.id}:${item.id}`]?.[currentUserId])
  );
  const nextItem =
    active &&
    flattenItems(active).find(
      (item) => item.type !== 'quiz' && !data.progress[`${active.id}:${item.id}`]?.[currentUserId]
    );
  const teacher = active ? instructorFor(data, active) : null;
  const totalDone = courses.reduce(
    (sum, course) =>
      sum +
      flattenItems(course).filter((item) =>
        'quizId' in item
          ? data.attempts.some(
              (attempt) =>
                attempt.quizId === item.quizId &&
                attempt.userId === currentUserId &&
                attempt.passed
            )
          : data.progress[`${course.id}:${item.id}`]?.[currentUserId]
      ).length,
    0
  );

  return (
    <>
      <PageTitle
        eyebrow="พื้นที่ผู้เรียน"
        title={`สวัสดี ${currentUser?.name ?? 'ผู้เรียน'}`}
        subtitle="เรียนต่อจากจุดเดิม หรือเลือกทักษะใหม่ที่อยากฝึกวันนี้"
        actions={
          <Link to="/explore/courses">
            <Button type="primary">
              สำรวจคอร์ส <ArrowRightOutlined />
            </Button>
          </Link>
        }
      />
      {active ? (
        <section className="resume-learning">
          <div className="resume-image" style={{ backgroundImage: `url("${active.cover}")` }} />
          <div className="resume-copy">
            <Text className="page-eyebrow">เรียนต่อจากจุดเดิม</Text>
            <Title level={3}>{active.title}</Title>
            <Text type="secondary">
              {nextItem?.title ?? 'คอร์สนี้ใกล้จบแล้ว'} · ผู้สอน {teacher?.name}
            </Text>
            <CourseProgress course={active} data={data} userId={currentUserId} />
            <Link
              to={
                nextItem
                  ? `/learn/courses/${active.id}/${
                      nextItem.type === 'video'
                        ? 'videos'
                        : nextItem.type === 'article'
                        ? 'articles'
                        : 'quizzes'
                    }/${nextItem.id}`
                  : `/learn/courses/${active.id}`
              }
            >
              <Button type="primary" icon={<PlayCircleOutlined />}>
                เรียนต่อ
              </Button>
            </Link>
          </div>
        </section>
      ) : (
        <div className="learning-empty">
          <Empty description="ยังไม่มีคอร์สที่กำลังเรียน">
            <Link to="/explore/courses">
              <Button type="primary">เลือกคอร์สแรก</Button>
            </Link>
          </Empty>
        </div>
      )}
      <div className="learner-summary">
        <div>
          <BookOutlined />
          <span>
            <strong>{courses.length}</strong> คอร์สที่ลงเรียน
          </span>
        </div>
        <div>
          <ClockCircleOutlined />
          <span>
            <strong>{totalDone}</strong> บทเรียนที่ทำเสร็จ
          </span>
        </div>
        <div>
          <span className="summary-check">✓</span>
          <span>
            <strong>
              {data.certificates.filter((item) => item.userId === currentUserId).length}
            </strong>{' '}
            ใบรับรอง
          </span>
        </div>
      </div>
      <SectionHeading
        title="คอร์สของฉัน"
        description="กลับมาเรียนเมื่อพร้อม"
        action={
          <Link to="/learn/courses">
            ดูทั้งหมด <ArrowRightOutlined />
          </Link>
        }
      />
      {courses.length ? (
        <Row gutter={[20, 20]}>
          {courses.slice(0, 3).map((course) => (
            <Col xs={24} md={12} xl={8} key={course.id}>
              <CourseCard course={course} data={data} href={`/learn/courses/${course.id}`} />
            </Col>
          ))}
        </Row>
      ) : (
        <p className="muted-block">คอร์สที่คุณสมัครจะปรากฏที่นี่</p>
      )}
    </>
  );
}

export function MyCoursesPage() {
  const { data, currentUser } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const courses = learnerCourses(data, currentUserId);

  return (
    <>
      <PageTitle
        eyebrow="ผู้เรียน"
        title="คอร์สของฉัน"
        subtitle="ดูความคืบหน้าและกลับไปยังบทเรียนที่ต้องการ"
        actions={
          <Link to="/explore/courses">
            <Button>ค้นหาคอร์ส</Button>
          </Link>
        }
      />
      {courses.length ? (
        <Row gutter={[20, 20]}>
          {courses.map((course) => (
            <Col xs={24} md={12} xl={8} key={course.id}>
              <CourseCard course={course} data={data} href={`/learn/courses/${course.id}`} />
              <div className="my-course-progress">
                <CourseProgress course={course} data={data} userId={currentUserId} />
              </div>
            </Col>
          ))}
        </Row>
      ) : (
        <div className="learning-empty">
          <Empty description="คุณยังไม่ได้ลงเรียนคอร์ส">
            <Link to="/explore/courses">
              <Button type="primary">เลือกคอร์สที่สนใจ</Button>
            </Link>
          </Empty>
        </div>
      )}
    </>
  );
}
