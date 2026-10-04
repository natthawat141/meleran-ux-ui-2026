import React, { useState } from 'react';
import { Alert, Button, Descriptions, Empty, Input, Radio, Result, Space, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, CreditCardOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { PageTitle, StatusTag } from '../../components/common.jsx';
import { formatPrice, instructorFor } from '../../data.js';
import { normalizeAccessCode, orderChannelLabel, quoteAccessCode } from '../../lib/access-code-utils.js';

const { Title, Text } = Typography;

export function CheckoutPage() {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, currentUser, simulatePayment } = useLms();
  const [outcome, setOutcome] = useState('paid');
  const [draftCode, setDraftCode] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [codeMessage, setCodeMessage] = useState(null);
  const referralCode = new URLSearchParams(location.search).get('ref')?.trim();
  const referralQuery = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : '';
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) return <Empty description="ไม่พบคอร์สนี้"/>;
  if (course.price <= 0) return <Result status="info" title="คอร์สนี้เรียนฟรี" subTitle="สมัครเรียนได้จากหน้ารายละเอียดคอร์ส" extra={<Link to={`/courses/${course.slug}`}><Button type="primary">กลับไปสมัครเรียนฟรี</Button></Link>}/>;
  const teacher = instructorFor(data, course);
  const quoteFor = (code) => quoteAccessCode({ accessCodes: data.accessCodes ?? [], courseId, coursePrice: course.price, userId: currentUser?.id, enrollments: data.enrollments, code });
  const quote = quoteFor(appliedCode);
  const automaticAccess = quote.ok && (quote.source === 'cash_code' || quote.source === 'free_code');
  const applyCode = (value = draftCode) => {
    const normalized = normalizeAccessCode(value);
    if (!normalized) { setAppliedCode(''); setCodeMessage(null); return; }
    const result = quoteFor(normalized);
    if (!result.ok) { setAppliedCode(normalized); setCodeMessage(null); return; }
    setDraftCode(normalized);
    setAppliedCode(normalized);
    setCodeMessage({ type: 'success', text: result.source === 'cash_code' ? `ยืนยันยอดเงินสดที่รับแล้ว ${formatPrice(result.amount)}` : result.source === 'free_code' ? 'โค้ดนี้ให้สิทธิ์เรียนฟรี' : `ใช้โค้ดแล้ว ลด ${formatPrice(result.discountAmount)}` });
  };
  const order = () => {
    const orderId = simulatePayment(courseId, automaticAccess ? 'paid' : outcome, referralCode, appliedCode);
    if (!orderId) { setCodeMessage({ type: 'error', text: 'ใช้โค้ดนี้ไม่ได้ กรุณาตรวจสอบสถานะโค้ดอีกครั้ง' }); return; }
    navigate(`/checkout/${orderId}/result`);
  };
  return <div className="checkout-page">
    <Link to={`/courses/${course.slug}${referralQuery}`}><ArrowLeftOutlined/> กลับหน้าคอร์ส</Link>
    <PageTitle eyebrow="ชำระเงินจำลอง" title="ตรวจสอบรายการสั่งซื้อ" subtitle="การชำระเงินในต้นแบบใช้ข้อมูลจำลอง ไม่มีการรับข้อมูลบัตรจริง"/>
    <div className="checkout-grid">
      <section className="checkout-main">
        <Title level={4}>มีโค้ดส่วนลดหรือโค้ดรับสิทธิ์?</Title>
        <Space.Compact className="checkout-code-input"><Input value={draftCode} onChange={(event) => { setDraftCode(event.target.value); if (normalizeAccessCode(event.target.value) !== appliedCode) setAppliedCode(''); setCodeMessage(null); }} onPressEnter={() => applyCode()} placeholder="กรอกรหัสโค้ด" aria-label="รหัสส่วนลดหรือรับสิทธิ์"/><Button onClick={() => applyCode()}>ใช้โค้ด</Button></Space.Compact>
        {codeMessage && <Alert className="checkout-code-message" type={codeMessage.type} showIcon message={codeMessage.text}/>}
        {appliedCode && !quote.ok && <Alert className="checkout-code-message" type="error" showIcon message={quote.message}/>}
        {automaticAccess ? <Alert showIcon type="info" message={quote.source === 'cash_code' ? 'บันทึกการขายเงินสดแล้ว' : 'โค้ดนี้ให้เรียนฟรี'} description={quote.source === 'cash_code' ? 'แอดมินบันทึกยอดที่รับแล้ว ระบบจะเพิ่มคอร์สในรายการเรียนและลงยอดในรายงานผู้สอน' : 'ยืนยันเพื่อเพิ่มคอร์สในรายการเรียนโดยไม่คิดรายได้หรือส่วนแบ่ง'}/> : <>
          <Title level={4}>เลือกผลการชำระเพื่อทดลอง</Title>
          <Radio.Group value={outcome} onChange={(event) => setOutcome(event.target.value)} className="payment-outcomes"><Radio value="paid"><span><strong>ชำระสำเร็จ</strong><small>เพิ่มคอร์สในรายการเรียนทันที</small></span></Radio><Radio value="failed"><span><strong>ชำระไม่สำเร็จ</strong><small>สร้างรายการที่ไม่สำเร็จ ทดลองใหม่ได้</small></span></Radio></Radio.Group>
          <Alert showIcon type="info" message="วิธีชำระเงิน: บัตรจำลอง" description="ไม่ต้องกรอกหมายเลขบัตรหรือข้อมูลการเงินจริง"/>
        </>}
      </section>
      <aside className="checkout-summary">
        <Title level={4}>สรุปคำสั่งซื้อ</Title>
        <div className="checkout-course"><img src={course.cover} alt=""/><div><Text strong>{course.title}</Text><Text type="secondary">ผู้สอน {teacher?.name}</Text></div></div>
        <Descriptions column={1} size="small"><Descriptions.Item label="ราคาเต็ม">{formatPrice(course.price)}</Descriptions.Item>{quote.ok && quote.discountAmount > 0 && <Descriptions.Item label="ส่วนลด">−{formatPrice(quote.discountAmount)}</Descriptions.Item>}<Descriptions.Item label={automaticAccess ? 'ยอดรับ/ยอดสุทธิ' : 'ยอดที่ต้องชำระ'}><strong>{formatPrice(quote.ok ? quote.amount : course.price)}</strong></Descriptions.Item></Descriptions>
        <Button block size="large" type="primary" icon={<CreditCardOutlined/>} disabled={!quote.ok} onClick={order}>{automaticAccess ? 'ยืนยันรับสิทธิ์เข้าเรียน' : 'ยืนยันการชำระ'}</Button>
        <Text className="secure-note"><SafetyCertificateOutlined/> จัดทำเพื่อทดลอง UX เท่านั้น</Text>
      </aside>
    </div>
  </div>;
}

