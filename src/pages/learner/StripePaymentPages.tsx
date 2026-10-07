import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Result, Space, Spin, Typography } from 'antd';
import { ArrowLeftOutlined, CreditCardOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageTitle } from '../../components/common';
import { formatPrice, instructorFor } from '../../data';
import { useLms } from '../../store';
import { createCheckoutSession, getPaymentStatus, getPaymentEligibility, paymentGrantsCourseAccess, PaymentApiError, type PaymentStatusResponse } from '../../api/payments';

const { Text, Title } = Typography;
const POLL_DELAY_MS = 1800;
const MAX_AUTOMATIC_CHECKS = 8;

function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function StripeCheckoutPage() {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const { currentUser } = useLms();
  const accountKey = currentUser ? `${currentUser.id}:${currentUser.role}:${currentUser.status ?? ''}:${currentUser.emailVerified ?? ''}` : 'signed-out';
  return <StripeCheckoutForm key={`${accountKey}:${courseId}`} courseId={courseId} />;
}

function StripeCheckoutForm({ courseId }: { courseId: string }) {
  const { data, currentUser } = useLms();
  const navigate = useNavigate();
  const course = data.courses.find((item) => item.id === courseId);
  const eligibility = getPaymentEligibility(currentUser, course, data.enrollments);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useMemo(newRequestId, [courseId, currentUser?.id]);
  const pendingRequest = useRef<AbortController | null>(null);

  useEffect(() => () => pendingRequest.current?.abort(), []);

  if (!course || !courseId) return <Empty description="ไม่พบคอร์สนี้" />;
  if (!eligibility.eligible) {
    const copy = {
      course_unavailable: ['คอร์สนี้ยังไม่พร้อมขาย', 'กลับไปดูคอร์สที่เผยแพร่แล้ว'],
      not_allowed: ['บัญชีนี้ซื้อคอร์สไม่ได้', 'การซื้อคอร์สใช้ได้สำหรับผู้เรียนและผู้สอนที่ซื้อคอร์สของผู้อื่น'],
      suspended: ['บัญชีนี้ยังทำรายการไม่ได้', 'ติดต่อผู้ดูแลระบบเพื่อสอบถามสถานะบัญชี'],
      email_unverified: ['กรุณายืนยันอีเมลก่อนซื้อคอร์ส', 'ยืนยันอีเมลของบัญชีนี้แล้วจึงกลับมาซื้อได้'],
      already_enrolled: ['คุณมีคอร์สนี้แล้ว', 'เปิดคอร์สจากรายการเรียนของคุณ'],
      course_owner: ['ไม่สามารถซื้อคอร์สของตนเอง', 'ผู้สอนซื้อคอร์สของผู้สอนคนอื่นได้'],
    }[eligibility.reason];
    return <Result status="info" title={copy[0]} subTitle={copy[1]} extra={<Link to={`/explore/courses/${course.slug}`}><Button type="primary">กลับหน้าคอร์ส</Button></Link>} />;
  }

  const startCheckout = async () => {
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await createCheckoutSession({ courseId, requestId }, fetch, controller.signal);
      if (controller.signal.aborted) return;
      if ('already_enrolled' in response) {
        if (response.course_id !== courseId || response.enrollment.courseId !== courseId) throw new PaymentApiError('ระบบตอบสิทธิ์เรียนไม่ตรงกับคอร์สนี้');
        if (controller.signal.aborted) return;
        navigate(`/learn/courses/${encodeURIComponent(courseId)}`);
        return;
      }
      if (controller.signal.aborted) return;
      window.location.assign(response.checkout_url);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'เริ่มรายการชำระเงินไม่ได้ กรุณาลองใหม่');
    } finally {
      if (pendingRequest.current === controller) {
        pendingRequest.current = null;
        setBusy(false);
      }
    }
  };

  const teacher = instructorFor(data, course);
  return <div className="checkout-page">
    <Link to={`/explore/courses/${course.slug}`}><ArrowLeftOutlined /> กลับหน้าคอร์ส</Link>
    <PageTitle eyebrow="ชำระเงินผ่าน Stripe" title="ยืนยันการซื้อคอร์ส" subtitle="ระบบจะพาคุณไปชำระเงินบนหน้า Stripe Checkout" />
    <div className="checkout-grid">
      <section className="checkout-main">
        <Title level={4}>ชำระเงินอย่างปลอดภัย</Title>
        <Alert showIcon type="info" message="ระบบตรวจผลการชำระเงินจากเซิร์ฟเวอร์" description="หลังชำระแล้ว ระบบจะเปิดสิทธิ์เรียนเมื่อได้รับและยืนยันผลจาก Stripe เรียบร้อย" />
      </section>
      <aside className="checkout-summary">
        <Title level={4}>คอร์สที่เลือก</Title>
        <div className="checkout-course"><img src={course.cover} alt="" /><div><Text strong>{course.title}</Text><Text type="secondary">ผู้สอน {teacher?.name}</Text></div></div>
        <div className="stripe-payment-price"><Text>ราคาคอร์ส</Text><Text strong>{formatPrice(course.price)}</Text></div>
        <Button block size="large" type="primary" icon={<CreditCardOutlined />} loading={busy} onClick={startCheckout}>ไปชำระเงินที่ Stripe</Button>
        {error && <Alert className="checkout-code-message" type="error" showIcon message={error} />}
        <Text className="secure-note"><SafetyCertificateOutlined /> ชำระเงินบนหน้า Stripe Checkout</Text>
      </aside>
    </div>
  </div>;
}

