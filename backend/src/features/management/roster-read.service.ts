import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { PageQuery,decodeCursor,page } from '../../shared/pagination/keyset';

export type RosterScope={kind:'course'|'account';id:string}|{kind:'instructor'|'admin'};
@Injectable()
export class RosterReadService{
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  list(reference:VerifiedSessionReference,query:PageQuery,scope:RosterScope){
    return this.prisma.$transaction(async tx=>{
      const actor=scope.kind==='account'||scope.kind==='admin'?await this.principals.requireAdmin(tx,reference):await this.principals.requireAuthoring(tx,reference);
      if(scope.kind==='instructor'&&(actor.roles.includes('admin')||!actor.roles.includes('instructor')||reference.audience!=='web'))throw ApiException.forbidden();
      const where:Prisma.EnrollmentWhereInput={};
      if(scope.kind==='course'){
        const found=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
          SELECT id FROM courses WHERE id=${scope.id} AND (${actor.roles.includes('admin')} OR "instructorId"=${actor.accountId}) FOR SHARE`);
        if(!found.length)throw ApiException.notFound();where.courseId=scope.id;
      }else if(scope.kind==='account'){
        const found=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM accounts WHERE id=${scope.id} FOR SHARE`);
        if(!found.length)throw ApiException.notFound();where.accountId=scope.id;
      }else if(scope.kind==='instructor')where.course={instructorId:actor.accountId};
      const route='roster-'+scope.kind+('id'in scope?':'+scope.id:''),cursor=decodeCursor(route,query,actor.accountId);
      if(cursor)where.OR=[{grantedAt:{lt:cursor.at}},{grantedAt:cursor.at,id:{gt:cursor.id}}];
      // RepeatableRead keeps current curriculum/progress/certificate together.
      // Canonical row is one Enrollment; learner with two courses has two rows.
      const rows=await tx.enrollment.findMany({where,orderBy:[{grantedAt:'desc'},{id:'asc'}],take:query.limit+1,select:{
        id:true,courseId:true,accountId:true,grantedAt:true,completedAt:true,account:{select:{displayName:true}},
        course:{select:{chapters:{select:{items:{select:{id:true}}}}}},progress:{where:{completedAt:{not:null}},select:{itemId:true}},
        certificate:{select:{id:true,code:true,recipientName:true,issuedAt:true}}}});
      return page(route,query,rows,row=>({id:row.id,at:row.grantedAt}),row=>{
        const current=new Set(row.course.chapters.flatMap(c=>c.items.map(i=>i.id))),completed=row.progress.filter(p=>current.has(p.itemId)).length;
        if(row.certificate&&!row.completedAt)throw Error('Certificate lacks historical completion proof');
        return {id:row.id,course_id:row.courseId,user_id:row.accountId,learner_display_name:row.account.displayName,granted_at:row.grantedAt.toISOString(),
          completed_items:completed,total_items:current.size,percent:current.size?Math.round(completed/current.size*100):0,completed_at:row.completedAt?.toISOString()??null,
          certificate:row.certificate?{id:row.certificate.id,code:row.certificate.code,learner_name:row.certificate.recipientName,issued_at:row.certificate.issuedAt.toISOString()}:null};
      },actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
