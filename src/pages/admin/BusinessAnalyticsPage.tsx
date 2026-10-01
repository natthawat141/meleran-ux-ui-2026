import { useMemo } from 'react';
import { Alert, Button, Select, Table } from 'antd';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common';
import { getBusinessReport, money } from '../../api/businessAnalytics';
import type { DailyReport, ReportCourse } from '../../api/businessAnalytics';
import { createBusinessDemo } from '../../mocks/businessAnalytics';
import { downloadCsv } from '../../lib/reportCsv';
import { ReportControls, ReportMetrics, useReportRange } from './business/ReportControls';
import { ReportChart } from './business/ReportChart';
import './business/report.css';

const metrics = [
  { value: 'active', label: 'ผู้เรียนที่เข้าเรียน', unit: 'คน' },
  { value: 'visitors', label: 'ผู้เข้าชมคอร์ส', unit: 'คน' },
  { value: 'sessions', label: 'การเข้าชมคอร์ส', unit: 'เซสชัน' },
  { value: 'enrollments', label: 'การลงทะเบียนใหม่', unit: 'ครั้ง' },
  { value: 'purchases', label: 'การซื้อสำเร็จ', unit: 'รายการ' },
] as const;
export function BusinessAnalyticsPage({ courses }: { courses: ReportCourse[] }) {
  const controls = useReportRange(courses);
  const source = useMemo(() => createBusinessDemo(courses), [courses]);
  const report = controls.error ? null : getBusinessReport(source, courses, controls.range);
  const metricKey = new URLSearchParams(location.search).get('metric');
  const metric = metrics.find(item => item.value === metricKey) ?? metrics[0];
  const maxHeat = Math.max(1, ...(report?.heatmap.flat() ?? []));
  const exportDaily = () => {
    if (!report) return;
    downloadCsv(`DEMO-business-${controls.range.start}-${controls.range.end}.csv`, [
      ['classification', 'timezone', 'course_filter', 'date', 'covered', 'visitors', 'sessions', 'active_learners', 'new_enrollments', 'purchases'],
      ...report.daily.map(row => ['synthetic', 'Asia/Bangkok', controls.range.courseId, row.date, String(row.covered), ...(['visitors', 'sessions', 'active', 'enrollments', 'purchases'] as const).map(key => row.covered ? row[key] : '')]),
    ]);
  };
  return <div className="business-report-page">
    <PageTitle eyebrow="ผู้ดูแลระบบ" title="ภาพรวมธุรกิจ" subtitle="ดูการเข้าชม การเรียน และการลงทะเบียนตามช่วงเวลา" actions={<Button onClick={exportDaily} disabled={!report}>ส่งออก CSV รายวัน</Button>} />
    <ReportControls courses={courses} {...controls} />
    {report && <>
      {!report.complete && <Alert type="info" showIcon title={`ข้อมูลครอบคลุม ${source.coverageStart} ถึง ${source.coverageEnd} เท่านั้น ตัวเลขสรุปเป็นช่วงที่มีข้อมูล`} />}
      <ReportMetrics items={[
        { label: 'ผู้เรียนที่เข้าเรียน', value: report.active, detail: 'คนไม่ซ้ำในช่วงที่เลือก · ไม่ใช่ผลรวมรายวัน' },
        { label: 'ผู้เข้าชมคอร์ส', value: report.visitors, detail: 'ผู้เข้าชมไม่ซ้ำ · ยังรวมผู้ที่ไม่ได้ลงเรียน' },
        { label: 'ลงทะเบียนใหม่', value: report.enrollments, detail: 'รวมคอร์สฟรีและการซื้อที่ลงทะเบียนสำเร็จ' },
        { label: 'ยอดชำระสำเร็จ', value: money(report.collected), detail: `${report.purchases} รายการ · ก่อนหักคืนเงินและค่าธรรมเนียม` },
      ]} />
      <section className="report-section"><div className="report-section-heading"><div><h2>กิจกรรมรายวัน</h2><p>เลือกตัวชี้วัดเพื่ออ่านแนวโน้มด้วยหน่วยเดียวกัน</p></div><Select aria-label="ตัวชี้วัดกราฟ" value={metric.value} options={metrics.map(item => ({ value: item.value, label: item.label }))} onChange={value => controls.set({ metric: value })} /></div>
        <ReportChart title={metric.label} unit={metric.unit} points={report.daily.map((row: DailyReport) => ({ date: row.date, value: row.covered ? row[metric.value] : null }))} />
      </section>
      <section className="report-section"><h2>ผู้เรียนเข้ามาช่วงไหน</h2><p>จำนวนผู้เรียนไม่ซ้ำในแต่ละวันของสัปดาห์และชั่วโมง · ผู้เรียนหนึ่งคนอาจอยู่หลายช่อง จึงนำช่องมาบวกเป็นยอดรวมไม่ได้</p>
        <div className="report-heatmap-scroll"><div className="report-heatmap" role="group" aria-label="ช่วงเวลาเข้าเรียนตามวันและชั่วโมง">
          <span /><div className="report-hours">{Array.from({ length: 24 }, (_, hour) => <span key={hour}>{hour}</span>)}</div>
          {report.heatmap.map((row, day) => <div className="report-heatmap-row" key={day}><span>{['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'][day]}</span><div>{row.map((count, hour) => <button type="button" key={hour} className={`report-heat-cell heat-${count === 0 ? 0 : Math.min(4, Math.ceil(count / maxHeat * 4))}`} aria-label={`${['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'][day]} ${hour}:00–${hour}:59 จำนวน ${count} คน`} title={`${hour}:00–${hour}:59 · ${count} คน`} />)}</div></div>)}
        </div></div><div className="report-heat-legend">น้อย <span className="heat-0" /><span className="heat-1" /><span className="heat-2" /><span className="heat-3" /><span className="heat-4" /> มาก · เวลาไทย</div>
      </section>
      <section className="report-section"><h2>เส้นทางจากดูคอร์สถึงซื้อสำเร็จ</h2><p>นับเซสชันต่อคอร์สที่เกิดตามลำดับภายในช่วงเดียวกัน · คอร์สฟรีไม่ต้องผ่านขั้นชำระเงิน</p><div className="report-funnel">{report.funnel.map((count, index) => <div key={index}><span>{['ดูคอร์ส', 'เริ่มชำระเงิน', 'ซื้อสำเร็จ'][index]}</span><strong>{count}</strong><div className="report-funnel-track"><span style={{ width: `${report.funnel[0] ? count / report.funnel[0] * 100 : 0}%` }} /></div><small>{report.funnel[0] ? `${(count / report.funnel[0] * 100).toFixed(1)}% ของเซสชันดูคอร์ส` : 'ไม่มีฐานคำนวณ'}</small></div>)}</div></section>
      <section className="report-section"><h2>ผลรายคอร์ส</h2><p>ยอดผู้เรียนไม่ซ้ำรายคอร์สอาจซ้ำกันข้ามคอร์สได้</p><Table rowKey="id" scroll={{ x: 800 }} pagination={false} dataSource={report.courseRows} columns={[
        { title: 'คอร์ส', dataIndex: 'title', render: (title: string, row) => <Button type="link" onClick={() => controls.set({ course: row.id })}>{title}</Button> },
        { title: 'ผู้เข้าชม', dataIndex: 'visitors', align: 'right' }, { title: 'เข้าเรียน', dataIndex: 'active', align: 'right' },
        { title: 'ลงทะเบียน', dataIndex: 'enrollments', align: 'right' }, { title: 'ซื้อสำเร็จ', dataIndex: 'purchases', align: 'right' },
        { title: 'ยอดชำระ', dataIndex: 'collected', align: 'right', render: money },
      ]} /></section>
      <p className="report-footnote">ข้อมูลตัวอย่างใช้ตรวจ UX และสูตร ยังไม่มีระบบเก็บทราฟฟิกจริง · <Link to="/admin/finance">เปิดรายงานการเงิน</Link></p>
    </>}
  </div>;
}
