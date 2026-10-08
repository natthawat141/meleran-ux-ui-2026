import assert from 'node:assert/strict';
import test from 'node:test';
import { accounts, basePath, createWorld, mockPassword } from './support/provisional-api.mjs';

const noUnexpected = (world) => assert.deepEqual(world.api.unexpectedErrors, []);
const afterBase = (location) => location.slice(`${basePath}/`.length);
const lastMail = (world, kind) => [...world.outbox].reverse().find((mail) => mail.kind === kind);

async function register(browser, overrides = {}) {
  return browser.post('auth/register', { display_name: 'สมชาย ใจดี', email: 'somchai@example.test', password: 'password-123', ...overrides });
}

test('registration creates an unverified Learner without a session and queues a verification email', async () => {
  const world = createWorld();
  const browser = world.browser();
  const result = await register(browser);
  assert.equal(result.status, 201);
  assert.equal(result.body.verification_email, 'queued');
  assert.deepEqual(result.body.user.roles, ['learner']);
  assert.equal(result.body.user.email_verified, false);
  assert.equal(result.body.user.learning_eligible, false);
  assert.equal(result.body.user.origin, 'self_email');
  assert.equal((await browser.get('me')).status, 401, 'registering must not create a session');
  assert.ok(!result.text.includes('password-123') && !/"password":/.test(result.text));
  assert.equal(world.outbox.length, 1);
  assert.equal(world.outbox[0].to, 'somchai@example.test');
  noUnexpected(world);
});

test('registration rejects server-owned fields, weak input and duplicate emails', async () => {
  const world = createWorld();
  const browser = world.browser();
  for (const extra of [{ roles: ['admin'] }, { email_verified: true }, { origin: 'google' }, { id: 'usr_x' }]) {
    const result = await register(browser, extra);
    assert.equal(result.status, 422, JSON.stringify(extra));
    assert.equal(result.body.error.code, 'validation_failed');
  }
  assert.equal((await register(browser, { password: 'short' })).status, 422);
  assert.equal((await register(browser, { email: 'not-an-email' })).status, 422);
  assert.equal((await register(browser, { display_name: '   ' })).status, 422);
  assert.equal((await browser.post('auth/register', 'not json')).status, 422);
  assert.equal((await register(browser)).status, 201);
  const duplicate = await register(browser, { email: 'SomChai@Example.test' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'email_taken');
  noUnexpected(world);
});

test('verification link verifies once, is idempotent when reused, and expires after 24 hours', async () => {
  const world = createWorld();
  const browser = world.browser();
  await register(browser);
  const token = lastMail(world, 'verify_email').token;
  assert.equal((await browser.post('auth/verify-email', { token: 'nope' })).body.error.code, 'verification_link_invalid');
  assert.equal((await browser.post('auth/verify-email', {})).status, 422);

  const first = await browser.post('auth/verify-email', { token });
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'verified');
  assert.equal(first.body.user, undefined, 'a guest opening the link learns nothing about the account');
  const email = 'somchai@example.test';
  assert.equal([...world.db.users.values()].filter((user) => user.email === email).length, 1);
  assert.equal([...world.db.users.values()].find((user) => user.email === email).email_verified, true);

  const again = await browser.post('auth/verify-email', { token });
  assert.equal(again.status, 200);
  assert.equal(again.body.status, 'already_verified');

  const other = createWorld();
  const otherBrowser = other.browser();
  await register(otherBrowser);
  const expiring = lastMail(other, 'verify_email').token;
  other.clock.advance(24 * 3600 * 1000 + 1000);
  const expired = await otherBrowser.post('auth/verify-email', { token: expiring });
  assert.equal(expired.status, 410);
  assert.equal(expired.body.error.code, 'verification_link_expired');
  assert.equal([...other.db.users.values()].find((user) => user.email === email).email_verified, false);
  noUnexpected(world); noUnexpected(other);
});

test('verifying while logged in as the same account returns the updated user', async () => {
  const world = createWorld();
  const browser = world.browser();
  await register(browser);
  await browser.login('somchai@example.test', { password: 'password-123' });
  assert.equal((await browser.get('me')).body.learning_eligible, false);
  const result = await browser.post('auth/verify-email', { token: lastMail(world, 'verify_email').token });
  assert.equal(result.body.user.email_verified, true);
  assert.equal((await browser.get('me')).body.learning_eligible, true);
  noUnexpected(world);
});

