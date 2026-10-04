import React, { useMemo, useState } from 'react';
import { Alert, Button, Empty, Input, Space, Table, Tag, Typography, message } from 'antd';
import { CopyOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { useLms } from '../../store.jsx';
import { PageTitle, SectionHeading } from '../../components/common.jsx';
import { formatPrice } from '../../data.js';
import { instructorShareForOrder, isReferralOrder } from '../finance/finance-utils.js';
import '../finance/finance.css';

const { Text } = Typography;
const money = (value) => `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

export function InstructorFinancePage() {
  const { data, currentUser, createReferralLink } = useLms();
  const [copying, setCopying] = useState('');
  const courses = useMemo(() => data.courses.filter((course) => course.instructorId === currentUser?.id), [data.courses, currentUser?.id]);
  const courseIds = new Set(courses.map((course) => course.id));
  const orders = data.orders.filter((order) => order.status === 'paid' && courseIds.has(order.courseId));
  const enrollments = data.enrollments.filter((entry) => courseIds.has(entry.courseId));
  const learners = new Set(enrollments.map((entry) => entry.userId)).size;
  const gross = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const earned = orders.reduce((sum, order) => sum + instructorShareForOrder(data, order), 0);
  const referredOrders = orders.filter(isReferralOrder);
  const referralEarned = referredOrders.reduce((sum, order) => sum + instructorShareForOrder(data, order), 0);
  const platformShare = gross - earned;
  const links = (data.referralLinks ?? []).filter((link) => link.instructorId === currentUser?.id);
  const rate = Number(currentUser?.baseSharePercent ?? 70);
  const referralRate = Number(currentUser?.referralSharePercent ?? 85);

  const makeLink = (course) => {
    const result = createReferralLink(course.id);
    if (!result.ok) { message.error(result.message); return; }
    message.success(`สร้างลิงก์แนะนำสำหรับ “${course.title}” แล้ว`);
  };
  const urlFor = (link) => {
    const course = courses.find((item) => item.id === link.courseId);
    return course ? `${window.location.origin}/courses/${course.slug}?ref=${encodeURIComponent(link.code)}` : '';
  };
  const copyLink = async (link) => {
    const url = urlFor(link);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopying(link.id);
      window.setTimeout(() => setCopying(''), 1400);
      message.success('คัดลอกลิงก์แล้ว');
    } catch {
      message.error('คัดลอกอัตโนมัติไม่ได้ กรุณาคัดลอกลิงก์จากช่องข้อความ');
    }
  };

  const courseColumns = [
    { title: 'คอร์ส', render: (_, course) => <div className="finance-course-cell"><strong>{course.title}</strong><Text type="secondary">{course.price === 0 ? 'คอร์สฟรี' : `ราคา ${formatPrice(course.price)}`}</Text></div> },
    { title: 'ผู้เรียน', render: (_, course) => enrollments.filter((entry) => entry.courseId === course.id).length },
    { title: 'ยอดขายที่ชำระแล้ว', render: (_, course) => money(orders.filter((order) => order.courseId === course.id).reduce((sum, order) => sum + Number(order.amount || 0), 0)) },
    { title: 'ส่วนแบ่งของคุณ', render: (_, course) => money(orders.filter((order) => order.courseId === course.id).reduce((sum, order) => sum + instructorShareForOrder(data, order), 0)) },
    { title: 'ลิงก์แนะนำ', render: (_, course) => course.status === 'published' ? <Button size="small" icon={<PlusOutlined/>} onClick={() => makeLink(course)}>สร้างลิงก์</Button> : <Text type="secondary">เผยแพร่คอร์สก่อน</Text> },
  ];
  const linkColumns = [
    { title: 'คอร์ส', render: (_, link) => courses.find((course) => course.id === link.courseId)?.title ?? 'คอร์สที่ไม่พร้อมใช้งาน' },
    { title: 'ผู้เรียนจากลิงก์', render: (_, link) => enrollments.filter((entry) => entry.referralLinkId === link.id).length },
    { title: 'ยอดซื้อจากลิงก์', render: (_, link) => orders.filter((order) => order.referralLinkId === link.id).length },
    { title: 'ส่วนแบ่งจากลิงก์', render: (_, link) => money(orders.filter((order) => order.referralLinkId === link.id).reduce((sum, order) => sum + instructorShareForOrder(data, order), 0)) },
    { title: 'ลิงก์สำหรับแชร์', render: (_, link) => <Space.Compact className="finance-link-control"><Input aria-label="ลิงก์แนะนำ" readOnly value={urlFor(link)} onFocus={(event) => event.target.select()}/><Button icon={<CopyOutlined/>} aria-label="คัดลอกลิงก์" onClick={() => copyLink(link)}>{copying === link.id ? 'คัดลอกแล้ว' : 'คัดลอก'}</Button></Space.Compact> },
  ];

  return <div className="finance-page">
    <PageTitle eyebrow="ผู้สอน · รายได้" title="รายได้และผู้เรียน" subtitle="ติดตามจำนวนผู้เรียน ยอดขาย และส่วนแบ่งจากคอร์สของคุณ"/>
    <Alert className="finance-demo-note" type="info" showIcon message="ข้อมูลตัวอย่างสำหรับทดลอง" description="ยังไม่มีการโอนเงินจริง อัตราส่วนแบ่งกำหนดเป็นรายผู้สอน และลิงก์แนะนำได้รับอัตราที่สูงขึ้นตามที่แอดมินตั้งไว้"/>
    <div className="finance-kpis" aria-label="สรุปรายได้ผู้สอน">
      <div className="finance-kpi"><Text type="secondary">ผู้เรียนทั้งหมด</Text><strong>{learners.toLocaleString('th-TH')} คน</strong><Text type="secondary">นับผู้เรียนไม่ซ้ำในคอร์สของคุณ</Text></div>
      <div className="finance-kpi"><Text type="secondary">ยอดขายชำระสำเร็จ</Text><strong>{money(gross)}</strong><Text type="secondary">รวมเฉพาะรายการที่ชำระแล้ว</Text></div>
      <div className="finance-kpi"><Text type="secondary">ส่วนแบ่งของคุณ</Text><strong>{money(earned)}</strong><Text type="secondary">แพลตฟอร์มรับ {money(platformShare)}</Text></div>
      <div className="finance-kpi"><Text type="secondary">ส่วนแบ่งจากลิงก์แนะนำ</Text><strong>{money(referralEarned)}</strong><Text type="secondary">{referredOrders.length} รายการชำระ</Text></div>
    </div>
    <section className="finance-section">
      <SectionHeading title="อัตราส่วนแบ่งของคุณ" description="อัตราปัจจุบันที่แอดมินกำหนดเป็นรายบุคคล"/>
      <div className="finance-rate-summary"><div><span>คอร์สทั่วไป</span><div className="finance-rate-values"><strong>คุณ {rate}%</strong><Text type="secondary">แพลตฟอร์ม {100 - rate}%</Text></div></div><div><span>ผู้เรียนที่มาจากลิงก์แนะนำ</span><div className="finance-rate-values"><strong>คุณ {referralRate}%</strong><Text type="secondary">แพลตฟอร์ม {100 - referralRate}%</Text></div></div></div>
    </section>
    <section className="finance-section">
      <SectionHeading title="รายได้แยกตามคอร์ส" description="ผู้เรียนรวมคอร์สฟรีและคอร์สที่ชำระแล้ว ส่วนรายได้มาจากยอดซื้อสำเร็จ"/>
      <Table rowKey="id" dataSource={courses} columns={courseColumns} pagination={false} scroll={{ x: 760 }} locale={{ emptyText: <Empty description="ยังไม่มีคอร์สของคุณ"/> }}/>
    </section>
    <section className="finance-section">
      <SectionHeading title="ลิงก์แนะนำของฉัน" description="สร้างลิงก์แยกตามคอร์ส แล้วแชร์ให้นักเรียนสมัครหรือซื้อผ่านลิงก์นี้"/>
      {links.length ? <Table rowKey="id" dataSource={links} columns={linkColumns} pagination={{ pageSize: 5, hideOnSinglePage: true }} scroll={{ x: 900 }}/> : <div className="finance-empty"><LinkOutlined/><Text>ยังไม่มีลิงก์แนะนำ เลือก “สร้างลิงก์” จากคอร์สที่เผยแพร่แล้ว</Text></div>}
      <Text className="finance-footnote" type="secondary">เมื่อลงทะเบียนคอร์สฟรี ระบบจะนับผู้เรียนจากลิงก์ให้ ส่วนแบ่งจะเกิดเมื่อมีรายการซื้อที่ชำระสำเร็จเท่านั้น</Text>
    </section>
    <Tag className="finance-snapshot-tag">อัตราส่วนแบ่งของรายการเก่าบันทึกตามวันที่ชำระ</Tag>
  </div>;
}
