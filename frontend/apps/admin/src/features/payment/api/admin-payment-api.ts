import type { WireAdminPayment as AdminPayment } from '@melearn/contracts';
export type { WireAdminPayment as AdminPayment } from '@melearn/contracts';
import { apiClient as http } from '../../../shared/api/client';
import { decodeEnrollmentDto } from '@melearn/contracts';

const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Admin payment response'); return value as Record<string, unknown>; };
const text = (value: unknown): string => { if (typeof value !== 'string') throw new TypeError('Invalid Admin payment response'); return value; };
const nullableText = (value: unknown): string | null => value === null ? null : text(value);

function decodePayment(value: unknown): AdminPayment {
  const row = record(value); const amount = record(row.amount);
  const statuses = ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired'];
  const fulfillmentStates = ['pending', 'granted', 'failed'];
  if (!statuses.includes(String(row.status)) || !fulfillmentStates.includes(String(row.fulfillment_status))) throw new TypeError('Invalid Admin payment state');
  const amountMinor = amount.amount_minor;
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new TypeError('Invalid Admin payment amount');
  if (amount.currency !== 'THB') throw new TypeError('Invalid Admin payment currency');
  const enrollment = row.enrollment === null ? null : record(row.enrollment);
  if (!Array.isArray(row.events)) throw new TypeError('Invalid Admin payment events');
  return {
    payment_id: text(row.payment_id), course_id: text(row.course_id), user_id: text(row.user_id), request_id: text(row.request_id),
    checkout_session_id: text(row.checkout_session_id), amount: { amount_minor: amountMinor, currency: amount.currency },
    status: row.status as AdminPayment['status'], fulfillment_status: row.fulfillment_status as AdminPayment['fulfillment_status'],
    enrollment: enrollment ? decodeEnrollmentDto(enrollment) : null,
    created_at: text(row.created_at), events: row.events.map((entry) => {
      const event = record(entry); return { event_id: text(event.event_id), type: text(event.type), received_at: text(event.received_at), processed_at: nullableText(event.processed_at), outcome: text(event.outcome) };
    }),
  };
}

export const adminPaymentApi = {
  get: (paymentId: string, signal?: AbortSignal) => http.request(`admin/payments/${encodeURIComponent(paymentId)}`, { method: 'GET', signal, decoder: decodePayment }),
};
