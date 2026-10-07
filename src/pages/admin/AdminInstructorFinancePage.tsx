import { useEffect, useState } from 'react';
import { Alert, Button, Empty, InputNumber, Popconfirm, Space, Table, Typography, message, type TableColumnsType } from 'antd';
import { useLms } from '../../store';
import { PageTitle, SectionHeading } from '../../components/common';
import { instructorShareForOrder } from '../finance/finance-utils.ts';
import { orderChannelLabel } from '../../lib/access-code-utils';
import type { InstructorPayout, LmsContextType, User } from '../../types';
import '../finance/finance.css';

const { Text } = Typography;
const money = (value: number) => `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

interface RateEditorProps {
  instructor: User;
  onSave: LmsContextType['saveInstructorCommission'];
}

function RateEditor({ instructor, onSave }: RateEditorProps) {
  const [base, setBase] = useState<number | null>(Number(instructor.baseSharePercent ?? 70));
  const [referral, setReferral] = useState<number | null>(Number(instructor.referralSharePercent ?? 85));
  useEffect(() => {
    setBase(Number(instructor.baseSharePercent ?? 70));
    setReferral(Number(instructor.referralSharePercent ?? 85));
  }, [instructor.baseSharePercent, instructor.referralSharePercent]);
  const valid = Number.isFinite(Number(base)) && Number.isFinite(Number(referral)) && Number(base) >= 0 && Number(referral) <= 100 && Number(referral) > Number(base);
  return <div className="finance-rate-editor">
    <label><span>ปกติ</span><InputNumber aria-label={`ส่วนแบ่งปกติของ ${instructor.name}`} min={0} max={100} step={1} value={base} onChange={setBase}/><span>%</span></label>
    <label><span>แนะนำ</span><InputNumber aria-label={`ส่วนแบ่งจากลิงก์แนะนำของ ${instructor.name}`} min={0} max={100} step={1} value={referral} onChange={setReferral}/><span>%</span></label>
    <Button size="small" type="primary" disabled={!valid} onClick={() => {
      const result = onSave(instructor.id, Number(base), Number(referral));
      result.ok ? message.success(`บันทึกสัดส่วนของ ${instructor.name} แล้ว`) : message.error(result.message);
    }}>บันทึก %</Button>
    {!valid && <Text className="finance-rate-error" type="danger">% แนะนำต้องสูงกว่า % ปกติ</Text>}
  </div>;
}

export function AdminInstructorFinancePage() {
  const { data, saveInstructorCommission, markInstructorPayout } = useLms();
  const instructors = data.users.filter((user) => user.role === 'instructor');
  const rows = instructors.map((instructor) => {
    const courseIds = new Set(data.courses.filter((course) => course.instructorId === instructor.id).map((course) => course.id));
    const orders = data.orders.filter((order) => order.status === 'paid' && courseIds.has(order.courseId));
    const enrollments = data.enrollments.filter((entry) => courseIds.has(entry.courseId));
    const pendingOrders = orders.filter((order) => Number(order.amount || 0) > 0 && order.payoutStatus !== 'transferred');
    const totalEarned = orders.reduce((sum, order) => sum + instructorShareForOrder(data, order), 0);
    const pending = pendingOrders.reduce((sum, order) => sum + instructorShareForOrder(data, order), 0);
    const transferred = totalEarned - pending;
    return {
      ...instructor,
      learnerCount: new Set(enrollments.map((entry) => entry.userId)).size,
      gross: orders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
      cashGross: orders.filter((order) => orderChannelLabel(order) === 'ขายผ่านรหัสแลกคอร์ส').reduce((sum, order) => sum + Number(order.amount || 0), 0),
      totalEarned,
      pending,
      pendingOrderCount: pendingOrders.length,
      transferred,
    };
  });
  const gross = rows.reduce((sum, row) => sum + row.gross, 0);
  const earned = rows.reduce((sum, row) => sum + row.totalEarned, 0);
  const pending = rows.reduce((sum, row) => sum + row.pending, 0);
  const transferred = rows.reduce((sum, row) => sum + row.transferred, 0);
  const allPaidOrders = data.orders.filter((order) => order.status === 'paid');
  const systemSales = allPaidOrders.filter((order) => orderChannelLabel(order) === 'ชำระผ่านระบบ').reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const cashSales = allPaidOrders.filter((order) => orderChannelLabel(order) === 'ขายผ่านรหัสแลกคอร์ส').reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const freeCodeCount = allPaidOrders.filter((order) => orderChannelLabel(order) === 'โค้ดเรียนฟรี').length;
  const platformRevenue = Math.max(0, gross - earned);

  type InstructorFinanceRow = (typeof rows)[number];
  const columns: TableColumnsType<InstructorFinanceRow> = [
    { title: 'ผู้สอน', render: (_, row) => <div className="finance-course-cell"><strong>{row.name}</strong><Text type="secondary">{row.email}</Text></div> },
    { title: 'ผู้เรียน', dataIndex: 'learnerCount', render: (count) => `${count.toLocaleString('th-TH')} คน` },
    { title: 'ยอดขายสำเร็จ', dataIndex: 'gross', render: money },
    { title: 'ยอดขายผ่านรหัสแลกคอร์ส', dataIndex: 'cashGross', render: money },
    { title: 'ส่วนแบ่งรวม', dataIndex: 'totalEarned', render: money },
    { title: 'รอโอน', render: (_, row) => <div className="finance-course-cell"><strong>{money(row.pending)}</strong><Text type="secondary">{row.pendingOrderCount} รายการ</Text></div> },
    { title: 'ตั้งสัดส่วนรายคน', render: (_, row) => <RateEditor instructor={row} onSave={saveInstructorCommission}/> },
    { title: 'การโอน', width: 190, fixed: 'right', render: (_, row) => <Popconfirm title={`ยืนยันยอดโอนจำลอง ${money(row.pending)} ให้ ${row.name}?`} description="การทำเครื่องหมายนี้ใช้บันทึกในต้นแบบเท่านั้น ไม่มีการโอนเงินจริง" okText="บันทึกว่าโอนแล้ว" cancelText="ยกเลิก" disabled={!row.pendingOrderCount} onConfirm={() => {
      const result = markInstructorPayout(row.id);
      result.ok ? message.success(`บันทึกยอด ${money(result.payout.amount)} ว่าโอนแล้ว`) : message.error(result.message);
    }}><Button size="small" disabled={!row.pendingOrderCount}>{row.pendingOrderCount ? 'ทำเครื่องหมายโอนแล้ว' : 'ยังไม่มียอด'}</Button></Popconfirm> },
  ];

  const payoutColumns: TableColumnsType<InstructorPayout> = [
    { title: 'ผู้สอน', render: (_, payout) => instructors.find((user) => user.id === payout.instructorId)?.name ?? 'ผู้สอน' },
    { title: 'จำนวนรายการ', dataIndex: 'orderCount', render: (count) => `${count} รายการ` },
    { title: 'ยอดโอนจำลอง', dataIndex: 'amount', render: money },
    { title: 'วันที่บันทึก', dataIndex: 'createdAt', render: (date) => new Date(date).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) },
  ];

  return <div className="finance-page">
    <PageTitle eyebrow="ผู้ดูแลระบบ · การเงินผู้สอน" title="ส่วนแบ่งและยอดโอนผู้สอน" subtitle="กำหนดอัตราแยกเป็นรายคน ตรวจยอดค้าง และเก็บประวัติการโอนจำลอง"/>
    <Alert className="finance-demo-note" type="info" showIcon message="ข้อมูลการเงินจำลอง" description="ยอดรอโอนคำนวณจากคำสั่งซื้อที่ชำระสำเร็จและสัดส่วน ณ วันที่ซื้อ ปุ่มโอนใช้บันทึกสถานะในต้นแบบ ไม่เชื่อมธนาคารหรือผู้ให้บริการชำระเงิน"/>
    <div className="finance-kpis" aria-label="สรุปยอดส่วนแบ่งผู้สอน">
      <div className="finance-kpi"><Text type="secondary">ยอดขายที่ชำระแล้ว</Text><strong>{money(gross)}</strong><Text type="secondary">ยอดรวมจากทุกคอร์ส</Text></div>
      <div className="finance-kpi"><Text type="secondary">ส่วนแบ่งผู้สอนรวม</Text><strong>{money(earned)}</strong><Text type="secondary">คำนวณจาก % รายคน</Text></div>
      <div className="finance-kpi"><Text type="secondary">ยอดที่ต้องโอน</Text><strong>{money(pending)}</strong><Text type="secondary">รายการที่ยังไม่ทำเครื่องหมายโอน</Text></div>
      <div className="finance-kpi"><Text type="secondary">บันทึกโอนแล้ว</Text><strong>{money(transferred)}</strong><Text type="secondary">ยอดในประวัติการโอนจำลอง</Text></div>
    </div>
    <div className="finance-source-breakdown" aria-label="แยกยอดขายและส่วนแบ่งตามช่องทาง"><div><Text type="secondary">ชำระผ่านระบบ</Text><strong>{money(systemSales)}</strong><Text type="secondary">ยอดรับจริงหลังส่วนลด</Text></div><div><Text type="secondary">ขายผ่านรหัสแลกคอร์ส</Text><strong>{money(cashSales)}</strong><Text type="secondary">บันทึกเป็นรายการขายและยอดรอโอน</Text></div><div><Text type="secondary">ส่วนแบ่งแพลตฟอร์ม</Text><strong>{money(platformRevenue)}</strong><Text type="secondary">หลังแบ่งส่วนผู้สอน</Text></div><div><Text type="secondary">ใช้โค้ดเรียนฟรี</Text><strong>{freeCodeCount} รายการ</strong><Text type="secondary">ไม่นับเป็นรายได้</Text></div></div>
    <section className="finance-section">
      <SectionHeading title="รายได้แยกตามผู้สอน" description="ตั้ง % ผู้สอนเป็นรายคน และกำหนด % ลิงก์แนะนำให้สูงกว่าอัตราปกติ ส่วนที่เหลือเป็นส่วนแบ่งแพลตฟอร์ม ยอดย้อนหลังยึดตามวันที่ชำระ"/>
      <Table rowKey="id" dataSource={rows} columns={columns} pagination={false} scroll={{ x: 1320 }} locale={{ emptyText: <Empty description="ยังไม่มีบัญชีผู้สอน"/> }}/>
    </section>
    <section className="finance-section">
      <SectionHeading title="ประวัติการโอนจำลอง" description="รายการที่แอดมินทำเครื่องหมายว่าโอนแล้วในต้นแบบ"/>
      <Table rowKey="id" dataSource={data.instructorPayouts ?? []} columns={payoutColumns} scroll={{ x: 640 }} pagination={{ pageSize: 6, hideOnSinglePage: true }} locale={{ emptyText: <Empty description="ยังไม่มีรายการโอน"/> }}/>
    </section>
  </div>;
}
