import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma,PrismaClient } from '@prisma/client';
import { createHash,randomUUID } from 'node:crypto';
import request=require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { testConnections } from '../support/postgres';
import { assertErrorContract,assertTaskContract } from '../support/contract-validator';

describe('PAY-02 fresh Admin financial lookup / canonical metadata, no provider or fulfillment writes',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication,courseId:string,enrollmentId:string;
  const previousUrl=process.env.DATABASE_URL,tag='admin_payment_'+randomUUID();
  const accounts:Record<string,string>={},secrets:Record<string,string>={},payments:Record<string,string>={};
  const read=(id=payments.pending,role='admin',audience='admin')=>request(app.getHttpServer())
    .get('/api/v1/admin/payments/'+encodeURIComponent(id)).set('x-melearn-app',audience)
    .set('Cookie',`melearn_${audience}_session=${secrets[role+'_'+audience]}`);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).map(name=>(db as any)[name[0].toLowerCase()+name.slice(1)].count()));
  const stored=()=>Promise.all([
    db.payment.findMany({where:{courseId},orderBy:{id:'asc'}}),
    db.paymentEvent.findMany({where:{paymentId:{in:Object.values(payments)}},orderBy:{eventId:'asc'}}),
    db.enrollment.findMany({where:{courseId},orderBy:{id:'asc'}}),
    db.appSession.findMany({where:{accountId:{in:Object.values(accounts)}},orderBy:{tokenHash:'asc'}}),
  ]);
  beforeAll(async()=>{
    const connection=testConnections();db=connection.runtime;migrator=connection.migrator;
    for(const role of ['admin','instructor','learner']){
      accounts[role]=(await db.account.create({data:{displayName:tag+role,origin:'admin_created',roles:role==='admin'?'learner':'admin',roleGrants:{create:{role}}}})).id;
      for(const audience of ['web','admin']){
        const secret=randomUUID();secrets[role+'_'+audience]=secret;
        await db.appSession.create({data:{accountId:accounts[role],audience,expiresAt:new Date(Date.now()+3600000),tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase()}});
      }
    }
    courseId=(await db.course.create({data:{instructorId:accounts.instructor,slug:tag,title:'Historical payment',category:'test',level:'test',status:'archived',priceMinor:999999}})).id;
    enrollmentId=(await db.enrollment.create({data:{accountId:accounts.learner,courseId,source:'redeem',grantedAt:new Date('2026-10-01')}})).id;
    for(const status of ['pending','processing','succeeded','failed','cancelled','expired']){
      payments[status]=(await db.payment.create({data:{accountId:accounts.learner,courseId,requestId:tag+status,payloadHash:'PRIVATE_HASH',amountMinor:12345,status,paidAt:status==='succeeded'?new Date():null}})).id;
    }
    payments.granted=(await db.payment.create({data:{accountId:accounts.learner,courseId,requestId:tag+'granted',payloadHash:'PRIVATE_HASH',amountMinor:12345,
      checkoutSessionId:'cs_'+tag,paymentIntentId:'pi_PRIVATE',status:'succeeded',fulfillmentStatus:'granted',enrollmentId,paidAt:new Date()}})).id;
    for(const [index,status] of ['received','processed'].entries())await db.paymentEvent.create({data:{eventId:tag+index,paymentId:payments.granted,
      type:'checkout.session.completed',status,eventSnapshot:{secret:'PRIVATE_PROVIDER_PROOF'},errorCode:'PRIVATE_INTERNAL',receivedAt:new Date('2026-10-01'),processedAt:index?new Date('2026-10-02'):null}});
    process.env.DATABASE_URL=connection.runtimeUrl;
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();configureApplication(app,[]);await app.init();
  });
  afterAll(async()=>{
    if(app)await app.close();if(previousUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousUrl;
    if(db){
      await db.paymentEvent.deleteMany({where:{paymentId:{in:Object.values(payments)}}});await db.payment.deleteMany({where:{courseId}});
      if(enrollmentId)await db.enrollment.delete({where:{id:enrollmentId}});if(courseId)await db.course.delete({where:{id:courseId}});
      await db.appSession.deleteMany({where:{accountId:{in:Object.values(accounts)}}});await db.userRole.deleteMany({where:{accountId:{in:Object.values(accounts)}}});
      await db.account.deleteMany({where:{id:{in:Object.values(accounts)}}});await db.$disconnect();
    }if(migrator)await migrator.$disconnect();
  });
  it.each(['pending','processing','succeeded','failed','cancelled','expired'])('projects stored %s, server price snapshot and missing-session marker without writes',async status=>{
    const before=await stored(),modelCounts=await counts(),response=await read(payments[status]).expect(200);
    assertTaskContract('PAY-02','WireAdminPayment',response.body);
    expect(response.body).toMatchObject({payment_id:payments[status],course_id:courseId,user_id:accounts.learner,status,fulfillment_status:'pending',enrollment:null,
      checkout_session_id:'',amount:{amount_minor:12345,currency:'THB'},events:[]});
    expect(response.body.amount.amount_minor).not.toBe(999999);expect(await stored()).toEqual(before);expect(await counts()).toEqual(modelCounts);
  });
  it('projects stable verified-event metadata and original redeem entitlement without provider proof or diagnostics',async()=>{
    const response=await read(payments.granted).expect(200);assertTaskContract('PAY-02','WireAdminPayment',response.body);
    expect(response.body.enrollment).toEqual({id:enrollmentId,course_id:courseId,source:'redeem',access:'lifetime',granted_at:'2026-10-01T00:00:00.000Z'});
    expect(response.body.events.map((e:{outcome:string})=>e.outcome)).toEqual(['received','processed']);
    expect(response.body.events[0].processed_at).toBeNull();expect(JSON.stringify(response.body)).not.toContain('PRIVATE_');
    expect(Object.keys(response.body).sort()).toEqual(['payment_id','course_id','user_id','request_id','checkout_session_id','amount','status','fulfillment_status','enrollment','created_at','events'].sort());
  });
  it('rejects normalized non-Admin actors, Web namespace and missing proof before private payment lookup',async()=>{
    for(const role of ['instructor','learner'])assertErrorContract((await read(payments.granted,role).expect(403)).body);
    await read(payments.granted,'admin','web').expect(401);
    await request(app.getHttpServer()).get('/api/v1/admin/payments/'+payments.granted).set('x-melearn-app','admin').expect(401);
  });
  it('unknown payment is404; identity/financial query injection cannot change the stored projection',async()=>{
    assertErrorContract((await read(randomUUID()).expect(404)).body);
    const response=await request(app.getHttpServer()).get('/api/v1/admin/payments/'+payments.pending+'?user_id='+accounts.admin+'&amount=1&status=succeeded')
      .set('x-melearn-app','admin').set('Cookie','melearn_admin_session='+secrets.admin_admin).expect(200);
    expect(response.body.user_id).toBe(accounts.learner);expect(response.body.status).toBe('pending');expect(response.body.amount.amount_minor).toBe(12345);
  });
  it('rechecks removed Admin grant and disabled account freshly',async()=>{
    try{
      await db.userRole.delete({where:{accountId_role:{accountId:accounts.admin,role:'admin'}}});await read().expect(403);
      await db.userRole.create({data:{accountId:accounts.admin,role:'admin'}});
      await db.account.update({where:{id:accounts.admin},data:{disabled:true}});await read().expect(401);
    }finally{
      await db.account.update({where:{id:accounts.admin},data:{disabled:false}});
      await db.userRole.upsert({where:{accountId_role:{accountId:accounts.admin,role:'admin'}},create:{accountId:accounts.admin,role:'admin'},update:{}});
    }
  });
  it('parallel reads and reconnect preserve every model count, money state, grant and event history',async()=>{
    const before=await stored(),modelCounts=await counts(),original=(await read(payments.granted).expect(200)).body;
    const responses=await Promise.all([read(payments.granted),read(payments.granted),read(payments.granted)]);for(const r of responses)expect(r.body).toEqual(original);
    await db.$disconnect();await db.$connect();expect((await read(payments.granted).expect(200)).body).toEqual(original);
    expect(await counts()).toEqual(modelCounts);expect(await stored()).toEqual(before);
  });
  it('database rejects invalid financial state and Admin reads preserve the valid snapshot',async()=>{
    const before=await db.payment.findUniqueOrThrow({where:{id:payments.pending}});
    await expect(db.payment.update({where:{id:payments.pending},data:{status:'invalid_PRIVATE'}})).rejects.toThrow();
    expect(await db.payment.findUniqueOrThrow({where:{id:payments.pending}})).toEqual(before);
    expect((await read().expect(200)).body.status).toBe('pending');
  });
});
