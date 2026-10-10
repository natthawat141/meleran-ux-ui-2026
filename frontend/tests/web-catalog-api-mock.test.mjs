import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHttpClient, HttpClientError } from '@melearn/api-client';
import { createCatalogApi, getCourseByRouteKey } from '../apps/web/src/features/courses/api/catalog-api.ts';
import { decodeCourseDetail, decodeCoursePage } from '../apps/web/src/features/courses/api/catalog-provisional-contract.ts';
import { createProvisionalApi, mockRestrictedKeys, mockSecretMarkers, seedCourses as provisionalCatalogRecords } from '../tools/provisional-api/index.ts';

const basePath = '/mock-api/v1';
const createProvisionalCatalogFetcher = ({ environment, basePath: path }) => createProvisionalApi({ environment, basePath: path }).createFetcher();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publishedIds = ['crs_mock_003', 'crs_mock_002', 'crs_mock_001']; // newest first
const hiddenIds = ['crs_mock_draft', 'crs_mock_pending', 'crs_mock_approved'];

function setup(overrides = {}) {
  const calls = [];
  const mockFetcher = createProvisionalCatalogFetcher({ environment: 'test', basePath });
  const fetcher = overrides.fetcher ?? (async (url, init) => {
    calls.push(url);
    return mockFetcher(url, init);
  });
  const http = createHttpClient({ baseUrl: basePath, fetcher, headers: {}, credentials: 'omit', timeoutMs: null });
  return { api: createCatalogApi(http), calls, mockFetcher };
}

async function rawBody(url) {
  const response = await createProvisionalCatalogFetcher({ environment: 'test', basePath })(`${basePath}/${url}`);
  return { status: response.status, text: await response.text() };
}

const httpError = (status) => (error) => error instanceof HttpClientError && error.kind === 'http' && error.status === status;

test('lists only Published courses, newest first, in the provisional summary shape', async () => {
  const { api } = setup();
  const page = await api.listCourses();
  assert.deepEqual(page.items.map((item) => item.id), publishedIds);
  assert.equal(page.next_cursor, null);
  assert.equal(page.items[2].price, null);
  assert.deepEqual(page.items[1].price, { amount_minor: 99000, currency: 'THB' });
  assert.deepEqual(Object.keys(page.items[0]).sort(), [
    'category', 'cover_url', 'id', 'instructor', 'level', 'price', 'published_at', 'slug', 'subtitle', 'title',
  ]);
  for (const hidden of provisionalCatalogRecords.filter((record) => record.status !== 'published')) {
    assert.ok(!page.items.some((item) => item.id === hidden.id || item.title === hidden.title));
  }
});

test('returns Published course detail with outline titles only', async () => {
  const { api } = setup();
  const detail = await api.getCourse('crs_mock_001');
  assert.equal(detail.id, 'crs_mock_001');
  assert.equal(detail.description, 'คำอธิบายตัวอย่างสำหรับทดสอบหน้ารายละเอียดคอร์ส');
  assert.deepEqual(detail.outline[0].items.map((item) => item.type), ['video', 'article', 'quiz']);
  assert.deepEqual(Object.keys(detail.outline[0].items[0]).sort(), ['id', 'title', 'type']);
  assert.deepEqual((await api.getCourse('crs_mock_002')).outline[1], { id: 'chp_mock_002_2', title: 'บทว่าง (ยังไม่มีเนื้อหา)', items: [] });
});

test('resolves existing course slug routes through the public list without changing the id-only detail API', async () => {
  const { api, calls } = setup();
  const byId = await getCourseByRouteKey(api, 'crs_mock_001');
  assert.equal(byId.id, 'crs_mock_001');
  assert.deepEqual(calls, [`${basePath}/courses/crs_mock_001`]);

  calls.length = 0;
  const bySlug = await getCourseByRouteKey(api, 'mock-online-course-basics');
  assert.equal(bySlug.id, 'crs_mock_001');
  assert.deepEqual(calls, [
    `${basePath}/courses/mock-online-course-basics`,
    `${basePath}/courses?limit=50`,
    `${basePath}/courses/crs_mock_001`,
  ]);
});

