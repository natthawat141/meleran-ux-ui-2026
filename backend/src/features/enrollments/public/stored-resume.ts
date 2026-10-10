import { Prisma } from '@prisma/client';

/** Owner format; order is internal and never part of the canonical wire object. */
export function storedResume(value: Prisma.JsonValue | null, legacyUpdatedAt: Date): {
  wire: { position_seconds: number | null; updated_at: string }; order: bigint | null;
} | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid stored learning resume');
  const position = value.position_seconds;
  if (position !== null && (typeof position !== 'number' || !Number.isFinite(position) || position < 0)) throw new Error('Invalid stored learning position');
  const savedAt = value.updated_at;
  if (savedAt !== undefined && (typeof savedAt !== 'string' || !Number.isFinite(Date.parse(savedAt)) ||
      new Date(savedAt).toISOString() !== savedAt)) throw new Error('Invalid stored resume timestamp');
  const ordinal = value._resume_order;
  if (ordinal !== undefined && (typeof ordinal !== 'string' || !/^[1-9]\d{0,18}$/.test(ordinal) ||
      BigInt(ordinal) > 9223372036854775807n)) throw new Error('Invalid stored resume order');
  return { wire: { position_seconds: position, updated_at: typeof savedAt === 'string' ? savedAt : legacyUpdatedAt.toISOString() },
    order: typeof ordinal === 'string' ? BigInt(ordinal) : null };
}
