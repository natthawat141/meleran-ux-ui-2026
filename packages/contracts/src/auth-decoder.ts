import type { CurrentUser, Role } from './auth.ts';
import type { AccountProfile } from './profile.ts';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid session user');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Invalid session user');
  return value;
}
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function isRole(value: unknown): value is Role { return value === 'learner' || value === 'instructor' || value === 'admin'; }
export function decodeCurrentUser(value: unknown): CurrentUser {
  const user = record(value);
  if (!Array.isArray(user.roles) || !user.roles.every(isRole)
    || !Array.isArray(user.auth_methods) || !user.auth_methods.every((method) => method === 'password' || method === 'google')
    || (user.origin !== 'self_email' && user.origin !== 'google' && user.origin !== 'admin_created')
    || typeof user.email_verified !== 'boolean' || typeof user.learning_eligible !== 'boolean') throw new TypeError('Invalid session user');
  const rawProfile = record(user.profile);
  const profile: AccountProfile = {};
  const fields = ['firstName', 'lastName', 'firstNameEnglish', 'lastNameEnglish', 'certificateName', 'birthDate', 'phone', 'school', 'educationLevel', 'bio'] as const;
  for (const key of fields) if (rawProfile[key] !== undefined) Object.assign(profile, { [key]: text(rawProfile[key]) });
  for (const key of ['interests', 'learningGoals'] as const) {
    if (rawProfile[key] !== undefined) {
      const values = rawProfile[key];
      if (!Array.isArray(values) || !values.every((item): item is string => typeof item === 'string')) throw new TypeError('Invalid profile');
      profile[key] = values;
    }
  }
  return { id: text(user.id), display_name: text(user.display_name), username: nullableText(user.username),
    email: nullableText(user.email), avatar_url: nullableText(user.avatar_url), roles: user.roles, origin: user.origin,
    auth_methods: user.auth_methods, email_verified: user.email_verified, learning_eligible: user.learning_eligible, profile };
}
