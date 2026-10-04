import React, { useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, Input, InputNumber, Select, Space, Table, Tag, Typography, message, type TableColumnsType } from 'antd';
import { CopyOutlined, PlusOutlined } from '@ant-design/icons';
import { useLms } from '../../store';
import { PageTitle } from '../../components/common';
import { formatPrice } from '../../data';
import { accessCodeKindLabel } from '../../lib/access-code-utils';
import type { AccessCode, CreateAccessCodeInput, User } from '../../types';
import './access-codes.css';

const { Text } = Typography;
const kinds = [
  { value: 'percent', label: 'ลดเป็นเปอร์เซ็นต์' },
  { value: 'fixed', label: 'ลดเป็นจำนวนเงิน' },
  { value: 'free', label: 'ให้เรียนฟรี' },
  { value: 'cash', label: 'บันทึกยอดขายเงินสด' },
] as const;

function amountLabel(code: AccessCode): string {
  if (code.kind === 'percent') return `ลด ${code.value}%`;
  if (code.kind === 'fixed') return `ลด ${formatPrice(code.value ?? 0)}`;
  if (code.kind === 'cash') return `รับแล้ว ${formatPrice(code.receivedAmount ?? 0)}`;
  return 'ลดเต็มราคา';
}

export function AccessCodesPage() {
  const { data, createAccessCode, setAccessCodeStatus } = useLms();
  const [form] = Form.useForm<CreateAccessCodeInput>();
  const [saving, setSaving] = useState(false);
  const kind = Form.useWatch('kind', form) ?? 'percent';
  const courseId = Form.useWatch('courseId', form);
  const selectedCourse = data.courses.find((course) => course.id === courseId);
  const paidCourses = useMemo(() => data.courses.filter((course) => course.status === 'published' && Number(course.price) > 0), [data.courses]);
  const learners = useMemo(() => data.users.filter((user) => user.role === 'learner'), [data.users]);

  const submit = (values: CreateAccessCodeInput) => {
    setSaving(true);
    const result = createAccessCode(values);
    setSaving(false);
    if (!result.ok) { message.error(result.message); return; }
    message.success(`สร้างโค้ด ${result.accessCode?.code} แล้ว`);
    form.resetFields();
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); message.success('คัดลอกโค้ดแล้ว'); }
    catch { message.error(`คัดลอกไม่สำเร็จ: ${code}`); }
  };

  const columns: TableColumnsType<AccessCode> = [
    { title: 'โค้ด', dataIndex: 'code', render: (code: string) => <Space><Text strong className="access-code-value">{code}</Text><Button type="text" size="small" icon={<CopyOutlined/>} aria-label={`คัดลอกโค้ด ${code}`} onClick={() => copyCode(code)}/></Space> },
    { title: 'ประเภท', render: (_, code) => <div className="access-code-cell"><strong>{accessCodeKindLabel(code.kind)}</strong><Text type="secondary">{amountLabel(code)}</Text></div> },
    { title: 'คอร์ส', render: (_, code) => data.courses.find((course) => course.id === code.courseId)?.title ?? 'คอร์สที่ไม่พร้อมใช้งาน' },
    { title: 'ผู้รับโค้ด', render: (_, code) => code.kind === 'cash' ? (learners.find((user) => user.id === code.userId)?.name ?? 'ไม่พบผู้เรียน') : 'ใช้ได้ตามจำนวนที่กำหนด' },
    { title: 'ใช้แล้ว', render: (_, code) => `${code.usedCount} / ${code.maxUses == null ? 'ไม่จำกัด' : code.maxUses}` },
    { title: 'หมดอายุ', render: (_, code) => code.expiresAt ? new Date(code.expiresAt).toLocaleDateString('th-TH') : 'ไม่กำหนด' },
    { title: 'สถานะ', render: (_, code) => <Tag color={code.status === 'active' ? 'blue' : 'default'}>{code.status === 'active' ? 'เปิด' : 'ปิด'}</Tag> },
    { title: '', render: (_, code) => <Button size="small" onClick={() => {
      const next = code.status === 'active' ? 'inactive' : 'active';
      const result = setAccessCodeStatus(code.id, next);
      result.ok ? message.success(next === 'active' ? 'เปิดใช้โค้ดแล้ว' : 'ปิดใช้โค้ดแล้ว') : message.error(result.message);
    }}>{code.status === 'active' ? 'ปิดโค้ด' : 'เปิดโค้ด'}</Button> },
  ];

  return <div className="access-codes-page">
    <PageTitle eyebrow="ผู้ดูแลระบบ · การขาย" title="โค้ดส่วนลดและเงินสด" subtitle="ออกโค้ดสำหรับลดราคา ให้เรียนฟรี หรือบันทึกยอดขายที่รับเป็นเงินสดแล้ว"/>
    <Alert className="access-code-demo-note" type="info" showIcon message="ข้อมูลจำลองในเบราว์เซอร์" description="โค้ดเงินสดใช้ได้ครั้งเดียวกับผู้เรียนที่ระบุ ยอดรับจะเข้าในรายงานและคำนวณส่วนแบ่งผู้สอนตามอัตราปัจจุบัน ไม่มีการรับชำระหรือโอนเงินจริงในต้นแบบ"/>
    <section className="access-code-form-panel">
      <div className="access-code-section-heading"><div><h2>ออกโค้ดใหม่</h2><p>เว้นช่องรหัสไว้ให้ระบบสร้างโค้ดให้อัตโนมัติ</p></div><span className="access-code-icon"><PlusOutlined/></span></div>
      {paidCourses.length ? <Form form={form} layout="vertical" initialValues={{ kind: 'percent', maxUses: 100 }} onFinish={submit} className="access-code-form">
        <div className="access-code-form-grid">
          <Form.Item name="courseId" label="คอร์ส" rules={[{ required: true, message: 'เลือกคอร์สก่อนออกโค้ด' }]}>
            <Select showSearch optionFilterProp="label" placeholder="เลือกคอร์ส" options={paidCourses.map((course) => ({ value: course.id, label: `${course.title} · ${formatPrice(course.price)}` }))}/>
          </Form.Item>
          <Form.Item name="kind" label="ประเภทโค้ด" rules={[{ required: true }]}>
            <Select options={kinds.map(({ value, label }) => ({ value, label }))}/>
          </Form.Item>
          <Form.Item name="code" label="รหัสโค้ด" extra="4–24 ตัวอักษร A–Z, 0–9 หรือขีดกลาง">
            <Input maxLength={24} placeholder="เช่น MATH-20 หรือเว้นว่างเพื่อสร้างอัตโนมัติ" autoCapitalize="characters"/>
          </Form.Item>
          {kind === 'percent' && <Form.Item name="value" label="ส่วนลด (%)" rules={[{ required: true, message: 'ระบุเปอร์เซ็นต์ส่วนลด' }]}><InputNumber min={1} max={100} precision={0} addonAfter="%" className="access-code-control"/></Form.Item>}
          {kind === 'fixed' && <Form.Item name="value" label="ส่วนลด (บาท)" rules={[{ required: true, message: 'ระบุยอดส่วนลด' }]}><InputNumber min={1} max={Number(selectedCourse?.price ?? 0)} precision={2} className="access-code-control"/></Form.Item>}
          {kind === 'cash' && <Form.Item name="userId" label="ผู้เรียนที่จ่ายเงินสด" rules={[{ required: true, message: 'เลือกผู้เรียน' }]}><Select showSearch optionFilterProp="label" placeholder="เลือกผู้เรียน" options={learners.map((user: User) => ({ value: user.id, label: `${user.name} · ${user.email}` }))}/></Form.Item>}
          {kind === 'cash' && <Form.Item name="receivedAmount" label="ยอดเงินสดที่รับแล้ว (บาท)" rules={[{ required: true, message: 'บันทึกยอดเงินที่รับจริง' }]}><InputNumber min={0.01} max={Number(selectedCourse?.price ?? 0)} precision={2} className="access-code-control"/></Form.Item>}
          {kind !== 'cash' && <Form.Item name="maxUses" label="จำนวนครั้งที่ใช้ได้" extra="เว้นว่างเพื่อไม่จำกัด"><InputNumber min={1} precision={0} className="access-code-control" placeholder="ไม่จำกัด"/></Form.Item>}
          <Form.Item name="expiresAt" label="วันหมดอายุ (ไม่บังคับ)"><Input type="date"/></Form.Item>
        </div>
        {kind === 'cash' && <Alert className="access-code-cash-note" type="info" showIcon message={selectedCourse ? `ยอดรับจริงจะถูกบันทึกเป็นยอดขาย และแบ่งตามอัตราผู้สอนของคอร์สนี้ · ราคาเต็ม ${formatPrice(selectedCourse.price)}` : 'เลือกคอร์สเพื่อบันทึกยอดเงินสดที่รับจริง'}/>}
        <Button type="primary" htmlType="submit" loading={saving}>สร้างโค้ด</Button>
      </Form> : <Empty description="ยังไม่มีคอร์สที่มีราคาสำหรับออกโค้ด"/>}
    </section>
    <section className="access-code-list-panel">
      <div className="access-code-section-heading"><div><h2>โค้ดที่ออกแล้ว</h2><p>ปิดการใช้โค้ดได้โดยไม่ลบประวัติเดิม</p></div><Tag color="blue">{data.accessCodes.length} โค้ด</Tag></div>
      <Table rowKey="id" dataSource={data.accessCodes} columns={columns} pagination={{ pageSize: 8, hideOnSinglePage: true }} scroll={{ x: 1080 }} locale={{ emptyText: <Empty description="ยังไม่มีโค้ดที่ออก"/> }}/>
    </section>
  </div>;
}
