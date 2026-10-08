import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCheckoutSession, getPaymentStatus, getPaymentEligibility, isHostedStripeCheckoutUrl, paymentGrantsCourseAccess } from '../packages/store/src/api/payments.ts';
import type { Course, Enrollment, User } from '../packages/store/src/types.ts';

const user = (values: Partial<User> = {}) => ({ id: 'learner-1', role: 'learner', email: 'learner@example.test', name: 'Learner', ...values }) as User;
const course = (values: Partial<Course> = {}) => ({ id: 'course-1', instructorId: 'teacher-1', price: 1250, status: 'published', ...values }) as Course;
const enrollment = (values: Partial<Enrollment> = {}) => ({ id: 'enroll-1', userId: 'learner-1', courseId: 'course-1', createdAt: '', ...values }) as Enrollment;
const response = (body: unknown, status = 200, contentType = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });

test('checkout sends only course_id and request_id and accepts a hosted Stripe URL', async () => {
  let captured: RequestInit | undefined;
  const result = await createCheckoutSession({ courseId: 'course-1', requestId: 'req-1' }, async (_input, init) => {
    captured = init;
    return response({ payment_id: 'pay-1', checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
  });
  assert.deepEqual(JSON.parse(String(captured?.body)), { course_id: 'course-1', request_id: 'req-1' });
  assert.deepEqual(result, { payment_id: 'pay-1', checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
});

test('checkout rejects an unsafe or forged success URL', async () => {
  await assert.rejects(createCheckoutSession({ courseId: 'course-1', requestId: 'req-1' }, async () => response({ payment_id: 'pay-1', checkout_url: 'https://example.test/success?status=paid' })), /ไม่ปลอดภัย/);
  assert.equal(isHostedStripeCheckoutUrl('http://checkout.stripe.com/pay'), false);
  assert.equal(isHostedStripeCheckoutUrl('https://checkout.stripe.com.attacker.test/pay'), false);
  assert.equal(isHostedStripeCheckoutUrl('https://checkout.stripe.com/pay'), true);
});

test('aborted checkout cannot return a session URL that could send the user to Stripe', async () => {
  const controller = new AbortController();
  const request = createCheckoutSession({ courseId: 'course-1', requestId: 'req-1' }, async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }), controller.signal);
  controller.abort();
  await assert.rejects(request, (error: unknown) => error instanceof Error && 'code' in error && error.code === 'aborted');
});

test('Vite HTML fallback is reported as payment service not ready', async () => {
  await assert.rejects(getPaymentStatus('pay-1', async () => new Response('<div id="root"></div>', { headers: { 'content-type': 'text/html' } })), /ยังไม่พร้อมใช้งาน/);
});

test('status endpoint is read-only and does not grant access while fulfillment is pending', async () => {
  let captured: RequestInit | undefined;
  const status = await getPaymentStatus('pay/1', async (input, init) => {
    captured = init;
    assert.equal(String(input).endsWith('/me/payments/pay%2F1'), true);
    return response({ payment_id: 'pay/1', course_id: 'course-1', status: 'succeeded', fulfillment_status: 'pending', enrollment: null });
  });
  assert.equal(captured?.method, 'GET');
  assert.equal(captured?.body, undefined);
  assert.equal(paymentGrantsCourseAccess(status, 'course-1'), false);
  await assert.rejects(getPaymentStatus('pay-1', async () => response({ payment_id: 'another-payment', course_id: 'course-1', status: 'succeeded', fulfillment_status: 'granted', enrollment: { id: 'enroll-1', course_id: 'course-1', source: 'stripe' } })), /ไม่ถูกต้อง/);
});

test('only succeeded and granted server status with matching enrollment unlocks course', async () => {
  const base = { payment_id: 'pay-1', course_id: 'course-1', status: 'succeeded' as const, fulfillment_status: 'granted' as const };
  const granted = { ...base, enrollment: { id: 'enroll-1', courseId: 'course-1', source: 'redeem' as const } };
  assert.equal(paymentGrantsCourseAccess(granted, 'course-1'), true);
  assert.equal(paymentGrantsCourseAccess({ ...granted, status: 'pending' }, 'course-1'), false);
  assert.equal(paymentGrantsCourseAccess({ ...granted, fulfillment_status: 'failed' }, 'course-1'), false);
  assert.equal(paymentGrantsCourseAccess({ ...granted, enrollment: { ...granted.enrollment, courseId: 'course-2' } }, 'course-1'), false);
  assert.equal(paymentGrantsCourseAccess({ ...granted, course_id: 'course-2' }, 'course-1'), false);
});

test('checkout eligibility allows other courses to instructors and blocks forbidden accounts', () => {
  assert.deepEqual(getPaymentEligibility(user(), course(), []), { eligible: true });
  assert.deepEqual(getPaymentEligibility(user({ role: 'admin' }), course(), []), { eligible: false, reason: 'not_allowed' });
  assert.deepEqual(getPaymentEligibility(user({ role: 'instructor' }), course({ instructorId: 'learner-1' }), []), { eligible: false, reason: 'course_owner' });
  assert.deepEqual(getPaymentEligibility(user({ status: 'suspended' }), course(), []), { eligible: false, reason: 'suspended' });
  assert.deepEqual(getPaymentEligibility(user({ emailVerified: false }), course(), []), { eligible: false, reason: 'email_unverified' });
  assert.deepEqual(getPaymentEligibility(user(), course(), [enrollment()]), { eligible: false, reason: 'already_enrolled' });
  assert.deepEqual(getPaymentEligibility(user(), course({ status: 'draft' }), []), { eligible: false, reason: 'course_unavailable' });
});
