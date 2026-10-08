import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithEsbuild } from 'vite';
import { createHttpClient } from '../packages/api-client/src/http-client.ts';
import { createWorld, accounts } from './support/provisional-api.mjs';

async function loadBlog(fetcher) {
  const url = new URL('../apps/web/src/features/blog/api/blog-api.ts', import.meta.url);
  const { code } = await transformWithEsbuild(await readFile(url, 'utf8'), url.pathname, { loader: 'ts', format: 'cjs' });
  const module = { exports: {} };
  const apiClient = createHttpClient({ baseUrl: '/mock-api/v1', fetcher, headers: {}, credentials: 'include', timeoutMs: null });
  vm.runInNewContext(code, { module, exports: module.exports, Set, TypeError, encodeURIComponent,
    require: (name) => { assert.equal(name, '../../../shared/api/client'); return { apiClient }; } });
  return module.exports;
}

test('public blog reads all API pages, resolves stable IDs to slugs, and never exposes drafts', async () => {
  const world = createWorld();
  const template = world.db.blogPosts.get('blg_mock_001');
  for (let index = 0; index < 53; index++) world.db.blogPosts.set(`extra-${index}`, {
    ...template, id: `extra-${index}`, slug: `extra-post-${index}`,
  });
  const { blogApi } = await loadBlog(world.browser().fetcher);
  const posts = await blogApi.list();
  assert.equal(posts.length, 55);
  assert.equal(new Set(posts.map((post) => post.id)).size, 55);
  assert.equal(posts.some((post) => post.id === 'blg_mock_draft'), false);
  const summary = posts.find((post) => post.id === 'blg_mock_001');
  const article = await blogApi.detail(summary.slug);
  assert.equal(article.id, summary.id);
  assert.equal(article.content, template.content);
  await assert.rejects(blogApi.detail('mock-secret-draft-post'), (error) => error.status === 404);
  const admin = world.browser(); await admin.login(accounts.admin, { audience: 'admin' });
  assert.equal((await admin.post('admin/blog/blg_mock_draft/publish', {})).status, 200);
  assert.equal((await blogApi.list()).length, 56);
});

test('public blog fails on invalid payloads or repeated cursors rather than silently falling back', async () => {
  const client = await loadBlog(async () => Response.json({ items: [], next_cursor: 'same' }));
  await assert.rejects(client.blogApi.list(), /Repeated/);
  assert.throws(() => client.decodeBlogDetail({ id: '1', slug: 'one', title: 'One', cover_url: null, excerpt: null, published_at: null }), /Invalid/);
  const invalid = await loadBlog(async () => Response.json({ items: [], next_cursor: 5 }));
  await assert.rejects(invalid.blogApi.list(), (error) => error.kind === 'invalid_payload');
});
