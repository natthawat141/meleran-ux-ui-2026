export type BlogPostStatus = 'draft' | 'published';

/** Draft HTTP contract, distinct from the prototype editor's BlogPost model. */
export interface PublicBlogSummary {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  excerpt: string | null;
  published_at: string | null;
}
export interface PublicBlogDetail extends PublicBlogSummary {
  content: string;
}
export interface PublicBlogPage {
  items: PublicBlogSummary[];
  next_cursor: string | null;
}

export interface BlogPost {
  id: string;
  title: string;
  category: string;
  coverKey?: string;
  cover?: string;
  excerpt: string;
  body: string;
  bodyDoc?: unknown;
  authorId: string;
  status: BlogPostStatus;
  readingMinutes?: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}
