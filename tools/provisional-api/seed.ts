// PROVISIONAL MOCK DATA — development and tests only. Not a Backend, not production seed data, and not
// evidence that any API exists. Names, categories, levels, prices and codes are invented examples; the real
// values (category/level vocabulary, currency, price units) still wait for Backend/product decisions.
//
// The records include fields that must never be public (review notes, video links, article bodies, drafts).
// Tests search raw HTTP bodies for the SECRET markers below to prove public routes do not leak them.

import type { BlogPostRecord, CourseRecord, Db, RedeemCodeRecord, UserRecord } from './db.ts';

/** Substrings that must never appear in any public response body. */
export const mockSecretMarkers: readonly string[] = ['SECRET'];

/** Property names that must never appear in any public catalog response body. */
export const mockRestrictedKeys: readonly string[] = [
  'video_url', 'body', 'answer_key', 'correct_option_ids', 'internal_review_notes', 'status',
];

/** Password of every seeded account that has one. Mock only. */
export const mockPassword = 'mock-password-1';

const seededAt = '2026-09-01T00:00:00Z';

function user(partial: Partial<UserRecord> & Pick<UserRecord, 'id' | 'display_name' | 'roles' | 'origin'>): UserRecord {
  return {
    username: null, email: null, email_verified: false, avatar_url: null, password: mockPassword, google_subject: null,
    created_at: seededAt, created_by: null, instructor_added_by: null, instructor_added_at: null, ...partial,
  };
}

export const seedUsers: readonly UserRecord[] = [
  user({ id: 'usr_admin', display_name: 'ผู้ดูแลตัวอย่าง', username: 'admin', roles: ['admin'], origin: 'admin_created', created_by: 'usr_admin' }),
  user({ id: 'usr_instructor_a', display_name: 'ผู้สอนตัวอย่าง ก', email: 'instructor-a@example.test', email_verified: true, roles: ['learner', 'instructor'], origin: 'self_email', instructor_added_by: 'usr_admin', instructor_added_at: seededAt }),
  user({ id: 'usr_instructor_b', display_name: 'ผู้สอนตัวอย่าง ข', email: 'instructor-b@example.test', email_verified: true, roles: ['learner', 'instructor'], origin: 'self_email', instructor_added_by: 'usr_admin', instructor_added_at: seededAt }),
  user({ id: 'usr_learner', display_name: 'ผู้เรียนตัวอย่าง', email: 'learner@example.test', email_verified: true, roles: ['learner'], origin: 'self_email' }),
  user({ id: 'usr_learner_unverified', display_name: 'ผู้เรียนที่ยังไม่ยืนยันอีเมล', email: 'unverified@example.test', email_verified: false, roles: ['learner'], origin: 'self_email' }),
  user({ id: 'usr_learner_google', display_name: 'ผู้เรียน Google', email: 'google-learner@example.test', email_verified: true, roles: ['learner'], origin: 'google', password: null, google_subject: 'google-subject-learner' }),
  user({ id: 'usr_learner_admin_created', display_name: 'ผู้เรียนที่ Admin สร้าง', username: 'learner-admin', roles: ['learner'], origin: 'admin_created', created_by: 'usr_admin' }),
];

type CourseSeed = Omit<CourseRecord, 'revision' | 'ai_enabled' | 'created_by' | 'created_at' | 'updated_at'>;

