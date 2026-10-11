import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { CoursePatch,ChapterWrite,ItemWrite,QuestionWrite } from './dto/course-patch.pipe';
import { authoringSelect,authoringView,AuthoringDto } from './dto/authoring-course.dto';
import { reviewView,managementSelect,managedCourse } from './dto/managed-course.dto';

export async function loadAuthoring(tx:Prisma.TransactionClient,id:string):Promise<AuthoringDto>{
  const row=await tx.course.findUniqueOrThrow({where:{id},select:authoringSelect});
  const keys=await tx.question.findMany({where:{quiz:{courseId:id}},select:{id:true,correctKey:true}});
  return authoringView(row,new Map(keys.map(q=>[q.id,q.correctKey])));
}
export function assertReady(course:AuthoringDto):void{
  if(!course.title.trim()||!course.category.trim()||!course.instructor.id||!course.chapters.flatMap(ch=>ch.items).length)
    throw ApiException.validationFailed('คอร์สยังไม่พร้อมตรวจหรือเผยแพร่');
  for(const chapter of course.chapters){
    if(!chapter.title.trim())throw ApiException.validationFailed('ต้องระบุชื่อบท');
    for(const item of chapter.items){
      if(!item.title.trim())throw ApiException.validationFailed('ต้องระบุชื่อเนื้อหา');
      if(item.type==='video'&&!youtube(item.video_url??''))throw ApiException.validationFailed('ต้องระบุลิงก์ YouTube ที่ใช้เรียนได้');
      if(item.type==='article'&&!item.body?.trim()&&!richText(item.body_doc))throw ApiException.validationFailed('บทอ่านต้องมีเนื้อหา');
      if(item.type==='quiz'){
        const questions=item.quiz?.questions??[];
        const total=questions.reduce((sum,q)=>sum.plus(q.points),new Prisma.Decimal(0));
        if(!questions.length||total.lessThanOrEqualTo(0)||total.greaterThanOrEqualTo('1e35'))throw ApiException.validationFailed('แบบฝึกหัดต้องมีคำถามและคะแนนเต็มที่จัดเก็บได้');
        for(const q of questions){
          if(!q.prompt.trim()&&!richText(q.prompt_doc))throw ApiException.validationFailed('คำถามต้องมีโจทย์');
          if(['single_choice','multiple_choice'].includes(q.type)&&((q.options?.length??0)<2||q.options!.some(o=>!o.text.trim())||!(q.correct_option_ids?.length)||
            q.type==='single_choice'&&q.correct_option_ids!.length!==1))throw ApiException.validationFailed('คำถามเลือกตอบต้องมีตัวเลือกและวิธีตรวจ');
        }
      }
    }
  }
}
function richText(v:unknown):boolean{
  if(!v||typeof v!=='object')return false;if(Array.isArray(v))return v.some(richText);
  const r=v as Record<string,unknown>,attrs=r.attrs as Record<string,unknown>|undefined;
  return typeof r.text==='string'&&!!r.text.trim()||r.type==='image'&&!!attrs&&typeof attrs.src==='string'&&/^(https?:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp);base64,)/i.test(attrs.src)||
    Object.values(r).some(x=>typeof x==='object'&&richText(x));
}
function youtube(v:string):boolean{
  try{const url=new URL(v);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return false;
    const host=url.hostname.toLowerCase(),id=host==='youtu.be'?url.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host)
      ?url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)\/?$/)?.[1]:null;
    return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id);
  }catch{return false;}
}
const json=(value:Prisma.InputJsonValue|null)=>value===null?Prisma.JsonNull:value;
const unique=(ids:string[])=>{if(new Set(ids).size!==ids.length)throw ApiException.validationFailed('ID ซ้ำในโครงสร้างคอร์ส');};

