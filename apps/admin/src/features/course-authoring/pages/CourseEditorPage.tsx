import { Alert, Button, Empty, Form, Switch, Typography, message } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '@melearn/store';
import { PageTitle, StatusTag } from '@melearn/ui';
import defaultCourseCover from '@melearn/ui/assets/generated/course-default-v2.png';
import { ImageUploadField } from '@melearn/ui';
import { CourseMetadataEditor, type CourseMetadataFormValues } from '@melearn/course-authoring';

const { Title } = Typography;

export function AdminCourseEditorPage() {
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
        pricingType: 'free',
        instructorId: '',
      };
  const latestReturn = [...(course?.reviewHistory ?? [])].reverse().find((event) => event.action === 'returned');
  const instructors = data.users
    .filter((user) => user.role === 'instructor')
    .map((user) => ({ id: user.id, name: user.name }));

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
        outcomes: (outcomesText ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
        instructorId: values.instructorId,
      },
      course?.id
    );
    if (!savedId) {
      message.error('ไม่สามารถบันทึกคอร์สนี้ได้');
      return;
    }
    message.success(isNew ? 'สร้างคอร์สแล้ว' : 'บันทึกข้อมูลคอร์สแล้ว การแก้คอร์สที่รอตรวจหรืออนุมัติจะกลับเป็นฉบับร่างและต้องส่งตรวจใหม่');
    navigate('/admin/courses/' + savedId + '/overview');
  };

  if (!isNew && !course) return <Empty description="ไม่พบคอร์สนี้" />;

  return (
    <>
      <PageTitle
        eyebrow={isNew ? 'สร้างคอร์ส' : 'ตั้งค่าคอร์ส'}
        title={isNew ? 'สร้างคอร์สใหม่' : 'แก้ไขข้อมูลคอร์ส'}
        subtitle="เริ่มจากข้อมูลสำคัญ เลือกภาพปก แล้วบันทึกเพื่อไปจัดบทเรียน"
        actions={
          <Link to={isNew ? '/admin/courses' : '/admin/courses/' + course?.id + '/curriculum'}>
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
        savedCourse={course ? { id: course.id, status: course.status, price: course.price } : undefined}
        canAssignInstructor={currentUser?.role === 'admin'}
        instructors={currentUser?.role === 'admin' ? instructors : []}
        returnedReason={latestReturn?.reason}
        canSubmitForReview={course?.status === 'draft' && currentUser?.role === 'admin'}
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
          if (result.ok) message.success(result.message); else message.error(result.message);
        }}
        onPublish={() => {
          if (!course) return;
          const result = publishCourse(course.id);
          if (result.ok) message.success(result.message); else message.error(result.message);
        }}
        previewAction={
          course ? (
            <Link to={'/admin/courses/' + course.id + '/preview'}>
              <Button block className="top-space">ดูตัวอย่างคอร์ส</Button>
            </Link>
          ) : null
        }
      />
    </>
  );
}
