import React, { useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, Input, Modal, Space, Table, Typography, message, type TableProps } from 'antd';
import { Link } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle, StatusTag } from '../../components/common';
import type { Course } from '../../types';

export function CourseReviewPage() {
  const { data, currentUser, reviewCourse } = useLms();
  const [returningCourse, setReturningCourse] = useState<Course | null>(null);
  const [form] = Form.useForm<{ reason: string }>();
  const pending = useMemo(() => data.courses.filter((course) => course.status === 'pending_review'), [data.courses]);

  const columns: TableProps<Course>['columns'] = [
    { title: 'คอร์ส', dataIndex: 'title', key: 'title', render: (title: string, course) => <><strong>{title}</strong><br/><Typography.Text type="secondary">{course.subtitle || course.category}</Typography.Text></> },
    { title: 'ผู้สอน', key: 'instructor', render: (_, course) => data.users.find((user) => user.id === course.instructorId)?.name ?? 'ไม่พบผู้สอน' },
    { title: 'ส่งตรวจเมื่อ', key: 'submitted', render: (_, course) => {
      const last = [...(course.reviewHistory ?? [])].reverse().find((event) => event.action === 'submitted');
      return last ? new Date(last.at).toLocaleString('th-TH') : '—';
    } },
    { title: 'สถานะ', key: 'status', render: () => <StatusTag status="pending_review"/> },
    { title: 'การจัดการ', key: 'actions', render: (_, course) => <Space wrap>
      <Link to={`/teach/courses/${course.id}/preview`}><Button>ดูตัวอย่าง</Button></Link>
      <Button type="primary" onClick={() => {
        const result = reviewCourse(course.id, 'approve');
        if (result.ok) message.success(result.message); else message.error(result.message);
      }}>อนุมัติ</Button>
      <Button danger onClick={() => { setReturningCourse(course); form.resetFields(); }}>ส่งกลับ</Button>
    </Space> },
  ];

  return <>
    <PageTitle eyebrow="ผู้ดูแลระบบ" title="คิวตรวจคอร์ส" subtitle="ตรวจตัวอย่างเนื้อหา อนุมัติ หรือส่งกลับพร้อมเหตุผล" actions={<Link to="/admin/courses"><Button>คอร์สทั้งหมด</Button></Link>} />
    <Alert className="bottom-space" type="info" showIcon message="การอนุมัติยังไม่เผยแพร่คอร์ส" description="หลังอนุมัติ ผู้สอนเจ้าของคอร์สหรือแอดมินจึงเผยแพร่ได้ หากมีการแก้เนื้อหาหรือแบบทดสอบก่อนเผยแพร่ สถานะจะกลับเป็นฉบับร่างและต้องส่งตรวจใหม่" />
    {pending.length ? <Table rowKey="id" dataSource={pending} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 900 }} /> : <Empty description="ไม่มีคอร์สรอตรวจ"/>}
    <Modal open={Boolean(returningCourse)} title={`ส่ง “${returningCourse?.title ?? ''}” กลับให้ผู้สอน`} okText="ส่งกลับพร้อมเหตุผล" cancelText="ยกเลิก" onCancel={() => setReturningCourse(null)} onOk={() => form.submit()}>
      <Form form={form} layout="vertical" onFinish={({ reason }) => {
        if (!returningCourse) return;
        const result = reviewCourse(returningCourse.id, 'return', reason);
        if (!result.ok) { message.error(result.message); return; }
        message.success(result.message);
        setReturningCourse(null);
      }}>
        <Form.Item name="reason" label="เหตุผลที่ส่งกลับ" rules={[{ required: true, whitespace: true, message: 'ระบุสิ่งที่ผู้สอนควรแก้ไข' }]}>
          <Input.TextArea rows={4} maxLength={500} showCount placeholder="ระบุจุดที่ต้องแก้ก่อนส่งตรวจอีกครั้ง" />
        </Form.Item>
      </Form>
    </Modal>
    <Typography.Text type="secondary">ผู้ตรวจ: {currentUser?.name ?? 'แอดมิน'}</Typography.Text>
  </>;
}
