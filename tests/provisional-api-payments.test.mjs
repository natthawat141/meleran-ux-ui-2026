import assert from 'node:assert/strict';
import test from 'node:test';
import { accounts, createBrowser, createWorld } from './support/provisional-api.mjs';

async function loggedIn(world, identifier = accounts.learner, options) {
  const browser = createBrowser(world.api);
  await browser.login(identifier, options);
  return browser;
}

test('checkout rejects client-owned payment fields and snapshots the course price', async () => {
  const world = createWorld();
  const browser = await loggedIn(world);
  const invalid = await browser.post('me/payments/checkout', {
    course_id: 'crs_mock_002', request_id: 'r-1', amount: 1, price: 1, currency: 'USD', user_id: 'usr_admin',
  });
  assert.equal(invalid.status, 422);
  const result = await browser.post('me/payments/checkout', { course_id: 'crs_mock_002', request_id: 'r-1' });
  assert.equal(result.status, 201);
  assert.equal(world.db.payments.get(result.body.payment_id).amount.amount_minor, 99000);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('free courses cannot start Stripe checkout or receive sale redeem codes', async () => {
  const world = createWorld();
  const learner = await loggedIn(world);
  const admin = await loggedIn(world, accounts.admin, { audience: 'admin' });
  const checkout = await learner.post('me/payments/checkout', { course_id: 'crs_mock_001', request_id: 'free-checkout' });
  assert.equal(checkout.status, 409);
  assert.equal(checkout.body.error.details.reason, 'course_free');
  const redeemCodes = await admin.post('admin/redeem-codes', { course_id: 'crs_mock_001', count: 1 });
  assert.equal(redeemCodes.status, 409);
  assert.equal(redeemCodes.body.error.details.reason, 'course_free');
  assert.equal([...world.db.redeemCodes.values()].some((code) => code.course_id === 'crs_mock_001'), false);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('checkout idempotency and status reads never grant access', async () => {
  const world = createWorld();
  const browser = await loggedIn(world);
  const first = await browser.post('me/payments/checkout', { course_id: 'crs_mock_002', request_id: 'same' });
  const second = await browser.post('me/payments/checkout', { course_id: 'crs_mock_002', request_id: 'same' });
  assert.equal(second.status, 200);
  assert.equal(second.body.payment_id, first.body.payment_id);
  assert.equal((await browser.get(`me/payments/${first.body.payment_id}`)).body.enrollment, null);
  assert.equal(world.db.enrollments.size, 0);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('webhook signature, binding, fulfillment and duplicate delivery are enforced', async () => {
  const world = createWorld();
  const browser = await loggedIn(world);
  const created = await browser.post('me/payments/checkout', { course_id: 'crs_mock_002', request_id: 'webhook' });
  const event = world.api.stripe.completed(created.body.payment_id, { eventId: 'evt-one' });
  assert.equal((await browser.post('webhooks/stripe', event.body.replace('paid', 'unpaid'), event.headers)).status, 400);
  assert.equal((await browser.post('webhooks/stripe', event.body, { ...event.headers, 'stripe-signature': 'wrong' })).status, 400);
  assert.equal((await browser.post('webhooks/stripe', event.body, event.headers)).status, 200);
  assert.equal((await browser.post('webhooks/stripe', event.body, event.headers)).body.duplicate, true);
  assert.equal(world.db.enrollments.size, 1);
  assert.equal(world.db.enrollments.values().next().value.source, 'stripe');
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('failed fulfillment remains retryable for the same event', async () => {
  const world = createWorld();
  const browser = await loggedIn(world);
  const created = await browser.post('me/payments/checkout', { course_id: 'crs_mock_002', request_id: 'retry' });
  const event = world.api.stripe.completed(created.body.payment_id, { eventId: 'evt-retry' });
  world.api.stripe.failNextFulfilment();
  await browser.post('webhooks/stripe', event.body, event.headers);
  assert.deepEqual((await browser.get(`me/payments/${created.body.payment_id}`)).body, {
    payment_id: created.body.payment_id, course_id: 'crs_mock_002', status: 'succeeded',
    fulfillment_status: 'failed', enrollment: null,
  });
  await browser.post('webhooks/stripe', event.body, event.headers);
  assert.equal(world.db.enrollments.size, 1);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('redeem normalizes codes, leaves an existing enrollment unused, and masks listing', async () => {
  const world = createWorld();
  const browser = await loggedIn(world);
  const first = await browser.post('me/redeem', { code: ' mock-unused-0001 ' });
  assert.equal(first.status, 201);
  assert.equal(first.body.enrollment.source, 'redeem');
  const unavailable = await browser.post('me/redeem', { code: 'MOCK-UNUSED-0001' });
  assert.equal(unavailable.status, 404);
  const admin = await loggedIn(world, accounts.admin, { audience: 'admin' });
  const listed = await admin.get('admin/redeem-codes?course_id=crs_mock_002');
  assert.ok(listed.body.items.every((item) => !item.code));
  assert.ok(listed.body.items.some((item) => item.code_masked === 'MOCK-****-0001'));
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('redeem failure for a deleted course is atomic', async () => {
  const world = createWorld();
  const browser = await loggedIn(world);
  const before = world.db.redeemCodes.get('rdm_seed_unused');
  world.db.courses.delete('crs_mock_002');
  const result = await browser.post('me/redeem', { code: before.code });
  assert.equal(result.status, 404);
  assert.equal(before.status, 'unused');
  assert.equal(world.db.enrollments.size, 0);
  assert.deepEqual(world.api.unexpectedErrors, []);
});

test('payment and redeem list endpoints are not exposed', async () => {
  const world = createWorld();
  const browser = await loggedIn(world);
  assert.equal((await browser.get('me/payments')).status, 404);
  assert.equal((await browser.get('admin/payments')).status, 404);
  assert.deepEqual(world.api.unexpectedErrors, []);
});
