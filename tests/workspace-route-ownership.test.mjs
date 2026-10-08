import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ROUTE_FEATURES } from '../src/config/features.ts';
import { readAppRouteInventory } from '../scripts/lib/app-route-inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoutes = readAppRouteInventory(root, 'web');
const adminRoutes = readAppRouteInventory(root, 'admin');
// Fixed R3b checkpoint declarations; this records the migration behavior, not a generated current expectation.
const baseline = JSON.parse(await readFile(new URL('./fixtures/r3c-routes.json', import.meta.url), 'utf8'));
const approvedElementMigrations = {
  web: [
    {
      path: '/teach/courses/:courseId',
      from: "featureElement('/teach/courses/:courseId', instructor(<InstructorCourseOverviewPage />))",
      to: "featureElement('/teach/courses/:courseId', instructor(<CourseOverviewPage />))",
      reason: 'R6 gives Web its own course overview page',
    },
    {
      path: '/teach/courses/new',
      from: "featureElement('/teach/courses/new', instructor(<CourseEditorPage />))",
      to: "featureElement('/teach/courses/new', instructor(<InstructorCourseEditorPage />))",
      reason: 'R6 gives Web its own Instructor course editor host',
    },
    {
      path: '/teach/courses/:courseId/settings',
      from: "featureElement('/teach/courses/:courseId/settings', instructor(<CourseEditorPage />))",
      to: "featureElement('/teach/courses/:courseId/settings', instructor(<InstructorCourseEditorPage />))",
      reason: 'R6 gives Web its own Instructor course editor host',
    },
  ],
  admin: [
    {
      path: '/articles/:id',
      from: '<BlogArticlePage />',
      to: '<BlogArticlePreviewPage />',
      reason: 'R5 gives Admin its own article preview page',
    },
    {
      path: '/admin/courses/new',
      from: "featureElement('/teach/courses/new', admin(<CourseEditorPage />))",
      to: "featureElement('/teach/courses/new', admin(<AdminCourseEditorPage />))",
      reason: 'R6 gives Admin its own course editor host',
    },
    {
      path: '/admin/courses/:courseId/settings',
      from: "featureElement('/teach/courses/:courseId/settings', admin(<CourseEditorPage />))",
      to: "featureElement('/teach/courses/:courseId/settings', admin(<AdminCourseEditorPage />))",
      reason: 'R6 gives Admin its own course editor host',
    },
    {
      path: '/admin/courses/:courseId/overview',
      from: "featureElement('/teach/courses/:courseId', admin(<InstructorCourseOverviewPage />))",
      to: "featureElement('/teach/courses/:courseId', admin(<CourseOverviewPage />))",
      reason: 'R6 gives Admin its own course overview page',
    },
  ],
};

test('composed modules preserve the R3b route inventory and record intentional element migrations', () => {
  for (const [appName, routes] of [['web', webRoutes], ['admin', adminRoutes]]) {
    const actual = routes.map(({ file, ...route }) => route);
    const expected = baseline[appName].map((route) => ({ ...route }));
    for (const migration of approvedElementMigrations[appName] ?? []) {
      const previous = expected.find((route) => route.path === migration.path);
      const current = actual.find((route) => route.path === migration.path);
      assert.equal(previous?.element, migration.from, `${appName} ${migration.path} baseline matches: ${migration.reason}`);
      assert.equal(current?.element, migration.to, `${appName} ${migration.path} uses reviewed component: ${migration.reason}`);
      previous.element = migration.to;
    }
    assert.deepEqual(actual, expected, appName);
    assert.equal(new Set(routes.map((route) => route.path)).size, routes.length, `${appName} has unique paths`);
    assert.ok(routes.every((route) => route.file.includes(`${path.sep}app${path.sep}router${path.sep}`)), `${appName} declarations belong to router modules`);
  }
});

test('each app registers its feature routes against the release registry', () => {
  for (const routes of [webRoutes, adminRoutes]) {
    for (const route of routes.filter((entry) => entry.featurePath)) {
      assert.ok(ROUTE_FEATURES[route.featurePath], `Feature route ${route.featurePath} is missing from ROUTE_FEATURES`);
    }
  }
});