test('resend answers 202 for any input, enforces a cooldown and only mails unverified self-registered accounts', async () => {
  const world = createWorld();
  const browser = world.browser();
  const unknown = await browser.post('auth/resend-verification-email', { email: 'nobody@example.test' });
  assert.equal(unknown.status, 202);
  assert.equal(world.outbox.length, 0);

  await register(browser);
  assert.equal(world.outbox.length, 1);
  const tooSoon = await browser.post('auth/resend-verification-email', { email: 'somchai@example.test' });
  assert.equal(tooSoon.status, 429);
  assert.equal(tooSoon.body.error.code, 'rate_limited');
  assert.ok(Number(tooSoon.headers.get('retry-after')) > 0);

  world.clock.advance(61 * 1000);
  const guest = await browser.post('auth/resend-verification-email', { email: 'somchai@example.test' });
  assert.equal(guest.status, 202);
  assert.deepEqual(Object.keys(guest.body).sort(), ['retry_after_seconds', 'status']);
  assert.equal(world.outbox.length, 2);

  assert.equal((await browser.post('auth/resend-verification-email')).status, 401, 'no session and no email');

  const verified = world.browser();
  await verified.login(accounts.learner);
  world.clock.advance(61 * 1000);
  assert.equal((await verified.post('auth/resend-verification-email')).status, 202);
  assert.equal(world.outbox.length, 2, 'an already verified account gets the same 202 but no email');
  noUnexpected(world);
});

test('login accepts username or email and never reveals whether an account exists', async () => {
  const world = createWorld();
  const browser = world.browser();
  assert.equal((await browser.get('me')).status, 401);
  const byEmail = await browser.post('auth/login', { identifier: 'LEARNER@example.test', password: mockPassword, audience: 'web' });
  assert.equal(byEmail.status, 200);
  assert.equal(byEmail.body.user.id, 'usr_learner');
  assert.ok(!/ses_|session/i.test(byEmail.text), 'the session id must travel in the cookie, never in the body');
  assert.equal((await browser.get('me')).body.id, 'usr_learner');

  const byUsername = world.browser();
  assert.equal((await byUsername.post('auth/login', { identifier: 'Learner-Admin', password: mockPassword, audience: 'web' })).status, 200);

  const failures = [
    { identifier: 'learner@example.test', password: 'wrong-password' },
    { identifier: 'nobody@example.test', password: mockPassword },
    { identifier: 'google-learner@example.test', password: mockPassword }, // Google-only account has no password
  ];
  const bodies = [];
  for (const failure of failures) {
    const result = await world.browser().post('auth/login', { ...failure, audience: 'web' });
    assert.equal(result.status, 401);
    bodies.push(result.body.error);
  }
  for (const error of bodies) { assert.equal(error.code, 'credentials_invalid'); assert.equal(error.message, bodies[0].message); }
  assert.equal((await world.browser().post('auth/login', { identifier: 'a', password: 'b', audience: 'mobile' })).status, 422);
  assert.equal((await world.browser().post('auth/login', { identifier: 'a', password: 'b', audience: 'web', roles: ['admin'] })).status, 422);
  noUnexpected(world);
});

test('admin audience only admits admin accounts and sessions are independent per browser', async () => {
  const world = createWorld();
  const web = world.browser();
  const admin = world.browser();
  const denied = await web.post('auth/login', { identifier: accounts.learner, password: mockPassword, audience: 'admin' });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'audience_not_allowed');
  assert.equal((await web.get('me')).status, 401, 'a refused login must not leave a session behind');

  await web.login(accounts.learner);
  await admin.login(accounts.admin, { audience: 'admin' });
  assert.equal((await web.get('me')).body.id, 'usr_learner');
  assert.equal((await admin.get('me')).body.id, 'usr_admin');

  assert.equal((await web.post('auth/logout')).status, 204);
  assert.equal((await web.get('me')).status, 401);
  assert.equal((await admin.get('me')).status, 200, 'logging out of Web must not end the Admin session');
  assert.equal((await web.post('auth/logout')).status, 204, 'logging out twice is harmless');
  noUnexpected(world);
});