export function CheckoutResultPage() {
  const { orderId } = useParams();
  const { data } = useLms();
  const order = data.orders.find((item) => item.id === orderId);
  const course = data.courses.find((item) => item.id === order?.courseId);
  if (!order) return <Empty description="ไม่พบรายการนี้"/>;
  const referralQuery = order.referralCode ? `?ref=${encodeURIComponent(order.referralCode)}` : '';
  const successTitle = order.method === 'เงินสดผ่านโค้ด' ? 'บันทึกรับเงินสดแล้ว' : order.method === 'โค้ดเรียนฟรี' ? 'รับสิทธิ์เรียนแล้ว' : 'ชำระเงินสำเร็จ';
  return <div className="checkout-result"><Result status={order.status === 'paid' ? 'success' : 'error'} title={order.status === 'paid' ? successTitle : 'การชำระเงินไม่สำเร็จ'} subTitle={order.status === 'paid' ? `${course?.title} ถูกเพิ่มไว้ในคอร์สของคุณแล้ว` : 'รายการนี้ยังไม่ได้เปิดสิทธิ์เข้าเรียน คุณกลับไปลองชำระอีกครั้งได้'} extra={<Space wrap>{order.status === 'paid' && <Link to={`/learn/courses/${course?.id}`}><Button type="primary">เริ่มเรียน</Button></Link>}<Link to={`/checkout/${course?.id}${referralQuery}`}><Button>{order.status === 'paid' ? 'ดูคอร์ส' : 'ลองชำระอีกครั้ง'}</Button></Link><Link to="/account/orders"><Button>ดูรายการซื้อ</Button></Link></Space>}/></div>;
}