@Injectable()
export class AuthoringWriteService{
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  patch(reference:VerifiedSessionReference,id:string,input:CoursePatch){
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAuthoring(tx,reference);
      const locks=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM courses WHERE id=${id}
        AND (${actor.roles.includes('admin')} OR "instructorId"=${actor.accountId}) FOR UPDATE`);
      if(!locks.length)throw ApiException.notFound();
      const current=await loadAuthoring(tx,id);
      if(current.revision!==input.expected_revision)throw ApiException.conflict('revision_conflict','คอร์สถูกแก้แล้ว กรุณาโหลดข้อมูลล่าสุด');
      if(current.revision===2147483647)throw ApiException.conflict('invalid_state','Revision เกินขอบเขตที่รองรับ');
      if(input.instructor_id!==undefined){
        if(!actor.roles.includes('admin')&&input.instructor_id!==current.instructor.id)throw ApiException.forbidden('Admin เท่านั้นที่เปลี่ยน Instructor');
        const grants=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT a.id FROM accounts a JOIN user_roles r ON r."accountId"=a.id
          WHERE a.id=${input.instructor_id} AND r.role='instructor' FOR SHARE OF a,r`);
        if(!grants.length)throw ApiException.validationFailed('ต้องเลือก Instructor ที่มีสิทธิ์');
      }
      if(input.chapters!==undefined)await this.writeChapters(tx,id,input.chapters);
      const data:Prisma.CourseUncheckedUpdateInput={revision:{increment:1},status:['approved','pending_review'].includes(current.status)?'draft':current.status};
      const mapped={title:'title',subtitle:'subtitle',description:'description',cover_url:'coverUrl',category:'category',level:'level',instructor_id:'instructorId'} as const;
      for(const [wire,column]of Object.entries(mapped))if(input[wire as keyof typeof mapped]!==undefined)(data as Record<string,unknown>)[column]=input[wire as keyof typeof mapped];
      if(input.price!==undefined)data.priceMinor=input.price?.amount_minor??null;
      if(input.outcomes!==undefined)data.outcomesJson=JSON.stringify(input.outcomes);
      await tx.course.update({where:{id},data});return loadAuthoring(tx,id);
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:20000});
  }
  submit(reference:VerifiedSessionReference,id:string,revision:number){
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAuthoring(tx,reference);
      if(reference.audience!=='web'||actor.roles.includes('admin')||!actor.roles.includes('instructor'))throw ApiException.forbidden();
      const rows=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM courses WHERE id=${id} AND "instructorId"=${actor.accountId} FOR UPDATE`);
      if(!rows.length)throw ApiException.notFound();const course=await loadAuthoring(tx,id);
      if(course.revision!==revision)throw ApiException.conflict('revision_conflict','คอร์สถูกแก้แล้ว');
      if(course.status==='pending_review'){
        const latest=await tx.courseReview.findFirst({where:{courseId:id},orderBy:[{submittedAt:'desc'},{id:'asc'}]});
        if(latest&&latest.submittedRevision===revision&&latest.result===null)return reviewView(latest,revision);
      }
      if(course.status!=='draft')throw ApiException.conflict('invalid_state','ส่งตรวจได้จาก Draft');assertReady(course);
      const previous=await tx.courseReview.findFirst({where:{courseId:id},orderBy:{submittedAt:'desc'},select:{submittedAt:true}});
      const submittedAt=new Date(Math.max(Date.now(),(previous?.submittedAt.getTime()??0)+1));
      await tx.course.update({where:{id},data:{status:'pending_review'}});
      const review=await tx.courseReview.create({data:{courseId:id,submittedRevision:revision,submittedBy:actor.accountId,submittedAt}});
      const snapshot={version:1,authoring:await loadAuthoring(tx,id),management:managedCourse(await tx.course.findUniqueOrThrow({where:{id},select:managementSelect}))};
      await tx.courseReview.update({where:{id:review.id},data:{submittedSnapshot:snapshot as unknown as Prisma.InputJsonValue}});
      return reviewView(review,revision);
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:20000});
  }
  private async writeChapters(tx:Prisma.TransactionClient,courseId:string,input:ChapterWrite[]){
    const existing=await tx.courseChapter.findMany({where:{courseId},include:{items:{include:{transcript:true,_count:{select:{progress:true}},quiz:{include:{_count:{select:{attempts:true}},questions:true}}}}}});
    const chapterMap=new Map(existing.map(ch=>[ch.id,ch])),items=existing.flatMap(ch=>ch.items),itemMap=new Map(items.map(i=>[i.id,i]));
    unique(input.filter(ch=>ch.id!==undefined).map(ch=>ch.id!));unique(input.flatMap(ch=>ch.items).filter(i=>i.id!==undefined).map(i=>i.id!));
    for(const ch of input){if(ch.id!==undefined&&!chapterMap.has(ch.id))throw ApiException.validationFailed('Chapter ID ไม่ได้อยู่ในคอร์สนี้');
      for(const item of ch.items){if(item.id!==undefined&&!itemMap.has(item.id))throw ApiException.validationFailed('Item ID ไม่ได้อยู่ในคอร์สนี้');
        const old=item.id?itemMap.get(item.id):undefined;
        if(old&&old.type!==item.type&&(old._count.progress||old.quiz?._count.attempts||old.transcript))throw ApiException.conflict('learning_history_conflict','เปลี่ยนชนิดรายการที่มีประวัติไม่ได้');
        if(item.video_url&& !youtube(item.video_url))throw ApiException.validationFailed('รองรับ YouTube Link เท่านั้น');
      }
    }
    const retained=new Set(input.flatMap(ch=>ch.items).flatMap(i=>i.id?[i.id]:[]));
    for(const old of items)if(!retained.has(old.id)&&(old._count.progress||old.quiz?._count.attempts||old.transcript))throw ApiException.conflict('learning_history_conflict','ลบรายการที่มีผลเรียนหรือ Transcript ไม่ได้');
    // Park above every existing position, preserving IDs and nonnegative constraints.
    const chapterOffset=Math.max(0,...existing.map(ch=>ch.position))+input.length+1;
    for(const [i,ch]of existing.entries())await tx.courseChapter.update({where:{id:ch.id},data:{position:chapterOffset+i}});
    const itemOffset=Math.max(0,...items.map(i=>i.position))+input.flatMap(ch=>ch.items).length+1;
    for(const [i,item]of items.entries())await tx.courseItem.update({where:{id:item.id},data:{position:itemOffset+i}});
    const keptChapters:string[]=[];
    for(const [position,ch]of input.entries()){
      const id=ch.id??randomUUID();keptChapters.push(id);
      if(ch.id)await tx.courseChapter.update({where:{id},data:{title:ch.title,position,...(ch.description!==undefined?{description:ch.description}:{})}});
      else await tx.courseChapter.create({data:{id,courseId,title:ch.title,position,description:ch.description}});
      for(const [itemPosition,item]of ch.items.entries())await this.writeItem(tx,courseId,id,itemPosition,item,item.id?itemMap.get(item.id):undefined);
    }
    for(const old of items)if(!retained.has(old.id)){
      if(old.quiz){await tx.question.deleteMany({where:{quizId:old.quiz.id}});await tx.quiz.delete({where:{id:old.quiz.id}});}
      await tx.courseItem.delete({where:{id:old.id}});
    }
    await tx.courseChapter.deleteMany({where:{courseId,id:{notIn:keptChapters}}});
  }
  private async writeItem(tx:Prisma.TransactionClient,courseId:string,chapterId:string,position:number,item:ItemWrite,
    old?:Prisma.CourseItemGetPayload<{include:{transcript:true;_count:{select:{progress:true}};quiz:{include:{_count:{select:{attempts:true}};questions:true}}}}>) {
    const id=item.id??randomUUID(),data:Prisma.CourseItemUncheckedUpdateInput={chapterId,position,title:item.title,type:item.type,revision:{increment:1}};
    const fields={description:'description',body:'body',video_url:'videoUrl',duration:'duration',reading_minutes:'readingMinutes'} as const;
    for(const [wire,column]of Object.entries(fields))if(item[wire as keyof typeof fields]!==undefined)(data as Record<string,unknown>)[column]=item[wire as keyof typeof fields];
    if(item.body_doc!==undefined)data.contentDoc=json(item.body_doc);
    if(old&&old.type!==item.type){data.body=null;data.contentDoc=Prisma.DbNull;data.videoUrl=null;
      if(item.body!==undefined)data.body=item.body;if(item.body_doc!==undefined)data.contentDoc=json(item.body_doc);if(item.video_url!==undefined)data.videoUrl=item.video_url;
      if(old.quiz){await tx.question.deleteMany({where:{quizId:old.quiz.id}});await tx.quiz.delete({where:{id:old.quiz.id}});}
    }
    if(old)await tx.courseItem.update({where:{id},data});
    else await tx.courseItem.create({data:{id,courseId,chapterId,position,title:item.title,type:item.type,revision:1,description:item.description,body:item.body,
      contentDoc:item.body_doc!==undefined?json(item.body_doc):Prisma.DbNull,videoUrl:item.video_url,duration:item.duration,readingMinutes:item.reading_minutes}});
    if(item.type==='quiz'){
      const quiz=old?.type==='quiz'?old.quiz:undefined;
      const current=quiz??await tx.quiz.create({data:{courseId,itemId:id,title:item.title}});
      await tx.quiz.update({where:{id:current.id},data:{title:item.title}});
      if(item.quiz)await this.writeQuestions(tx,current.id,item.quiz.questions);
    }
  }
  private async writeQuestions(tx:Prisma.TransactionClient,quizId:string,questions:QuestionWrite[]){
    const old=await tx.question.findMany({where:{quizId}}),known=new Map(old.map(q=>[q.id,q]));unique(questions.flatMap(q=>q.id?[q.id]:[]));
    for(const q of questions)if(q.id!==undefined&&!known.has(q.id))throw ApiException.validationFailed('Question ID ไม่ได้อยู่ใน Quiz นี้');
    const offset=Math.max(0,...old.map(q=>q.position))+questions.length+1;
    for(const [i,q]of old.entries())await tx.question.update({where:{id:q.id},data:{position:offset+i}});
    const keep:string[]=[];
    for(const [position,q]of questions.entries()){
      const id=q.id??randomUUID();keep.push(id);const prior=q.id?known.get(q.id):undefined;
      const oldOptions=Array.isArray(prior?.options)?prior.options as Array<{id?:unknown}>:[];
      const options=(q.options??[]).map(o=>{if(o.id!==undefined&&!oldOptions.some(x=>x&&typeof x==='object'&&x.id===o.id))throw ApiException.validationFailed('Option ID ไม่ได้อยู่ในคำถามนี้');return {id:o.id??randomUUID(),text:o.text};});
      unique(options.map(o=>o.id));
      const data={position,type:q.type,maxScore:new Prisma.Decimal(q.points),prompt:{prompt:q.prompt,...(q.prompt_doc!==undefined?{prompt_doc:q.prompt_doc}:{}),
        ...(q.rubric!==undefined?{rubric:q.rubric}:{}),...(q.response_mode!==undefined?{response_mode:q.response_mode}:{})},options,
        correctKey:{option_ids:(q.correct_option_indices??[]).map(i=>options[i].id)}};
      if(prior)await tx.question.update({where:{id},data});else await tx.question.create({data:{id,quizId,...data}});
    }
    await tx.question.deleteMany({where:{quizId,id:{notIn:keep}}});
  }
}
