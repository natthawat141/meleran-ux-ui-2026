import React, { useMemo, useState } from 'react';
import { Alert, Button, Descriptions, Drawer, Input, Select, Table } from 'antd';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common';
import { getBusinessReport, money, REPORT_ZONE } from '../../api/businessAnalytics';
import type { LedgerRow, ReportCourse } from '../../api/businessAnalytics';
import { createBusinessDemo } from '../../mocks/businessAnalytics';
import { downloadCsv } from '../../lib/reportCsv';
import { ReportControls, ReportMetrics, useReportRange } from './business/ReportControls';
import { ReportChart } from './business/ReportChart';
import './business/report.css';

const labels = { payment: 'ชำระสำเร็จ', refund: 'คืนเงินสำเร็จ', fee: 'ค่าธรรมเนียม' };
const metrics = [{ value: 'collected', label: 'ยอดชำระ' }, { value: 'refunded', label: 'ยอดคืนเงิน' }, { value: 'fees', label: 'ค่าธรรมเนียม' }, { value: 'net', label: 'ยอดหลังหัก' }] as const;
const timestamp = (utc: string) => new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: REPORT_ZONE }).format(new Date(utc));
export function FinanceReportPage({ courses }: { courses: ReportCourse[] }) {
  const controls = useReportRange(courses);
  const source = useMemo(() => createBusinessDemo(courses), [courses]);
  const report = controls.error ? null : getBusinessReport(source, courses, controls.range);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [selected, setSelected] = useState<LedgerRow | null>(null);
  const metricKey = new URLSearchParams(location.search).get('metric');
  const metric = metrics.find(item => item.value === metricKey) ?? metrics[0];
  const courseTitle = (id: string) => courses.find(course => course.id === id)?.title ?? id;
  const rows = (report?.ledger ?? []).filter(row => (kind === 'all' || row.kind === kind) && `${row.id} ${row.orderId} ${courseTitle(row.courseId)}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedPayment = selected ? source.payments.find(payment => payment.id === selected.paymentId) : null;
  const exportLedger = () => downloadCsv(`DEMO-finance-${controls.range.start}-${controls.range.end}.csv`, [
    ['classification', 'timezone', 'period_start', 'period_end', 'course_filter', 'transaction_id', 'type', 'occurred_at_utc', 'order_id', 'course_id', 'currency', 'amount_minor'],
    ...rows.map(row => ['synthetic', REPORT_ZONE, controls.range.start, controls.range.end, controls.range.courseId, row.id, row.kind, row.occurredAt, row.orderId, row.courseId, 'THB', row.amountMinor]),
  ]);
  return <div className="business-report-page">
    <PageTitle eyebrow="ผู้ดูแลระบบ" title="รายงานการเงิน" subtitle="ยอดชำระ คืนเงิน และค่าธรรมเนียมตามวันที่เกิดรายการ" actions={<Button disabled={!report} onClick={exportLedger}>ส่งออก CSV รายการที่กรอง</Button>} />
    <ReportControls courses={courses} {...controls} />
    <Alert className="report-finance-notice" type="info" showIcon title="รายงานธุรกรรมตัวอย่าง" description="ยอดหลังหักยังไม่ใช่กำไร รายได้ทางบัญชี หรือยอดโอนเข้าธนาคาร ยังไม่รวมค่าใช้จ่าย ภาษี และการกระทบยอดกับผู้ให้บริการชำระเงิน" />
    {report && <>
      {!report.complete && <Alert type="info" title={`ข้อมูลไม่ครบช่วงที่เลือก ครอบคลุมเฉพาะ ${source.coverageStart} ถึง ${source.coverageEnd}`} />}
      <ReportMetrics items={[
        { label: 'ชำระสำเร็จ', value: money(report.collected), detail: `${report.purchases} รายการ · ตามวันที่ชำระสำเร็จ` },
        { label: 'คืนเงินสำเร็จ', value: money(report.refunded), detail: `${report.crossPeriodRefunds} รายการคืนจากการชำระนอกช่วงนี้` },
        { label: 'ค่าธรรมเนียม', value: money(report.fees), detail: 'จำนวนตัวอย่างต่อรายการ · ไม่ใช่อัตราจริงของผู้ให้บริการ' },
        { label: 'ยอดหลังหัก', value: money(report.net), detail: 'ชำระสำเร็จ − คืนเงิน − ค่าธรรมเนียม' },
      ]} />
      <section className="report-section"><div className="report-section-heading"><div><h2>ยอดรายวัน</h2><p>สกุลเงิน THB · รายการรอชำระและล้มเหลวไม่ถูกนับเป็นเงินรับ</p></div><Select aria-label="ตัวชี้วัดการเงิน" value={metric.value} onChange={value => controls.set({ metric: value })} options={metrics.map(item => ({ value: item.value, label: item.label }))} /></div>
        <ReportChart title={metric.label} unit="บาท" points={report.daily.map(row => ({ date: row.date, value: row.covered ? row[metric.value] / 100 : null }))} />
      </section>
      <section className="report-section"><h2>รายการที่ประกอบเป็นยอดรายงาน</h2><p>ตัวกรองด้านล่างใช้เฉพาะตารางและ CSV · ตัวเลขสรุปด้านบนยังใช้ช่วงวันที่และคอร์ส</p>
        <div className="report-ledger-controls"><Input.Search aria-label="ค้นหารายการการเงิน" placeholder="ค้นหาเลขรายการ คำสั่งซื้อ หรือคอร์ส" value={query} onChange={event => setQuery(event.target.value)} allowClear /><Select aria-label="ประเภทรายการการเงิน" value={kind} onChange={setKind} options={[{ value: 'all', label: 'ทุกรายการ' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} /><span>{rows.length} รายการ</span></div>
        <Table<LedgerRow> rowKey="id" scroll={{ x: 850 }} dataSource={rows} pagination={{ pageSize: 10, showSizeChanger: false }} columns={[
          { title: 'วันที่เกิดรายการ', dataIndex: 'occurredAt', render: timestamp },
          { title: 'รายการ / คำสั่งซื้อ', dataIndex: 'orderId', render: (value: string, row) => <div><strong>{value}</strong><small className="report-row-secondary">{labels[row.kind]}</small></div> },
          { title: 'คอร์ส', dataIndex: 'courseId', render: courseTitle },
          { title: 'จำนวนเงิน', dataIndex: 'amountMinor', align: 'right', render: money },
          { title: '', key: 'detail', render: (_, row) => <Button type="link" onClick={() => setSelected(row)}>ดูรายการ</Button> },
        ]} />
        <div className="report-ledger-total">รวมรายการที่แสดงตามตัวกรอง <strong>{money(rows.reduce((total, row) => total + row.amountMinor, 0))}</strong></div>
      </section>
      <p className="report-footnote">รายการทั้งหมดเป็นข้อมูลสมมติสำหรับตรวจ UI และสูตร · <Link to="/admin/business-analytics">กลับภาพรวมธุรกิจ</Link> · <Link to="/admin/orders">ดูคำสั่งซื้อในต้นแบบ</Link></p>
    </>}
    <Drawer title="รายละเอียดธุรกรรมตัวอย่าง" open={Boolean(selected)} onClose={() => setSelected(null)} size="large">
      {selected && selectedPayment && <>
        <Descriptions column={1} bordered items={[
          { key: 'source', label: 'แหล่งข้อมูล', children: 'ข้อมูลสมมติ ไม่ใช่คำสั่งซื้อจริงในระบบ' },
          { key: 'id', label: 'เลขรายการ', children: selected.id },
          { key: 'order', label: 'คำสั่งซื้อ', children: selected.orderId },
          { key: 'course', label: 'คอร์ส', children: courseTitle(selected.courseId) },
          { key: 'type', label: 'ประเภท', children: labels[selected.kind] },
          { key: 'at', label: 'เวลาไทย', children: timestamp(selected.occurredAt) },
          { key: 'amount', label: 'จำนวนเงิน', children: money(selected.amountMinor) },
          { key: 'original', label: 'ชำระต้นทาง', children: `${timestamp(selectedPayment.paidAt)} · ${money(selectedPayment.amountMinor)}` },
        ]} />
        <h3>การคืนเงินของรายการนี้</h3><p>แสดงเฉพาะการคืนที่เกิดถึงวันสิ้นสุดของรายงาน</p>
        {source.refunds.filter(refund => refund.paymentId === selectedPayment.id && refund.refundedAt < `${controls.range.end}T17:00:00.000Z`).map(refund => <p key={refund.id}>{timestamp(refund.refundedAt)} · {money(refund.amountMinor)}</p>)}
      </>}
    </Drawer>
  </div>;
}
