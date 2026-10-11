import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { testConnections } from '../support/postgres';
import { assertTaskContract, assertErrorContract } from '../support/contract-validator';

describe('AI-02 history and AI-05 tombstone / actual Nest HTTP and PostgreSQL',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication,courseId:string,messageId:string,practiceId:string;
  const tag='ai_history_'+randomUUID(),oldUrl=process.env.DATABASE_URL,accounts:Record<string,string>={},secrets:Record<string,string>={};
  const chats:Record<string,string>={},created:string[]=[];const at=new Date('2026-10-11T00:00:00Z');
  const auth=(r:request.Test,name='learner',audience='web')=>r.set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[name+'_'+audience]}`);
  const read=(path='',name='learner',audience='web')=>auth(request(app.getHttpServer()).get('/api/v1/me/ai/conversations'+path),name,audience);
  const create=(body:object={},name='learner',audience='web')=>auth(request(app.getHttpServer()).post('/api/v1/me/ai/conversations'),name,audience).send(body);
  const remove=(id:string,name='learner',audience='web')=>auth(request(app.getHttpServer()).delete('/api/v1/me/ai/conversations/'+id),name,audience);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).map(name=>(db as any)[name[0].toLowerCase()+name.slice(1)].count()));
  const quota=()=>db.aIUsageDaily.findMany({where:{accountId:{in:Object.values(accounts)}},orderBy:{accountId:'asc'}});
  beforeAll(async()=>{
    const connections=testConnections();db=connections.runtime;migrator=connections.migrator;
    for(const name of ['learner','other','instructor','admin']) {
      accounts[name]=(await db.account.create({data:{displayName:tag+name,roles:'admin',roleGrants:{create:{role:name==='other'?'learner':name}}}})).id;
      for(const audience of ['web','admin']) {const secret=randomUUID();secrets[name+'_'+audience]=secret;
        await db.appSession.create({data:{accountId:accounts[name],audience,tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase(),expiresAt:new Date(Date.now()+3600000)}});}
    }
    courseId=(await db.course.create({data:{slug:tag,title:tag,category:'test',level:'test',instructorId:accounts.instructor,
      aiEnabled:true,status:'published',publishedAt:at}})).id;
    await db.enrollment.create({data:{courseId,accountId:accounts.learner,source:'free'}});
    for(const key of ['alpha','beta','foreign','deleted','bad'])chats[key]=(await db.aIConversation.create({data:{accountId:key==='foreign'?accounts.other:accounts.learner,
      title:key==='alpha'?'Alpha':key==='beta'?'Beta':key,createdAt:at,updatedAt:at,deletedAt:key==='deleted'?at:null,contextSnapshot:{private:'PRIVATE_CONVERSATION_CONTEXT'}}})).id;
    for(let i=0;i<3;i++) {
      const message=await db.aIMessage.create({data:{accountId:accounts.learner,conversationId:chats.alpha,position:i,
        role:i===0?'user':'assistant',content:i===0?'SearchInMessage':'saved message '+i,createdAt:new Date(at.getTime()-i*1000),
        contextSnapshot:{private:'PRIVATE_KNOWLEDGE',_wire:{version:1,request_id:tag+'request',kind:i===2?'practice_set':'text',status:'succeeded',completed_at:at.toISOString(),error_code:null}}}});
      if(i===2)messageId=message.id;
    }
    await db.aIMessage.create({data:{accountId:accounts.other,conversationId:chats.foreign,position:0,role:'user',content:'SearchInMessage',contextSnapshot:{private:'PRIVATE_FOREIGN'}}});
    await db.aIMessage.create({data:{accountId:accounts.learner,conversationId:chats.bad,position:0,role:'assistant',content:'invalid legacy',contextSnapshot:{private:'PRIVATE_LEGACY'}}});
    practiceId=(await db.aIPractice.create({data:{accountId:accounts.learner,conversationId:chats.alpha,messageId,
      payloadSnapshot:{version:1,questions:[{id:'q',prompt:'Practice',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correct_option_id:'a',explanation:'PRIVATE_EXPLANATION'}]},answers:{}}})).id;
    await db.aIUsageDaily.create({data:{accountId:accounts.learner,usageDate:at,successCount:1,pendingCount:1}});
    await db.aIRequest.create({data:{accountId:accounts.learner,conversationId:chats.alpha,usageDate:at,requestId:tag+'pending',payloadHash:'PRIVATE_PAYLOAD',status:'pending'}});
    process.env.DATABASE_URL=connections.runtimeUrl;const module=await Test.createTestingModule({imports:[AppModule]}).compile();
    app=module.createNestApplication();configureApplication(app,[]);await app.init();
  });
  afterAll(async()=>{
    if(app)await app.close();if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;
    if(db){const ids=Object.values(accounts),chatIds=[...Object.values(chats),...created];
      await db.aIPractice.deleteMany({where:{accountId:{in:ids}}});await db.aIMessage.deleteMany({where:{accountId:{in:ids}}});
      await db.aIRequest.deleteMany({where:{accountId:{in:ids}}});await db.aIUsageDaily.deleteMany({where:{accountId:{in:ids}}});
      await db.aIConversation.deleteMany({where:{id:{in:chatIds}}});if(courseId){await db.enrollment.deleteMany({where:{courseId}});await db.course.deleteMany({where:{id:courseId}});}
      await db.appSession.deleteMany({where:{accountId:{in:ids}}});await db.userRole.deleteMany({where:{accountId:{in:ids}}});await db.account.deleteMany({where:{id:{in:ids}}});await db.$disconnect();}
    if(migrator)await migrator.$disconnect();
  });
  it('creates default/named general chats for each audience without quota/academic mutation',async()=>{
    const before=await quota(),grantCount=await db.enrollment.count();
    for(const [name,audience] of [['learner','web'],['instructor','web'],['admin','admin']]) {
      const r=await create({},name,audience).expect(200);created.push(r.body.id);assertTaskContract('AI-02','WireAiConversation',r.body);
      expect(r.body).toMatchObject({title:'แชตใหม่',course_id:null});expect(JSON.stringify(r.body)).not.toContain('PRIVATE_');
      expect((await db.aIConversation.findUniqueOrThrow({where:{id:r.body.id}})).accountId).toBe(accounts[name]);
    }
    const named=await create({title:'😀'.repeat(80)}).expect(200);created.push(named.body.id);expect(named.body.title).toBe('😀'.repeat(80));
    expect(await quota()).toEqual(before);expect(await db.enrollment.count()).toBe(grantCount);
  });
  it('validates create contract and never accepts forged owner/context/status',async()=>{
    for(const body of [{title:null},{title:' '},{course_id:null},{user_id:accounts.other},{contextSnapshot:{}},{status:'succeeded'}])
      assertErrorContract((await create(body).expect(422)).body);
  });
  it('checks context course access for enrolled learner, owner preview and Admin without grants',async()=>{
    const before=await db.enrollment.count();
    for(const [name,audience] of [['learner','web'],['instructor','web'],['admin','admin']]) {
      const r=await create({course_id:courseId},name,audience).expect(200);created.push(r.body.id);expect(r.body.course_id).toBe(courseId);
    }
    await create({course_id:courseId},'other').expect(403);await create({course_id:randomUUID()}).expect(404);expect(await db.enrollment.count()).toBe(before);
  });
  it('does not bypass AI enabled/Published/verification with a saved course ID',async()=>{
    await db.course.update({where:{id:courseId},data:{aiEnabled:false}});
    try{await create({course_id:courseId}).expect(403);}finally{await db.course.update({where:{id:courseId},data:{aiEnabled:true}});}
    await db.account.update({where:{id:accounts.learner},data:{origin:'self_email',emailVerified:false}});
    try{await create({course_id:courseId}).expect(403);const r=await create().expect(200);created.push(r.body.id);}
    finally{await db.account.update({where:{id:accounts.learner},data:{origin:'admin_created'}});}
    await db.course.update({where:{id:courseId},data:{status:'draft',publishedAt:null}});
    try{await create({course_id:courseId}).expect(404);const r=await create({course_id:courseId},'instructor').expect(200);created.push(r.body.id);}
    finally{await db.course.update({where:{id:courseId},data:{status:'published',publishedAt:at}});}
  });
  it('lists only own visible chats and searches titles/messages case-insensitively without foreign leakage',async()=>{
    const before=await counts(),r=await read().query({q:' searchinmessage '}).expect(200);assertTaskContract('AI-02','AiConversationPage',r.body);
    expect(r.body.items.map((x:{id:string})=>x.id)).toEqual([chats.alpha]);expect(JSON.stringify(r.body)).not.toContain('PRIVATE_');
    expect((await read().query({q:'beta'}).expect(200)).body.items[0].id).toBe(chats.beta);
    const all=await read().expect(200);expect(all.body.items.map((x:{id:string})=>x.id)).not.toContain(chats.deleted);
    expect(all.body.items.map((x:{id:string})=>x.id)).not.toContain(chats.foreign);expect(await counts()).toEqual(before);
  });
  it('binds conversation-list cursor to filters/current owner and rejects undeclared queries',async()=>{
    const first=await read().query({limit:1}).expect(200),cursor=first.body.next_cursor;
    const next=await read().query({limit:1,cursor}).expect(200);expect(next.body.items[0].id).not.toBe(first.body.items[0].id);
    await read('','other').query({limit:1,cursor}).expect(422);await read().query({limit:1,q:'alpha',cursor}).expect(422);
    await read().query({account_id:accounts.other}).expect(422);await read('?limit=1&limit=2').expect(422);
  });
  it('reads saved messages in position order across pages even when timestamps go backwards',async()=>{
    const before=await quota(),first=await read('/'+chats.alpha+'/messages').query({limit:2}).expect(200);
    assertTaskContract('AI-02','AiMessagePage',first.body);expect(first.body.items.map((x:{content:string})=>x.content)).toEqual(['SearchInMessage','saved message 1']);
    const next=await read('/'+chats.alpha+'/messages').query({limit:2,cursor:first.body.next_cursor}).expect(200);
    assertTaskContract('AI-02','AiMessagePage',next.body);expect(next.body.items[0].id).toBe(messageId);expect(next.body.next_cursor).toBeNull();
    const json=JSON.stringify([...first.body.items,...next.body.items]);expect(json).not.toMatch(/PRIVATE_|correct_option_id|contextSnapshot|payloadHash/);
    expect(await quota()).toEqual(before);
  });
  it('practice history returns persisted latest answer and explanation only after answering',async()=>{
    const path='/'+chats.alpha+'/messages';let r=await read(path).expect(200),practice=r.body.items.find((x:{id:string})=>x.id===messageId).practice;
    expect(practice.topic_id).toBe(practiceId);expect(practice.questions[0]).toEqual({id:'q',prompt:'Practice',options:[{id:'a',text:'A'},{id:'b',text:'B'}],answered:false});
    await auth(request(app.getHttpServer()).put('/api/v1/me/ai/conversations/'+chats.alpha+'/messages/'+messageId+'/practice/answers')).send({question_id:'q',option_id:'b'}).expect(200);
    await db.$disconnect();await db.$connect();r=await read(path).expect(200);assertTaskContract('AI-02','AiMessagePage',r.body);
    practice=r.body.items.find((x:{id:string})=>x.id===messageId).practice;expect(practice.questions[0]).toMatchObject({answered:true,my_option_id:'b',result:{correct:false,explanation:'PRIVATE_EXPLANATION'}});
  });
  it('messages enforce owner even for Admin, hide deleted conversations, bind cursor and fail closed for legacy metadata',async()=>{
    for(const [id,name,audience] of [[chats.foreign,'learner','web'],[chats.alpha,'admin','admin'],[chats.deleted,'learner','web'],[randomUUID(),'learner','web']])
      await read('/'+id+'/messages',name,audience).expect(404);
    const first=await read('/'+chats.alpha+'/messages').query({limit:1}).expect(200);
    await read('/'+chats.beta+'/messages').query({limit:1,cursor:first.body.next_cursor}).expect(422);
    const bad=await read('/'+chats.bad+'/messages').expect(500);expect(JSON.stringify(bad.body)).not.toContain('PRIVATE_LEGACY');
  });
  it('simultaneous same-account chat creates do not deadlock on Account lock upgrades',async()=>{
    const rs=await Promise.all([create({course_id:courseId}),create({course_id:courseId})]);
    for(const r of rs){expect(r.status).toBe(200);created.push(r.body.id);}
  });
  it('delete tombstones exactly own chat, retains usage/request dedupe/practice/messages and is repeat safe',async()=>{
    const before=await counts(),usage=await quota(),stored=await db.aIRequest.findMany({where:{accountId:accounts.learner}});
    const r=await remove(chats.alpha).expect(204);expect(r.text).toBe('');await remove(chats.alpha).expect(204);
    expect((await db.aIConversation.findUniqueOrThrow({where:{id:chats.alpha}})).deletedAt).not.toBeNull();
    expect((await read().query({q:'SearchInMessage'}).expect(200)).body.items).toEqual([]);await read('/'+chats.alpha+'/messages').expect(404);
    expect(await counts()).toEqual(before);expect(await quota()).toEqual(usage);expect(await db.aIRequest.findMany({where:{accountId:accounts.learner}})).toEqual(stored);
  });
  it('delete cannot target another user, disclose unknown ownership or accept mutation/query claims',async()=>{
    for(const [id,name,audience] of [[chats.foreign,'learner','web'],[chats.beta,'admin','admin'],[randomUUID(),'learner','web']])await remove(id,name,audience).expect(404);
    await remove(chats.beta).send({user_id:accounts.other}).expect(422);await remove(chats.beta).query({purge:true}).expect(422);
    expect((await db.aIConversation.findUniqueOrThrow({where:{id:chats.beta}})).deletedAt).toBeNull();
  });
  it('all four handlers reject anonymous and disabled/revoked sessions without side effects',async()=>{
    await request(app.getHttpServer()).post('/api/v1/me/ai/conversations').send({}).expect(401);
    await request(app.getHttpServer()).get('/api/v1/me/ai/conversations').expect(401);
    await request(app.getHttpServer()).get('/api/v1/me/ai/conversations/'+chats.beta+'/messages').expect(401);
    await request(app.getHttpServer()).delete('/api/v1/me/ai/conversations/'+chats.beta).expect(401);
    const before=await counts();await db.account.update({where:{id:accounts.learner},data:{disabled:true}});
    try{await create().expect(401);await read().expect(401);await read('/'+chats.beta+'/messages').expect(401);await remove(chats.beta).expect(401);}
    finally{await db.account.update({where:{id:accounts.learner},data:{disabled:false}});}expect(await counts()).toEqual(before);
  });
});
