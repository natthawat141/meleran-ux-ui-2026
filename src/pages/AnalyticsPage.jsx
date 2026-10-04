import React, { useMemo } from 'react';
import { Alert, Card, Col, Empty, Progress, Row, Table, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { buildAnalytics } from '../api/analytics.js';
import { PageTitle } from '../components/common.jsx';
import { useLms } from '../store.jsx';
import './assignments-analytics.css';

const { Text } = Typography;

export function AnalyticsPage() {
  const { data, currentUser } = useLms();
  const analytics = useMemo(() => buildAnalytics(data, currentUser), [data, currentUser]);
  const admin = currentUser.role === 'admin';
  const courseColumns = [
    { title: 'คอร์ส', dataIndex: 'title', render: (title, row) => <div><strong>{title}</strong>{admin && <Text type="secondary" className="assignment-block">ผู้สอน {row.instructorName}</Text>}</div> },
    { title: 'ผู้เรียน', dataIndex: 'learnerCount', align: 'right' },
    { title: 'ความคืบหน้าเฉลี่ย', dataIndex: 'averageProgress', render: (value) => value === null ? <Text type="secondary">ยังไม่มีข้อมูล</Text> : <div className="analytics-progress"><Progress percent={value} size="small"/><span>{value}%</span></div> },
    { title: 'แบบฝึกหัด', render: (_, row) => `${row.submittedCount} ส่ง · ${row.attemptCount} เริ่ม` },
    { title: 'ผ่าน', dataIndex: 'passRate', render: (value) => value === null ? 'ยังไม่มีผลตรวจ' : `${value}%` },
    { title: 'รอตรวจ', dataIndex: 'pendingReviewCount', render: (value) => value ? <Tag color="gold">{value} รายการ</Tag> : '0' },
  ];
  const trendColumns = [
    { title: 'เดือน', dataIndex: 'month' },
    { title: 'ลงทะเบียนใหม่', dataIndex: 'enrollments', align: 'right' },
    { title: 'ส่งแบบฝึกหัด', dataIndex: 'submissions', align: 'right' },
  ];
  const completionPercent = analytics.totals.enrollmentCount ? Math.round(analytics.totals.completedEnrollmentCount / analytics.totals.enrollmentCount * 100) : null;
  return <div className="analytics-page">
    <PageTitle eyebrow={admin ? 'ผู้ดูแลระบบ' : 'พื้นที่ผู้สอน'} title="Analytics" subtitle={admin ? 'ภาพรวมจากคอร์สและกิจกรรมที่บันทึกในต้นแบบ' : 'ดูความคืบหน้าและผลแบบฝึกหัดของคอร์สที่คุณดูแล'} actions={<Link to={admin ? '/admin/assignments' : '/teach/assignments'}>{admin ? 'จัดการงานมอบหมาย' : 'ไปที่งานมอบหมาย'}</Link>}/>
    <Alert showIcon type="info" message="ข้อมูลชุดนี้เป็นตัวอย่างจากสถานะที่บันทึกไว้" description="ยังไม่มี event tracking สำหรับเวลาเรียนหรือการดูวิดีโอ จึงไม่แสดงตัวเลขคาดเดา และยอดซื้อเป็นข้อมูลจำลองเท่านั้น"/>
    <Row gutter={[16, 16]} className="analytics-metrics">
      <Col xs={12} lg={6}><Card className="analytics-metric"><Text type="secondary">ผู้เรียนที่ลงทะเบียน</Text><strong>{analytics.totals.learnerCount}</strong><small>{analytics.totals.enrollmentCount} การลงทะเบียน</small></Card></Col>
      <Col xs={12} lg={6}><Card className="analytics-metric"><Text type="secondary">เรียนครบทุกเนื้อหา</Text><strong>{completionPercent === null ? '—' : `${completionPercent}%`}</strong><small>{analytics.totals.completedEnrollmentCount} จาก {analytics.totals.enrollmentCount} คน</small></Card></Col>
      <Col xs={12} lg={6}><Card className="analytics-metric"><Text type="secondary">แบบฝึกหัดที่ส่ง</Text><strong>{analytics.totals.submittedCount}</strong><small>{analytics.totals.pendingReviewCount} รายการรอตรวจ</small></Card></Col>
      <Col xs={12} lg={6}><Card className="analytics-metric"><Text type="secondary">อัตราผ่านที่มีผลตรวจ</Text><strong>{analytics.totals.passRate === null ? '—' : `${analytics.totals.passRate}%`}</strong><small>ไม่นับรายการที่ยังรอตรวจ</small></Card></Col>
    </Row>
    {!admin && analytics.totals.pendingReviewCount > 0 && <Alert type="warning" showIcon message={<span>มีข้อเขียนรอตรวจ <Link to="/teach/quizzes">เปิดคิวตรวจ</Link></span>}/>}
    <section className="analytics-section"><div className="analytics-section-heading"><div><h2>ผลรายคอร์ส</h2><Text type="secondary">ตัวเลขคำนวณจาก enrollment, progress และ attempt ในขอบเขตสิทธิ์ของคุณ</Text></div></div>{analytics.courseRows.length ? <Table rowKey="id" columns={courseColumns} dataSource={analytics.courseRows} pagination={{ pageSize: 8 }} scroll={{ x: 820 }} locale={{ emptyText: 'ยังไม่มีข้อมูลคอร์ส' }}/> : <Empty description="ยังไม่มีคอร์สในขอบเขตนี้"/>}</section>
    <section className="analytics-section"><div className="analytics-section-heading"><div><h2>แนวโน้ม 6 เดือน</h2><Text type="secondary">นับตามวันที่ลงทะเบียนและวันที่ส่งแบบฝึกหัดที่มีจริง</Text></div></div><Table rowKey="key" columns={trendColumns} dataSource={analytics.trend} pagination={false} size="small"/></section>
    <section className="analytics-finance-note"><div><strong>คำสั่งซื้อจำลองที่สำเร็จ</strong><Text type="secondary">{analytics.totals.simulatedPaidOrderCount} รายการ · ฿{analytics.totals.simulatedRevenue.toLocaleString('th-TH')} (ไม่ใช่ยอดรับเงินจริง)</Text></div><Tag>Prototype only</Tag></section>
  </div>;
}
