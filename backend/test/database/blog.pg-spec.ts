import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma,PrismaClient } from '@prisma/client';
import { createHash,randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import * as projection from '../../src/features/blog/dto/blog.dto';
import { testConnections,assertMigration } from '../support/postgres';
import { assertTaskContract,assertErrorContract } from '../support/contract-validator';

describe('BLOG-01/02/03 actual HTTP and PostgreSQL lifecycle',()=>{
  let db:PrismaClient,migrator:PrismaClient,app:INestApplication;
  const tag='blog-'+randomUUID(),previous=process.env.DATABASE_URL,ids:Record<string,string>={},secrets:Record<string,string>={};
  const auth=(r:request.Test,name='admin',audience='admin')=>r.set('x-melearn-app',audience).set('Cookie',`melearn_${audience}_session=${secrets[name+'_'+audience]}`);
  const body=(suffix:string)=>({title:tag+' '+suffix,slug:tag+'-'+suffix,content:'เนื้อหาที่บันทึกจริง'});
  const create=async(suffix:string,extra:object={})=>{const r=await auth(request(app.getHttpServer()).post('/api/v1/admin/blog')).send({...body(suffix),...extra}).expect(201);return r.body;};
  const mutate=(id:string,command:string,input:object)=>auth(command==='patch'?request(app.getHttpServer()).patch('/api/v1/admin/blog/'+id):
    command==='delete'?request(app.getHttpServer()).delete('/api/v1/admin/blog/'+id):request(app.getHttpServer()).post('/api/v1/admin/blog/'+id+'/'+command)).send(input);
  const counts=()=>Promise.all(Object.values(Prisma.ModelName).filter(n=>n!=='BlogPost').map(n=>(db as any)[n[0].toLowerCase()+n.slice(1)].count()));
  beforeAll(async()=>{
    const c=testConnections();db=c.runtime;migrator=c.migrator;process.env.DATABASE_URL=c.runtimeUrl;
    for(const name of ['admin','other','instructor','learner']){
      ids[name]=(await db.account.create({data:{displayName:tag+name,email:tag+name+'@example.test',profileJson:'{"phone":"PRIVATE_PHONE"}',roles:name==='learner'?'admin':'learner',
        roleGrants:{create:{role:name==='other'?'admin':name}}}})).id;
      for(const audience of ['web','admin']){const secret=randomUUID();secrets[name+'_'+audience]=secret;await db.appSession.create({data:{accountId:ids[name],audience,
        tokenHash:createHash('sha256').update(secret).digest('hex').toUpperCase(),expiresAt:new Date(Date.now()+3600000)}});}
    }
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication({logger:false});configureApplication(app,[]);await app.init();
  });
  afterAll(async()=>{
    if(app)await app.close();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;
    if(db){const accounts={in:Object.values(ids)};await db.blogPost.deleteMany({where:{authorId:accounts}});await db.appSession.deleteMany({where:{accountId:accounts}});
      await db.userRole.deleteMany({where:{accountId:accounts}});await db.account.deleteMany({where:{id:accounts}});await db.$disconnect();}if(migrator)await migrator.$disconnect();
  });
  it('applies the reviewed append-only Blog batch with its recorded checksum',async()=>{await assertMigration(migrator,'20261011051000_blog_authoring');});
  it('creates canonical Draft with explicit defaults and actual author/editor, without academic changes',async()=>{
    const before=await counts(),post=await create('defaults');assertTaskContract('BLOG-02','AdminBlogDto',post);
    expect(post).toMatchObject({category:'',cover_url:null,excerpt:null,content_doc:null,status:'draft',revision:1,reading_minutes:1,author_id:ids.admin,editor_id:ids.admin,published_at:null});
    expect(await counts()).toEqual(before);await request(app.getHttpServer()).get('/api/v1/blog/'+post.slug).expect(404);
  });
  it('preserves rich image/text structure in private preview and hides Draft from public search',async()=>{
    const rich={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'บทความไทย'}]},{type:'image',attrs:{src:'https://example.test/image.png'}}]};
    const post=await create('rich',{content:'',content_doc:rich,category:'หมวด',cover_url:'https://example.test/cover.png'});
    const r=await auth(request(app.getHttpServer()).get('/api/v1/admin/blog/'+post.id+'/preview')).expect(200);assertTaskContract('BLOG-02','AdminBlogDto',r.body);
    expect(r.body.content_doc).toEqual(rich);const list=await request(app.getHttpServer()).get('/api/v1/blog').query({q:post.title}).expect(200);expect(list.body.items).toEqual([]);
  });
  it('publish exposes canonical public summary/detail only and never exposes profile/editor/revision',async()=>{
    const post=await create('public',{excerpt:'คำเกริ่น',category:'เผยแพร่'}),published=await mutate(post.id,'publish',{expected_revision:1}).expect(200);
    assertTaskContract('BLOG-03','AdminBlogDto',published.body);expect(published.body.status).toBe('published');expect(published.body.revision).toBe(2);
    const list=await request(app.getHttpServer()).get('/api/v1/blog').query({q:post.title,category:'เผยแพร่'}).expect(200);assertTaskContract('BLOG-01','PublicBlogPage',list.body);
    expect(list.body.items.map((x:{id:string})=>x.id)).toEqual([post.id]);expect(list.body.items[0]).not.toHaveProperty('content');
    const detail=await request(app.getHttpServer()).get('/api/v1/blog/'+post.slug).expect(200);assertTaskContract('BLOG-01','PublicBlogDetail',detail.body);
    expect(detail.body.content).toBe(post.content);expect(JSON.stringify(detail.body)).not.toMatch(/PRIVATE_|email|editor_id|author_id|revision|created_at|status/);
  });
  it('published save is immediate, preserves original author/publication and records actual other Admin editor',async()=>{
    const post=await create('edit'),pub=await mutate(post.id,'publish',{expected_revision:1}).expect(200);
    const r=await auth(request(app.getHttpServer()).patch('/api/v1/admin/blog/'+post.id),'other').send({expected_revision:2,title:'Saved '+tag,content:'😀'.repeat(2001)}).expect(200);
    expect(r.body).toMatchObject({status:'published',revision:3,author_id:ids.admin,editor_id:ids.other,published_at:pub.body.published_at,reading_minutes:3});
    expect((await request(app.getHttpServer()).get('/api/v1/blog/'+post.slug).expect(200)).body.title).toBe('Saved '+tag);
  });
  it('missing/stale/fractional revision rejects every lifecycle or patch command without mutation',async()=>{
    const post=await create('revision'),before=await db.blogPost.findUniqueOrThrow({where:{id:post.id}});
    for(const command of ['patch','publish','unpublish','delete']){
      await mutate(post.id,command,{}).expect(422);await mutate(post.id,command,{expected_revision:1.5}).expect(422);
      const r=await mutate(post.id,command,{expected_revision:2}).expect(409);assertErrorContract(r.body);expect(r.body.error.details.current_revision).toBe(1);
    }expect(await db.blogPost.findUniqueOrThrow({where:{id:post.id}})).toEqual(before);
  });
  it('parallel revision commands converge on exactly one saved content version',async()=>{
    const post=await create('race'),r=await Promise.all([mutate(post.id,'patch',{expected_revision:1,content:'A'}),mutate(post.id,'patch',{expected_revision:1,content:'B'})]);
    expect(r.map(x=>x.status).sort()).toEqual([200,409]);const row=await db.blogPost.findUniqueOrThrow({where:{id:post.id}});expect(row.revision).toBe(2);expect(['A','B']).toContain(row.content);
  });
  it('same-state requests with current revision advance audit once; old retry fails and first publish date is stable',async()=>{
    const post=await create('replay'),first=await mutate(post.id,'publish',{expected_revision:1}).expect(200);
    await mutate(post.id,'publish',{expected_revision:1}).expect(409);const repeat=await mutate(post.id,'publish',{expected_revision:2}).expect(200);
    expect(repeat.body.revision).toBe(3);expect(repeat.body.published_at).toBe(first.body.published_at);
  });
  it('unpublish hides public data, keeps first publication and prevents later slug replacement',async()=>{
    const post=await create('unpublish'),pub=await mutate(post.id,'publish',{expected_revision:1}).expect(200);
    const r=await mutate(post.id,'unpublish',{expected_revision:2}).expect(200);expect(r.body.status).toBe('draft');expect(r.body.published_at).toBe(pub.body.published_at);
    await request(app.getHttpServer()).get('/api/v1/blog/'+post.slug).expect(404);
    await mutate(post.id,'patch',{expected_revision:3,slug:tag+'-new-slug'}).expect(409);
    const again=await mutate(post.id,'publish',{expected_revision:3}).expect(200);expect(again.body.published_at).toBe(pub.body.published_at);
  });
  it('Draft slug is editable but duplicate create/change races remain atomic409',async()=>{
    const post=await create('slug-a'),other=await create('slug-b');
    await auth(request(app.getHttpServer()).post('/api/v1/admin/blog')).send(body('slug-a')).expect(409);
    await mutate(other.id,'patch',{expected_revision:1,slug:post.slug}).expect(409);
    expect((await db.blogPost.findUniqueOrThrow({where:{id:other.id}})).revision).toBe(1);
    const changed=await mutate(other.id,'patch',{expected_revision:1,slug:tag+'-changed'}).expect(200);expect(changed.body.slug).toBe(tag+'-changed');
  });
  it('DELETE retains immutable content/actor/time with reserved slug and hides all subsequent reads',async()=>{
    const post=await create('delete'),r=await mutate(post.id,'delete',{expected_revision:1}).expect(200);assertTaskContract('BLOG-03','DeletedBlogResponse',r.body);
    const row=await db.blogPost.findUniqueOrThrow({where:{id:post.id}});expect(row.deletedBy).toBe(ids.admin);expect(row.deletedAt).not.toBeNull();expect(row.content).toBe(post.content);expect(row.revision).toBe(2);
    await auth(request(app.getHttpServer()).get('/api/v1/admin/blog/'+post.id+'/preview')).expect(404);await request(app.getHttpServer()).get('/api/v1/blog/'+post.slug).expect(404);
    await mutate(post.id,'delete',{expected_revision:2}).expect(404);await auth(request(app.getHttpServer()).post('/api/v1/admin/blog')).send(body('delete')).expect(409);
    await expect(db.blogPost.update({where:{id:post.id},data:{content:'changed'}})).rejects.toThrow();expect(await db.blogPost.findUniqueOrThrow({where:{id:post.id}})).toEqual(row);
  });
  it('normalized Learner/Instructor and Admin Web cannot invoke any Admin management operation',async()=>{
    const post=await create('denial'),before=await db.blogPost.findUniqueOrThrow({where:{id:post.id}});
    for(const [name,audience,status]of [['learner','admin',403],['instructor','admin',403],['admin','web',401]] as const){
      await auth(request(app.getHttpServer()).get('/api/v1/admin/blog'),name,audience).expect(status);
      await auth(request(app.getHttpServer()).get('/api/v1/admin/blog/'+post.id+'/preview'),name,audience).expect(status);
      await auth(request(app.getHttpServer()).post('/api/v1/admin/blog'),name,audience).send(body('unauthorized')).expect(status);
      await auth(request(app.getHttpServer()).patch('/api/v1/admin/blog/'+post.id),name,audience).send({expected_revision:1,title:'bad'}).expect(status);
      await auth(request(app.getHttpServer()).post('/api/v1/admin/blog/'+post.id+'/publish'),name,audience).send({expected_revision:1}).expect(status);
      await auth(request(app.getHttpServer()).post('/api/v1/admin/blog/'+post.id+'/unpublish'),name,audience).send({expected_revision:1}).expect(status);
      await auth(request(app.getHttpServer()).delete('/api/v1/admin/blog/'+post.id),name,audience).send({expected_revision:1}).expect(status);
    }expect(await db.blogPost.findUniqueOrThrow({where:{id:post.id}})).toEqual(before);
  });
  it('Guest management is401 and unknown/private slugs are404 to every public reader',async()=>{
    await request(app.getHttpServer()).get('/api/v1/admin/blog').expect(401);await request(app.getHttpServer()).post('/api/v1/admin/blog').send(body('guest')).expect(401);
    for(const name of ['admin','learner','instructor'])await auth(request(app.getHttpServer()).get('/api/v1/blog/unknown'),name,'web').expect(404);
  });
  it('public/admin keysets bind namespace/search/status/category/limit and reject duplicate/unknown parameters',async()=>{
    for(const suffix of ['page-a','page-b','page-c']){const post=await create(suffix,{category:'page'});await mutate(post.id,'publish',{expected_revision:1}).expect(200);}
    const first=await request(app.getHttpServer()).get('/api/v1/blog').query({q:'page-',category:'page',limit:1}).expect(200);
    const second=await request(app.getHttpServer()).get('/api/v1/blog').query({q:'page-',category:'page',limit:1,cursor:first.body.next_cursor}).expect(200);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    await request(app.getHttpServer()).get('/api/v1/blog').query({q:'page-',category:'wrong',limit:1,cursor:first.body.next_cursor}).expect(422);
    await auth(request(app.getHttpServer()).get('/api/v1/admin/blog')).query({q:'page-',status:'published',limit:1,cursor:first.body.next_cursor}).expect(422);
    const admin=await auth(request(app.getHttpServer()).get('/api/v1/admin/blog')).query({q:'page-',status:'published',limit:1}).expect(200);assertTaskContract('BLOG-02','AdminBlogPage',admin.body);
    await auth(request(app.getHttpServer()).get('/api/v1/admin/blog'),'other').query({q:'page-',status:'published',limit:1,cursor:admin.body.next_cursor}).expect(422);
    for(const query of ['limit=0','q=x&q=y','sort=title'])await request(app.getHttpServer()).get('/api/v1/blog?'+query).expect(422);
    await auth(request(app.getHttpServer()).get('/api/v1/admin/blog')).query({status:'deleted'}).expect(422);
  });
  it('public read/search/preview/list/reconnect never writes academic, identity, or Blog data',async()=>{
    const post=await create('readonly');await mutate(post.id,'publish',{expected_revision:1}).expect(200);
    const countsBefore=await counts(),rows=await db.blogPost.findMany({where:{authorId:{in:Object.values(ids)}},orderBy:{id:'asc'}});
    await request(app.getHttpServer()).get('/api/v1/blog').expect(200);await request(app.getHttpServer()).get('/api/v1/blog/'+post.slug).expect(200);
    await auth(request(app.getHttpServer()).get('/api/v1/admin/blog')).expect(200);await auth(request(app.getHttpServer()).get('/api/v1/admin/blog/'+post.id+'/preview')).expect(200);
    await db.$disconnect();await db.$connect();expect(await db.blogPost.findMany({where:{authorId:{in:Object.values(ids)}},orderBy:{id:'asc'}})).toEqual(rows);expect(await counts()).toEqual(countsBefore);
  });
  it('post-SQL projection failure rolls back content/editor/revision and publish state',async()=>{
    const post=await create('rollback'),before=await db.blogPost.findUniqueOrThrow({where:{id:post.id}});
    const original=projection.adminView;let calls=0;const spy=jest.spyOn(projection,'adminView').mockImplementation(row=>{if(++calls===2)throw Error('PRIVATE_ROLLBACK');return original(row);});
    const r=await mutate(post.id,'publish',{expected_revision:1}).expect(500);spy.mockRestore();assertErrorContract(r.body);expect(JSON.stringify(r.body)).not.toContain('PRIVATE_ROLLBACK');
    expect(await db.blogPost.findUniqueOrThrow({where:{id:post.id}})).toEqual(before);
  });
  it('unsafe rich content and actor/status injection never persist',async()=>{
    const before=await db.blogPost.count();for(const extra of [{author_id:ids.other},{status:'published'},{expected_revision:1},{content_doc:{type:'doc',content:[{type:'image',attrs:{src:'javascript:alert(1)'}}]}}])
      await auth(request(app.getHttpServer()).post('/api/v1/admin/blog')).send({...body('bad'),...extra}).expect(422);
    expect(await db.blogPost.count()).toBe(before);
  });
  it('valid Unicode large body reaches feature validation beyond generic100KiB limit',async()=>{
    const post=await create('large',{content:'😀'.repeat(200000)});expect([...post.content]).toHaveLength(200000);expect(post.reading_minutes).toBe(200);
    const before=await db.blogPost.count();await auth(request(app.getHttpServer()).post('/api/v1/admin/blog')).send({...body('too-large'),content:'😀'.repeat(200001)}).expect(422);
    expect(await db.blogPost.count()).toBe(before);
  });
  it('incomplete Draft cannot publish; valid rich image content can publish without plain text',async()=>{
    const empty=await create('empty',{content:''});await mutate(empty.id,'publish',{expected_revision:1}).expect(422);
    const image=await create('image',{content:'',content_doc:{type:'doc',content:[{type:'image',attrs:{src:'https://example.test/x.png'}}]}});
    await mutate(image.id,'publish',{expected_revision:1}).expect(200);
  });
  it('database independently preserves author/time and published slug against direct writes',async()=>{
    const post=await create('immutable');await mutate(post.id,'publish',{expected_revision:1}).expect(200);
    for(const data of [{authorId:ids.other},{createdAt:new Date(0)},{slug:tag+'-forged'},{publishedAt:null}])await expect(db.blogPost.update({where:{id:post.id},data})).rejects.toThrow();
  });
  it('legacy missing audit/metadata fails closed without fabricated values or silent repair',async()=>{
    const row=await db.blogPost.create({data:{slug:tag+'-legacy',title:tag+' legacy',authorId:ids.admin,contentDoc:Prisma.JsonNull}});
    const r=await auth(request(app.getHttpServer()).get('/api/v1/admin/blog/'+row.id+'/preview')).expect(500);assertErrorContract(r.body);
    expect(await db.blogPost.findUniqueOrThrow({where:{id:row.id}})).toEqual(row);await db.blogPost.delete({where:{id:row.id}});
  });
});
