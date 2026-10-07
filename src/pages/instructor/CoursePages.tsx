import React from 'react';
import {
  Button,
  Col,
  Alert,
  Empty,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Switch,
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

interface CourseFormValues {
  title: string;
  subtitle: string;
  description: string;
  outcomesText?: string;
  cover?: string;
  instructorId: string;
  category: string;
  level: string;
  price: number;
  pricingType: 'free' | 'paid';
}

export function CourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data, saveCourse, submitCourseForReview, publishCourse, setCourseAiEnabled, currentUser } = useLms();
  const navigate = useNavigate();
  const course = data.courses.find((item) => item.id === courseId);
  const isNew = !courseId || courseId === 'new';
  const [form] = Form.useForm<CourseFormValues>();

  const initialValues = course
    ? {
        ...course,
        outcomesText: course.outcomes?.join('\n'),
        pricingType: course.price === 0 ? 'free' : 'paid',
      }
    : {
        category: 'การสื่อสาร',
        level: 'เริ่มต้น',
        price: 0,
        pricingType: 'free' as const,
        instructorId: currentUser?.role === 'instructor' ? currentUser.id : '',
      };

  const selectedPricingType = Form.useWatch('pricingType', form) ?? (course?.price ? 'paid' : 'free');
  const latestReturn = [...(course?.reviewHistory ?? [])].reverse().find((event) => event.action === 'returned');

  const submit = (values: CourseFormValues) => {
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
      <div className="form-page course-form-page">
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={submit}
          key={course?.id ?? 'new'}
        >
          <div className="form-page-grid">
            <div className="course-editor-main">
              <section className="editor-section">
                <div className="course-editor-section-heading">
                  <span>01</span>
                  <div>
                    <Title level={4}>แนะนำคอร์ส</Title>
                    <p>บอกผู้เรียนว่าคอร์สนี้เกี่ยวกับอะไรและช่วยเขาได้อย่างไร</p>
                  </div>
                </div>
                <Form.Item
                  name="title"
                  label="ชื่อคอร์ส"
                  rules={[{ required: true, message: 'กรอกชื่อคอร์ส' }]}
                >
                  <Input size="large" maxLength={100} placeholder="ชื่อที่สื่อสารหัวข้อได้ชัดเจน" />
                </Form.Item>
                <Form.Item
                  name="subtitle"
                  label="คำโปรยสั้น"
                  rules={[{ required: true, message: 'สรุปว่าคอร์สนี้ช่วยเรื่องอะไร' }]}
                >
                  <Input maxLength={160} placeholder="สรุปสิ่งที่ผู้เรียนจะได้รับในหนึ่งประโยค" />
                </Form.Item>
                <Form.Item
                  name="description"
                  label="รายละเอียดคอร์ส"
                  rules={[{ required: true, message: 'เพิ่มรายละเอียดคอร์ส' }]}
                >
                  <Input.TextArea
                    rows={5}
                    placeholder="เล่าว่าจะเรียนเรื่องอะไร เหมาะกับใคร และนำไปใช้ได้อย่างไร"
                  />
                </Form.Item>
                <Form.Item
                  name="outcomesText"
                  label="ผลลัพธ์ที่ผู้เรียนจะได้"
                  extra="เขียนหนึ่งข้อในแต่ละบรรทัด"
                >
                  <Input.TextArea
                    rows={3}
                    placeholder={'เข้าใจพื้นฐานของหัวข้อ\nลองนำไปใช้กับงานจริง'}
                  />
                </Form.Item>
              </section>
              <section className="editor-section">
                <div className="course-editor-section-heading">
                  <span>02</span>
                  <div>
                    <Title level={4}>ภาพปกคอร์ส</Title>
                    <p>ภาพนี้จะแสดงในหน้ารวมคอร์สและหน้ารายละเอียด</p>
                  </div>
                </div>
                <Form.Item name="cover">
                  <ImageUploadField fallback={defaultCourseCover} />
                </Form.Item>
              </section>
              <section className="editor-section">
                <div className="course-editor-section-heading">
                  <span>03</span>
                  <div>
                    <Title level={4}>รายละเอียดเพิ่มเติม</Title>
                    <p>ช่วยให้ผู้เรียนค้นพบคอร์สที่เหมาะกับตัวเอง</p>
                  </div>
                </div>
                {currentUser?.role === 'admin' && (
                  <Form.Item
                    name="instructorId"
                    label="ผู้สอนประจำคอร์ส"
                    rules={[{ required: true, message: 'เลือกผู้สอน' }]}
                  >
                    <Select
                      options={data.users
                        .filter((user) => user.role === 'instructor')
                        .map((user) => ({ value: user.id, label: user.name }))}
                    />
                  </Form.Item>
                )}
                <div className="course-editor-details">
                  <Form.Item name="category" label="หมวดหมู่">
                    <Select
                      options={['การสื่อสาร', 'ข้อมูลและดิจิทัล', 'การทำงาน', 'การออกแบบ'].map(
                        (value) => ({ value })
                      )}
                    />
                  </Form.Item>
                  <Form.Item name="level" label="ระดับ">
                    <Select options={['เริ่มต้น', 'กลาง', 'ขั้นสูง'].map((value) => ({ value }))} />
                  </Form.Item>
                  <Form.Item name="pricingType" label="ค่าเรียน">
                    <Radio.Group optionType="button" buttonStyle="solid">
                      <Radio.Button value="free">เรียนฟรี</Radio.Button>
                      <Radio.Button value="paid">มีค่าใช้จ่าย</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                  {selectedPricingType === 'paid' && (
                    <Form.Item name="price" label="ราคาคอร์ส" rules={[{ required: true, message: 'กรอกราคาคอร์ส' }]}>
                      <InputNumber min={1} precision={0} step={50} addonAfter="บาท" style={{ width: '100%' }} />
                    </Form.Item>
                  )}
                </div>
              </section>
              {!isNew && currentUser?.role === 'admin' && (
                <section className="editor-section" aria-labelledby="course-ai-settings-heading">
                  <div className="course-editor-section-heading">
                    <span>AI</span>
                    <div>
                      <Title level={4} id="course-ai-settings-heading">Melearn AI สำหรับคอร์สนี้</Title>
                      <p>เปิดเพื่อให้ผู้เรียนที่ลงทะเบียนเลือกใช้ความรู้จากคอร์สนี้ในหน้า Melearn AI</p>
                    </div>
                  </div>
                  <Switch
                    checked={course?.aiEnabled === true}
                    checkedChildren="เปิด"
                    unCheckedChildren="ปิด"
                    aria-label="เปิด Melearn AI สำหรับคอร์สนี้"
                    onChange={(enabled) => {
                      const result = setCourseAiEnabled(course!.id, enabled);
                      if (result.ok) message.success(result.message); else message.error(result.message);
                    }}
                  />
                  <p>การตั้งค่านี้ไม่เปลี่ยนผลการเรียนหรือสถานะอนุมัติคอร์ส</p>
                </section>
              )}
            </div>
            <aside className="editor-aside course-editor-publish">
              <Title level={5}>การเผยแพร่</Title>
              <p>ส่งตรวจและเผยแพร่ผ่านขั้นตอนอนุมัติของแอดมิน</p>
              <div className="course-publish-note">
                <StatusTag status={course?.status ?? 'draft'} />
                {course?.status === 'approved' && <p>คอร์สผ่านการตรวจแล้ว พร้อมเผยแพร่</p>}
                {course?.status === 'pending_review' && <p>กำลังรอแอดมินตรวจ หากแก้ไขต้องส่งตรวจใหม่</p>}
                {course?.status === 'published' && <p>คอร์สเผยแพร่แล้ว การแก้ไขจะอัปเดตทันที</p>}
                {(!course || course.status === 'draft') && <p>ฉบับร่างยังไม่แสดงให้ผู้เรียนทั่วไปเห็น</p>}
              </div>
              {latestReturn?.reason && <Alert className="bottom-space" type="warning" showIcon message="เหตุผลที่แอดมินส่งกลับ" description={latestReturn.reason} />}
              <Button block type="primary" htmlType="submit">
                {isNew ? 'สร้างคอร์ส' : 'บันทึกการเปลี่ยนแปลง'}
              </Button>
              {course?.status === 'draft' && (currentUser?.role === 'instructor' || currentUser?.role === 'admin') && (
                <Button block className="top-space" onClick={() => {
                  const result = submitCourseForReview(course.id);
                  if (result.ok) message.success(result.message); else message.error(result.message);
                }}>ส่งตรวจคอร์ส</Button>
              )}
              {course?.status === 'approved' && (
                <Button block className="top-space" onClick={() => {
                  const result = publishCourse(course.id);
                  if (result.ok) message.success(result.message); else message.error(result.message);
                }}>เผยแพร่คอร์ส</Button>
              )}
              {!isNew && (
                <Link to={`/teach/courses/${course?.id}/preview`}>
                  <Button block className="top-space">
                    ดูตัวอย่างคอร์ส
                  </Button>
                </Link>
              )}
            </aside>
          </div>
        </Form>
      </div>
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