test('never puts drafts, review notes, video links or answer keys in raw response bodies', async () => {
  const bodies = [await rawBody('courses'), await rawBody('courses?limit=1'), ...await Promise.all(publishedIds.map((id) => rawBody(`courses/${id}`)))];
  for (const { status, text } of bodies) {
    assert.equal(status, 200);
    for (const marker of mockSecretMarkers) assert.ok(!text.includes(marker), `body leaked ${marker}`);
    for (const key of mockRestrictedKeys) assert.ok(!text.includes(`"${key}":`), `body exposed ${key}`);
  }
  for (const id of hiddenIds) {
    const { status, text } = await rawBody(`courses/${id}`);
    assert.equal(status, 404);
    assert.ok(!text.includes('SECRET'));
  }
});

test('treats missing, draft, pending and approved-but-unpublished ids as the same not-found result', async () => {
  const { api } = setup();
  for (const id of ['crs_mock_missing', ...hiddenIds, 'crs%2Fwith-slash', 'mock-online-course-basics']) {
    assert.equal(await api.getCourse(id), null, id);
  }
  const bodies = [];
  for (const id of ['crs_mock_missing', ...hiddenIds]) {
    const { status, text } = await rawBody(`courses/${id}`);
    assert.equal(status, 404);
    bodies.push(JSON.parse(text).error);
  }
  for (const error of bodies) {
    assert.equal(error.code, 'not_found');
    assert.equal(error.message, bodies[0].message);
    assert.match(error.request_id, /^mock-request-\d+$/);
  }
  await assert.rejects(setup().api.getCourse(''), TypeError);
});

test('pages with opaque cursors without repeating or skipping Published courses', async () => {
  const { api } = setup();
  const seen = [];
  let cursor;
  for (let guard = 0; guard < 5; guard += 1) {
    const page = await api.listCourses({ limit: 2, cursor });
    seen.push(...page.items.map((item) => item.id));
    if (page.next_cursor === null) break;
    cursor = page.next_cursor;
  }
  assert.deepEqual(seen, publishedIds);
  assert.equal((await api.listCourses({ cursor: 'o:99' })).items.length, 0);
});

test('applies the provisional filters to Published courses only', async () => {
  const { api } = setup();
  const ids = async (query) => (await api.listCourses(query)).items.map((item) => item.id);
  assert.deepEqual(await ids({ priceType: 'free' }), ['crs_mock_001']);
  assert.deepEqual(await ids({ priceType: 'paid' }), ['crs_mock_003', 'crs_mock_002']);
  assert.deepEqual(await ids({ category: 'การสื่อสาร', level: 'กลาง' }), ['crs_mock_002']);
  assert.deepEqual(await ids({ q: 'ข้อมูล' }), ['crs_mock_003']);
  assert.deepEqual(await ids({ q: 'secret' }), []);
  assert.deepEqual(await ids({ category: 'SECRET category' }), []);
});

test('rejects parameters the draft does not specify instead of guessing', async () => {
  const { api } = setup();
  for (const query of [{ limit: 0 }, { limit: 51 }, { limit: 1.5 }, { cursor: 'bad' }, { priceType: 'discounted' }]) {
    await assert.rejects(api.listCourses(query), httpError(422), JSON.stringify(query));
  }
  const { status, text } = await rawBody('courses?sort=title&slug=x');
  assert.equal(status, 422);
  assert.deepEqual(JSON.parse(text).error.details.fields, [{ field: 'sort', code: 'unsupported' }, { field: 'slug', code: 'unsupported' }]);
});

test('can only be created for development and test, never production-like environments', () => {
  for (const environment of ['production', 'preview', 'staging', 'Production', '', undefined, null]) {
    assert.throws(() => createProvisionalCatalogFetcher({ environment, basePath }), /development or test/);
  }
  for (const environment of ['development', 'test']) {
    assert.equal(typeof createProvisionalCatalogFetcher({ environment, basePath }), 'function');
  }
});

