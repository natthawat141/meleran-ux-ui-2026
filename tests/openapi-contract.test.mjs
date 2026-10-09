import assert from 'node:assert/strict';
import test from 'node:test';
import { validateContract } from '../scripts/contracts.mjs';
import { contract, schemaValidator, assertContractResponse } from './support/contract-validator.mjs';
import { createWorld, accounts, mockPassword } from './support/provisional-api.mjs';
import { decodeEnrollmentDto } from '../packages/contracts/src/enrollment-decoder.ts';

test('OpenAPI validates and accounts for every mock route, with real-provider mocks explicitly deferred', async () => {
  await validateContract();
  assert.equal(contract['x-session-boundary'].status, 'user-confirmed');
  assert.equal(contract['x-session-boundary'].login, 'separate Web/Admin');
  assert.deepEqual(contract['x-deferred-operations'].map(r => `${r.method} ${r.path}`).sort(), [
    'GET /auth/google/callback', 'GET /auth/google/start',
    'GET /me/auth-identities/google/callback', 'POST /me/auth-identities/google', 'POST /webhooks/stripe',
  ]);
  for (const schema of Object.keys(contract.components.schemas)) {
    schemaValidator({ $ref: '#/components/schemas/' + schema });
  }
});

test('documented examples conform to canonical request/response schemas', () => {
  for(const [path,methods] of Object.entries(contract.paths)) for(const [method,operation] of Object.entries(methods)) {
    assert.ok(Object.entries(operation.responses).some(([status,response]) =>
      (Number(status)>=200 && Number(status)<300 && (status==='204' || response.content?.['application/json']?.example!==undefined)) ||
      (path.endsWith('/videos/uploads') && status==='503' && response.content?.['application/json']?.example!==undefined)),`${method} ${path} missing success/unavailable fixture`);
    const body=operation.requestBody?.content?.['application/json'];
    if(body?.example!==undefined) assert.equal(schemaValidator(body.schema)(body.example),true,`${method} ${path} request example`);
    for(const [status,response] of Object.entries(operation.responses)) {
      const content=response.content?.['application/json'];
      if(content?.example!==undefined) assertContractResponse(method,path,{status:Number(status),body:content.example});
    }
  }
});

test('entitlement decoder preserves full HTTP projection and rejects malformed source/access/timestamps', () => {
  const valid={id:'enr_1',course_id:'crs_1',source:'free',access:'lifetime',granted_at:'2026-10-09T00:00:00.000Z'};
  assert.deepEqual(decodeEnrollmentDto(valid),valid);
  for(const patch of [{source:'admin'},{access:'client-granted'},{granted_at:'tomorrow'},{id:''}]) {
    assert.throws(()=>decodeEnrollmentDto({...valid,...patch}),/Invalid enrollment/);
  }
});

test('remaining resource projections and revision-bearing writes supply validated backend handoff fixtures', async () => {
  const world=createWorld(),owner=world.browser(),admin=world.browser(),learner=world.browser();
  await owner.login(accounts.instructorA);await admin.login(accounts.admin,{audience:'admin'});await learner.login(accounts.learner);
  const created=await owner.post('instructor/courses',{title:'Contract sample course',category:'General',level:'beginner'});
  assert.equal(created.status,201);
  const saved=await owner.patch(`courses/${created.body.id}`,{expected_revision:created.body.revision,
    chapters:[{title:'Sample chapter',items:[{type:'article',title:'Sample article',body:'Lesson body'}]}]});
  assert.equal(saved.status,200);
  const submitted=await owner.post(`courses/${created.body.id}/submit-review`,{expected_revision:saved.body.revision});
  assert.equal(submitted.status,201);
  const reviews=await admin.get('admin/course-reviews');assert.equal(reviews.status,200);
  const review=await admin.get(`admin/course-reviews/${submitted.body.id}`);assert.equal(review.status,200);
  assert.equal((await admin.post(`admin/course-reviews/${submitted.body.id}/approve`,{expected_revision:saved.body.revision})).status,200);
  assert.equal((await owner.post(`courses/${created.body.id}/publish`,{})).status,200);
  assert.equal((await learner.post(`courses/${created.body.id}/enroll`)).status,201);
  const itemId=saved.body.chapters[0].items[0].id;
  const completed=await learner.post(`learn/items/${itemId}/complete`);assert.equal(completed.status,200);
  assert.equal((await learner.get(`me/certificates/${completed.body.certificate_id}`)).status,200);
  assert.equal((await owner.get('instructor/learners')).status,200);
  assert.equal((await admin.get('admin/learners')).status,200);
  const codes=await admin.post('admin/redeem-codes',{course_id:'crs_mock_002',count:1});assert.equal(codes.status,201);
  assert.equal((await admin.post(`admin/redeem-codes/${codes.body.items[0].id}/revoke`)).status,200);
  const conversation=await learner.post('me/ai/conversations',{title:'Sample chat'});assert.equal(conversation.status,200);
  assert.equal((await learner.patch(`me/ai/conversations/${conversation.body.id}`,{title:'Renamed sample chat'})).status,200);
  const blog=await admin.post('admin/blog',{title:'Sample post',slug:'contract-sample-post',content:'Sample body'});assert.equal(blog.status,201);
  assert.equal((await admin.patch(`admin/blog/${blog.body.id}`,{expected_revision:blog.body.revision,title:'Updated sample post'})).status,200);
});

