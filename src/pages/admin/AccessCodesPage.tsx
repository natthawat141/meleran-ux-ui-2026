import { useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, Select, Space, Table, Tag, Typography, message, type TableColumnsType } from 'antd';
import { CopyOutlined, PlusOutlined } from '@ant-design/icons';
import { useLms } from '../../store';
import { PageTitle } from '../../components/common';
import type { RedeemCode } from '../../types';
import './access-codes.css';

const { Text } = Typography;

export function AccessCodesPage() {
  const { data, createRedeemCode, revokeRedeemCode } = useLms();
  const [form] = Form.useForm<{ courseId: string }>();
  const [saving, setSaving] = useState(false);
  const paidCourses = useMemo(() => data.courses.filter((course) => course.status === 'published' && course.price > 0), [data.courses]);

  const submit = ({ courseId }: { courseId: string }) => {
    setSaving(true);
    const result = createRedeemCode(courseId);
    setSaving(false);
    if (!result.ok) { message.error(result.message); return; }
    message.success(`สร้างรหัส ${result.redeemCode?.code} แล้ว`);
    form.resetFields();
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); message.success('คัดลอกรหัสแล้ว'); }
    catch { message.error(`คัดลอกไม่สำเร็จ: ${code}`); }
  };

  const columns: TableColumnsType<RedeemCode> = [
    { title: 'รหัสแลกคอร์ส', dataIndex: 'code', render: (code: string) => <Space><Text strong className="access-code-value">{code}</Text><Button type="text" size="small" icon={<CopyOutlined />} aria-label={`คัดลอกรหัส ${code}`} onClick={() => copyCode(code)} /></Space> },
    { title: 'คอร์ส', render: (_, code) => data.courses.find((course) => course.id === code.courseId)?.title ?? 'คอร์สที่ไม่พร้อมใช้งาน' },
    { title: 'ผู้แลก', render: (_, code) => {
      if (code.status !== 'used' || !code.usedByUserId) return '—';
      const user = data.users.find((item) => item.id === code.usedByUserId);
      return user ? <span>{user.name}<br /><Text type="secondary">{user.email}</Text></span> : code.usedByUserId;
    } },
    { title: 'วันที่ออก', dataIndex: 'createdAt', render: (createdAt: string) => new Date(createdAt).toLocaleDateString('th-TH') },
    { title: 'วันที่แลก', dataIndex: 'usedAt', render: (usedAt?: string) => usedAt ? new Date(usedAt).toLocaleString('th-TH') : '—' },
    { title: 'สถานะ', dataIndex: 'status', render: (status: RedeemCode['status']) => {
      const display = {
        unused: { label: 'ยังไม่ใช้', color: 'blue' },
        used: { label: 'ใช้แล้ว', color: 'green' },
        revoked: { label: 'ยกเลิกแล้ว', color: 'default' },
      }[status];
      return <Tag color={display.color}>{display.label}</Tag>;
    } },
    { title: '', render: (_, code) => code.status === 'unused'
      ? <Button size="small" onClick={() => {
        const result = revokeRedeemCode(code.id);
        result.ok ? message.success('ยกเลิกรหัสแล้ว') : message.error(result.message);
      }}>ยกเลิกรหัส</Button>
      : null },
  ];

  return <div className="access-codes-page">
    <PageTitle eyebrow="ผู้ดูแลระบบ · สิทธิ์เรียน" title="รหัสแลกคอร์ส" subtitle="ออกและยกเลิกรหัสสิทธิ์เรียนสำหรับคอร์สที่เผยแพร่แล้ว" />
    <Alert className="access-code-demo-note" type="info" showIcon message="ข้อมูลจำลองในเบราว์เซอร์" description="รหัสหนึ่งรายการใช้เปิดสิทธิ์คอร์สที่กำหนดได้ครั้งเดียว ไม่มีวันหมดอายุ และยกเลิกได้ก่อนมีผู้ใช้รหัส" />
    <section className="access-code-form-panel">
      <div className="access-code-section-heading"><div><h2>ออกโค้ดใหม่</h2><p>ระบบสร้างรหัสเฉพาะสำหรับคอร์สที่เลือก</p></div><span className="access-code-icon"><PlusOutlined /></span></div>
      {paidCourses.length ? <Form form={form} layout="vertical" onFinish={submit} className="access-code-form">
        <div className="access-code-form-grid">
          <Form.Item name="courseId" label="คอร์ส" rules={[{ required: true, message: 'เลือกคอร์สก่อนออกโค้ด' }]}>
            <Select showSearch optionFilterProp="label" placeholder="เลือกคอร์ส" options={paidCourses.map((course) => ({ value: course.id, label: course.title }))} />
          </Form.Item>
        </div>
        <Button type="primary" htmlType="submit" loading={saving}>สร้างรหัส</Button>
      </Form> : <Empty description="ยังไม่มีคอร์สที่มีราคาสำหรับออกโค้ด" />}
    </section>
    <section className="access-code-list-panel">
      <div className="access-code-section-heading"><div><h2>รหัสที่ออกแล้ว</h2><p>แสดงสิทธิ์ที่ยังไม่ใช้ ใช้แล้ว และถูกยกเลิก</p></div><Tag color="blue">{data.redeemCodes.length} รหัส</Tag></div>
      <Table rowKey="id" dataSource={data.redeemCodes} columns={columns} pagination={{ pageSize: 8, hideOnSinglePage: true }} scroll={{ x: 900 }} locale={{ emptyText: <Empty description="ยังไม่มีรหัสที่ออก" /> }} />
    </section>
  </div>;
}
