import { INestApplication,Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { createHash,randomUUID } from 'node:crypto';
import request=require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { CompletionCoordinator } from '../../src/features/enrollments/public/index';
import { AssessmentWriteService } from '../../src/features/assessments/assessment-write.service';
import { testConnections } from '../support/postgres';
import { assertTaskContract,assertErrorContract } from '../support/contract-validator';

describe('ASSESS-01/02 GRADE-01 real HTTP snapshot lifecycle and atomic PostgreSQL completion',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication,courseId:string,itemId:string,quizId:string,enrollmentId:string;
  const previous=process.env.DATABASE_URL,tag='assessment_write_'+randomUUID(),accounts:Record<string,string>={},secrets:Record<string,string>={};
  const questions:Record<string,string>={};
  const call=(method:'get'|'post'|'put',path:string,actor='learner')=>request(app.getHttpServer())[method]('/api/v1'+path).set('x-melearn-app','web').set('Cookie',`melearn_web_session=${secrets[actor]}`);
  const start=()=>call('post',`/learn/items/${itemId}/attempts`).send({});
  const save=(id:string,answers:unknown)=>call('put',`/learn/attempts/${id}/answers`).send({answers});
  const submit=(id:string)=>call('post',`/learn/attempts/${id}/submit`).send({});
  const grade=(id:string,q:string,score=4,actor='instructor')=>call('put',`/instructor/attempts/${id}/questions/${q}/grade`,actor).send({score,comment:'ตรวจแล้ว'});
  const results=()=>call('get',`/learn/items/${itemId}/results`);
  const queue=(actor='instructor',query='')=>call('get','/instructor/grading-queue'+query,actor);
  const full=()=>({[questions.single]:{option_ids:['a']},[questions.multiple]:{option_ids:['a','b']},[questions.essay]:{text:'คำตอบ'},[questions.image]:{image_url:'https://example.test/answer.png'}});
  const academic=()=>Promise.all([db.quizAttempt.findMany({where:{courseId},orderBy:{number:'asc'}}),db.answer.findMany({where:{question:{attempt:{courseId}}},orderBy:{id:'asc'}}),
    db.enrollment.findUniqueOrThrow({where:{id:enrollmentId}}),db.progress.findMany({where:{courseId}}),db.certificate.findMany({where:{enrollment:{courseId}}})]);
  async function cleanupAttempts(){
    await db.certificate.deleteMany({where:{enrollment:{courseId}}});await db.progress.deleteMany({where:{courseId}});
    await db.answer.deleteMany({where:{question:{attempt:{courseId}}}});await db.attemptQuestion.deleteMany({where:{attempt:{courseId}}});await db.quizAttempt.deleteMany({where:{courseId}});
  }
  beforeAll(async()=>{
    const c=testConnections();db=c.runtime;migrator=c.migrator;
    for(const role of ['learner','instructor','foreign','admin']){
      const normalized=role==='foreign'?'instructor':role;
      accounts[role]=(await db.account.create({data:{displayName:tag+role,origin:'admin_created',emailVerified:false,roles:'admin',roleGrants:{create:{role:normalized}}}})).id;
      secrets[role]=randomUUID();await db.appSession.create({data:{accountId:accounts[role],audience:'web',expiresAt:new Date(Date.now()+3600000),tokenHash:createHash('sha256').update(secrets[role]).digest('hex').toUpperCase()}});
    }
    const course=await db.course.create({data:{instructorId:accounts.instructor,slug:tag,title:'แบบทดสอบจริง',category:'test',level:'test',status:'published',publishedAt:new Date(),
      chapters:{create:{title:'บท',position:0,items:{create:{title:'Quiz',type:'quiz',position:0}}}}},include:{chapters:{include:{items:true}}}});
    courseId=course.id;itemId=course.chapters[0].items[0].id;
    quizId=(await db.quiz.create({data:{courseId,itemId,title:'Quiz'}})).id;
    for(const [position,type,max]of [[0,'single_choice',3],[1,'multiple_choice',3],[2,'essay',4],[3,'image',0]] as const){
      const q=await db.question.create({data:{quizId,position,type,maxScore:max,prompt:{prompt:'คำถาม '+type,...(type==='essay'?{response_mode:'either',rubric:'rubric'}:{})},
        options:type.endsWith('choice')?[{id:'a',text:'A'},{id:'b',text:'B'},{id:'c',text:'C'}]:[],correctKey:{option_ids:type==='single_choice'?['a']:type==='multiple_choice'?['a','b']:[]}}});
      questions[type==='single_choice'?'single':type==='multiple_choice'?'multiple':type]=q.id;
    }
    enrollmentId=(await db.enrollment.create({data:{accountId:accounts.learner,courseId,source:'free'}})).id;
    process.env.DATABASE_URL=c.runtimeUrl;const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();configureApplication(app,[]);await app.init();
  });
  beforeEach(async()=>{
    await cleanupAttempts();await db.enrollment.deleteMany({where:{courseId}});
    enrollmentId=(await db.enrollment.create({data:{accountId:accounts.learner,courseId,source:'free'}})).id;
    await db.course.update({where:{id:courseId},data:{status:'published'}});
    await db.question.update({where:{id:questions.single},data:{maxScore:3,prompt:{prompt:'คำถาม single_choice'},correctKey:{option_ids:['a']}}});
    await db.account.updateMany({where:{id:{in:Object.values(accounts)}},data:{disabled:false,origin:'admin_created'}});
    await db.appSession.updateMany({where:{accountId:{in:Object.values(accounts)}},data:{revokedAt:null}});
  });
  afterAll(async()=>{
    if(app)await app.close();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;
    if(db){if(courseId){await cleanupAttempts();await db.question.deleteMany({where:{quizId}});await db.quiz.deleteMany({where:{id:quizId}});await db.enrollment.deleteMany({where:{courseId}});await db.course.deleteMany({where:{id:courseId}});}
      const ids=Object.values(accounts);await db.appSession.deleteMany({where:{accountId:{in:ids}}});await db.userRole.deleteMany({where:{accountId:{in:ids}}});await db.account.deleteMany({where:{id:{in:ids}}});await db.$disconnect();}
    if(migrator)await migrator.$disconnect();
  });
  it('concurrent Start creates exactly one immutable snapshot,201 then200; never serializes keys',async()=>{
    const responses=await Promise.all([start(),start(),start()]);expect(responses.map(r=>r.status).sort()).toEqual([200,200,201]);expect(new Set(responses.map(r=>r.body.id)).size).toBe(1);
    assertTaskContract('ASSESS-01','WireAttemptView',responses[0].body);expect(JSON.stringify(responses[0].body)).not.toMatch(/correct_key|correctKey|rubric|response_mode/);
    expect(await db.quizAttempt.count({where:{courseId}})).toBe(1);expect(await db.attemptQuestion.count({where:{attempt:{courseId}}})).toBe(4);
  });
  it('save patches supplied question answers; omission preserves,{} clears only that draft answer',async()=>{
    const id=(await start().expect(201)).body.id;await save(id,full()).expect(200);const cleared=await save(id,{[questions.essay]:{}}).expect(200);
    expect(cleared.body.answers[questions.essay]).toEqual({});expect(cleared.body.answers[questions.single]).toEqual({option_ids:['a']});
    await submit(id).expect(422);await save(id,{[questions.essay]:{text:'ใหม่'}}).expect(200);await submit(id).expect(200);
  });
  it.each(['foreign_question','score_claim','foreign_option','single_many','duplicate_choice','image_text','unsafe_image'])('rejects %s without any partial persistence',async kind=>{
    const cases:Record<string,unknown>={foreign_question:{bad:{text:'foreign'}},score_claim:{[questions.single]:{score:99}},foreign_option:{[questions.single]:{option_ids:['foreign']}},
      single_many:{[questions.single]:{option_ids:['a','b']}},duplicate_choice:{[questions.multiple]:{option_ids:['a','a']}},image_text:{[questions.image]:{text:'wrong'}},unsafe_image:{[questions.essay]:{image_url:'javascript:alert(1)'}}};
    const id=(await start().expect(201)).body.id,before=await academic();await save(id,cases[kind]).expect(422);expect(await academic()).toEqual(before);
  });
  it('validates every answer before saving any; denies actual snapshot choice tampering and score claims',async()=>{
    const id=(await start().expect(201)).body.id;
    for(const bad of [{[questions.single]:{option_ids:['foreign']}},{[questions.single]:{option_ids:['a','b']}},{[questions.image]:{text:'wrong'}},{[questions.essay]:{score:100}},
      {[questions.multiple]:{option_ids:['a','a']}}]){const before=await academic();await save(id,{[questions.essay]:{text:'good'},...bad}).expect(422);expect(await academic()).toEqual(before);}
  });
  it('incomplete submit keeps draft and does not calculate score or issue certificate',async()=>{
    const id=(await start().expect(201)).body.id;await save(id,{[questions.single]:{option_ids:['a']}}).expect(200);const before=await academic();await submit(id).expect(422);expect(await academic()).toEqual(before);
  });
  it('uses frozen choice keys/maxima after author edits; manual work stays pending and answers frozen',async()=>{
    const id=(await start().expect(201)).body.id;await db.question.update({where:{id:questions.single},data:{correctKey:{option_ids:['b']},maxScore:50,prompt:{prompt:'ใหม่'}}});
    await save(id,full()).expect(200);const submitted=await submit(id).expect(200);assertTaskContract('ASSESS-01','WireAttemptView',submitted.body);
    expect(submitted.body.status).toBe('pending_review');expect(submitted.body.max).toBe(10);expect(submitted.body.earned).toBeNull();expect(submitted.body.passed).toBeNull();
    expect((await db.answer.findUniqueOrThrow({where:{attemptId_questionId:{attemptId:id,questionId:questions.single}}})).score?.toNumber()).toBe(3);
    await save(id,full()).expect(409);const before=await academic();expect((await submit(id).expect(200)).body).toEqual(submitted.body);expect(await academic()).toEqual(before);
    expect(await db.certificate.count({where:{enrollmentId}})).toBe(0);
  });
  it('owner queue exposes only ungraded manual snapshots,grades final answer and atomically issues one certificate',async()=>{
    const id=(await start().expect(201)).body.id;await save(id,full()).expect(200);await submit(id).expect(200);
    const queued=await queue().expect(200);assertTaskContract('GRADE-01','GradingQueuePage',queued.body);expect(queued.body.items).toHaveLength(1);
    expect(queued.body.items[0].questions_to_grade.map((q:any)=>q.question_id)).toEqual([questions.essay,questions.image]);
    expect(JSON.stringify(queued.body)).not.toMatch(/correct_key|rubric|roleGrants|email/);
    await grade(id,questions.essay,4).expect(200);expect(await db.certificate.count({where:{enrollmentId}})).toBe(0);
    const final=await grade(id,questions.image,0).expect(200);assertTaskContract('GRADE-01','WireAttemptView',final.body);
    expect(final.body.status).toBe('graded');expect(final.body.percent).toBe(100);expect(final.body.passed).toBe(true);
    expect(await db.certificate.count({where:{enrollmentId}})).toBe(1);expect(await db.progress.count({where:{enrollmentId,completedAt:{not:null}}})).toBe(1);
    expect((await queue().expect(200)).body.items).toHaveLength(0);
    const before=await academic();expect((await grade(id,questions.image,0).expect(200)).body).toEqual(final.body);await grade(id,questions.essay,3).expect(409);expect(await academic()).toEqual(before);
  });
  it('strictly70%fails and>70%passes using exact snapshot decimals',async()=>{
    for(const [score,passed]of [[1,false],[1.5,true]] as const){
      await cleanupAttempts();const id=(await start().expect(201)).body.id;await save(id,full()).expect(200);await submit(id).expect(200);
      await grade(id,questions.essay,score).expect(200);const final=await grade(id,questions.image,0).expect(200);expect(final.body.percent).toBe(60+score*10);expect(final.body.passed).toBe(passed);
    }
  });
  it('choice-only submit grades exact sets and completes atomically,including concurrent replay',async()=>{
    await db.question.deleteMany({where:{quizId,type:{in:['essay','image']}}});
    try{
      const id=(await start().expect(201)).body.id;await save(id,{[questions.single]:{option_ids:['a']},[questions.multiple]:{option_ids:['b','a']}}).expect(200);
      const responses=await Promise.all([submit(id),submit(id)]);expect(responses.map(r=>r.status)).toEqual([200,200]);expect(responses[0].body).toEqual(responses[1].body);
      expect(responses[0].body.passed).toBe(true);expect(await db.certificate.count({where:{enrollmentId}})).toBe(1);
    }finally{
      for(const [position,type,max]of [[2,'essay',4],[3,'image',0]] as const)await db.question.create({data:{id:questions[type],quizId,position,type,maxScore:max,
        prompt:{prompt:'คำถาม '+type,...(type==='essay'?{response_mode:'either',rubric:'rubric'}:{})},options:[],correctKey:{option_ids:[]}}});
    }
  });
  it('lower retake cannot clear best result,Progress or immutable first completion/certificate; results are read-only after archive',async()=>{
    const first=(await start().expect(201)).body.id;await save(first,full()).expect(200);await submit(first).expect(200);await grade(first,questions.essay,4).expect(200);await grade(first,questions.image,0).expect(200);
    const cert=await db.certificate.findUniqueOrThrow({where:{enrollmentId}}),completion=(await db.enrollment.findUniqueOrThrow({where:{id:enrollmentId}})).completedAt;
    const second=(await start().expect(201)).body.id;const answers=full();answers[questions.single]={option_ids:['b']};await save(second,answers).expect(200);await submit(second).expect(200);await grade(second,questions.essay,0).expect(200);await grade(second,questions.image,0).expect(200);
    await db.course.update({where:{id:courseId},data:{status:'archived'}});const before=await academic();await db.$disconnect();await db.$connect();
    const response=await results().expect(200);assertTaskContract('ASSESS-02','QuizResults',response.body);expect(response.body.attempts.map((a:any)=>a.number)).toEqual([2,1]);expect(response.body.best.attempt_id).toBe(first);expect(response.body.completed).toBe(true);expect(await academic()).toEqual(before);
    expect(await db.certificate.findUniqueOrThrow({where:{enrollmentId}})).toEqual(cert);expect((await db.enrollment.findUniqueOrThrow({where:{id:enrollmentId}})).completedAt).toEqual(completion);
  });
  it('essay either-mode accepts image proof consistently through grade,best and completion',async()=>{
    const id=(await start().expect(201)).body.id,a:any=full();a[questions.essay]={image_url:'data:image/png;base64,YQ=='};await save(id,a).expect(200);await submit(id).expect(200);await grade(id,questions.essay,4).expect(200);await grade(id,questions.image,0).expect(200);
    expect((await results().expect(200)).body.completed).toBe(true);
  });
  it('permits bounded Data image answer above ordinary100KiB JSON transport;oversized image rejected before persistence',async()=>{
    const id=(await start().expect(201)).body.id,url='data:image/png;base64,'+'A'.repeat(200000);
    const response=await save(id,{[questions.image]:{image_url:url}}).expect(200);expect(response.body.answers[questions.image].image_url).toBe(url);
    const before=await academic();await save(id,{[questions.image]:{image_url:'data:image/png;base64,'+'A'.repeat(2*1024*1024)}}).expect(422);expect(await academic()).toEqual(before);
  });
  it('concurrent final grades serialize and preserve exactly one first certificate',async()=>{
    const id=(await start().expect(201)).body.id;await save(id,full()).expect(200);await submit(id).expect(200);
    const grades=await Promise.all([grade(id,questions.essay,4),grade(id,questions.image,0),grade(id,questions.image,0)]);expect(grades.map(r=>r.status)).toEqual([200,200,200]);
    expect(await db.certificate.count({where:{enrollmentId}})).toBe(1);expect((await results().expect(200)).body.best.percent).toBe(100);
  });
  it('completion failure rolls back last grade,attempt summary,Progress and certificate',async()=>{
    const id=(await start().expect(201)).body.id;await save(id,full()).expect(200);await submit(id).expect(200);await grade(id,questions.essay,4).expect(200);
    const before=await academic(),spy=jest.spyOn(app.get(CompletionCoordinator),'evaluate').mockRejectedValueOnce(new Error('test rollback')),log=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>undefined);
    try{const response=await grade(id,questions.image,0).expect(500);assertErrorContract(response.body);expect(await academic()).toEqual(before);}finally{spy.mockRestore();log.mockRestore();}
  });
  it('foreign Instructor and Admin cannot grade;non-owner Instructor queue empty;learner queue forbidden',async()=>{
    const id=(await start().expect(201)).body.id;await save(id,full()).expect(200);await submit(id).expect(200);
    const before=await academic();await grade(id,questions.essay,4,'foreign').expect(404);await grade(id,questions.essay,4,'admin').expect(403);await grade(id,questions.essay,4,'learner').expect(403);
    expect((await queue('foreign').expect(200)).body.items).toEqual([]);await queue('admin').expect(403);await queue('learner').expect(403);expect(await academic()).toEqual(before);
  });
  it('denies invalid/manual overmax/automatic/unsubmitted grading without changes',async()=>{
    const id=(await start().expect(201)).body.id;await grade(id,questions.essay,4).expect(409);await save(id,full()).expect(200);await submit(id).expect(200);
    const before=await academic();for(const score of [-1,4.5,1.25])await grade(id,questions.essay,score).expect(422);await grade(id,questions.single,3).expect(422);await grade(id,randomUUID(),1).expect(404);expect(await academic()).toEqual(before);
  });
  it('fresh normalized permission rejects own-course,Admin,unverified,revoked and forged namespace mutations',async()=>{
    await call('post',`/learn/items/${itemId}/attempts`,'instructor').send({}).expect(403);await call('post',`/learn/items/${itemId}/attempts`,'admin').send({}).expect(403);
    await db.account.update({where:{id:accounts.learner},data:{origin:'self_email'}});await start().expect(403);await db.account.update({where:{id:accounts.learner},data:{origin:'admin_created'}});
    await start().set('x-melearn-app','admin').expect(403);
    const service=app.get(AssessmentWriteService),original=service.start.bind(service),spy=jest.spyOn(service,'start').mockImplementationOnce(async(ref,item)=>{
      await db.appSession.updateMany({where:{accountId:accounts.learner},data:{revokedAt:new Date()}});return original(ref,item);
    });try{await start().expect(401);}finally{spy.mockRestore();}
    expect(await db.quizAttempt.count({where:{courseId}})).toBe(0);
  });
  it('signed queue pagination bound to Instructor+limit and rejects unknown filters; GET causes no academic writes',async()=>{
    for(let i=0;i<2;i++){const id=(await start().expect(201)).body.id;await save(id,full()).expect(200);await submit(id).expect(200);}
    const before=await academic(),first=await queue('instructor','?limit=1').expect(200);expect(first.body.next_cursor).toBeTruthy();
    const c=encodeURIComponent(first.body.next_cursor),second=await queue('instructor','?limit=1&cursor='+c).expect(200);expect(second.body.items[0].attempt_id).not.toBe(first.body.items[0].attempt_id);
    await queue('foreign','?limit=1&cursor='+c).expect(422);await queue('instructor','?limit=2&cursor='+c).expect(422);await queue('instructor','?course_id='+courseId).expect(422);expect(await academic()).toEqual(before);
  });
  it('queue does not acquire learner Account lock after Enrollment,avoiding inverted learning-writer lock order',async()=>{
    const id=(await start().expect(201)).body.id;await save(id,full()).expect(200);await submit(id).expect(200);
    await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM accounts WHERE id=${accounts.learner} FOR UPDATE`;
      const response=await queue().timeout({response:3000,deadline:4000}).expect(200);expect(response.body.items).toHaveLength(1);
    },{timeout:10000});
  });
});
