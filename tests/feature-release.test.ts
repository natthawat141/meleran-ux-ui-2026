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

test('environment resolution honors explicit values and fail-closes invalid values', () => {
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

test('feature metadata uses recognized statuses and scope labels', () => {
  for (const feature of Object.values(FEATURES)) {
    assert.ok(statuses.includes(feature.status), feature.status);
    assert.ok(feature.phase === 1 || feature.phase === 'later', String(feature.phase));
  }
  for (const key of Object.values(ROUTE_FEATURES)) assert.ok(Object.hasOwn(FEATURES, key), key);
  assert.equal(ROUTE_FEATURES['/learn/redeem'], 'accessCodes');
  assert.equal(ROUTE_FEATURES['/admin/access-codes'], 'accessCodes');
  assert.equal(ROUTE_FEATURES['/checkout/:courseId'], 'commerce');
  assert.equal(ROUTE_FEATURES['/learn/assignments'], 'assignments');
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

test('every concrete route has its own matching outer gate; only system fallbacks remain ungated', () => {
  const routes = getAppRoutes();
  const paths = routes.map(({ path }) => path);
  assert.equal(new Set(paths).size, paths.length, 'App route paths are unique');
  const fallbacks = routes.filter(({ path }) => path === '/403' || path === '*');
  assert.deepEqual(fallbacks.map(({ path }) => path).sort(), ['*', '/403']);
  const concrete = routes.filter(({ path }) => path !== '/403' && path !== '*');
  assert.deepEqual(concrete.map(({ path }) => path).sort(), Object.keys(ROUTE_FEATURES).sort());
  for (const { path, openingTag } of concrete) {
    const outerGate = /\belement=\{\s*featureElement\(\s*(['"])([^'"]+)\1\s*,/.exec(openingTag);
    assert.equal(outerGate?.[2], path, `${path} outer wrapper matches its route`);
  }
  for (const { path, openingTag } of fallbacks) {
    assert.doesNotMatch(openingTag, /\belement=\{\s*featureElement\(/, `${path} remains ungated`);
  }
});

test('feature summary and route inventory match the code registry', () => {
  const doc = fs.readFileSync(new URL('../docs/FEATURE_RELEASE_MATRIX.md', import.meta.url), 'utf8');
  const lines = doc.split(/\r?\n/);
  const header = lines.findIndex((line) => line.startsWith('| Feature key | Feature | Phase / scope |'));
  assert.notEqual(header, -1, 'feature summary table exists');
  const summaryRows: string[] = [];
  for (let index = header + 1; index < lines.length && lines[index].startsWith('|'); index += 1) {
    if (/^\| `[^`]+` \|/.test(lines[index])) summaryRows.push(lines[index]);
  }
  const summary = summaryRows.map((line) => {
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
    const key = /^`([^`]+)`$/.exec(cells[0] ?? '')?.[1];
    const phase = cells[2];
    const status = /^`(prototype|integration|released|disabled)`$/.exec(cells[6] ?? '')?.[1];
    assert.ok(key, `summary feature key: ${line}`);
    assert.ok(phase === '1' || phase === 'Later', `recognized scope label for ${key}`);
    assert.ok(status, `runtime status for ${key}`);
    return { key, phase, status };
  });
  assert.equal(new Set(summary.map(({ key }) => key)).size, summary.length, 'summary keys are unique');
  assert.deepEqual(summary.map(({ key }) => key).sort(), Object.keys(FEATURES).sort());
  for (const { key, phase, status } of summary) {
    const feature = FEATURES[key as keyof typeof FEATURES];
    assert.equal(phase, feature.phase === 'later' ? 'Later' : String(feature.phase), `${key} scope`);
    assert.equal(status, feature.status, `${key} runtime`);
  }

  const inventorySection = doc.split('## Route inventory จาก App.tsx')[1]?.split('## การอัปเดต')[0];
  assert.ok(inventorySection, 'route inventory section exists');
  const inventory = inventorySection.split(/\r?\n/).flatMap((line) => {
    const match = /^\|\s*`([^`]+)`\s*\|\s*(`([^`]+)`|—)\s*\|/.exec(line);
    return match ? [{ path: match[1], key: match[3] ?? '—' }] : [];
  });
  assert.equal(new Set(inventory.map(({ path }) => path)).size, inventory.length, 'documented paths are unique');
  assert.deepEqual(inventory.filter(({ key }) => key === '—'), [
    { path: '/403', key: '—' }, { path: '*', key: '—' },
  ]);
  assert.deepEqual(
    inventory.filter(({ key }) => key !== '—').map(({ path, key }) => `${path}=${key}`).sort(),
    Object.entries(ROUTE_FEATURES).map(([path, key]) => `${path}=${key}`).sort(),
  );
});
