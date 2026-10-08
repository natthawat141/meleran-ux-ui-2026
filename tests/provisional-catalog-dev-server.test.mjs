import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatCatalogPrice, safeCatalogCoverUrl } from '../apps/web/src/features/courses/api/catalog-display.ts';
import { provisionalCatalogBasePath, startProvisionalDevServer } from '../tools/provisional-api/dev-server.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('formats draft money for the catalog cards and ignores unsafe cover URLs', () => {
  assert.equal(formatCatalogPrice(null), 'เรียนฟรี');
  assert.match(formatCatalogPrice({ amount_minor: 99000, currency: 'THB' }), /990/);
  assert.doesNotMatch(formatCatalogPrice({ amount_minor: 99000, currency: 'THB' }), /99,?000/);
  assert.equal(safeCatalogCoverUrl('https://images.example.test/cover.png'), 'https://images.example.test/cover.png');
  assert.equal(safeCatalogCoverUrl('javascript:alert(1)'), null);
  assert.equal(safeCatalogCoverUrl('https://images.example.test/a".png'), null);
});

test('the dev HTTP server publishes only the public catalog and hides private fields', async () => {
  const server = await startProvisionalDevServer(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}${provisionalCatalogBasePath}`;
    const list = await fetch(`${base}/courses`);
    assert.equal(list.status, 200);
    assert.equal(list.headers.get('x-melearn-mock'), 'provisional-api');
    const page = await list.json();
    assert.deepEqual(page.items.map((course) => course.id), ['crs_mock_003', 'crs_mock_002', 'crs_mock_001']);
    assert.equal(JSON.stringify(page).includes('SECRET'), false);

    const detail = await fetch(`${base}/courses/crs_mock_001`);
    const detailText = await detail.text();
    assert.equal(detail.status, 200);
    assert.equal(detailText.includes('SECRET'), false);
    assert.equal(detailText.includes('video_url'), false);
    assert.equal(detailText.includes('correct_option'), false);
    assert.match(detailText, /เช็กลิสต์ก่อนสร้างคอร์ส/);

    assert.equal((await fetch(`${base}/courses/mock-online-course-basics`)).status, 404);
    assert.equal((await fetch(`${base}/courses/crs_mock_draft`)).status, 404);
    const missing = await (await fetch(`${base}/courses/crs_mock_draft`)).json();
    assert.equal(missing.error.code, 'not_found');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('guest catalog dev pages read the HTTP API and production keeps the local catalog', () => {
  const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
  const catalog = read('apps/web/src/features/courses/pages/public/CatalogPage.tsx');
  const detail = read('apps/web/src/features/courses/pages/public/CourseDetailPage.tsx');
  assert.match(catalog, /import\.meta\.env\.DEV/);
  assert.match(catalog, /import\('\.\/DevCatalogPage\.tsx'\)/);
  assert.match(catalog, /function LocalPublicCatalogPage/);
  assert.match(detail, /import\('\.\/DevCourseDetailPage\.tsx'\)/);
  assert.match(detail, /function LocalCourseDetailPage/);
  for (const relative of [
    'apps/web/src/features/courses/pages/public/DevCatalogPage.tsx',
    'apps/web/src/features/courses/pages/public/DevCourseDetailPage.tsx',
    'apps/web/src/features/courses/hooks/use-dev-catalog.ts',
    'apps/web/src/features/courses/api/dev-catalog-client.ts',
  ]) {
    const source = read(relative);
    assert.doesNotMatch(source, /useLms|@legacy\/store|provisional-api|provisional-mock/);
  }
});
