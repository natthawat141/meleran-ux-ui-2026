import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { PageQuery, decodeCursor, page } from '../../shared/pagination/keyset';

@Injectable()
export class CodeListService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  list(reference:VerifiedSessionReference,query:PageQuery) {
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAdmin(tx,reference);
      const {status,course_id:courseId}=query.filters;
      if(status!==undefined&&!['unused','used','revoked'].includes(status))throw ApiException.validationFailed('status ไม่ถูกต้อง');
      if(courseId==='')throw ApiException.validationFailed('course_id ไม่ถูกต้อง');
      const cursor=decodeCursor('admin-redeem-codes',query,actor.accountId);
      const where:Prisma.RedeemCodeWhereInput={...(status!==undefined?{status}:{}),...(courseId!==undefined?{courseId}:{})};
      if(cursor)where.OR=[{issuedAt:{lt:cursor.at}},{issuedAt:cursor.at,id:{gt:cursor.id}}];
      const rows=await tx.redeemCode.findMany({where,orderBy:[{issuedAt:'desc'},{id:'asc'}],take:query.limit+1,
        select:{id:true,code:true,courseId:true,status:true,issuedAt:true,usedBy:true,usedAt:true,revokedAt:true}});
      return page('admin-redeem-codes',query,rows,row=>({id:row.id,at:row.issuedAt}),row=>{
        if(!['unused','used','revoked'].includes(row.status))throw Error('Invalid stored redeem state');
        return {id:row.id,code_masked:'MLN-****-'+(row.code.length>=8?row.code.slice(-4):'****'),course_id:row.courseId,
          status:row.status as 'unused'|'used'|'revoked',created_at:row.issuedAt.toISOString(),used_by:row.usedBy,
          used_at:row.usedAt?.toISOString()??null,revoked_at:row.revokedAt?.toISOString()??null};
      },actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