function paymentMessage(payment: PaymentStatusResponse | null, error: string, checks: number) {
  if (error) return { type: 'error' as const, title: 'ตรวจสอบสถานะไม่ได้', description: error };
  if (!payment) return { type: 'info' as const, title: 'กำลังตรวจสอบรายการ', description: 'กำลังขอสถานะล่าสุดจากเซิร์ฟเวอร์' };
  if (payment.status === 'failed' || payment.status === 'cancelled' || payment.status === 'expired') {
    return { type: 'warning' as const, title: payment.status === 'expired' ? 'รายการหมดอายุ' : payment.status === 'cancelled' ? 'ยังไม่ได้ยืนยันการชำระเงิน' : 'รายการชำระเงินไม่สำเร็จ', description: 'ยังไม่มีการเปิดสิทธิ์เรียนจากรายการนี้ คุณกลับไปดูคอร์สได้' };
  }
  if (payment.status === 'succeeded' && payment.fulfillment_status === 'failed') {
    return { type: 'error' as const, title: 'ได้รับผลชำระแล้ว กำลังแก้ไขการเปิดสิทธิ์', description: 'ระบบบันทึกผลชำระแล้วแต่ยังเปิดสิทธิ์เรียนไม่สำเร็จ กรุณาตรวจสอบอีกครั้งภายหลัง' };
  }
  if (payment.status === 'succeeded' && payment.fulfillment_status === 'pending') {
    return { type: 'info' as const, title: 'ชำระเงินแล้ว กำลังยืนยันสิทธิ์เรียน', description: 'รอเซิร์ฟเวอร์บันทึกสิทธิ์เข้าเรียนก่อนเริ่มเรียน' };
  }
  if (payment.status === 'succeeded' && payment.fulfillment_status === 'granted' && !paymentGrantsCourseAccess(payment, payment.course_id)) {
    return { type: 'error' as const, title: 'ข้อมูลสิทธิ์เรียนไม่ตรงกับรายการนี้', description: 'ระบบยังไม่สามารถยืนยันสิทธิ์เรียนของรายการนี้ได้ กรุณาติดต่อผู้ดูแลระบบ' };
  }
  if (checks >= MAX_AUTOMATIC_CHECKS) return { type: 'info' as const, title: 'รอผลยืนยันจาก Stripe', description: 'รายการยังอยู่ระหว่างตรวจสอบ คุณกลับมาตรวจสถานะนี้ได้อีกครั้ง' };
  return { type: 'info' as const, title: 'กำลังรอผลยืนยันจาก Stripe', description: 'เมื่อเซิร์ฟเวอร์ยืนยันผลและสิทธิ์เรียนแล้ว ปุ่มเริ่มเรียนจะแสดงที่นี่' };
}

