import { createHttpClient } from '@melearn/api-client';

const http = createHttpClient({ baseUrl: '/mock-api/v1', fetcher: globalThis.fetch.bind(globalThis), headers: { accept: 'application/json', 'x-melearn-app': 'web' }, credentials: 'same-origin', timeoutMs: 8_000 });
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid provisional payment response');
  return value as Record<string, unknown>;
};
const string = (value: unknown): string => {
  if (typeof value !== 'string') throw new TypeError('Invalid provisional payment response');
  return value;
};

export interface PaymentView {
  payment_id: string; course_id: string; status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  fulfillment_status: 'pending' | 'granted' | 'failed'; enrollment: { id: string; course_id: string; source: string } | null;
}
export interface CheckoutResult { payment_id: string; checkout_url: string; already_enrolled?: false }
export interface RedeemResult { already_enrolled: boolean; enrollment: { id: string; course_id: string; source: string; access: string; granted_at: string } }

function decodePayment(value: unknown): PaymentView {
  const row = object(value);
  const statuses = ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired'];
  const fulfillment = ['pending', 'granted', 'failed'];
  if (!statuses.includes(String(row.status)) || !fulfillment.includes(String(row.fulfillment_status))) throw new TypeError('Invalid payment state');
  const enrollment = row.enrollment === null ? null : object(row.enrollment);
  return {
    payment_id: string(row.payment_id), course_id: string(row.course_id), status: row.status as PaymentView['status'],
    fulfillment_status: row.fulfillment_status as PaymentView['fulfillment_status'],
    enrollment: enrollment ? { id: string(enrollment.id), course_id: string(enrollment.course_id), source: string(enrollment.source) } : null,
  };
}

function decodeCheckout(value: unknown): CheckoutResult | { already_enrolled: true; course_id: string } {
  const row = object(value);
  if (row.already_enrolled === true) return { already_enrolled: true, course_id: string(row.course_id) };
  return { payment_id: string(row.payment_id), checkout_url: string(row.checkout_url), already_enrolled: false };
}

function decodeRedeem(value: unknown): RedeemResult {
  const row = object(value); const enrollment = object(row.enrollment);
  if (typeof row.already_enrolled !== 'boolean') throw new TypeError('Invalid redeem response');
  return { already_enrolled: row.already_enrolled, enrollment: {
    id: string(enrollment.id), course_id: string(enrollment.course_id), source: string(enrollment.source),
    access: string(enrollment.access), granted_at: string(enrollment.granted_at),
  } };
}

export const paymentApi = {
  checkout: (courseId: string, requestId: string) => http.request('me/payments/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_id: courseId, request_id: requestId }), decoder: decodeCheckout }),
  status: (paymentId: string, signal?: AbortSignal) => http.request(`me/payments/${encodeURIComponent(paymentId)}`, { method: 'GET', signal, decoder: decodePayment }),
  redeem: (code: string) => http.request('me/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }), decoder: decodeRedeem }),
};
