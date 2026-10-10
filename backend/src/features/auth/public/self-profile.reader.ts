import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrincipalService, AccountRole, VerifiedSessionReference } from './principal.service';

const profileStrings = ['bio', 'firstName', 'lastName', 'firstNameEnglish', 'lastNameEnglish', 'certificateName',
  'birthDate', 'phone', 'school', 'educationLevel'] as const;
const profileArrays = ['interests', 'learningGoals'] as const;
export type SelfProfileData = Partial<Record<typeof profileStrings[number], string>> &
  Partial<Record<typeof profileArrays[number], string[]>>;
export interface SelfProfileDto {
  id: string; display_name: string; username: string | null; email: string | null; email_verified: boolean;
  avatar_url: string | null; roles: AccountRole[]; origin: 'self_email' | 'google' | 'admin_created';
  auth_methods: Array<'password' | 'google'>; learning_eligible: boolean; profile: SelfProfileData;
}

/** Public projection only; unknown storage metadata is never a wire field. */
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

/** Auth owns the identity tables; Accounts uses this public bound-self facade. */
@Injectable()
export class SelfProfileReader {
  constructor(private readonly principals: PrincipalService) {}
  async read(tx: Prisma.TransactionClient, reference: VerifiedSessionReference): Promise<SelfProfileDto> {
    const actor = await this.principals.requireSelfRead(tx, reference);
    const account = await tx.account.findUniqueOrThrow({ where: { id: actor.accountId }, select: {
      id: true, displayName: true, username: true, email: true, emailVerified: true, avatarUrl: true,
      origin: true, profileJson: true, localCredential: { select: { accountId: true } },
      externalIdentities: { select: { method: true } },
    } });
    const origin = account.origin;
    if (origin !== 'self_email' && origin !== 'google' && origin !== 'admin_created') throw new Error('Invalid persisted origin');
    const methods = new Set<'password' | 'google'>();
    if (account.localCredential) methods.add('password');
    for (const identity of account.externalIdentities) {
      if (identity.method !== 'password' && identity.method !== 'google') throw new Error('Invalid persisted authentication method');
      methods.add(identity.method);
    }
    return { id: account.id, display_name: account.displayName, username: account.username, email: account.email,
      email_verified: account.emailVerified, avatar_url: account.avatarUrl, roles: actor.roles, origin,
      auth_methods: [...methods].sort(), learning_eligible: actor.learningEligible, profile: selfProfileData(account.profileJson) };
  }
}
