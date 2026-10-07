import type { Course, Enrollment, User } from '../types';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
export type PaymentFulfillmentStatus = 'pending' | 'granted' | 'failed';
export type PaymentEnrollment = Pick<Enrollment, 'id' | 'courseId'> & { source: 'free' | 'redeem' | 'stripe' };

export interface CheckoutSessionResponse {
  payment_id: string;
  checkout_url: string;
}

export interface AlreadyEnrolledResponse {
  already_enrolled: true;
  course_id: string;
  enrollment: PaymentEnrollment;
}

export type CheckoutResponse = CheckoutSessionResponse | AlreadyEnrolledResponse;

export interface PaymentStatusResponse {
  payment_id: string;
  course_id: string;
  status: PaymentStatus;
  fulfillment_status: PaymentFulfillmentStatus;
  enrollment: PaymentEnrollment | null;
}

export type PaymentEligibility =
  | { eligible: true }
  | { eligible: false; reason: 'course_unavailable' | 'not_allowed' | 'suspended' | 'email_unverified' | 'already_enrolled' | 'course_owner' };

export function getPaymentEligibility(user: User | null, course: Course | undefined, enrollments: Enrollment[]): PaymentEligibility {
  if (!course || course.status !== 'published' || course.price <= 0) return { eligible: false, reason: 'course_unavailable' };
  if (!user || user.role === 'admin') return { eligible: false, reason: 'not_allowed' };
  if (user.status === 'suspended') return { eligible: false, reason: 'suspended' };
  if (user.emailVerified === false) return { eligible: false, reason: 'email_unverified' };
  if (user.role === 'instructor' && user.id === course.instructorId) return { eligible: false, reason: 'course_owner' };
  if (enrollments.some((entry) => entry.userId === user.id && entry.courseId === course.id)) return { eligible: false, reason: 'already_enrolled' };
  return { eligible: true };
}

export class PaymentApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'PaymentApiError';
    this.status = status;
    this.code = code;
  }
}

type Fetcher = typeof fetch;
const REQUEST_TIMEOUT_MS = 15_000;
const apiPrefix = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? '';
const API_BASE = /^\/(?!\/)/.test(apiPrefix) ? apiPrefix.replace(/\/+$/, '') : '';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEnrollment(value: unknown): PaymentEnrollment | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.course_id !== 'string'
    || !['free', 'redeem', 'stripe'].includes(String(value.source))) return null;
  return { id: value.id, courseId: value.course_id, source: value.source as PaymentEnrollment['source'] };
}

function parseCheckoutResponse(value: unknown): CheckoutResponse {
  if (isRecord(value) && value.already_enrolled === true) {
    const enrollment = parseEnrollment(value.enrollment);
    if (typeof value.course_id === 'string' && enrollment?.courseId === value.course_id) {
      return { already_enrolled: true, course_id: value.course_id, enrollment };
    }
  }
  if (isRecord(value) && typeof value.payment_id === 'string' && typeof value.checkout_url === 'string') {
    return { payment_id: value.payment_id, checkout_url: value.checkout_url };
  }
  throw new PaymentApiError('เซิร์ฟเวอร์ตอบข้อมูลเริ่มชำระเงินไม่ถูกต้อง');
}

export function isHostedStripeCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.username && !url.password && (url.port === '' || url.port === '443');
  } catch {
    return false;
  }
}

