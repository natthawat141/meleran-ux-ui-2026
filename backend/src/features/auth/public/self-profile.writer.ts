import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrincipalService, VerifiedSessionReference } from './principal.service';
import { SelfProfileDto } from './self-profile.reader';
import { SelfProfileData, accountView, identityViewSelect, selfProfileData } from '../account-view';
import { ApiException } from '../../../shared/errors/api-exception';

export interface SelfProfilePatch {
  display_name?: string; username?: string; avatar_url?: string | null;
  profile?: { [K in keyof SelfProfileData]?: Exclude<SelfProfileData[K],undefined> extends string[] ? string[] : string | null };
}

/** Auth owns identity writes; validated input cannot alter email/roles/provenance. */
@Injectable()
export class SelfProfileWriter {
  constructor(private readonly principals: PrincipalService) {}
  async write(tx: Prisma.TransactionClient, reference: VerifiedSessionReference, patch: SelfProfilePatch): Promise<SelfProfileDto> {
    const sessions = await tx.$queryRaw<Array<{ accountId: string }>>(Prisma.sql`
      SELECT "accountId" FROM app_sessions WHERE "tokenHash"=${reference.tokenHash} FOR SHARE`);
    if (!sessions.length) throw ApiException.unauthorized();
    // Acquire UPDATE before requireSelfRead's SHARE to avoid concurrent upgrades.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM accounts WHERE id=${sessions[0].accountId} FOR UPDATE`);
    const actor = await this.principals.requireSelfRead(tx, reference);
    const account = await tx.account.findUniqueOrThrow({ where: { id: actor.accountId }, select: identityViewSelect });
    const data: Prisma.AccountUpdateInput = {};
    if (patch.display_name !== undefined) data.displayName = patch.display_name;
    if (patch.username !== undefined) { data.username = patch.username; data.normalizedUsername = patch.username.toUpperCase(); }
    if (patch.avatar_url !== undefined) data.avatarUrl = patch.avatar_url;
    if (patch.profile && Object.keys(patch.profile).length) {
      selfProfileData(account.profileJson); // No implicit repair of malformed persisted data.
      const profile = JSON.parse(account.profileJson) as Record<string, unknown>;
      for (const [key,value] of Object.entries(patch.profile)) profile[key] = value === null ? '' : value;
      data.profileJson = JSON.stringify(profile);
    }
    const result = Object.keys(data).length ? await tx.account.update({ where: { id: actor.accountId },
      data: { ...data, revision: { increment: 1 } }, select: identityViewSelect }) : account;
    return accountView(result, actor.roles, actor.learningEligible);
  }
}
