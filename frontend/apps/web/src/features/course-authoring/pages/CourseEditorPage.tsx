import { useRef } from 'react';
import { Button, Empty, Form, message } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthoringWorkspace } from '../api/useAuthoringWorkspace';
import { PageTitle, StatusTag } from '@melearn/ui';
import defaultCourseCover from '@melearn/ui/assets/generated/course-default-v2.png';
import { ImageUploadField } from '@melearn/ui';
import { CourseMetadataEditor, type CourseMetadataFormValues } from '@melearn/course-authoring';

export function InstructorCourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data, saveCourse, submitCourseForReview, publishCourse, currentUser } = useAuthoringWorkspace();
  const navigate = useNavigate();
  const course = data.courses.find((item) => item.id === courseId);
  const revisionRef = useRef(course?.revision);
  const saveInFlight = useRef(false);
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
        instructorId: currentUser?.id ?? '',
      };
  const latestReturn = [...(course?.reviewHistory ?? [])]
    .reverse()
    .find((event) => event.action === 'returned');

  const submit = async (values: CourseMetadataFormValues) => {
    if (values.pricingType === 'paid' && Number(values.price) <= 0) {
      message.error('กรอกราคามากกว่า 0 บาทสำหรับคอร์สที่มีค่าใช้จ่าย');
      return;
    }
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    const { outcomesText, pricingType, ...rest } = values;
    try {
      const savedId = await saveCourse(
        {
          ...rest,
          price: pricingType === 'free' ? 0 : Number(values.price),
          outcomes: (outcomesText ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          instructorId: course?.instructorId ?? currentUser?.id ?? '',
        },
        course?.id,
        revisionRef.current,
      );
      if (!savedId) {
        message.error('ไม่สามารถบันทึกคอร์สนี้ได้');
        return;
      }
      message.success(
        isNew
          ? 'สร้างคอร์สแล้ว'
          : 'บันทึกข้อมูลคอร์สแล้ว การแก้คอร์สที่รอตรวจหรืออนุมัติจะกลับเป็นฉบับร่างและต้องส่งตรวจใหม่',
      );
      if (revisionRef.current !== undefined) revisionRef.current += 1;
      navigate('/teach/courses/' + savedId);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      saveInFlight.current = false;
    }
  };

  if (!isNew && !course) return <Empty description="ไม่พบคอร์สนี้" />;

  return (
    <>
      <PageTitle
        eyebrow={isNew ? 'สร้างคอร์ส' : 'ตั้งค่าคอร์ส'}
        title={isNew ? 'สร้างคอร์สใหม่' : 'แก้ไขข้อมูลคอร์ส'}
        subtitle="เริ่มจากข้อมูลสำคัญ เลือกภาพปก แล้วบันทึกเพื่อไปจัดบทเรียน"
        actions={
          <Link to={isNew ? '/teach/courses' : '/teach/courses/' + course?.id + '/curriculum'}>
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
        canAssignInstructor={false}
        instructors={[]}
        returnedReason={latestReturn?.reason}
        canSubmitForReview={course?.status === 'draft'}
        canPublish={course?.status === 'approved'}
        defaultCover={defaultCourseCover}
        ImageUploadField={ImageUploadField}
        StatusTag={StatusTag}
        onFinish={submit}
        onSubmitForReview={async () => {
          if (!course) return;
          const result = await submitCourseForReview(course.id);
          if (result.ok) message.success(result.message);
          else message.error(result.message);
        }}
        onPublish={async () => {
          if (!course) return;
          const result = await publishCourse(course.id);
          if (result.ok) message.success(result.message);
          else message.error(result.message);
        }}
        previewAction={
          course ? (
            <Link to={'/teach/courses/' + course.id + '/preview'}>
              <Button block className="top-space">
                ดูตัวอย่างคอร์ส
              </Button>
            </Link>
          ) : null
        }
      />
    </>
  );
}
