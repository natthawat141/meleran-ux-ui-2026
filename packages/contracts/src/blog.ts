export type BlogPostStatus = 'draft' | 'published';

/** Draft HTTP contract, distinct from the prototype editor's BlogPost model. */
export interface PublicBlogSummary {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  excerpt: string | null;
  published_at: string | null;
  category: string;
  reading_minutes: number;
  author: { id: string; display_name: string };
}
export interface PublicBlogDetail extends PublicBlogSummary {
  content: string;
  content_doc: import('./management-http.ts').JsonValue | null;
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

export interface AdminBlogDto extends PublicBlogDetail {
  revision: number;
  status: BlogPostStatus;
  author_id: string;
  editor_id: string;
  created_at: string;
  updated_at: string;
}
export interface BlogWriteRequest {
  title: string;
  slug: string;
  category: string;
  cover_url: string | null;
  excerpt: string | null;
  content: string;
  content_doc: import('./management-http.ts').JsonValue | null;
  expected_revision?: number;
}
