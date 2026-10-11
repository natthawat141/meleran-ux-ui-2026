import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { ResumeWriter } from '../../src/features/enrollments/public/index';
import { testConnections } from '../support/postgres';
import { assertTaskContract, assertErrorContract } from '../support/contract-validator';

describe('Continuation: Catalog, owned lists, Redeem list, summaries and resume / real Nest+PostgreSQL',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication;
  const tag='continuation_'+randomUUID(),previousUrl=process.env.DATABASE_URL;
  const accounts:Record<string,string>={},secrets:Record<string,string>={},courses:string[]=[],grants:string[]=[],codes:string[]=[],certificates:string[]=[];
  let videoId:string,articleId:string,quizId:string,attemptId:string;
  const at=new Date('2026-10-11T01:02:03.000Z');
  const http=(path:string,actor?:string,audience='web')=>{
    const r=request(app.getHttpServer()).get('/api/v1'+path);
    return actor?r.set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[actor+'_'+audience]}`):r;
  };
  const save=(id=videoId,body:object={},actor='learner')=>request(app.getHttpServer()).put('/api/v1/learn/items/'+id+'/resume')
    .set('x-melearn-app','web').set('Cookie',`melearn_web_session=${secrets[actor+'_web']}`).send(body);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).map(name=>(db as any)[name[0].toLowerCase()+name.slice(1)].count()));
  const academic=()=>Promise.all([db.enrollment.findMany({where:{id:{in:grants}},orderBy:{id:'asc'}}),
    db.quizAttempt.findMany({where:{courseId:{in:courses}},orderBy:{id:'asc'}}),
    db.certificate.findMany({where:{id:{in:certificates}},orderBy:{id:'asc'}})]);
  beforeAll(async()=>{
    const connections=testConnections();db=connections.runtime;migrator=connections.migrator;
    for(const name of ['learner','other','instructor','otherInstructor','admin']) {
      accounts[name]=(await db.account.create({data:{displayName:tag+name,roles:'admin',profileJson:'{"phone":"PRIVATE_PROFILE"}',
        roleGrants:{create:{role:name==='admin'?'admin':name.includes('Instructor')||name==='instructor'?'instructor':'learner'}}}})).id;
      for(const audience of ['web','admin']) {
        const secret=randomUUID();secrets[name+'_'+audience]=secret;
        await db.appSession.create({data:{tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase(),accountId:accounts[name],
          audience,expiresAt:new Date(Date.now()+3600000)}});
      }
    }
    for(let i=0;i<5;i++)courses.push((await db.course.create({data:{slug:tag+'_'+i,title:tag+' Thai '+i,category:tag,level:'basic',
      instructorId:i===4?accounts.otherInstructor:accounts.instructor,status:i===3?'pending_review':'published',
      publishedAt:i===3?null:at,priceMinor:i===1?19900:i===2?0:null,description:'PRIVATE_BODY',outcomesJson:'["PRIVATE_OUTCOME"]'}})).id);
    const chapter=await db.courseChapter.create({data:{courseId:courses[0],title:'Chapter',position:0}});
    videoId=(await db.courseItem.create({data:{courseId:courses[0],chapterId:chapter.id,title:'Video',type:'video',position:0}})).id;
    articleId=(await db.courseItem.create({data:{courseId:courses[0],chapterId:chapter.id,title:'Article',position:1,contentDoc:{private:'PRIVATE_DOC'}}})).id;
    const quizItem=await db.courseItem.create({data:{courseId:courses[0],chapterId:chapter.id,title:'Quiz',type:'quiz',position:2}});
    quizId=(await db.quiz.create({data:{courseId:courses[0],itemId:quizItem.id,title:'Quiz'}})).id;
    for(let i=0;i<4;i++)grants.push((await db.enrollment.create({data:{courseId:courses[i],accountId:accounts.learner,
      source:i===0?'free':'redeem',grantedAt:at,completedItems:42}})).id);
    grants.push((await db.enrollment.create({data:{courseId:courses[0],accountId:accounts.other,source:'free',grantedAt:at}})).id);
    await db.progress.create({data:{courseId:courses[0],enrollmentId:grants[0],itemId:articleId,completedAt:at}});
    for(let i=1;i<=2;i++) {
      await db.enrollment.update({where:{id:grants[i]},data:{completedAt:at,completionSnapshot:{total_items:0,completed_items:0}}});
      certificates.push((await db.certificate.create({data:{enrollmentId:grants[i],code:tag+'_'+i,courseName:'Historical '+i,recipientName:'Historical learner',issuedAt:at}})).id);
    }
    for(let i=0;i<3;i++)codes.push((await db.redeemCode.create({data:{code:'MLN-'+randomUUID().replaceAll('-','').toUpperCase(),courseId:courses[1],issuedBy:accounts.admin,issuedAt:at}})).id);
    attemptId=(await db.quizAttempt.create({data:{enrollmentId:grants[0],courseId:courses[0],quizId,number:1,status:'pending_review',
      maxScore:2,startedAt:at,submittedAt:at,definitionSnapshot:{item_id:quizItem.id},snapshotQuestions:{create:[0,1].map(position=>({
        questionId:'essay'+position,position,type:'essay',maxScore:1,payloadSnapshot:{prompt:'Question',options:[],correct_key:'PRIVATE_KEY'}}))}}})).id;
    process.env.DATABASE_URL=connections.runtimeUrl;
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();configureApplication(app,[]);await app.init();
  });
  afterAll(async()=>{
    if(app)await app.close();if(previousUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousUrl;
    if(db) {
      if(attemptId){await db.answer.deleteMany({where:{attemptId}});await db.attemptQuestion.deleteMany({where:{attemptId}});await db.quizAttempt.deleteMany({where:{id:attemptId}});}
      if(quizId)await db.quiz.deleteMany({where:{id:quizId}});
      await db.redeemCode.deleteMany({where:{id:{in:codes}}});await db.certificate.deleteMany({where:{id:{in:certificates}}});
      await db.progress.deleteMany({where:{courseId:{in:courses}}});await db.enrollment.deleteMany({where:{id:{in:grants}}});
      await db.course.deleteMany({where:{id:{in:courses}}});const ids=Object.values(accounts);
      await db.appSession.deleteMany({where:{accountId:{in:ids}}});await db.userRole.deleteMany({where:{accountId:{in:ids}}});
      await db.account.deleteMany({where:{id:{in:ids}}});await db.$disconnect();
    }
    if(migrator)await migrator.$disconnect();
  });
  it('Catalog returns only published canonical summaries and strips private data',async()=>{
    const before=await counts(),r=await http('/courses').query({category:tag}).expect(200);
    assertTaskContract('CATALOG-01','CoursePage',r.body);expect(r.body.items).toHaveLength(4);
    expect(r.body.items.map((x:{id:string})=>x.id)).not.toContain(courses[3]);
    expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|profileJson|contentDoc|correct_key|@/);expect(await counts()).toEqual(before);
  });
  it('uses stable keyset pagination for equal publication timestamps without duplicates',async()=>{
    let cursor:string|null=null;const seen:string[]=[];
    do{const r: {body:{items:Array<{id:string}>;next_cursor:string|null}}=await http('/courses').query({category:tag,limit:1,...(cursor?{cursor}:{})}).expect(200);
      assertTaskContract('CATALOG-01','CoursePage',r.body);seen.push(r.body.items[0].id);cursor=r.body.next_cursor;}while(cursor);
    expect(seen).toEqual(courses.filter((_,i)=>i!==3).sort());expect(new Set(seen).size).toBe(4);
  });
  it('implements case-insensitive trimmed title search and exact filters/free-paid parity',async()=>{
    const base={q:' '+tag.toUpperCase()+' thai ',category:tag,level:'basic'};
    const free=await http('/courses').query({...base,price_type:'free'}).expect(200);
    expect(free.body.items).toHaveLength(3);expect(free.body.items.every((x:{price:unknown})=>x.price===null)).toBe(true);
    const paid=await http('/courses').query({...base,price_type:'paid'}).expect(200);
    expect(paid.body.items.map((x:{id:string})=>x.id)).toEqual([courses[1]]);expect(paid.body.items[0].price).toEqual({amount_minor:19900,currency:'THB'});
    expect((await http('/courses').query({category:tag,level:'Basic'}).expect(200)).body.items).toEqual([]);
  });
  it('rejects unknown/repeated/malformed query and tampered/filter-mismatched cursors',async()=>{
    for(const q of ['limit=2.5','limit=51','limit=0','limit=1&limit=2','private=true','price_type=all','q[x]=1'])
      assertErrorContract((await http('/courses?'+q).expect(422)).body);
    const first=await http('/courses').query({category:tag,limit:1}).expect(200),cursor=first.body.next_cursor;
    for(const query of [{category:tag,limit:2,cursor},{category:'other',limit:1,cursor},{category:tag,limit:1,cursor:cursor+'.extra'}])
      await http('/courses').query(query).expect(422);
  });
  it('Instructor public course list uses normalized role, owned published rows, same pagination and missing-user 404',async()=>{
    const path='/instructors/'+accounts.instructor+'/courses',r=await http(path).query({limit:2}).expect(200);
    assertTaskContract('CATALOG-02','PublicInstructorCoursePage',r.body);expect(r.body.items).toHaveLength(2);
    const next=await http(path).query({limit:2,cursor:r.body.next_cursor}).expect(200);
    expect([...r.body.items,...next.body.items].map((x:{id:string})=>x.id).sort()).toEqual(courses.slice(0,3).sort());
    await http('/instructors/'+accounts.learner+'/courses').expect(404);await http('/instructors/'+randomUUID()+'/courses').expect(404);
    await http(path).query({q:'not-declared'}).expect(422);
    await http('/instructors/'+accounts.otherInstructor+'/courses').query({limit:2,cursor:r.body.next_cursor}).expect(422);
  });
  it('own Enrollment list has no foreign/hidden course or cached-counter leakage',async()=>{
    const r=await http('/me/enrollments','learner').expect(200);assertTaskContract('ENROLL-01','EnrollmentPage',r.body);
    expect(r.body.items).toHaveLength(3);expect(r.body.items.map((x:{enrollment:{id:string}})=>x.enrollment.id).sort()).toEqual(grants.slice(0,3).sort());
    const first=r.body.items.find((x:{enrollment:{id:string}})=>x.enrollment.id===grants[0]);
    expect(first.progress).toEqual({completed_items:1,total_items:3,completed_at:null});expect(JSON.stringify(r.body)).not.toContain('PRIVATE_');
  });
  it('owns cursor namespaces and allows historical self reads without new-learning eligibility',async()=>{
    const first=await http('/me/enrollments','learner').query({limit:1}).expect(200);
    const second=await http('/me/enrollments','learner').query({limit:1,cursor:first.body.next_cursor}).expect(200);
    expect(second.body.items[0].enrollment.id).not.toBe(first.body.items[0].enrollment.id);
    await http('/me/enrollments','other').query({limit:1,cursor:first.body.next_cursor}).expect(422);
    await db.account.update({where:{id:accounts.learner},data:{origin:'self_email',emailVerified:false}});
    try{await http('/me/enrollments','learner').expect(200);}finally{await db.account.update({where:{id:accounts.learner},data:{origin:'admin_created'}});}
  });
  it('lists issued Certificate snapshots with owner-bound pagination and no reissue/repair',async()=>{
    const before=await counts(),r=await http('/me/certificates','learner').query({limit:1}).expect(200);
    assertTaskContract('CERT-01','CertificatePage',r.body);expect(r.body.items[0]).toMatchObject({learner_name:'Historical learner'});
    const next=await http('/me/certificates','learner').query({limit:1,cursor:r.body.next_cursor}).expect(200);
    expect([r.body.items[0].id,next.body.items[0].id].sort()).toEqual([...certificates].sort());expect(next.body.next_cursor).toBeNull();
    expect((await http('/me/certificates','other').expect(200)).body.items).toEqual([]);
    await http('/me/certificates','other').query({limit:1,cursor:r.body.next_cursor}).expect(422);expect(await counts()).toEqual(before);
  });
  it('keeps certificates visible after course visibility/profile/title changes',async()=>{
    await db.course.update({where:{id:courses[1]},data:{status:'archived',title:'Edited'}});
    try{const r=await http('/me/certificates','learner').expect(200);expect(r.body.items.find((x:{id:string})=>x.id===certificates[0]).course_title).toBe('Historical 1');}
    finally{await db.course.update({where:{id:courses[1]},data:{status:'published',title:tag+' Thai 1'}});}
  });
  it('Admin redeem list masks full codes, preserves audit nulls and filters/paginates deterministically',async()=>{
    const r=await http('/admin/redeem-codes','admin','admin').query({course_id:courses[1],status:'unused',limit:2}).expect(200);
    assertTaskContract('REDEEM-01','RedeemCodePage',r.body);expect(r.body.items).toHaveLength(2);
    const stored=await db.redeemCode.findMany({where:{id:{in:codes}}});
    for(const row of stored)expect(JSON.stringify(r.body)).not.toContain(row.code);
    expect(r.body.items[0]).toMatchObject({used_by:null,used_at:null,revoked_at:null});
    const next=await http('/admin/redeem-codes','admin','admin').query({course_id:courses[1],status:'unused',limit:2,cursor:r.body.next_cursor}).expect(200);
    expect([...r.body.items,...next.body.items].map((x:{id:string})=>x.id).sort()).toEqual([...codes].sort());
    await http('/admin/redeem-codes','admin','admin').query({status:'unknown'}).expect(422);
    await http('/admin/redeem-codes','admin','admin').query({course_id:''}).expect(422);
  });
  it('Instructor summary counts only owned courses, distinct learners and one pending attempt across two essays',async()=>{
    const before=await counts(),r=await http('/instructor/summary','instructor').expect(200);assertTaskContract('MGMT-05','DashboardDto',r.body);
    expect(r.body).toEqual({course_count:4,enrollment_count:5,learner_count:2,pending_grading_count:1});
    const other=await http('/instructor/summary','otherInstructor').expect(200);expect(other.body).toEqual({course_count:1,enrollment_count:0,learner_count:0,pending_grading_count:0});
    expect(await counts()).toEqual(before);
  });
  it('Admin summary matches actual global rows and exposes only canonical numeric aggregates',async()=>{
    const r=await http('/admin/summary','admin','admin').expect(200);assertTaskContract('MGMT-05','DashboardDto',r.body);
    const distinct=await db.enrollment.findMany({distinct:['accountId'],select:{accountId:true}});
    expect(r.body).toMatchObject({course_count:await db.course.count(),enrollment_count:await db.enrollment.count(),
      learner_count:distinct.length,user_count:await db.account.count(),pending_course_count:await db.course.count({where:{status:'pending_review'}})});
    expect(JSON.stringify(r.body)).not.toContain('PRIVATE_');await http('/admin/summary','admin','admin').query({course_id:courses[0]}).expect(422);
  });
  it('all protected read flows reject anonymous, incorrect namespace and forged role compatibility strings',async()=>{
    for(const path of ['/me/enrollments','/me/certificates','/admin/redeem-codes','/admin/summary','/instructor/summary'])await http(path).expect(401);
    for(const path of ['/admin/redeem-codes','/admin/summary']){await http(path,'learner','admin').expect(403);await http(path,'admin','web').expect(401);}
    await http('/instructor/summary','learner').expect(403);await http('/instructor/summary','admin').expect(403);
  });
  it('read services recheck disabled/revoked actors and do not write',async()=>{
    const before=await counts();await db.account.update({where:{id:accounts.learner},data:{disabled:true}});
    try{await http('/me/enrollments','learner').expect(401);await http('/me/certificates','learner').expect(401);}
    finally{await db.account.update({where:{id:accounts.learner},data:{disabled:false}});}
    expect(await counts()).toEqual(before);
  });
  it('resume saves a real zero, preserves omitted position, explicitly clears null and changes no academic state',async()=>{
    const before=await academic(),zero=await save(videoId,{position_seconds:0}).expect(200);assertTaskContract('LEARN-02','ResumeResponse',zero.body);
    expect(zero.body.resume.position_seconds).toBe(0);expect((await save().expect(200)).body.resume.position_seconds).toBe(0);
    expect((await save(videoId,{position_seconds:null}).expect(200)).body.resume.position_seconds).toBeNull();expect(await academic()).toEqual(before);
    const row=await db.progress.findUniqueOrThrow({where:{enrollmentId_itemId:{enrollmentId:grants[0],itemId:videoId}}});expect(row.completedAt).toBeNull();
  });
  it('allows article resume locator without seconds and leaves original completion untouched',async()=>{
    const r=await save(articleId,{}).expect(200);expect(r.body.resume.position_seconds).toBeNull();
    const row=await db.progress.findUniqueOrThrow({where:{enrollmentId_itemId:{enrollmentId:grants[0],itemId:articleId}}});expect(row.completedAt).toEqual(at);
    await save(articleId,{position_seconds:1}).expect(422);
  });
  it('rejects malformed resume bodies and all forged completion/identity fields',async()=>{
    for(const input of [{position_seconds:-1},{position_seconds:'2'},{position_seconds:true},{user_id:accounts.other},{completed:true},[]])
      assertErrorContract((await save(videoId,input).expect(422)).body);
  });
  it('denies absent entitlement, own-course management, Admin and unverified learning access',async()=>{
    await save(videoId,{},'instructor').expect(403);await save(videoId,{},'admin').expect(403);await save(randomUUID()).expect(404);
    const hiddenChapter=await db.courseChapter.create({data:{courseId:courses[3],title:'Hidden',position:0}});
    const hidden=await db.courseItem.create({data:{courseId:courses[3],chapterId:hiddenChapter.id,title:'Hidden',position:0}});
    await save(hidden.id).expect(404);
    await db.account.update({where:{id:accounts.learner},data:{origin:'self_email',emailVerified:false}});
    try{await save().expect(403);}finally{await db.account.update({where:{id:accounts.learner},data:{origin:'admin_created'}});}
  });
  it('serializes parallel resume saves and learning read returns the last persisted locator after reconnect',async()=>{
    const result=await Promise.all([save(videoId,{position_seconds:12}),save(videoId,{position_seconds:24})]);expect(result.map(r=>r.status)).toEqual([200,200]);
    await db.$disconnect();await db.$connect();const row=await db.progress.findUniqueOrThrow({where:{enrollmentId_itemId:{enrollmentId:grants[0],itemId:videoId}}});
    const r=await http('/learn/courses/'+courses[0],'learner').expect(200);expect(r.body.resume_item_id).toBe(videoId);
    const current=r.body.outline.flatMap((ch:{items:unknown[]})=>ch.items).find((x:{id:string})=>x.id===videoId);
    expect(current.resume.position_seconds).toBe((row.resumeData as {position_seconds:number}).position_seconds);expect(row.completedAt).toBeNull();
  });
  it('rolls back resume participant failures with no partial Progress or academic mutation',async()=>{
    const before=await db.progress.findMany({where:{enrollmentId:grants[0]},orderBy:{itemId:'asc'}});
    const writer=app.get(ResumeWriter),original=writer.save.bind(writer);
    const spy=jest.spyOn(writer,'save').mockImplementation(async(...args)=>{await original(...args);throw Error('PRIVATE_FAILURE');});
    try{const r=await save(videoId,{position_seconds:999}).expect(500);expect(JSON.stringify(r.body)).not.toContain('PRIVATE_FAILURE');}
    finally{spy.mockRestore();}
    expect(await db.progress.findMany({where:{enrollmentId:grants[0]},orderBy:{itemId:'asc'}})).toEqual(before);
  });
});
