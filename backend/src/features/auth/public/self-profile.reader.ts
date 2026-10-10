import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrincipalService, AccountRole, VerifiedSessionReference } from './principal.service';
import { accountView, identityViewSelect, SelfProfileData } from '../account-view';
export { selfProfileData } from '../account-view';
export type { SelfProfileData } from '../account-view';
export interface SelfProfileDto {
  id: string; display_name: string; username: string | null; email: string | null; email_verified: boolean;
  avatar_url: string | null; roles: AccountRole[]; origin: 'self_email' | 'google' | 'admin_created';
  auth_methods: Array<'password' | 'google'>; learning_eligible: boolean; profile: SelfProfileData;
}

/** Auth owns the identity tables; Accounts uses this public bound-self facade. */
@Injectable()
export class SelfProfileReader {
  constructor(private readonly principals: PrincipalService) {}
  async read(tx: Prisma.TransactionClient, reference: VerifiedSessionReference): Promise<SelfProfileDto> {
    const actor = await this.principals.requireSelfRead(tx, reference);
    const account = await tx.account.findUniqueOrThrow({ where: { id: actor.accountId }, select: identityViewSelect });
    return accountView(account, actor.roles, actor.learningEligible);
  }
}
