/** Canonical CourseDetail projection; Prisma entities are never returned directly. */
export interface CourseDetailDto {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  category: string;
  level: string;
  price: { amount_minor: number; currency: 'THB' } | null;
  instructor: { id: string; display_name: string; avatar_url: string | null };
  published_at: string;
  description: string | null;
  outcomes: string[];
  outline: Array<{ id: string; title: string; items: Array<{ id: string; title: string; type: 'article' | 'video' | 'quiz' }> }>;
}

export function storedOutcomes(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
    throw new Error('Stored course outcomes do not match the canonical projection.');
  }
  return parsed;
}

export function storedItemType(value: string): 'article' | 'video' | 'quiz' {
  if (value === 'article' || value === 'video' || value === 'quiz') return value;
  throw new Error('Stored course item type does not match the canonical projection.');
}
