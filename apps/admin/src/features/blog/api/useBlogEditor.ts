import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useAuthSession } from '../../auth/api/AuthSessionProvider';
import { resource, resourceList } from '../../../shared/api/resources';
import type { AdminBlogDto, BlogPost, BlogWriteRequest } from '@melearn/contracts';
import type { JSONContent } from '@tiptap/react';
function formView(p: AdminBlogDto): BlogPost & { bodyDoc?: JSONContent; slug: string; revision: number } {
  return {
    id: p.id,
    revision: p.revision,
    slug: p.slug,
    title: p.title,
    category: p.category,
    cover: p.cover_url ?? undefined,
    coverKey: 'writing',
    excerpt: p.excerpt ?? '',
    body: p.content,
    bodyDoc: (p.content_doc as JSONContent) ?? undefined,
    authorId: p.author_id,
    status: p.status,
    readingMinutes: p.reading_minutes,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    publishedAt: p.published_at,
  };
}
export function useBlogEditor() {
  const { user } = useAuthSession();
  const { id } = useParams();
  const cache = useQueryClient();
  const { data: r } = useSuspenseQuery({
    queryKey: ['blog-admin', user?.id, id],
    queryFn: async ({ signal }) => {
      const list = await resourceList<AdminBlogDto>('admin/blog', signal);
      const selected =
        id && id !== 'new'
          ? await resource<AdminBlogDto>(
              'admin/blog/' + encodeURIComponent(id) + '/preview',
              'GET',
              undefined,
              signal,
            )
          : null;
      return { list, selected };
    },
  });
  const posts = r.list.map((p) => formView(r.selected?.id === p.id ? r.selected : p));
  const currentUser = user ? { id: user.id, name: user.display_name, role: 'admin' as const } : null;
  const data = {
    blogPosts: posts,
    users: r.list.map((p) => ({
      id: p.author.id,
      name: p.author.display_name,
      role: 'admin' as const,
      email: '',
    })),
  };
  const invalidate = () =>
    cache.invalidateQueries({
      predicate: (q) => ['blog-admin', 'public-blog', 'public-blog-detail'].includes(String(q.queryKey[0])),
    });
  return {
    data,
    currentUser,
    async saveBlogPost(values: Partial<BlogPost>, postId?: string, revision?: number) {
      const old = r.list.find((p) => p.id === postId);
      const body: BlogWriteRequest = {
        title: values.title ?? '',
        slug: old?.slug ?? 'article-' + crypto.randomUUID(),
        category: values.category ?? '',
        cover_url: values.cover ?? null,
        excerpt: values.excerpt ?? null,
        content: values.body ?? '',
        content_doc: (values.bodyDoc ?? null) as BlogWriteRequest['content_doc'],
        ...(old ? { expected_revision: revision ?? old.revision } : {}),
      };
      const saved = await resource<AdminBlogDto>(
        old ? 'admin/blog/' + encodeURIComponent(old.id) : 'admin/blog',
        old ? 'PATCH' : 'POST',
        body,
      );
      let confirmed = saved;
      if (values.status !== saved.status)
        confirmed = await resource<AdminBlogDto>(
          'admin/blog/' +
            encodeURIComponent(saved.id) +
            (values.status === 'published' ? '/publish' : '/unpublish'),
          'POST',
          { expected_revision: saved.revision },
        );
      await invalidate();
      return { id: confirmed.id, revision: confirmed.revision };
    },
    async removeBlogPost(postId: string) {
      const p = r.list.find((p) => p.id === postId);
      await resource('admin/blog/' + encodeURIComponent(postId), 'DELETE', {
        expected_revision: p?.revision,
      });
      await invalidate();
    },
  };
}
