import { Button, Empty, Typography } from 'antd';
import { ArrowRightOutlined, BookOutlined, TeamOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { useAuthoringWorkspace } from '../api/useAuthoringWorkspace';
import { PageTitle, StatusTag, flattenItems } from '@melearn/ui';

const { Text, Title } = Typography;
export function CourseOverviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data } = useAuthoringWorkspace();
  const course = data.courses.find((item) => item.id === courseId);

  if (!course) return <Empty description="ไม่พบคอร์สนี้" />;

  const studentCount = course.enrollmentCount;
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
          <Link to={`/admin/courses/${course.id}/settings`}>
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
        <Link to={`/admin/courses/${course.id}/curriculum`}>
          <BookOutlined />
          <strong>จัดโครงบทเรียน</strong>
          <span>เพิ่มและเรียงบท วิดีโอ บทความ หรือแบบทดสอบ</span>
        </Link>
        <Link to={`/admin/courses/${course.id}/learners`}>
          <TeamOutlined />
          <strong>ดูความคืบหน้าผู้เรียน</strong>
          <span>
            {studentCount} ผู้เรียน · {questionCount} คำถามในแบบทดสอบ
          </span>
        </Link>
        <Link to={`/admin/courses/${course.id}/preview`}>
          <ArrowRightOutlined />
          <strong>ดูตัวอย่างก่อนเผยแพร่</strong>
          <span>ตรวจมุมมองผู้เรียนและความพร้อมของเนื้อหา</span>
        </Link>
      </div>
    </>
  );
}
