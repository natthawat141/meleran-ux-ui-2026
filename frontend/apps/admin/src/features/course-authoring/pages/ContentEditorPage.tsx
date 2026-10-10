import { useRef } from 'react';
import { Alert, Button, Empty, Form, Input, Typography, message } from 'antd';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthoringWorkspace } from '../api/useAuthoringWorkspace';
import { PageTitle } from '@melearn/ui';
import type { CourseItemType } from '@melearn/contracts';

const { Text } = Typography;

interface ContentEditorPageProps {
  type: CourseItemType;
}

interface ContentFormValues {
  title: string;
  videoUrl?: string;
  duration?: string;
  description?: string;
  readingMinutes?: number;
  articleBody?: string;
}

export function ContentEditorPage({ type }: ContentEditorPageProps) {
  const { courseId, itemId } = useParams<{ courseId: string; itemId: string }>();
  const [search] = useSearchParams();
  const { data, saveItem } = useAuthoringWorkspace();
  const navigate = useNavigate();
  const course = data.courses.find((item) => item.id === courseId);
  const revisionRef=useRef(course?.revision);
  const found = course?.chapters
    .flatMap((chapter) => chapter.items.map((item) => ({ ...item, chapterId: chapter.id })))
    .find((item) => item.id === itemId);
  const chapterId = found?.chapterId ?? search.get('chapter');
  const chapter = course?.chapters.find((item) => item.id === chapterId);
  const initial =
    found ?? {
      type,
      title: '',
      duration: '',
      readingMinutes: 5,
      videoUrl: '',
      articleBody: '',
    };
  const [form] = Form.useForm<ContentFormValues>();

  if (!course || !chapter) return <Empty description="ไม่พบบทที่จะเพิ่มเนื้อหา" />;

  const isNew = itemId === 'new';
  const submit = async (values: ContentFormValues) => {
    try { await saveItem(course.id, chapter.id, { ...values, type, id: isNew ? undefined : itemId },revisionRef.current);
    message.success('บันทึกเนื้อหาแล้ว');
    navigate(`/admin/courses/${course.id}/curriculum`); } catch(e) {message.error(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');}
  };

  return (
    <>
      <PageTitle
        eyebrow={type === 'video' ? 'วิดีโอ' : 'บทความ'}
        title={
          isNew
            ? `เพิ่ม${type === 'video' ? 'วิดีโอ' : 'บทความ'}`
            : `แก้${type === 'video' ? 'วิดีโอ' : 'บทความ'}`
        }
        subtitle={`${course.title} · ${chapter.title}`}
        actions={
          <Link to={`/admin/courses/${course.id}/curriculum`}>
            <Button>กลับโครงสร้างบท</Button>
          </Link>
        }
      />
      <div className="content-editor-panel">
        <Form form={form} layout="vertical" initialValues={initial} onFinish={submit}>
          <Form.Item
            name="title"
            label="ชื่อเนื้อหา"
            rules={[{ required: true, message: 'กรอกชื่อเนื้อหา' }]}
          >
            <Input size="large" />
          </Form.Item>
          {type === 'video' ? (
            <>
              <Form.Item
                name="videoUrl"
                label="URL วิดีโอ"
                rules={[{ required: true, type: 'url', message: 'ใส่ URL วิดีโอที่เปิดได้' }]}
              >
                <Input placeholder="https://..." />
              </Form.Item>
              <Form.Item name="duration" label="ความยาววิดีโอ">
                <Input placeholder="เช่น 08:20" />
              </Form.Item>
              <Form.Item name="description" label="คำอธิบาย">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Alert
                type="info"
                showIcon
                message="ตัวอย่างวิดีโอเปิดให้เล่นได้ในหน้าเรียน ใช้ URL สาธารณะที่เบราว์เซอร์เข้าถึงได้"
              />
            </>
          ) : (
            <>
              <Form.Item name="readingMinutes" label="เวลาอ่านโดยประมาณ (นาที)">
                <Input type="number" min={1} />
              </Form.Item>
              <Form.Item
                name="articleBody"
                label="เนื้อหาบทความ"
                rules={[{ required: true, message: 'เพิ่มเนื้อหาบทความ' }]}
              >
                <Input.TextArea rows={14} placeholder="แบ่งย่อหน้าด้วยการเว้นบรรทัด" />
              </Form.Item>
              <Text type="secondary">
                หน้าเรียนจะแสดงบทความแบบอ่านเต็มความกว้าง พร้อมข้อมูลผู้เขียนและบทเรียนถัดไป
              </Text>
            </>
          )}
          <div className="content-editor-actions">
            <Button type="primary" htmlType="submit">
              บันทึกเนื้อหา
            </Button>
            <Button onClick={() => navigate(`/admin/courses/${course.id}/preview`)}>
              ดูตัวอย่างคอร์ส
            </Button>
          </div>
        </Form>
      </div>
    </>
  );
}
