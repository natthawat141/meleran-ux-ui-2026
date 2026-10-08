import type { WirePaymentView as PaymentView, WireCheckoutResult as CheckoutResult, WireRedeemResult as RedeemResult } from '@melearn/contracts';
export type { WirePaymentView as PaymentView, WireCheckoutResult as CheckoutResult, WireRedeemResult as RedeemResult } from '@melearn/contracts';
import { apiClient as http, apiConfig } from '../../../shared/api/client';

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid provisional payment response');
  return value as Record<string, unknown>;
};
const string = (value: unknown): string => {
  if (typeof value !== 'string') throw new TypeError('Invalid provisional payment response');
  return value;
};

function decodeWebhookReceipt(value: unknown): { received: true } {
  const row = object(value);
  if (row.received !== true) throw new TypeError('Invalid provisional webhook receipt');
  return { received: true };
}

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
  simulateStripeCompletion: (paymentId: string) => {
    if (!apiConfig.mock) throw new Error('Stripe simulation is available only in mock mode');
    return http.request(`dev/mock-stripe/payments/${encodeURIComponent(paymentId)}/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', decoder: decodeWebhookReceipt });
  },
  redeem: (code: string) => http.request('me/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }), decoder: decodeRedeem }),
};
