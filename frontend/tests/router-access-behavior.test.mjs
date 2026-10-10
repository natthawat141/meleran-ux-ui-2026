import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithEsbuild } from 'vite';

const require = createRequire(import.meta.url);
const apiSession = { enabled: true, status: 'ready', user: null, logout: async () => {}, refresh: async () => null };
const session = {
  currentUser: null,
  data: {
    courses: [{ id: 'owned', instructorId: 'teacher' }, { id: 'other', instructorId: 'another' }],
    quizzes: [{ id: 'quiz-other', courseId: 'other' }],
    attempts: [{ id: 'attempt-other', courseId: 'other' }],
  },
};
let location = { pathname: '', search: '', hash: '' };
let params = {};
const Navigate = () => null;
const PublicShell = () => null;
const WorkspaceShell = () => null;
const NoAccessPage = () => null;
const VerifyEmailPage = () => null;

async function loadAccess(appName) {
  const url = new URL(`../apps/${appName}/src/app/router/access.tsx`, import.meta.url);
  const source = await readFile(url, 'utf8');
  const { code } = await transformWithEsbuild(source, url.pathname, { loader: 'tsx', format: 'cjs', jsx: 'automatic' });
  const module = { exports: {} };
  const mocks = {
    'react-router-dom': { Navigate, useLocation: () => location, useParams: () => params },
    '@melearn/store': { useLms: () => session },
    '@legacy/store': { useLms: () => session },
    '@legacy/components/Shell': { PublicShell, WorkspaceShell },
    '@legacy/pages/SystemPages': { NoAccessPage },
    '@melearn/ui': { NoAccessPage, PublicShell, WorkspaceShell },
    '../../features/auth/pages/AuthPages': { VerifyEmailPage },
    '../../features/auth/api/AuthSessionProvider': { useAuthSession: () => apiSession },
  };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      assert.ok(specifier === 'react' || specifier === 'react/jsx-runtime', `Unexpected access dependency: ${specifier}`);
      return require(specifier);
    },
    URLSearchParams,
  }, { filename: url.pathname });
  return module.exports;
}

const web = await loadAccess('web');
const admin = await loadAccess('admin');
const child = 'protected-page';

function setContext(user, pathname, search = '', hash = '', routeParams = {}) {
  session.currentUser = { id: 'stale-local-user', role: 'admin' };
  apiSession.user = user ? { id: user.id, display_name: user.id, email: null, roles: user.role === 'instructor' ? ['learner', 'instructor'] : [user.role], email_verified: user.emailVerified !== false, learning_eligible: user.learningEligible ?? user.emailVerified !== false } : null;
  location = { pathname, search, hash };
  params = routeParams;
}

test('both access boundaries retain the complete internal login return path', () => {
  setContext(null, '/teach/courses/course-7/chapters/chapter-2', '?item=lesson-3&view=preview', '#editor');
  for (const result of [web.RolePage({ roles: ['instructor'], children: child }), admin.AdminPage({ children: child })]) {
    assert.equal(result.type, Navigate);
    assert.equal(result.props.to, '/login?next=%2Fteach%2Fcourses%2Fcourse-7%2Fchapters%2Fchapter-2%3Fitem%3Dlesson-3%26view%3Dpreview%23editor');
    assert.equal(result.props.replace, true);
  }
});

test('server-eligible admin-created accounts can learn without an email verification detour', () => {
  setContext({ id: 'admin-created', role: 'learner', emailVerified: false, learningEligible: true }, '/learn');
  const result = web.RolePage({ roles: ['learner', 'instructor'], children: child });
  assert.equal(result.type, WorkspaceShell);
  assert.equal(result.props.children, child);
});

test('Instructor can use learner flows and Web still rejects Admin', () => {
  setContext({ id: 'teacher', role: 'instructor', emailVerified: true }, '/learn/courses/other');
  const allowed = web.learner(child);
  assert.equal(web.RolePage(allowed.props).props.children, child);
  setContext({ id: 'admin', role: 'admin' }, '/learn/courses/other');
  const denied = web.RolePage(allowed.props);
  assert.equal(denied.type, WorkspaceShell);
  assert.equal(denied.props.children.type, NoAccessPage);
  assert.deepEqual(Array.from(denied.props.availableRoles), []);
});

test('existing email verification route scope remains unchanged', () => {
  const unverified = { id: 'learner', role: 'learner', emailVerified: false };
  for (const pathname of ['/learn', '/learn/courses', '/learn/courses/other/videos/video-1', '/learn/redeem', '/learn/quizzes/quiz-1', '/learn/attempts/attempt-1/result', '/checkout/course-1']) {
    setContext(unverified, pathname);
    const result = web.RolePage({ roles: ['learner', 'instructor'], children: child });
    assert.equal(result.type, web.Public, pathname);
    assert.equal(result.props.children.type, VerifyEmailPage, pathname);
  }
  for (const pathname of ['/explore/courses', '/account/profile']) {
    setContext(unverified, pathname);
    assert.equal(web.RolePage({ roles: ['learner', 'instructor'], children: child }).props.children, child, pathname);
  }
});

test('Instructor ownership is enforced by the API, without trusting local prototype users', async () => {
  const { createWorld, accounts } = await import('./support/provisional-api.mjs');
  const client = createWorld().browser(); await client.login(accounts.instructorA);
  assert.equal((await client.get('courses/crs_mock_002/authoring')).status, 404);
  assert.equal((await client.get('courses/crs_mock_001/authoring')).status, 200);
  setContext(null, '/teach/courses/owned/settings');
  assert.equal(web.RolePage({ roles: ['instructor'], children: child }).type, Navigate);
});

test('standalone Web access keeps AI outside WorkspaceShell after guards pass', () => {
  setContext({ id: 'teacher', role: 'instructor', emailVerified: true }, '/learn/ai', '?courseId=owned&returnTo=%2Flearn%2Fattempts%2Fa1', '#question');
  const result = web.RolePage({ roles: ['learner', 'instructor'], children: child, standalone: true });
  assert.equal(result.type, Symbol.for('react.fragment'));
  assert.equal(result.props.children, child);
});

test('Admin shell admits only Admin while preserving existing denial and public wrapper behavior', () => {
  setContext({ id: 'teacher', role: 'instructor' }, '/admin/courses/owned/settings');
  const denied = admin.AdminPage({ children: child });
  assert.equal(denied.type, WorkspaceShell);
  assert.deepEqual(Array.from(denied.props.availableRoles), []);
  assert.equal(denied.props.children.type, NoAccessPage);
  setContext({ id: 'admin', role: 'admin', emailVerified: false }, '/admin/courses/owned/settings');
  assert.equal(admin.AdminPage({ children: child }).props.children, child);
  assert.equal(web.Public({ children: child }).type, PublicShell);
});

test('API session loading and errors do not fall back to local identity', () => {
  setContext(null, '/learn');
  for (const status of ['loading', 'error']) {
    apiSession.status = status;
    assert.equal(web.RolePage({ roles: ['learner'], children: child }).type, 'div');
    assert.equal(admin.AdminPage({ children: child }).type, 'div');
  }
  apiSession.status = 'ready';
});
