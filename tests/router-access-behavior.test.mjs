import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithEsbuild } from 'vite';

const require = createRequire(import.meta.url);
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
    '@legacy/store': { useLms: () => session },
    '@legacy/components/Shell': { PublicShell, WorkspaceShell },
    '@legacy/pages/SystemPages': { NoAccessPage },
    '@melearn/ui': { NoAccessPage },
    '../../features/auth/pages/AuthPages': { VerifyEmailPage },
    '../../features/auth/api/AuthSessionProvider': { useAuthSession: () => ({ enabled: false, status: 'ready', user: null, logout: async () => {}, refresh: async () => null }) },
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
  session.currentUser = user;
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

test('Instructor can use learner flows and Web still rejects Admin', () => {
  setContext({ id: 'teacher', role: 'instructor', emailVerified: true }, '/learn/courses/other');
  const allowed = web.learner(child);
  assert.equal(web.RolePage(allowed.props).props.children, child);
  setContext({ id: 'admin', role: 'admin' }, '/learn/courses/other');
  const denied = web.RolePage(allowed.props);
  assert.equal(denied.type, WorkspaceShell);
  assert.equal(denied.props.children.type, NoAccessPage);
  assert.deepEqual(Array.from(denied.props.availableRoles), ['learner', 'instructor']);
});

test('existing email verification route scope remains unchanged', () => {
  const unverified = { id: 'learner', role: 'learner', emailVerified: false };
  for (const pathname of ['/learn', '/learn/courses', '/learn/courses/other/videos/video-1', '/learn/redeem', '/learn/quizzes/quiz-1', '/learn/attempts/attempt-1/result', '/checkout/course-1']) {
    setContext(unverified, pathname);
    const result = web.RolePage({ roles: ['learner', 'instructor'], children: child });
    assert.equal(result.type, web.Public, pathname);
    assert.equal(result.props.children.type, VerifyEmailPage, pathname);
  }
  for (const pathname of ['/explore/courses', '/account/profile', '/learn/ai']) {
    setContext(unverified, pathname);
    assert.equal(web.RolePage({ roles: ['learner', 'instructor'], children: child }).props.children, child, pathname);
  }
});

test('Instructor ownership stays scoped through course, quiz, attempt and queue context', () => {
  const teacher = { id: 'teacher', role: 'instructor', emailVerified: true };
  const contexts = [
    ['/teach/courses/other/settings', '', { courseId: 'other' }],
    ['/teach/quizzes/quiz-other/attempts', '?course=owned', { quizId: 'quiz-other' }],
    ['/teach/attempts/attempt-other/grade', '?course=owned', { attemptId: 'attempt-other' }],
    ['/teach/reviews', '?course=other&mode=pending&q=test', {}],
    ['/teach/reviews', '?courseId=other&returnTo=%2Fteach%2Freviews', {}],
  ];
  for (const [pathname, search, routeParams] of contexts) {
    setContext(teacher, pathname, search, '#context', routeParams);
    assert.equal(web.RolePage({ roles: ['instructor'], children: child }).props.children.type, NoAccessPage, pathname);
  }
  setContext(teacher, '/teach/courses/owned/settings', '?course=other', '', { courseId: 'owned' });
  assert.equal(web.RolePage({ roles: ['instructor'], children: child }).props.children, child);
  setContext(teacher, '/teach/courses/missing/settings', '', '', { courseId: 'missing' });
  assert.equal(web.RolePage({ roles: ['instructor'], children: child }).props.children, child, 'missing resources remain page-owned');
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
  assert.deepEqual(Array.from(denied.props.availableRoles), ['admin']);
  assert.equal(denied.props.children.type, NoAccessPage);
  setContext({ id: 'admin', role: 'admin', emailVerified: false }, '/admin/courses/owned/settings');
  assert.equal(admin.AdminPage({ children: child }).props.children, child);
  assert.equal(web.Public({ children: child }).type, PublicShell);
});
