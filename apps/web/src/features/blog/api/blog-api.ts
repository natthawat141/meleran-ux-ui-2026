import type { PublicBlogDetail, PublicBlogPage, PublicBlogSummary } from '@melearn/contracts';
import { apiClient } from '../../../shared/api/client';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid blog payload');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Invalid blog text');
  return value;
}
const nullableText = (value: unknown): string | null => value === null ? null : text(value);
export function decodeBlogSummary(value: unknown): PublicBlogSummary {
  const row = record(value);
  return { id: text(row.id), slug: text(row.slug), title: text(row.title), cover_url: nullableText(row.cover_url),
    excerpt: nullableText(row.excerpt), published_at: nullableText(row.published_at),category:text(row.category),reading_minutes:Number(row.reading_minutes),author:{id:text(record(row.author).id),display_name:text(record(row.author).display_name)} };
}
export function decodeBlogDetail(value: unknown): PublicBlogDetail {
  return { ...decodeBlogSummary(value), content: text(record(value).content),content_doc:(record(value).content_doc??null) as PublicBlogDetail['content_doc'] };
}
export function decodeBlogPage(value: unknown): PublicBlogPage {
  const row = record(value);
  if (!Array.isArray(row.items)) throw new TypeError('Invalid blog list');
  return { items: row.items.map(decodeBlogSummary), next_cursor: nullableText(row.next_cursor) };
}

export const blogApi = {
  async list(signal?: AbortSignal): Promise<PublicBlogSummary[]> {
    const posts: PublicBlogSummary[] = [];
    const cursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const path: string = `blog?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page: PublicBlogPage = await apiClient.request(path, { method: 'GET', signal, decoder: decodeBlogPage });
      posts.push(...page.items);
      cursor = page.next_cursor;
      if (cursor && cursors.has(cursor)) throw new TypeError('Repeated blog pagination cursor');
      if (cursor) cursors.add(cursor);
    } while (cursor);
    return posts;
  },
  detail: (slug: string, signal?: AbortSignal) => apiClient.request(`blog/${encodeURIComponent(slug)}`, {
    method: 'GET', signal, decoder: decodeBlogDetail,
  }),
};
