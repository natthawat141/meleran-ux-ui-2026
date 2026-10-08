// PROVISIONAL MOCK — development and tests only.
//
// In-memory records for the provisional API mock. These shapes model what a server might store; they are NOT
// a database design, NOT a contract and NOT evidence that any Backend exists. Public responses are built by
// explicit allow-list projections in each flow module, never by returning these records directly.

export type Role = 'learner' | 'instructor' | 'admin';
export type AccountOrigin = 'self_email' | 'google' | 'admin_created';

export interface Money { amount_minor: number; currency: string }

export interface Clock {
  now(): Date;
  /** Test helper: move the mock clock forward. */
  advance(milliseconds: number): void;
  /** Test helper: set the mock clock. */
  set(date: Date): void;
}

export interface UserRecord {
  profile?: import('../../packages/contracts/src/profile.ts').AccountProfile;
  id: string;
  display_name: string;
  username: string | null;
  email: string | null;
  email_verified: boolean;
  avatar_url: string | null;
  roles: Role[];
  origin: AccountOrigin;
  /** Mock-only plain text. A real server stores a hash; neither is ever returned. */
  password: string | null;
  google_subject: string | null;
  created_at: string;
  created_by: string | null;
  instructor_added_by: string | null;
  instructor_added_at: string | null;
}

export interface SessionRecord { id: string; user_id: string; audience: 'web' | 'admin'; created_at: string }

