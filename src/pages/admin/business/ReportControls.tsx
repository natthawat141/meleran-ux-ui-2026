import React from 'react';
import { Alert, Input, Select, Space, Tag } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { REPORT_TODAY, rangeError, shiftDate } from '../../../api/businessAnalytics';
import type { ReportCourse, ReportRange } from '../../../api/businessAnalytics';

export function useReportRange(courses: ReportCourse[]) {
  const [params, setParams] = useSearchParams();
  const range: ReportRange = { start: params.get('start') ?? shiftDate(REPORT_TODAY, -29), end: params.get('end') ?? REPORT_TODAY, courseId: params.get('course') ?? 'all' };
  const set = (values: Record<string, string>) => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    return next;
  });
  const unknownCourse = range.courseId !== 'all' && !courses.some(course => course.id === range.courseId);
  return { range, set, error: rangeError(range) || (unknownCourse ? 'ไม่พบคอร์สที่เลือก กรุณาเลือกคอร์สใหม่' : '') };
}
export function ReportControls({ courses, range, set, error }: {
  courses: ReportCourse[]; range: ReportRange; set: (values: Record<string, string>) => void; error: string;
}) {
  const preset = [1, 7, 30, 90].find(days => range.end === REPORT_TODAY && range.start === shiftDate(REPORT_TODAY, 1 - days));
  return <>
    <div className="report-disclosure"><Tag>ข้อมูลจำลอง</Tag><span>ตัวอย่างถึง 1 ต.ค. 2569 · Asia/Bangkok · ไม่ใช่ข้อมูลธุรกิจจริง</span></div>
    <div className="report-controls">
      <label>ช่วงเวลา<Select aria-label="ช่วงเวลารายงาน" value={preset ? String(preset) : 'custom'} onChange={value => { if (value !== 'custom') set({ start: shiftDate(REPORT_TODAY, 1 - Number(value)), end: REPORT_TODAY }); }} options={[{ value: 'custom', label: 'เลือกช่วงวันที่' }, ...[1, 7, 30, 90].map(value => ({ value: String(value), label: `${value} วันถึงวันที่ตัวอย่าง` }))]} /></label>
      <label>ตั้งแต่<Input aria-label="วันเริ่มต้น" type="date" value={range.start} onChange={event => set({ start: event.target.value })} /></label>
      <label>ถึง<Input aria-label="วันสิ้นสุด" type="date" value={range.end} onChange={event => set({ end: event.target.value })} /></label>
      <label className="report-course-select">คอร์ส<Select aria-label="คอร์สในรายงาน" value={range.courseId} onChange={course => set({ course })} options={[{ value: 'all', label: 'ทุกคอร์ส' }, ...courses.map(course => ({ value: course.id, label: course.title }))]} /></label>
    </div>
    {error && <Alert type="error" showIcon title={error} />}
  </>;
}
export function ReportMetrics({ items }: { items: { label: string; value: string | number; detail: string }[] }) {
  return <Space className="report-metrics" wrap>{items.map(item => <div className="report-metric" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div>)}</Space>;
}