test('Admin management routes render pages owned by the Admin app', async () => {
  const routeModule = await readFile(path.join(root, 'apps/admin/src/app/router/management-routes.tsx'), 'utf8');
  assert.match(routeModule, /from ['"]\.\.\/\.\.\/features\/management\/pages\/AdminPages['"]/);
  assert.doesNotMatch(routeModule, /@legacy\/pages\/admin\/AdminPages/);
});

test('Admin course approval route renders its app-owned feature page', async () => {
  const routeModule = await readFile(path.join(root, 'apps/admin/src/app/router/management-routes.tsx'), 'utf8');
  assert.match(routeModule, /from ['"]\.\.\/\.\.\/features\/course-approval\/pages\/CourseReviewPage['"]/);
  assert.doesNotMatch(routeModule, /@legacy\/pages\/admin\/CourseReviewPage/);
});

test('Web and Admin authoring routes render their own course editor hosts', async () => {
  const webModule = await readFile(path.join(root, 'apps/web/src/app/router/instructor-routes.tsx'), 'utf8');
  const adminModule = await readFile(path.join(root, 'apps/admin/src/app/router/authoring-routes.tsx'), 'utf8');
  assert.match(webModule, /from ['"]\.\.\/\.\.\/features\/course-authoring\/pages\/CourseEditorPage['"]/);
  assert.match(adminModule, /from ['"]\.\.\/\.\.\/features\/course-authoring\/pages\/CourseEditorPage['"]/);
  assert.doesNotMatch(webModule, /@legacy\/pages\/instructor\/CoursePages.*CourseEditorPage/);
  assert.doesNotMatch(adminModule, /@legacy\/pages\/instructor\/CoursePages.*CourseEditorPage/);
});

test('Web and Admin have distinct canonical route ownership', () => {
  const webPaths = webRoutes.map((route) => route.path);
  const adminPaths = adminRoutes.map((route) => route.path);
  assert.ok(webPaths.includes('/teach/courses/:courseId/settings'));
  assert.ok(!webPaths.some((routePath) => routePath === '/admin' || routePath.startsWith('/admin/')));
  assert.ok(adminPaths.includes('/admin/courses/:courseId/settings'));
  assert.ok(adminPaths.includes('/admin/courses/:courseId/preview'));
  assert.ok(adminPaths.includes('/teach/*'));
  assert.equal(adminRoutes.find((route) => route.path === '/teach/*')?.element, '<LegacyAdminRedirect />');
  assert.ok(!adminPaths.includes('/teach/attempts/:attemptId/grade'));
  assert.ok(!adminPaths.includes('/teach/quizzes/:quizId/attempts'));
});

test('Web and Admin authoring routes render app-owned overview and editor pages', async () => {
  const webModule = await readFile(path.join(root, 'apps/web/src/app/router/instructor-routes.tsx'), 'utf8');
  const adminModule = await readFile(path.join(root, 'apps/admin/src/app/router/authoring-routes.tsx'), 'utf8');
  const pages = ['CourseOverviewPage', 'CurriculumPage', 'ChapterWorkspace', 'ContentEditorPage', 'QuizManagerPage', 'QuizEditorPage'];
  for (const page of pages) {
    assert.ok(webModule.includes(`../../features/course-authoring/pages/${page}`), `Web owns ${page}`);
    assert.ok(adminModule.includes(`../../features/course-authoring/pages/${page}`), `Admin owns ${page}`);
    assert.ok(existsSync(path.join(root, 'apps/web/src/features/course-authoring/pages', `${page}.tsx`)), `Web ${page} exists`);
    assert.ok(existsSync(path.join(root, 'apps/admin/src/features/course-authoring/pages', `${page}.tsx`)), `Admin ${page} exists`);
  }
  assert.doesNotMatch(webModule, /@legacy\/pages\/instructor\/(?:CurriculumPages|ChapterWorkspace)/);
  assert.doesNotMatch(adminModule, /@legacy\/pages\/instructor\/(?:CoursePages|CurriculumPages|ChapterWorkspace|QuizPages)/);
  assert.match(webModule, /@legacy\/pages\/instructor\/QuizPages/); // learner review/grading remain a separate Web assessment slice
});