export function StripePaymentResultPage() {
  const { orderId: paymentId = '' } = useParams<{ orderId: string }>();
  const { currentUser } = useLms();
  return <StripePaymentResultView key={`${currentUser?.id ?? ''}:${paymentId}`} paymentId={paymentId} />;
}

function StripePaymentResultView({ paymentId }: { paymentId: string }) {
  const { data, currentUser } = useLms();
  const [payment, setPayment] = useState<PaymentStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [checking, setChecking] = useState(false);
  const course = payment ? data.courses.find((item) => item.id === payment.course_id) : undefined;
  const hasAccess = Boolean(payment && paymentGrantsCourseAccess(payment, payment.course_id));

  const checkStatus = useCallback(async (signal?: AbortSignal) => {
    if (!paymentId) return false;
    setChecking(true);
    try {
      const result = await getPaymentStatus(paymentId, fetch, signal);
      if (signal?.aborted) return false;
      if (result.payment_id !== paymentId) throw new PaymentApiError('เซิร์ฟเวอร์ตอบรายการชำระเงินไม่ตรงกัน');
      setPayment(result);
      setError('');
      setChecks((count) => count + 1);
      return result.status === 'pending' || result.status === 'processing' || (result.status === 'succeeded' && result.fulfillment_status === 'pending');
    } catch (cause) {
      if (signal?.aborted) return false;
      setError(cause instanceof Error ? cause.message : 'ตรวจสอบสถานะไม่ได้');
      setChecks((count) => count + 1);
      return false;
    } finally {
      if (!signal?.aborted) setChecking(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (!currentUser || currentUser.status === 'suspended') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const run = async () => {
      attempts += 1;
      const shouldContinue = await checkStatus(controller.signal);
      if (!controller.signal.aborted && shouldContinue && attempts < MAX_AUTOMATIC_CHECKS) {
        timer = setTimeout(run, POLL_DELAY_MS);
      }
    };
    void run();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [checkStatus, currentUser, refreshKey]);

  if (!currentUser) return <Empty description="เข้าสู่ระบบเพื่อดูรายการชำระเงินของคุณ" />;
  if (currentUser.status === 'suspended') return <Result status="warning" title="บัญชีนี้ยังดูรายการชำระเงินไม่ได้" subTitle="ติดต่อผู้ดูแลระบบเพื่อสอบถามสถานะบัญชี" />;
  const state = paymentMessage(payment, error, checks);
  return <div className="checkout-result">
    {hasAccess ? <Result status="success" title="ยืนยันการชำระเงินและสิทธิ์เรียนแล้ว" subTitle={`${course?.title ?? 'คอร์ส'} พร้อมให้เรียน`} extra={<Space wrap><Link to={`/learn/courses/${encodeURIComponent(payment!.course_id)}`}><Button type="primary">เริ่มเรียน</Button></Link><Link to={`/explore/courses/${encodeURIComponent(course?.slug ?? payment!.course_id)}`}><Button>ดูคอร์ส</Button></Link></Space>} /> : <>
      <Result status={state.type} title={state.title} subTitle={state.description} />
      {checking && <div className="stripe-payment-checking"><Spin size="small" /> กำลังตรวจสอบกับเซิร์ฟเวอร์</div>}
      <Space wrap className="stripe-payment-actions">
        <Button onClick={() => { setChecks(0); setRefreshKey((key) => key + 1); }} disabled={checking}>ตรวจสถานะอีกครั้ง</Button>
        {payment?.course_id && <Link to={`/explore/courses/${encodeURIComponent(course?.slug ?? payment.course_id)}`}><Button>กลับไปดูคอร์ส</Button></Link>}
      </Space>
    </>}
    <div className="stripe-payment-id"><Text type="secondary">หมายเลขรายการ: {paymentId}</Text></div>
  </div>;
}