test('PATCH /me changes only editable profile fields', async () => {
  const world = createWorld();
  const browser = world.browser();
  assert.equal((await browser.patch('me', { display_name: 'x' })).status, 401);
  await browser.login(accounts.learner);
  const updated = await browser.patch('me', { display_name: 'ชื่อใหม่', avatar_url: null });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.display_name, 'ชื่อใหม่');
  for (const forbidden of [{ roles: ['admin'] }, { email_verified: false }, { email: 'x@example.test' }, { id: 'usr_admin' }, { origin: 'google' }]) {
    assert.equal((await browser.patch('me', forbidden)).status, 422, JSON.stringify(forbidden));
  }
  assert.equal((await browser.patch('me', { display_name: '' })).status, 422);
  const me = (await browser.get('me')).body;
  assert.deepEqual(me.roles, ['learner']);
  assert.equal(me.display_name, 'ชื่อใหม่');
  noUnexpected(world);
});

test('Google sign-in: signs in or creates a verified account, and never auto-merges by email', async () => {
  const world = createWorld();
  const browser = world.browser();
  const start = await browser.get('auth/google/start?mock_google_subject=g-new&mock_google_email=new.person%40example.test&mock_google_name=New%20Person&return_to=%2Fcourses');
  assert.equal(start.status, 302);
  const callback = await browser.get(afterBase(start.headers.get('location')));
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/courses?auth_result=signed_in');
  const me = (await browser.get('me')).body;
  assert.equal(me.origin, 'google');
  assert.equal(me.email_verified, true);
  assert.equal(me.learning_eligible, true);
  assert.deepEqual(me.auth_methods, ['google']);

  const usersBefore = world.db.users.size;
  const again = world.browser();
  const second = await again.get('auth/google/callback?mock_google_subject=g-new&mock_google_email=new.person%40example.test&return_to=%2F');
  assert.equal(second.headers.get('location'), '/?auth_result=signed_in');
  assert.equal(world.db.users.size, usersBefore, 'the same Google identity signs in to the same user');

  const clash = world.browser();
  const link = await clash.get('auth/google/callback?mock_google_subject=g-other&mock_google_email=learner%40example.test&return_to=%2F');
  assert.equal(link.headers.get('location'), '/?auth_result=google_link_required');
  assert.equal((await clash.get('me')).status, 401, 'no session without proving the existing account');
  assert.equal(world.db.users.size, usersBefore, 'no user is created or merged');

  const failed = world.browser();
  assert.equal((await failed.get('auth/google/callback?mock_google_error=1&return_to=%2F')).headers.get('location'), '/?auth_result=failed');
  assert.equal((await failed.get('auth/google/callback?return_to=%2F')).headers.get('location'), '/?auth_result=failed');
  noUnexpected(world);
});

test('return_to only accepts same-app absolute paths', async () => {
  const world = createWorld();
  for (const unsafe of ['https://evil.example/x', '//evil.example', '\\\\evil.example', 'javascript:alert(1)', 'relative/path']) {
    const result = await world.browser().get(`auth/google/callback?mock_google_error=1&return_to=${encodeURIComponent(unsafe)}`);
    assert.equal(result.headers.get('location'), '/?auth_result=failed', unsafe);
  }
  noUnexpected(world);
});

test('linking Google needs a session, links once per identity and refuses an identity owned by someone else', async () => {
  const world = createWorld();
  const guest = world.browser();
  assert.equal((await guest.post('me/auth-identities/google', {})).status, 401);

  const browser = world.browser();
  await browser.login(accounts.learner);
  const started = await browser.post('me/auth-identities/google', { return_to: '/profile', mock_google_subject: 'g-learner-link' });
  assert.equal(started.status, 200);
  const done = await browser.get(afterBase(started.body.redirect_url));
  assert.equal(done.headers.get('location'), '/profile?link_result=linked');
  assert.deepEqual((await browser.get('me')).body.auth_methods, ['password', 'google']);

  const other = world.browser();
  await other.login(accounts.adminCreatedLearner);
  const clash = await other.post('me/auth-identities/google', { mock_google_subject: 'g-learner-link' });
  assert.equal((await other.get(afterBase(clash.body.redirect_url))).headers.get('location'), '/?link_result=google_identity_linked_elsewhere');
  assert.deepEqual((await other.get('me')).body.auth_methods, ['password']);
  assert.equal((await browser.post('me/auth-identities/google', { roles: ['admin'] })).status, 422);
  noUnexpected(world);
});

