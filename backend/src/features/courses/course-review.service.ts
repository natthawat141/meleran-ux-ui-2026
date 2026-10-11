import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { PageQuery,decodeCursor,page } from '../../shared/pagination/keyset';
import { assertReady,loadAuthoring } from './authoring-write.service';
import { reviewView,managementSelect,managedCourse,ManagedCourseDto } from './dto/managed-course.dto';
import { AuthoringDto } from './dto/authoring-course.dto';

const reviewSelect={id:true,courseId:true,submittedRevision:true,submittedBy:true,submittedAt:true,reviewedBy:true,reviewedAt:true,result:true,reason:true,submittedSnapshot:true,
  course:{select:{revision:true}}} satisfies Prisma.CourseReviewSelect;
type ReviewRow=Prisma.CourseReviewGetPayload<{select:typeof reviewSelect}>;
function submittedSnapshot(row:ReviewRow):{authoring:AuthoringDto;management:ManagedCourseDto}{
  const raw=row.submittedSnapshot;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Missing submitted course snapshot');
  const snapshot=raw as unknown as {version:number;authoring:AuthoringDto;management:ManagedCourseDto};
  if(snapshot.version!==1||!snapshot.authoring||!snapshot.management||Object.keys(raw).some(k=>!['version','authoring','management'].includes(k)))throw Error('Invalid submitted snapshot version');
  const value=snapshot.authoring;
  const keys=['id','slug','title','subtitle','description','cover_url','category','level','price','outcomes','instructor','status','revision','published_at','published_by','created_by','created_at','updated_at','ai_enabled','enrollment_count','latest_review','chapters'];
  if(Object.keys(value).some(k=>!keys.includes(k))||value.id!==row.courseId||value.revision!==row.submittedRevision||!Array.isArray(value.chapters)||!value.created_by||
    snapshot.management.id!==row.courseId||snapshot.management.revision!==row.submittedRevision||Object.keys(snapshot.management).some(k=>!keys.includes(k)))
    throw Error('Invalid submitted course snapshot');
  return snapshot;
}