async function requestJson(path: string, init: RequestInit, fetcher: Fetcher, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) throw new PaymentApiError('คำขอถูกยกเลิก', undefined, 'aborted');
  signal?.addEventListener('abort', forwardAbort, { once: true });
  const timeout = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(`${API_BASE}${path}`, { credentials: 'include', ...init, signal: controller.signal, headers: { Accept: 'application/json', ...init.headers } });
    if (signal?.aborted) throw new PaymentApiError('คำขอถูกยกเลิก', undefined, 'aborted');
    if (controller.signal.aborted) throw new PaymentApiError('ระบบชำระเงินใช้เวลาตอบสนองนานเกินไป กรุณาลองอีกครั้ง', undefined, 'timeout');
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new PaymentApiError('ระบบชำระเงินยังไม่พร้อมใช้งาน', response.status);
    }
    let body: unknown;
    try { body = await response.json(); }
    catch {
      if (signal?.aborted) throw new PaymentApiError('คำขอถูกยกเลิก', undefined, 'aborted');
      if (controller.signal.aborted) throw new PaymentApiError('ระบบชำระเงินใช้เวลาตอบสนองนานเกินไป กรุณาลองอีกครั้ง', undefined, 'timeout');
      throw new PaymentApiError('ระบบชำระเงินตอบข้อมูลไม่สมบูรณ์', response.status);
    }
    if (signal?.aborted) throw new PaymentApiError('คำขอถูกยกเลิก', undefined, 'aborted');
    if (controller.signal.aborted) throw new PaymentApiError('ระบบชำระเงินใช้เวลาตอบสนองนานเกินไป กรุณาลองอีกครั้ง', undefined, 'timeout');
    if (!response.ok) {
      const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
      const message = response.status === 401 ? 'กรุณาเข้าสู่ระบบบัญชีที่ใช้ชำระเงินอีกครั้ง'
        : response.status === 404 ? 'ไม่พบรายการชำระเงินนี้'
          : isRecord(body) && typeof body.message === 'string' ? body.message : 'ตรวจสอบสถานะกับระบบชำระเงินไม่ได้';
      throw new PaymentApiError(message, response.status, code);
    }
    return body;
  } catch (cause) {
    if (cause instanceof PaymentApiError) throw cause;
    if (signal?.aborted) throw new PaymentApiError('คำขอถูกยกเลิก', undefined, 'aborted');
    if (controller.signal.aborted) throw new PaymentApiError('ระบบชำระเงินใช้เวลาตอบสนองนานเกินไป กรุณาลองอีกครั้ง', undefined, 'timeout');
    throw new PaymentApiError('เชื่อมต่อระบบชำระเงินไม่ได้ กรุณาลองใหม่');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

export async function createCheckoutSession(input: { courseId: string; requestId: string }, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<CheckoutResponse> {
  const body = await requestJson('/me/payments/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_id: input.courseId, request_id: input.requestId }),
  }, fetcher, signal);
  const result = parseCheckoutResponse(body);
  if ('already_enrolled' in result) return result;
  if (!isHostedStripeCheckoutUrl(result.checkout_url)) throw new PaymentApiError('ลิงก์ Stripe Checkout ไม่ปลอดภัยหรือไม่ถูกต้อง');
  return result;
}

export async function getPaymentStatus(paymentId: string, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<PaymentStatusResponse> {
  const body = await requestJson(`/me/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' }, fetcher, signal);
  if (!isRecord(body) || typeof body.payment_id !== 'string' || body.payment_id.length === 0 || body.payment_id !== paymentId
    || typeof body.course_id !== 'string' || body.course_id.length === 0
    || !['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired'].includes(String(body.status))
    || !['pending', 'granted', 'failed'].includes(String(body.fulfillment_status))) {
    throw new PaymentApiError('เซิร์ฟเวอร์ตอบสถานะการชำระเงินไม่ถูกต้อง');
  }
  const enrollment = body.enrollment === null ? null : parseEnrollment(body.enrollment);
  if (body.enrollment !== null && !enrollment) throw new PaymentApiError('เซิร์ฟเวอร์ตอบข้อมูลสิทธิ์เรียนไม่ถูกต้อง');
  return {
    payment_id: body.payment_id,
    course_id: body.course_id,
    status: body.status as PaymentStatus,
    fulfillment_status: body.fulfillment_status as PaymentFulfillmentStatus,
    enrollment,
  };
}

export function paymentGrantsCourseAccess(payment: PaymentStatusResponse, expectedCourseId: string): boolean {
  return payment.status === 'succeeded'
    && payment.fulfillment_status === 'granted'
    && payment.course_id === expectedCourseId
    && payment.enrollment?.courseId === expectedCourseId;
}
