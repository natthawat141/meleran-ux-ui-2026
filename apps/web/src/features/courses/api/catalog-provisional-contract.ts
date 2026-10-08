// PROVISIONAL / DRAFT — not a frozen API contract.
//
// These types and decoders mirror the Flow B sketch in docs/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md so the Web
// catalog can be developed before a Backend owner exists. They deliberately live inside the Web feature and are
// NOT exported from packages/contracts: R4a requires Backend confirmation before DTOs move there. Every field
// below can still change; update the draft document, the mock and its tests together when it does.

export interface ProvisionalMoney {
  /** Integer minor units; currency and unit conventions are still waiting for Backend/Stripe decisions. */
  amount_minor: number;
  currency: string;
}

export interface ProvisionalInstructorSummary {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface ProvisionalCourseSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  category: string;
  level: string;
  /** null means a free course. */
  price: ProvisionalMoney | null;
  instructor: ProvisionalInstructorSummary;
  published_at: string;
}

export type ProvisionalOutlineItemType = 'video' | 'article' | 'quiz';

export interface ProvisionalOutlineItem {
  id: string;
  type: ProvisionalOutlineItemType;
  title: string;
}

export interface ProvisionalOutlineChapter {
  id: string;
  title: string;
  items: ProvisionalOutlineItem[];
}

export interface ProvisionalCourseDetail extends ProvisionalCourseSummary {
  description: string | null;
  outcomes: string[];
  /** Titles and item types only. Whether item titles are public is an open Backend question. */
  outline: ProvisionalOutlineChapter[];
}

export interface ProvisionalCoursePage {
  items: ProvisionalCourseSummary[];
  /** Opaque cursor for the next page, or null on the last page. */
  next_cursor: string | null;
}

const outlineItemTypes: readonly string[] = ['video', 'article', 'quiz'];

function invalid(): never {
  throw new Error('Payload does not match the provisional catalog contract.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : invalid();
}

function requireString(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : invalid();
}

function nullableString(value: unknown): string | null {
  return value === null ? null : requireString(value);
}

function requireTimestamp(value: unknown): string {
  const text = requireString(value);
  return Number.isNaN(Date.parse(text)) ? invalid() : text;
}

function requireArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : invalid();
}

function decodeMoney(value: unknown): ProvisionalMoney | null {
  if (value === null) return null;
  const record = requireRecord(value);
  const amount = record.amount_minor;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) invalid();
  return { amount_minor: amount, currency: requireString(record.currency) };
}

function decodeInstructor(value: unknown): ProvisionalInstructorSummary {
  const record = requireRecord(value);
  return {
    id: requireString(record.id),
    display_name: requireString(record.display_name),
    avatar_url: nullableString(record.avatar_url),
  };
}

/** Keeps only the fields named in the draft so extra server fields never reach UI code by accident. */
export function decodeCourseSummary(payload: unknown): ProvisionalCourseSummary {
  const record = requireRecord(payload);
  return {
    id: requireString(record.id),
    slug: requireString(record.slug),
    title: requireString(record.title),
    subtitle: nullableString(record.subtitle),
    cover_url: nullableString(record.cover_url),
    category: requireString(record.category),
    level: requireString(record.level),
    price: decodeMoney(record.price),
    instructor: decodeInstructor(record.instructor),
    published_at: requireTimestamp(record.published_at),
  };
}

function decodeOutlineItem(value: unknown): ProvisionalOutlineItem {
  const record = requireRecord(value);
  const type = requireString(record.type);
  if (!outlineItemTypes.includes(type)) invalid();
  return { id: requireString(record.id), type: type as ProvisionalOutlineItemType, title: requireString(record.title) };
}

function decodeOutlineChapter(value: unknown): ProvisionalOutlineChapter {
  const record = requireRecord(value);
  return {
    id: requireString(record.id),
    title: requireString(record.title),
    items: requireArray(record.items).map(decodeOutlineItem),
  };
}

export function decodeCourseDetail(payload: unknown): ProvisionalCourseDetail {
  const record = requireRecord(payload);
  return {
    ...decodeCourseSummary(payload),
    description: nullableString(record.description),
    outcomes: requireArray(record.outcomes).map(requireString),
    outline: requireArray(record.outline).map(decodeOutlineChapter),
  };
}

export function decodeCoursePage(payload: unknown): ProvisionalCoursePage {
  const record = requireRecord(payload);
  return {
    items: requireArray(record.items).map(decodeCourseSummary),
    next_cursor: nullableString(record.next_cursor),
  };
}
