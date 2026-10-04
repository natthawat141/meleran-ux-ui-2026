import React, { useState } from 'react';
import { Alert, Button, Descriptions, Empty, Form, Radio, Result, Space, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, CreditCardOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { PageTitle, StatusTag } from '../../components/common.jsx';
import { formatPrice, instructorFor } from '../../data.js';

const { Title, Text, Paragraph } = Typography;

export function CheckoutPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { data, currentUser, simulatePayment } = useLms();
  const [outcome, setOutcome] = useState('paid');
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) return <Empty description="ไม่พบคอร์สนี้"/>;
  const teacher = instructorFor(data, course);
  const order = () => { const orderId = simulatePayment(courseId, outcome); navigate(`/checkout/${orderId}/result`); };
  return <div className="checkout-page"><Link to={`/courses/${course.slug}`}><ArrowLeftOutlined/> กลับหน้าคอร์ส</Link><PageTitle eyebrow="สถานะการชำระเงินจำลอง" title="ตรวจสอบรายการสั่งซื้อ" subtitle="ผู้ให้บริการชำระเงินยังไม่ได้เลือก หน้านี้จำลองสถานะเพื่อทบทวน UX เท่านั้น"/><div className="checkout-grid"><section className="checkout-main"><Title level={4}>ทดลองสถานะรายการ</Title><Radio.Group value={outcome} onChange={(event) => setOutcome(event.target.value)} className="payment-outcomes"><Radio value="paid"><span><strong>จำลองว่าสำเร็จ</strong><small>บันทึก order ตัวอย่างและเพิ่มคอร์สในรายการเรียน</small></span></Radio><Radio value="failed"><span><strong>จำลองว่าไม่สำเร็จ</strong><small>บันทึก order ตัวอย่างที่ไม่สำเร็จ</small></span></Radio></Radio.Group><Alert showIcon type="info" message="ช่องทางชำระเงินจริงยังไม่พร้อม" description="ไม่มีการเรียก Payment Gateway และไม่ต้องกรอกข้อมูลบัตรหรือบัญชีธนาคาร"/></section><aside className="checkout-summary"><Title level={4}>สรุปคำสั่งซื้อ</Title><div className="checkout-course"><img src={course.cover} alt=""/><div><Text strong>{course.title}</Text><Text type="secondary">ผู้สอน {teacher?.name}</Text></div></div><Descriptions column={1} size="small"><Descriptions.Item label="ราคา">{formatPrice(course.price)}</Descriptions.Item><Descriptions.Item label="ยอดรวม"><strong>{formatPrice(course.price)}</strong></Descriptions.Item></Descriptions><Button block size="large" type="primary" icon={<CreditCardOutlined/>} onClick={order}>บันทึกผลจำลอง</Button><Text className="secure-note"><SafetyCertificateOutlined/> ข้อมูลนี้ใช้ทดสอบต้นแบบ ไม่ใช่การยืนยันรับเงินจริง</Text></aside></div></div>;
}

export function CheckoutResultPage() {
  const { orderId } = useParams();
  const { data } = useLms();
  const order = data.orders.find((item) => item.id === orderId);
  const course = data.courses.find((item) => item.id === order?.courseId);
  if (!order) return <Empty description="ไม่พบรายการนี้"/>;
  return <div className="checkout-result"><Result status={order.status === 'paid' ? 'success' : 'error'} title={order.status === 'paid' ? 'ผลจำลอง: สำเร็จ' : 'ผลจำลอง: ไม่สำเร็จ'} subTitle={order.status === 'paid' ? `ต้นแบบเปิดสิทธิ์เรียน ${course?.title} เพื่อทดสอบ flow เท่านั้น ไม่มีธุรกรรมเงินจริง` : 'รายการจำลองนี้ยังไม่เปิดสิทธิ์เข้าเรียน ผู้ให้บริการชำระเงินจริงยังไม่ได้เลือก'} extra={<Space wrap>{order.status === 'paid' && <Link to={`/learn/courses/${course?.id}`}><Button type="primary">เริ่มเรียนในต้นแบบ</Button></Link>}<Link to={`/checkout/${course?.id}`}><Button>{order.status === 'paid' ? 'กลับไปดูคอร์ส' : 'กลับไปดูรายการ'}</Button></Link><Link to="/account/orders"><Button>ดูรายการจำลอง</Button></Link></Space>}/></div>;
}

export function OrdersPage() {
  const { data, currentUser } = useLms();
  const orders = data.orders.filter((order) => currentUser.role === 'admin' || order.userId === currentUser.id);
  const columns = [
    { title: 'คอร์ส', render: (_, order) => data.courses.find((course) => course.id === order.courseId)?.title ?? 'คอร์สที่ถูกลบ' },
    { title: 'ยอดรวม', dataIndex: 'amount', render: (amount) => formatPrice(amount) },
    { title: 'สถานะ', dataIndex: 'status', render: (status) => <StatusTag status={status}/> },
    { title: 'วันที่', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleDateString('th-TH') },
    { title: '', render: (_, order) => <Link to={`/account/orders/${order.id}`}><Button>รายละเอียด</Button></Link> },
  ];
  return <><PageTitle eyebrow="บัญชี" title="รายการสั่งซื้อจำลอง" subtitle="สถานะในรายการนี้ใช้ทดลองหน้าจอเท่านั้น ยังไม่มีผู้ให้บริการชำระเงินจริง"/><Table rowKey="id" dataSource={orders} columns={columns} pagination={{ pageSize: 8 }} locale={{ emptyText: 'ยังไม่มีรายการสั่งซื้อจำลอง' }}/></>;
}

export function OrderDetailPage() {
  const { orderId } = useParams();
  const { data } = useLms();
  const order = data.orders.find((item) => item.id === orderId);
  if (!order) return <Empty description="ไม่พบรายการนี้"/>;
  const course = data.courses.find((item) => item.id === order.courseId);
  return <><PageTitle eyebrow="รายการสั่งซื้อ" title="รายละเอียดและใบเสร็จจำลอง" actions={<Space><Link to="/account/orders"><Button>กลับรายการซื้อ</Button></Link><Button onClick={() => window.print()}>พิมพ์ใบเสร็จ</Button></Space>}/><Descriptions bordered column={1} className="order-details"><Descriptions.Item label="เลขรายการ">{order.id}</Descriptions.Item><Descriptions.Item label="คอร์ส">{course?.title ?? 'คอร์สที่ถูกลบ'}</Descriptions.Item><Descriptions.Item label="ยอดชำระ">{formatPrice(order.amount)}</Descriptions.Item><Descriptions.Item label="วิธีชำระ">{order.method}</Descriptions.Item><Descriptions.Item label="สถานะ"><StatusTag status={order.status}/></Descriptions.Item><Descriptions.Item label="วันที่">{new Date(order.createdAt).toLocaleString('th-TH')}</Descriptions.Item></Descriptions><Text type="secondary">เอกสารนี้เป็นใบเสร็จตัวอย่างสำหรับทบทวนหน้าจอ ไม่มีผลทางบัญชี</Text></>;
}