test('password reset: same 202 for everyone, links only for verified emails, single use, ends sessions', async () => {
  const world = createWorld();
  const browser = world.browser();
  const known = await browser.post('auth/password-reset/request', { identifier: accounts.learner });
  world.clock.advance(61 * 1000);
  const unknown = await browser.post('auth/password-reset/request', { identifier: 'nobody@example.test' });
  assert.equal(known.status, 202);
  assert.deepEqual(known.body, unknown.body);
  assert.equal(world.outbox.filter((mail) => mail.kind === 'reset_password').length, 1);

  world.clock.advance(61 * 1000);
  await browser.post('auth/password-reset/request', { identifier: accounts.adminCreatedLearner });
  world.clock.advance(61 * 1000);
  await browser.post('auth/password-reset/request', { identifier: accounts.unverified });
  assert.equal(world.outbox.filter((mail) => mail.kind === 'reset_password').length, 1, 'no link for accounts without a verified email');
  assert.equal((await browser.post('auth/password-reset/request', { identifier: accounts.unverified })).status, 429);

  const signedIn = world.browser();
  await signedIn.login(accounts.learner);
  const token = lastMail(world, 'reset_password').token;
  assert.equal((await browser.post('auth/password-reset/confirm', { token, new_password: 'short' })).status, 422);
  assert.equal((await browser.post('auth/password-reset/confirm', { token: 'nope', new_password: 'new-password-1' })).body.error.code, 'reset_link_invalid');
  const changed = await browser.post('auth/password-reset/confirm', { token, new_password: 'new-password-1' });
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.body, { status: 'password_changed' });
  assert.equal((await signedIn.get('me')).status, 401, 'old sessions end after a reset');
  assert.equal((await world.browser().post('auth/login', { identifier: accounts.learner, password: mockPassword, audience: 'web' })).status, 401);
  assert.equal((await world.browser().post('auth/login', { identifier: accounts.learner, password: 'new-password-1', audience: 'web' })).status, 200);
  const reused = await browser.post('auth/password-reset/confirm', { token, new_password: 'another-password-1' });
  assert.equal(reused.status, 409);
  assert.equal(reused.body.error.code, 'reset_link_used');

  world.clock.advance(61 * 1000);
  await browser.post('auth/password-reset/request', { identifier: accounts.learner });
  const expiring = lastMail(world, 'reset_password').token;
  world.clock.advance(61 * 60 * 1000);
  const expired = await browser.post('auth/password-reset/confirm', { token: expiring, new_password: 'new-password-2' });
  assert.equal(expired.status, 410);
  assert.equal(expired.body.error.code, 'reset_link_expired');
  assert.equal((await browser.post('auth/password-reset/confirm', { token: lastMail(world, 'verify_email')?.token ?? 'x', new_password: 'new-password-2' })).body.error.code, 'reset_link_invalid', 'a verification token cannot reset a password');
  noUnexpected(world);
});

