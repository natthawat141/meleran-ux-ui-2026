// Draft catalog payload decoders. DTOs are owned by packages/contracts.
import type { Money as ProvisionalMoney, InstructorSummary as ProvisionalInstructorSummary, CourseSummary as ProvisionalCourseSummary, CourseDetail as ProvisionalCourseDetail, CoursePage as ProvisionalCoursePage, CourseItemType as ProvisionalOutlineItemType, CourseOutlineItemSummary as ProvisionalOutlineItem, CourseOutlineChapterSummary as ProvisionalOutlineChapter } from '@melearn/contracts';
export type { Money as ProvisionalMoney, InstructorSummary as ProvisionalInstructorSummary, CourseSummary as ProvisionalCourseSummary, CourseDetail as ProvisionalCourseDetail, CoursePage as ProvisionalCoursePage, CourseItemType as ProvisionalOutlineItemType } from '@melearn/contracts';

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
