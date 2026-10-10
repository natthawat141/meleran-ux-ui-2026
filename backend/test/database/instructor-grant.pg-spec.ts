import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { InstructorGrantWriter } from '../../src/features/auth/public/index';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('MGMT-02 authoritative Instructor grant / actual HTTP and PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication, courseId: string, enrollmentId: string;
  const savedUrl = process.env.DATABASE_URL, tag = 'grant_' + randomUUID();
  const ids: Record<string,string> = {}, secrets: Record<string,string> = {};
  const hash = (s: string) => createHash('sha256').update(s).digest('hex').toUpperCase();
  const call = (target = 'target', actor = 'admin', audience = 'admin', body: object | string = {}) =>
    request(app.getHttpServer()).post('/api/v1/admin/users/' + (ids[target] || target) + '/instructor')
      .set('x-melearn-app', audience).set('Cookie', `melearn_${audience}_session=${secrets[actor+'_'+audience]}`).send(body);
  const state = () => Promise.all([
    db.account.findUniqueOrThrow({ where: { id: ids.target } }),
    db.userRole.findMany({ where: { accountId: ids.target }, orderBy: { role:'asc' } }),
    db.localCredential.findMany({ where: { accountId: ids.target } }),
    db.externalIdentity.findMany({ where: { accountId: ids.target } }),
  ]);
  const history = () => Promise.all([db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } }),
    db.progress.findMany({ where: { enrollmentId } }), db.certificate.findMany({ where: { enrollmentId } }),
    db.appSession.findMany({ where: { accountId: ids.target }, orderBy: { tokenHash:'asc' } })]);
  const canonical = (body: unknown) => assertTaskContract('MGMT-02','AssignInstructorResponse',body);
  beforeAll(async () => {
    const c = testConnections(); db=c.runtime; migrator=c.migrator; process.env.DATABASE_URL=c.runtimeUrl;
    for(const name of ['admin','admin2','learner','instructor','target']) {
      const role=name.startsWith('admin')?'admin':name==='instructor'?'instructor':'learner';
      ids[name]=(await db.account.create({ data: { displayName:tag+name, origin:'admin_created', roles:role==='admin'?'learner':'admin',
        profileJson:'{"bio":"ประวัติเดิม","private":"PRIVATE_PROFILE"}', roleGrants:{create:{role}} } })).id;
      for(const audience of ['web','admin']) { const secret=randomUUID(); secrets[name+'_'+audience]=secret;
        await db.appSession.create({data:{accountId:ids[name],audience,tokenHash:hash(secret),expiresAt:new Date(Date.now()+3600000)}}); }
    }
    await db.localCredential.create({data:{accountId:ids.target,passwordHash:'PRIVATE_HASH'}});
    await db.externalIdentity.create({data:{accountId:ids.target,method:'google',subject:'PRIVATE_'+tag}});
    courseId=(await db.course.create({data:{instructorId:ids.instructor,title:'คอร์สเดิม',slug:tag,category:'test',level:'test',status:'published'}})).id;
    const chapter=await db.courseChapter.create({data:{courseId,title:'บทเดิม',position:0}});
    const item=await db.courseItem.create({data:{courseId,chapterId:chapter.id,title:'บทอ่าน',position:0,type:'article'}});
    const completedAt=new Date('2026-10-01T00:00:00Z');
    enrollmentId=(await db.enrollment.create({data:{accountId:ids.target,courseId,source:'free',completedAt,completedItems:1,completionSnapshot:{total_items:1}}})).id;
    await db.progress.create({data:{enrollmentId,courseId,itemId:item.id,completedAt,resumeData:{private:'PRIVATE_RESUME'}}});
    await db.certificate.create({data:{enrollmentId,code:tag,recipientName:'ชื่อเดิม',courseName:'คอร์สเดิม',issuedAt:completedAt}});
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();configureApplication(app,[]);await app.init();
  });
  beforeEach(async () => {
    await db.userRole.deleteMany({where:{accountId:ids.target,role:'instructor'}});
    await db.account.update({where:{id:ids.target},data:{roles:'admin',revision:0,instructorAddedBy:null,instructorAddedAt:null,origin:'admin_created',emailVerified:false,profileJson:'{"bio":"ประวัติเดิม","private":"PRIVATE_PROFILE"}'}});
    await db.account.updateMany({where:{id:{in:Object.values(ids)}},data:{disabled:false}});
    await db.appSession.updateMany({where:{accountId:{in:Object.values(ids)}},data:{revokedAt:null,expiresAt:new Date(Date.now()+3600000)}});
  });
  afterAll(async()=>{
    if(app)await app.close();if(savedUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=savedUrl;
    if(db){if(enrollmentId){await db.certificate.deleteMany({where:{enrollmentId}});await db.progress.deleteMany({where:{enrollmentId}});await db.enrollment.deleteMany({where:{id:enrollmentId}});}
      if(courseId)await db.course.deleteMany({where:{id:courseId}});const owned={accountId:{in:Object.values(ids)}};
      await db.externalIdentity.deleteMany({where:owned});await db.localCredential.deleteMany({where:owned});await db.appSession.deleteMany({where:owned});await db.userRole.deleteMany({where:owned});
      await db.account.deleteMany({where:{id:{in:Object.values(ids)}}});await db.$disconnect();}if(migrator)await migrator.$disconnect();
  });
  it('grants normalized Instructor with exact CurrentUser and one original DB-time audit, keeping Learner and academic history',async()=>{
    const before=await state(),academic=await history(),early=(await db.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS now`)[0].now;
    const r=await call().expect(200);canonical(r.body);expect(r.body.user.roles).toEqual(['instructor','learner']);
    expect(r.body.user.auth_methods).toEqual(['google','password']);expect(r.body.user.profile).toEqual({bio:'ประวัติเดิม'});expect(r.body.user.learning_eligible).toBe(true);
    const [account,roles]=await state();expect(roles).toHaveLength(2);const grant=roles.find(x=>x.role==='instructor')!;
    expect(r.body.added_by).toBe(ids.admin);expect(r.body.added_at).toBe(grant.grantedAt.toISOString());expect(account.instructorAddedAt).toEqual(grant.grantedAt);
    expect(grant.grantedAt.getTime()).toBeGreaterThanOrEqual(early.getTime());expect(account).toEqual({...before[0],roles:'instructor,learner',revision:1,instructorAddedBy:ids.admin,instructorAddedAt:grant.grantedAt});
    expect(await history()).toEqual(academic);expect(JSON.stringify(r.body)).not.toContain('PRIVATE_');
  });
  it('immediately agrees with GET /me and public Instructor projection without creating accounts or sessions',async()=>{
    const accounts=await db.account.count(),sessions=await db.appSession.count();await call().expect(200);
    const me=await request(app.getHttpServer()).get('/api/v1/me').set('x-melearn-app','web').set('Cookie',`melearn_web_session=${secrets.target_web}`).expect(200);
    expect(me.body.roles).toEqual(['instructor','learner']);await request(app.getHttpServer()).get('/api/v1/instructors/'+ids.target).expect(200);
    expect(await db.account.count()).toBe(accounts);expect(await db.appSession.count()).toBe(sessions);
  });
  it('replay by another Admin preserves first grant/time/revision and every stored identity row after reconnect',async()=>{
    const first=await call().expect(200),before=await state();await db.$disconnect();await db.$connect();
    const replay=await call('target','admin2').expect(200);canonical(replay.body);expect(replay.body).toEqual(first.body);expect(await state()).toEqual(before);
  });
  it('concurrent different Admins create exactly one Instructor grant and one successful audit',async()=>{
    const rs=await Promise.all(Array.from({length:6},(_,i)=>call('target',i%2?'admin2':'admin')));for(const r of rs){expect(r.status).toBe(200);canonical(r.body);expect(r.body).toEqual(rs[0].body);}
    const [account,roles]=await state();expect(account.revision).toBe(1);expect(roles.filter(x=>x.role==='instructor')).toHaveLength(1);
  });
  it('existing Instructor with absent original audit returns truthful nullable metadata and does not backfill',async()=>{
    const before=await db.account.findUniqueOrThrow({where:{id:ids.instructor}}),roles=await db.userRole.findMany({where:{accountId:ids.instructor}});
    const r=await call('instructor').expect(200);canonical(r.body);expect(r.body.added_by).toBeNull();expect(r.body.added_at).toBeNull();
    expect(await db.account.findUniqueOrThrow({where:{id:ids.instructor}})).toEqual(before);expect(await db.userRole.findMany({where:{accountId:ids.instructor}})).toEqual(roles);
  });
  it('normalized Learner/Instructor and forged compatibility Admin cannot grant in Admin audience',async()=>{
    const before=await state();for(const name of ['learner','instructor']){const r=await call('target',name).expect(403);assertErrorContract(r.body);}expect(await state()).toEqual(before);
  });
  it('requires Admin namespace and cookie, rejects anonymous/missing/forged namespace without writes',async()=>{
    const before=await state();await call('target','admin','web').expect(401);await call().set('x-melearn-app','web').expect(403);
    await call().set('x-melearn-app','').expect(403);await call().set('Cookie',`melearn_web_session=${secrets.admin_web}`).expect(401);
    await request(app.getHttpServer()).post('/api/v1/admin/users/'+ids.target+'/instructor').set('x-melearn-app','admin').send({}).expect(401);expect(await state()).toEqual(before);
  });
  it('rejects expired/revoked/disabled Admin even when compatibility roles would allow it',async()=>{
    const before=await state(),tokenHash=hash(secrets.admin_admin);await db.appSession.update({where:{tokenHash},data:{revokedAt:new Date()}});await call().expect(401);
    await db.appSession.update({where:{tokenHash},data:{revokedAt:null,expiresAt:new Date(0)}});await call().expect(401);
    await db.appSession.update({where:{tokenHash},data:{expiresAt:new Date(Date.now()+3600000)}});await db.account.update({where:{id:ids.admin},data:{disabled:true}});await call().expect(401);expect(await state()).toEqual(before);
  });
  it('fresh authority denies revocation occurring after guard resolution and before the grant transaction',async()=>{
    const writer=app.get(InstructorGrantWriter),original=writer.grant.bind(writer),before=await state();
    const spy=jest.spyOn(writer,'grant').mockImplementationOnce(async(tx,ref,id)=>{await db.appSession.update({where:{tokenHash:ref.tokenHash},data:{revokedAt:new Date()}});return original(tx,ref,id);});
    try{await call().expect(401);expect(await state()).toEqual(before);}finally{spy.mockRestore();}
  });
  it('unknown/opaque malformed account ID returns canonical404 without identity mutation',async()=>{
    const before=await state();for(const id of ['missing', 'not-a-uuid']){const r=await call(id).expect(404);assertErrorContract(r.body);}expect(await state()).toEqual(before);
  });
  it('Admin targets and self-target are conflicts; opposite Admin requests do not deadlock',async()=>{
    const rs=await Promise.all([call('admin2','admin'),call('admin','admin2'),call('admin','admin')]);for(const r of rs){expect(r.status).toBe(409);assertErrorContract(r.body);}
    expect(await db.userRole.count({where:{accountId:{in:[ids.admin,ids.admin2]},role:'instructor'}})).toBe(0);
  });
  it('strict EmptyRequest rejects added role/actor fields and non-object bodies without writes',async()=>{
    const before=await state();for(const body of [{role:'admin'},{added_by:ids.admin2},[]])await call('target','admin','admin',body).expect(422);expect(await state()).toEqual(before);
  });
  it('granting unverified Email/Google identity never verifies email or changes learning readiness',async()=>{
    for(const origin of ['self_email','google']){
      await db.userRole.deleteMany({where:{accountId:ids.target,role:'instructor'}});await db.account.update({where:{id:ids.target},data:{origin,emailVerified:false,instructorAddedBy:null,instructorAddedAt:null}});
      const r=await call().expect(200);canonical(r.body);expect(r.body.user.learning_eligible).toBe(false);expect(r.body.user.email_verified).toBe(false);
    }
    await db.account.update({where:{id:ids.target},data:{origin:'admin_created',disabled:true}});
    const disabled=await call().expect(200);canonical(disabled.body);expect(disabled.body.user.learning_eligible).toBe(false);
    expect((await db.account.findUniqueOrThrow({where:{id:ids.target}})).disabled).toBe(true);
  });
  it('projection corruption rolls back the newly written role/audit and fails safely without partial success',async()=>{
    await db.account.update({where:{id:ids.target},data:{profileJson:'PRIVATE_BAD_JSON'}});const before=await state(),log=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>undefined);
    try{const r=await call().expect(500);assertErrorContract(r.body);expect(await state()).toEqual(before);expect(JSON.stringify(r.body)+JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|JSON|persisted/);}finally{log.mockRestore();}
  });
  it('actual SQL failure after grant causes transaction rollback, not a fabricated success response',async()=>{
    const p=app.get(PrismaService),original=p.$transaction.bind(p),before=await state();
    const failure=((callback:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:{isolationLevel:Prisma.TransactionIsolationLevel})=>original(async tx=>{await callback(tx);await tx.$queryRaw`SELECT 1/0`;},options))as typeof p.$transaction;
    const spy=jest.spyOn(p,'$transaction').mockImplementationOnce(failure),log=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>undefined);
    try{const r=await call().expect(500);assertErrorContract(r.body);expect(await state()).toEqual(before);expect(JSON.stringify(r.body)+JSON.stringify(log.mock.calls)).not.toMatch(/division|postgresql|PRIVATE_/);}finally{spy.mockRestore();log.mockRestore();}
  });
  it('Account lock holds a new normalized Admin role insert until the grant transaction commits',async()=>{
    const p=app.get(PrismaService),original=p.$transaction.bind(p);
    let release!:()=>void,ready!:()=>void,started!:()=>void,pid!:number;
    const gate=new Promise<void>(r=>{release=r;}),held=new Promise<void>(r=>{ready=r;}),changing=new Promise<void>(r=>{started=r;});
    const hold=((callback:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:{isolationLevel:Prisma.TransactionIsolationLevel})=>original(async tx=>{const result=await callback(tx);ready();await gate;return result;},{...options,timeout:15000}))as typeof p.$transaction;
    const spy=jest.spyOn(p,'$transaction').mockImplementationOnce(hold),command=call().then(r=>r);await held;
    const mutation=db.$transaction(async tx=>{pid=(await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() AS pid`)[0].pid;started();await tx.userRole.create({data:{accountId:ids.target,role:'admin'}});},{timeout:15000});await changing;
    try{let blocked=false;for(let i=0;i<100;i++){if((await migrator.$queryRaw<Array<{blocked:boolean}>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
      expect(blocked).toBe(true);release();const r=await command;expect(r.status).toBe(200);canonical(r.body);expect(r.body.user.roles).toEqual(['instructor','learner']);await mutation;await call().expect(409);
    }finally{release();await Promise.allSettled([command,mutation]);spy.mockRestore();await db.userRole.deleteMany({where:{accountId:ids.target,role:'admin'}});}
  });
  it('audit instant agrees with normalized grant even with Bangkok transaction timezone',async()=>{
    const p=app.get(PrismaService),original=p.$transaction.bind(p);
    const bangkok=((callback:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:{isolationLevel:Prisma.TransactionIsolationLevel})=>original(async tx=>{await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Bangkok'");return callback(tx);},options))as typeof p.$transaction;
    const spy=jest.spyOn(p,'$transaction').mockImplementationOnce(bangkok);
    try{const r=await call().expect(200);canonical(r.body);const [account,roles]=await state();expect(account.instructorAddedAt).toEqual(roles.find(x=>x.role==='instructor')!.grantedAt);expect(r.body.added_at).toBe(account.instructorAddedAt!.toISOString());}finally{spy.mockRestore();}
  });
  it('conflicting old audit is not overwritten or used to backfill missing normalized roles',async()=>{
    await db.account.update({where:{id:ids.target},data:{instructorAddedBy:ids.admin2,instructorAddedAt:new Date('2026-09-01T00:00:00Z')}});
    const before=await state(),log=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>undefined);
    try{const r=await call().expect(500);assertErrorContract(r.body);expect(await state()).toEqual(before);}finally{log.mockRestore();}
  });
});