test('Admin creates accounts and Instructors; nobody else can', async () => {
  const world = createWorld();
  const admin = world.browser();
  const learner = world.browser();
  await admin.login(accounts.admin, { audience: 'admin' });
  await learner.login(accounts.learner);
  const payload = { username: 'new.learner', password: 'password-123', display_name: 'ผู้เรียนใหม่' };
  assert.equal((await learner.post('admin/users', payload)).status, 403);
  assert.equal((await world.browser().post('admin/users', payload)).status, 401);
  for (const extra of [{ roles: ['admin'] }, { email_verified: true }, { origin: 'google' }]) {
    assert.equal((await admin.post('admin/users', { ...payload, ...extra })).status, 422, JSON.stringify(extra));
  }
  assert.equal((await admin.post('admin/users', { ...payload, username: 'A!' })).status, 422);

  const created = await admin.post('admin/users', payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.created_by, 'usr_admin');
  assert.equal(created.body.user.origin, 'admin_created');
  assert.deepEqual(created.body.user.roles, ['learner']);
  assert.equal(created.body.user.learning_eligible, true, 'Admin-created accounts need no email verification');
  assert.ok(!created.text.includes('password-123'));
  assert.equal((await admin.post('admin/users', { ...payload, username: 'NEW.learner' })).body.error.code, 'username_taken');
  assert.equal((await admin.post('admin/users', { ...payload, username: 'another', email: 'learner@example.test' })).body.error.code, 'email_taken');
  assert.equal((await world.browser().login('new.learner', { password: 'password-123' })).username, 'new.learner');

  const id = created.body.user.id;
  assert.equal((await learner.post(`admin/users/${id}/instructor`)).status, 403);
  const promoted = await admin.post(`admin/users/${id}/instructor`);
  assert.equal(promoted.status, 200);
  assert.deepEqual(promoted.body.user.roles, ['learner', 'instructor']);
  world.clock.advance(3600 * 1000);
  const repeated = await admin.post(`admin/users/${id}/instructor`);
  assert.equal(repeated.body.added_at, promoted.body.added_at, 'repeating the command does not rewrite history');
  assert.deepEqual(repeated.body.user.roles, ['learner', 'instructor']);
  assert.equal((await admin.post('admin/users/usr_missing/instructor')).status, 404);
  assert.equal((await admin.post('admin/users/usr_admin/instructor')).status, 409);
  noUnexpected(world);
});

test('Admin can search users and list Instructors with minimal fields (proposed endpoints)', async () => {
  const world = createWorld();
  const admin = world.browser();
  const learner = world.browser();
  await admin.login(accounts.admin, { audience: 'admin' });
  await learner.login(accounts.learner);
  assert.equal((await learner.get('admin/users')).status, 403);
  assert.equal((await learner.get('admin/instructors')).status, 403);
  const search = await admin.get('admin/users?q=instructor-a');
  assert.deepEqual(search.body.items.map((user) => user.id), ['usr_instructor_a']);
  assert.ok(!search.text.includes('password') && !search.text.includes('google_subject'));
  const instructors = await admin.get('admin/instructors');
  assert.deepEqual(instructors.body.items.map((item) => item.id), ['usr_instructor_a', 'usr_instructor_b']);
  assert.deepEqual(Object.keys(instructors.body.items[0]).sort(), ['avatar_url', 'display_name', 'id']);
  assert.equal((await admin.get('admin/users?limit=1')).body.next_cursor, 'o:1');
  assert.equal((await admin.get('admin/users?bogus=1')).status, 422);
  noUnexpected(world);
});

test('free Enroll: guards, idempotency and a body that cannot carry price or user', async () => {
  const world = createWorld();
  const guest = world.browser();
  assert.equal((await guest.post('courses/crs_mock_001/enroll')).body.error.code, 'unauthenticated');

  const unverified = world.browser();
  await unverified.login(accounts.unverified);
  assert.equal((await unverified.post('courses/crs_mock_001/enroll')).body.error.code, 'email_not_verified');

  const learner = world.browser();
  await learner.login(accounts.learner);
  assert.equal((await learner.post('courses/crs_mock_001/enroll', { price: 0 })).status, 422);
  assert.equal((await learner.post('courses/crs_mock_001/enroll', { user_id: 'usr_admin' })).status, 422);
  assert.equal((await learner.post('courses/crs_mock_002/enroll')).body.error.code, 'course_not_free');
  for (const hidden of ['crs_mock_draft', 'crs_mock_pending', 'crs_mock_approved', 'crs_mock_missing']) {
    assert.equal((await learner.post(`courses/${hidden}/enroll`)).status, 404, hidden);
  }
  const first = await learner.post('courses/crs_mock_001/enroll');
  assert.equal(first.status, 201);
  assert.deepEqual(Object.keys(first.body).sort(), ['access', 'course_id', 'granted_at', 'id', 'source']);
  assert.equal(first.body.source, 'free');
  assert.equal(first.body.access, 'lifetime');
  const second = await learner.post('courses/crs_mock_001/enroll');
  assert.equal(second.status, 200);
  assert.equal(second.body.id, first.body.id);
  assert.equal([...world.db.enrollments.values()].length, 1);

  const admin = world.browser();
  await admin.login(accounts.admin, { audience: 'admin' });
  const adminResult = await admin.post('courses/crs_mock_001/enroll');
  assert.equal(adminResult.status, 403);
  assert.deepEqual([adminResult.body.error.code, adminResult.body.error.details.reason], ['enrollment_not_allowed', 'admin']);

  const owner = world.browser();
  await owner.login(accounts.instructorA);
  const ownerResult = await owner.post('courses/crs_mock_001/enroll');
  assert.deepEqual([ownerResult.status, ownerResult.body.error.details.reason], [403, 'own_course']);
  assert.equal((await owner.post('courses/crs_mock_003/enroll')).body.error.code, 'enrollment_not_allowed');
  noUnexpected(world);
});

