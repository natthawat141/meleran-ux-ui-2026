import type { WirePaymentView as PaymentView, WireCheckoutResult as CheckoutResult, WireRedeemResult as RedeemResult } from '@melearn/contracts';
export type { WirePaymentView as PaymentView, WireCheckoutResult as CheckoutResult, WireRedeemResult as RedeemResult } from '@melearn/contracts';
import { apiClient as http, apiConfig } from '../../../shared/api/client';
import { decodeEnrollmentDto } from '@melearn/contracts';
import type { AlreadyEnrolledCheckout } from '@melearn/contracts/http';

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
    enrollment: enrollment ? decodeEnrollmentDto(enrollment) : null,
  };
}

function decodeCheckout(value: unknown): CheckoutResult | AlreadyEnrolledCheckout {
  const row = object(value);
  if (row.already_enrolled === true) {
    const courseId = string(row.course_id);
    const enrollment = decodeEnrollmentDto(row.enrollment);
    if (enrollment.course_id !== courseId) throw new TypeError('Invalid checkout enrollment course');
    return { already_enrolled: true, course_id: courseId, enrollment };
  }
  if (row.already_enrolled !== false) throw new TypeError('Invalid checkout state');
  return { payment_id: string(row.payment_id), checkout_url: string(row.checkout_url), already_enrolled: false };
}

function decodeRedeem(value: unknown): RedeemResult {
  const row = object(value); const enrollment = object(row.enrollment);
  if (typeof row.already_enrolled !== 'boolean') throw new TypeError('Invalid redeem response');
  return { already_enrolled: row.already_enrolled, enrollment: decodeEnrollmentDto(enrollment) };
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
