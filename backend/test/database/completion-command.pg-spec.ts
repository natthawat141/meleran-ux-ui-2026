import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash,randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { CompletionIssuer } from '../../src/features/certificates/public/index';
import { CompletionCoordinator } from '../../src/features/enrollments/public/index';
import { testConnections } from '../support/postgres';
import { assertTaskContract,assertErrorContract } from '../support/contract-validator';

describe('LEARN-02 manual complete + COMPLETION-01 atomic progress/certificate / HTTP+PG',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication;
  const tag='completion_'+randomUUID(),oldUrl=process.env.DATABASE_URL,accounts:Record<string,string>={},secrets:Record<string,string>={};
  const courses:string[]=[],grants:string[]=[];
  const auth=(r:request.Test,name='learner',audience='web')=>r.set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[name+'_'+audience]}`);
  const complete=(id:string,name='learner',body:unknown={})=>auth(request(app.getHttpServer()).post('/api/v1/learn/items/'+id+'/complete'),name).send(body as object);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).map(n=>(db as any)[n[0].toLowerCase()+n.slice(1)].count()));
  async function fixture(quiz=false,owner='learner'){
    const course=await db.course.create({data:{slug:tag+randomUUID(),title:'ชื่อคอร์ส ณ วันจบ',category:'test',level:'test',status:'published',publishedAt:new Date(),
      instructorId:accounts.instructor,chapters:{create:{title:'บท',position:0,items:{create:[{title:'Video',type:'video',position:0},{title:'Article',type:'article',position:1},
        ...(quiz?[{title:'Quiz',type:'quiz',position:2}]:[])]}}}},include:{chapters:{include:{items:{orderBy:{position:'asc'}}}}}});
    courses.push(course.id);const items=course.chapters[0].items;
    const grant=await db.enrollment.create({data:{accountId:accounts[owner],courseId:course.id,source:'free'}});grants.push(grant.id);
    const quizId=quiz?(await db.quiz.create({data:{courseId:course.id,itemId:items[2].id,title:'Quiz'}})).id:null;
    return {courseId:course.id,enrollmentId:grant.id,video:items[0].id,article:items[1].id,quizItem:quiz?items[2].id:null,quizId,chapterId:course.chapters[0].id};
  }
  async function attempt(f:Awaited<ReturnType<typeof fixture>>,number:number,max:number,earned:number,status='graded',missing=false){
    const time=new Date(),graded=status==='graded';
    const a=await db.quizAttempt.create({data:{courseId:f.courseId,enrollmentId:f.enrollmentId,quizId:f.quizId!,number,status,
      definitionSnapshot:{item_id:f.quizItem,private_key:'SECRET_NEVER_WIRE'},maxScore:new Prisma.Decimal(String(max)),earnedScore:graded?new Prisma.Decimal(String(earned)):null,passed:graded?earned*10>max*7:null,
      submittedAt:time,gradedAt:graded?time:null,snapshotQuestions:{create:{questionId:'q-'+number,type:'essay',position:0,maxScore:new Prisma.Decimal(String(max)),
        payloadSnapshot:{prompt:'โจทย์เก่า',options:[],correct_key:'SECRET_NEVER_WIRE'}}}}});
    if(!missing)await db.answer.create({data:{attemptId:a.id,questionId:'q-'+number,response:{text:'คำตอบ'},score:graded?new Prisma.Decimal(String(earned)):null,
      gradedBy:graded?accounts.instructor:null,gradedAt:graded?time:null}});
    return a;
  }
  beforeAll(async()=>{
    const connections=testConnections();db=connections.runtime;migrator=connections.migrator;
    for(const name of ['learner','other','instructor','admin','pending']){
      accounts[name]=(await db.account.create({data:{displayName:'ชื่อผู้เรียน '+name,roles:'admin',origin:name==='pending'?'self_email':'admin_created',
        roleGrants:{create:{role:['instructor','admin'].includes(name)?name:'learner'}}}})).id;
      for(const audience of ['web','admin']){const secret=randomUUID();secrets[name+'_'+audience]=secret;
        await db.appSession.create({data:{accountId:accounts[name],audience,expiresAt:new Date(Date.now()+3600000),
          tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase()}});}
    }
    process.env.DATABASE_URL=connections.runtimeUrl;
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication({logger:false});configureApplication(app,[]);await app.init();
  });
  afterAll(async()=>{
    if(app)await app.close();if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;
    if(db){const where={courseId:{in:courses}};const attemptIds=(await db.quizAttempt.findMany({where,select:{id:true}})).map(a=>a.id);
      await db.answer.deleteMany({where:{attemptId:{in:attemptIds}}});await db.attemptQuestion.deleteMany({where:{attemptId:{in:attemptIds}}});
      await db.quizAttempt.deleteMany({where});await db.question.deleteMany({where:{quiz:where}});await db.quiz.deleteMany({where});
      await db.certificate.deleteMany({where:{enrollment:where}});await db.progress.deleteMany({where});await db.enrollment.deleteMany({where});await db.course.deleteMany({where:{id:{in:courses}}});
      const ids={in:Object.values(accounts)};await db.appSession.deleteMany({where:{accountId:ids}});await db.userRole.deleteMany({where:{accountId:ids}});await db.account.deleteMany({where:{id:ids}});await db.$disconnect();}
    if(migrator)await migrator.$disconnect();
  });
  it('Article/Video exact HTTP response and first completion/certificate are durable and repeat-safe',async()=>{
    const f=await fixture();const first=await complete(f.video).expect(200);assertTaskContract('LEARN-02','CompleteResponse',first.body);
    expect(first.body.progress).toMatchObject({completed_items:1,total_items:2,completed_at:null});expect(first.body.certificate_id).toBeNull();
    const second=await complete(f.article).expect(200);assertTaskContract('LEARN-02','CompleteResponse',second.body);
    expect(second.body.progress.completed_items).toBe(2);expect(second.body.course_completed_at).toBe(second.body.progress.completed_at);
    const saved=await db.enrollment.findUniqueOrThrow({where:{id:f.enrollmentId}}),cert=await db.certificate.findUniqueOrThrow({where:{enrollmentId:f.enrollmentId}});
    expect(saved.completionSnapshot).toMatchObject({version:1,course_id:f.courseId,items:expect.arrayContaining([{item_id:f.video,type:'video',completed_at:first.body.completed_at}])});
    expect(cert.id).toBe(second.body.certificate_id);expect(cert.recipientName).toBe('ชื่อผู้เรียน learner');expect(cert.courseName).toBe('ชื่อคอร์ส ณ วันจบ');
    const repeat=await complete(f.article).expect(200);expect(repeat.body).toEqual(second.body);
    expect(await db.certificate.count({where:{enrollmentId:f.enrollmentId}})).toBe(1);
  });
  it('concurrent last items serialize and issue exactly one Certificate',async()=>{
    const f=await fixture();const responses=await Promise.all([complete(f.video),complete(f.article),complete(f.article)]);
    expect(responses.every(r=>r.status===200)).toBe(true);const certificates=await db.certificate.findMany({where:{enrollmentId:f.enrollmentId}});expect(certificates).toHaveLength(1);
    expect(await db.progress.count({where:{enrollmentId:f.enrollmentId,completedAt:{not:null}}})).toBe(2);
  });
  it('completion preserves saved Video resume and later resume preserves immutable completion',async()=>{
    const f=await fixture();await auth(request(app.getHttpServer()).put('/api/v1/learn/items/'+f.video+'/resume')).send({position_seconds:18}).expect(200);
    const before=await db.progress.findUniqueOrThrow({where:{enrollmentId_itemId:{enrollmentId:f.enrollmentId,itemId:f.video}}});await complete(f.video).expect(200);await complete(f.article).expect(200);
    expect((await db.progress.findUniqueOrThrow({where:{id:before.id}})).resumeData).toEqual(before.resumeData);
    const completed=await db.enrollment.findUniqueOrThrow({where:{id:f.enrollmentId}});await auth(request(app.getHttpServer()).put('/api/v1/learn/items/'+f.video+'/resume')).send({position_seconds:20}).expect(200);
    expect(await db.enrollment.findUniqueOrThrow({where:{id:f.enrollmentId}})).toEqual(completed);
  });
  it('Certificate participant failure rolls back the last Progress, first completion and snapshot together',async()=>{
    const f=await fixture();await complete(f.video).expect(200);const before=await counts();const spy=jest.spyOn(app.get(CompletionIssuer),'issue').mockRejectedValueOnce(Error('PRIVATE_FAILURE'));
    const r=await complete(f.article).expect(500);assertErrorContract(r.body);spy.mockRestore();expect(JSON.stringify(r.body)).not.toContain('PRIVATE_FAILURE');expect(await counts()).toEqual(before);
    expect((await db.enrollment.findUniqueOrThrow({where:{id:f.enrollmentId}})).completedAt).toBeNull();await complete(f.article).expect(200);
  });
  it('new content before first completion is required; no rounded-100 shortcut',async()=>{
    const f=await fixture();await complete(f.video).expect(200);await db.courseItem.create({data:{courseId:f.courseId,chapterId:f.chapterId,title:'เพิ่มก่อนจบ',type:'article',position:2}});
    const r=await complete(f.article).expect(200);expect(r.body.progress).toMatchObject({completed_items:2,total_items:3,completed_at:null});expect(r.body.certificate_id).toBeNull();
  });
  it('new content and name edits after completion preserve original snapshot/Certificate',async()=>{
    const f=await fixture();await complete(f.video).expect(200);const r=await complete(f.article).expect(200);const original=await db.enrollment.findUniqueOrThrow({where:{id:f.enrollmentId}});
    const cert=await db.certificate.findUniqueOrThrow({where:{enrollmentId:f.enrollmentId}});const extra=await db.courseItem.create({data:{courseId:f.courseId,chapterId:f.chapterId,title:'เพิ่มหลังจบ',type:'article',position:2}});
    await db.course.update({where:{id:f.courseId},data:{title:'ชื่อใหม่'}});await db.account.update({where:{id:accounts.learner},data:{displayName:'ชื่อใหม่'}});
    const next=await complete(extra.id).expect(200);expect(next.body.certificate_id).toBe(r.body.certificate_id);
    expect(await db.enrollment.findUniqueOrThrow({where:{id:f.enrollmentId}})).toEqual(original);expect(await db.certificate.findUniqueOrThrow({where:{id:cert.id}})).toEqual(cert);
    await db.account.update({where:{id:accounts.learner},data:{displayName:'ชื่อผู้เรียน learner'}});
  });
  it('Quiz 70 percent exactly and pending grading do not complete; higher fully graded result does',async()=>{
    const f=await fixture(true);await attempt(f,1,100,70);await attempt(f,2,100,90,'pending_review');await complete(f.video).expect(200);
    const r=await complete(f.article).expect(200);expect(r.body.progress.completed_items).toBe(2);expect(r.body.certificate_id).toBeNull();
    const passed=await attempt(f,3,100,70.01);const next=await complete(f.article).expect(200);expect(next.body.progress.completed_items).toBe(3);
    expect((await db.enrollment.findUniqueOrThrow({where:{id:f.enrollmentId}})).completionSnapshot).toMatchObject({items:expect.arrayContaining([expect.objectContaining({item_id:f.quizItem,quiz:expect.objectContaining({attempt_id:passed.id,earned:'70.01',max:'100'})})])});
  });
  it('best percentage across changed maxima wins; a lower new attempt cannot erase a passed result',async()=>{
    const f=await fixture(true);const best=await attempt(f,1,10,9);await attempt(f,2,100,80);await attempt(f,3,100,60);
    await complete(f.video).expect(200);await complete(f.article).expect(200);
    expect((await db.enrollment.findUniqueOrThrow({where:{id:f.enrollmentId}})).completionSnapshot).toMatchObject({items:expect.arrayContaining([expect.objectContaining({quiz:expect.objectContaining({attempt_id:best.id,percent:90})})])});
  });
  it('equal ratios use first historical attempt deterministically',async()=>{
    const f=await fixture(true);const first=await attempt(f,1,10,8);await attempt(f,2,100,80);await complete(f.video).expect(200);await complete(f.article).expect(200);
    expect((await db.enrollment.findUniqueOrThrow({where:{id:f.enrollmentId}})).completionSnapshot).toMatchObject({items:expect.arrayContaining([expect.objectContaining({quiz:expect.objectContaining({attempt_id:first.id})})])});
  });
  it('an orphaned graded result with missing responses fails closed and leaves manual Progress unmodified',async()=>{
    const f=await fixture(true);await attempt(f,1,100,80,'graded',true);const before=await counts();await complete(f.video).expect(500);expect(await counts()).toEqual(before);
    expect(await db.progress.count({where:{enrollmentId:f.enrollmentId}})).toBe(0);
  });
  it('a compatibility Quiz completed flag without a valid graded proof cannot issue a Certificate',async()=>{
    const f=await fixture(true);await db.progress.create({data:{enrollmentId:f.enrollmentId,courseId:f.courseId,itemId:f.quizItem!,completedAt:new Date()}});
    await complete(f.video).expect(200);const r=await complete(f.article).expect(200);expect(r.body.progress.completed_items).toBe(2);expect(r.body.certificate_id).toBeNull();
  });
  it('manual Quiz completion, forged grades/counters and nonempty body are rejected without writes',async()=>{
    const f=await fixture(true),before=await counts();await complete(f.quizItem!).expect(409);
    for(const body of [{score:100},{completed_items:99},{completed_at:new Date().toISOString()},[]])await complete(f.video,'learner',body).expect(422);
    expect(await counts()).toEqual(before);
  });
  it('anonymous, foreign, pending, Admin, Instructor owner and hidden course paths cannot create academic effects',async()=>{
    const f=await fixture(),before=await counts();await request(app.getHttpServer()).post('/api/v1/learn/items/'+f.video+'/complete').send({}).expect(401);
    for(const name of ['other','pending','admin','instructor'])await complete(f.video,name).expect(403);
    await auth(request(app.getHttpServer()).post('/api/v1/learn/items/'+f.video+'/complete'),'admin','admin').send({}).expect(401);
    await complete('unknown').expect(404);await db.course.update({where:{id:f.courseId},data:{status:'draft'}});await complete(f.video).expect(404);expect(await counts()).toEqual(before);
  });
  it('completed result, snapshot and certificate survive reconnect and feed actual read handlers',async()=>{
    const f=await fixture();await complete(f.video).expect(200);const result=await complete(f.article).expect(200);await db.$disconnect();await db.$connect();const before=await counts();
    const course=await auth(request(app.getHttpServer()).get('/api/v1/learn/courses/'+f.courseId)).expect(200);expect(course.body.certificate_id).toBe(result.body.certificate_id);
    const certificate=await auth(request(app.getHttpServer()).get('/api/v1/me/certificates/'+result.body.certificate_id)).expect(200);assertTaskContract('CERT-01','WireServerCertificate',certificate.body);
    expect(await counts()).toEqual(before);
  });
  it('trusted grading reevaluation alone can complete a Quiz-only course atomically',async()=>{
    const f=await fixture(true);await db.courseItem.deleteMany({where:{id:{in:[f.video,f.article]}}});await attempt(f,1,100,80);
    const state=await db.$transaction(async tx=>{await tx.$queryRaw(Prisma.sql`SELECT id FROM courses WHERE id=${f.courseId} FOR SHARE`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM enrollments WHERE id=${f.enrollmentId} FOR UPDATE`);return app.get(CompletionCoordinator).evaluate(tx,f.enrollmentId,f.courseId);});
    expect(state.completed_items).toBe(1);expect(state.certificate_id).toBeTruthy();expect(await db.certificate.count({where:{enrollmentId:f.enrollmentId}})).toBe(1);
  });
  it('own progress page exposes exact counts/resume IDs but no content, snapshot, certificate or private fields',async()=>{
    const f=await fixture();await auth(request(app.getHttpServer()).put('/api/v1/learn/items/'+f.video+'/resume')).send({position_seconds:10}).expect(200);
    await complete(f.video).expect(200);const before=await counts();
    const r=await auth(request(app.getHttpServer()).get('/api/v1/me/progress')).query({limit:50}).expect(200);assertTaskContract('LEARN-01','ProgressPage',r.body);
    expect(r.body.items.find((x:{course_id:string})=>x.course_id===f.courseId)).toEqual({course_id:f.courseId,enrollment_id:f.enrollmentId,
      progress:{completed_items:1,total_items:2,completed_at:null},resume_item_id:f.video,completed_at:null});
    expect(JSON.stringify(r.body)).not.toMatch(/SECRET_|position_seconds|display_name|certificate_id|completionSnapshot|body_doc/);expect(await counts()).toEqual(before);
  });
  it('historical own progress remains available when a completed course is archived',async()=>{
    const f=await fixture();await complete(f.video).expect(200);const done=await complete(f.article).expect(200);await db.course.update({where:{id:f.courseId},data:{status:'archived'}});
    const r=await auth(request(app.getHttpServer()).get('/api/v1/me/progress')).query({limit:50}).expect(200);
    expect(r.body.items.find((x:{course_id:string})=>x.course_id===f.courseId).completed_at).toBe(done.body.course_completed_at);
  });
  it('own progress binds pagination to owner/limit/route and preserves page order',async()=>{
    const r=await auth(request(app.getHttpServer()).get('/api/v1/me/progress')).query({limit:1}).expect(200);
    const next=await auth(request(app.getHttpServer()).get('/api/v1/me/progress')).query({limit:1,cursor:r.body.next_cursor}).expect(200);
    expect(next.body.items[0].enrollment_id).not.toBe(r.body.items[0].enrollment_id);
    await auth(request(app.getHttpServer()).get('/api/v1/me/progress'),'other').query({limit:1,cursor:r.body.next_cursor}).expect(422);
    await auth(request(app.getHttpServer()).get('/api/v1/me/progress')).query({limit:2,cursor:r.body.next_cursor}).expect(422);
    await auth(request(app.getHttpServer()).get('/api/v1/me/enrollments')).query({limit:1,cursor:r.body.next_cursor}).expect(422);
  });
  it('foreign Instructor/Admin and pending accounts see only their own historical metadata',async()=>{
    for(const [name,audience]of [['other','web'],['instructor','web'],['admin','admin'],['pending','web']]){
      const r=await auth(request(app.getHttpServer()).get('/api/v1/me/progress'),name,audience).expect(200);expect(r.body.items).toEqual([]);
    }
    await request(app.getHttpServer()).get('/api/v1/me/progress').expect(401);
  });
  it('own progress rejects foreign filters, duplicate limit and malformed cursor without writes',async()=>{
    const before=await counts();for(const query of ['account_id=foreign','limit=0','limit=1&limit=2','cursor=bad','q=no'])
      await auth(request(app.getHttpServer()).get('/api/v1/me/progress?'+query)).expect(422);expect(await counts()).toEqual(before);
  });
  it('an empty course never completes or issues a Certificate from an internal reevaluation',async()=>{
    const f=await fixture();await db.courseItem.deleteMany({where:{courseId:f.courseId}});
    const state=await db.$transaction(async tx=>{await tx.$queryRaw(Prisma.sql`SELECT id FROM courses WHERE id=${f.courseId} FOR SHARE`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM enrollments WHERE id=${f.enrollmentId} FOR UPDATE`);return app.get(CompletionCoordinator).evaluate(tx,f.enrollmentId,f.courseId);});
    expect(state).toEqual({completed_items:0,total_items:0,completed_at:null,certificate_id:null});
  });
  it('contradictory persisted grade totals and missing manual-grader proof fail closed',async()=>{
    for(const kind of ['sum','provenance']){
      const f=await fixture(true),a=await attempt(f,1,100,80);
      await db.answer.updateMany({where:{attemptId:a.id},data:kind==='sum'?{score:70}:{gradedBy:null}});
      const before=await counts();await complete(f.video).expect(500);expect(await counts()).toEqual(before);
    }
  });
  it('a historical completed row missing its Certificate requires explicit repair, not silent reissuance',async()=>{
    const f=await fixture();await complete(f.video).expect(200);await complete(f.article).expect(200);
    await db.certificate.deleteMany({where:{enrollmentId:f.enrollmentId}});const before=await counts();await complete(f.article).expect(500);expect(await counts()).toEqual(before);
  });
  it('simultaneous grading reevaluations serialize on Enrollment and share one Certificate',async()=>{
    const f=await fixture(true);await db.courseItem.deleteMany({where:{id:{in:[f.video,f.article]}}});await attempt(f,1,100,90);
    const evaluate=()=>db.$transaction(async tx=>{await tx.$queryRaw(Prisma.sql`SELECT id FROM courses WHERE id=${f.courseId} FOR SHARE`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM enrollments WHERE id=${f.enrollmentId} FOR UPDATE`);return app.get(CompletionCoordinator).evaluate(tx,f.enrollmentId,f.courseId);});
    const results=await Promise.all([evaluate(),evaluate()]);expect(results[0].certificate_id).toBe(results[1].certificate_id);
    expect(await db.certificate.count({where:{enrollmentId:f.enrollmentId}})).toBe(1);
  });
});
