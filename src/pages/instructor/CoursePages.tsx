import React from 'react';
import {
  Button,
  Col,
  Empty,
  Form,
  Switch,
  Row,
  Space,
  Table,
  Typography,
  message,
  type TableProps,
} from 'antd';
import { ArrowRightOutlined, BookOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { CourseCard, PageTitle, SectionHeading, StatusTag } from '../../components/common';
import { flattenItems } from '../../data';
import defaultCourseCover from '../../assets/generated/course-default-v2.png';
import { ImageUploadField } from '../../components/ImageUploadField';
import type { Course } from '../../types';
import {
  CourseMetadataEditor,
  type CourseMetadataFormValues,
} from '../../features/course-authoring/CourseMetadataEditor';

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

export function CourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data, saveCourse, submitCourseForReview, publishCourse, setCourseAiEnabled, currentUser } = useLms();
  const navigate = useNavigate();
  const course = data.courses.find((item) => item.id === courseId);
  const isNew = !courseId || courseId === 'new';
  const [form] = Form.useForm<CourseMetadataFormValues>();

  const initialValues: Partial<CourseMetadataFormValues> = course
    ? {
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        outcomesText: course.outcomes?.join('\n'),
        cover: course.cover,
        instructorId: course.instructorId,
        category: course.category,
        level: course.level,
        price: course.price,
        pricingType: course.price === 0 ? 'free' : 'paid',
      }
    : {
        category: 'การสื่อสาร',
        level: 'เริ่มต้น',
        price: 0,
        pricingType: 'free' as const,
        instructorId: currentUser?.role === 'instructor' ? currentUser.id : '',
      };

  const latestReturn = [...(course?.reviewHistory ?? [])].reverse().find((event) => event.action === 'returned');

  const submit = (values: CourseMetadataFormValues) => {
    if (values.pricingType === 'paid' && Number(values.price) <= 0) {
      message.error('กรอกราคามากกว่า 0 บาทสำหรับคอร์สที่มีค่าใช้จ่าย');
      return;
    }
    const { outcomesText, pricingType, ...rest } = values;
    const savedId = saveCourse(
      {
        ...rest,
        price: pricingType === 'free' ? 0 : Number(values.price),
        outcomes: (outcomesText ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        instructorId:
          currentUser?.role === 'admin'
            ? values.instructorId
            : course?.instructorId ?? currentUser?.id ?? '',
      },
      course?.id
    );

    if (!savedId) {
      message.error('ไม่สามารถบันทึกคอร์สนี้ได้');
      return;
    }
    message.success(isNew ? 'สร้างคอร์สแล้ว' : 'บันทึกข้อมูลคอร์สแล้ว การแก้คอร์สที่รอตรวจหรืออนุมัติจะกลับเป็นฉบับร่างและต้องส่งตรวจใหม่');
    navigate(`/teach/courses/${savedId}`);
  };

  if (!isNew && !course) return <Empty description="ไม่พบคอร์สนี้" />;

  return (
    <>
      <PageTitle
        eyebrow={isNew ? 'สร้างคอร์ส' : 'ตั้งค่าคอร์ส'}
        title={isNew ? 'สร้างคอร์สใหม่' : 'แก้ไขข้อมูลคอร์ส'}
        subtitle="เริ่มจากข้อมูลสำคัญ เลือกภาพปก แล้วบันทึกเพื่อไปจัดบทเรียน"
        actions={
          <Link to={isNew ? '/teach/courses' : `/teach/courses/${course?.id}/curriculum`}>
            <Button>
              {isNew ? 'กลับไปคอร์สของฉัน' : 'จัดบทเรียน'} {!isNew && <ArrowRightOutlined />}
            </Button>
          </Link>
        }
      />
      <CourseMetadataEditor
        form={form}
        initialValues={initialValues}
        isNew={isNew}
        savedCourse={
          course
            ? { id: course.id, status: course.status, price: course.price }
            : undefined
        }
        canAssignInstructor={currentUser?.role === 'admin'}
        instructors={
          currentUser?.role === 'admin'
            ? data.users
                .filter((user) => user.role === 'instructor')
                .map((user) => ({ id: user.id, name: user.name }))
            : []
        }
        returnedReason={latestReturn?.reason}
        canSubmitForReview={
          course?.status === 'draft' &&
          (currentUser?.role === 'instructor' || currentUser?.role === 'admin')
        }
        canPublish={course?.status === 'approved'}
        adminExtension={
          !isNew && currentUser?.role === 'admin' && course ? (
            <section className="editor-section" aria-labelledby="course-ai-settings-heading">
              <div className="course-editor-section-heading">
                <span>AI</span>
                <div>
                  <Title level={4} id="course-ai-settings-heading">Melearn AI สำหรับคอร์สนี้</Title>
                  <p>เปิดเพื่อให้ผู้เรียนที่ลงทะเบียนเลือกใช้ความรู้จากคอร์สนี้ในหน้า Melearn AI</p>
                </div>
              </div>
              <Switch
                checked={course.aiEnabled === true}
                checkedChildren="เปิด"
                unCheckedChildren="ปิด"
                aria-label="เปิด Melearn AI สำหรับคอร์สนี้"
                onChange={(enabled) => {
                  const result = setCourseAiEnabled(course.id, enabled);
                  if (result.ok) message.success(result.message); else message.error(result.message);
                }}
              />
              <p>การตั้งค่านี้ไม่เปลี่ยนผลการเรียนหรือสถานะอนุมัติคอร์ส</p>
            </section>
          ) : null
        }
        defaultCover={defaultCourseCover}
        ImageUploadField={ImageUploadField}
        StatusTag={StatusTag}
        onFinish={submit}
        onSubmitForReview={() => {
          if (!course) return;
          const result = submitCourseForReview(course.id);
          if (result.ok) message.success(result.message);
          else message.error(result.message);
        }}
        onPublish={() => {
          if (!course) return;
          const result = publishCourse(course.id);
          if (result.ok) message.success(result.message);
          else message.error(result.message);
        }}
        previewAction={
          course ? (
            <Link to={`/teach/courses/${course.id}/preview`}>
              <Button block className="top-space">ดูตัวอย่างคอร์ส</Button>
            </Link>
          ) : null
        }
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
