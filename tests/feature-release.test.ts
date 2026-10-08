import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ROUTE_FEATURES, FEATURES, getFeatureEnvironment, isFeatureEnabled } from '../packages/contracts/src/features.ts';
import { readAppRouteInventory } from '../scripts/lib/app-route-inventory.mjs';

const statuses = ['prototype', 'integration', 'released', 'disabled'] as const;
const environments = ['development', 'preview', 'staging', 'production'] as const;

test('feature status access matrix is exhaustive across environments', () => {
  const expected: Record<(typeof statuses)[number], Record<(typeof environments)[number], boolean>> = {
    prototype: { development: true, preview: true, staging: false, production: false },
    integration: { development: true, preview: true, staging: true, production: false },
    released: { development: true, preview: true, staging: true, production: true },
    disabled: { development: false, preview: false, staging: false, production: false },
  };
  for (const status of statuses) {
    for (const environment of environments) {
      assert.equal(isFeatureEnabled(status, environment), expected[status][environment], `${status} in ${environment}`);
    }
  }
});

test('environment resolution honors exact explicit values and fail-closes invalid values', () => {
  for (const environment of environments) {
    assert.equal(getFeatureEnvironment({ mode: 'production', dev: false, appEnvironment: environment }), environment);
  }
  for (const invalid of ['', 'Production', 'prod', 'preview ', 'unknown']) {
    assert.equal(getFeatureEnvironment({ mode: 'development', dev: true, appEnvironment: invalid }), 'production', invalid);
  }
  assert.equal(getFeatureEnvironment({ mode: 'development', dev: true }), 'development');
  assert.equal(getFeatureEnvironment({ mode: 'preview', dev: false }), 'preview');
  assert.equal(getFeatureEnvironment({ mode: 'staging', dev: false }), 'staging');
  assert.equal(getFeatureEnvironment({ mode: 'production', dev: false }), 'production');
  assert.equal(getFeatureEnvironment({ mode: 'unknown', dev: false }), 'production');
});

test('feature metadata uses recognized statuses, positive phases, and known route keys', () => {
  assert.ok(Object.keys(FEATURES).length > 0);
  for (const feature of Object.values(FEATURES)) {
    assert.ok(statuses.includes(feature.status), feature.status);
    assert.ok(Number.isInteger(feature.phase) && feature.phase > 0, String(feature.phase));
  }
  for (const featureKey of Object.values(ROUTE_FEATURES)) assert.ok(Object.hasOwn(FEATURES, featureKey), featureKey);
  assert.equal(ROUTE_FEATURES['/admin/instructors'], 'operations');
  for (const legacyKey of ['commerce', 'analytics', 'finance', 'inbox', 'instructorOnboarding']) {
    assert.equal(Object.hasOwn(FEATURES, legacyKey), false, `${legacyKey} is not an active V1 feature`);
  }
});

test('retained Stripe, Redeem, and instructor roster routes use their owning prototype features', () => {
  const retainedRouteOwners = [
    ['/checkout/:courseId', 'payments'],
    ['/checkout/:orderId/result', 'payments'],
    ['/learn/redeem', 'redeem'],
    ['/admin/access-codes', 'redeem'],
    ['/teach/courses/:courseId/learners', 'instructorCourses'],
    ['/teach/learners', 'instructorCourses'],
  ] as const satisfies readonly (readonly [keyof typeof ROUTE_FEATURES, keyof typeof FEATURES])[];

  for (const [path, featureKey] of retainedRouteOwners) {
    assert.equal(ROUTE_FEATURES[path], featureKey, `${path} belongs to ${featureKey}`);
    assert.equal(FEATURES[featureKey].status, 'prototype', `${featureKey} remains prototype`);
  }
});

type AppName = 'web' | 'admin';
type AppRoute = { path: string; featurePath: string | null; element: string; file: string };

function getAppRoutes(): AppRoute[] {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  return (['web', 'admin'] satisfies AppName[]).flatMap((appName) =>
    readAppRouteInventory(root, appName),
  );
}

test('Web and Admin routes have unique paths per app and registered feature wrappers', () => {
  const routes = getAppRoutes();
  const routeOwners: AppName[] = ['web', 'admin'];
  for (const owner of routeOwners) {
    const ownedRoutes = routes.filter(({ file }) => file.includes(`${path.sep}apps${path.sep}${owner}${path.sep}`));
    const paths = ownedRoutes.map(({ path: routePath }) => routePath);
    assert.ok(paths.length > 0, `${owner} has composed routes`);
    assert.equal(new Set(paths).size, paths.length, `${owner} route paths are unique`);

    const systemFallbacks = ownedRoutes.filter(({ path: routePath }) => routePath === '/403' || routePath === '*');
    assert.deepEqual(systemFallbacks.map(({ path: routePath }) => routePath).sort(), ['*', '/403'], `${owner} keeps both system fallbacks`);
    for (const { path: routePath, featurePath } of ownedRoutes) {
      if (featurePath) assert.ok(Object.hasOwn(ROUTE_FEATURES, featurePath), `${owner} ${routePath} feature ${featurePath} is registered`);
    }
  }

  const registeredFeaturePaths = [...new Set(routes.flatMap(({ featurePath }) => featurePath ? [featurePath] : []))].sort();
  assert.deepEqual(registeredFeaturePaths, Object.keys(ROUTE_FEATURES).sort(), 'composed Web/Admin modules cover the release registry');
});

