import type { EnrollmentDto } from './generated/types.gen.ts';

/** Decode the shared HTTP entitlement projection, never grant access from client state. */
export function decodeEnrollmentDto(value: unknown): EnrollmentDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid enrollment');
  const row = value as Record<string, unknown>;
  const string = (field: string): string => {
    const entry = row[field];
    if (typeof entry !== 'string' || !entry) throw new TypeError(`Invalid enrollment ${field}`);
    return entry;
  };
  if (row.source !== 'free' && row.source !== 'redeem' && row.source !== 'stripe') throw new TypeError('Invalid enrollment source');
  if (row.access !== 'lifetime') throw new TypeError('Invalid enrollment access');
  const grantedAt = string('granted_at');
  if (!Number.isFinite(Date.parse(grantedAt))) throw new TypeError('Invalid enrollment timestamp');
  return { id: string('id'), course_id: string('course_id'), source: row.source, access: row.access, granted_at: grantedAt };
}
