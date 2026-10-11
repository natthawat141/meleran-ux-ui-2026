import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { LocalPasswordService } from '../../src/features/auth/local-password.service';
import { LocalAuthenticationService } from '../../src/features/auth/local-authentication.service';
import { SessionWriter, APP_SESSION_TTL_MS } from '../../src/features/auth/session-writer.service';
import { PrincipalService } from '../../src/features/auth/public/principal.service';
import { LogoutService } from '../../src/features/auth/logout.service';
import { testConnections } from '../support/postgres';
import { assertTaskContract } from '../support/contract-validator';

describe('AUTH-BASE approved local credential/session kernel / actual PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication, prisma: PrismaService;
  let passwords: LocalPasswordService, login: LocalAuthenticationService, writer: SessionWriter, principals: PrincipalService;
  const saved = process.env.DATABASE_URL, tag = randomUUID().replaceAll('-', '').slice(0,12);
  const ids: Record<string,string> = {}, names: Record<string,string> = {};
  let hash: string, replacement: string;
  const tokenHash = (secret: string) => createHash('sha256').update(secret).digest('hex').toUpperCase();
  const proof = () => ({ accountId: ids.learner, passwordHash: hash });
  const tx = <T>(f: (t: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(f,
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20000 });
  const counts = () => Promise.all(Object.values(Prisma.ModelName).map(model =>
    (db as unknown as Record<string,{count():Promise<number>}>)[model[0].toLowerCase()+model.slice(1)].count()));
  const latch = () => { let release!: () => void; const wait = new Promise<void>(r => release=r); return { wait,release }; };
  const blocked = async (pid: number) => {
    for (let i=0;i<100;i++) { const [r] = await db.$queryRaw<Array<{waiting:boolean}>>`SELECT cardinality(pg_blocking_pids(${pid}::int))>0 AS waiting`;
      if (r.waiting) return; await new Promise(r=>setTimeout(r,10)); }
    throw Error('Expected observed PostgreSQL lock wait');
  };
  const httpLogin = (name=names.learner,password=' password ',audience='web',header=audience) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').set('x-melearn-app',header)
      .send({identifier:name,password,audience});
  beforeAll(async () => {
    const c=testConnections(); db=c.runtime; migrator=c.migrator; process.env.DATABASE_URL=c.runtimeUrl;
    const module = await Test.createTestingModule({imports:[AppModule]}).compile();
    app=module.createNestApplication(); configureApplication(app,[]); await app.init(); prisma=app.get(PrismaService);
    passwords=app.get(LocalPasswordService); login=app.get(LocalAuthenticationService); writer=app.get(SessionWriter); principals=app.get(PrincipalService);
    hash=await passwords.create(' password '); replacement=await passwords.create('new password');
    for (const actor of ['learner','admin','other','unverified']) {
      names[actor]=tag+'_'+actor;
      ids[actor]=(await db.account.create({data:{displayName:tag+actor,username:names[actor],normalizedUsername:names[actor].toUpperCase(),
        origin:actor==='unverified'?'self_email':'admin_created',roles:actor==='admin'?'learner':'admin',emailVerified:false,
        profileJson:'{"bio":"public","private":"PRIVATE_PROFILE"}',localCredential:{create:{passwordHash:hash}},
        roleGrants:{create:{role:actor==='admin'?'admin':'learner'}}}})).id;
    }
  });
  beforeEach(async () => {
    await db.appSession.deleteMany({where:{accountId:{in:Object.values(ids)}}});
    await db.account.updateMany({where:{id:{in:Object.values(ids)}},data:{disabled:false}});
    await db.localCredential.updateMany({where:{accountId:{in:Object.values(ids)}},data:{passwordHash:hash}});
    for (const actor of ['learner','admin','other','unverified']) await db.userRole.upsert({where:{accountId_role:{accountId:ids[actor],role:actor==='admin'?'admin':'learner'}},
      create:{accountId:ids[actor],role:actor==='admin'?'admin':'learner'},update:{}});
  });
  afterAll(async () => {
    if(app)await app.close(); if(saved===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=saved;
    if(db){const accountId={in:Object.values(ids)};await db.appSession.deleteMany({where:{accountId}});
      await db.localCredential.deleteMany({where:{accountId}});await db.userRole.deleteMany({where:{accountId}});
      await db.account.deleteMany({where:{id:accountId}});await db.$disconnect();}if(migrator)await migrator.$disconnect();
  });
  it('issues durable canonical identity with exact twelve-hour absolute expiry and only hashed session storage', async () => {
    const before=Date.now(),issued=await login.loginUsername(names.learner.toUpperCase(),' password ','web'),after=Date.now();
    expect(issued.expiresAt.getTime()).toBeGreaterThanOrEqual(before+APP_SESSION_TTL_MS-1000);
    expect(issued.expiresAt.getTime()).toBeLessThanOrEqual(after+APP_SESSION_TTL_MS+1000);
    expect(issued.secret).toMatch(/^[a-f0-9]{64}$/);assertTaskContract('AUTH-01','CurrentUser',issued.user);
    expect(issued.user.roles).toEqual(['learner']);expect(issued.user.username).toBe(names.learner);
    expect(issued.user.email).toBeNull();expect(issued.user.learning_eligible).toBe(true);
    expect(JSON.stringify(issued.user)).not.toMatch(/PRIVATE_|passwordHash|tokenHash|secret/);
    const row=await db.appSession.findUniqueOrThrow({where:{tokenHash:tokenHash(issued.secret)}});
    expect(row.expiresAt).toEqual(issued.expiresAt);expect(row.audience).toBe('web');expect(row.revokedAt).toBeNull();
    await db.$disconnect();await db.$connect();expect((await principals.resolve(issued.secret,'web'))?.accountId).toBe(ids.learner);
  });
  it('HTTP Username login issues a canonical cookie and permits the actual protected self route', async () => {
    const r=await httpLogin().expect(200);assertTaskContract('AUTH-01','LoginResponse',r.body);
    expect(r.body.user).toMatchObject({id:ids.learner,roles:['learner'],learning_eligible:true});
    const cookie=(r.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toMatch(/^melearn_web_session=[a-f0-9]{64};/);expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');expect(cookie).toContain('Path=/api/v1');
    const me=await request(app.getHttpServer()).get('/api/v1/me').set('x-melearn-app','web').set('Cookie',cookie.split(';')[0]).expect(200);
    expect(me.body.id).toBe(ids.learner);expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|tokenHash|PRIVATE_/);
  });
  it('HTTP normalized grants reject forged legacy Admin roles without issuing a session', async () => {
    const before=await counts();await httpLogin(names.learner,' password ','admin').expect(403);
    expect(await counts()).toEqual(before);const r=await httpLogin(names.admin,' password ','admin').expect(200);
    expect(r.body.user.roles).toEqual(['admin']);expect((r.headers['set-cookie'] as unknown as string[])[0]).toMatch(/^melearn_admin_session=/);
  });
  it('HTTP namespace mismatch and invalid body reject before credential/session changes', async () => {
    const before=await counts();await httpLogin(names.learner,' password ','web','admin').expect(422);
    await request(app.getHttpServer()).post('/api/v1/auth/login').set('x-melearn-app','web')
      .send({identifier:names.learner,password:' password ',audience:'web',role:'admin'}).expect(422);
    expect(await counts()).toEqual(before);
  });
  it('HTTP wrong password, unsupported prototype hash and unknown Username never issue a session', async () => {
    const before=await db.appSession.count();await httpLogin(names.learner,'wrong').expect(401);await httpLogin('unknown_'+tag).expect(401);
    await db.localCredential.update({where:{accountId:ids.learner},data:{passwordHash:'salt:prototype-key'}});
    await httpLogin().expect(401);expect(await db.appSession.count()).toBe(before);
  });
  it('HTTP Email branch is explicitly unavailable without falling back to local credentials or writes', async () => {
    await db.account.update({where:{id:ids.learner},data:{email:tag+'@example.test',normalizedEmail:(tag+'@example.test').toUpperCase()}});
    const before=await counts();const r=await httpLogin(tag+'@example.test').expect(503);
    expect(r.body.error.code).toBe('provider_unavailable');expect(r.headers['set-cookie']).toBeUndefined();expect(await counts()).toEqual(before);
  });
  it('HTTP disabled account rejection is fresh and atomic', async () => {
    await db.account.update({where:{id:ids.learner},data:{disabled:true}});const before=await counts();
    const r=await httpLogin().expect(403);expect(r.body.error.code).toBe('account_disabled');expect(await counts()).toEqual(before);
  });
  it('production HTTP session cookie is Secure without changing the canonical response or lifetime', async () => {
    const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
    try{const r=await httpLogin().expect(200);expect((r.headers['set-cookie'] as unknown as string[])[0]).toContain('; Secure');
      assertTaskContract('AUTH-01','LoginResponse',r.body);
    }finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
  });
  it('preserves unverified account login without silently granting learning or verifying email', async () => {
    const before=await db.account.findUniqueOrThrow({where:{id:ids.unverified}});
    const issued=await login.loginUsername(names.unverified,' password ','web');
    expect(issued.user.learning_eligible).toBe(false);expect(issued.user.email_verified).toBe(false);
    expect(await db.account.findUniqueOrThrow({where:{id:ids.unverified}})).toEqual(before);
  });
  it('fresh normalized roles govern Admin audience instead of legacy strings', async () => {
    await expect(login.loginUsername(names.learner,' password ','admin')).rejects.toMatchObject({code:'audience_not_allowed'});
    const admin=await login.loginUsername(names.admin,' password ','admin');expect(admin.user.roles).toEqual(['admin']);
    expect(admin.user.learning_eligible).toBe(false);expect((await principals.resolve(admin.secret,'admin'))?.roles).toEqual(['admin']);
  });
  it('Web/Admin sessions stay independent, Logout affects only one, and reads do not extend expiry', async () => {
    const web=await login.loginUsername(names.admin,' password ','web'),admin=await login.loginUsername(names.admin,' password ','admin');
    const before=await db.appSession.findUniqueOrThrow({where:{tokenHash:tokenHash(admin.secret)}});
    for(let i=0;i<3;i++)await principals.resolve(admin.secret,'admin');
    expect(await db.appSession.findUniqueOrThrow({where:{tokenHash:before.tokenHash}})).toEqual(before);
    expect(await principals.resolve(web.secret,'admin')).toBeNull();
    await app.get(LogoutService).logout({tokenHash:tokenHash(web.secret),audience:'web'});
    expect(await principals.resolve(web.secret,'web')).toBeNull();expect(await principals.resolve(admin.secret,'admin')).not.toBeNull();
  });
  it('invalid/missing credentials and Email identifiers do not fall back to a local provider password', async () => {
    const before=await counts();
    for(const [name,password]of [[names.learner,'bad'],['missing_'+tag,' password '],[names.learner+'@example.com',' password '],[' '+names.learner,' password ']])
      await expect(login.loginUsername(name,password,'web')).rejects.toMatchObject({code:'credentials_invalid'});
    await db.localCredential.delete({where:{accountId:ids.other}});
    await expect(login.loginUsername(names.other,' password ','web')).rejects.toMatchObject({code:'credentials_invalid'});
    await db.localCredential.create({data:{accountId:ids.other,passwordHash:hash}});expect(await counts()).toEqual(before);
  });
  it('disabled and roleless accounts cannot issue a session; corrupt roles do not become legacy grants', async () => {
    await db.account.update({where:{id:ids.learner},data:{disabled:true}});
    await expect(login.loginUsername(names.learner,' password ','web')).rejects.toMatchObject({code:'account_disabled'});
    await db.account.update({where:{id:ids.learner},data:{disabled:false}});await db.userRole.deleteMany({where:{accountId:ids.learner}});
    await expect(login.loginUsername(names.learner,' password ','web')).rejects.toThrow('Invalid normalized role grants');
    expect(await db.appSession.count({where:{accountId:ids.learner}})).toBe(0);
  });
  it('rechecks a credential changed after verification before any new session can commit', async () => {
    await db.localCredential.update({where:{accountId:ids.learner},data:{passwordHash:replacement}});
    await expect(tx(t=>writer.issueVerifiedLocal(t,proof(),'web'))).rejects.toMatchObject({code:'credentials_invalid'});
    expect(await db.appSession.count({where:{accountId:ids.learner}})).toBe(0);
  });
  it('rejects an Admin role removed between proof verification and issuance', async () => {
    await db.userRole.delete({where:{accountId_role:{accountId:ids.admin,role:'admin'}}});
    await db.userRole.create({data:{accountId:ids.admin,role:'learner'}});
    try {await expect(tx(t=>writer.issueVerifiedLocal(t,{accountId:ids.admin,passwordHash:hash},'admin'))).rejects.toMatchObject({code:'audience_not_allowed'});}
    finally{await db.userRole.delete({where:{accountId_role:{accountId:ids.admin,role:'learner'}}});}
  });
  it('trusted local password replacement atomically revokes every audience but preserves other accounts and identity', async () => {
    const a=await tx(t=>writer.issueVerifiedLocal(t,proof(),'web'));
    await db.userRole.create({data:{accountId:ids.learner,role:'admin'}});
    const b=await tx(t=>writer.issueVerifiedLocal(t,proof(),'admin'));
    const other=await login.loginUsername(names.other,' password ','web');const identity=await db.account.findUniqueOrThrow({where:{id:ids.learner}});
    try{await tx(t=>writer.replaceLocalPassword(t,proof(),replacement));
      expect(await principals.resolve(a.secret,'web')).toBeNull();expect(await principals.resolve(b.secret,'admin')).toBeNull();
      expect(await principals.resolve(other.secret,'web')).not.toBeNull();expect(await db.account.findUniqueOrThrow({where:{id:ids.learner}})).toEqual(identity);
      await expect(login.loginUsername(names.learner,' password ','web')).rejects.toMatchObject({code:'credentials_invalid'});
      expect(await login.loginUsername(names.learner,'new password','web')).toHaveProperty('secret');}
    finally{await db.userRole.delete({where:{accountId_role:{accountId:ids.learner,role:'admin'}}});}
  });
  it('real post-SQL failure rolls back password and all revocations together', async () => {
    await login.loginUsername(names.learner,' password ','web');
    const before=await db.appSession.findMany({where:{accountId:ids.learner}});
    await expect(tx(async t=>{await writer.replaceLocalPassword(t,proof(),replacement);await t.$queryRaw`SELECT 1/0`;})).rejects.toThrow();
    expect((await db.localCredential.findUniqueOrThrow({where:{accountId:ids.learner}})).passwordHash).toBe(hash);
    expect(await db.appSession.findMany({where:{accountId:ids.learner}})).toEqual(before);
  });
  it('all-session revocation preserves original audit on replay and changes no credentials or academic counts', async () => {
    await login.loginUsername(names.learner,' password ','web');const before=await counts();
    await tx(t=>writer.revokeAll(t,ids.learner));const rows=await db.appSession.findMany({where:{accountId:ids.learner}});
    await tx(t=>writer.revokeAll(t,ids.learner));expect(await db.appSession.findMany({where:{accountId:ids.learner}})).toEqual(rows);
    expect((await db.localCredential.findUniqueOrThrow({where:{accountId:ids.learner}})).passwordHash).toBe(hash);expect(await counts()).toEqual(before);
  });
  it('caller rollback does not leave an issued session or any related state', async () => {
    const before=await counts();await expect(tx(async t=>{await writer.issueVerifiedLocal(t,proof(),'web');throw Error('fixture rollback');})).rejects.toThrow('fixture rollback');
    expect(await counts()).toEqual(before);
  });
  it('parallel trusted resets using one proof converge on one credential and revoke existing sessions', async () => {
    await login.loginUsername(names.learner,' password ','web');const another=await passwords.create('another password');
    const results=await Promise.allSettled([tx(t=>writer.replaceLocalPassword(t,proof(),replacement)),tx(t=>writer.replaceLocalPassword(t,proof(),another))]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
    const final=await db.localCredential.findUniqueOrThrow({where:{accountId:ids.learner}});expect([replacement,another]).toContain(final.passwordHash);
    expect(await db.appSession.count({where:{accountId:ids.learner,revokedAt:null}})).toBe(0);
  });
  it('observed issuance-first advisory wait makes the subsequent reset revoke the newly inserted session too', async () => {
    const ready=latch(),release=latch(),started=latch();let pid=0;
    const first=tx(async t=>{const issue=await writer.issueVerifiedLocal(t,proof(),'web');ready.release();await release.wait;return issue;});await ready.wait;
    const second=tx(async t=>{pid=(await t.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() AS pid`)[0].pid;started.release();await writer.replaceLocalPassword(t,proof(),replacement);});await started.wait;
    try{await blocked(pid);}finally{release.release();}const issue=await first;await second;
    expect(await principals.resolve(issue.secret,'web')).toBeNull();expect(await db.appSession.count({where:{accountId:ids.learner,revokedAt:null}})).toBe(0);
  });
  it('observed reset-first advisory wait rejects stale proof issuance after the reset commits', async () => {
    const ready=latch(),release=latch(),started=latch();let pid=0;
    const first=tx(async t=>{await writer.replaceLocalPassword(t,proof(),replacement);ready.release();await release.wait;});await ready.wait;
    const second=tx(async t=>{pid=(await t.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() AS pid`)[0].pid;started.release();return writer.issueVerifiedLocal(t,proof(),'web');})
      .then(value=>({value,error:null}),error=>({value:null,error}));await started.wait;
    try{await blocked(pid);}finally{release.release();}await first;const result=await second;
    expect(result.error).toMatchObject({code:'credentials_invalid'});expect(await db.appSession.count({where:{accountId:ids.learner}})).toBe(0);
  });
  it('Session-before-Account revocation waits for an actual fresh reader without reversing lock order', async () => {
    const issue=await login.loginUsername(names.learner,' password ','web'),ready=latch(),release=latch(),started=latch();let pid=0;
    const first=tx(async t=>{await principals.requireSelfRead(t,{tokenHash:tokenHash(issue.secret),audience:'web'});ready.release();await release.wait;});await ready.wait;
    const second=tx(async t=>{pid=(await t.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() AS pid`)[0].pid;started.release();await writer.revokeAll(t,ids.learner);});await started.wait;
    try{await blocked(pid);}finally{release.release();}await Promise.all([first,second]);expect(await principals.resolve(issue.secret,'web')).toBeNull();
  });
  it('expired issued proof cannot resolve and no read extends its twelve-hour lifetime', async () => {
    const issue=await login.loginUsername(names.learner,' password ','web');
    await db.appSession.update({where:{tokenHash:tokenHash(issue.secret)},data:{expiresAt:new Date(Date.now()-1000)}});
    const before=await counts();expect(await principals.resolve(issue.secret,'web')).toBeNull();expect(await counts()).toEqual(before);
  });
  it('kernel-issued proof works through actual existing Nest self-profile API with canonical privacy and no read writes', async () => {
    const issue=await login.loginUsername(names.learner,' password ','web'),before=await counts();
    const r=await request(app.getHttpServer()).get('/api/v1/me').set('x-melearn-app','web').set('Cookie','melearn_web_session='+issue.secret).expect(200);
    assertTaskContract('ACCOUNT-01','CurrentUser',r.body);expect(r.body).toEqual(issue.user);expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|tokenHash|passwordHash/);
    expect(await counts()).toEqual(before);
  });
});