const courseSeeds: readonly CourseSeed[] = [
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
    instructor_id: 'usr_instructor_a',
    published_at: '2026-09-20T03:00:00Z',
    outcomes: ['วางโครงบทเรียนได้', 'เลือกรูปแบบเนื้อหาให้เหมาะกับผู้เรียน'],
    chapters: [
      {
        id: 'chp_mock_001_1',
        title: 'เริ่มต้นออกแบบ',
        items: [
          { id: 'itm_mock_001_1', type: 'video', title: 'ภาพรวมคอร์ส', video_url: 'https://youtu.be/SECRET-video-001' },
          { id: 'itm_mock_001_2', type: 'article', title: 'เช็กลิสต์ก่อนสร้างคอร์ส', body: 'SECRET article body 001' },
          {
            id: 'itm_mock_001_3',
            type: 'quiz',
            title: 'ทบทวนบทที่ 1',
            quiz: {
              questions: [
                {
                  id: 'qst_mock_001_1', type: 'single_choice', prompt: 'ข้อใดคือจุดเริ่มต้นของการออกแบบคอร์ส', points: 1,
                  options: [{ id: 'opt_001_1_a', text: 'เขียนเนื้อหาทันที' }, { id: 'opt_001_1_b', text: 'กำหนดผลลัพธ์การเรียนรู้' }],
                  correct_option_ids: ['opt_001_1_b'],
                },
                {
                  id: 'qst_mock_001_2', type: 'multiple_choice', prompt: 'เลือกรูปแบบเนื้อหาที่ใช้ได้ทั้งหมด', points: 1,
                  options: [{ id: 'opt_001_2_a', text: 'วิดีโอ' }, { id: 'opt_001_2_b', text: 'ตัวอักษรสีขาวบนพื้นขาว' }, { id: 'opt_001_2_c', text: 'บทอ่าน' }],
                  correct_option_ids: ['opt_001_2_a', 'opt_001_2_c'],
                },
                { id: 'qst_mock_001_3', type: 'essay', prompt: 'อธิบายแผนบทเรียนของคุณสั้น ๆ', points: 2 },
              ],
            },
          },
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
    instructor_id: 'usr_instructor_b',
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
    instructor_id: 'usr_instructor_a',
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
    instructor_id: 'usr_instructor_a',
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
    instructor_id: 'usr_instructor_b',
    published_at: null,
    outcomes: [],
    chapters: [{ id: 'chp_mock_pending_1', title: 'SECRET pending chapter', items: [{ id: 'itm_mock_pending_1', type: 'article', title: 'SECRET pending item', body: 'SECRET pending body' }] }],
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
    instructor_id: 'usr_instructor_b',
    published_at: null,
    outcomes: [],
    chapters: [],
    internal_review_notes: 'SECRET approved review note',
  },
];

function seedCourse(seed: CourseSeed): CourseRecord {
  return {
    ...structuredClone(seed), revision: 1, ai_enabled: false, created_by: seed.instructor_id,
    created_at: seededAt, updated_at: seed.published_at ?? seededAt,
  };
}

/** Copies of the seeded courses for tests that need to compare against the original records. */
export const seedCourses: readonly CourseRecord[] = courseSeeds.map(seedCourse);

export const seedRedeemCodes: readonly RedeemCodeRecord[] = [
  { id: 'rdm_seed_unused', code: 'MOCK-UNUSED-0001', course_id: 'crs_mock_002', status: 'unused', created_by: 'usr_admin', created_at: seededAt, used_by: null, used_at: null, revoked_by: null, revoked_at: null },
  { id: 'rdm_seed_revoked', code: 'MOCK-REVOKED-0001', course_id: 'crs_mock_002', status: 'revoked', created_by: 'usr_admin', created_at: seededAt, used_by: null, used_at: null, revoked_by: 'usr_admin', revoked_at: '2026-09-02T00:00:00Z' },
];

export const seedBlogPosts: readonly BlogPostRecord[] = [
  { id: 'blg_mock_001', slug: 'mock-first-post', title: 'บทความตัวอย่างแรก', cover_url: null, excerpt: 'คำเกริ่นตัวอย่าง', content: 'เนื้อหาบทความตัวอย่างที่เปิดสาธารณะ', status: 'published', author_id: 'usr_admin', editor_id: 'usr_admin', created_at: seededAt, updated_at: '2026-09-10T00:00:00Z', published_at: '2026-09-10T00:00:00Z' },
  { id: 'blg_mock_002', slug: 'mock-second-post', title: 'บทความตัวอย่างที่สอง', cover_url: null, excerpt: null, content: 'เนื้อหาบทความตัวอย่างที่สอง', status: 'published', author_id: 'usr_admin', editor_id: 'usr_admin', created_at: seededAt, updated_at: '2026-09-25T00:00:00Z', published_at: '2026-09-25T00:00:00Z' },
  { id: 'blg_mock_draft', slug: 'mock-secret-draft-post', title: 'SECRET draft blog title', cover_url: null, excerpt: 'SECRET draft excerpt', content: 'SECRET draft blog content', status: 'draft', author_id: 'usr_admin', editor_id: 'usr_admin', created_at: seededAt, updated_at: seededAt, published_at: null },
];

/** Seeds carry fixed dates (not the mock clock) so tests can reason about ordering. */
export function seedDefaultData(db: Db): void {
  for (const record of seedUsers) db.users.set(record.id, structuredClone(record));
  for (const record of seedCourses) db.courses.set(record.id, structuredClone(record));
  for (const record of seedRedeemCodes) db.redeemCodes.set(record.id, structuredClone(record));
  for (const record of seedBlogPosts) db.blogPosts.set(record.id, structuredClone(record));
}
