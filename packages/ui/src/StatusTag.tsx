import { Badge } from '@mantine/core';

export interface StatusTagProps {
  status: string;
}

export function StatusTag({ status }: StatusTagProps) {
  const values: Record<string, [string, string]> = {
    published: ['cobalt', 'เผยแพร่แล้ว'],
    draft: ['gray', 'ฉบับร่าง'],
    pending_review: ['orange', 'รอตรวจคอร์ส'],
    pending: ['gray', 'รอตรวจ'],
    paid: ['cobalt', 'ชำระแล้ว'],
    failed: ['red', 'ไม่สำเร็จ'],
    approved: ['cobalt', 'อนุมัติแล้ว'],
    rejected: ['red', 'ส่งกลับ'],
    graded: ['cobalt', 'ตรวจแล้ว'],
  };
  const [color, label] = values[status] ?? ['gray', status || '—'];
  return <Badge color={color} variant="light" className="status-tag">{label}</Badge>;
}
