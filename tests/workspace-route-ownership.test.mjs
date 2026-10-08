import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ROUTE_FEATURES } from '../packages/contracts/src/features.ts';
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

// Provisional API adapters are dev-only page implementations that retain the
// existing production page and URL. Keep their route declarations explicit.
const approvedProvisionalElementMigrations = {
  web: [
    { path: '/learn', to: "featureElement('/learn', learner(import.meta.env.DEV ? <MyCoursesPage /> : <LearnerDashboardPage />))" },
    { path: '/learn/courses', to: "featureElement('/learn/courses', learner(import.meta.env.DEV ? <MyCoursesPage /> : <LegacyMyCoursesPage />))" },
    { path: '/learn/redeem', to: "featureElement('/learn/redeem', learner(<RedeemRoute />))" },
    { path: '/learn/ai', to: "featureElement('/learn/ai', <RolePage roles={['learner', 'instructor']} standalone><AiRoute /></RolePage>)" },
    { path: '/learn/courses/:courseId', to: "featureElement('/learn/courses/:courseId', learner(import.meta.env.DEV ? <LearningCoursePage /> : <LearnerCoursePage />))" },
    { path: '/learn/courses/:courseId/videos/:itemId', to: `featureElement('/learn/courses/:courseId/videos/:itemId', learner(import.meta.env.DEV ? <LessonPage expectedType="video" /> : <VideoLessonPage />))` },
    { path: '/learn/courses/:courseId/articles/:itemId', to: `featureElement('/learn/courses/:courseId/articles/:itemId', learner(import.meta.env.DEV ? <LessonPage expectedType="article" /> : <ArticleLessonPage />))` },
    { path: '/learn/courses/:courseId/quizzes/:itemId', to: "featureElement('/learn/courses/:courseId/quizzes/:itemId', learner(import.meta.env.DEV ? <QuizStartPage /> : <QuizIntroPage />))" },
    { path: '/learn/quizzes/:quizId', to: "featureElement('/learn/quizzes/:quizId', learner(import.meta.env.DEV ? <QuizStartPage /> : <QuizIntroPage />))" },
    { path: '/learn/attempts/:attemptId', to: "featureElement('/learn/attempts/:attemptId', learner(import.meta.env.DEV ? <QuizAttemptPage /> : <LegacyQuizAttemptPage />))" },
    { path: '/learn/attempts/:attemptId/result', to: "featureElement('/learn/attempts/:attemptId/result', learner(import.meta.env.DEV ? <QuizResultPage /> : <LegacyQuizResultPage />))" },
    { path: '/checkout/:courseId', to: "featureElement('/checkout/:courseId', paymentUser(<CheckoutRoute />))" },
    { path: '/checkout/:orderId/result', to: "featureElement('/checkout/:orderId/result', paymentUser(<CheckoutRoute result />))" },
    { path: '/account/certificates', to: "featureElement('/account/certificates', accountUser(import.meta.env.DEV ? <ServerCertificatesPage /> : <CertificatesPage />))" },
    { path: '/account/certificates/:certificateId', to: "featureElement('/account/certificates/:certificateId', accountUser(import.meta.env.DEV ? <ServerCertificateDetailPage /> : <CertificateDetailPage />))" },
    { path: '/teach/reviews', to: "featureElement('/teach/reviews', grader(import.meta.env.DEV ? <InstructorGradingPage /> : <LearnerReviewQueuePage />))" },
  ],
  admin: [
    { path: '/admin/access-codes', to: "featureElement('/admin/access-codes', admin(<AccessCodesRoute />))" },
  ],
};
const approvedRouteAdditions = {
  admin: [
    { path: '/admin/payments', featurePath: '/admin/payments', element: "featureElement('/admin/payments', admin(<PaymentLookupRoute />))", after: '/admin/access-codes', reason: 'R8 adds a read-only Admin lookup for one abnormal Payment' },
    { path: '/admin/ai', featurePath: '/admin/ai', element: "featureElement('/admin/ai', admin(<AiAdminRoute />))", after: '/admin/payments', reason: 'R9 adds an Admin-owned dev-only AI and transcript control route' },
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
    for (const migration of approvedProvisionalElementMigrations[appName] ?? []) {
      const previous = expected.find((route) => route.path === migration.path);
      const current = actual.find((route) => route.path === migration.path);
      assert.ok(previous, `${appName} ${migration.path} exists in the R3b inventory`);
      assert.ok(current, `${appName} ${migration.path} remains registered`);
      assert.equal(current.featurePath, previous.featurePath, `${appName} ${migration.path} preserves its feature owner`);
      assert.equal(current.element, migration.to, `${appName} ${migration.path} uses its reviewed provisional adapter`);
      previous.element = migration.to;
    }
    for (const addition of approvedRouteAdditions[appName] ?? []) {
      const current = actual.find((route) => route.path === addition.path);
      assert.deepEqual(current, { path: addition.path, featurePath: addition.featurePath, element: addition.element }, `${appName} ${addition.path}: ${addition.reason}`);
      const insertionPoint = expected.findIndex((route) => route.path === addition.after);
      assert.notEqual(insertionPoint, -1, `${appName} insertion point ${addition.after} exists`);
      expected.splice(insertionPoint + 1, 0, { path: addition.path, featurePath: addition.featurePath, element: addition.element });
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

test('Admin access codes route renders its app-owned feature page', async () => {
  const routeModule = await readFile(path.join(root, 'apps/admin/src/app/router/management-routes.tsx'), 'utf8');
  assert.match(routeModule, /from ['"]\.\.\/\.\.\/features\/management\/pages\/AccessCodesPage['"]/);
  assert.doesNotMatch(routeModule, /@legacy\/pages\/admin\/AccessCodesPage/);
});

test('Web and Admin auth routes render app-owned auth pages', async () => {
  const webAuth = await readFile(path.join(root, 'apps/web/src/app/router/auth-routes.tsx'), 'utf8');
  const adminEntry = await readFile(path.join(root, 'apps/admin/src/app/router/entry-routes.tsx'), 'utf8');
  assert.match(webAuth, /from ['"]\.\.\/\.\.\/features\/auth\/pages\/AuthPages['"]/);
  assert.doesNotMatch(webAuth, /@legacy\/pages\/AuthPages/);
  assert.match(adminEntry, /from ['"]\.\.\/\.\.\/features\/auth\/pages\/AuthPages['"]/);
  assert.doesNotMatch(adminEntry, /@legacy\/pages\/AuthPages/);
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
