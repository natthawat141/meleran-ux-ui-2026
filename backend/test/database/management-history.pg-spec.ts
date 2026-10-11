import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma,PrismaClient } from '@prisma/client';
import { createHash,randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { testConnections } from '../support/postgres';
import { assertTaskContract,assertErrorContract } from '../support/contract-validator';

describe('MGMT-03/04 authorized roster and historical Attempt pages',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication;
  const tag='management_'+randomUUID(),old=process.env.DATABASE_URL,accounts:Record<string,string>={},secrets:Record<string,string>={};
  const courses:string[]=[],enrollments:Record<string,string>={},attempts:string[]=[];let articleId:string,quizItemId:string,questionId:string,certificateId:string;
  const auth=(r:request.Test,name='owner',audience=name==='admin'?'admin':'web')=>r.set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[name+'_'+audience]}`);
  const get=(path:string,name='owner',audience=name==='admin'?'admin':'web')=>auth(request(app.getHttpServer()).get('/api/v1/'+path),name,audience);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).map(n=>(db as any)[n[0].toLowerCase()+n.slice(1)].count()));
  const history=()=>Promise.all([db.enrollment.findMany({where:{courseId:{in:courses}},orderBy:{id:'asc'}}),db.progress.findMany({where:{courseId:{in:courses}},orderBy:{id:'asc'}}),
    db.quizAttempt.findMany({where:{courseId:{in:courses}},orderBy:{id:'asc'}}),db.answer.findMany({where:{attemptId:{in:attempts}},orderBy:{id:'asc'}}),db.certificate.findMany({where:{id:certificateId}})]);
  const makeAttempt=async(courseId:string,enrollmentId:string,quizId:string,itemId:string,number:number,status:string)=>{
    const row=await db.quizAttempt.create({data:{courseId,enrollmentId,quizId,number,maxScore:10,definitionSnapshot:{item_id:itemId,private:'PRIVATE_DEFINITION'},
      startedAt:new Date('2026-10-10T00:00:00Z'),snapshotQuestions:{create:{questionId:tag+'_'+number+'_'+courseId,position:0,type:'essay',maxScore:10,
        payloadSnapshot:{prompt:'Immutable public prompt',options:[],rubric:'เกณฑ์เดิม',response_mode:'text',correct_key:'PRIVATE_SNAPSHOT_KEY'}}}}});
    attempts.push(row.id);const snapshot=await db.attemptQuestion.findFirstOrThrow({where:{attemptId:row.id}});
    if(status!=='in_progress')await db.answer.create({data:{attemptId:row.id,questionId:snapshot.questionId,response:{text:'คำตอบเดิม',private:'PRIVATE_ANSWER_FIELD'},
      ...(status==='graded'?{score:8,comment:'ตรวจแล้ว',gradedBy:courseId===courses[0]?accounts.owner:accounts.other,gradedAt:new Date('2026-10-10T02:00:00Z')}:{})}});
    if(status!=='in_progress')await db.quizAttempt.update({where:{id:row.id},data:{status,submittedAt:new Date('2026-10-10T01:00:00Z'),
      ...(status==='graded'?{gradedAt:new Date('2026-10-10T02:00:00Z'),earnedScore:8,passed:true}:{})}});
    return row.id;
  };
  beforeAll(async()=>{
    const c=testConnections();db=c.runtime;migrator=c.migrator;process.env.DATABASE_URL=c.runtimeUrl;
    for(const name of ['owner','other','learner','second','admin']){
      accounts[name]=(await db.account.create({data:{displayName:tag+name,email:tag+name+'@example.test',profileJson:'{"phone":"PRIVATE_PHONE"}',roles:name==='learner'?'admin':'learner',
        roleGrants:{create:{role:name==='owner'||name==='other'?'instructor':name==='admin'?'admin':'learner'}}}})).id;
      for(const audience of ['web','admin']){const secret=randomUUID();secrets[name+'_'+audience]=secret;await db.appSession.create({data:{accountId:accounts[name],audience,
        tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase(),expiresAt:new Date(Date.now()+3600000)}});}
    }
    for(const name of ['owner','other']){const course=await db.course.create({data:{slug:tag+name,title:tag+name,category:'test',level:'test',instructorId:accounts[name],createdBy:accounts[name],
      revision:1,status:name==='owner'?'published':'archived',publishedAt:new Date('2026-01-01T00:00:00Z')}});courses.push(course.id);}
    const first=await db.courseChapter.create({data:{courseId:courses[0],title:'บทแรก',position:0}});articleId=(await db.courseItem.create({data:{courseId:courses[0],chapterId:first.id,title:'บทอ่านเดิม',type:'article',position:0,body:'PRIVATE_BODY'}})).id;
    enrollments.learner=(await db.enrollment.create({data:{accountId:accounts.learner,courseId:courses[0],grantedAt:new Date('2026-01-01T00:00:00Z'),
      completedAt:new Date('2026-01-02T00:00:00Z'),completionSnapshot:{version:1,item_ids:[articleId]},completedItems:999}})).id;
    await db.progress.create({data:{courseId:courses[0],enrollmentId:enrollments.learner,itemId:articleId,completedAt:new Date('2026-01-02T00:00:00Z')}});
    certificateId=(await db.certificate.create({data:{enrollmentId:enrollments.learner,code:tag,recipientName:'ชื่อบนใบรับรองเดิม',courseName:'คอร์สเดิม',issuedAt:new Date('2026-01-02T00:00:00Z')}})).id;
    enrollments.second=(await db.enrollment.create({data:{accountId:accounts.second,courseId:courses[0],grantedAt:new Date('2026-01-01T00:00:00Z')}})).id;
    const video=await db.courseItem.create({data:{courseId:courses[0],chapterId:first.id,title:'วิดีโอเพิ่มภายหลัง',type:'video',position:1}});
    await db.videoTranscript.create({data:{itemId:video.id,editedBy:accounts.admin,text:'PRIVATE_TRANSCRIPT'}});
    quizItemId=(await db.courseItem.create({data:{courseId:courses[0],chapterId:first.id,title:'Quiz เพิ่มภายหลัง',type:'quiz',position:2}})).id;
    const quiz=await db.quiz.create({data:{courseId:courses[0],itemId:quizItemId,title:'Quiz'}});questionId=(await db.question.create({data:{quizId:quiz.id,position:0,type:'essay',prompt:'PRIVATE_CURRENT_PROMPT',options:[],correctKey:'PRIVATE_CURRENT_KEY',maxScore:10}})).id;
    const otherChapter=await db.courseChapter.create({data:{courseId:courses[1],title:'บทอื่น',position:0}}),otherItem=await db.courseItem.create({data:{courseId:courses[1],chapterId:otherChapter.id,title:'Quiz อื่น',type:'quiz',position:0}});
    const otherQuiz=await db.quiz.create({data:{courseId:courses[1],itemId:otherItem.id,title:'Quiz อื่น'}});
    enrollments.foreign=(await db.enrollment.create({data:{accountId:accounts.learner,courseId:courses[1]}})).id;
    enrollments.ownerForeign=(await db.enrollment.create({data:{accountId:accounts.owner,courseId:courses[1]}})).id;
    await makeAttempt(courses[0],enrollments.learner,quiz.id,quizItemId,1,'graded');await makeAttempt(courses[0],enrollments.learner,quiz.id,quizItemId,2,'pending_review');
    await makeAttempt(courses[0],enrollments.second,quiz.id,quizItemId,1,'in_progress');await makeAttempt(courses[1],enrollments.foreign,otherQuiz.id,otherItem.id,1,'graded');
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication({logger:false});configureApplication(app,[]);await app.init();
  });
  afterAll(async()=>{
    if(app)await app.close();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;
    if(db){await db.answer.deleteMany({where:{attemptId:{in:attempts}}});await db.attemptQuestion.deleteMany({where:{attemptId:{in:attempts}}});await db.quizAttempt.deleteMany({where:{id:{in:attempts}}});
      await db.certificate.deleteMany({where:{id:certificateId}});await db.progress.deleteMany({where:{courseId:{in:courses}}});await db.enrollment.deleteMany({where:{courseId:{in:courses}}});
      await db.videoTranscript.deleteMany({where:{item:{courseId:{in:courses}}}});await db.question.deleteMany({where:{quiz:{courseId:{in:courses}}}});await db.quiz.deleteMany({where:{courseId:{in:courses}}});await db.course.deleteMany({where:{id:{in:courses}}});
      const ids={in:Object.values(accounts)};await db.appSession.deleteMany({where:{accountId:ids}});await db.userRole.deleteMany({where:{accountId:ids}});await db.account.deleteMany({where:{id:ids}});await db.$disconnect();}if(migrator)await migrator.$disconnect();
  });
  it('owned Course roster uses current item counts while keeping first historical Certificate and completion',async()=>{
    const r=await get('courses/'+courses[0]+'/learners').expect(200);assertTaskContract('MGMT-03','RosterPage',r.body);
    const learner=r.body.items.find((x:{user_id:string})=>x.user_id===accounts.learner);
    expect(learner).toMatchObject({id:enrollments.learner,course_id:courses[0],completed_items:1,total_items:3,percent:33,certificate:{id:certificateId,learner_name:'ชื่อบนใบรับรองเดิม'}});
    expect(learner.completed_at).toBe('2026-01-02T00:00:00.000Z');expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|email|phone|correct|password|source|resume/);
  });
  it('Enrollment in a foreign Course gives no instructor roster/Attempt management authority',async()=>{
    await get('courses/'+courses[1]+'/learners').expect(404);await get('courses/'+courses[1]+'/attempts').expect(404);
    const owned=await get('instructor/learners').expect(200);expect(new Set(owned.body.items.map((x:{course_id:string})=>x.course_id))).toEqual(new Set([courses[0]]));
  });
  it('Admin Course roster and per-account history include archived Course without content permission changes',async()=>{
    const course=await get('courses/'+courses[1]+'/learners','admin').expect(200);assertTaskContract('MGMT-03','RosterPage',course.body);
    const account=await get('admin/users/'+accounts.learner+'/enrollments','admin').expect(200);assertTaskContract('MGMT-03','RosterPage',account.body);
    expect(new Set(account.body.items.map((x:{course_id:string})=>x.course_id))).toEqual(new Set(courses));
    expect(account.body.items.every((x:{user_id:string})=>x.user_id===accounts.learner)).toBe(true);
  });
  it('Instructor/global Admin learner pages preserve one canonical row per Enrollment rather than fabricate a unique-course student',async()=>{
    const own=await get('instructor/learners').expect(200),all=await get('admin/learners','admin').expect(200);assertTaskContract('MGMT-04','RosterPage',own.body);assertTaskContract('MGMT-04','RosterPage',all.body);
    expect(own.body.items).toHaveLength(2);expect(all.body.items).toHaveLength(4);expect(new Set(all.body.items.map((x:{id:string})=>x.id)).size).toBe(4);
  });
  it('Course Attempt page preserves immutable public snapshots, learner answers and manual grades without keys',async()=>{
    const r=await get('courses/'+courses[0]+'/attempts').expect(200);assertTaskContract('MGMT-03','ManagedAttemptPage',r.body);expect(r.body.items).toHaveLength(3);
    const graded=r.body.items.find((x:{status:string})=>x.status==='graded');expect(graded).toMatchObject({user_id:accounts.learner,earned:8,max:10,passed:true,choice_earned:0,choice_max:0});
    expect(graded.questions[0]).toMatchObject({prompt:'Immutable public prompt',rubric:'เกณฑ์เดิม',response_mode:'text'});expect(Object.values(graded.answers)[0]).toEqual({text:'คำตอบเดิม'});
    expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|correct_key|correctKey|correct_option|definitionSnapshot|email|phone|gradedBy/);
  });
  it('Admin account Attempt page has only target answers across authorized course history',async()=>{
    const r=await get('admin/users/'+accounts.learner+'/attempts','admin').expect(200);assertTaskContract('MGMT-03','ManagedAttemptPage',r.body);
    expect(r.body.items).toHaveLength(3);expect(r.body.items.every((x:{user_id:string})=>x.user_id===accounts.learner)).toBe(true);
    const other=await get('admin/users/'+accounts.owner+'/attempts','admin').expect(200);expect(other.body.items).toEqual([]);
  });
  it('Course/current Question edits do not rewrite management Attempt snapshots or historical certificate names',async()=>{
    const before=await get('courses/'+courses[0]+'/attempts').expect(200);await db.question.update({where:{id:questionId},data:{prompt:'Changed current prompt',correctKey:'PRIVATE_NEW_KEY',maxScore:99}});
    await db.account.update({where:{id:accounts.learner},data:{displayName:'ชื่อใหม่'}});
    const r=await get('courses/'+courses[0]+'/attempts').expect(200);expect(r.body.items.map((x:{questions:unknown})=>x.questions)).toEqual(before.body.items.map((x:{questions:unknown})=>x.questions));
    const roster=await get('courses/'+courses[0]+'/learners').expect(200),learner=roster.body.items.find((x:{user_id:string})=>x.user_id===accounts.learner);
    expect(learner.learner_display_name).toBe('ชื่อใหม่');expect(learner.certificate.learner_name).toBe('ชื่อบนใบรับรองเดิม');
  });
  it('all six protected pages reject Guest and normalized Learner before exposing history',async()=>{
    const paths=['courses/'+courses[0]+'/learners','courses/'+courses[0]+'/attempts','admin/users/'+accounts.learner+'/enrollments','admin/users/'+accounts.learner+'/attempts','instructor/learners','admin/learners'];
    for(const path of paths){await request(app.getHttpServer()).get('/api/v1/'+path).expect(401);await get(path,'learner',path.startsWith('admin/')?'admin':'web').expect(403);}
  });
  it('Admin-only namespaces and Instructor-only directory do not inherit compatibility role strings',async()=>{
    await get('admin/learners','owner','admin').expect(403);await get('admin/learners','admin','web').expect(401);
    await get('admin/users/'+accounts.learner+'/enrollments','owner','admin').expect(403);await get('admin/users/'+accounts.learner+'/attempts','owner','admin').expect(403);
    await get('instructor/learners','admin','web').expect(403);await get('instructor/learners','owner','admin').expect(401);
    await get('courses/'+courses[0]+'/learners','admin','web').expect(200);
  });
  it('unknown Course/account returns404 while existing empty targets return canonical empty pages',async()=>{
    for(const path of ['courses/unknown/learners','courses/unknown/attempts','admin/users/unknown/enrollments','admin/users/unknown/attempts'])await get(path,'admin').expect(404);
    expect((await get('admin/users/'+accounts.admin+'/enrollments','admin').expect(200)).body.items).toEqual([]);
    expect((await get('admin/users/'+accounts.admin+'/attempts','admin').expect(200)).body.items).toEqual([]);
  });
  it('roster cursors are stable on equal timestamps and bound to resource/principal/limit/namespace',async()=>{
    const route='courses/'+courses[0]+'/learners',first=await get(route).query({limit:1}).expect(200),second=await get(route).query({limit:1,cursor:first.body.next_cursor}).expect(200);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);expect(second.body.next_cursor).toBeNull();
    await get(route,'admin').query({limit:1,cursor:first.body.next_cursor}).expect(422);await get('instructor/learners').query({limit:1,cursor:first.body.next_cursor}).expect(422);
    await get(route).query({limit:2,cursor:first.body.next_cursor}).expect(422);
    const account=await get('admin/users/'+accounts.learner+'/enrollments','admin').query({limit:1}).expect(200);
    await get('admin/users/'+accounts.second+'/enrollments','admin').query({limit:1,cursor:account.body.next_cursor}).expect(422);
  });
  it('Attempt keysets on equal start times never duplicate and cannot escape target/authoring scope',async()=>{
    const route='courses/'+courses[0]+'/attempts',ids:string[]=[],first=await get(route).query({limit:1}).expect(200);ids.push(first.body.items[0].id);
    let cursor=first.body.next_cursor;while(cursor){const r=await get(route).query({limit:1,cursor}).expect(200);ids.push(r.body.items[0].id);cursor=r.body.next_cursor;}
    expect(new Set(ids).size).toBe(3);await get('admin/users/'+accounts.learner+'/attempts','admin').query({limit:1,cursor:first.body.next_cursor}).expect(422);
    await get('courses/'+courses[1]+'/attempts').query({limit:1,cursor:first.body.next_cursor}).expect(404);
  });
  it('query identity/filter injection and duplicate/nested values are422 without broadened reads',async()=>{
    const route='courses/'+courses[0]+'/learners';for(const query of ['q=x','user_id='+accounts.admin,'limit=0','limit=1&limit=2','cursor[x]=y'])await get(route+'?'+query).expect(422);
    await get('courses/'+courses[0]+'/attempts?status=graded').expect(422);
  });
  it('disabled actor and removed normalized Instructor grant are rejected freshly',async()=>{
    try{
      await db.account.update({where:{id:accounts.owner},data:{disabled:true}});await get('instructor/learners').expect(401);
      await db.account.update({where:{id:accounts.owner},data:{disabled:false}});
      await db.userRole.delete({where:{accountId_role:{accountId:accounts.owner,role:'instructor'}}});await get('courses/'+courses[0]+'/learners').expect(403);
    }finally{
      await db.account.update({where:{id:accounts.owner},data:{disabled:false}});
      await db.userRole.upsert({where:{accountId_role:{accountId:accounts.owner,role:'instructor'}},create:{accountId:accounts.owner,role:'instructor'},update:{}});
    }
  });
  it('parallel/reconnect reads leave every model count and academic row unchanged',async()=>{
    const before=await counts(),academic=await history();const paths=['courses/'+courses[0]+'/learners','courses/'+courses[0]+'/attempts','instructor/learners'];
    for(const r of await Promise.all(paths.map(path=>get(path))))expect(r.status).toBe(200);
    await db.$disconnect();await db.$connect();await get('admin/learners','admin').expect(200);await get('admin/users/'+accounts.learner+'/attempts','admin').expect(200);
    expect(await counts()).toEqual(before);expect(await history()).toEqual(academic);
  });
  it('malformed historic snapshot fails safely without repairs or private diagnostics',async()=>{
    const bad=await db.quizAttempt.create({data:{enrollmentId:enrollments.second,courseId:courses[0],quizId:(await db.quiz.findUniqueOrThrow({where:{itemId:quizItemId}})).id,
      number:2,maxScore:10,definitionSnapshot:{item_id:quizItemId},snapshotQuestions:{create:{questionId:'bad-'+tag,position:0,type:'essay',maxScore:10,payloadSnapshot:{prompt:{private:'PRIVATE_BAD'},options:[]}}}}});
    attempts.push(bad.id);const before=await history();const r=await get('courses/'+courses[0]+'/attempts').expect(500);assertErrorContract(r.body);
    expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|snapshot|postgres/);expect(await history()).toEqual(before);
    await db.attemptQuestion.deleteMany({where:{attemptId:bad.id}});await db.quizAttempt.delete({where:{id:bad.id}});
  });
});
