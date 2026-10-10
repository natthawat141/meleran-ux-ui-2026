import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, accounts, mockPassword } from './support/provisional-api.mjs';
import { decodeCurrentUser } from '../packages/contracts/src/auth-decoder.ts';
import { resolveApiConfig } from '../apps/web/src/shared/api/config.ts';

test('canonical LoginRequest works with the mock and the obsolete request is rejected', async () => {
  const client = createWorld().browser();
  const login = await client.post('auth/login', { identifier: accounts.learner, password: mockPassword, audience: 'web' });
  assert.equal(login.status, 200);
  const user = decodeCurrentUser(login.body.user);
  assert.equal(user.id, 'usr_learner');
  assert.equal(user.origin, 'self_email');
  assert.equal('password' in user, false);
  assert.equal((await client.post('auth/login', { username_or_email: accounts.learner, password: mockPassword })).status, 422);
});

test('profile saves on the server, survives refresh/new session and never changes account permissions', async () => {
  const world = createWorld(); const client = world.browser();
  await client.login(accounts.learner);
  const saved = await client.patch('me', { display_name: 'ชื่อจาก API', username: 'profile.learner', avatar_url: null,
    profile: { firstName: 'สมชาย', lastName: 'เรียนดี', certificateName: 'สมชาย เรียนดี', birthDate: '2000-01-01', interests: ['คณิตศาสตร์'], learningGoals: [] } });
  assert.equal(saved.status, 200);
  const user = decodeCurrentUser(saved.body);
  assert.equal(user.display_name, 'ชื่อจาก API');
  assert.deepEqual(user.profile.interests, ['คณิตศาสตร์']);
  await client.post('auth/logout');
  const secondBrowser = world.browser(); await secondBrowser.login('profile.learner');
  assert.deepEqual(decodeCurrentUser((await secondBrowser.get('me')).body), user);
  assert.equal((await secondBrowser.patch('me', { roles: ['admin'] })).status, 422);
  assert.equal((await secondBrowser.patch('me', { profile: { googleLinkedEmail: 'forged@example.test' } })).status, 422);
  assert.equal((await secondBrowser.patch('me', { display_name: 'must not save', profile: { birthDate: '2000-02-30' } })).status, 422);
  assert.equal((await secondBrowser.get('me')).body.display_name, 'ชื่อจาก API');
});

test('profile username uniqueness is enforced across users and null usernames decode correctly', async () => {
  const world = createWorld(); const first = world.browser(), second = world.browser();
  await first.login(accounts.learner); await second.login(accounts.instructorA);
  assert.equal((await first.patch('me', { username: 'shared.name' })).status, 200);
  assert.equal((await second.patch('me', { username: 'SHARED.name' })).status, 409);
  const user = (await first.get('me')).body;
  assert.equal(decodeCurrentUser({ ...user, username: null }).username, null);
  assert.throws(() => decodeCurrentUser({ ...user, origin: 'unknown' }), /Invalid/);
});

test('certificate captures the saved API profile name once and later profile changes leave it unchanged', async () => {
  const world = createWorld(); const learner = world.browser(); await learner.login(accounts.learner);
  const course = world.db.courses.get('crs_mock_001');
  course.chapters[0].items = course.chapters[0].items.filter((item) => item.type === 'article');
  assert.equal((await learner.patch('me', { profile: { certificateName: 'ชื่อบนใบรับรองจาก API' } })).status, 200);
  assert.equal((await learner.post('courses/crs_mock_001/enroll')).status, 201);
  assert.equal((await learner.post(`learn/items/${course.chapters[0].items[0].id}/complete`)).status, 200);
  const certificate = [...world.db.certificates.values()].find((item) => item.user_id === 'usr_learner');
  assert.equal(certificate.learner_name, 'ชื่อบนใบรับรองจาก API');
  await learner.patch('me', { profile: { certificateName: 'ชื่อใหม่' } });
  await learner.post(`learn/items/${course.chapters[0].items[0].id}/complete`);
  assert.equal(world.db.certificates.get(certificate.id).learner_name, 'ชื่อบนใบรับรองจาก API');
});

test('API config selects explicit mock/remote transport without a production local-state fallback', () => {
  assert.deepEqual(resolveApiConfig({ dev: true }), { baseUrl: '/mock-api/v1', credentials: 'include', mock: true });
  assert.deepEqual(resolveApiConfig({ dev: false }), { baseUrl: '/api/v1', credentials: 'include', mock: false });
  assert.equal(resolveApiConfig({ dev: false, baseUrl: 'https://backend.example.test/v1/' }).baseUrl, 'https://backend.example.test/v1');
  assert.equal(resolveApiConfig({ dev: false, mode: 'mock' }).mock, true);
  assert.throws(() => resolveApiConfig({ dev: false, mode: 'invalid' }));
  assert.throws(() => resolveApiConfig({ dev: false, baseUrl: 'javascript:bad' }));
});
