import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference, AccountRole } from '../auth/public/index';
import { PageQuery, decodeCursor, page } from '../../shared/pagination/keyset';

export interface AdminUserSummaryDto {id:string;display_name:string;username:string|null;email:string|null;email_verified:boolean;
  avatar_url:string|null;roles:AccountRole[];origin:'self_email'|'google'|'admin_created';status:'active'|'pending';created_at:string}
export interface DirectoryInstructorDto {id:string;display_name:string;avatar_url:string|null}
@Injectable()
export class AccountDirectoryService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  list(reference:VerifiedSessionReference,query:PageQuery,instructors:boolean) {
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAdmin(tx,reference),route=instructors?'admin-instructors':'admin-users';
      const cursor=decodeCursor(route,query,actor.accountId),where:Prisma.AccountWhereInput={};
      const conditions:Prisma.AccountWhereInput[]=[];
      if(instructors)where.roleGrants={some:{role:'instructor'}};
      if(query.filters.q)conditions.push({OR:[{displayName:{contains:query.filters.q,mode:'insensitive'}},
        {username:{contains:query.filters.q,mode:'insensitive'}},{email:{contains:query.filters.q,mode:'insensitive'}}]});
      if(cursor)conditions.push({OR:[{createdAt:{lt:cursor.at}},{createdAt:cursor.at,id:{gt:cursor.id}}]});
      if(conditions.length)where.AND=conditions;
      const rows=await tx.account.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],take:query.limit+1,
        select:{id:true,displayName:true,username:true,email:true,emailVerified:true,avatarUrl:true,origin:true,createdAt:true,
          roleGrants:{select:{role:true},orderBy:{role:'asc'}}}});
      return page<AdminUserSummaryDto|DirectoryInstructorDto,typeof rows[number]>(route,query,rows,row=>({id:row.id,at:row.createdAt}),row=>{
        if(instructors)return {id:row.id,display_name:row.displayName,avatar_url:row.avatarUrl};
        const roles=row.roleGrants.map(r=>r.role);
        if(!roles.length||roles.some(r=>!['learner','instructor','admin'].includes(r))||!['self_email','google','admin_created'].includes(row.origin))throw Error('Invalid stored identity projection');
        return {id:row.id,display_name:row.displayName,username:row.username,email:row.email,email_verified:row.emailVerified,avatar_url:row.avatarUrl,
          roles:roles as AccountRole[],origin:row.origin as AdminUserSummaryDto['origin'],status:row.origin==='self_email'&&!row.emailVerified?'pending':'active',created_at:row.createdAt.toISOString()};
      },actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
