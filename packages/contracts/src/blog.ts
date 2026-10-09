export type BlogPostStatus = 'draft' | 'published';

/** Draft HTTP contract, distinct from the prototype editor's BlogPost model. */
export type PublicBlogSummary = import('./generated/types.gen.ts').PublicBlogSummary;
export type PublicBlogDetail = import('./generated/types.gen.ts').PublicBlogDetail;
export type PublicBlogPage = import('./generated/types.gen.ts').PublicBlogPage;

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

export type AdminBlogDto = import('./generated/types.gen.ts').AdminBlogDto;
export type BlogWriteRequest = import('./generated/types.gen.ts').BlogWriteRequest;
