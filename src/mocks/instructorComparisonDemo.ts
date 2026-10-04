export interface InstructorComparisonDemoRow {
  learnerId: string;
  learnerName: string;
  preScore: number | null;
  postScore: number | null;
  diff: number | null;
  status: 'matched' | 'pending_grading' | 'missing' | 'pre_only' | 'post_only' | 'neither';
}

/** Read-only illustration only. These rows are never written to LMS data or localStorage. */
export const instructorComparisonDemoRows: InstructorComparisonDemoRow[] = [
  { learnerId: 'sample-plus', learnerName: 'ตัวอย่าง · คะแนนเพิ่ม', preScore: 50, postScore: 90, diff: 40, status: 'matched' },
  { learnerId: 'sample-minus', learnerName: 'ตัวอย่าง · คะแนนลด', preScore: 85, postScore: 65, diff: -20, status: 'matched' },
  { learnerId: 'sample-zero', learnerName: 'ตัวอย่าง · คะแนนศูนย์', preScore: 0, postScore: 0, diff: 0, status: 'matched' },
  { learnerId: 'sample-pending', learnerName: 'ตัวอย่าง · รอตรวจ', preScore: 50, postScore: null, diff: null, status: 'pending_grading' },
  { learnerId: 'sample-pre-only', learnerName: 'ตัวอย่าง · มีเฉพาะก่อนเรียน', preScore: 40, postScore: null, diff: null, status: 'pre_only' },
  { learnerId: 'sample-post-only', learnerName: 'ตัวอย่าง · มีเฉพาะหลังเรียน', preScore: null, postScore: 70, diff: null, status: 'post_only' },
  { learnerId: 'sample-neither', learnerName: 'ตัวอย่าง · ยังไม่ส่งทั้งคู่', preScore: null, postScore: null, diff: null, status: 'neither' },
  { learnerId: 'sample-missing', learnerName: 'ตัวอย่าง · คะแนนยังไม่พร้อม', preScore: null, postScore: 80, diff: null, status: 'missing' },
];