export function OrdersPage() {
  const { data, currentUser } = useLms();
  const isAdmin = currentUser.role === 'admin';
  const orders = data.orders.filter((order) => isAdmin || order.userId === currentUser.id);
  const paidOrders = orders.filter((order) => order.status === 'paid');
  const channelRevenue = (channel) => paidOrders.filter((order) => orderChannelLabel(order) === channel).reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const orderPath = isAdmin ? '/admin/orders' : '/account/orders';
  const columns = [
    ...(isAdmin ? [{ title: 'ผู้เรียน', render: (_, order) => data.users.find((user) => user.id === order.userId)?.name ?? 'ไม่พบผู้เรียน' }] : []),
    { title: 'คอร์ส', render: (_, order) => data.courses.find((course) => course.id === order.courseId)?.title ?? 'คอร์สที่ถูกลบ' },
    ...(isAdmin ? [{ title: 'ช่องทาง', render: (_, order) => <Tag color={order.source === 'cash_code' ? 'blue' : order.source === 'free_code' ? 'default' : 'cyan'}>{orderChannelLabel(order)}</Tag> }] : []),
    ...(isAdmin ? [{ title: 'ราคาเต็ม', render: (_, order) => formatPrice(order.listPrice ?? order.amount) }, { title: 'ส่วนลด', render: (_, order) => formatPrice(order.discountAmount || 0) }] : []),
    { title: isAdmin ? 'ยอดรับจริง' : 'ยอดรวม', dataIndex: 'amount', render: (amount) => formatPrice(amount) },
    { title: 'สถานะ', dataIndex: 'status', render: (status) => <StatusTag status={status}/> },
    ...(isAdmin ? [{ title: 'วิธีชำระ/โค้ด', render: (_, order) => <div className="access-code-cell"><span>{order.method}</span>{order.accessCode && <Text type="secondary">{order.accessCode}</Text>}</div> }] : []),
    { title: 'วันที่', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleDateString('th-TH') },
    { title: '', render: (_, order) => <Link to={`${orderPath}/${order.id}`}><Button>รายละเอียด</Button></Link> },
  ];
  return <>
    <PageTitle eyebrow={isAdmin ? 'ผู้ดูแลระบบ · การเงิน' : 'บัญชี'} title="รายการสั่งซื้อ" subtitle={isAdmin ? 'ตรวจยอดรับจริงและแยกช่องทางชำระผ่านระบบ โค้ดเงินสด และโค้ดเรียนฟรี' : 'ตรวจสอบสถานะการซื้อและเปิดรายการแต่ละครั้ง'}/>
    {isAdmin && <Descriptions className="admin-order-channels" bordered size="small" column={{ xs: 1, sm: 3 }}><Descriptions.Item label="ชำระผ่านระบบ">{formatPrice(channelRevenue('ชำระผ่านระบบ'))}</Descriptions.Item><Descriptions.Item label="เงินสดผ่านโค้ด">{formatPrice(channelRevenue('เงินสดผ่านโค้ด'))}</Descriptions.Item><Descriptions.Item label="โค้ดเรียนฟรี">{paidOrders.filter((order) => orderChannelLabel(order) === 'โค้ดเรียนฟรี').length} รายการ · {formatPrice(channelRevenue('โค้ดเรียนฟรี'))}</Descriptions.Item></Descriptions>}
    <Table rowKey="id" dataSource={orders} columns={columns} pagination={{ pageSize: 8 }} scroll={isAdmin ? { x: 1120 } : undefined} locale={{ emptyText: 'ยังไม่มีรายการสั่งซื้อ' }}/>
  </>;
}

export function OrderDetailPage() {
  const { orderId } = useParams();
  const { data, currentUser } = useLms();
  const order = data.orders.find((item) => item.id === orderId);
  if (!order) return <Empty description="ไม่พบรายการนี้"/>;
  const course = data.courses.find((item) => item.id === order.courseId);
  const isAdmin = currentUser.role === 'admin';
  return <><PageTitle eyebrow="รายการสั่งซื้อ" title="รายละเอียดและใบเสร็จจำลอง" actions={<Space><Link to={isAdmin ? '/admin/orders' : '/account/orders'}><Button>กลับรายการซื้อ</Button></Link><Button onClick={() => window.print()}>พิมพ์ใบเสร็จ</Button></Space>}/><Descriptions bordered column={1} className="order-details"><Descriptions.Item label="เลขรายการ">{order.id}</Descriptions.Item>{isAdmin && <Descriptions.Item label="ผู้เรียน">{data.users.find((user) => user.id === order.userId)?.name ?? order.userId}</Descriptions.Item>}<Descriptions.Item label="คอร์ส">{course?.title ?? 'คอร์สที่ถูกลบ'}</Descriptions.Item><Descriptions.Item label="ช่องทางขาย">{orderChannelLabel(order)}</Descriptions.Item><Descriptions.Item label="ราคาเต็ม">{formatPrice(order.listPrice ?? course?.price ?? order.amount)}</Descriptions.Item><Descriptions.Item label="ส่วนลด">{formatPrice(order.discountAmount || 0)}</Descriptions.Item>{order.accessCode && <Descriptions.Item label="โค้ดที่ใช้">{order.accessCode}</Descriptions.Item>}<Descriptions.Item label="ยอดรับจริง">{formatPrice(order.amount)}</Descriptions.Item><Descriptions.Item label="วิธีชำระ">{order.method}</Descriptions.Item>{isAdmin && order.status === 'paid' && <><Descriptions.Item label="ส่วนแบ่งผู้สอน">{formatPrice(order.instructorShareAmount || 0)} ({order.instructorSharePercent ?? 0}%)</Descriptions.Item><Descriptions.Item label="ส่วนแบ่งแพลตฟอร์ม">{formatPrice(order.platformShareAmount || 0)}</Descriptions.Item></>}<Descriptions.Item label="สถานะ"><StatusTag status={order.status}/></Descriptions.Item><Descriptions.Item label="วันที่">{new Date(order.createdAt).toLocaleString('th-TH')}</Descriptions.Item></Descriptions><Text type="secondary">เอกสารนี้เป็นใบเสร็จตัวอย่างสำหรับทบทวนหน้าจอ ไม่มีผลทางบัญชี</Text></>;
}
