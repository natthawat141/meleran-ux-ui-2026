// PROVISIONAL MOCK — Flow H (Blog), development/test only.
//
// Mock-only assumptions:
// - Public and admin lists use cursor pagination and newest publication/update ordering.
// - A published post cannot change its slug in this mock; clients must create a new post instead.

import { richDocument } from './rich-document.ts';
import type { BlogPostRecord } from './db.ts';
import type {
  PublicBlogSummary,
  PublicBlogDetail,
  AdminBlogDto,
} from '../../packages/contracts/src/blog.ts';
import { iso, nextId } from './db.ts';
import {
  ApiError,
  created,
  notFound,
  ok,
  paginate,
  queryProblems,
  readObject,
  rejectUnknownFields,
  requireRole,
  validationFailed,
} from './http.ts';
import type { FieldError, Route } from './http.ts';

const publicView = (post: BlogPostRecord): PublicBlogSummary => ({
  id: post.id,
  slug: post.slug,
  title: post.title,
  cover_url: post.cover_url,
  excerpt: post.excerpt,
  published_at: post.published_at,
  category: post.category ?? 'บทความ',
  reading_minutes: Math.max(2, Math.ceil(post.content.length / 500)),
  author: { id: post.author_id, display_name: post.author_display_name ?? 'Melearn' },
});
const detailView = (post: BlogPostRecord): PublicBlogDetail => ({
  ...publicView(post),
  content: post.content,
  content_doc: post.content_doc ?? null,
});
const slugPattern = /^[a-z0-9-]{3,80}$/;
export const adminBlogView = (post: BlogPostRecord): AdminBlogDto => ({
  ...detailView(post),
  revision: post.revision ?? 1,
  status: post.status,
  author_id: post.author_id,
  editor_id: post.editor_id,
  created_at: post.created_at,
  updated_at: post.updated_at,
  published_at: post.published_at,
});

function checkBlogRevision(body: Record<string, unknown>, post: BlogPostRecord) {
  if ('expected_revision' in body && body.expected_revision !== (post.revision ?? 1))
    throw new ApiError(409, 'revision_conflict', 'บทความเปลี่ยนแปลงแล้ว กรุณาโหลดล่าสุด');
}

function blogOr404(
  context: Parameters<NonNullable<Route['handler']>>[0],
  id: string,
): BlogPostRecord {
  const post = context.db.blogPosts.get(id);
  if (!post) throw notFound();
  return post;
}

function validateText(
  body: Record<string, unknown>,
  fields: readonly string[],
  requireContent = false,
): FieldError[] {
  const problems: FieldError[] = [];
  for (const field of fields) {
    if (!(field in body)) {
      if (requireContent && ['title', 'content'].includes(field))
        problems.push({ field, code: 'required' });
      continue;
    }
    if (
      (['title', 'content'].includes(field) && typeof body[field] !== 'string') ||
      (body[field] !== null && typeof body[field] !== 'string')
    )
      problems.push({ field, code: 'invalid' });
    else if (field === 'title' && typeof body[field] === 'string' && body[field].trim() === '')
      problems.push({ field, code: 'required' });
    const max = { title: 120, content: 200000, category: 40, excerpt: 2000, cover_url: 2000000 }[
      field
    ];
    if (max && typeof body[field] === 'string' && body[field].length > max)
      problems.push({ field, code: 'too_long' });
  }
  return problems;
}

function uniqueSlug(
  context: Parameters<NonNullable<Route['handler']>>[0],
  slug: string,
  except?: string,
): void {
  if ([...context.db.blogPosts.values()].some((post) => post.slug === slug && post.id !== except)) {
    throw new ApiError(409, 'slug_taken', 'Slug นี้ถูกใช้แล้ว', {
      fields: [{ field: 'slug', code: 'taken' }],
    });
  }
}