test('Instructors can enroll in other Instructors free courses; Google and Admin-created accounts need no verification', async () => {
  const world = createWorld();
  world.db.courses.get('crs_mock_002').price = null; // make a second free course owned by Instructor B
  const instructorA = world.browser();
  await instructorA.login(accounts.instructorA);
  assert.equal((await instructorA.post('courses/crs_mock_002/enroll')).status, 201);
  const adminCreated = world.browser();
  await adminCreated.login(accounts.adminCreatedLearner);
  assert.equal((await adminCreated.post('courses/crs_mock_001/enroll')).status, 201);
  const google = world.browser();
  await google.get('auth/google/callback?mock_google_subject=g-learner&mock_google_email=fresh%40example.test&return_to=%2F');
  assert.equal((await google.post('courses/crs_mock_001/enroll')).status, 201);
  noUnexpected(world);
});

test('My enrollments are private, newest first, paginated and carry draft progress', async () => {
  const world = createWorld();
  assert.equal((await world.browser().get('me/enrollments')).status, 401);
  world.db.courses.get('crs_mock_002').price = null;
  const learner = world.browser();
  const other = world.browser();
  await learner.login(accounts.learner);
  await other.login(accounts.adminCreatedLearner);
  await learner.post('courses/crs_mock_001/enroll');
  world.clock.advance(1000);
  await learner.post('courses/crs_mock_002/enroll');
  await other.post('courses/crs_mock_003/enroll').catch(() => undefined);
  await other.post('courses/crs_mock_001/enroll');

  const mine = await learner.get('me/enrollments');
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.items.map((item) => item.course.id), ['crs_mock_002', 'crs_mock_001']);
  assert.deepEqual(mine.body.items[1].progress, { completed_items: 0, total_items: 3, completed_at: null });
  assert.deepEqual(Object.keys(mine.body.items[0].course).sort(), ['category', 'cover_url', 'id', 'instructor', 'level', 'price', 'published_at', 'slug', 'subtitle', 'title']);
  assert.ok(!mine.text.includes('SECRET'));
  assert.equal((await learner.get('me/enrollments?limit=1')).body.next_cursor, 'o:1');
  assert.equal((await learner.get('me/enrollments?user_id=usr_admin')).status, 422);
  assert.deepEqual((await other.get('me/enrollments')).body.items.map((item) => item.course.id), ['crs_mock_001']);
  noUnexpected(world);
});

test('every error uses the draft envelope and routes answer 404/405 consistently', async () => {
  const world = createWorld();
  const browser = world.browser();
  const missing = await browser.get('nothing/here');
  assert.equal(missing.status, 404);
  assert.match(missing.body.error.request_id, /^mock-request-\d+$/);
  const wrongMethod = await browser.call('DELETE', 'me');
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.body.error.code, 'method_not_allowed');
  assert.equal(missing.headers.get('x-melearn-mock'), 'provisional-api');
  const outside = await world.api.createFetcher()('/somewhere-else/me');
  assert.equal(outside.status, 404);
  noUnexpected(world);
});
