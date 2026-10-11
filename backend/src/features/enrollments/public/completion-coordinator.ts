import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BestResultReader, BestQuizResult } from '../../assessments/public/index';
import { CompletionIssuer } from '../../certificates/public/index';

export interface CompletionState { completed_items:number;total_items:number;completed_at:string|null;certificate_id:string|null }
interface SnapshotItem { item_id:string;type:string;completed_at:string;quiz?:BestQuizResult }

/** Caller has freshly authorized learning/assessment authority and owns Course SHARE
 * then Enrollment UPDATE. All progress/completion/certificate writes share this tx. */
@Injectable()
export class CompletionCoordinator {
  constructor(private readonly results:BestResultReader,private readonly certificates:CompletionIssuer){}
  async completeManual(tx:Prisma.TransactionClient,enrollmentId:string,courseId:string,itemId:string):Promise<{completed_at:string;state:CompletionState}> {
    const item=await tx.courseItem.findFirst({where:{id:itemId,courseId},select:{type:true}});
    if(!item||!['article','video'].includes(item.type))throw Error('Manual completion needs a verified Article/Video');
    const [{now}]=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS now`;
    const old=await tx.progress.findUnique({where:{enrollmentId_itemId:{enrollmentId,itemId}},select:{completedAt:true}});
    const completedAt=old?.completedAt??now;
    await tx.progress.upsert({where:{enrollmentId_itemId:{enrollmentId,itemId}},
      create:{enrollmentId,courseId,itemId,completedAt},update:old?.completedAt?{}:{completedAt}});
    return {completed_at:completedAt.toISOString(),state:await this.evaluate(tx,enrollmentId,courseId,now)};
  }

  async evaluate(tx:Prisma.TransactionClient,enrollmentId:string,courseId:string,now?:Date):Promise<CompletionState> {
    const enrollment=await tx.enrollment.findFirstOrThrow({where:{id:enrollmentId,courseId},select:{completedAt:true,
      certificate:{select:{id:true}}}});
    const items=await tx.courseItem.findMany({where:{courseId},select:{id:true,type:true},orderBy:{id:'asc'}});
    let progress=await tx.progress.findMany({where:{enrollmentId,courseId},select:{itemId:true,completedAt:true}});
    const saved=new Map(progress.map(p=>[p.itemId,p.completedAt]));
    // Immutable historical completions do not require a newer definition or reissue.
    if(enrollment.completedAt){
      if(!enrollment.certificate)throw Error('Historical completion missing certificate; explicit repair required');
      return {completed_items:items.filter(i=>saved.get(i.id)).length,total_items:items.length,
        completed_at:enrollment.completedAt.toISOString(),certificate_id:enrollment.certificate.id};
    }
    const proof=new Map<string,BestQuizResult>();
    for(const item of items){
      if(!['article','video','quiz'].includes(item.type))throw Error('Invalid course item type');
      if(item.type!=='quiz')continue;
      const best=await this.results.read(tx,enrollmentId,courseId,item.id);
      if(!best?.passed)continue;
      proof.set(item.id,best);
      if(!saved.get(item.id)){
        const completedAt=new Date(best.graded_at);
        await tx.progress.upsert({where:{enrollmentId_itemId:{enrollmentId,itemId:item.id}},
          create:{enrollmentId,courseId,itemId:item.id,completedAt},update:{completedAt}});
        saved.set(item.id,completedAt);
      }
    }
    // A compatibility completed flag cannot stand in for a fully graded Quiz proof.
    const done=items.filter(i=>saved.get(i.id)&&(i.type!=='quiz'||proof.has(i.id)));
    let completedAt:Date|null=null,certificateId:string|null=null;
    if(items.length>0&&done.length===items.length){
      if(!now){const rows=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS now`;now=rows[0].now;}
      completedAt=now;
      const snapshot:SnapshotItem[]=items.map(i=>({item_id:i.id,type:i.type,completed_at:saved.get(i.id)!.toISOString(),
        ...(i.type==='quiz'?{quiz:proof.get(i.id)!}:{})}));
      await tx.enrollment.update({where:{id:enrollmentId},data:{completedAt,completedItems:done.length,
        completionSnapshot:{version:1,course_id:courseId,completed_at:now.toISOString(),items:snapshot} as unknown as Prisma.InputJsonValue}});
      certificateId=await this.certificates.issue(tx,enrollmentId);
    }else await tx.enrollment.update({where:{id:enrollmentId},data:{completedItems:done.length}});
    return {completed_items:done.length,total_items:items.length,completed_at:completedAt?.toISOString()??null,certificate_id:certificateId};
  }
}
