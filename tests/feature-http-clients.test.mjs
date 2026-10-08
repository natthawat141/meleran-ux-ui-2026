import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transformWithEsbuild } from 'vite';
import { createWorld, accounts, mockPassword } from './support/provisional-api.mjs';
import { createHttpClient } from '../packages/api-client/src/http-client.ts';
import { HttpClientError } from '../packages/api-client/src/errors.ts';
import {
  authoringForm,
  authoringWrite,
  questionView,
} from '../packages/course-authoring/src/http-view.ts';
async function module(path, deps) {
  const url = new URL('../' + path, import.meta.url);
  const { code } = await transformWithEsbuild(await readFile(url, 'utf8'), url.pathname, {
    loader: 'ts',
    format: 'cjs',
  });
  const m = { exports: {} };
  vm.runInNewContext(code, {
    module: m,
    exports: m.exports,
    console,
    crypto,
    structuredClone,
    Set,
    Map,
    URLSearchParams,
    Error,
    TypeError,
    encodeURIComponent,
    require: (name) => {
      if (!(name in deps)) throw new Error('Missing test import ' + name);
      return deps[name];
    },
  });
  return m.exports;
}
async function harness(app, feature, filename, kind) {
  const w = createWorld();
  const fetcher = w.browser().fetcher;
  const apiClient = createHttpClient({
    baseUrl: '/mock-api/v1',
    fetcher,
    headers: { 'x-melearn-app': app },
    credentials: 'include',
    timeoutMs: 8000,
  });
  const login = await apiClient.request('auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      identifier: app === 'admin' ? accounts.admin : accounts.instructorA,
      password: mockPassword,
      audience: app,
    }),
    decoder: (x) => x,
  });
  const resources = await module('apps/' + app + '/src/shared/api/resources.ts', {
    './client': { apiClient },
    '@melearn/api-client': { HttpClientError },
  });
  const params = {};
  const search = new URLSearchParams();
  const cache = new Map();
  const q = {
    useQueryClient: () => ({ invalidateQueries: async () => cache.clear() }),
    useSuspenseQuery: ({ queryKey, queryFn }) => {
      const k = JSON.stringify(queryKey);
      if (cache.has(k)) return { data: cache.get(k) };
      throw queryFn({ signal: new AbortController().signal }).then((r) => cache.set(k, r));
    },
  };
  const deps = {
    '@tanstack/react-query': q,
    'react-router-dom': { useParams: () => params, useSearchParams: () => [search] },
    '../../auth/api/AuthSessionProvider': { useAuthSession: () => ({ user: login.user }) },
    '../../../shared/api/resources': resources,
    '@melearn/course-authoring': { authoringForm, authoringWrite, questionView },
  };
  if (filename === 'useManagedData')
    deps['./management-view'] = await module(
      'apps/' + app + '/src/features/' + feature + '/api/management-view.ts',
      { '@melearn/course-authoring': { questionView } },
    );
  const loaded = await module(
    'apps/' + app + '/src/features/' + feature + '/api/' + filename + '.ts',
    deps,
  );
  const render = async () => {
    for (let i = 0; i < 5; i++)
      try {
        return loaded[filename](kind);
      } catch (p) {
        if (!p?.then) throw p;
        await p;
      }
    throw new Error('Suspense did not settle');
  };
  return { w, params, search, render, resources, apiClient };
}
test('actual authoring feature client saves metadata/chapter/quiz to HTTP and returns server identities', async () => {
  const h = await harness('web', 'course-authoring', 'useAuthoringWorkspace');
  let ui = await h.render();
  const courseId = await ui.saveCourse({
    title: 'Client course',
    category: 'เรียนรู้',
    level: 'เริ่มต้น',
    price: 0,
  });
  h.params.courseId = courseId;
  ui = await h.render();
  assert.equal(ui.data.courses.find((c) => c.id === courseId).title, 'Client course');
  await ui.saveChapter(courseId, { title: 'Chapter' });
  ui = await h.render();
  const course = ui.data.courses.find((c) => c.id === courseId);
  const chapterId = course.chapters[0].id;
  const saved = await ui.saveQuiz(
    {
      courseId,
      chapterId,
      title: 'Quiz from client',
      passPercent: 70,
      questions: [
        {
          id: 'draft-q',
          type: 'choice',
          prompt: 'Question',
          points: 1,
          options: ['A', 'B'],
          answer: 1,
        },
      ],
    },
    undefined,
    course.revision,
  );
  assert.ok(saved.id);
  assert.notEqual(saved.quiz.questions[0].id, 'draft-q');
  ui = await h.render();
  assert.equal(ui.data.quizzes.find((q) => q.id === saved.id).questions[0].answer, 1);
  await assert.rejects(
    ui.saveCourse({ title: 'Stale', price: 0 }, courseId, 1),
    (e) => e.status === 409 && e.code === 'revision_conflict',
  );
  const still = (await h.resources.resource('courses/' + courseId + '/authoring')).title;
  assert.equal(still, 'Client course');
  assert.deepEqual(h.w.api.unexpectedErrors, []);
});
test('actual Admin Blog client saves rich content/publish to HTTP and reads the same persisted post', async () => {
  const h = await harness('admin', 'blog', 'useBlogEditor');
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Rich content', marks: [{ type: 'bold' }] }],
      },
    ],
  };
  let ui = await h.render();
  const saved = await ui.saveBlogPost({
    title: 'Client article',
    excerpt: 'Intro',
    category: 'Learning',
    body: 'Rich content',
    bodyDoc: doc,
    status: 'published',
  });
  h.params.id = saved.id;
  ui = await h.render();
  const post = ui.data.blogPosts.find((p) => p.id === saved.id);
  assert.deepEqual(post.bodyDoc, doc);
  assert.equal(post.status, 'published');
  const wire = await h.resources.resource('blog/' + post.slug);
  assert.deepEqual(wire.content_doc, doc);
  assert.equal(wire.category, 'Learning');
  await ui.saveBlogPost({ ...post, status: 'draft' }, post.id, saved.revision);
  ui = await h.render();
  assert.equal(ui.data.blogPosts.find((p) => p.id === post.id).status, 'draft');
  assert.deepEqual(h.w.api.unexpectedErrors, []);
});
test('actual Admin management client reads account roles/profile and adds instructor without replacing learner', async () => {
  const h = await harness('admin', 'management', 'useManagedData', 'users');
  let ui = await h.render();
  const learner = ui.data.users.find((u) => u.role === 'learner' && u.status === 'active');
  assert.ok(learner);
  assert.equal((await ui.assignInstructorRole(learner.id)).ok, true);
  ui = await h.render();
  const updated = ui.data.users.find((u) => u.id === learner.id);
  assert.ok(updated.roles.includes('learner') && updated.roles.includes('instructor'));
  assert.equal(updated.role, 'instructor');
  assert.deepEqual(h.w.api.unexpectedErrors, []);
});
