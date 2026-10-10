import type { WireRedeemAdminCourse as RedeemAdminCourse, WireAdminRedeemCode as AdminRedeemCode } from '@melearn/contracts';
export type { WireRedeemAdminCourse as RedeemAdminCourse, WireAdminRedeemCode as AdminRedeemCode } from '@melearn/contracts';
import { apiClient as http } from '../../../shared/api/client';

const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid redeem-code response'); return value as Record<string, unknown>; };
const string = (value: unknown): string => { if (typeof value !== 'string') throw new TypeError('Invalid redeem-code response'); return value; };
const status = (value: unknown): AdminRedeemCode['status'] => { if (value !== 'unused' && value !== 'used' && value !== 'revoked') throw new TypeError('Invalid redeem-code response'); return value; };

export const redeemAdminApi = {
  courses: () => http.request('courses?price_type=paid&limit=50', { method: 'GET', decoder: (value) => {
    const items = record(value).items; if (!Array.isArray(items)) throw new TypeError('Invalid admin course list');
    return items.map((item) => { const row = record(item); const price = record(row.price); const amount = price.amount_minor; if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) throw new TypeError('Invalid paid course price'); return { id: string(row.id), title: string(row.title), price: { amount_minor: amount, currency: string(price.currency) } }; });
  } }),
  codes: () => http.request('admin/redeem-codes?limit=50', { method: 'GET', decoder: (value) => {
    const items = record(value).items; if (!Array.isArray(items)) throw new TypeError('Invalid redeem-code list');
    return items.map((item) => { const row = record(item); return { id: string(row.id), code_masked: string(row.code_masked), course_id: string(row.course_id), status: status(row.status), created_at: string(row.created_at), used_by: row.used_by === null ? null : string(row.used_by), used_at: row.used_at === null ? null : string(row.used_at), revoked_at: row.revoked_at === null ? null : string(row.revoked_at) }; });
  } }),
  create: (courseId: string, count: number) => http.request('admin/redeem-codes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_id: courseId, count }), decoder: (value) => {
    const items = record(value).items; if (!Array.isArray(items)) throw new TypeError('Invalid created codes');
    return items.map((item) => { const row = record(item); if (status(row.status) !== 'unused') throw new TypeError('Invalid newly created redeem-code status'); return { id: string(row.id), code: string(row.code), course_id: string(row.course_id), status: 'unused', created_at: string(row.created_at) }; });
  } }),
  revoke: (id: string) => http.request(`admin/redeem-codes/${encodeURIComponent(id)}/revoke`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', decoder: (value) => { const row = record(value); if (row.status !== 'revoked') throw new TypeError('Invalid revoked redeem-code status'); return { id: string(row.id), status: 'revoked' as const, revoked_at: string(row.revoked_at) }; } }),
};
