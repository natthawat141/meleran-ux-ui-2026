import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('packages/ui provides formatters and helpers', async () => {
  const { formatPrice, flattenItems, createId } = await import('../packages/ui/src/lib/formatters.ts');

  assert.equal(typeof formatPrice, 'function');
  assert.equal(typeof flattenItems, 'function');
  assert.equal(typeof createId, 'function');

  assert.equal(formatPrice(0), 'เรียนฟรี');
  assert.equal(formatPrice(500), '฿500');
  assert.ok(createId('crs').startsWith('crs-'));
  assert.deepEqual(flattenItems({ chapters: [{ items: [{ id: '1', type: 'article', title: 'test' }] }] }), [
    { id: '1', type: 'article', title: 'test' },
  ]);
});

test('packages/ui index re-exports common widgets, chrome and formatters', async () => {
  const indexSource = await readFile('packages/ui/src/index.ts', 'utf8');

  const expectedExports = [
    'UserAvatar',
    'CourseCard',
    'CourseOutline',
    'DirectorySearch',
    'ImageUploadField',
    'SectionHeading',
    'NoAccessPage',
    'NotFoundPage',
    'AuthFrame',
    'LandingHeader',
    'LandingFooter',
    'PublicShell',
    'WorkspaceShell',
    'FeatureRoute',
    'featureElement',
    'blogCoverFor',
    'formatPrice',
    'flattenItems',
    'createId',
  ];

  for (const exp of expectedExports) {
    assert.ok(indexSource.includes(exp), `packages/ui/src/index.ts must export ${exp}`);
  }
});