test('surfaces real request failures instead of falling back to mock data', async () => {
  // createCatalogApi only knows the HttpClient it is given (see the source guard test below), so a failing
  // fetcher must reject every call with its transport error and never produce fixture data.
  const failures = [
    async () => { throw new TypeError('offline'); },
    async () => new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } }),
    async () => new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }),
    async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
  ];
  const kinds = ['network', 'http', 'http', 'non_json'];
  for (const [index, failing] of failures.entries()) {
    const { api } = setup({ fetcher: failing });
    await assert.rejects(api.listCourses(), (error) => error instanceof HttpClientError && error.kind === kinds[index]);
  }
  await assert.rejects(setup({ fetcher: failures[1] }).api.getCourse('crs_mock_001'), httpError(500));
  await assert.rejects(
    setup({ fetcher: failures[0] }).api.getCourse('crs_mock_001'),
    (error) => error instanceof HttpClientError && error.kind === 'network',
  );
  // Only HTTP 404 means "not found"; the same status on the list endpoint is still an error.
  assert.equal(await setup({ fetcher: failures[2] }).api.getCourse('crs_mock_001'), null);
});

test('rejects payloads outside the draft shape and drops unknown fields', async () => {
  const withBody = (value) => async () => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
  const summary = { id: 'a', slug: 'a', title: 'A', subtitle: null, cover_url: null, category: 'c', level: 'l', price: null,
    instructor: { id: 'i', display_name: 'I', avatar_url: null }, published_at: '2026-10-01T00:00:00Z' };

  const { api: ok } = setup({ fetcher: withBody({ items: [{ ...summary, internal_review_notes: 'x' }], next_cursor: null }) });
  assert.deepEqual((await ok.listCourses()).items[0], summary);

  const broken = [
    { items: [{ ...summary, title: '' }], next_cursor: null },
    { items: [{ ...summary, price: { amount_minor: 1.5, currency: 'THB' } }], next_cursor: null },
    { items: [{ ...summary, published_at: 'not a date' }], next_cursor: null },
    { items: [summary] },
    { items: 'nope', next_cursor: null },
  ];
  for (const value of broken) {
    await assert.rejects(setup({ fetcher: withBody(value) }).api.listCourses(), (error) => error instanceof HttpClientError && error.kind === 'invalid_payload');
  }
  assert.throws(() => decodeCoursePage(null));
  assert.throws(() => decodeCourseDetail({ ...summary, description: null, outcomes: [], outline: [{ id: 'c', title: 'C', items: [{ id: 'i', type: 'assignment', title: 'T' }] }] }));
});

test('honours cancellation and answers 405 for methods the catalog does not offer', async () => {
  const { api, mockFetcher } = setup();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.listCourses({}, { signal: controller.signal }), (error) => error instanceof HttpClientError && error.kind === 'aborted');
  for (const [method, url] of [['POST', 'courses'], ['DELETE', 'courses/crs_mock_001'], ['PUT', 'courses/crs_mock_001']]) {
    const response = await mockFetcher(`${basePath}/${url}`, { method, body: '{}' });
    assert.equal(response.status, 405, `${method} ${url}`);
    assert.equal((await response.json()).error.code, 'method_not_allowed');
  }
});

test('keeps the provisional mock out of app runtime code and the shared contracts package', () => {
  const apiDirectory = path.join(root, 'apps/web/src/features/courses/api');
  const source = (file) => readFileSync(path.join(apiDirectory, file), 'utf8');
  assert.ok(!/provisional-mock/.test(source('catalog-api.ts')), 'catalog-api must not import the mock');
  assert.ok(!/provisional-mock/.test(source('catalog-provisional-contract.ts')));

  const sourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [absolute] : [];
  });
  for (const directory of [path.join(root, 'apps/web/src'), path.join(root, 'apps/admin/src'), path.join(root, 'packages')]) {
    for (const file of sourceFiles(directory)) {
      if (file.includes(`${path.sep}node_modules${path.sep}`)) continue;
      assert.ok(!/provisional-mock|provisional-api/.test(readFileSync(file, 'utf8')), `${path.relative(root, file)} references the provisional mock`);
    }
  }
  const contractsSource = sourceFiles(path.join(root, 'packages/contracts/src')).map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.ok(/CourseSummary/.test(contractsSource) && /CourseDetail/.test(contractsSource), 'canonical DTOs are present in packages/contracts');
});
