import React, { useState } from 'react';
import { Alert, Button, Card, Form, Input, Result, Space, Spin, Typography, message } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '@legacy/components/common';
import { devCatalogApi } from '../../courses/api/dev-catalog-client';
import { usePaymentStatus, useRedeemCourseCode, useSimulateStripeCompletion, useStartPayment } from '../hooks/use-payment';

function requestId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`; }
function formatPrice(price: { amount_minor: number; currency: string } | null) {
  if (!price) return 'ฟรี';
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: price.currency }).format(price.amount_minor / 100);
}

export function ProvisionalCheckoutPage() {
  const { courseId = '' } = useParams(); const navigate = useNavigate();
  const course = useQuery({ queryKey: ['catalog', 'detail', courseId], queryFn: ({ signal }) => devCatalogApi.getCourse(courseId, { signal }), enabled: Boolean(courseId) });
  const checkout = useStartPayment(); const [requestKey] = useState(requestId);
  if (course.isPending) return <div className="public-page" role="status"><Spin /> กำลังโหลดคอร์ส</div>;
  if (course.isError) return <div className="public-page"><Alert type="error" showIcon message="โหลดข้อมูลคอร์สไม่ได้" description="ตรวจสอบ API จำลองแล้วลองใหม่" action={<Button onClick={() => void course.refetch()}>ลองอีกครั้ง</Button>} /></div>;
  if (!course.data) return <div className="public-page"><Result status="404" title="ไม่พบคอร์สนี้" extra={<Link to="/courses"><Button>กลับไปดูคอร์ส</Button></Link>} /></div>;
  if (course.data.price === null) return <div className="public-page"><Result status="info" title="คอร์สนี้เรียนฟรี" extra={<Link to={`/courses/${courseId}`}><Button type="primary">กลับไปสมัครเรียน</Button></Link>} /></div>;
  const begin = () => checkout.mutate({ courseId, requestId: requestKey }, { onSuccess: (result) => {
    if ('already_enrolled' in result && result.already_enrolled) { navigate(`/learn/courses/${encodeURIComponent(result.course_id)}`); return; }
    navigate(`/checkout/${encodeURIComponent(result.payment_id)}/result`);
  } });
  return <div className="public-page">
    <PageTitle eyebrow="ชำระเงิน · โหมดพัฒนา" title="ยืนยันรายการซื้อคอร์ส" subtitle={course.data.title} actions={<Link to={`/courses/${course.data.slug}`}><Button>กลับไปหน้าคอร์ส</Button></Link>} />
    <Alert showIcon type="warning" message="Stripe ยังไม่เชื่อมต่อใน mock" description="ปุ่มนี้สร้างรายการ Payment จำลองเท่านั้น ระบบจะไม่เปิดสิทธิ์เรียนจากการกลับมาที่หน้านี้หรือจาก URL ผลลัพธ์" />
    <Card className="top-space"><Typography.Text>ผู้สอน: {course.data.instructor.display_name}</Typography.Text><Typography.Title level={3}>{formatPrice(course.data.price)}</Typography.Title>
      <Button type="primary" loading={checkout.isPending} onClick={begin}>สร้างรายการชำระเงินจำลอง</Button>
      {checkout.isError && <Alert className="top-space" type="error" showIcon message="เริ่มรายการไม่ได้" description={checkout.error.message} />}
    </Card>
  </div>;
}

export function ProvisionalPaymentResultPage() {
  const { orderId = '' } = useParams(); const query = usePaymentStatus(orderId); const simulate = useSimulateStripeCompletion(orderId);
  if (query.isPending || query.isError) return <div className="public-page">{query.isPending ? <Spin /> : <Alert type="error" showIcon message="อ่านสถานะ Payment ไม่ได้" description={query.error.message} action={<Button onClick={() => void query.refetch()}>ลองอีกครั้ง</Button>} />}</div>;
  const payment = query.data; const enrolled = payment.status === 'succeeded' && payment.fulfillment_status === 'granted' && payment.enrollment?.course_id === payment.course_id;
  const state = enrolled ? ['success', 'ชำระสำเร็จและได้รับสิทธิ์เรียนแล้ว', 'สิทธิ์นี้มาจากสถานะที่ API จำลองคืนมา'] as const
    : payment.status === 'failed' || payment.status === 'expired' || payment.status === 'cancelled' ? ['warning', 'ยังไม่มีสิทธิ์เรียนจากรายการนี้', `สถานะรายการ: ${payment.status}`] as const
      : payment.status === 'succeeded' && payment.fulfillment_status === 'failed' ? ['error', 'ยืนยันการชำระแล้ว แต่ยังให้สิทธิ์เรียนไม่สำเร็จ', 'ต้องให้ Backend retry fulfillment จากเหตุการณ์เดิม ไม่เริ่มเรียกเก็บเงินใหม่'] as const
        : ['info', 'รอผลจาก Stripe', 'รายการ mock จะคงสถานะรอ จนกว่าจะมี webhook ที่ผ่านการตรวจลายเซ็น'] as const;
  const pending = payment.status === 'pending' || payment.status === 'processing';
  return <div className="public-page"><PageTitle eyebrow="ผลรายการ · โหมดพัฒนา" title="สถานะการชำระเงิน" />
    {pending && <Alert className="top-space" showIcon type="warning" message="โหมดพัฒนา: ยังไม่มี Stripe จริง" description="ปุ่มจำลองจะส่ง signed event ผ่าน webhook handler ของ provisional API เพื่อทดสอบ flow เท่านั้น ไม่ได้เรียกเก็บเงินจริงหรือยืนยันระบบ Production" />}
    <Result status={state[0]} title={state[1]} subTitle={state[2]} extra={enrolled ? <Link to={`/learn/courses/${payment.course_id}`}><Button type="primary">เริ่มเรียน</Button></Link> : pending ? <Space><Button onClick={() => void query.refetch()}>ตรวจสถานะอีกครั้ง</Button><Button type="primary" loading={simulate.isPending} onClick={() => simulate.mutate()}>จำลอง Stripe ยืนยันชำระ (mock)</Button></Space> : <Button onClick={() => void query.refetch()}>ตรวจสถานะอีกครั้ง</Button>} />
    {simulate.isError && <Alert type="error" showIcon message="จำลอง webhook ไม่สำเร็จ" description={simulate.error.message} />}
    <Typography.Text type="secondary">รายการ {payment.payment_id} · {payment.fulfillment_status === 'granted' ? 'เปิดสิทธิ์แล้ว' : 'ยังไม่เปิดสิทธิ์'}</Typography.Text>
  </div>;
}

export function ProvisionalRedeemPage() {
  const redeem = useRedeemCourseCode(); const navigate = useNavigate(); const [form] = Form.useForm<{ code: string }>();
  const submit = ({ code }: { code: string }) => redeem.mutate(code.trim(), { onSuccess: (result) => {
    void message.success(result.already_enrolled ? 'บัญชีนี้มีสิทธิ์เรียนอยู่แล้ว' : 'แลกรหัสสำเร็จ');
    navigate(`/learn/courses/${encodeURIComponent(result.enrollment.course_id)}`);
  } });
  return <div className="public-page"><PageTitle eyebrow="สิทธิ์เรียน · โหมดพัฒนา" title="แลกรหัสคอร์ส" subtitle="ตรวจและบันทึกสิทธิ์ผ่าน API จำลอง" />
    <Alert showIcon type="info" message="รหัสใช้ได้ครั้งเดียวและไม่มีวันหมดอายุ" description="ระบบจะไม่แสดงข้อมูลของรหัสก่อนส่งคำขอ และจะบันทึกการใช้พร้อมสิทธิ์เรียนเมื่อสำเร็จเท่านั้น" />
    <Card className="top-space"><Form form={form} layout="vertical" onFinish={submit}><Form.Item name="code" label="รหัสแลกคอร์ส" rules={[{ required: true, message: 'กรอกรหัสก่อนดำเนินการ' }]}><Input autoComplete="off" maxLength={64} /></Form.Item>
      <Button type="primary" htmlType="submit" loading={redeem.isPending}>แลกรหัส</Button></Form>
      {redeem.isError && <Alert className="top-space" type="error" showIcon message="แลกรหัสไม่สำเร็จ" description={redeem.error.message} />}
    </Card>
  </div>;
}
