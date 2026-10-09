import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transformWithEsbuild } from 'vite';
import { createWorld, accounts, mockPassword } from './support/provisional-api.mjs';
import { createHttpClient } from '../packages/api-client/src/http-client.ts';
import { decodeManagementResponse } from '../packages/contracts/src/management-decoders.ts';
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
    '@melearn/contracts': { decodeManagementResponse },
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


test('actual learning/payment adapters retain canonical course and entitlement fields', async () => {
  const world = createWorld(), browser = world.browser();
  await browser.login(accounts.learner);
  await browser.post('courses/crs_mock_001/enroll');
  const apiClient = createHttpClient({baseUrl:'/mock-api/v1',fetcher:browser.fetcher,credentials:'include',timeoutMs:8000,headers:{}});
  const {decodeEnrollmentDto} = await import('../packages/contracts/src/enrollment-decoder.ts');
  const catalog = await module('apps/web/src/features/courses/api/catalog-provisional-contract.ts',{});
  const paidSummary = (await browser.get('courses/crs_mock_002')).body;
  assert.throws(()=>catalog.decodeCourseSummary({...paidSummary,price:{amount_minor:100,currency:'USD'}}),/catalog contract/);
  assert.throws(()=>catalog.decodeCourseSummary({...paidSummary,price:{amount_minor:0.5,currency:'THB'}}),/catalog contract/);
  const learning = await module('apps/web/src/features/learning/api/learning-api.ts',{
    '../../../shared/api/client':{apiClient},'@melearn/contracts':{decodeEnrollmentDto},
    '../../courses/api/catalog-provisional-contract.ts':catalog,
  });
  const enrollments = await learning.learningApi.myEnrollments();
  assert.ok(enrollments.some(row => row.course.slug && row.enrollment.access==='lifetime' && row.enrollment.granted_at));
  const course = await learning.learningApi.course('crs_mock_001');
  assert.equal(course.access.enrollment.source,'free');
  assert.equal(course.access.enrollment.access,'lifetime');
  assert.ok(course.slug);assert.equal(course.price,null);
  const payment = await module('apps/web/src/features/payment/api/payment-api.ts',{
    '../../../shared/api/client':{apiClient,apiConfig:{mock:true}},'@melearn/contracts':{decodeEnrollmentDto},
  });
  const checkout = await payment.paymentApi.checkout('crs_mock_002','contract-client-test');
  assert.equal(checkout.already_enrolled,false);
  const repeated = await payment.paymentApi.checkout('crs_mock_002','contract-client-test');
  assert.equal(repeated.payment_id,checkout.payment_id);
  const event = world.api.stripe.completed(checkout.payment_id,{eventId:'contract-adapter-event'});
  assert.equal((await browser.post('webhooks/stripe',event.body,event.headers)).status,200);
  const paid = await payment.paymentApi.status(checkout.payment_id);
  assert.equal(paid.enrollment.access,'lifetime');assert.equal(paid.enrollment.source,'stripe');
  assert.ok(paid.enrollment.granted_at);
  const enrolled = await payment.paymentApi.checkout('crs_mock_002','already-enrolled-client-test');
  assert.equal(enrolled.already_enrolled,true);
  assert.deepEqual(enrolled.enrollment,paid.enrollment);
  assert.equal(enrolled.course_id,paid.course_id);
  const admin=world.browser(); await admin.login(accounts.admin,{audience:'admin'});
  const adminHttp=createHttpClient({baseUrl:'/mock-api/v1',fetcher:admin.fetcher,credentials:'include',timeoutMs:8000,headers:{}});
  const {adminPaymentApi}=await module('apps/admin/src/features/payment/api/admin-payment-api.ts',{
    '../../../shared/api/client':{apiClient:adminHttp},'@melearn/contracts':{decodeEnrollmentDto},
  });
  const adminPayment=await adminPaymentApi.get(checkout.payment_id);
  assert.equal(adminPayment.amount.currency,'THB');
  const invalidAdmin=await module('apps/admin/src/features/payment/api/admin-payment-api.ts',{
    '../../../shared/api/client':{apiClient:{request:async (_path,options)=>options.decoder({...adminPayment,amount:{...adminPayment.amount,currency:'USD'}})}},
    '@melearn/contracts':{decodeEnrollmentDto},
  });
  await assert.rejects(invalidAdmin.adminPaymentApi.get(checkout.payment_id),/Invalid Admin payment currency/);
});

test('actual checkout decoder rejects incomplete or contradictory enrollment and checkout branches', async () => {
  let fixture;
  const {decodeEnrollmentDto} = await import('../packages/contracts/src/enrollment-decoder.ts');
  const {paymentApi} = await module('apps/web/src/features/payment/api/payment-api.ts',{
    '../../../shared/api/client':{apiClient:{request:async (_path,options)=>options.decoder(fixture)},apiConfig:{mock:true}},
    '@melearn/contracts':{decodeEnrollmentDto},
  });
  const enrollment={id:'enr_1',course_id:'crs_1',source:'free',access:'lifetime',granted_at:'2026-10-09T00:00:00.000Z'};
  for(const invalid of [
    {already_enrolled:true,course_id:'crs_1'},
    {already_enrolled:true,course_id:'crs_1',enrollment:null},
    {already_enrolled:true,course_id:'crs_1',enrollment:{...enrollment,course_id:'crs_other'}},
    {already_enrolled:true,course_id:'crs_1',enrollment:{...enrollment,source:'client-granted'}},
    {already_enrolled:true,course_id:'crs_1',enrollment:{...enrollment,granted_at:'invalid'}},
    {payment_id:'pay_1',checkout_url:'https://checkout.stripe.invalid/1'},
    {already_enrolled:'false',payment_id:'pay_1',checkout_url:'https://checkout.stripe.invalid/1'},
    {already_enrolled:false,checkout_url:'https://checkout.stripe.invalid/1'},
  ]) {
    fixture=invalid;
    await assert.rejects(paymentApi.checkout('crs_1','decoder-regression'),/Invalid/);
  }
  fixture={already_enrolled:true,course_id:'crs_1',enrollment};
  assert.equal((await paymentApi.checkout('crs_1','decoder-regression')).enrollment.id,'enr_1');
});
