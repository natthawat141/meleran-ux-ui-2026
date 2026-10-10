export type Role = 'learner' | 'instructor' | 'admin';

/** Prototype/UI compatibility model; never use this as an HTTP user DTO. */
export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  password?: string;
  role: Role;
  bio?: string;
  avatar?: string;
  avatar_url?: string | null;
  status?: 'active' | 'suspended' | 'pending' | 'invited';
  emailVerified?: boolean;
  email_verified?: boolean;
}

export type CurrentUser = import('./generated/types.gen.ts').CurrentUser;

export type LoginRequest = import('./generated/types.gen.ts').LoginRequest;

export type LoginResponse = import('./generated/types.gen.ts').LoginResponse;

export type RegisterRequest = import('./generated/types.gen.ts').RegisterRequest;

export type VerifyEmailRequest = import('./generated/types.gen.ts').VerifyEmailRequest;

export type PasswordResetRequest = import('./generated/types.gen.ts').PasswordResetRequest;

export type PasswordResetConfirmRequest = import('./generated/types.gen.ts').PasswordResetConfirmRequest;

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export interface EmailVerification {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  lastSentAt: string;
}

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
