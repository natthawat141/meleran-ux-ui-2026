import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ManagedQuizLocatorService } from '../../src/features/management/managed-quiz-locator.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('MGMT-04 owned authoring Quiz locator / actual HTTP and PostgreSQL',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication;
  const tag='locator_'+randomUUID(),saved=process.env.DATABASE_URL;
  const accounts:Record<string,string>={},secrets:Record<string,string>={};
  const courses:Record<string,string>={},items:Record<string,string>={},quizzes:Record<string,string>={};
  const hash=(s:string)=>createHash('sha256').update(s).digest('hex').toUpperCase();
  const call=(id=items.draft,name='owner',audience='web')=>request(app.getHttpServer()).get('/api/v1/managed-quizzes/'+encodeURIComponent(id))
    .set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[name+'_'+audience]}`);
  const canonical=(body:unknown)=>assertTaskContract('MGMT-04','ManagedQuizLocator',body);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).map(n=>(db as any)[n[0].toLowerCase()+n.slice(1)].count()));
  const data=()=>Promise.all([db.course.findMany({where:{id:{in:Object.values(courses)}},orderBy:{id:'asc'}}),
    db.courseItem.findMany({where:{courseId:{in:Object.values(courses)}},orderBy:{id:'asc'}}),
    db.quiz.findMany({where:{courseId:{in:Object.values(courses)}},orderBy:{id:'asc'}}),
    db.question.findMany({where:{quizId:{in:Object.values(quizzes)}},orderBy:{id:'asc'}}),
    db.enrollment.findMany({where:{courseId:{in:Object.values(courses)}},orderBy:{id:'asc'}})]);
  beforeAll(async()=>{
    const c=testConnections();db=c.runtime;migrator=c.migrator;process.env.DATABASE_URL=c.runtimeUrl;
    for(const name of ['owner','other','admin','learner']){
      const role=['owner','other'].includes(name)?'instructor':name;
      accounts[name]=(await db.account.create({data:{displayName:tag+name,origin:'self_email',emailVerified:false,roles:role==='admin'?'learner':'admin',roleGrants:{create:{role}}}})).id;
      for(const audience of ['web','admin']){const secret=randomUUID();secrets[name+'_'+audience]=secret;await db.appSession.create({data:{accountId:accounts[name],audience,tokenHash:hash(secret),expiresAt:new Date(Date.now()+3600000)}});}
    }
    for(const status of ['draft','pending_review','approved','published']){
      courses[status]=(await db.course.create({data:{instructorId:accounts.owner,title:tag+status,slug:tag+status,category:'test',level:'test',status,description:'PRIVATE_COURSE',aiEnabled:true}})).id;
      const chapter=await db.courseChapter.create({data:{courseId:courses[status],title:'บทเดิม',position:0}});
      items[status]=(await db.courseItem.create({data:{courseId:courses[status],chapterId:chapter.id,title:'แบบฝึกหัด',position:0,type:'quiz',contentDoc:{private:'PRIVATE_DOC'}}})).id;
      quizzes[status]=(await db.quiz.create({data:{courseId:courses[status],itemId:items[status],title:'PRIVATE_TITLE',instructions:{private:'PRIVATE_INSTRUCTIONS'},questions:{create:{type:'single_choice',position:0,prompt:'PRIVATE_PROMPT',options:['PRIVATE_OPTION'],correctKey:'PRIVATE_KEY',maxScore:1}}}})).id;
      if(status==='draft')items.article=(await db.courseItem.create({data:{courseId:courses[status],chapterId:chapter.id,title:'บทอ่าน',position:1,type:'article'}})).id;
    }
    // An Instructor who buys/enrolls in another teacher's course is still foreign.
    await db.enrollment.create({data:{accountId:accounts.other,courseId:courses.published,source:'free'}});
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();configureApplication(app,[]);await app.init();
  });
  beforeEach(async()=>{await db.account.updateMany({where:{id:{in:Object.values(accounts)}},data:{disabled:false}});
    await db.appSession.updateMany({where:{accountId:{in:Object.values(accounts)}},data:{revokedAt:null,expiresAt:new Date(Date.now()+3600000)}});});
  afterAll(async()=>{if(app)await app.close();if(saved===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=saved;
    if(db){const courseId={in:Object.values(courses)};await db.enrollment.deleteMany({where:{courseId}});await db.question.deleteMany({where:{quizId:{in:Object.values(quizzes)}}});await db.quiz.deleteMany({where:{courseId}});await db.course.deleteMany({where:{id:courseId}});
      const accountId={in:Object.values(accounts)};await db.appSession.deleteMany({where:{accountId}});await db.userRole.deleteMany({where:{accountId}});await db.account.deleteMany({where:{id:accountId}});await db.$disconnect();}if(migrator)await migrator.$disconnect();});
  it('uses canonical CourseItem ID and returns exactly course/item with no question/key/PII fields',async()=>{
    expect(items.draft).not.toBe(quizzes.draft);const r=await call().expect(200);canonical(r.body);
    expect(r.body).toEqual({course_id:courses.draft,item_id:items.draft});expect(JSON.stringify(r.body)).not.toContain('PRIVATE_');
  });
  it('allows unverified owner authoring in every V1 course state without requiring enrollment',async()=>{
    for(const status of ['draft','pending_review','approved','published']){const r=await call(items[status]).expect(200);canonical(r.body);expect(r.body.course_id).toBe(courses[status]);}
    expect(await db.enrollment.count({where:{accountId:accounts.owner}})).toBe(0);
  });
  it('allows normalized Admin management through either bound Web/Admin namespace',async()=>{
    for(const audience of ['web','admin']){const r=await call(items.draft,'admin',audience).expect(200);canonical(r.body);expect(r.body.item_id).toBe(items.draft);}
  });
  it('foreign Instructor receives404 even when enrolled; does not reveal whether a private quiz exists',async()=>{
    for(const id of [items.published,items.draft,'missing']){const r=await call(id,'other').expect(404);assertErrorContract(r.body);expect(r.body.error.code).toBe('not_found');}
  });
  it('Learner and forged compatibility Admin roles do not grant authoring authority',async()=>{
    const before=await data();await call(items.draft,'learner').expect(403);await call(items.draft,'owner','admin').expect(403);expect(await data()).toEqual(before);
  });
  it('wrong/missing audience or cookie and anonymous reads are rejected without writes',async()=>{
    const before=await counts();await call().set('x-melearn-app','unknown').expect(403);await call().set('x-melearn-app','').expect(403);
    await call().set('Cookie',`melearn_admin_session=${secrets.admin_admin}`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/managed-quizzes/'+items.draft).set('x-melearn-app','web').expect(401);expect(await counts()).toEqual(before);
  });
  it('unknown/non-quiz/internal storage Quiz IDs never fall back to another namespace',async()=>{
    for(const id of ['not-a-uuid',items.article,quizzes.draft]){const r=await call(id).expect(404);assertErrorContract(r.body);}
  });
  it('disabled/revoked/expired principals never resolve a managed resource',async()=>{
    const tokenHash=hash(secrets.owner_web);await db.appSession.update({where:{tokenHash},data:{revokedAt:new Date()}});await call().expect(401);
    await db.appSession.update({where:{tokenHash},data:{revokedAt:null,expiresAt:new Date(0)}});await call().expect(401);
    await db.appSession.update({where:{tokenHash},data:{expiresAt:new Date(Date.now()+3600000)}});await db.account.update({where:{id:accounts.owner},data:{disabled:true}});await call().expect(401);
  });
  it('ownership transfer after guard is checked from current Course inside the read transaction',async()=>{
    const svc=app.get(ManagedQuizLocatorService),original=svc.read.bind(svc);
    const spy=jest.spyOn(svc,'read').mockImplementationOnce(async(ref,id)=>{await db.course.update({where:{id:courses.draft},data:{instructorId:accounts.other}});return original(ref,id);});
    try{await call().expect(404);const r=await call(items.draft,'other').expect(200);canonical(r.body);}finally{spy.mockRestore();await db.course.update({where:{id:courses.draft},data:{instructorId:accounts.owner}});}
  });
  it('revocation after guard is rechecked before reading resource IDs',async()=>{
    const svc=app.get(ManagedQuizLocatorService),original=svc.read.bind(svc),before=await data();
    const spy=jest.spyOn(svc,'read').mockImplementationOnce(async(ref,id)=>{await db.appSession.update({where:{tokenHash:ref.tokenHash},data:{revokedAt:new Date()}});return original(ref,id);});
    try{await call().expect(401);expect(await data()).toEqual(before);}finally{spy.mockRestore();}
  });
  it('parallel/reconnect reads preserve all 27 model counts and private definition/academic rows',async()=>{
    const beforeCounts=await counts(),before=await data();await db.$disconnect();await db.$connect();
    for(const r of await Promise.all(Array.from({length:5},()=>call()))){expect(r.status).toBe(200);canonical(r.body);}expect(await counts()).toEqual(beforeCounts);expect(await data()).toEqual(before);
  });
  it('real SQL error produces safe500 rather than private data or a fabricated locator',async()=>{
    const p=app.get(PrismaService),original=p.$transaction.bind(p),before=await data();
    const failing=((callback:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:{isolationLevel:Prisma.TransactionIsolationLevel})=>original(async tx=>{await callback(tx);await tx.$queryRaw`SELECT 1/0`;},options))as typeof p.$transaction;
    const spy=jest.spyOn(p,'$transaction').mockImplementationOnce(failing),log=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>undefined);
    try{const r=await call().expect(500);assertErrorContract(r.body);expect(JSON.stringify(r.body)+JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|division|postgresql/);expect(await data()).toEqual(before);}finally{spy.mockRestore();log.mockRestore();}
  });
  it('a concurrent ownership writer waits on the Course lock, then changes subsequent read authority',async()=>{
    const p=app.get(PrismaService),original=p.$transaction.bind(p);let release!:()=>void,ready!:()=>void,started!:()=>void,pid!:number;
    const gate=new Promise<void>(r=>{release=r;}),held=new Promise<void>(r=>{ready=r;}),changing=new Promise<void>(r=>{started=r;});
    const hold=((callback:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:{isolationLevel:Prisma.TransactionIsolationLevel})=>original(async tx=>{const result=await callback(tx);ready();await gate;return result;},{...options,timeout:15000}))as typeof p.$transaction;
    const spy=jest.spyOn(p,'$transaction').mockImplementationOnce(hold),read=call().then(r=>r);await held;
    const update=db.$transaction(async tx=>{pid=(await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() AS pid`)[0].pid;started();await tx.course.update({where:{id:courses.draft},data:{instructorId:accounts.other}});},{timeout:15000});await changing;
    try{let blocked=false;for(let i=0;i<100;i++){if((await migrator.$queryRaw<Array<{blocked:boolean}>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
      expect(blocked).toBe(true);release();const r=await read;expect(r.status).toBe(200);canonical(r.body);await update;await call().expect(404);await call(items.draft,'other').expect(200);
    }finally{release();await Promise.allSettled([read,update]);spy.mockRestore();await db.course.update({where:{id:courses.draft},data:{instructorId:accounts.owner}});}
  });
});