test('feature summary and full route inventory match the code registry', () => {
  const document = fs.readFileSync(new URL('../docs/FEATURE_RELEASE_MATRIX.md', import.meta.url), 'utf8');
  const documentLines = document.split(/\r?\n/);
  const summaryHeaderIndex = documentLines.findIndex((line) => line.startsWith('| Feature key | Feature | Phase (เสนอ) |'));
  assert.notEqual(summaryHeaderIndex, -1, 'feature summary table exists');
  const summaryLines: string[] = [];
  for (let index = summaryHeaderIndex + 1; index < documentLines.length && documentLines[index].startsWith('|'); index += 1) {
    if (/^\| `[^`]+` \|/.test(documentLines[index])) summaryLines.push(documentLines[index]);
  }
  const summary = summaryLines.map((line) => {
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
    const key = /^`([^`]+)`$/.exec(cells[0] ?? '')?.[1];
    const phase = Number(cells[2]);
    const status = /^`(prototype|integration|released|disabled)`$/.exec(cells[6] ?? '')?.[1];
    assert.ok(key, `feature summary key: ${line}`);
    assert.ok(Number.isInteger(phase) && phase > 0, `positive integer phase for ${key}`);
    assert.ok(status, `recognized runtime status for ${key}`);
    return { key, name: cells[1] ?? '', phase, status };
  });
  assert.equal(new Set(summary.map(({ key }) => key)).size, summary.length, 'feature summary keys are unique');
  assert.deepEqual(summary.map(({ key }) => key).sort(), Object.keys(FEATURES).sort());
  const summaryNames = new Map(summary.map(({ key, name }) => [key, name]));
  assert.match(summaryNames.get('payments') ?? '', /Stripe|ชำระเงิน/i, 'payments summary describes Stripe checkout');
  assert.match(summaryNames.get('redeem') ?? '', /Redeem|รหัสแลก/i, 'redeem summary describes code redemption');
  assert.match(summaryNames.get('instructorCourses') ?? '', /รายชื่อผู้เรียน|ผู้เรียน/i, 'instructorCourses summary includes the learner roster');
  for (const { key, phase, status } of summary) {
    assert.equal(phase, FEATURES[key as keyof typeof FEATURES].phase, `${key} proposed phase`);
    assert.equal(status, FEATURES[key as keyof typeof FEATURES].status, `${key} runtime status`);
  }

  const inventorySection = document.split('## Inventory baseline จาก App.tsx ก่อน split')[1]?.split('## วิธีเปลี่ยนสถานะและตรวจรับ')[0];
  assert.ok(inventorySection, 'route inventory section exists');
  const inventory = inventorySection.split(/\r?\n/).flatMap((line) => {
    const match = /^\|\s*`([^`]+)`\s*\|\s*(`([^`]+)`|—)\s*\|/.exec(line);
    return match ? [{ path: match[1], featureKey: match[3] ?? '—' }] : [];
  });
  assert.equal(new Set(inventory.map(({ path }) => path)).size, inventory.length, 'documented inventory paths are unique');
  const systemFallbacks = inventory.filter(({ featureKey }) => featureKey === '—');
  assert.deepEqual(systemFallbacks, [
    { path: '/403', featureKey: '—' },
    { path: '*', featureKey: '—' },
  ]);
  assert.deepEqual(
    inventory.filter(({ featureKey }) => featureKey !== '—')
      .map(({ path, featureKey }) => `${path}=${featureKey}`).sort(),
    Object.entries(ROUTE_FEATURES).map(([path, featureKey]) => `${path}=${featureKey}`).sort(),
  );
});

test('retired V1 capabilities have no route or runtime entrypoint', () => {
  const paths = new Set(getAppRoutes().map(({ path }) => path));
  const retired = [
    '/courses/:slug/preview', '/become-instructor', '/invite/:token',
    '/learn/assignments', '/learn/inbox', '/account/cart', '/account/orders', '/account/orders/:orderId',
    '/teach/finance', '/teach/analytics', '/teach/courses/:courseId/analytics',
    '/teach/courses/:courseId/analytics/learners/:learnerId', '/teach/assignments', '/teach/inbox',
    '/admin/business-analytics', '/admin/finance', '/admin/reports/finance', '/admin/analytics',
    '/admin/analytics/courses/:courseId', '/admin/analytics/courses/:courseId/learners/:learnerId',
    '/admin/assignments', '/admin/inbox', '/admin/instructors/:id', '/admin/orders', '/admin/orders/:orderId',
    '/admin/certificates', '/admin/certificates/:certificateId', '/certificates/verify/:code',
  ];
  for (const path of retired) {
    assert.equal(paths.has(path), false, `${path} has no page`);
    assert.equal(Object.hasOwn(ROUTE_FEATURES, path), false, `${path} has no runtime gate`);
  }
});
