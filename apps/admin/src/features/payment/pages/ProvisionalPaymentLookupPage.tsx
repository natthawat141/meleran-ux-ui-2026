import React, { useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Input, Spin, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { PageTitle } from '@melearn/ui';
import { useAdminPayment } from '../hooks/use-admin-payment';
import type { AdminPayment } from '../api/admin-payment-api';

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency }).format(amountMinor / 100);
}

export function ProvisionalPaymentLookupPage() {
  const [input, setInput] = useState(''); const [paymentId, setPaymentId] = useState('');
  const payment = useAdminPayment(paymentId);
  const columns: TableColumnsType<AdminPayment['events'][number]> = [
    { title: 'Event', dataIndex: 'type' }, { title: 'Event ID', dataIndex: 'event_id' },
    { title: 'รับเมื่อ', dataIndex: 'received_at', render: (value: string) => new Date(value).toLocaleString('th-TH') },
    { title: 'ประมวลผลเมื่อ', dataIndex: 'processed_at', render: (value: string | null) => value ? new Date(value).toLocaleString('th-TH') : 'ยังไม่ประมวลผล' },
    { title: 'ผล', dataIndex: 'outcome' },
  ];
  const search = () => setPaymentId(input.trim());
  return <div className="public-page">
    <PageTitle eyebrow="ผู้ดูแลระบบ · R8 mock" title="ตรวจสอบรายการ Payment" subtitle="ค้นหา Payment ทีละรายการด้วย ID เพื่อช่วยตรวจเหตุผิดปกติ" />
    <Alert showIcon type="warning" message="อ่านอย่างเดียว · provisional mock" description="ไม่มีรายการ Payment ทั้งหมด ไม่มีคำสั่งคืนเงิน และข้อมูลจะหายเมื่อ mock server หยุดทำงาน" />
    <Card className="top-space" title="ค้นหา Payment ID">
      <Input.Search aria-label="Payment ID" placeholder="ใส่ Payment ID" value={input} onChange={(event) => setInput(event.target.value)} onSearch={search} enterButton="ค้นหา" allowClear />
      {paymentId && payment.isPending && <div className="top-space"><Spin /></div>}
      {paymentId && payment.isError && <Alert className="top-space" type="error" showIcon message="ไม่พบหรืออ่าน Payment ไม่ได้" description={payment.error.message} action={<Button onClick={() => void payment.refetch()}>ลองอีกครั้ง</Button>} />}
      {payment.data && <>
        <Descriptions className="top-space" bordered size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Payment ID">{payment.data.payment_id}</Descriptions.Item>
          <Descriptions.Item label="Course ID">{payment.data.course_id}</Descriptions.Item>
          <Descriptions.Item label="User ID">{payment.data.user_id}</Descriptions.Item>
          <Descriptions.Item label="จำนวนเงิน">{money(payment.data.amount.amount_minor, payment.data.amount.currency)}</Descriptions.Item>
          <Descriptions.Item label="Payment status"><Tag>{payment.data.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="Fulfillment"><Tag color={payment.data.fulfillment_status === 'granted' ? 'green' : 'default'}>{payment.data.fulfillment_status}</Tag></Descriptions.Item>
          <Descriptions.Item label="Enrollment">{payment.data.enrollment?.id ?? 'ยังไม่มีสิทธิ์เรียน'}</Descriptions.Item>
          <Descriptions.Item label="สร้างเมื่อ">{new Date(payment.data.created_at).toLocaleString('th-TH')}</Descriptions.Item>
          <Descriptions.Item label="Checkout session">{payment.data.checkout_session_id}</Descriptions.Item>
          <Descriptions.Item label="Request ID">{payment.data.request_id}</Descriptions.Item>
        </Descriptions>
        <Typography.Title className="top-space" level={5}>Webhook events</Typography.Title>
        <Table rowKey="event_id" size="small" dataSource={payment.data.events} columns={columns} pagination={false} locale={{ emptyText: <Empty description="ยังไม่มี Event" /> }} scroll={{ x: 700 }} />
      </>}
    </Card>
  </div>;
}
