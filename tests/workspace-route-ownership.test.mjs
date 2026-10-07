import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ROUTE_FEATURES } from '../src/config/features.ts';

const webRoutes = await readFile(new URL('../apps/web/src/App.tsx', import.meta.url), 'utf8');
const adminRoutes = await readFile(new URL('../apps/admin/src/App.tsx', import.meta.url), 'utf8');

function registeredFeaturePaths(source) {
  return [...source.matchAll(/featureElement\(['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function routePaths(source) {
  return [...source.matchAll(/<Route\s+path=['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

test('each app registers its feature routes against the release registry', () => {
  for (const appSource of [webRoutes, adminRoutes]) {
    for (const routePath of registeredFeaturePaths(appSource)) {
      assert.ok(ROUTE_FEATURES[routePath], `Feature route ${routePath} is missing from ROUTE_FEATURES`);
    }
  }
});

test('Web and Admin have distinct canonical route ownership', () => {
  const webPaths = routePaths(webRoutes);
  const adminPaths = routePaths(adminRoutes);
  assert.ok(webPaths.includes('/teach/courses/:courseId/settings'));
  assert.ok(!webPaths.some((routePath) => routePath === '/admin' || routePath.startsWith('/admin/')));
  assert.ok(adminPaths.includes('/admin/courses/:courseId/settings'));
  assert.ok(adminPaths.includes('/admin/courses/:courseId/preview'));
  assert.ok(adminPaths.includes('/teach/*'));
  assert.match(adminRoutes, /resolveAdminCompatibilityRoute\(location\.pathname, location\.search, location\.hash\)/);
  assert.ok(!adminPaths.includes('/teach/attempts/:attemptId/grade'));
  assert.ok(!adminPaths.includes('/teach/quizzes/:quizId/attempts'));
});
