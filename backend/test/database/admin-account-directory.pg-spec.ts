import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { AdminAccountWriter } from '../../src/features/auth/public/index';
import { LocalPasswordService } from '../../src/features/auth/local-password.service';
import { testConnections } from '../support/postgres';
import { assertTaskContract, assertErrorContract } from '../support/contract-validator';

describe('MGMT-01 account create/directory and MGMT-02 Instructor directory / real HTTP+PG',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication;
  const tag='admin_directory_'+randomUUID(),oldUrl=process.env.DATABASE_URL,accounts:Record<string,string>={},secrets:Record<string,string>={};
  const created:string[]=[],password='Correct_Initial_8';
  const auth=(r:request.Test,name='admin',audience='admin')=>r.set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[name+'_'+audience]}`);
  const read=(path='users',name='admin',audience='admin')=>auth(request(app.getHttpServer()).get('/api/v1/admin/'+path),name,audience);
  const input=(suffix='one')=>({username:('u_'+tag.replaceAll('-','').slice(-14)+'_'+suffix).slice(0,30),password,display_name:tag+suffix});
  const create=(body:object=input(),name='admin',audience='admin')=>auth(request(app.getHttpServer()).post('/api/v1/admin/users'),name,audience).send(body);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).map(n=>(db as any)[n[0].toLowerCase()+n.slice(1)].count()));
  beforeAll(async()=>{
    const connections=testConnections();db=connections.runtime;migrator=connections.migrator;
    for(const name of ['admin','secondAdmin','learner','instructor','pending']) {
      accounts[name]=(await db.account.create({data:{displayName:tag+name,roles:name.includes('Admin')||name==='admin'?'learner':'admin',
        username:tag.slice(-12)+name,normalizedUsername:(tag.slice(-12)+name).toUpperCase(),email:tag+name+'@example.invalid',
        normalizedEmail:(tag+name+'@example.invalid').toUpperCase(),profileJson:'{"phone":"PRIVATE_PHONE"}',
        origin:name==='pending'?'self_email':'admin_created',emailVerified:false,
        roleGrants:{create:{role:name.includes('Admin')||name==='admin'?'admin':name==='instructor'?'instructor':'learner'}}}})).id;
      for(const audience of ['web','admin']){const secret=randomUUID();secrets[name+'_'+audience]=secret;
        await db.appSession.create({data:{accountId:accounts[name],audience,tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase(),expiresAt:new Date(Date.now()+3600000)}});}
    }
    process.env.DATABASE_URL=connections.runtimeUrl;const module=await Test.createTestingModule({imports:[AppModule]}).compile();
    app=module.createNestApplication();configureApplication(app,[]);await app.init();
  });
  afterAll(async()=>{
    if(app)await app.close();if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;
    if(db){const ids=[...Object.values(accounts),...created];await db.localCredential.deleteMany({where:{accountId:{in:ids}}});
      await db.externalIdentity.deleteMany({where:{accountId:{in:ids}}});await db.appSession.deleteMany({where:{accountId:{in:ids}}});
      await db.userRole.deleteMany({where:{accountId:{in:ids}}});await db.account.deleteMany({where:{id:{in:ids}}});await db.$disconnect();}
    if(migrator)await migrator.$disconnect();
  });
  it('creates exact canonical Learner account without email, with durable hash and original Admin audit',async()=>{
    const beforeSessions=await db.appSession.count(),r=await create().expect(201);created.push(r.body.user.id);
    assertTaskContract('MGMT-01','AdminCreateUserResponse',r.body);
    expect(r.body).toMatchObject({created_by:accounts.admin,user:{username:input().username,email:null,email_verified:false,
      roles:['learner'],origin:'admin_created',learning_eligible:true,auth_methods:['password']}});
    const row=await db.account.findUniqueOrThrow({where:{id:r.body.user.id},include:{localCredential:true,roleGrants:true}});
    expect(row.createdBy).toBe(accounts.admin);expect(row.createdAt.toISOString()).toBe(r.body.created_at);
    expect(row.normalizedUsername).toBe(input().username.toUpperCase());expect(row.roleGrants.map(g=>g.role)).toEqual(['learner']);
    expect(row.localCredential?.passwordHash).not.toBe(password);expect(await app.get(LocalPasswordService).verify(row.localCredential?.passwordHash,password)).toBe(true);
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|Correct_Initial|tokenHash|PRIVATE_/);expect(await db.appSession.count()).toBe(beforeSessions);
  });
  it('stores optional email as unverified metadata without Firebase identity, credentials or verification claims',async()=>{
    const email=tag+'new@example.invalid',r=await create({...input('email'),email}).expect(201);created.push(r.body.user.id);
    expect(r.body.user.email).toBe(email);expect(r.body.user.email_verified).toBe(false);expect(r.body.user.learning_eligible).toBe(true);
    expect(await db.externalIdentity.count({where:{accountId:r.body.user.id}})).toBe(0);
    expect((await db.account.findUniqueOrThrow({where:{id:r.body.user.id}})).normalizedEmail).toBe(email.toUpperCase());
  });
  it('conflicts atomically on case-insensitive duplicate username and normalized email',async()=>{
    const before=await counts();let r=await create({...input(),username:input().username.toUpperCase()}).expect(409);
    assertErrorContract(r.body);expect(r.body.error.code).toBe('username_taken');
    r=await create({...input('dupe'),email:(tag+'new@example.invalid').toUpperCase()}).expect(409);expect(r.body.error.code).toBe('email_taken');
    expect(await counts()).toEqual(before);
  });
  it('simultaneous duplicate creates yield one account/role/credential and one 409',async()=>{
    const body=input('race'),before=await db.account.count(),rs=await Promise.all([create(body),create(body)]);
    expect(rs.map(r=>r.status).sort()).toEqual([201,409]);created.push(rs.find(r=>r.status===201)!.body.user.id);
    expect(await db.account.count()).toBe(before+1);expect(await db.localCredential.count({where:{account:{normalizedUsername:body.username.toUpperCase()}}})).toBe(1);
  });
  it('rejects forged role/identity/origin/verification/audit and malformed create input before mutation',async()=>{
    const before=await counts();
    for(const body of [{...input('bad'),roles:['admin']},{...input('bad'),origin:'google'},{...input('bad'),email_verified:true},
      {...input('bad'),created_by:accounts.secondAdmin},{...input('bad'),username:'bad name'},{...input('bad'),password:'short'},{}])
      assertErrorContract((await create(body).expect(422)).body);
    expect(await counts()).toEqual(before);
  });
  it('rechecks fresh Admin authority after KDF; revocation prevents all partial account writes',async()=>{
    const writer=app.get(AdminAccountWriter),original=writer.hash.bind(writer),before=await counts();
    const hash=createHash('sha256').update(secrets.admin_admin).digest('hex').toUpperCase();
    const spy=jest.spyOn(writer,'hash').mockImplementation(async value=>{const encoded=await original(value);
      await db.appSession.update({where:{tokenHash:hash},data:{revokedAt:new Date()}});return encoded;});
    try{await create(input('revoked')).expect(401);}finally{spy.mockRestore();await db.appSession.update({where:{tokenHash:hash},data:{revokedAt:null}});}
    expect(await counts()).toEqual(before);
  });
  it('rolls back Auth writer failure after nested account/role/credential creation',async()=>{
    const writer=app.get(AdminAccountWriter),original=writer.create.bind(writer),before=await counts();
    const spy=jest.spyOn(writer,'create').mockImplementation(async(...args)=>{await original(...args);throw Error('PRIVATE_INTERNAL');});
    try{const r=await create(input('rollback')).expect(500);expect(JSON.stringify(r.body)).not.toContain('PRIVATE_INTERNAL');}finally{spy.mockRestore();}
    expect(await counts()).toEqual(before);
  });
  it('Admin directory returns bounded canonical summaries using normalized role grants and pending email status',async()=>{
    const before=await counts(),r=await read().query({q:tag}).expect(200);assertTaskContract('MGMT-01','AdminUserPage',r.body);
    expect(r.body.items.find((x:{id:string})=>x.id===accounts.admin).roles).toEqual(['admin']);
    expect(r.body.items.find((x:{id:string})=>x.id===accounts.learner).roles).toEqual(['learner']);
    expect(r.body.items.find((x:{id:string})=>x.id===accounts.pending).status).toBe('pending');
    expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|passwordHash|tokenHash|profileJson|auth_methods/);expect(await counts()).toEqual(before);
  });
  it('search is insensitive over approved Admin fields and page cursor is bound to filter/owner/route',async()=>{
    const r=await read().query({q:input().username.toUpperCase()}).expect(200);expect(r.body.items.map((x:{id:string})=>x.id)).toContain(created[0]);
    const first=await read().query({q:tag,limit:1}).expect(200),next=await read().query({q:tag,limit:1,cursor:first.body.next_cursor}).expect(200);
    expect(next.body.items[0].id).not.toBe(first.body.items[0].id);
    await read('users','secondAdmin').query({q:tag,limit:1,cursor:first.body.next_cursor}).expect(422);
    await read().query({q:'other',limit:1,cursor:first.body.next_cursor}).expect(422);
    await read('instructors').query({limit:1,cursor:first.body.next_cursor}).expect(422);
  });
  it('Instructor directory ignores CSV compatibility roles and reveals no user email/profile/credential fields',async()=>{
    const r=await read('instructors').expect(200);assertTaskContract('MGMT-02','InstructorPage',r.body);
    expect(r.body.items.map((x:{id:string})=>x.id)).toContain(accounts.instructor);
    expect(r.body.items.map((x:{id:string})=>x.id)).not.toContain(accounts.learner);
    expect(Object.keys(r.body.items.find((x:{id:string})=>x.id===accounts.instructor)).sort()).toEqual(['avatar_url','display_name','id']);
    expect(JSON.stringify(r.body)).not.toMatch(/email|profile|password|origin|roles/);
  });
  it('strict list query rejects unsupported/repeated/nested filters and malformed limit/cursor',async()=>{
    for(const q of ['limit=0','limit=2.0','limit=1&limit=2','q[x]=1','user_id=other','cursor=o:1'])await read('users?'+q).expect(422);
    await read('instructors').query({q:'not-supported'}).expect(422);
  });
  it('all three handlers enforce Admin session/normalized role, not header or compatibility string',async()=>{
    for(const path of ['users','instructors']){await request(app.getHttpServer()).get('/api/v1/admin/'+path).expect(401);
      await read(path,'learner').expect(403);await read(path,'instructor').expect(403);await read(path,'admin','web').expect(401);}
    await request(app.getHttpServer()).post('/api/v1/admin/users').send(input()).expect(401);
    await create(input('forbidden'),'learner').expect(403);await create(input('wrong'),'admin','web').expect(401);
  });
  it('created accounts and directories survive reconnect without session or academic creation',async()=>{
    const before=await counts();await db.$disconnect();await db.$connect();
    const r=await read().query({q:input().username}).expect(200);expect(r.body.items[0].id).toBe(created[0]);
    await read('instructors').expect(200);expect(await counts()).toEqual(before);
  });
});
