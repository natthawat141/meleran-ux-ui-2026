import { useQuery } from '@tanstack/react-query';
import type { PublicBlogDetail, PublicBlogSummary } from '@melearn/contracts';
import { blogApi } from '../api/blog-api';

/** Presentation mapping only; this object is never persisted or sent as a DTO. */
export function blogCard(post: PublicBlogSummary) {
  return { id: post.id, slug: post.slug, title: post.title, cover: post.cover_url ?? undefined,
    coverKey: 'writing', excerpt: post.excerpt ?? '', category: post.category,readingMinutes:post.reading_minutes,author:post.author.display_name, publishedAt: post.published_at };
}
export type BlogCardView = ReturnType<typeof blogCard> & { body?: string; bodyDoc?: unknown; readingMinutes?: number };
export function usePublicBlog() {
  return useQuery({ queryKey: ['public-blog'], queryFn: ({ signal }) => blogApi.list(signal),
    select: (posts) => posts.map(blogCard), staleTime: 30_000 });
}
export function usePublicBlogDetail(slug?: string) {
  return useQuery({ queryKey: ['public-blog-detail', slug], queryFn: ({ signal }) => blogApi.detail(slug!, signal),
    enabled: Boolean(slug), select: (post: PublicBlogDetail): BlogCardView => ({ ...blogCard(post), body: post.content,bodyDoc:post.content_doc,
      readingMinutes: post.reading_minutes }) });
}
