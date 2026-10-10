import { Button, Popconfirm, Space, Table, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthoringWorkspace } from '../api/useAuthoringWorkspace';
import { PageTitle } from '@melearn/ui';
import type { EditorQuiz as Quiz } from '@melearn/course-authoring';
import '../styles/grading-workspace.css';

const { Text } = Typography;

export function QuizManagerPage() {
  const { data, currentUser, removeQuiz } = useAuthoringWorkspace();
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const myCourses = data.courses.filter(
    (course) => (currentUser?.role === 'admin' || course.instructorId === currentUser?.id) && (!courseId || course.id === courseId)
  );
  const quizzes = data.quizzes.filter((quiz) => myCourses.some((course) => course.id === quiz.courseId));

  const columns: TableProps<Quiz>['columns'] = [
    {
      title: 'แบบทดสอบ',
      render: (_, quiz) => (
        <div className="table-course-name">
          <strong>{quiz.title}</strong>
          <Text type="secondary">
            {quiz.questionCount} ข้อ · เกณฑ์ผ่าน {quiz.passPercent}%
          </Text>
        </div>
      ),
    },
    {
      title: 'คอร์ส',
      render: (_, quiz) => myCourses.find((course) => course.id === quiz.courseId)?.title,
    },
    {
      title: 'จัดการ',
      render: (_, quiz) => (
        <Space>
          <Button type="primary" onClick={() => navigate(`/admin/quizzes/${quiz.id}`)}>
            แก้ไข
          </Button>
          <Popconfirm
            title="ลบแบบทดสอบนี้หรือไม่"
            okText="ลบ"
            cancelText="ยกเลิก"
            onConfirm={async () => {
              const result = await removeQuiz(quiz.id);
              result.ok ? message.success('ลบแบบทดสอบแล้ว') : message.error(result.message);
            }}
          >
            <Button danger>ลบ</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        eyebrow="ผู้ดูแลระบบ"
        title="จัดการแบบทดสอบ"
        subtitle="สร้างและแก้ไขแบบทดสอบในคอร์สที่ระบบดูแล"
        actions={
          <Link to="/admin/courses">
            <Button>ไปยังคอร์ส</Button>
          </Link>
        }
      />
      <Table rowKey="id" dataSource={quizzes} columns={columns} pagination={{ pageSize: 8 }} locale={{ emptyText: 'ยังไม่มีแบบทดสอบในคอร์สของคุณ' }} />
    </>
  );
}
