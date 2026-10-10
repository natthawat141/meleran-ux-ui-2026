import { Prisma } from '@prisma/client';
import { AccountRole } from './public/principal.service';
import type { SelfProfileDto } from './public/self-profile.reader';

const profileStrings = ['bio', 'firstName', 'lastName', 'firstNameEnglish', 'lastNameEnglish', 'certificateName',
  'birthDate', 'phone', 'school', 'educationLevel'] as const;
const profileArrays = ['interests', 'learningGoals'] as const;
export type SelfProfileData = Partial<Record<typeof profileStrings[number], string>> &
  Partial<Record<typeof profileArrays[number], string[]>>;
export function selfProfileData(json: string): SelfProfileData {
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid persisted profile');
  const raw = value as Record<string, unknown>, entries: Array<[string, string | string[]]> = [];
  for (const key of profileStrings) if (Object.prototype.hasOwnProperty.call(raw, key)) {
    if (typeof raw[key] !== 'string') throw new Error('Invalid persisted profile');
    entries.push([key, raw[key]]);
  }
  for (const key of profileArrays) if (Object.prototype.hasOwnProperty.call(raw, key)) {
    const items = raw[key];
    if (!Array.isArray(items) || items.length > 30 || items.some(item => typeof item !== 'string')) throw new Error('Invalid persisted profile');
    entries.push([key, items]);
  }
  return Object.fromEntries(entries) as SelfProfileData;
}

export const identityViewSelect = Prisma.validator<Prisma.AccountSelect>()({
  id: true, displayName: true, username: true, email: true, emailVerified: true, avatarUrl: true,
  origin: true, profileJson: true, localCredential: { select: { accountId: true } },
  externalIdentities: { select: { method: true } },
});
/** Auth-local pure projection; calling facade must prove read/write authority. */
export function accountView(account: Prisma.AccountGetPayload<{ select: typeof identityViewSelect }>,
  roles: AccountRole[], learningEligible: boolean): SelfProfileDto {
  const origin = account.origin;
  if (origin !== 'self_email' && origin !== 'google' && origin !== 'admin_created') throw new Error('Invalid persisted origin');
  const methods = new Set<'password' | 'google'>();
  if (account.localCredential) methods.add('password');
  for (const identity of account.externalIdentities) {
    if (identity.method !== 'password' && identity.method !== 'google') throw new Error('Invalid persisted authentication method');
    methods.add(identity.method);
  }
  return { id: account.id, display_name: account.displayName, username: account.username, email: account.email,
    email_verified: account.emailVerified, avatar_url: account.avatarUrl, roles, origin,
    auth_methods: [...methods].sort(), learning_eligible: learningEligible, profile: selfProfileData(account.profileJson) };
}
