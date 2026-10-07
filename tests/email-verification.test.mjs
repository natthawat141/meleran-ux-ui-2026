import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_TTL_MS,
  verificationResendAvailable,
  verificationResendRemainingMs,
  verificationTokenState,
} from '../src/lib/email-verification.ts';

const now = Date.parse('2026-10-06T00:00:00.000Z');
const record = {
  id: 'verify-1', userId: 'user-1', token: 'one-time-token',
  createdAt: new Date(now).toISOString(),
  expiresAt: new Date(now + EMAIL_VERIFICATION_TTL_MS).toISOString(),
  lastSentAt: new Date(now).toISOString(),
};

test('email link is valid before 24 hours and expired at its exact deadline', () => {
  assert.equal(verificationTokenState(record, now + EMAIL_VERIFICATION_TTL_MS - 1), 'valid');
  assert.equal(verificationTokenState(record, now + EMAIL_VERIFICATION_TTL_MS), 'expired');
});

test('used and malformed tokens fail closed', () => {
  assert.equal(verificationTokenState({ ...record, usedAt: new Date(now).toISOString() }, now), 'used');
  assert.equal(verificationTokenState({ ...record, expiresAt: 'not-a-date' }, now), 'missing');
  assert.equal(verificationTokenState(undefined, now), 'missing');
});

test('resend cooldown blocks duplicate sends and opens at configured boundary', () => {
  assert.equal(verificationResendAvailable(record, now), false);
  assert.equal(verificationResendRemainingMs(record, now), EMAIL_VERIFICATION_RESEND_COOLDOWN_MS);
  assert.equal(verificationResendAvailable(record, now + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - 1), false);
  assert.equal(verificationResendAvailable(record, now + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS), true);
});
