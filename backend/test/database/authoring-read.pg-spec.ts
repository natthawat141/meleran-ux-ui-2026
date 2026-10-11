import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma,PrismaClient } from '@prisma/client';
import { createHash,randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { testConnections } from '../support/postgres';
import { assertTaskContract } from '../support/contract-validator';

describe('COURSE-02 owned authoring and Preview bounded read / HTTP+PG',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication,courseId:string,chapterId:string,quizId:string,enrollmentId:string;
  const tag='authoring_read_'+randomUUID(),oldUrl=process.env.DATABASE_URL,accounts:Record<string,string>={},secrets:Record<string,string>={},items:Record<string,string>={};
  const read=(preview=false,name='instructor',audience=name==='admin'?'admin':'web',id=courseId)=>request(app.getHttpServer()).get('/api/v1/courses/'+id+'/'+(preview?'authoring-preview':'authoring'))
    .set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[name+'_'+audience]}`);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).map(n=>(db as any)[n[0].toLowerCase()+n.slice(1)].count()));
  beforeAll(async()=>{
    const connection=testConnections();db=connection.runtime;migrator=connection.migrator;
    for(const name of ['instructor','foreign','learner','admin']){
      accounts[name]=(await db.account.create({data:{displayName:tag+name,roles:'learner',profileJson:'{"phone":"PRIVATE_PROFILE"}',
        roleGrants:{create:{role:name==='foreign'?'instructor':name}}}})).id;
      for(const audience of ['web','admin']){const secret=randomUUID();secrets[name+'_'+audience]=secret;await db.appSession.create({data:{accountId:accounts[name],audience,
        tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase(),expiresAt:new Date(Date.now()+3600000)}});}
    }
    courseId=(await db.course.create({data:{slug:tag,title:'คอร์ส authoring',category:'test',level:'test',instructorId:accounts.instructor,createdBy:accounts.admin,revision:1}})).id;
    chapterId=(await db.courseChapter.create({data:{courseId,title:'บทหนึ่ง',description:'รายละเอียดบท',position:0}})).id;
    for(const [position,type]of ['video','article','quiz'].entries())items[type]=(await db.courseItem.create({data:{courseId,chapterId,type,title:type,position,
      description:'อธิบาย '+type,...(type==='video'?{videoUrl:'https://example.test/embed/1',duration:'3:00'}:{}),
      ...(type==='article'?{body:'เนื้อหาบทอ่าน',contentDoc:{type:'doc',content:[{type:'paragraph',text:'ย่อหน้า'}]},readingMinutes:4}:{})}})).id;
    await db.videoTranscript.create({data:{itemId:items.video,text:'PRIVATE_TRANSCRIPT',editedBy:accounts.admin}});
    quizId=(await db.quiz.create({data:{itemId:items.quiz,courseId,title:'แบบฝึก'}})).id;
    await db.question.create({data:{id:tag+'_single',quizId,position:0,type:'single_choice',prompt:{prompt:'เลือกคำตอบ',prompt_doc:null,provider:'PRIVATE_PROVIDER'},
      options:[{id:'opt1',text:'ถูก',private:'PRIVATE_OPTION'},{id:'opt2',text:'อีกข้อ'}],correctKey:{option_ids:['opt1'],private:'PRIVATE_KEY'},maxScore:5}});
    await db.question.create({data:{id:tag+'_essay',quizId,position:1,type:'essay',prompt:{prompt:'อธิบาย',rubric:'เกณฑ์',response_mode:'text'},options:[],correctKey:{secret:'PRIVATE_KEY'},maxScore:10}});
    enrollmentId=(await db.enrollment.create({data:{courseId,accountId:accounts.learner,source:'free'}})).id;
    await db.progress.create({data:{enrollmentId,courseId,itemId:items.video,resumeData:{position_seconds:9}}});
    process.env.DATABASE_URL=connection.runtimeUrl;const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication({logger:false});configureApplication(app,[]);await app.init();
  });
  afterAll(async()=>{
    if(app)await app.close();if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;
    if(db){await db.courseReview.deleteMany({where:{courseId}});await db.question.deleteMany({where:{quizId}});await db.quiz.deleteMany({where:{courseId}});
      await db.videoTranscript.deleteMany({where:{item:{courseId}}});await db.progress.deleteMany({where:{courseId}});await db.enrollment.deleteMany({where:{courseId}});await db.course.deleteMany({where:{id:courseId}});
      const ids={in:Object.values(accounts)};await db.appSession.deleteMany({where:{accountId:ids}});await db.userRole.deleteMany({where:{accountId:ids}});await db.account.deleteMany({where:{id:ids}});await db.$disconnect();}
    if(migrator)await migrator.$disconnect();
  });
  it('owner authoring returns full canonical content/definitions/keys with current persisted order and audit',async()=>{
    const before=await counts(),r=await read().expect(200);assertTaskContract('COURSE-02','AuthoringCourseDto',r.body);
    expect(r.body.created_by).toBe(accounts.admin);expect(r.body.instructor.id).toBe(accounts.instructor);expect(r.body.chapters[0].description).toBe('รายละเอียดบท');
    const wire=r.body.chapters[0].items;expect(wire.map((x:{type:string})=>x.type)).toEqual(['video','article','quiz']);
    expect(wire[0]).toMatchObject({duration:'3:00',video_url:'https://example.test/embed/1',has_history:true,has_ai_transcript:true});
    expect(wire[1]).toMatchObject({body:'เนื้อหาบทอ่าน',reading_minutes:4,has_history:false});
    expect(wire[2].quiz.questions[0]).toMatchObject({prompt:'เลือกคำตอบ',points:5,correct_option_ids:['opt1'],options:[{id:'opt1',text:'ถูก'},{id:'opt2',text:'อีกข้อ'}]});
    expect(wire[2].quiz.questions[1]).toMatchObject({prompt:'อธิบาย',rubric:'เกณฑ์',response_mode:'text'});
    expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|correctKey|payloadSnapshot|email|phone|passwordHash|tokenHash/);expect(await counts()).toEqual(before);
  });
  it('Preview exact wire projection never returns authoring keys, Transcript, audit or learner identity',async()=>{
    const before=await counts(),r=await read(true).expect(200);assertTaskContract('COURSE-02','AuthoringPreview',r.body);
    expect(Object.keys(r.body).sort()).toEqual(['chapters','id','revision','title']);expect(r.body.chapters[0].items[2].quiz.questions[0].options).toHaveLength(2);
    expect(JSON.stringify(r.body)).not.toMatch(/correct_option_ids|PRIVATE_|created_by|instructor|email|progress|enrollment|certificate/);expect(await counts()).toEqual(before);
  });
  it('Admin can read both projections for management without creating academic progress',async()=>{
    const before=await counts();for(const preview of [false,true])await read(preview,'admin').expect(200);expect(await counts()).toEqual(before);
  });
  it('enrolled foreign Instructor and enrolled Learner cannot use owner authoring paths',async()=>{
    const before=await counts();for(const preview of [false,true]){await read(preview,'foreign').expect(404);await read(preview,'learner').expect(403);}
    expect(await counts()).toEqual(before);
  });
  it('Guest/unknown/forged audience/query fail without revealing course bodies',async()=>{
    for(const suffix of ['authoring','authoring-preview'])await request(app.getHttpServer()).get('/api/v1/courses/'+courseId+'/'+suffix).expect(401);
    await read(false,'admin','web').set('x-melearn-app','other').expect(403);await read(false,'instructor','web','unknown').expect(404);
    await read().query({include_keys:'true'}).expect(422);await read(true).query({account_id:accounts.learner}).expect(422);
  });
  it('Approved/Published/Archived remain manageable and preserve fresh data after reconnect',async()=>{
    const before=await counts();for(const status of ['approved','published','archived']){
      await db.course.update({where:{id:courseId},data:{status}});await db.$disconnect();await db.$connect();const r=await read().expect(200);expect(r.body.status).toBe(status);await read(true).expect(200);
    }expect(await counts()).toEqual(before);
  });
  it('latest review status reflects revision staleness and stored decision fields',async()=>{
    await db.courseReview.create({data:{courseId,submittedRevision:1,submittedBy:accounts.instructor,result:'approved',reviewedBy:accounts.admin,reviewedAt:new Date()}});
    await db.course.update({where:{id:courseId},data:{revision:2,status:'draft'}});const r=await read().expect(200);expect(r.body.latest_review.status).toBe('stale');assertTaskContract('COURSE-02','AuthoringCourseDto',r.body);
  });
  it('malformed authoring key is quarantined but Preview remains usable without selecting it',async()=>{
    await db.question.update({where:{id:tag+'_single'},data:{correctKey:{option_ids:['unknown']}}});const before=await counts();await read().expect(500);await read(true).expect(200);expect(await counts()).toEqual(before);
  });
  it('legacy missing creator stays truthful; Preview only needs its own valid revision',async()=>{
    // A fresh fixture with unknown original audit simulates a historical pre-cutover row.
    const legacy=await db.course.create({data:{slug:tag+'_legacy',title:tag,category:'test',level:'test',instructorId:accounts.instructor,revision:1}});
    try{await read(false,'instructor','web',legacy.id).expect(500);const r=await read(true,'instructor','web',legacy.id).expect(200);expect(r.body.chapters).toEqual([]);}
    finally{await db.course.delete({where:{id:legacy.id}});}
  });
});
