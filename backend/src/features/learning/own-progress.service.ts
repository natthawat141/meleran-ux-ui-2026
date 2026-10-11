import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { storedResume } from '../enrollments/public/index';
import { Page,PageQuery,decodeCursor,page } from '../../shared/pagination/keyset';

export interface ProgressRow {course_id:string;enrollment_id:string;progress:{completed_items:number;total_items:number;completed_at:string|null};resume_item_id:string|null;completed_at:string|null}
@Injectable()
export class OwnProgressService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  list(reference:VerifiedSessionReference,query:PageQuery):Promise<Page<ProgressRow>>{
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireSelfRead(tx,reference),cursor=decodeCursor('own-progress',query,actor.accountId);
      // Own historical metadata includes archived courses; no content grant is inferred.
      const where:Prisma.EnrollmentWhereInput={accountId:actor.accountId};
      if(cursor)where.OR=[{grantedAt:{lt:cursor.at}},{grantedAt:cursor.at,id:{gt:cursor.id}}];
      const rows=await tx.enrollment.findMany({where,orderBy:[{grantedAt:'desc'},{id:'asc'}],take:query.limit+1,
        select:{id:true,courseId:true,grantedAt:true,completedAt:true,course:{select:{chapters:{select:{items:{select:{id:true}}}}}},
          progress:{select:{itemId:true,completedAt:true,resumeData:true,updatedAt:true}}}});
      return page('own-progress',query,rows,row=>({id:row.id,at:row.grantedAt}),row=>{
        const ids=new Set(row.course.chapters.flatMap(c=>c.items.map(i=>i.id))),at=row.completedAt?.toISOString()??null;
        const resumes=row.progress.filter(p=>ids.has(p.itemId)).map(p=>({id:p.itemId,resume:storedResume(p.resumeData,p.updatedAt)}))
          .filter(p=>p.resume!==null).sort((a,b)=>{
            const x=a.resume!,y=b.resume!;if(x.order!==y.order){if(x.order===null)return 1;if(y.order===null)return -1;return x.order>y.order?-1:1;}
            return Date.parse(y.wire.updated_at)-Date.parse(x.wire.updated_at)||(a.id<b.id?-1:a.id>b.id?1:0);
          });
        return {course_id:row.courseId,enrollment_id:row.id,progress:{completed_items:row.progress.filter(p=>ids.has(p.itemId)&&p.completedAt!==null).length,
          total_items:ids.size,completed_at:at},resume_item_id:resumes[0]?.id??null,completed_at:at};
      },actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
