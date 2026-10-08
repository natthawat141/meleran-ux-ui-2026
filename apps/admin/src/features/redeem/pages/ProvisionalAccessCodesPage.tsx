import React, { useState } from 'react';
import { Alert, Button, Empty, Form, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography, message, type TableColumnsType } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { PageTitle } from '@melearn/ui';
import type { AdminRedeemCode } from '../api/redeem-admin-api';
import { useAdminRedeemCodes, useAdminRedeemCourses, useCreateRedeemCodes, useRevokeRedeemCode } from '../hooks/use-admin-redeem-codes';

export function ProvisionalAccessCodesPage() {
  const courses = useAdminRedeemCourses(); const codes = useAdminRedeemCodes();
  const create = useCreateRedeemCodes(); const revoke = useRevokeRedeemCode();
  const [form] = Form.useForm<{ courseId: string; count: number }>();
  const [createdCodes, setCreatedCodes] = useState<Array<{ id: string; code: string; course_id: string }>>([]);
  const titleById = new Map((courses.data ?? []).map((course) => [course.id, course.title]));
  const submit = ({ courseId, count }: { courseId: string; count: number }) => create.mutate({ courseId, count }, { onSuccess: (items) => { setCreatedCodes(items); void message.success(`ออก ${items.length} รหัสแล้ว`); form.resetFields(); }, onError: (error) => void message.error(error.message) });
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); void message.success('คัดลอกรหัสแล้ว'); } catch { void message.error('คัดลอกรหัสไม่ได้ กรุณาเลือกคัดลอกด้วยตนเอง'); } };
  const copyAll = async () => { try { await navigator.clipboard.writeText(createdCodes.map((item) => item.code).join('\n')); void message.success('คัดลอกรหัสทั้งหมดแล้ว'); } catch { void message.error('คัดลอกไม่สำเร็จ'); } };
  const columns: TableColumnsType<AdminRedeemCode> = [
    { title: 'รหัส', dataIndex: 'code_masked', render: (code: string) => <Typography.Text>{code}</Typography.Text> },
    { title: 'คอร์ส', dataIndex: 'course_id', render: (id: string) => titleById.get(id) ?? id },
    { title: 'สถานะ', dataIndex: 'status', render: (status: AdminRedeemCode['status']) => <Tag color={status === 'unused' ? 'blue' : status === 'used' ? 'green' : 'default'}>{status === 'unused' ? 'ยังไม่ใช้' : status === 'used' ? 'ใช้แล้ว' : 'ยกเลิกแล้ว'}</Tag> },
    { title: 'วันที่ออก', dataIndex: 'created_at', render: (value: string) => new Date(value).toLocaleString('th-TH') },
    { title: 'ผู้ใช้ / วันที่ใช้', render: (_, row) => row.used_by ? <span>{row.used_by}<br />{row.used_at ? new Date(row.used_at).toLocaleString('th-TH') : ''}</span> : '—' },
    { title: '', render: (_, row) => row.status === 'unused' ? <Popconfirm title="ยกเลิกรหัสนี้?" description="รหัสที่ยกเลิกแล้วนำกลับมาใช้ไม่ได้" onConfirm={() => revoke.mutate(row.id, { onSuccess: () => void message.success('ยกเลิกรหัสแล้ว'), onError: (error) => void message.error(error.message) })}><Button size="small" loading={revoke.isPending}>ยกเลิก</Button></Popconfirm> : null },
  ];
  return <div className="public-page">
    <PageTitle eyebrow="ผู้ดูแลระบบ · R8 mock" title="รหัสแลกคอร์ส" subtitle="ข้อมูลอ่านและบันทึกผ่าน API จำลอง" />
    <Alert showIcon type="warning" message="ข้อมูลใน memory ของ mock เท่านั้น" description="รหัสที่ออกใหม่จะแสดงเต็มให้คัดลอกครั้งนี้ รายการย้อนหลังจะแสดงเฉพาะรหัสแบบปกปิดและจะหายเมื่อปิด provisional server" />
    <section className="top-space"><Typography.Title level={4}>ออกโค้ดสำหรับคอร์สแบบชำระเงิน</Typography.Title>
      {courses.isError && <Alert type="error" message="โหลดรายการคอร์สไม่ได้" description={courses.error.message} />}
      <Form form={form} layout="inline" onFinish={submit} initialValues={{ count: 1 }}>
        <Form.Item name="courseId" rules={[{ required: true, message: 'เลือกคอร์ส' }]}><Select aria-label="คอร์ส" placeholder="เลือกคอร์ส" loading={courses.isPending} style={{ minWidth: 260 }} options={(courses.data ?? []).map((course) => ({ value: course.id, label: course.title }))} /></Form.Item>
        <Form.Item name="count" rules={[{ required: true }, { type: 'number', min: 1, max: 50 }]}><InputNumber aria-label="จำนวนรหัส" min={1} max={50} /></Form.Item>
        <Form.Item><Button type="primary" htmlType="submit" loading={create.isPending}>สร้างรหัส</Button></Form.Item>
      </Form>
      {create.isError && <Alert className="top-space" type="error" message="สร้างรหัสไม่ได้" description={create.error.message} />}
      {createdCodes.length > 0 && (
        <div className="top-space">
          <Alert type="success" showIcon message="คัดลอกรหัสและส่งให้ผู้ซื้อได้แล้ว" description={<Space direction="vertical">{createdCodes.map((item) => <Typography.Text key={item.id} copyable={{ text: item.code }}>{item.code}</Typography.Text>)}</Space>} action={<Button icon={<CopyOutlined />} onClick={() => void copyAll()}>คัดลอกทั้งหมด</Button>} />
        </div>
      )}
    </section>
    <section className="top-space"><Typography.Title level={4}>รหัสที่ออกแล้ว</Typography.Title>
      {codes.isError && <Alert type="error" message="โหลดรายการรหัสไม่ได้" description={codes.error.message} action={<Button onClick={() => void codes.refetch()}>ลองอีกครั้ง</Button>} />}
      <Table rowKey="id" loading={codes.isPending} dataSource={codes.data ?? []} columns={columns} pagination={{ pageSize: 8 }} scroll={{ x: 850 }} locale={{ emptyText: <Empty description="ยังไม่มีรหัส" /> }} />
    </section>
  </div>;
}
