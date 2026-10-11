import { Prisma } from '@prisma/client';
import { storedResume } from '../../enrollments/public/index';

export type LearningItemType = 'article' | 'video' | 'quiz';
export interface LearningItemDto {
  id: string; type: LearningItemType; title: string; completed_at: string | null;
  resume: { position_seconds: number | null; updated_at: string } | null;
}
export interface LearningCourseDto {
  id: string; slug: string; title: string; subtitle: string | null; cover_url: string | null;
  category: string; level: string; price: { amount_minor: number; currency: 'THB' } | null; published_at: string;
  instructor: { id: string; display_name: string; avatar_url: string | null };
  access: { mode: 'enrolled'; enrollment: { id: string; course_id: string; source: 'free' | 'stripe' | 'redeem'; access: 'lifetime'; granted_at: string } };
  outline: Array<{ id: string; title: string; items: LearningItemDto[] }>;
  progress: { completed_items: number; total_items: number; completed_at: string | null };
  resume_item_id: string | null; certificate_id: string | null;
}
export interface LearningItemContentDto {
  id: string; type: LearningItemType; title: string;
  video_url?: string | null; body?: string|null; body_doc?: Prisma.JsonValue;
  quiz?: { question_count: number; max_score: number };
}

export function learningItemType(value: string): LearningItemType {
  if (value === 'article' || value === 'video' || value === 'quiz') return value;
  throw new Error('Invalid stored learning item type');
}

/** Project only the canonical resume fields; never return the JSON entity. */
export function learningResume(value: Prisma.JsonValue | null, updatedAt: Date): LearningItemDto['resume'] {
  return storedResume(value, updatedAt)?.wire ?? null;
}