test('schema rejects wrong types, invalid request fields and private fields in public projections', async () => {
  const world = createWorld(), guest = world.browser();
  const login = schemaValidator({ $ref: '#/components/schemas/LoginRequest' });
  assert.equal(login({ identifier:'learner', password:'password', audience:'web' }),true);
  assert.equal(login({ identifier:'learner', password:'password', audience:'root' }),false);
  assert.equal(login({ identifier:'learner', password:'password', audience:'web', roles:['admin'] }),false);
  const patch = schemaValidator({ $ref: '#/components/schemas/CoursePatchRequest' });
  assert.equal(patch({ expected_revision:1, title:'New title' }),true);
  assert.equal(patch({ expected_revision:'1', title:'New title' }),false);
  const detail = await guest.get('courses/crs_mock_001');
  assert.doesNotThrow(() => assertContractResponse('GET','courses/crs_mock_001',detail));
  assert.throws(() => assertContractResponse('GET','courses/crs_mock_001',{
    ...detail,body:{...detail.body,correct_option_ids:['answer-key']},
  }),/Contract mismatch/);
  assert.throws(() => assertContractResponse('GET','courses/crs_mock_001',{
    ...detail,body:{...detail.body,price:{amount_minor:'100',currency:'THB'}},
  }),/Contract mismatch/);
});

test('one browser keeps Web/Admin cookies independent and per-app logout preserves the other session', async () => {
  const world=createWorld(), browser=world.browser();
  const webHeaders={'x-melearn-app':'web'}, adminHeaders={'x-melearn-app':'admin'};
  const web=await browser.post('auth/login',{identifier:accounts.learner,password:mockPassword,audience:'web'},webHeaders);
  const admin=await browser.post('auth/login',{identifier:accounts.admin,password:mockPassword,audience:'admin'},adminHeaders);
  assert.equal(web.status,200); assert.equal(admin.status,200);
  assert.equal((await browser.get('me',webHeaders)).body.id,'usr_learner');
  assert.equal((await browser.get('me',adminHeaders)).body.id,'usr_admin');
  assert.equal((await browser.post('auth/logout',undefined,webHeaders)).status,204);
  assert.equal((await browser.get('me',webHeaders)).status,401);
  assert.equal((await browser.get('me',adminHeaders)).body.id,'usr_admin');
  const webAgain=await browser.post('auth/login',{identifier:accounts.learner,password:mockPassword,audience:'web'},webHeaders);
  await browser.post('auth/logout',undefined,adminHeaders);
  assert.equal((await browser.get('me',adminHeaders)).status,401);
  assert.equal((await browser.get('me',webHeaders)).body.id,'usr_learner');
  assert.equal((await browser.post('auth/login',{identifier:accounts.admin,password:mockPassword,audience:'admin'},webHeaders)).status,403);
  // Copying a valid session into the other app's cookie must not authenticate that app.
  const token=webAgain.headers.get('set-cookie').split(';')[0].split('=')[1];
  assert.ok(world.db.sessions.has(token), 'use a live session, not an already revoked token');
  const forged=world.api.createFetcher({cookieHeader:`melearn_mock_session_admin=${token}`});
  const response=await forged('/mock-api/v1/me',{headers:adminHeaders});
  assert.equal(response.status,401);
});
