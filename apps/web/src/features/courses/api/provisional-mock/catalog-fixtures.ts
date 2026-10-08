// PROVISIONAL MOCK DATA — development and tests only. Not a Backend, not seed data for production, and not
// evidence that any API exists. Names, categories, levels and prices are invented examples; the real values
// (category/level vocabulary, currency, price units) still wait for Backend/product decisions.
//
// Records model what a server might store, including fields that must never be public (review notes, video
// links, quiz answers, unpublished drafts). The mock fetcher projects an explicit allow-list from them, and the
// tests search the raw HTTP bodies for the SECRET markers below to prove nothing leaks.

import type { ProvisionalMoney, ProvisionalOutlineItemType } from '../catalog-provisional-contract.ts';

export type MockCourseStatus = 'draft' | 'pending_review' | 'approved' | 'published';

export interface MockLessonRecord {
  id: string;
  type: ProvisionalOutlineItemType;
  title: string;
  /** Restricted lesson data that the public API must not return. */
  video_url?: string;
  body?: string;
  answer_key?: string;
}

export interface MockChapterRecord {
  id: string;
  title: string;
  items: MockLessonRecord[];
}

export interface MockCourseRecord {
  id: string;
  slug: string;
  status: MockCourseStatus;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_url: string | null;
  category: string;
  level: string;
  price: ProvisionalMoney | null;
  instructor: { id: string; display_name: string; avatar_url: string | null };
  published_at: string | null;
  outcomes: string[];
  chapters: MockChapterRecord[];
  /** Never public. */
  internal_review_notes: string;
}

/** Substrings that must never appear in any public response body. */
export const mockSecretMarkers: readonly string[] = ['SECRET'];

/** Property names that must never appear in any public response body. */
export const mockRestrictedKeys: readonly string[] = [
  'video_url', 'body', 'answer_key', 'internal_review_notes', 'status',
];

const instructorA = { id: 'usr_mock_instructor_a', display_name: 'ผู้สอนตัวอย่าง ก', avatar_url: null };
const instructorB = { id: 'usr_mock_instructor_b', display_name: 'ผู้สอนตัวอย่าง ข', avatar_url: null };

export const provisionalCatalogRecords: readonly MockCourseRecord[] = [
  {
    id: 'crs_mock_001',
    slug: 'mock-online-course-basics',
    status: 'published',
    title: 'พื้นฐานการออกแบบคอร์สออนไลน์ (ตัวอย่าง)',
    subtitle: 'วางโครงคอร์สให้ผู้เรียนเรียนต่อเนื่อง',
    description: 'คำอธิบายตัวอย่างสำหรับทดสอบหน้ารายละเอียดคอร์ส',
    cover_url: null,
    category: 'การสอนออนไลน์',
    level: 'เริ่มต้น',
    price: null,
    instructor: instructorA,
    published_at: '2026-09-20T03:00:00Z',
    outcomes: ['วางโครงบทเรียนได้', 'เลือกรูปแบบเนื้อหาให้เหมาะกับผู้เรียน'],
    chapters: [
      {
        id: 'chp_mock_001_1',
        title: 'เริ่มต้นออกแบบ',
        items: [
          { id: 'itm_mock_001_1', type: 'video', title: 'ภาพรวมคอร์ส', video_url: 'https://youtu.be/SECRET-video-001' },
          { id: 'itm_mock_001_2', type: 'article', title: 'เช็กลิสต์ก่อนสร้างคอร์ส', body: 'SECRET article body 001' },
          { id: 'itm_mock_001_3', type: 'quiz', title: 'ทบทวนบทที่ 1', answer_key: 'SECRET answer key 001' },
        ],
      },
    ],
    internal_review_notes: 'SECRET internal review note 001',
  },
  {
    id: 'crs_mock_002',
    slug: 'mock-presentation-skills',
    status: 'published',
    title: 'ทักษะการนำเสนอ (ตัวอย่าง)',
    subtitle: null,
    description: null,
    cover_url: null,
    category: 'การสื่อสาร',
    level: 'กลาง',
    price: { amount_minor: 99000, currency: 'THB' },
    instructor: instructorB,
    published_at: '2026-10-01T03:00:00Z',
    outcomes: ['เล่าเรื่องให้ชัดเจน'],
    chapters: [
      {
        id: 'chp_mock_002_1',
        title: 'โครงเรื่อง',
        items: [{ id: 'itm_mock_002_1', type: 'video', title: 'เปิดเรื่อง', video_url: 'https://youtu.be/SECRET-video-002' }],
      },
      { id: 'chp_mock_002_2', title: 'บทว่าง (ยังไม่มีเนื้อหา)', items: [] },
    ],
    internal_review_notes: 'SECRET internal review note 002',
  },
  {
    id: 'crs_mock_003',
    slug: 'mock-data-storytelling',
    status: 'published',
    title: 'เล่าเรื่องด้วยข้อมูล (ตัวอย่าง)',
    subtitle: 'จากตารางสู่ข้อสรุป',
    description: 'คอร์สตัวอย่างราคาสูงกว่าเพื่อทดสอบการกรองและเรียงลำดับ',
    cover_url: null,
    category: 'การสื่อสาร',
    level: 'ขั้นสูง',
    price: { amount_minor: 249000, currency: 'THB' },
    instructor: instructorA,
    published_at: '2026-10-05T03:00:00Z',
    outcomes: [],
    chapters: [],
    internal_review_notes: 'SECRET internal review note 003',
  },
  {
    id: 'crs_mock_draft',
    slug: 'mock-secret-draft',
    status: 'draft',
    title: 'SECRET draft course title',
    subtitle: 'SECRET draft subtitle',
    description: 'SECRET draft description',
    cover_url: null,
    category: 'SECRET category',
    level: 'SECRET level',
    price: null,
    instructor: instructorA,
    published_at: null,
    outcomes: ['SECRET outcome'],
    chapters: [{ id: 'chp_mock_draft_1', title: 'SECRET chapter', items: [{ id: 'itm_mock_draft_1', type: 'article', title: 'SECRET item', body: 'SECRET body' }] }],
    internal_review_notes: 'SECRET draft review note',
  },
  {
    id: 'crs_mock_pending',
    slug: 'mock-secret-pending',
    status: 'pending_review',
    title: 'SECRET pending review course title',
    subtitle: null,
    description: null,
    cover_url: null,
    category: 'SECRET category',
    level: 'SECRET level',
    price: null,
    instructor: instructorB,
    published_at: null,
    outcomes: [],
    chapters: [],
    internal_review_notes: 'SECRET pending review note',
  },
  {
    id: 'crs_mock_approved',
    slug: 'mock-secret-approved',
    status: 'approved',
    title: 'SECRET approved but unpublished course title',
    subtitle: null,
    description: null,
    cover_url: null,
    category: 'SECRET category',
    level: 'SECRET level',
    price: { amount_minor: 10000, currency: 'THB' },
    instructor: instructorB,
    published_at: null,
    outcomes: [],
    chapters: [],
    internal_review_notes: 'SECRET approved review note',
  },
];
