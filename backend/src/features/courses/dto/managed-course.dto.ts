import { Prisma } from '@prisma/client';
import { storedOutcomes,storedItemType } from './course-detail.dto';

export const managementSelect={
  id:true,slug:true,title:true,subtitle:true,description:true,coverUrl:true,category:true,level:true,priceMinor:true,currency:true,outcomesJson:true,
  instructor:{select:{id:true,displayName:true,avatarUrl:true}},status:true,revision:true,publishedAt:true,publishedBy:true,createdBy:true,createdAt:true,updatedAt:true,aiEnabled:true,
  _count:{select:{enrollments:true}},reviews:{orderBy:[{submittedAt:'desc'},{id:'asc'}],take:1,select:{id:true,submittedRevision:true,submittedBy:true,submittedAt:true,reviewedBy:true,reviewedAt:true,result:true,reason:true}},
  chapters:{orderBy:[{position:'asc'},{id:'asc'}],select:{id:true,title:true,items:{orderBy:[{position:'asc'},{id:'asc'}],select:{id:true,title:true,type:true,
    _count:{select:{progress:true}},quiz:{select:{_count:{select:{questions:true,attempts:true}}}}}}}},
} satisfies Prisma.CourseSelect;
export type ManagedRow=Prisma.CourseGetPayload<{select:typeof managementSelect}>;
export interface ReviewDto{id:string;revision:number;status:'pending'|'approved'|'returned'|'stale';submitted_by:string;submitted_at:string;decided_by:string|null;decided_at:string|null;reason:string|null}
export interface ManagedCourseDto{id:string;slug:string;title:string;subtitle:string|null;description:string|null;cover_url:string|null;category:string;level:string;
  price:{amount_minor:number;currency:'THB'}|null;outcomes:string[];instructor:{id:string;display_name:string;avatar_url:string|null};
  status:'draft'|'pending_review'|'approved'|'published'|'archived';revision:number;published_at:string|null;published_by:string|null;created_by:string;created_at:string;updated_at:string;
  ai_enabled:boolean;enrollment_count:number;latest_review:ReviewDto|null;chapters:Array<{id:string;title:string;items:Array<{id:string;title:string;type:'article'|'video'|'quiz';has_history:boolean;
    quiz?:{question_count:number;pass_percent:number;attempt_count:number}}>}>}
export function reviewView(review:ManagedRow['reviews'][number],revision:number):ReviewDto{
  if(review.submittedRevision<1||![null,'approved','returned'].includes(review.result))throw Error('Invalid stored review');
  const status=review.result==='returned'?'returned':review.submittedRevision!==revision?'stale':review.result==='approved'?'approved':'pending';
  return {id:review.id,revision:review.submittedRevision,status,submitted_by:review.submittedBy,submitted_at:review.submittedAt.toISOString(),
    decided_by:review.reviewedBy,decided_at:review.reviewedAt?.toISOString()??null,reason:review.reason};
}
export function managedCourse(row:ManagedRow):ManagedCourseDto{
  if(!row.createdBy||row.revision<1||!['draft','pending_review','approved','published','archived'].includes(row.status)||row.currency!=='THB')
    throw Error('Legacy authoring audit/revision requires explicit migration proof');
  return {id:row.id,slug:row.slug,title:row.title,subtitle:row.subtitle,description:row.description,cover_url:row.coverUrl,category:row.category,level:row.level,
    price:row.priceMinor===null?null:{amount_minor:row.priceMinor,currency:'THB'},outcomes:storedOutcomes(row.outcomesJson),
    instructor:{id:row.instructor.id,display_name:row.instructor.displayName,avatar_url:row.instructor.avatarUrl},status:row.status as ManagedCourseDto['status'],revision:row.revision,
    published_at:row.publishedAt?.toISOString()??null,published_by:row.publishedBy,created_by:row.createdBy,created_at:row.createdAt.toISOString(),updated_at:row.updatedAt.toISOString(),
    ai_enabled:row.aiEnabled,enrollment_count:row._count.enrollments,latest_review:row.reviews[0]?reviewView(row.reviews[0],row.revision):null,
    chapters:row.chapters.map(ch=>({id:ch.id,title:ch.title,items:ch.items.map(item=>({id:item.id,title:item.title,type:storedItemType(item.type),
      has_history:item._count.progress>0||(item.quiz?._count.attempts??0)>0,...(item.quiz?{quiz:{question_count:item.quiz._count.questions,pass_percent:70,attempt_count:item.quiz._count.attempts}}:{})}))}))};
}
