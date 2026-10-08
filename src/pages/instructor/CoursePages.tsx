import React from 'react';
import {
  Button,
  Col,
  Empty,
  Row,
  Space,
  Table,
  Typography,
  type TableProps,
} from 'antd';
import { ArrowRightOutlined, BookOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { CourseCard, SectionHeading } from '../../components/common';
import { PageTitle, StatusTag } from '@melearn/ui';
import { flattenItems } from '../../data';
import type { Course } from '../../types';

const { Text, Title } = Typography;

export function InstructorDashboardPage() {
  const { data, currentUser } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const courses = data.courses.filter(
    (course) => currentUser?.role === 'admin' || course.instructorId === currentUserId
  );
  const courseIds = courses.map((course) => course.id);
  const pending = data.attempts.filter(
    (attempt) => courseIds.includes(attempt.courseId) && attempt.essayStatus === 'pending'
  );
  const learners = new Set(
    data.enrollments
      .filter((enrollment) => courseIds.includes(enrollment.courseId))
      .map((enrollment) => enrollment.userId)
  );

  return (
    <>
      <PageTitle
        eyebrow="พื้นที่ผู้สอน"
        title={`สวัสดี ${currentUser?.name ?? 'ผู้สอน'}`}
        subtitle="จัดคอร์สของคุณและติดตามสิ่งที่ผู้เรียนต้องการจากคุณ"
        actions={
          <Link to="/teach/courses/new">
            <Button type="primary" icon={<PlusOutlined />}>
              สร้างคอร์ส
            </Button>
          </Link>
        }
      />
      <div className="instructor-overview">
        <div>
          <span>คอร์สของคุณ</span>
          <strong>{courses.length}</strong>
          <Link to="/teach/courses">
            จัดการคอร์ส <ArrowRightOutlined />
          </Link>
        </div>
        <div>
          <span>ผู้เรียนที่ลงทะเบียน</span>
          <strong>{learners.size}</strong>
          <Link to="/teach/learners">
            ดูความคืบหน้า <ArrowRightOutlined />
          </Link>
        </div>
        <div>
          <span>ข้อเขียนรอตรวจ</span>
          <strong>{pending.length}</strong>
          <Link to="/teach/quizzes">
            เปิดงานตรวจ <ArrowRightOutlined />
          </Link>
        </div>
      </div>
      <SectionHeading title="งานที่รอคุณ" description="คำตอบข้อเขียนจากผู้เรียนจะปรากฏที่นี่" />
      {pending.length ? (
        <div className="pending-review-list">
          {pending.slice(0, 4).map((attempt) => {
            const quiz = data.quizzes.find((item) => item.id === attempt.quizId);
            const learner = data.users.find((item) => item.id === attempt.userId);
            return (
              <div key={attempt.id}>
                <div>
                  <strong>{quiz?.title}</strong>
                  <Text type="secondary">
                    {learner?.name} ·{' '}
                    {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString('th-TH') : '—'}
                  </Text>
                </div>
                {currentUser?.role === 'instructor' && (
                  <Link to={`/teach/attempts/${attempt.id}/grade`}>
                    <Button>ตรวจคำตอบ</Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="muted-block">ไม่มีคำตอบค้างตรวจ</div>
      )}
      <SectionHeading
        title="คอร์สที่คุณดูแล"
        description="เปิดเพื่อดูเนื้อหา แก้ไข หรือดูตัวอย่างในมุมผู้เรียน"
        action={<Link to="/teach/courses">ดูทั้งหมด</Link>}
      />
      <Row gutter={[20, 20]}>
        {courses.slice(0, 3).map((course) => (
          <Col xs={24} md={12} xl={8} key={course.id}>
            <CourseCard course={course} data={data} href={`/teach/courses/${course.id}`} />
            <div className="instructor-card-actions">
              <StatusTag status={course.status} />
              <Link to={`/teach/courses/${course.id}/curriculum`}>จัดบทเรียน</Link>
            </div>
          </Col>
        ))}
      </Row>
    </>
  );
}

export function InstructorCoursesPage() {
  const { data, currentUser } = useLms();
  const navigate = useNavigate();
  const courses = data.courses.filter(
    (course) => currentUser?.role === 'admin' || course.instructorId === currentUser?.id
  );

  const columns: TableProps<Course>['columns'] = [
    {
      title: 'คอร์ส',
      render: (_, course) => (
        <div className="table-course-name">
          <strong>{course.title}</strong>
          <Text type="secondary">
            {course.category} · {flattenItems(course).length} รายการ
          </Text>
        </div>
      ),
    },
    { title: 'ราคา', render: (_, course) => (course.price ? `฿${course.price}` : 'ฟรี') },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      render: (status: Course['status']) => <StatusTag status={status} />,
    },
    {
      title: 'แก้ไขล่าสุด',
      dataIndex: 'updatedAt',
      render: (value?: string) => (value ? new Date(value).toLocaleDateString('th-TH') : '—'),
    },
    {
      title: 'การจัดการ',
      render: (_, course) => (
        <Space wrap>
          <Button onClick={() => navigate(`/teach/courses/${course.id}/settings`)}>
            แก้ข้อมูล
          </Button>
          <Button type="primary" onClick={() => navigate(`/teach/courses/${course.id}/curriculum`)}>
            จัดเนื้อหา
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        eyebrow="ผู้สอน"
        title="คอร์สของฉัน"
        subtitle="สร้างคอร์ส จัดโครงบทเรียน และเตรียมคอร์สก่อนเผยแพร่"
        actions={
          <Link to="/teach/courses/new">
            <Button type="primary" icon={<PlusOutlined />}>
              สร้างคอร์ส
            </Button>
          </Link>
        }
      />
      <Table<Course>
        rowKey="id"
        columns={columns}
        dataSource={courses}
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: 'ยังไม่มีคอร์ส กดสร้างคอร์สเพื่อเริ่มต้น' }}
      />
    </>
  );
}

export function InstructorCourseOverviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data } = useLms();
  const course = data.courses.find((item) => item.id === courseId);

  if (!course) return <Empty description="ไม่พบคอร์สนี้" />;

  const studentCount = data.enrollments.filter((item) => item.courseId === course.id).length;
  const questionCount = data.quizzes
    .filter((quiz) => quiz.courseId === course.id)
    .reduce((sum, quiz) => sum + quiz.questions.length, 0);

  return (
    <>
      <PageTitle
        eyebrow="ภาพรวมคอร์ส"
        title={course.title}
        subtitle="ตรวจสถานะและไปยังงานจัดการคอร์สที่เกี่ยวข้อง"
        actions={
          <Link to={`/teach/courses/${course.id}/settings`}>
            <Button>แก้ข้อมูลคอร์ส</Button>
          </Link>
        }
      />
      <div className="course-admin-intro">
        <img src={course.cover} alt="" />
        <div>
          <StatusTag status={course.status} />
          <Title level={3}>{course.subtitle}</Title>
          <Text type="secondary">
            {course.chapters.length} บท · {flattenItems(course).length} รายการ · {studentCount} ผู้เรียน
          </Text>
        </div>
      </div>
      <div className="manage-shortcuts">
        <Link to={`/teach/courses/${course.id}/curriculum`}>
          <BookOutlined />
          <strong>จัดโครงบทเรียน</strong>
          <span>เพิ่มและเรียงบท วิดีโอ บทความ หรือแบบทดสอบ</span>
        </Link>
        <Link to={`/teach/courses/${course.id}/learners`}>
          <TeamOutlined />
          <strong>ดูความคืบหน้าผู้เรียน</strong>
          <span>
            {studentCount} ผู้เรียน · {questionCount} คำถามในแบบทดสอบ
          </span>
        </Link>
        <Link to={`/teach/courses/${course.id}/preview`}>
          <ArrowRightOutlined />
          <strong>ดูตัวอย่างก่อนเผยแพร่</strong>
          <span>ตรวจมุมมองผู้เรียนและความพร้อมของเนื้อหา</span>
        </Link>
      </div>
    </>
  );
}
