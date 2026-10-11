import { INestApplication,Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { createHash,randomUUID } from 'node:crypto';
import request=require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { CertificateTextRenderer,CertificateDownloadService } from '../../src/features/certificates/certificate-download.service';
import { testConnections } from '../support/postgres';
import { assertTaskContract,assertErrorContract } from '../support/contract-validator';

describe('CERT-01 canonical private text download from actual immutable PostgreSQL issuance',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication,courseId:string,enrollmentId:string,certificateId:string;
  const previous=process.env.DATABASE_URL,tag='certificate_download_'+randomUUID(),accounts:Record<string,string>={},secrets:Record<string,string>={},time=new Date('2026-10-01T00:00:00Z');
  const get=(id=certificateId,actor='learner')=>request(app.getHttpServer()).get('/api/v1/me/certificates/'+encodeURIComponent(id)+'/download')
    .set('x-melearn-app','web').set('Cookie',`melearn_web_session=${secrets[actor]}`);
  const stored=()=>Promise.all([db.enrollment.findUniqueOrThrow({where:{id:enrollmentId}}),db.certificate.findUniqueOrThrow({where:{id:certificateId}}),db.quizAttempt.count({where:{courseId}}),db.progress.count({where:{courseId}})]);
  beforeAll(async()=>{
    const c=testConnections();db=c.runtime;migrator=c.migrator;
    for(const role of ['learner','instructor','admin']){accounts[role]=(await db.account.create({data:{displayName:'Current '+role,origin:'admin_created',roleGrants:{create:{role}}}})).id;
      secrets[role]=randomUUID();await db.appSession.create({data:{accountId:accounts[role],audience:'web',expiresAt:new Date(Date.now()+3600000),tokenHash:createHash('sha256').update(secrets[role]).digest('hex').toUpperCase()}});}
    courseId=(await db.course.create({data:{instructorId:accounts.instructor,slug:tag,title:'Current name',category:'test',level:'test'}})).id;
    enrollmentId=(await db.enrollment.create({data:{accountId:accounts.learner,courseId,source:'free',completedAt:time,completedItems:1,completionSnapshot:{version:1,completed_at:time.toISOString()}}})).id;
    certificateId=(await db.certificate.create({data:{enrollmentId,courseName:'คอร์ส ณ วันที่จบ',recipientName:'ผู้เรียน ณ วันที่จบ',code:'MLN-'+tag,issuedAt:time}})).id;
    process.env.DATABASE_URL=c.runtimeUrl;const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();configureApplication(app,[]);await app.init();
  });
  beforeEach(async()=>{await db.appSession.updateMany({where:{accountId:{in:Object.values(accounts)}},data:{revokedAt:null}});});
  afterAll(async()=>{if(app)await app.close();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;
    if(db){if(certificateId)await db.certificate.deleteMany({where:{id:certificateId}});if(enrollmentId)await db.enrollment.deleteMany({where:{id:enrollmentId}});if(courseId)await db.course.deleteMany({where:{id:courseId}});
      const ids=Object.values(accounts);await db.appSession.deleteMany({where:{accountId:{in:ids}}});await db.userRole.deleteMany({where:{accountId:{in:ids}}});await db.account.deleteMany({where:{id:{in:ids}}});await db.$disconnect();}if(migrator)await migrator.$disconnect();});
  it('canonical text JSON uses persisted issuance names/time/code and safe deterministic filename',async()=>{
    const before=await stored(),r=await get().expect(200);assertTaskContract('CERT-01','CertificateDownload',r.body);
    expect(r.headers['cache-control']).toBe('private, no-store');expect(r.body.filename).toMatch(/^melearn-certificate-[a-f0-9]{20}\.txt$/);
    expect(r.body.content).toContain('คอร์ส ณ วันที่จบ');expect(r.body.content).toContain('ผู้เรียน ณ วันที่จบ');expect(r.body.content).toContain(time.toISOString());expect(r.body.content).toContain('MLN-'+tag);
    expect(r.body.content).not.toContain('Current');expect(r.body.content).not.toMatch(/completionSnapshot|accountId|email|password|https?:/);expect(await stored()).toEqual(before);
  });
  it('concurrent repeat downloads and reconnect preserve bytes and create no second certificate',async()=>{
    const before=await stored(),responses=await Promise.all([get(),get(),get()]);expect(responses.map(r=>r.status)).toEqual([200,200,200]);responses.forEach(r=>expect(r.body).toEqual(responses[0].body));
    await db.$disconnect();await db.$connect();expect((await get().expect(200)).body).toEqual(responses[0].body);expect(await stored()).toEqual(before);expect(await db.certificate.count({where:{enrollmentId}})).toBe(1);
  });
  it.each(['instructor','admin'])('foreign%s cannot bypass ownership',async actor=>{const before=await stored(),r=await get(certificateId,actor).expect(404);assertErrorContract(r.body);expect(await stored()).toEqual(before);});
  it('anonymous/forged audience and unknown ID do not expose metadata',async()=>{
    await request(app.getHttpServer()).get('/api/v1/me/certificates/'+certificateId+'/download').expect(401);await get().set('x-melearn-app','admin').expect(401);await get(randomUUID()).expect(404);
  });
  it('renderer failure retries from same completed snapshot without any writes',async()=>{
    const before=await stored(),spy=jest.spyOn(app.get(CertificateTextRenderer),'render').mockImplementationOnce(()=>{throw Error('test rendering failure');}),log=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>undefined);
    try{const r=await get().expect(500);assertErrorContract(r.body);expect(await stored()).toEqual(before);}finally{spy.mockRestore();log.mockRestore();}
    await get().expect(200);expect(await stored()).toEqual(before);
  });
  it('fresh post-guard session revocation is checked before rendering',async()=>{
    const renderer=jest.spyOn(app.get(CertificateTextRenderer),'render'),service=app.get(CertificateDownloadService),original=service.download.bind(service),spy=jest.spyOn(service,'download').mockImplementationOnce(async(ref,id)=>{
      await db.appSession.updateMany({where:{accountId:accounts.learner},data:{revokedAt:new Date()}});return original(ref,id);
    });try{await get().expect(401);expect(renderer).not.toHaveBeenCalled();}finally{spy.mockRestore();renderer.mockRestore();}
  });
  it('archive and current name changes preserve download snapshot without recompletion',async()=>{
    const original=(await get().expect(200)).body;await db.course.update({where:{id:courseId},data:{status:'archived',title:'ชื่อใหม่'}});await db.account.update({where:{id:accounts.learner},data:{displayName:'ชื่อใหม่'}});
    const before=await stored();expect((await get().expect(200)).body).toEqual(original);expect(await stored()).toEqual(before);
  });
});
