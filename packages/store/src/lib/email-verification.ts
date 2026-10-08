import type { EmailVerification } from '../types';

// The 24-hour link lifetime is confirmed for the prototype flow.
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
// Prototype-only cooldown configuration; its value is not a finalized business policy.
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export type VerificationTokenState = 'valid' | 'used' | 'expired' | 'missing';

export function verificationTokenState(
  verification: EmailVerification | undefined,
  now = Date.now()
): VerificationTokenState {
  if (!verification) return 'missing';
  if (verification.usedAt) return 'used';
  const expiresAt = Date.parse(verification.expiresAt);
  if (!Number.isFinite(expiresAt)) return 'missing';
  if (expiresAt <= now) return 'expired';
  return 'valid';
}

export function verificationResendAvailable(verification: EmailVerification | undefined, now = Date.now()): boolean {
  return verificationResendRemainingMs(verification, now) === 0;
}

export function verificationResendRemainingMs(verification: EmailVerification | undefined, now = Date.now()): number {
  if (!verification) return 0;
  const lastSentAt = Date.parse(verification.lastSentAt);
  if (!Number.isFinite(lastSentAt)) return EMAIL_VERIFICATION_RESEND_COOLDOWN_MS;
  return Math.max(0, EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - (now - lastSentAt));
}
