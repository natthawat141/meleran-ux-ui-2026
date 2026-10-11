import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { CourseSummaryDto, courseSummary, courseSummarySelect } from '../courses/public/index';
import { Page, PageQuery, decodeCursor, page } from '../../shared/pagination/keyset';

export interface EnrollmentListItem {
  enrollment:{id:string;course_id:string;source:'free'|'stripe'|'redeem';access:'lifetime';granted_at:string};
  course:CourseSummaryDto;
  progress:{completed_items:number;total_items:number;completed_at:string|null};
}
@Injectable()
export class OwnEnrollmentListService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  list(reference:VerifiedSessionReference,query:PageQuery):Promise<Page<EnrollmentListItem>> {
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireSelfRead(tx,reference);
      const cursor=decodeCursor('own-enrollments',query,actor.accountId);
      const where:Prisma.EnrollmentWhereInput={accountId:actor.accountId,
        course:{status:'published',publishedAt:{not:null}}};
      if(cursor)where.OR=[{grantedAt:{lt:cursor.at}},{grantedAt:cursor.at,id:{gt:cursor.id}}];
      const rows=await tx.enrollment.findMany({where,orderBy:[{grantedAt:'desc'},{id:'asc'}],take:query.limit+1,
        select:{id:true,courseId:true,source:true,grantedAt:true,completedAt:true,
          course:{select:{...courseSummarySelect,chapters:{select:{items:{select:{id:true}}}}}},
          progress:{where:{completedAt:{not:null}},select:{itemId:true}}}});
      return page('own-enrollments',query,rows,row=>({id:row.id,at:row.grantedAt}),row=>{
        if(!['free','stripe','redeem'].includes(row.source))throw Error('Invalid enrollment source');
        const ids=new Set(row.course.chapters.flatMap(ch=>ch.items.map(item=>item.id)));
        return {enrollment:{id:row.id,course_id:row.courseId,source:row.source as 'free'|'stripe'|'redeem',
          access:'lifetime',granted_at:row.grantedAt.toISOString()},course:courseSummary(row.course),
          progress:{completed_items:row.progress.filter(p=>ids.has(p.itemId)).length,total_items:ids.size,
            completed_at:row.completedAt?.toISOString()??null}};
      },actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
