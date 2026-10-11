import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma,PrismaClient } from '@prisma/client';
import { createHash,randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import * as projection from '../../src/features/courses/dto/managed-course.dto';
import { testConnections,assertMigration,assertMigrationRollback } from '../support/postgres';
import { assertTaskContract,assertErrorContract } from '../support/contract-validator';

describe('COURSE-01 Instructor/Admin create and directory + append-only authoring storage',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication,migrationUrl:string;
  const tag='course_directory_'+randomUUID(),oldUrl=process.env.DATABASE_URL,accounts:Record<string,string>={},secrets:Record<string,string>={},courses:string[]=[];
  const auth=(r:request.Test,name='instructor',audience=name==='admin'?'admin':'web')=>r.set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[name+'_'+audience]}`);
  const input=(suffix='')=>({title:tag+suffix,category:'test',level:'test',outcomes:['เก็บจริง']});
  const create=(body:object=input(),name='instructor',audience=name==='admin'?'admin':'web')=>auth(request(app.getHttpServer()).post('/api/v1/'+(name==='admin'?'admin':'instructor')+'/courses'),name,audience).send(body);
  const list=(name='instructor',audience=name==='admin'?'admin':'web')=>auth(request(app.getHttpServer()).get('/api/v1/'+(name==='admin'?'admin':'instructor')+'/courses'),name,audience);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).map(n=>(db as any)[n[0].toLowerCase()+n.slice(1)].count()));
  beforeAll(async()=>{
    const connection=testConnections();db=connection.runtime;migrator=connection.migrator;migrationUrl=connection.migrationUrl;
    for(const name of ['instructor','otherInstructor','learner','admin']){
      accounts[name]=(await db.account.create({data:{displayName:tag+name,email:tag+name+'@example.test',profileJson:'{"phone":"PRIVATE_PROFILE"}',
        roles:name==='learner'?'instructor,admin':'learner',roleGrants:{create:{role:name.includes('Instructor')||name==='instructor'?'instructor':name}}}})).id;
      for(const audience of ['web','admin']){const secret=randomUUID();secrets[name+'_'+audience]=secret;await db.appSession.create({data:{accountId:accounts[name],audience,
        tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase(),expiresAt:new Date(Date.now()+3600000)}});}
    }
    process.env.DATABASE_URL=connection.runtimeUrl;const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication({logger:false});configureApplication(app,[]);await app.init();
  });
  afterAll(async()=>{
    if(app)await app.close();if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;
    if(db){await db.courseReview.deleteMany({where:{courseId:{in:courses}}});await db.question.deleteMany({where:{quiz:{courseId:{in:courses}}}});await db.quiz.deleteMany({where:{courseId:{in:courses}}});
      await db.course.deleteMany({where:{id:{in:courses}}});const ids={in:Object.values(accounts)};await db.appSession.deleteMany({where:{accountId:ids}});
      await db.userRole.deleteMany({where:{accountId:ids}});await db.account.deleteMany({where:{id:ids}});await db.$disconnect();}if(migrator)await migrator.$disconnect();
  });
  it('records reviewed authoring migration checksum and rolls back the full chain without touching public data',async()=>{
    await assertMigration(migrator,'20261011050000_course_authoring');const batches=readdirSync(resolve(__dirname,'../../prisma/migrations')).filter(p=>/^\d+_/.test(p)).sort();
    expect(batches).toHaveLength(10);await assertMigrationRollback(migrationUrl,migrator,batches,27);
    const sql=readFileSync(resolve(__dirname,'../../prisma/migrations/20261011050000_course_authoring/migration.sql'),'utf8');expect(sql).not.toMatch(/UPDATE (?:courses|course_items)|DROP TABLE/);
  });
  it('Instructor create returns exact full authoring metadata with truthful creator and single owner',async()=>{
    const r=await create().expect(201);courses.push(r.body.id);assertTaskContract('COURSE-01','AuthoringCourseDto',r.body);
    expect(r.body).toMatchObject({created_by:accounts.instructor,instructor:{id:accounts.instructor},status:'draft',revision:1,ai_enabled:false,
      chapters:[],published_at:null,published_by:null,latest_review:null,enrollment_count:0,outcomes:['เก็บจริง']});
    expect(r.body.slug).toBe('course-'+r.body.id);expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|profile|email|tokenHash|passwordHash/);
    const row=await db.course.findUniqueOrThrow({where:{id:r.body.id}});expect(row.createdBy).toBe(accounts.instructor);expect(row.instructorId).toBe(accounts.instructor);
    await request(app.getHttpServer()).get('/api/v1/courses/'+r.body.id).expect(404);
  });
  it('Admin create retains a different creator/Instructor and exact optional metadata',async()=>{
    const r=await create({...input('_admin'),instructor_id:accounts.otherInstructor,price:{amount_minor:0,currency:'THB'},subtitle:null,description:'บันทึกจริง',cover_url:null},'admin').expect(201);
    courses.push(r.body.id);assertTaskContract('COURSE-01','AuthoringCourseDto',r.body);expect(r.body.created_by).toBe(accounts.admin);expect(r.body.instructor.id).toBe(accounts.otherInstructor);
    expect(r.body.price).toEqual({amount_minor:0,currency:'THB'});expect(r.body.description).toBe('บันทึกจริง');
  });
  it('omitted metadata is explicit nullable/empty in Draft and does not fabricate content',async()=>{
    const r=await create({title:tag+'_minimal'}).expect(201);courses.push(r.body.id);assertTaskContract('COURSE-01','AuthoringCourseDto',r.body);
    expect(r.body).toMatchObject({category:'',level:'',subtitle:null,description:null,price:null,outcomes:[],chapters:[]});
  });
  it('unknown or CSV-only Instructor target is rejected atomically without a course',async()=>{
    const before=await counts();for(const id of ['unknown',accounts.learner])await create({...input(),instructor_id:id},'admin').expect(422);expect(await counts()).toEqual(before);
  });
  it('owner/role/status/revision/audit/AI injection and malformed money are rejected before persistence',async()=>{
    const before=await counts();for(const extra of [{instructor_id:accounts.otherInstructor},{status:'published'},{revision:99},{created_by:accounts.admin},
      {ai_enabled:true},{price:{amount_minor:1.5,currency:'THB'}},{price:{amount_minor:1,currency:'USD'}},{chapters:[]}])await create({...input(),...extra}).expect(422);
    await create({title:''}).expect(422);await create(input(),'admin').expect(422);expect(await counts()).toEqual(before);
  });
  it('role and audience guards reject Guest/Learner/Admin Web on Instructor commands and non-Admin on Admin commands',async()=>{
    const before=await counts();await request(app.getHttpServer()).post('/api/v1/instructor/courses').send(input()).expect(401);
    await request(app.getHttpServer()).post('/api/v1/admin/courses').send({...input(),instructor_id:accounts.instructor}).expect(401);
    await create(input(),'learner').expect(403);
    await auth(request(app.getHttpServer()).post('/api/v1/instructor/courses'),'admin','web').send(input()).expect(403);
    await auth(request(app.getHttpServer()).post('/api/v1/admin/courses'),'instructor','admin').send({...input(),instructor_id:accounts.instructor}).expect(403);
    await create({...input(),instructor_id:accounts.instructor},'admin','web').expect(401);expect(await counts()).toEqual(before);
  });
  it('different successful create requests have distinct immutable slugs; no invisible retry/dedupe policy',async()=>{
    const r=await Promise.all([create(input('_parallel')),create(input('_parallel'))]);expect(r.every(x=>x.status===201)).toBe(true);courses.push(...r.map(x=>x.body.id));
    expect(new Set(r.map(x=>x.body.slug)).size).toBe(2);
  });
  it('a failure after Course insertion rolls back the course and original audit together',async()=>{
    const before=await counts();const spy=jest.spyOn(projection,'managedCourse').mockImplementationOnce(()=>{throw Error('PRIVATE_PROJECTION_FAILURE');});
    const r=await create(input('_rollback')).expect(500);assertErrorContract(r.body);spy.mockRestore();expect(JSON.stringify(r.body)).not.toContain('PRIVATE_PROJECTION_FAILURE');expect(await counts()).toEqual(before);
  });
  it('Instructor list is owned-only and Admin list includes both creators with canonical management projection',async()=>{
    const before=await counts();const own=await list().query({limit:50}).expect(200);assertTaskContract('COURSE-01','ManagedCoursePage',own.body);
    expect(own.body.items.every((x:{instructor:{id:string}})=>x.instructor.id===accounts.instructor)).toBe(true);
    const other=await list('otherInstructor').expect(200);expect(other.body.items.every((x:{instructor:{id:string}})=>x.instructor.id===accounts.otherInstructor)).toBe(true);
    const admin=await list('admin').query({limit:50}).expect(200);assertTaskContract('COURSE-01','ManagedCoursePage',admin.body);
    expect(admin.body.items.map((x:{id:string})=>x.id).sort()).toEqual([...courses].sort());expect(await counts()).toEqual(before);
  });
  it('management summaries carry item history/counts but exclude answers, keys, body and transcript',async()=>{
    const courseId=courses[0],chapter=await db.courseChapter.create({data:{courseId,title:'บท',position:0,description:'PRIVATE_CHAPTER_DESCRIPTION'}});
    const item=await db.courseItem.create({data:{courseId,chapterId:chapter.id,title:'Quiz',type:'quiz',position:0,body:'PRIVATE_BODY'}});
    const quiz=await db.quiz.create({data:{courseId,itemId:item.id,title:'Quiz'}});await db.question.create({data:{quizId:quiz.id,position:0,type:'essay',prompt:'PRIVATE_PROMPT',options:[],correctKey:'PRIVATE_KEY',maxScore:10}});
    const r=await list().query({limit:50}).expect(200);const row=r.body.items.find((x:{id:string})=>x.id===courseId);assertTaskContract('COURSE-01','ManagedCourseSummaryDto',row);
    expect(row.chapters[0].items[0]).toEqual({id:item.id,type:'quiz',title:'Quiz',has_history:false,quiz:{question_count:1,pass_percent:70,attempt_count:0}});
    expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|correctKey|questionId|response|body_doc/);
  });
  it('status filter, keyset order and cursor owner/namespace/filter/limit binding are strict',async()=>{
    const r=await list().query({status:'draft',limit:1}).expect(200),next=await list().query({status:'draft',limit:1,cursor:r.body.next_cursor}).expect(200);
    expect(next.body.items[0].id).not.toBe(r.body.items[0].id);
    await list('otherInstructor').query({status:'draft',limit:1,cursor:r.body.next_cursor}).expect(422);await list('admin').query({status:'draft',limit:1,cursor:r.body.next_cursor}).expect(422);
    await list().query({status:'published',limit:1,cursor:r.body.next_cursor}).expect(422);await list().query({status:'draft',limit:2,cursor:r.body.next_cursor}).expect(422);
    await list().query({status:'published'}).expect(200).expect(r=>expect(r.body.items).toEqual([]));
  });
  it('all list handlers reject forged scopes and unknown/repeated query',async()=>{
    const before=await counts();for(const q of ['instructor_id=other','q=not-canonical','status=unknown','limit=0','limit=1&limit=2'])await list().query(q).expect(422);
    await list('learner').expect(403);await list('admin','web').expect(401);await request(app.getHttpServer()).get('/api/v1/admin/courses').expect(401);expect(await counts()).toEqual(before);
  });
  it('unknown legacy creator/revision is quarantined rather than replacing it with the current Instructor',async()=>{
    const old=await db.course.create({data:{slug:tag+'_legacy',title:tag,category:'test',level:'test',instructorId:accounts.instructor}});courses.push(old.id);
    const before=await counts();await list().expect(500);expect(await counts()).toEqual(before);await db.course.delete({where:{id:old.id}});courses.splice(courses.indexOf(old.id),1);
  });
  it('stored create audit, metadata and directories survive reconnect with no read writes',async()=>{
    const before=await counts();await db.$disconnect();await db.$connect();const r=await list('admin').query({limit:50}).expect(200);
    expect(r.body.items.some((x:{created_by:string;instructor:{id:string}})=>x.created_by===accounts.admin&&x.instructor.id===accounts.otherInstructor)).toBe(true);expect(await counts()).toEqual(before);
  });
  it('new nullable publisher and content fields preserve old records; first publisher audit cannot be rewritten',async()=>{
    const row=await db.course.findUniqueOrThrow({where:{id:courses[0]}});expect(row.publishedBy).toBeNull();const time=new Date();
    await db.course.update({where:{id:row.id},data:{status:'published',publishedAt:time,publishedBy:accounts.admin}});
    await expect(db.course.update({where:{id:row.id},data:{publishedBy:accounts.instructor}})).rejects.toThrow();
    await expect(db.course.update({where:{id:row.id},data:{publishedAt:new Date(time.getTime()+1000)}})).rejects.toThrow();
    await db.course.update({where:{id:row.id},data:{title:'แก้หลังเผยแพร่',status:'archived'}});
    expect((await db.course.findUniqueOrThrow({where:{id:row.id}})).publishedBy).toBe(accounts.admin);
  });
});
