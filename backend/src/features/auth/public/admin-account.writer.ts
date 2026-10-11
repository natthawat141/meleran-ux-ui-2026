import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrincipalService, VerifiedSessionReference } from './principal.service';
import { LocalPasswordService, normalizedLocalUsername } from '../local-password.service';
import { accountView, identityViewSelect } from '../account-view';
import { SelfProfileDto } from './self-profile.reader';

export interface AdminAccountInput {username:string;displayName:string;email:string|null;passwordHash:string}
export interface AdminAccountResult {user:SelfProfileDto;created_by:string;created_at:string}
@Injectable()
export class AdminAccountWriter {
  constructor(private readonly principals:PrincipalService,private readonly passwords:LocalPasswordService){}
  hash(password:string):Promise<string>{return this.passwords.create(password);}
  async create(tx:Prisma.TransactionClient,reference:VerifiedSessionReference,input:AdminAccountInput):Promise<AdminAccountResult> {
    const actor=await this.principals.requireAdmin(tx,reference),normalized=normalizedLocalUsername(input.username);
    if(!normalized||!this.passwords.isEncoded(input.passwordHash))throw Error('Invalid trusted account-create input');
    const row=await tx.account.create({data:{username:input.username,normalizedUsername:normalized,displayName:input.displayName,
      email:input.email,normalizedEmail:input.email?.toUpperCase()??null,emailVerified:false,origin:'admin_created',roles:'learner',
      createdBy:actor.accountId,roleGrants:{create:{role:'learner'}},localCredential:{create:{passwordHash:input.passwordHash}}},
      select:{...identityViewSelect,createdAt:true}});
    return {user:accountView(row,['learner'],true),created_by:actor.accountId,created_at:row.createdAt.toISOString()};
  }
}
