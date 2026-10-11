import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma,PrismaClient } from '@prisma/client';
import { createHash,randomUUID } from 'node:crypto';
import request=require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { testConnections } from '../support/postgres';
import { assertTaskContract,assertErrorContract } from '../support/contract-validator';

describe('COURSE-02 + REVIEW-01/02 aggregate transactions, immutable submitted snapshots and publication / real PG',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication,id:string;
  const oldUrl=process.env.DATABASE_URL,tag='authoring_review_'+randomUUID(),accounts:Record<string,string>={},secrets:Record<string,string>={},courseIds:string[]=[];
  const call=(method:'get'|'post'|'patch',path:string,body?:object,actor='owner',audience=actor==='admin'?'admin':'web')=>{
    const r=request(app.getHttpServer())[method]('/api/v1/'+path).set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[actor+'_'+audience]}`);
    return body===undefined?r:r.send(body);
  };
  const patch=(input:object,actor='owner',target=id)=>call('patch','courses/'+target,input,actor);
  const authoring=(target=id)=>call('get','courses/'+target+'/authoring');
  const submit=(revision=2)=>call('post','courses/'+id+'/submit-review',{expected_revision:revision});
  const publish=(actor='owner')=>call('post','courses/'+id+'/publish',{},actor);
  const validChapters=()=>[{title:'บทแรก',description:'อธิบายบท',items:[{type:'article',title:'อ่าน',body:'เนื้อหาที่เรียนได้',reading_minutes:1.5},
    {type:'video',title:'วิดีโอ',video_url:'https://youtu.be/abcdefghijk',duration:'3:10'},
    {type:'quiz',title:'แบบฝึกหัด',quiz:{pass_percent:70,questions:[{type:'single_choice',prompt:'เลือกข้อที่ถูก',points:3.75,
      options:[{text:'ถูก'},{text:'ผิด'}],correct_option_indices:[0]},{type:'essay',prompt:'อธิบาย',points:6.25,rubric:'เกณฑ์',response_mode:'text',prompt_doc:null}]}}]}];
  const ready=async()=>{const response=await patch({expected_revision:1,chapters:validChapters()}).expect(200);assertTaskContract('COURSE-02','AuthoringCourseDto',response.body);return response.body;};
  const writeChapters=(course:any)=>course.chapters.map((ch:any)=>({id:ch.id,title:ch.title,description:ch.description,items:ch.items.map((item:any)=>({
    id:item.id,type:item.type,title:item.title,...(item.body!==undefined?{body:item.body}:{}),...(item.video_url!==undefined?{video_url:item.video_url}:{}),
    ...(item.quiz?{quiz:{pass_percent:70,questions:item.quiz.questions.map((q:any)=>({id:q.id,type:q.type,prompt:q.prompt,points:q.points,
      ...(q.options?{options:q.options,correct_option_indices:q.correct_option_ids.map((key:string)=>q.options.findIndex((o:any)=>o.id===key))}:{}),
      ...(q.rubric!==undefined?{rubric:q.rubric}:{}),...(q.response_mode!==undefined?{response_mode:q.response_mode}:{})}))}}:{})}))}));
  const stored=()=>Promise.all([db.course.findUnique({where:{id}}),db.courseChapter.findMany({where:{courseId:id},orderBy:{id:'asc'}}),
    db.courseItem.findMany({where:{courseId:id},orderBy:{id:'asc'}}),db.quiz.findMany({where:{courseId:id},orderBy:{id:'asc'}}),
    db.question.findMany({where:{quiz:{courseId:id}},orderBy:{id:'asc'}}),db.courseReview.findMany({where:{courseId:id},orderBy:{id:'asc'}})]);
  const newCourse=async()=>{const response=await call('post','instructor/courses',{title:tag,category:'test',level:'test'}).expect(201);courseIds.push(response.body.id);return response.body.id;};
  beforeAll(async()=>{
    const c=testConnections();db=c.runtime;migrator=c.migrator;
    for(const role of ['owner','foreign','learner','admin']){
      accounts[role]=(await db.account.create({data:{displayName:tag+role,origin:'admin_created',roles:role==='admin'?'learner':'admin',roleGrants:{create:{role:['owner','foreign'].includes(role)?'instructor':role}}}})).id;
      for(const audience of ['web','admin']){const secret=randomUUID();secrets[role+'_'+audience]=secret;await db.appSession.create({data:{accountId:accounts[role],audience,
        tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase(),expiresAt:new Date(Date.now()+3600000)}});}
    }
    process.env.DATABASE_URL=c.runtimeUrl;const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication({logger:false});configureApplication(app,[]);await app.init();
  });
  beforeEach(async()=>{id=await newCourse();});
  afterAll(async()=>{
    if(app)await app.close();if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;
    if(db){const course={in:courseIds};const attempts=await db.quizAttempt.findMany({where:{courseId:course},select:{id:true}}),attemptId={in:attempts.map(a=>a.id)};
      await db.answer.deleteMany({where:{attemptId}});await db.attemptQuestion.deleteMany({where:{attemptId}});await db.quizAttempt.deleteMany({where:{courseId:course}});
      await db.certificate.deleteMany({where:{enrollment:{courseId:course}}});await db.progress.deleteMany({where:{courseId:course}});await db.enrollment.deleteMany({where:{courseId:course}});
      await db.courseReview.deleteMany({where:{courseId:course}});await db.question.deleteMany({where:{quiz:{courseId:course}}});await db.quiz.deleteMany({where:{courseId:course}});
      await db.videoTranscript.deleteMany({where:{item:{courseId:course}}});await db.course.deleteMany({where:{id:course}});
      const accountId={in:Object.values(accounts)};await db.appSession.deleteMany({where:{accountId}});await db.userRole.deleteMany({where:{accountId}});await db.account.deleteMany({where:{id:accountId}});await db.$disconnect();
    }if(migrator)await migrator.$disconnect();
  });
  it('atomically creates stable chapter/item/question/option IDs and canonical decimal keys with all optional metadata',async()=>{
    const course=await ready(),items=course.chapters[0].items;
    expect(course.revision).toBe(2);expect(items.map((i:any)=>i.type)).toEqual(['article','video','quiz']);expect(items[0].reading_minutes).toBe(1.5);
    expect(items[2].quiz.questions[0].points).toBe(3.75);expect(items[2].quiz.questions[0].correct_option_ids).toEqual([items[2].quiz.questions[0].options[0].id]);
    expect(items[2].quiz.questions[1]).toMatchObject({rubric:'เกณฑ์',response_mode:'text',prompt_doc:null});expect((await authoring().expect(200)).body).toEqual(course);
  });
  it('metadata-only patch preserves omitted content, original creator and separate Admin AI/transcript state',async()=>{
    const course=await ready(),video=course.chapters[0].items[1];await db.course.update({where:{id},data:{aiEnabled:true}});
    await db.videoTranscript.create({data:{itemId:video.id,text:'PRIVATE_TRANSCRIPT',editedBy:accounts.admin}});
    const response=await patch({expected_revision:2,title:'แก้แล้ว',subtitle:null,outcomes:['ผลใหม่'],price:{amount_minor:10000,currency:'THB'}}).expect(200);
    expect(response.body.revision).toBe(3);expect(response.body.created_by).toBe(accounts.owner);expect(response.body.ai_enabled).toBe(true);
    expect(response.body.chapters[0].items[1].has_ai_transcript).toBe(true);expect((await db.videoTranscript.findUniqueOrThrow({where:{itemId:video.id}})).text).toBe('PRIVATE_TRANSCRIPT');
  });
  it('reorders and moves retained Items across retained Chapters without unique collisions or replacement IDs',async()=>{
    const course=await ready(),chapters=writeChapters(course),moved=chapters[0].items.pop();chapters.unshift({title:'ใหม่',items:[moved]} as any);
    const r=await patch({expected_revision:2,chapters}).expect(200);expect(r.body.chapters[1].id).toBe(course.chapters[0].id);expect(r.body.chapters[0].items[0].id).toBe(moved.id);
    expect((await db.quiz.findUniqueOrThrow({where:{itemId:moved.id}})).id).toBe((await db.quiz.findFirstOrThrow({where:{courseId:id}})).id);
    const again=writeChapters(r.body).reverse();again[1].items.reverse();await patch({expected_revision:3,chapters:again}).expect(200);
  });
  it('deletes only unreferenced nested records and can change an unreferenced item type without dangling Quiz',async()=>{
    const course=await ready(),chapters=writeChapters(course),quizItem=chapters[0].items[2].id;
    chapters[0].items=[{id:quizItem,type:'article',title:'เปลี่ยน',body:'บทอ่าน'}];const r=await patch({expected_revision:2,chapters}).expect(200);
    expect(r.body.chapters[0].items).toHaveLength(1);expect(await db.quiz.count({where:{courseId:id}})).toBe(0);expect(await db.question.count({where:{quiz:{courseId:id}}})).toBe(0);
  });
  it('foreign Chapter/Item/Question/Option IDs rollback all earlier writes and metadata atomically',async()=>{
    const course=await ready(),before=await stored(),chapters=writeChapters(course);
    for(const mutate of [(x:any)=>x[0].id=randomUUID(),(x:any)=>x[0].items[0].id=randomUUID(),
      (x:any)=>x[0].items[2].quiz.questions[0].id=randomUUID(),(x:any)=>x[0].items[2].quiz.questions[0].options[0].id=randomUUID()]){
      const changed=JSON.parse(JSON.stringify(chapters));mutate(changed);await patch({expected_revision:2,title:'must rollback',chapters:changed}).expect(422);expect(await stored()).toEqual(before);
    }
  });
  it('duplicate IDs and invalid choice indices/negative scores/pass policy reject422 without revision change',async()=>{
    const course=await ready(),before=await stored(),chapters=writeChapters(course);
    for(const mutate of [(x:any)=>x.push(x[0]),(x:any)=>x[0].items.push(x[0].items[0]),(x:any)=>x[0].items[2].quiz.pass_percent=80,
      (x:any)=>x[0].items[2].quiz.questions[0].correct_option_indices=[0.5],(x:any)=>x[0].items[2].quiz.questions[0].points=-1]){
      const changed=JSON.parse(JSON.stringify(chapters));mutate(changed);await patch({expected_revision:2,chapters:changed}).expect(422);expect(await stored()).toEqual(before);
    }
  });
  it('stale/absent/noninteger revision and normal-editor AI field injection do not write',async()=>{
    const before=await stored();for(const body of [{title:'x'},{expected_revision:0},{expected_revision:1.5},{expected_revision:1,ai_enabled:true}])await patch(body).expect(422);
    assertErrorContract((await patch({expected_revision:2,title:'stale'}).expect(409)).body);expect(await stored()).toEqual(before);
  });
  it('fresh authority rejects Guest/Learner and foreign Instructor even after enrollment',async()=>{
    await db.enrollment.create({data:{courseId:id,accountId:accounts.foreign}});await patch({expected_revision:1,title:'foreign'},'foreign').expect(404);
    await patch({expected_revision:1},'learner').expect(403);await request(app.getHttpServer()).patch('/api/v1/courses/'+id).set('x-melearn-app','web').send({expected_revision:1}).expect(401);
  });
  it('only Admin reassigns existing normalized Instructor while preserving immutable creator',async()=>{
    await patch({expected_revision:1,instructor_id:accounts.foreign}).expect(403);await patch({expected_revision:1,instructor_id:accounts.learner},'admin').expect(422);
    const r=await patch({expected_revision:1,instructor_id:accounts.foreign},'admin').expect(200);expect(r.body.instructor.id).toBe(accounts.foreign);expect(r.body.created_by).toBe(accounts.owner);
    await authoring().expect(404);
  });
  it('existing Progress or Admin Transcript blocks deletion/type changes and preserves original records',async()=>{
    const course=await ready(),article=course.chapters[0].items[0],video=course.chapters[0].items[1];
    const grant=await db.enrollment.create({data:{courseId:id,accountId:accounts.learner}});await db.progress.create({data:{enrollmentId:grant.id,courseId:id,itemId:article.id,completedAt:new Date()}});
    await db.videoTranscript.create({data:{itemId:video.id,text:'PRIVATE_ORIGINAL',editedBy:accounts.admin}});const before=await stored();
    await patch({expected_revision:2,chapters:[]}).expect(409);const chapters=writeChapters(course);chapters[0].items[0]={id:article.id,type:'video',title:'invalid',video_url:'https://youtu.be/abcdefghijk'};
    await patch({expected_revision:2,chapters}).expect(409);expect(await stored()).toEqual(before);expect(await db.progress.count({where:{courseId:id}})).toBe(1);
  });
  it('editing Question preserves historical Attempt snapshots and prevents removal of the attempted Quiz item',async()=>{
    const course=await ready(),quizItem=course.chapters[0].items[2],quiz=await db.quiz.findUniqueOrThrow({where:{itemId:quizItem.id}});
    const grant=await db.enrollment.create({data:{courseId:id,accountId:accounts.learner}});
    const attempt=await db.quizAttempt.create({data:{courseId:id,quizId:quiz.id,enrollmentId:grant.id,number:1,maxScore:10,definitionSnapshot:{item_id:quizItem.id},
      snapshotQuestions:{create:{questionId:quizItem.quiz.questions[0].id,position:0,type:'single_choice',maxScore:10,payloadSnapshot:{prompt:'old immutable',options:[],correct_key:'old'}}}}});
    const snapshot=await db.attemptQuestion.findMany({where:{attemptId:attempt.id}}),chapters=writeChapters(course);chapters[0].items[2].quiz.questions[0].prompt='new';
    await patch({expected_revision:2,chapters}).expect(200);expect(await db.attemptQuestion.findMany({where:{attemptId:attempt.id}})).toEqual(snapshot);
    await patch({expected_revision:3,chapters:[]}).expect(409);
  });
  it('concurrent same-revision aggregate saves have exactly one winner and one409',async()=>{
    const responses=await Promise.all([patch({expected_revision:1,title:'a'}),patch({expected_revision:1,title:'b'})]);expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
    expect((await authoring().expect(200)).body.revision).toBe(2);
  });
  it('Draft permits incomplete content but submit/publish requires real readiness and supported YouTube',async()=>{
    await submit(1).expect(422);await publish('admin').expect(422);
    await patch({expected_revision:1,chapters:[{title:'บท',items:[{type:'video',title:'v',video_url:'https://example.test/video'}]}]}).expect(422);
    await patch({expected_revision:1,chapters:[{title:'บท',items:[{type:'article',title:'empty'}]}]}).expect(200);await submit().expect(422);
    expect(await db.courseReview.count({where:{courseId:id}})).toBe(0);
  });
  it('submit binds current revision, returns canonical201 and preserves original audit on replay/concurrency',async()=>{
    await ready();const first=await submit().expect(201);assertTaskContract('COURSE-02','CourseReviewDto',first.body);
    const responses=await Promise.all([submit(),submit()]);for(const r of responses)expect(r.body).toEqual(first.body);
    expect(await db.courseReview.count({where:{courseId:id}})).toBe(1);expect((await authoring().expect(200)).body.status).toBe('pending_review');
    await call('post','courses/'+id+'/submit-review',{expected_revision:2},'admin','web').expect(403);
  });
  it('Admin queue and detail show exact submitted snapshot, query filters and current stale status without rewriting history',async()=>{
    const original=await ready(),submitted=(await submit().expect(201)).body;
    const before=await db.courseReview.findUniqueOrThrow({where:{id:submitted.id}});
    const detail=await call('get','admin/course-reviews/'+submitted.id,undefined,'admin').expect(200);assertTaskContract('REVIEW-01','ReviewDetail',detail.body);
    expect(detail.body.course.chapters).toEqual(original.chapters);await patch({expected_revision:2,title:'new'}).expect(200);
    const stale=await call('get','admin/course-reviews/'+submitted.id,undefined,'admin').expect(200);expect(stale.body.status).toBe('stale');expect(stale.body.course.title).toBe(tag);
    const queue=await call('get','admin/course-reviews?status=stale&limit=50',undefined,'admin').expect(200);assertTaskContract('REVIEW-01','ReviewPage',queue.body);
    expect(queue.body.items.some((r:any)=>r.id===submitted.id&&r.course.revision===2)).toBe(true);expect(await db.courseReview.findUniqueOrThrow({where:{id:submitted.id}})).toEqual(before);
  });
  it('Instructor and invalid namespaces cannot inspect or decide Admin reviews',async()=>{
    await ready();const review=(await submit().expect(201)).body;
    for(const path of ['admin/course-reviews','admin/course-reviews/'+review.id])await call('get',path).expect(401);
    await call('post','admin/course-reviews/'+review.id+'/approve',{expected_revision:2},'owner','admin').expect(403);
    await call('get','admin/course-reviews/'+randomUUID(),undefined,'admin').expect(404);
  });
  it('approve requires matching revision and first publish uses approval/audit atomically with harmless repeat',async()=>{
    await ready();const review=(await submit().expect(201)).body;await call('post','admin/course-reviews/'+review.id+'/approve',{expected_revision:1},'admin').expect(409);
    const approved=await call('post','admin/course-reviews/'+review.id+'/approve',{expected_revision:2},'admin').expect(200);assertTaskContract('REVIEW-02','CourseReviewDto',approved.body);
    const first=await publish().expect(200);assertTaskContract('REVIEW-02','AuthoringCourseDto',first.body);expect(first.body.published_by).toBe(accounts.owner);
    const before=await stored();expect((await publish('admin').expect(200)).body).toEqual(first.body);expect(await stored()).toEqual(before);
  });
  it('Approved edit returns Draft and obsolete approval cannot publish',async()=>{
    await ready();const review=(await submit().expect(201)).body;await call('post','admin/course-reviews/'+review.id+'/approve',{expected_revision:2},'admin').expect(200);
    expect((await patch({expected_revision:2,description:'new revision'}).expect(200)).body.status).toBe('draft');await publish().expect(409);
    await call('post','admin/course-reviews/'+review.id+'/approve',{expected_revision:3},'admin').expect(409);
  });
  it('return requires reason, guards stale Review despite empty-revision contract, and resubmission retains old audit',async()=>{
    await ready();const review=(await submit().expect(201)).body;
    await call('post','admin/course-reviews/'+review.id+'/return',{reason:' '},'admin').expect(422);
    const returned=await call('post','admin/course-reviews/'+review.id+'/return',{reason:'แก้คำอธิบาย'},'admin').expect(200);
    expect((await authoring().expect(200)).body.status).toBe('draft');await patch({expected_revision:2,title:'fixed'}).expect(200);
    await call('post','admin/course-reviews/'+review.id+'/return',{reason:'old'},'admin').expect(409);
    const newReview=(await submit(3).expect(201)).body;expect(newReview.id).not.toBe(review.id);
    expect((await db.courseReview.findUniqueOrThrow({where:{id:review.id}})).reason).toBe(returned.body.reason);
  });
  it.each(['draft','pending_review'])('Admin direct publication from %s validates current content and preserves approval history',async status=>{
    await ready();if(status==='pending_review')await submit().expect(201);
    await publish().expect(409);const published=await publish('admin').expect(200);expect(published.body.status).toBe('published');expect(published.body.latest_review.status).toBe('approved');
    expect(published.body.latest_review.decided_by).toBe(accounts.admin);expect(await db.courseReview.count({where:{courseId:id}})).toBe(1);
  });
  it('Published content saves are immediately public and preserve first publication and approval snapshots',async()=>{
    await ready();const first=(await publish('admin').expect(200)).body,review=await db.courseReview.findFirstOrThrow({where:{courseId:id}});
    const saved=await patch({expected_revision:2,title:'Published changed'}).expect(200);expect(saved.body.status).toBe('published');expect(saved.body.published_at).toBe(first.published_at);expect(saved.body.published_by).toBe(first.published_by);
    const publicRead=await request(app.getHttpServer()).get('/api/v1/courses/'+id).expect(200);expect(publicRead.body.title).toBe('Published changed');
    expect(await db.courseReview.findUniqueOrThrow({where:{id:review.id}})).toEqual(review);
  });
  it('concurrent approve/return and save/approve cannot commit contradictory current approval',async()=>{
    await ready();const review=(await submit().expect(201)).body;
    const results=await Promise.all([call('post','admin/course-reviews/'+review.id+'/approve',{expected_revision:2},'admin'),call('post','admin/course-reviews/'+review.id+'/return',{reason:'return'},'admin')]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);
    await patch({expected_revision:2,title:'resubmit'}).expect(200);const current=(await submit(3).expect(201)).body;
    const race=await Promise.all([patch({expected_revision:3,title:'newer'}),call('post','admin/course-reviews/'+current.id+'/approve',{expected_revision:3},'admin')]);
    expect(race[0].status).toBe(200);expect([200,409]).toContain(race[1].status);expect((await authoring().expect(200)).body.status).toBe('draft');
  });
  it('query injection and signed cursor reuse cannot broaden review scope or status',async()=>{
    await ready();await submit().expect(201);await call('get','admin/course-reviews?status=invalid',undefined,'admin').expect(422);
    await call('get','admin/course-reviews?user_id='+accounts.owner,undefined,'admin').expect(422);
    const page=(await call('get','admin/course-reviews?limit=1',undefined,'admin').expect(200)).body;
    if(page.next_cursor)await call('get','admin/course-reviews?limit=1&status=pending&cursor='+encodeURIComponent(page.next_cursor),undefined,'admin').expect(422);
  });
  it('large canonical cover and incomplete rich Draft survive persistence/reconnect without startup writes',async()=>{
    const cover='ก'.repeat(120000),response=await patch({expected_revision:1,cover_url:cover,chapters:[{title:'draft',items:[{type:'article',title:'rich',body_doc:null}]}]}).expect(200);
    assertTaskContract('COURSE-02','AuthoringCourseDto',response.body);const before=await stored();await db.$disconnect();await db.$connect();
    expect((await authoring().expect(200)).body).toEqual(response.body);expect(await stored()).toEqual(before);
  });
});