export const blogRoutes: Route[] = [
  {
    method: 'DELETE',
    path: 'admin/blog/:id',
    handler: (c) => {
      requireRole(c, 'admin');
      const p = blogOr404(c, c.params.id);
      const body = c.body === undefined ? {} : readObject(c);
      rejectUnknownFields(body, ['expected_updated_at', 'expected_revision']);
      if ('expected_updated_at' in body && body.expected_updated_at !== p.updated_at)
        throw new ApiError(409, 'revision_conflict', 'บทความเปลี่ยนแปลงแล้ว');
      checkBlogRevision(body, p);
      c.db.blogPosts.delete(p.id);
      return ok({ id: p.id, deleted: true });
    },
  },
  {
    method: 'POST',
    path: 'admin/blog/:id/unpublish',
    handler: (c) => {
      const a = requireRole(c, 'admin');
      const p = blogOr404(c, c.params.id);
      if (c.body !== undefined) {
        const body = readObject(c);
        rejectUnknownFields(body, ['expected_revision']);
        checkBlogRevision(body, p);
      }
      p.revision = (p.revision ?? 1) + 1;
      p.status = 'draft';
      p.editor_id = a.id;
      p.updated_at = iso(c.clock.now());
      return ok(adminBlogView(p));
    },
  },

  {
    method: 'GET',
    path: 'blog',
    handler: (context) => {
      const problems = queryProblems(context.query, ['limit', 'cursor']);
      const posts = [...context.db.blogPosts.values()]
        .filter((post) => post.status === 'published')
        .sort(
          (a, b) =>
            (b.published_at ?? '').localeCompare(a.published_at ?? '') || a.id.localeCompare(b.id),
        );
      const page = paginate(posts, context.query, context.config, problems);
      return ok({ items: page.items.map(publicView), next_cursor: page.next_cursor });
    },
  },
  {
    method: 'GET',
    path: 'blog/:slug',
    handler: (context) => {
      const post = [...context.db.blogPosts.values()].find(
        (candidate) => candidate.slug === context.params.slug && candidate.status === 'published',
      );
      if (!post) throw notFound();
      return ok(detailView(post));
    },
  },
  {
    method: 'GET',
    path: 'admin/blog',
    handler: (context) => {
      requireRole(context, 'admin');
      const problems = queryProblems(context.query, ['limit', 'cursor']);
      const posts = [...context.db.blogPosts.values()].sort(
        (a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id),
      );
      const page = paginate(posts, context.query, context.config, problems);
      return ok({ items: page.items.map(adminBlogView), next_cursor: page.next_cursor });
    },
  },
  {
    method: 'POST',
    path: 'admin/blog',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const body = readObject(context);
      rejectUnknownFields(body, [
        'title',
        'slug',
        'cover_url',
        'excerpt',
        'content',
        'content_doc',
        'category',
        'expected_updated_at',
        'expected_revision',
      ]);
      const problems = validateText(
        body,
        ['title', 'content', 'category', 'cover_url', 'excerpt'],
        true,
      );
      if (typeof body.slug !== 'string' || !slugPattern.test(body.slug))
        problems.push({ field: 'slug', code: 'invalid' });
      if (problems.length) throw validationFailed(problems);
      const doc = richDocument(body.content_doc, 'content_doc');
      if (
        'category' in body &&
        (typeof body.category !== 'string' || !body.category.trim() || body.category.length > 40)
      )
        throw validationFailed([{ field: 'category', code: 'invalid' }]);
      const slug = body.slug as string;
      uniqueSlug(context, slug);
      const now = iso(context.clock.now());
      const post: BlogPostRecord = {
        id: nextId(context.db, 'blg'),
        slug,
        content_doc: doc,
        category: typeof body.category === 'string' ? body.category.trim() : 'บทความ',
        author_display_name: admin.display_name,
        title: (body.title as string).trim(),
        cover_url: typeof body.cover_url === 'string' ? body.cover_url : null,
        excerpt: typeof body.excerpt === 'string' ? body.excerpt : null,
        content: body.content as string,
        status: 'draft',
        author_id: admin.id,
        editor_id: admin.id,
        created_at: now,
        updated_at: now,
        published_at: null,
      };
      context.db.blogPosts.set(post.id, post);
      return created(adminBlogView(post));
    },
  },
  {
    method: 'PATCH',
    path: 'admin/blog/:id',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const post = blogOr404(context, context.params.id);
      const body = readObject(context);
      rejectUnknownFields(body, [
        'title',
        'slug',
        'cover_url',
        'excerpt',
        'content',
        'content_doc',
        'category',
        'expected_updated_at',
        'expected_revision',
      ]);
      const problems = validateText(body, ['title', 'content', 'category', 'cover_url', 'excerpt']);
      if ('slug' in body && (typeof body.slug !== 'string' || !slugPattern.test(body.slug)))
        problems.push({ field: 'slug', code: 'invalid' });
      if (problems.length) throw validationFailed(problems);
      checkBlogRevision(body, post);
      const doc = 'content_doc' in body ? richDocument(body.content_doc, 'content_doc') : undefined;
      if ('expected_updated_at' in body && body.expected_updated_at !== post.updated_at)
        throw new ApiError(409, 'revision_conflict', 'บทความเปลี่ยนแปลงแล้ว กรุณาโหลดล่าสุด');
      if (
        'category' in body &&
        (typeof body.category !== 'string' || !body.category.trim() || body.category.length > 40)
      )
        throw validationFailed([{ field: 'category', code: 'invalid' }]);
      if (typeof body.slug === 'string' && body.slug !== post.slug) {
        if (post.published_at !== null)
          throw new ApiError(409, 'invalid_state', 'บทความที่เผยแพร่แล้วเปลี่ยน Slug ไม่ได้');
        uniqueSlug(context, body.slug, post.id);
        post.slug = body.slug;
      }
      if ('title' in body) post.title = (body.title as string).trim();
      if ('cover_url' in body)
        post.cover_url = body.cover_url === null ? null : (body.cover_url as string);
      if ('excerpt' in body) post.excerpt = body.excerpt === null ? null : (body.excerpt as string);
      if ('content' in body) post.content = body.content as string;
      if (doc !== undefined) post.content_doc = doc;
      if ('category' in body) post.category = (body.category as string).trim();
      post.revision = (post.revision ?? 1) + 1;
      post.editor_id = admin.id;
      post.updated_at = iso(context.clock.now());
      return ok(adminBlogView(post));
    },
  },
  {
    method: 'GET',
    path: 'admin/blog/:id/preview',
    handler: (context) => {
      requireRole(context, 'admin');
      return ok(adminBlogView(blogOr404(context, context.params.id)));
    },
  },
  {
    method: 'POST',
    path: 'admin/blog/:id/publish',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const post = blogOr404(context, context.params.id);
      if (context.body !== undefined) {
        const body = readObject(context);
        rejectUnknownFields(body, ['expected_revision']);
        checkBlogRevision(body, post);
      }
      if (
        !post.title.trim() ||
        (!post.content.trim() && !JSON.stringify(post.content_doc ?? null).includes('\"image\"'))
      )
        throw validationFailed([
          ...(!post.title.trim() ? [{ field: 'title', code: 'required' as const }] : []),
          ...(!post.content.trim() &&
          !JSON.stringify(post.content_doc ?? null).includes('\"image\"')
            ? [{ field: 'content', code: 'required' as const }]
            : []),
        ]);
      if (post.status !== 'published') {
        post.revision = (post.revision ?? 1) + 1;
        post.status = 'published';
        post.published_at = iso(context.clock.now());
        post.editor_id = admin.id;
        post.updated_at = iso(context.clock.now());
      }
      return ok(adminBlogView(post));
    },
  },
];
