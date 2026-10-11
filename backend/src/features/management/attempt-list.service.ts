import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ManagedAttemptReader } from '../assessments/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { PageQuery,decodeCursor,encodeCursor } from '../../shared/pagination/keyset';

@Injectable()
export class AttemptListService{
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService,private readonly attempts:ManagedAttemptReader){}
  list(reference:VerifiedSessionReference,query:PageQuery,scope:{kind:'course'|'account';id:string}){
    return this.prisma.$transaction(async tx=>{
      const actor=scope.kind==='account'?await this.principals.requireAdmin(tx,reference):await this.principals.requireAuthoring(tx,reference);
      const where:Prisma.QuizAttemptWhereInput={};
      if(scope.kind==='course'){
        const found=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM courses WHERE id=${scope.id}
          AND (${actor.roles.includes('admin')} OR "instructorId"=${actor.accountId}) FOR SHARE`);
        if(!found.length)throw ApiException.notFound();where.courseId=scope.id;
      }else{
        const found=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM accounts WHERE id=${scope.id} FOR SHARE`);
        if(!found.length)throw ApiException.notFound();where.enrollment={accountId:scope.id};
      }
      const route='managed-attempt-list-'+scope.kind+':'+scope.id,cursor=decodeCursor(route,query,actor.accountId);
      if(cursor)where.OR=[{startedAt:{lt:cursor.at}},{startedAt:cursor.at,id:{gt:cursor.id}}];
      // Locate only authorized IDs before selecting any historical answers.
      const rows=await tx.quizAttempt.findMany({where,orderBy:[{startedAt:'desc'},{id:'asc'}],take:query.limit+1,select:{id:true,courseId:true,startedAt:true}});
      const selected=rows.slice(0,query.limit),items=[];
      for(const row of selected)items.push(await this.attempts.read(tx,{id:row.id,courseId:row.courseId}));
      const last=selected[selected.length-1];return {items,next_cursor:rows.length>query.limit&&last?encodeCursor(route,query,{id:last.id,at:last.startedAt},actor.accountId):null};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:20000});
  }
}
