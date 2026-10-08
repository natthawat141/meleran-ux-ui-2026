// PROVISIONAL MOCK — Flow F (payments and redeem), development and tests only.
//
// Mock-only assumptions:
// - Repeating checkout with the same (user, request_id) returns the original Payment with 200.
// - A different request_id creates another Payment even when another Payment is pending.
// - Redeem-code list ordering is created_at, then id; the code generator is deterministic.
// - The proposed redeem paths are kept as specified by the test-only request.

import type { Clock, Db, PaymentEventRecord, PaymentRecord, RedeemCodeRecord } from './db.ts';
import { iso, nextId } from './db.ts';
import { findEnrollment, grantEnrollment, isPublished, toEnrollment } from './domain.ts';
import {
  ApiError, created, notFound, ok, paginate, queryProblems, readObject, rejectUnknownFields,
  requireEligible, requireRole, requiredString, validationFailed,
} from './http.ts';
import type { FieldError, MockConfig, RequestContext, Route } from './http.ts';

const fulfilmentState = new WeakMap<Db, { failNext: boolean; eventCounter: number }>();
const stateFor = (db: Db): { failNext: boolean; eventCounter: number } => {
  let state = fulfilmentState.get(db);
  if (!state) {
    state = { failNext: false, eventCounter: 0 };
    fulfilmentState.set(db, state);
  }
  return state;
};

const unavailable = (): ApiError => new ApiError(404, 'redeem_code_unavailable', 'ไม่พบรหัสแลกสิทธิ์ที่ใช้งานได้');
const paymentView = (payment: PaymentRecord, db: Db) => ({
  payment_id: payment.id, course_id: payment.course_id, status: payment.status,
  fulfillment_status: payment.fulfillment_status,
  enrollment: payment.enrollment_id ? toEnrollment(db.enrollments.get(payment.enrollment_id)!) : null,
});
const paymentAdminView = (payment: PaymentRecord, db: Db) => ({
  ...paymentView(payment, db), amount: { ...payment.amount }, user_id: payment.user_id,
  request_id: payment.request_id, checkout_session_id: payment.checkout_session_id, created_at: payment.created_at,
  events: payment.events.map((event) => ({ ...event })),
});

function parseCheckout(context: RequestContext): { courseId: string; requestId: string } {
  const body = readObject(context);
  rejectUnknownFields(body, ['course_id', 'request_id']);
  const problems: FieldError[] = [];
  const courseId = requiredString(body, 'course_id', problems);
  const requestId = requiredString(body, 'request_id', problems);
  if (problems.length) throw validationFailed(problems);
  return { courseId, requestId };
}

