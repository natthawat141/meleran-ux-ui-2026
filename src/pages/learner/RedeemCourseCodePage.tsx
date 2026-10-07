import { useState } from 'react';
import { Alert, Button, Descriptions, Empty, Input, Result, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle } from '../../components/common';
import { instructorFor } from '../../data';
import { normalizeRedeemCode, quoteRedeemCode, resolveRedeemResult } from '../../lib/redeem-code';
import { getPaymentEligibility } from '../../api/payments';

const { Title, Text } = Typography;

export function RedeemCourseCodePage() {
  const { data } = useLms();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const checkCode = () => {
    const normalized = normalizeRedeemCode(code);
    const redeemCode = data.redeemCodes.find((item) => normalizeRedeemCode(item.code) === normalized);
    if (!redeemCode) {
      setError('ไม่พบรหัสสิทธิ์คอร์สนี้');
      return;
    }
    const quote = quoteRedeemCode(data.redeemCodes, normalized, redeemCode.courseId);
    if (!quote.ok) {
      setError(quote.message);
      return;
    }
    const course = data.courses.find((item) => item.id === redeemCode.courseId && item.status === 'published' && item.price > 0);
    if (!course) {
      setError('คอร์สของรหัสนี้ไม่พร้อมให้แลก');
      return;
    }
    navigate(`/checkout/${course.id}?channel=redeem&code=${encodeURIComponent(redeemCode.code)}`);
  };

  return <div className="checkout-page">
    <PageTitle eyebrow="พื้นที่เรียนรู้" title="แลกรหัสคอร์ส" subtitle="เข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์เรียน แล้วกรอกรหัสที่ได้รับเพื่อยืนยันสิทธิ์เข้าเรียน" />
    <section className="checkout-main">
      <Space.Compact className="checkout-code-input">
        <Input value={code} onChange={(event) => { setCode(event.target.value); setError(''); }} onPressEnter={checkCode} placeholder="กรอกรหัสสิทธิ์คอร์ส" aria-label="รหัสสิทธิ์คอร์ส" />
        <Button type="primary" onClick={checkCode}>ตรวจสอบรหัส</Button>
      </Space.Compact>
      {error && <Alert className="checkout-code-message" type="error" showIcon message={error} />}
      <Alert showIcon type="info" message="รหัสสิทธิ์คอร์สใช้ได้ครั้งเดียว" description="เมื่อตรวจสอบแล้ว ระบบจะแสดงคอร์สที่รหัสนี้ใช้ได้ก่อนยืนยัน" />
    </section>
  </div>;
}

