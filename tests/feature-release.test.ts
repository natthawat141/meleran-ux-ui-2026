import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROUTE_FEATURES, FEATURES, getFeatureEnvironment, isFeatureEnabled } from '../src/config/features.ts';

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
  assert.equal(ROUTE_FEATURES['/invite/:token'], 'instructorOnboarding');
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

type AppRoute = { path: string; openingTag: string };

function getAppRoutes(): AppRoute[] {
  const source = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const routes: AppRoute[] = [];
  let cursor = 0;
  while ((cursor = source.indexOf('<Route', cursor)) >= 0) {
    if (/[A-Za-z]/.test(source[cursor + 6] ?? '')) { cursor += 6; continue; }
    const routeStart = cursor;
    let braceDepth = 0;
    let quote = '';
    let escaped = false;
    let tagEnd = -1;
    for (let index = routeStart; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
      if (char === '{') braceDepth += 1;
      else if (char === '}') braceDepth -= 1;
      else if (char === '>' && braceDepth === 0) { tagEnd = index + 1; break; }
    }
    assert.notEqual(tagEnd, -1, 'Route opening tag is complete');
    const openingTag = source.slice(routeStart, tagEnd);
    const path = /\bpath="([^"]+)"/.exec(openingTag)?.[1];
    assert.ok(path, `route path in ${openingTag.slice(0, 100)}`);
    routes.push({ path, openingTag });
    cursor = tagEnd;
  }
  return routes;
}

test('each App route has a unique path and its own matching outer feature wrapper', () => {
  const routes = getAppRoutes();
  const paths = routes.map(({ path }) => path);
  assert.equal(new Set(paths).size, paths.length, 'App route paths are unique');

  const systemFallbacks = routes.filter(({ path }) => path === '/403' || path === '*');
  assert.deepEqual(systemFallbacks.map(({ path }) => path).sort(), ['*', '/403']);
  const concreteRoutes = routes.filter(({ path }) => path !== '/403' && path !== '*');
  assert.deepEqual(concreteRoutes.map(({ path }) => path).sort(), Object.keys(ROUTE_FEATURES).sort());

  for (const { path, openingTag } of concreteRoutes) {
    const wrapper = /\belement=\{\s*featureElement\(\s*(['"])([^'"]+)\1\s*,/.exec(openingTag);
    assert.equal(wrapper?.[2], path, `${path} has a matching outer featureElement in its Route opening tag`);
  }
  for (const { path, openingTag } of systemFallbacks) {
    assert.doesNotMatch(openingTag, /\belement=\{\s*featureElement\(/, `${path} remains an ungated system route`);
  }
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

  const inventorySection = document.split('## Inventory จาก App.tsx')[1]?.split('## วิธีเปลี่ยนสถานะและตรวจรับ')[0];
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