export interface TokenRecord {
  token: string;
  kind: 'verify_email' | 'reset_password';
  user_id: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

/** Stand-in for Resend. Tests read it to find the link tokens that a real email would carry. */
export interface OutboxEmail { id: string; to: string; kind: 'verify_email' | 'reset_password'; token: string; sent_at: string }

export type QuestionType = 'single_choice' | 'multiple_choice' | 'essay' | 'image';

export interface QuizQuestionRecord {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options?: { id: string; text: string }[];
  /** Answer key. Never public, never in a learner-facing attempt before grading rules allow it. */
  correct_option_ids?: string[];
}

export interface QuizRecord { questions: QuizQuestionRecord[] }

export type ItemType = 'video' | 'article' | 'quiz';

export interface ItemRecord {
  id: string;
  type: ItemType;
  title: string;
  /** Restricted: only learners with access (Flow C) and managers (Flow E) may read. */
  video_url?: string;
  body?: string;
  quiz?: QuizRecord;
  /** Admin-only plain text for AI support (Flow G). */
  ai_transcript?: { text: string; edited_by: string; edited_at: string };
}

export interface ChapterRecord { id: string; title: string; items: ItemRecord[] }

export type CourseStatus = 'draft' | 'pending_review' | 'approved' | 'published';

export interface CourseRecord {
  id: string;
  slug: string;
  status: CourseStatus;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_url: string | null;
  category: string;
  level: string;
  price: Money | null;
  instructor_id: string;
  published_at: string | null;
  outcomes: string[];
  chapters: ChapterRecord[];
  /** Never public. */
  internal_review_notes: string;
  /** Increments on every change to authoring data; reviews and writes refer to it. */
  revision: number;
  ai_enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewRecord {
  id: string;
  course_id: string;
  revision: number;
  submitted_by: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'returned' | 'stale';
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
}

export type EnrollmentSource = 'free' | 'stripe' | 'redeem';

export interface CompletionSnapshotItem {
  item_id: string;
  type: ItemType;
  title: string;
  completed_at: string;
  /** For quizzes: the attempt and score that decided the pass. */
  attempt_id?: string;
  earned?: number;
  max?: number;
}

export interface EnrollmentRecord {
  id: string;
  user_id: string;
  course_id: string;
  source: EnrollmentSource;
  granted_at: string;
  completed_at: string | null;
  completion_snapshot: CompletionSnapshotItem[] | null;
}

export interface ProgressRecord {
  enrollment_id: string;
  item_id: string;
  completed_at: string | null;
  resume: { position_seconds: number | null; updated_at: string } | null;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'pending_review' | 'graded';

export interface AttemptAnswer { option_ids?: string[]; text?: string; image_url?: string }
export interface QuestionGrade { score: number; comment: string | null; graded_by: string | null; graded_at: string }

export interface AttemptRecord {
  id: string;
  enrollment_id: string;
  user_id: string;
  course_id: string;
  item_id: string;
  number: number;
  status: AttemptStatus;
  /** Frozen at start, including the answer key. */
  snapshot: QuizQuestionRecord[];
  answers: Record<string, AttemptAnswer>;
  grades: Record<string, QuestionGrade>;
  started_at: string;
  submitted_at: string | null;
  graded_at: string | null;
  earned: number | null;
  max: number;
  passed: boolean | null;
}

export interface CertificateRecord {
  id: string;
  code: string;
  enrollment_id: string;
  user_id: string;
  course_id: string;
  learner_name: string;
  course_title: string;
  issued_at: string;
}

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
export type FulfillmentStatus = 'pending' | 'granted' | 'failed';

export interface PaymentEventRecord {
  event_id: string;
  type: string;
  received_at: string;
  processed_at: string | null;
  outcome: string;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  course_id: string;
  request_id: string;
  amount: Money;
  status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  enrollment_id: string | null;
  checkout_session_id: string;
  created_at: string;
  events: PaymentEventRecord[];
}

export interface RedeemCodeRecord {
  id: string;
  code: string;
  course_id: string;
  status: 'unused' | 'used' | 'revoked';
  created_by: string;
  created_at: string;
  used_by: string | null;
  used_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
}

export interface AiConversationRecord {
  id: string;
  user_id: string;
  title: string;
  course_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PracticeQuestionRecord {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  /** Kept in the snapshot, never sent before the learner answers that question. */
  correct_option_id: string;
  explanation: string;
}

export interface PracticeSnapshot {
  topic_id: string;
  questions: PracticeQuestionRecord[];
  answers: Record<string, { option_id: string; answered_at: string }>;
}

export interface AiMessageRecord {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  kind: 'text' | 'practice_set';
  content: string;
  status: 'pending' | 'succeeded' | 'failed';
  request_id: string | null;
  created_at: string;
  completed_at: string | null;
  /** Bangkok date (YYYY-MM-DD) the request was accepted on; the quota counts succeeded messages per date. */
  usage_date: string | null;
  context_course_id: string | null;
  error_code: string | null;
  practice: PracticeSnapshot | null;
}

export interface BlogPostRecord {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  excerpt: string | null;
  content: string;
  status: 'draft' | 'published';
  author_id: string;
  editor_id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface Db {
  users: Map<string, UserRecord>;
  sessions: Map<string, SessionRecord>;
  tokens: Map<string, TokenRecord>;
  outbox: OutboxEmail[];
  courses: Map<string, CourseRecord>;
  reviews: Map<string, ReviewRecord>;
  enrollments: Map<string, EnrollmentRecord>;
  progress: Map<string, ProgressRecord>;
  attempts: Map<string, AttemptRecord>;
  certificates: Map<string, CertificateRecord>;
  payments: Map<string, PaymentRecord>;
  redeemCodes: Map<string, RedeemCodeRecord>;
  aiConversations: Map<string, AiConversationRecord>;
  aiMessages: Map<string, AiMessageRecord>;
  blogPosts: Map<string, BlogPostRecord>;
  /** Per-key retry timestamps for rate limits (mock-only). */
  rateLimits: Map<string, string>;
  counters: Map<string, number>;
}

export function createEmptyDb(): Db {
  return {
    users: new Map(), sessions: new Map(), tokens: new Map(), outbox: [],
    courses: new Map(), reviews: new Map(), enrollments: new Map(), progress: new Map(),
    attempts: new Map(), certificates: new Map(), payments: new Map(), redeemCodes: new Map(),
    aiConversations: new Map(), aiMessages: new Map(), blogPosts: new Map(),
    rateLimits: new Map(), counters: new Map(),
  };
}

/** Deterministic IDs: `<prefix>_<n>` per prefix. Opaque to clients (draft D4). */
export function nextId(db: Db, prefix: string): string {
  const next = (db.counters.get(prefix) ?? 0) + 1;
  db.counters.set(prefix, next);
  return `${prefix}_${String(next).padStart(4, '0')}`;
}

export function createClock(start: Date = new Date('2026-10-08T09:00:00Z')): Clock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance: (milliseconds) => { current += milliseconds; },
    set: (date) => { current = date.getTime(); },
  };
}

export const iso = (date: Date): string => date.toISOString().replace('.000Z', 'Z');