@Injectable()
export class CourseReviewService{
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  list(reference:VerifiedSessionReference,query:PageQuery){
    const status=query.filters.status;if(status!==undefined&&!['pending','approved','returned','stale'].includes(status))throw ApiException.validationFailed('สถานะ Review ไม่ถูกต้อง');
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAdmin(tx,reference),cursor=decodeCursor('course-reviews',query,actor.accountId);
      const keyset=cursor?Prisma.sql`AND (r."submittedAt"<${cursor.at} OR (r."submittedAt"=${cursor.at} AND r.id>${cursor.id}))`:Prisma.empty;
      const filter=status===undefined?Prisma.empty:Prisma.sql`AND (CASE WHEN r.result='returned' THEN 'returned'
        WHEN r."submittedRevision"<>c.revision THEN 'stale' WHEN r.result='approved' THEN 'approved' ELSE 'pending' END)=${status}`;
      const ids=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT r.id FROM course_reviews r JOIN courses c ON c.id=r."courseId"
        WHERE true ${filter} ${keyset} ORDER BY r."submittedAt" DESC,r.id ASC LIMIT ${query.limit+1}`);
      const rows=await tx.courseReview.findMany({where:{id:{in:ids.map(r=>r.id)}},select:reviewSelect,orderBy:[{submittedAt:'desc'},{id:'asc'}]});
      return page('course-reviews',query,rows,r=>({id:r.id,at:r.submittedAt}),r=>({...reviewView(r,r.course.revision),course:submittedSnapshot(r).management}),actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  detail(reference:VerifiedSessionReference,id:string){
    return this.prisma.$transaction(async tx=>{
      await this.principals.requireAdmin(tx,reference);
      const row=await tx.courseReview.findUnique({where:{id},select:reviewSelect});if(!row)throw ApiException.notFound();
      return {...reviewView(row,row.course.revision),course:submittedSnapshot(row).authoring};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  decide(reference:VerifiedSessionReference,id:string,input:{expected_revision:number}|{reason:string},result:'approved'|'returned'){
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAdmin(tx,reference);
      const locator=await tx.courseReview.findUnique({where:{id},select:{courseId:true}});if(!locator)throw ApiException.notFound();
      await tx.$queryRaw(Prisma.sql`SELECT id FROM courses WHERE id=${locator.courseId} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM course_reviews WHERE id=${id} FOR UPDATE`);
      const row=await tx.courseReview.findUniqueOrThrow({where:{id},select:reviewSelect}),course=await loadAuthoring(tx,locator.courseId);
      const latest=await tx.courseReview.findFirst({where:{courseId:locator.courseId},orderBy:[{submittedAt:'desc'},{id:'asc'}],select:{id:true}});
      if(row.submittedRevision!==course.revision||'expected_revision'in input&&input.expected_revision!==course.revision||latest?.id!==id)throw ApiException.conflict('revision_conflict','ฉบับที่ส่งตรวจไม่ใช่ฉบับปัจจุบัน');
      if(row.result===result)return reviewView(row,course.revision);
      if(row.result!==null||course.status!=='pending_review')throw ApiException.conflict('invalid_state','Review ไม่ได้รอตรวจ');
      submittedSnapshot(row);if(result==='approved')assertReady(course);
      const saved=await tx.courseReview.update({where:{id},data:{result,reviewedBy:actor.accountId,reviewedAt:new Date(Math.max(Date.now(),row.submittedAt.getTime())),reason:'reason'in input?input.reason:null}});
      await tx.course.update({where:{id:course.id},data:{status:result==='approved'?'approved':'draft'}});
      return reviewView(saved,course.revision);
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:20000});
  }
  publish(reference:VerifiedSessionReference,id:string){
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAuthoring(tx,reference);
      const locks=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM courses WHERE id=${id}
        AND (${actor.roles.includes('admin')} OR "instructorId"=${actor.accountId}) FOR UPDATE`);
      if(!locks.length)throw ApiException.notFound();const course=await loadAuthoring(tx,id);
      if(course.status==='published')return course;
      if(course.status==='archived')throw ApiException.conflict('invalid_state','คอร์ส Archived เผยแพร่จากคำสั่งนี้ไม่ได้');assertReady(course);
      const latest=await tx.courseReview.findFirst({where:{courseId:id},orderBy:[{submittedAt:'desc'},{id:'asc'}]});
      if(course.status==='approved'){
        if(!latest||latest.result!=='approved'||latest.submittedRevision!==course.revision)throw ApiException.conflict('revision_conflict','ต้องตรวจคอร์สฉบับปัจจุบัน');
        submittedSnapshot({...latest,course:{revision:course.revision}});
      }else{
        if(!actor.roles.includes('admin')||!['draft','pending_review'].includes(course.status))throw ApiException.conflict('invalid_state','ต้องผ่าน Admin อนุมัติก่อนเผยแพร่');
        const now=new Date();
        if(course.status==='pending_review'&&latest&&latest.result===null&&latest.submittedRevision===course.revision){
          submittedSnapshot({...latest,course:{revision:course.revision}});
          await tx.courseReview.update({where:{id:latest.id},data:{result:'approved',reviewedBy:actor.accountId,reviewedAt:new Date(Math.max(now.getTime(),latest.submittedAt.getTime())),reason:null}});
        }else{
          const submittedAt=new Date(Math.max(now.getTime(),(latest?.submittedAt.getTime()??0)+1));
          await tx.courseReview.create({data:{courseId:id,submittedRevision:course.revision,submittedBy:actor.accountId,
            submittedAt,result:'approved',reviewedBy:actor.accountId,reviewedAt:submittedAt,
            submittedSnapshot:{version:1,authoring:course,management:managedCourse(await tx.course.findUniqueOrThrow({where:{id},select:managementSelect}))} as unknown as Prisma.InputJsonValue}});
        }
      }
      await tx.course.update({where:{id},data:{status:'published',publishedAt:course.published_at?new Date(course.published_at):new Date(),publishedBy:course.published_by??actor.accountId}});
      return loadAuthoring(tx,id);
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:20000});
  }
}