function signature(secret: string, rawBody: string): string {
  // Small deterministic non-cryptographic hash: this is a local simulator, not Stripe verification.
  let hash = 2166136261;
  for (const char of `${secret}.${rawBody}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `mock-sig:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function requireBuyer(context: RequestContext, courseId: string) {
  const user = requireEligible(context);
  const course = context.db.courses.get(courseId);
  if (!course || !isPublished(course)) throw notFound();
  if (user.roles.includes('admin')) {
    throw new ApiError(403, 'enrollment_not_allowed', 'บัญชี Admin ไม่สามารถซื้อคอร์สได้', { details: { reason: 'admin' } });
  }
  if (course.instructor_id === user.id) {
    throw new ApiError(403, 'enrollment_not_allowed', 'ไม่สามารถซื้อคอร์สของตนเองได้', { details: { reason: 'own_course' } });
  }
  return { user, course };
}

/** Account-level checks run BEFORE the code lookup so their answers cannot reveal whether a code exists. */
function requireRedeemer(context: RequestContext) {
  const user = requireEligible(context);
  if (user.roles.includes('admin')) {
    throw new ApiError(403, 'enrollment_not_allowed', 'บัญชี Admin ไม่สามารถแลกรหัสได้', { details: { reason: 'admin' } });
  }
  return user;
}

function redeemCourse(context: RequestContext, user: { id: string }, courseId: string) {
  const course = context.db.courses.get(courseId);
  if (!course || !isPublished(course) || !course.price || course.price.amount_minor <= 0) throw unavailable();
  if (course.instructor_id === user.id) {
    throw new ApiError(403, 'enrollment_not_allowed', 'ไม่สามารถแลกรหัสคอร์สของตนเองได้', { details: { reason: 'own_course' } });
  }
  return course;
}

function fulfilPayment(db: Db, clock: Clock, payment: PaymentRecord): boolean {
  const state = stateFor(db);
  if (state.failNext) {
    state.failNext = false;
    payment.fulfillment_status = 'failed';
    return false;
  }
  const { enrollment } = grantEnrollment(db, clock, payment.user_id, payment.course_id, 'stripe');
  payment.enrollment_id = enrollment.id;
  payment.fulfillment_status = 'granted';
  return true;
}

function processWebhook(context: RequestContext, payment: PaymentRecord, event: { id: string; type: string; data: Record<string, unknown> }): string {
  const existing = payment.events.find((candidate) => candidate.event_id === event.id);
  if (existing?.processed_at) return 'duplicate';
  const receivedAt = existing?.received_at ?? iso(context.clock.now());
  const eventRecord: PaymentEventRecord = existing ?? {
    event_id: event.id, type: event.type, received_at: receivedAt, processed_at: null, outcome: 'received',
  };
  if (!existing) payment.events.push(eventRecord);

  if (payment.status === 'succeeded' && ['checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) {
    eventRecord.outcome = 'ignored_late_terminal_event';
    eventRecord.processed_at = iso(context.clock.now());
    return 'processed';
  }

  let nextStatus: PaymentRecord['status'] | null = null;
  if (event.type === 'checkout.session.completed') {
    const paymentStatus = event.data.payment_status;
    if (paymentStatus === 'paid') nextStatus = 'succeeded';
    else if (paymentStatus === 'unpaid') nextStatus = 'processing';
    else {
      eventRecord.outcome = 'ignored_invalid_payment_status';
      eventRecord.processed_at = iso(context.clock.now());
      return 'processed';
    }
  } else if (event.type === 'checkout.session.async_payment_succeeded') nextStatus = 'succeeded';
  else if (event.type === 'checkout.session.async_payment_failed') nextStatus = 'failed';
  else if (event.type === 'checkout.session.expired') nextStatus = 'expired';
  else {
    eventRecord.outcome = 'ignored_unknown_event';
    eventRecord.processed_at = iso(context.clock.now());
    return 'processed';
  }

  if (payment.status === 'succeeded' && nextStatus !== 'succeeded') {
    eventRecord.outcome = 'ignored_late_terminal_event';
    eventRecord.processed_at = iso(context.clock.now());
    return 'processed';
  }
  payment.status = nextStatus;
  if (nextStatus === 'succeeded') {
    if (payment.fulfillment_status !== 'granted' && !fulfilPayment(context.db, context.clock, payment)) {
      eventRecord.outcome = 'fulfilment_failed';
      eventRecord.processed_at = null;
      return 'failed';
    }
    eventRecord.outcome = 'fulfilled';
  } else {
    eventRecord.outcome = nextStatus;
  }
  eventRecord.processed_at = iso(context.clock.now());
  return 'processed';
}

function maskedCode(code: string): string {
  const parts = code.split('-');
  return parts.length >= 3 ? `${parts[0]}-****-${parts.at(-1)}` : `${code.slice(0, 4)}****${code.slice(-4)}`;
}

function generateCode(db: Db): string {
  let code = '';
  do {
    const sequence = nextId(db, 'redeem').split('_').at(-1) as string;
    code = `MLN-${sequence.padStart(4, '0')}-${(Number(sequence) * 7919 % 10000).toString().padStart(4, '0')}`;
  } while ([...db.redeemCodes.values()].some((record) => record.code === code));
  return code;
}

export const paymentRoutes: Route[] = [
  {
    method: 'POST', path: 'me/payments/checkout',
    handler: (context) => {
      const { courseId, requestId } = parseCheckout(context);
      const { user, course } = requireBuyer(context, courseId);
      const existingEnrollment = findEnrollment(context.db, user.id, course.id);
      if (existingEnrollment) return ok({ already_enrolled: true, course_id: course.id, enrollment: toEnrollment(existingEnrollment) });
      if (!course.price || course.price.amount_minor <= 0) throw new ApiError(409, 'invalid_state', 'คอร์สนี้เป็นคอร์สฟรี', { details: { reason: 'course_free' } });
      const existing = [...context.db.payments.values()].find((payment) => payment.user_id === user.id && payment.request_id === requestId);
      if (existing) return ok({ payment_id: existing.id, checkout_url: `https://checkout.stripe.invalid/session/${existing.checkout_session_id}` });
      const payment: PaymentRecord = {
        id: nextId(context.db, 'pay'), user_id: user.id, course_id: course.id, request_id: requestId,
        amount: { ...course.price }, status: 'pending', fulfillment_status: 'pending', enrollment_id: null,
        checkout_session_id: nextId(context.db, 'cs'), created_at: iso(context.clock.now()), events: [],
      };
      context.db.payments.set(payment.id, payment);
      return created({ payment_id: payment.id, checkout_url: `https://checkout.stripe.invalid/session/${payment.checkout_session_id}` });
    },
  },
  {
    method: 'GET', path: 'me/payments/:id',
    handler: (context) => {
      const user = context.principal;
      if (!user) throw new ApiError(401, 'unauthenticated', 'กรุณาเข้าสู่ระบบ');
      const payment = context.db.payments.get(context.params.id);
      if (!payment || payment.user_id !== user.id) throw notFound();
      return ok(paymentView(payment, context.db));
    },
  },
  {
    method: 'POST', path: 'webhooks/stripe',
    handler: (context) => {
      const expected = signature(context.config.stripeWebhookSignature, context.rawBody);
      if (context.headers.get('stripe-signature') !== expected) throw new ApiError(400, 'invalid_signature', 'ลายเซ็นไม่ถูกต้อง');
      const body = context.body;
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(422, 'validation_failed', 'ข้อมูลที่ส่งไม่ถูกต้อง');
      const event = body as { id?: unknown; type?: unknown; data?: unknown };
      if (typeof event.id !== 'string' || typeof event.type !== 'string' || event.data === null || typeof event.data !== 'object' || Array.isArray(event.data)) {
        throw new ApiError(422, 'validation_failed', 'ข้อมูลที่ส่งไม่ถูกต้อง');
      }
      const data = event.data as Record<string, unknown>;
      const paymentId = data.payment_id;
      const sessionId = data.checkout_session_id;
      const payment = typeof paymentId === 'string' ? context.db.payments.get(paymentId) : undefined;
      if (!payment || sessionId !== payment.checkout_session_id) throw new ApiError(400, 'event_mismatch', 'เหตุการณ์ไม่ตรงกับรายการชำระเงิน');
      if (payment.events.some((candidate) => candidate.event_id === event.id && candidate.processed_at)) return ok({ received: true, duplicate: true });
      processWebhook(context, payment, { id: event.id, type: event.type, data });
      return ok({ received: true });
    },
  },
  {
    method: 'GET', path: 'admin/payments/:id',
    handler: (context) => {
      requireRole(context, 'admin');
      const payment = context.db.payments.get(context.params.id);
      if (!payment) throw notFound();
      return ok(paymentAdminView(payment, context.db));
    },
  },
  {
    method: 'POST', path: 'me/redeem',
    handler: (context) => {
      const body = readObject(context);
      rejectUnknownFields(body, ['code']);
      const problems: FieldError[] = [];
      const code = requiredString(body, 'code', problems).toUpperCase();
      if (problems.length) throw validationFailed(problems);
      const user = requireRedeemer(context);
      const record = [...context.db.redeemCodes.values()].find((candidate) => candidate.code === code);
      if (!record || record.status !== 'unused') throw unavailable();
      const course = redeemCourse(context, user, record.course_id);
      const existing = findEnrollment(context.db, user.id, course.id);
      if (existing) return ok({ already_enrolled: true, enrollment: toEnrollment(existing) });
      // All checks that can fail are complete before the state transition. Map mutation is synchronous,
      // which makes the transition atomic for this single-threaded provisional server.
      const { enrollment } = grantEnrollment(context.db, context.clock, user.id, course.id, 'redeem');
      record.status = 'used';
      record.used_by = user.id;
      record.used_at = iso(context.clock.now());
      return created({ already_enrolled: false, enrollment: toEnrollment(enrollment) });
    },
  },
  {
    method: 'POST', path: 'admin/redeem-codes',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const body = context.body === undefined ? {} : readObject(context);
      rejectUnknownFields(body, ['course_id', 'count']);
      const problems: FieldError[] = [];
      const courseId = requiredString(body, 'course_id', problems);
      const count = body.count === undefined ? 1 : typeof body.count === 'number' && Number.isInteger(body.count) ? body.count : 0;
      if (count < 1 || count > 50) problems.push({ field: 'count', code: 'out_of_range' });
      if (problems.length) throw validationFailed(problems);
      const course = context.db.courses.get(courseId);
      if (!course || !isPublished(course)) throw notFound();
      if (!course.price || course.price.amount_minor <= 0) throw new ApiError(409, 'invalid_state', 'คอร์สฟรีไม่สามารถออกโค้ดขายได้', { details: { reason: 'course_free' } });
      const items: Record<string, unknown>[] = [];
      for (let index = 0; index < count; index += 1) {
        const record: RedeemCodeRecord = {
          id: nextId(context.db, 'rdm'), code: generateCode(context.db), course_id: courseId, status: 'unused',
          created_by: admin.id, created_at: iso(context.clock.now()), used_by: null, used_at: null, revoked_by: null, revoked_at: null,
        };
        context.db.redeemCodes.set(record.id, record);
        items.push({ id: record.id, code: record.code, course_id: record.course_id, status: record.status, created_at: record.created_at });
      }
      return created({ items });
    },
  },
  {
    method: 'GET', path: 'admin/redeem-codes',
    handler: (context) => {
      requireRole(context, 'admin');
      const problems = queryProblems(context.query, ['course_id', 'status', 'limit', 'cursor']);
      const courseId = context.query.get('course_id');
      const status = context.query.get('status');
      if (status !== null && !['unused', 'used', 'revoked'].includes(status)) problems.push({ field: 'status', code: 'invalid' });
      const records = [...context.db.redeemCodes.values()]
        .filter((record) => courseId === null || record.course_id === courseId)
        .filter((record) => status === null || record.status === status)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      const page = paginate(records, context.query, context.config, problems);
      return ok({
        items: page.items.map((record) => ({
          id: record.id, code_masked: maskedCode(record.code), course_id: record.course_id, status: record.status,
          created_at: record.created_at, used_by: record.used_by, used_at: record.used_at, revoked_at: record.revoked_at,
        })),
        next_cursor: page.next_cursor,
      });
    },
  },
  {
    method: 'POST', path: 'admin/redeem-codes/:id/revoke',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const record = context.db.redeemCodes.get(context.params.id);
      if (!record) throw notFound();
      if (record.status === 'used') throw new ApiError(409, 'invalid_state', 'รหัสถูกใช้แล้ว', { details: { reason: 'used' } });
      if (record.status === 'revoked') return ok({ id: record.id, status: record.status, revoked_at: record.revoked_at });
      record.status = 'revoked';
      record.revoked_by = admin.id;
      record.revoked_at = iso(context.clock.now());
      return ok({ id: record.id, status: record.status, revoked_at: record.revoked_at });
    },
  },
];

export function createStripeSimulator(db: Db, clock: Clock, config: MockConfig) {
  void clock;
  const state = stateFor(db);
  const build = (paymentId: string, type: string, options: { eventId?: string; paymentStatus?: 'paid' | 'unpaid' } = {}) => {
    const payment = db.payments.get(paymentId);
    if (!payment) throw new Error(`Unknown payment ${paymentId}`);
    const eventId = options.eventId ?? `evt_mock_${++state.eventCounter}`;
    const data: Record<string, unknown> = { payment_id: payment.id, checkout_session_id: payment.checkout_session_id };
    if (type === 'checkout.session.completed') data.payment_status = options.paymentStatus ?? 'paid';
    const body = JSON.stringify({ id: eventId, type, data });
    return { body, headers: { 'stripe-signature': signature(config.stripeWebhookSignature, body), 'content-type': 'application/json' } };
  };
  return {
    sign: (rawBody: string) => signature(config.stripeWebhookSignature, rawBody),
    completed: (paymentId: string, options: { eventId?: string; paymentStatus?: 'paid' | 'unpaid' } = {}) => build(paymentId, 'checkout.session.completed', options),
    asyncSucceeded: (paymentId: string, options: { eventId?: string } = {}) => build(paymentId, 'checkout.session.async_payment_succeeded', options),
    asyncFailed: (paymentId: string, options: { eventId?: string } = {}) => build(paymentId, 'checkout.session.async_payment_failed', options),
    expired: (paymentId: string, options: { eventId?: string } = {}) => build(paymentId, 'checkout.session.expired', options),
    failNextFulfilment: () => { state.failNext = true; },
  };
}
