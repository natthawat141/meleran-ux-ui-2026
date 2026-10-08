// PROVISIONAL MOCK — Flow H (Blog), development/test only.
//
// Mock-only assumptions:
// - Public and admin lists use cursor pagination and newest publication/update ordering.
// - A published post cannot change its slug in this mock; clients must create a new post instead.

import type { BlogPostRecord } from './db.ts';
import { iso, nextId } from './db.ts';
import {
  ApiError, created, notFound, ok, paginate, queryProblems, readObject, rejectUnknownFields, requireRole,
  validationFailed,
} from './http.ts';
import type { FieldError, Route } from './http.ts';

const publicView = (post: BlogPostRecord) => ({
  id: post.id, slug: post.slug, title: post.title, cover_url: post.cover_url, excerpt: post.excerpt, published_at: post.published_at,
});
const detailView = (post: BlogPostRecord) => ({ ...publicView(post), content: post.content });
const slugPattern = /^[a-z0-9-]{3,80}$/;
const adminView = (post: BlogPostRecord) => ({
  id: post.id, slug: post.slug, title: post.title, cover_url: post.cover_url, excerpt: post.excerpt, content: post.content,
  status: post.status, author_id: post.author_id, editor_id: post.editor_id, created_at: post.created_at,
  updated_at: post.updated_at, published_at: post.published_at,
});

function blogOr404(context: Parameters<NonNullable<Route['handler']>>[0], id: string): BlogPostRecord {
  const post = context.db.blogPosts.get(id);
  if (!post) throw notFound();
  return post;
}

function validateText(body: Record<string, unknown>, fields: readonly string[], requireContent = false): FieldError[] {
  const problems: FieldError[] = [];
  for (const field of fields) {
    if (!(field in body)) {
      if (requireContent && field === 'content') problems.push({ field, code: 'required' });
      continue;
    }
    if (body[field] !== null && typeof body[field] !== 'string') problems.push({ field, code: 'invalid' });
    else if (field === 'title' && typeof body[field] === 'string' && body[field].trim() === '') problems.push({ field, code: 'required' });
  }
  return problems;
}

function uniqueSlug(context: Parameters<NonNullable<Route['handler']>>[0], slug: string, except?: string): void {
  if ([...context.db.blogPosts.values()].some((post) => post.slug === slug && post.id !== except)) {
    throw new ApiError(409, 'slug_taken', 'Slug นี้ถูกใช้แล้ว', { fields: [{ field: 'slug', code: 'taken' }] });
  }
}

export const blogRoutes: Route[] = [
  {
    method: 'GET', path: 'blog',
    handler: (context) => {
      const problems = queryProblems(context.query, ['limit', 'cursor']);
      const posts = [...context.db.blogPosts.values()].filter((post) => post.status === 'published')
        .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '') || a.id.localeCompare(b.id));
      const page = paginate(posts, context.query, context.config, problems);
      return ok({ items: page.items.map(publicView), next_cursor: page.next_cursor });
    },
  },
  {
    method: 'GET', path: 'blog/:slug',
    handler: (context) => {
      const post = [...context.db.blogPosts.values()].find((candidate) => candidate.slug === context.params.slug && candidate.status === 'published');
      if (!post) throw notFound();
      return ok(detailView(post));
    },
  },
  {
    method: 'GET', path: 'admin/blog',
    handler: (context) => {
      requireRole(context, 'admin');
      const problems = queryProblems(context.query, ['limit', 'cursor']);
      const posts = [...context.db.blogPosts.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
      const page = paginate(posts, context.query, context.config, problems);
      return ok({ items: page.items.map(adminView), next_cursor: page.next_cursor });
    },
  },
  {
    method: 'POST', path: 'admin/blog',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const body = readObject(context);
      rejectUnknownFields(body, ['title', 'slug', 'cover_url', 'excerpt', 'content']);
      const problems = validateText(body, ['title', 'content'], true);
      if (typeof body.slug !== 'string' || !slugPattern.test(body.slug)) problems.push({ field: 'slug', code: 'invalid' });
      if (problems.length) throw validationFailed(problems);
      const slug = body.slug as string;
      uniqueSlug(context, slug);
      const now = iso(context.clock.now());
      const post: BlogPostRecord = {
        id: nextId(context.db, 'blg'), slug, title: (body.title as string).trim(),
        cover_url: typeof body.cover_url === 'string' ? body.cover_url : null,
        excerpt: typeof body.excerpt === 'string' ? body.excerpt : null, content: body.content as string,
        status: 'draft', author_id: admin.id, editor_id: admin.id, created_at: now, updated_at: now, published_at: null,
      };
      context.db.blogPosts.set(post.id, post);
      return created(adminView(post));
    },
  },
  {
    method: 'PATCH', path: 'admin/blog/:id',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const post = blogOr404(context, context.params.id);
      const body = readObject(context);
      rejectUnknownFields(body, ['title', 'slug', 'cover_url', 'excerpt', 'content']);
      const problems = validateText(body, ['title', 'content']);
      if ('slug' in body && (typeof body.slug !== 'string' || !slugPattern.test(body.slug))) problems.push({ field: 'slug', code: 'invalid' });
      if (problems.length) throw validationFailed(problems);
      if (typeof body.slug === 'string' && body.slug !== post.slug) {
        if (post.status === 'published') throw new ApiError(409, 'invalid_state', 'บทความที่เผยแพร่แล้วเปลี่ยน Slug ไม่ได้');
        uniqueSlug(context, body.slug, post.id); post.slug = body.slug;
      }
      if ('title' in body) post.title = (body.title as string).trim();
      if ('cover_url' in body) post.cover_url = body.cover_url === null ? null : body.cover_url as string;
      if ('excerpt' in body) post.excerpt = body.excerpt === null ? null : body.excerpt as string;
      if ('content' in body) post.content = body.content as string;
      post.editor_id = admin.id; post.updated_at = iso(context.clock.now());
      return ok(adminView(post));
    },
  },
  {
    method: 'GET', path: 'admin/blog/:id/preview',
    handler: (context) => {
      requireRole(context, 'admin');
      return ok(adminView(blogOr404(context, context.params.id)));
    },
  },
  {
    method: 'POST', path: 'admin/blog/:id/publish',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const post = blogOr404(context, context.params.id);
      if (context.body !== undefined) rejectUnknownFields(readObject(context), []);
      if (!post.title.trim() || !post.content) throw validationFailed([
        ...(!post.title.trim() ? [{ field: 'title', code: 'required' as const }] : []),
        ...(!post.content ? [{ field: 'content', code: 'required' as const }] : []),
      ]);
      if (post.status !== 'published') {
        post.status = 'published'; post.published_at = iso(context.clock.now());
        post.editor_id = admin.id; post.updated_at = iso(context.clock.now());
      }
      return ok(adminView(post));
    },
  },
];
