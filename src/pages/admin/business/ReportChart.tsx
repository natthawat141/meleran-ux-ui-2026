import React, { useEffect, useId, useRef, useState } from 'react';
import { Empty } from 'antd';

export interface ChartPoint { date: string; value: number | null }
export function ReportChart({ points, title, unit }: { points: ChartPoint[]; title: string; unit: string }) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(940);
  const [focused, setFocused] = useState<ChartPoint | null>(null);
  const known = points.filter(point => point.value !== null);
  const hasData = known.length > 0;
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(280, Math.min(940, entries[0].contentRect.width))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [hasData]);
  if (!known.length) return <Empty description="ไม่มีข้อมูลครอบคลุมช่วงวันที่นี้" />;
  const low = Math.min(0, ...known.map(point => point.value!));
  const high = Math.max(1, ...known.map(point => point.value!));
  const left = 52, right = width - 28;
  const x = (index: number) => left + index * (right - left) / Math.max(1, points.length - 1);
  const y = (value: number) => 220 - (value - low) * 185 / (high - low);
  const paths: string[] = [];
  let segment = '';
  points.forEach((point, index) => {
    if (point.value === null) { if (segment) paths.push(segment); segment = ''; return; }
    segment += `${segment ? ' L' : 'M'}${x(index)} ${y(point.value)}`;
  });
  if (segment) paths.push(segment);
  return <div className="report-chart" ref={container}>
    <svg viewBox={`0 0 ${width} 270`} role="img" aria-labelledby={id}>
      <title id={id}>{title} หน่วย {unit} ใช้ตารางใต้กราฟเพื่ออ่านตัวเลขทั้งหมด</title>
      {[0, 0.5, 1].map(fraction => { const value = low + (high - low) * fraction; return <g key={fraction}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="report-gridline" /><text x={left - 8} y={y(value) + 4} textAnchor="end">{value.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</text></g>; })}
      {paths.map((path, index) => <path key={index} d={path} className="report-line" />)}
      {points.map((point, index) => point.value !== null && <circle key={point.date} cx={x(index)} cy={y(point.value)} r={4} tabIndex={0} aria-label={`${point.date}: ${point.value.toLocaleString('th-TH')} ${unit}`} onFocus={() => setFocused(point)} onBlur={() => setFocused(null)} onMouseEnter={() => setFocused(point)} onMouseLeave={() => setFocused(null)}><title>{point.date}: {point.value.toLocaleString('th-TH')} {unit}</title></circle>)}
      {[0, Math.floor((points.length - 1) / 2), points.length - 1].filter((value, index, all) => all.indexOf(value) === index).map(index => <text key={index} x={x(index)} y="250" textAnchor="middle">{points[index].date.slice(5)}</text>)}
    </svg>
    <div className="report-chart-caption" aria-live="polite">{focused ? `${focused.date} · ${focused.value?.toLocaleString('th-TH')} ${unit}` : `${title} · ${unit} · วันที่นอกขอบเขตข้อมูลไม่แสดงเป็นศูนย์`}</div>
    <details><summary>ดูข้อมูลกราฟเป็นตาราง</summary><div className="report-table-scroll"><table className="report-data-table"><thead><tr><th>วันที่ (ค.ศ.)</th><th>{title} ({unit})</th></tr></thead><tbody>{points.map(point => <tr key={point.date}><td>{point.date}</td><td>{point.value === null ? 'ไม่มีข้อมูล' : point.value.toLocaleString('th-TH')}</td></tr>)}</tbody></table></div></details>
  </div>;
}