export function RedeemCheckoutPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { data, currentUser, redeemCourseCode } = useLms();
  const initialCode = new URLSearchParams(window.location.search).get('code') ?? '';
  const [draftCode, setDraftCode] = useState(initialCode);
  const [appliedCode, setAppliedCode] = useState(initialCode);
  const [codeMessage, setCodeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const course = data.courses.find((item) => item.id === courseId);

  if (!course || !courseId) return <Empty description="ไม่พบคอร์สนี้" />;
  const eligibility = getPaymentEligibility(currentUser, course, data.enrollments);
  if (course.price <= 0 && course.status === 'published') {
    return <Result status="info" title="คอร์สนี้เรียนฟรี" subTitle="สมัครเรียนได้จากหน้ารายละเอียดคอร์ส" extra={<Link to={`/explore/courses/${course.slug}`}><Button type="primary">กลับไปสมัครเรียนฟรี</Button></Link>} />;
  }

  const teacher = instructorFor(data, course);
  const quoteFor = (value: string) => quoteRedeemCode(data.redeemCodes, value, course.id);
  const quote = appliedCode
    ? quoteFor(appliedCode)
    : { ok: false as const, message: 'กรอกรหัสแลกคอร์สเพื่อดำเนินการ' };
  const applyCode = (rawCode = draftCode) => {
    const normalized = normalizeRedeemCode(rawCode);
    if (!normalized) {
      setAppliedCode('');
      setCodeMessage(null);
      return;
    }
    const result = quoteFor(normalized);
    setAppliedCode(normalized);
    if (!result.ok) {
      setCodeMessage({ type: 'error', text: result.message });
      return;
    }
    setDraftCode(normalized);
    setCodeMessage({ type: 'success', text: 'ตรวจพบรหัสที่ใช้กับคอร์สนี้ได้' });
  };
  const redeem = () => {
    if (!eligibility.eligible || !quote.ok) return;
    const result = redeemCourseCode(appliedCode);
    if (!result.ok) {
      setCodeMessage({ type: 'error', text: result.message });
      return;
    }
    navigate(`/checkout/${result.enrollmentId}/result?channel=redeem`);
  };

  return (
    <div className="checkout-page">
      <Link to={`/courses/${course.slug}`}><ArrowLeftOutlined /> กลับหน้าคอร์ส</Link>
      <PageTitle eyebrow="ยืนยันสิทธิ์คอร์ส" title="ยืนยันแลกรหัสคอร์ส" subtitle="ตรวจสอบว่ารหัสตรงกับคอร์สก่อนยืนยันสิทธิ์" />
      <div className="checkout-grid">
        <section className="checkout-main">
          <Title level={4}>รหัสแลกคอร์ส</Title>
          {!eligibility.eligible && <Alert className="checkout-code-message" type="warning" showIcon message={{
            course_unavailable: 'คอร์สนี้ยังไม่พร้อมให้แลกสิทธิ์',
            not_allowed: 'บัญชีนี้แลกรหัสคอร์สไม่ได้',
            suspended: 'บัญชีนี้ยังทำรายการไม่ได้',
            email_unverified: 'กรุณายืนยันอีเมลก่อนแลกรหัสคอร์ส',
            already_enrolled: 'คุณมีสิทธิ์เรียนคอร์สนี้อยู่แล้ว',
            course_owner: 'ผู้สอนไม่สามารถแลกรหัสคอร์สของตนเอง',
          }[eligibility.reason]} />}
          <Space.Compact className="checkout-code-input">
            <Input value={draftCode} onChange={(event) => { setDraftCode(event.target.value); setAppliedCode(''); setCodeMessage(null); }} onPressEnter={() => applyCode()} placeholder="กรอกรหัสแลกคอร์ส" aria-label="รหัสแลกคอร์ส" />
            <Button onClick={() => applyCode()}>ตรวจสอบรหัส</Button>
          </Space.Compact>
          {codeMessage && <Alert className="checkout-code-message" type={codeMessage.type} showIcon message={codeMessage.text} />}
          {appliedCode && !quote.ok && !codeMessage && <Alert className="checkout-code-message" type="error" showIcon message={quote.message} />}
          {quote.ok && <Alert showIcon type="info" message="พร้อมแลกรหัสคอร์ส" description="ยืนยันเพื่อเพิ่มคอร์สนี้ในรายการเรียน" />}
        </section>
        <aside className="checkout-summary">
          <Title level={4}>คอร์สที่ได้รับสิทธิ์</Title>
          <div className="checkout-course">
            <img src={course.cover} alt="" />
            <div>
              <Text strong>{course.title}</Text>
              <Text type="secondary">ผู้สอน {teacher?.name}</Text>
            </div>
          </div>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="สถานะรหัส">{quote.ok ? 'พร้อมใช้หนึ่งครั้ง' : 'รอตรวจสอบ'}</Descriptions.Item>
          </Descriptions>
          <Button block size="large" type="primary" disabled={!eligibility.eligible || !quote.ok} onClick={redeem}>
            ยืนยันแลกรหัสคอร์ส
          </Button>
        </aside>
      </div>
    </div>
  );
}

export function RedeemCheckoutResultPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const { data, currentUser } = useLms();
  const result = resolveRedeemResult(data, orderId, currentUser?.id ?? '');

  if (!result) return <Empty description="ไม่พบรายการ Redeem นี้" />;
  if (result.state === 'not_granted') {
    const copies = {
      failed: ['error', 'การแลกรหัสไม่สำเร็จ', 'รหัสนี้ยังไม่ได้เพิ่มสิทธิ์เข้าเรียน'],
      cancelled: ['warning', 'รายการเดิมถูกยกเลิก', 'ตรวจสอบรหัสที่ได้รับแล้วลองอีกครั้ง'],
      pending: ['info', 'ยังไม่พบการยืนยันสิทธิ์', 'ระบบจะเปิดคอร์สเมื่อพบสิทธิ์เรียนที่บันทึกไว้แล้ว'],
      missing_enrollment: ['warning', 'ยังไม่พบสิทธิ์เรียนจากรายการเดิม', 'ติดต่อผู้ดูแลหากเคยแลกรหัสสำเร็จแล้ว'],
    } as const;
    const copy = copies[result.legacyStatus];
    return <div className="checkout-result"><Result status={copy[0]} title={copy[1]} subTitle={copy[2]} extra={<Link to="/learn/redeem"><Button type="primary">กลับไปแลกรหัส</Button></Link>} /></div>;
  }

  const course = data.courses.find((item) => item.id === result.courseId);
  if (!course) return <Empty description="ไม่พบคอร์สของสิทธิ์นี้" />;

  return (
    <div className="checkout-result">
      <Result
        status="success"
        title="แลกรหัสคอร์สสำเร็จ"
        subTitle={`${course.title} ถูกเพิ่มไว้ในคอร์สของคุณแล้ว`}
        extra={<Space wrap>
          <Link to={`/learn/courses/${course.id}`}><Button type="primary">เริ่มเรียน</Button></Link>
          <Link to={`/courses/${course.slug}`}><Button>ดูคอร์ส</Button></Link>
        </Space>}
      />
    </div>
  );
}
