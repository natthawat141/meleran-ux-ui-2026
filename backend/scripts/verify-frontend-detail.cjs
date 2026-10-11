// Component integration, not browser/feature acceptance. Build the Nest API first.
// Runs the unchanged fullstack frontend Catalog client against real local HTTP
// and owned PostgreSQL fixtures. No provisional server or mock fetcher is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { parseEnv } = require('node:util');
const { pathToFileURL } = require('node:url');
const { registerHooks } = require('node:module');
const { createHash, randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { PrismaClient, Prisma } = require('@prisma/client');
const root = path.resolve(__dirname, '..'), frontend = path.resolve(root, '../frontend');
const config = { ...parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8')), ...process.env };
const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));
let phase = 'test-target-guard';

async function main() {
  if (config.ALLOW_TEST_DATABASE_RESET !== 'yes') throw new Error('Isolated fixture opt-in required');
  const target = new URL(config.TEST_DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.hostname !== '127.0.0.1' ||
      target.port !== '5433' || target.pathname !== '/melearn_test' || target.username !== 'melearn_test_app' ||
      config.TEST_DATABASE_NAME !== 'melearn_test' || (target.searchParams.get('schema') || 'public') !== 'public')
    throw new Error('Confirmed isolated test target required');
  if (config.DATABASE_URL) {
    const runtime = new URL(config.DATABASE_URL);
    if (runtime.hostname === target.hostname && (runtime.port || '5432') === target.port && runtime.pathname === target.pathname)
      throw new Error('Application and test database must differ');
  }
  // Resolve the workspace alias to this checkout, bypassing local node_modules
  // junctions that may otherwise import an unrelated standalone frontend copy.
  phase = 'workspace-import';
  const learningClientSlot = '__melearn_learning_' + randomUUID();
  globalThis[learningClientSlot] = new Map();
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === '@melearn/api-client') return {
      url: pathToFileURL(path.join(frontend, 'packages/api-client/src/index.ts')).href, shortCircuit: true,
    };
    if (specifier === '@melearn/contracts') return {
      url: pathToFileURL(path.join(frontend, 'packages/contracts/src/index.ts')).href, shortCircuit: true,
    };
    if (specifier === './client' && /\/apps\/(admin|web)\/src\/shared\/api\/resources\.ts/.test(context.parentURL || '')) {
      const name = new URL(context.parentURL).searchParams.get('learning-actor');
      if (!globalThis[learningClientSlot].has(name)) throw new Error('Unknown resource fixture client');
      const source = `export const apiClient=globalThis[${JSON.stringify(learningClientSlot)}].get(${JSON.stringify(name)});`;
      return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    }
    if (specifier === '../../../shared/api/client' &&
        (context.parentURL?.includes('/features/learning/api/learning-api.ts') ||
         context.parentURL?.includes('/features/learning/api/assessment-api.ts') ||
         context.parentURL?.includes('/features/redeem/api/redeem-admin-api.ts') ||
         context.parentURL?.includes('/features/certificate/api/certificate-api.ts') ||
         context.parentURL?.includes('/features/ai/api/ai-api.ts') ||
         context.parentURL?.includes('/features/payment/api/payment-api.ts') ||
         context.parentURL?.includes('/features/payment/api/admin-payment-api.ts') ||
         context.parentURL?.includes('/features/auth/api/auth-session.ts') ||
         context.parentURL?.includes('/features/blog/api/blog-api.ts'))) {
      // Configuration injection only: retain the actual frontend singleton API,
      // endpoint builders/decoders and the real transport/fetch implementation.
      const name = new URL(context.parentURL).searchParams.get('learning-actor');
      if (!globalThis[learningClientSlot].has(name)) throw new Error('Unknown learning fixture client');
      const source = `export const apiClient=globalThis[${JSON.stringify(learningClientSlot)}].get(${JSON.stringify(name)});export const apiConfig=globalThis[${JSON.stringify(learningClientSlot)}].apiConfig;`;
      return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  } });
  const db = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  let child, accountId, learnerId, adminId;
  const additionalFixtureAccounts=[];
  async function stop() {
    if (child && child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill(); await Promise.race([exited, sleep(3000)]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }
  try {
    const { createHttpClient, HttpClientError } = await import(pathToFileURL(path.join(frontend, 'packages/api-client/src/index.ts')).href);
    const { createCatalogApi } = await import(pathToFileURL(path.join(frontend, 'apps/web/src/features/courses/api/catalog-api.ts')).href);
    phase = 'owned-fixtures';
    const tag = `frontend_${randomUUID()}`;
    accountId = (await db.account.create({ data: { displayName: tag, profileJson: '{"phone":"PRIVATE_PHONE"}' } })).id;
    learnerId = (await db.account.create({ data: { displayName: tag + '_learner', origin: 'admin_created',
      roles: 'admin', roleGrants: { create: { role: 'learner' } } } })).id;
    adminId = (await db.account.create({ data: { displayName: tag + '_admin', roles: 'learner',
      roleGrants: { create: { role: 'admin' } } } })).id;
    await db.userRole.create({ data: { accountId, role: 'instructor' } });
    const sessions = { learner: randomUUID(), owner: randomUUID(), admin: randomUUID() };
    for (const [name, secret] of Object.entries(sessions)) await db.appSession.create({ data: {
      tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase(),
      accountId: name === 'learner' ? learnerId : name === 'admin' ? adminId : accountId,
      audience: name === 'admin' ? 'admin' : 'web', expiresAt: new Date(Date.now() + 3600000),
    } });
    const ids = {};
    for (const status of ['published','draft','corrupt']) ids[status] = (await db.course.create({ data: {
      slug: tag + status, title: 'คอร์สจาก PostgreSQL', category: 'test', level: 'test', instructorId: accountId,
      status: status === 'corrupt' ? 'published' : status,
      publishedAt: status === 'draft' ? null : new Date('2026-10-11T00:00:00Z'),
      outcomesJson: status === 'corrupt' ? '{"private":"PRIVATE_CORRUPT"}' : '["ผลการเรียน"]',
      chapters: { create: { title: 'บทจริง', position: 0, items: { create: { title: 'วิดีโอจริง', type: 'video', position: 0,
        videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk' } } } },
    } })).id;
    const learningChapter = await db.courseChapter.findFirstOrThrow({ where: { courseId: ids.published } });
    const videoItem = await db.courseItem.findFirstOrThrow({ where: { chapterId: learningChapter.id, type: 'video' } });
    const articleItem = await db.courseItem.create({ data: { chapterId: learningChapter.id, courseId: ids.published,
      position: 1, title: 'บทอ่านจริง', type: 'article', contentDoc: { type: 'doc', nodes: [{ text: 'ข้อความจาก PostgreSQL' }] } } });
    const quizItem = await db.courseItem.create({ data: { chapterId: learningChapter.id, courseId: ids.published,
      position: 2, title: 'แบบฝึกหัดจริง', type: 'quiz', contentDoc: { private: 'PRIVATE_QUIZ_DOCUMENT' } } });
    const quiz = await db.quiz.create({ data: { courseId: ids.published, itemId: quizItem.id, title: quizItem.title,
      questions: { create: [{ position: 0, type: 'single_choice', prompt: 'PRIVATE_QUESTION', options: ['PRIVATE_OPTION'],
        correctKey: 'PRIVATE_CORRECT_KEY', maxScore: '3.75' }] } } });
    await db.videoTranscript.create({ data: { itemId: videoItem.id, editedBy: accountId, text: 'PRIVATE_RAW_TRANSCRIPT' } });
    const foreignItem = await db.courseItem.findFirstOrThrow({ where: { courseId: ids.draft } });
    const counts = () => Promise.all(Object.values(Prisma.ModelName).map(name => db[name[0].toLowerCase() + name.slice(1)].count()));
    const before = await counts();
    phase = 'nest-startup';
    const listener = net.createServer();
    await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    globalThis[learningClientSlot].apiConfig = { mock: false, baseUrl: `http://127.0.0.1:${port}/api/v1` };
    let output = '';
    child = spawn(process.execPath, ['dist/main.js'], { cwd: root, windowsHide: true,
      env: { ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: target.toString() },
      stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-20000); });
    child.stderr.on('data', () => {});
    for (let attempt = 0; attempt < 100 && !output.includes(`API listening on port ${port}`); attempt++) {
      if (child.exitCode !== null) throw new Error('Test API exited before readiness');
      await sleep(100);
    }
    assert.ok(output.includes(`API listening on port ${port}`));
    let requests = 0;
    const http = createHttpClient({ baseUrl: `http://127.0.0.1:${port}/api/v1`, credentials: 'omit', headers: {}, timeoutMs: 5000,
      fetcher: async (url, init) => { requests++; const response = await fetch(url, init); assert.equal(response.headers.get('x-melearn-mock'), null); return response; } });
    const api = createCatalogApi(http);
    phase = 'frontend-client-checks';
    const detail = await api.getCourse(ids.published);
    assert.equal(detail.id, ids.published); assert.equal(detail.price, null);
    assert.equal(detail.outline[0].items[0].title, 'วิดีโอจริง');
    assert.ok(!JSON.stringify(detail).includes('PRIVATE_PHONE'));
    assert.equal(await api.getCourse(ids.draft), null); assert.equal(await api.getCourse(randomUUID()), null);
    await db.course.update({ where: { id: ids.published }, data: { title: 'แก้แล้วและอ่านผ่าน API', priceMinor: 12300 } });
    await db.$disconnect(); await db.$connect();
    const changed = await api.getCourse(ids.published);
    assert.equal(changed.title, 'แก้แล้วและอ่านผ่าน API'); assert.deepEqual(changed.price, { amount_minor: 12300, currency: 'THB' });
    await assert.rejects(api.getCourse(ids.corrupt), error => error instanceof HttpClientError && error.kind === 'http' && error.status === 500);
    assert.deepEqual(await counts(), before);
    // Use the unchanged frontend mutation and decoder. Session fixtures isolate
    // this component from the pending login/provider and browser transport gate.
    phase = 'frontend-free-enroll-checks';
    const authenticatedApi = name => createCatalogApi(createHttpClient({
      baseUrl: `http://127.0.0.1:${port}/api/v1`, credentials: 'omit', timeoutMs: 5000,
      headers: { 'x-melearn-app': 'web', Cookie: `melearn_web_session=${sessions[name]}` },
      fetcher: async (url, init) => { const response = await fetch(url, init); assert.equal(response.headers.get('x-melearn-mock'), null); return response; },
    }));
    const learnerApi = authenticatedApi('learner'), ownerApi = authenticatedApi('owner');
    await db.course.update({ where: { id: ids.published }, data: { priceMinor: null } });
    const firstGrant = await learnerApi.enrollFree(ids.published);
    assert.equal(firstGrant.course_id, ids.published); assert.equal(firstGrant.source, 'free'); assert.equal(firstGrant.access, 'lifetime');
    await db.$disconnect(); await db.$connect();
    assert.deepEqual(await learnerApi.enrollFree(ids.published), firstGrant);
    const concurrent = await Promise.all([learnerApi.enrollFree(ids.published), learnerApi.enrollFree(ids.published)]);
    concurrent.forEach(grant => assert.deepEqual(grant, firstGrant));
    const storedGrant = await db.enrollment.findUniqueOrThrow({ where: { accountId_courseId: { accountId: learnerId, courseId: ids.published } } });
    assert.equal(storedGrant.id, firstGrant.id); assert.equal(storedGrant.grantedAt.toISOString(), firstGrant.granted_at);
    await assert.rejects(ownerApi.enrollFree(ids.published), error => error instanceof HttpClientError && error.status === 403);
    await db.course.update({ where: { id: ids.published }, data: { priceMinor: 12300 } });
    await assert.rejects(learnerApi.enrollFree(ids.published), error => error instanceof HttpClientError && error.status === 409);
    await assert.rejects(api.enrollFree(ids.published), error => error instanceof HttpClientError && error.status === 401);
    phase = 'frontend-learning-checks';
    let learningRequests = 0;
    for (const name of ['learner', 'owner', 'anonymous']) globalThis[learningClientSlot].set(name, createHttpClient({
      baseUrl: `http://127.0.0.1:${port}/api/v1`, credentials: 'omit', timeoutMs: 5000,
      headers: { 'x-melearn-app': 'web', ...(name === 'anonymous' ? {} : { Cookie: `melearn_web_session=${sessions[name]}` }) },
      fetcher: async (url, init) => { learningRequests++; const response = await fetch(url, init); assert.equal(response.headers.get('x-melearn-mock'), null); return response; },
    }));
    const learningApiFor = async name => (await import(pathToFileURL(path.join(frontend,
      'apps/web/src/features/learning/api/learning-api.ts')).href + '?learning-actor=' + name)).learningApi;
    const learning = await learningApiFor('learner'), ownerLearning = await learningApiFor('owner'), anonymousLearning = await learningApiFor('anonymous');
    const readCounts = await counts();
    const actualCourse = await learning.course(ids.published);
    assert.deepEqual(actualCourse.access.enrollment, firstGrant); assert.equal(actualCourse.progress.total_items, 3);
    assert.equal(actualCourse.progress.completed_items, 0); assert.equal(actualCourse.certificate_id, null);
    const actualVideo = await learning.item(ids.published, videoItem.id);
    assert.equal(actualVideo.video_url, 'https://www.youtube.com/watch?v=abcdefghijk');
    const actualArticle = await learning.item(ids.published, articleItem.id);
    assert.deepEqual(actualArticle.body_doc, articleItem.contentDoc);
    const actualQuiz = await learning.item(ids.published, quizItem.id);
    assert.deepEqual(actualQuiz.quiz, { question_count: 1, max_score: 3.75 });
    for (const value of [actualCourse, actualVideo, actualArticle, actualQuiz]) assert.ok(!JSON.stringify(value).includes('PRIVATE_'));
    await assert.rejects(learning.item(ids.published, foreignItem.id), error => error instanceof HttpClientError && error.status === 404);
    await assert.rejects(ownerLearning.course(ids.published), error => error instanceof HttpClientError && error.status === 403);
    await assert.rejects(anonymousLearning.course(ids.published), error => error instanceof HttpClientError && error.status === 401);
    assert.deepEqual(await counts(), readCounts);
    const { ResumeWriter } = require(path.join(root, 'dist/features/enrollments/public/resume-writer.service.js'));
    const savedResume = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM courses WHERE id=${ids.published} FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM enrollments WHERE id=${firstGrant.id} FOR UPDATE`;
      return new ResumeWriter().save(tx, firstGrant.id, videoItem.id, ids.published, 42.125);
    });
    let resume = await db.progress.findUniqueOrThrow({ where: { enrollmentId_itemId: { enrollmentId: firstGrant.id, itemId: videoItem.id } } });
    resume = await db.progress.update({ where: { id: resume.id }, data: {
      resumeData: { ...resume.resumeData, private: 'PRIVATE_RESUME_EXTRA' },
    } });
    const resumed = await learning.course(ids.published);
    assert.equal(resumed.resume_item_id, videoItem.id);
    assert.equal(resumed.outline[0].items[0].resume.position_seconds, 42.125);
    assert.deepEqual(resumed.outline[0].items[0].resume, savedResume.resume);
    assert.ok(!JSON.stringify(resumed).includes('_resume_order'));
    assert.ok(!JSON.stringify(resumed).includes('PRIVATE_'));
    await db.$disconnect(); await db.$connect();
    assert.deepEqual(await learning.course(ids.published), resumed);
    await db.progress.update({ where: { id: resume.id }, data: { resumeData: { position_seconds: -1 } } });
    await assert.rejects(learning.course(ids.published), error => error instanceof HttpClientError && error.status === 500);
    await db.progress.update({ where: { id: resume.id }, data: { resumeData: resume.resumeData, updatedAt: resume.updatedAt } });
    phase = 'frontend-admin-revoke-checks';
    const adminHttp = appHeader => createHttpClient({ baseUrl: `http://127.0.0.1:${port}/api/v1`,
      fetcher: globalThis.fetch.bind(globalThis),
      credentials: 'omit', timeoutMs: 5000, headers: { 'x-melearn-app': appHeader,
        Cookie: `melearn_admin_session=${sessions.admin}` } });
    const importRevoke = async (name, http) => {
      globalThis[learningClientSlot].set(name, http);
      const location = pathToFileURL(path.join(frontend, 'apps/admin/src/features/redeem/api/redeem-admin-api.ts'));
      location.searchParams.set('learning-actor', name);
      return (await import(location.href)).redeemAdminApi;
    };
    const adminCodes = await importRevoke('revoke-admin', adminHttp('admin'));
    const wrongAppCodes = await importRevoke('revoke-wrong-app', adminHttp('web'));
    const anonymousCodes = await importRevoke('revoke-anonymous', createHttpClient({
      baseUrl: `http://127.0.0.1:${port}/api/v1`, fetcher: globalThis.fetch.bind(globalThis),
      credentials: 'omit', timeoutMs: 5000, headers: { 'x-melearn-app': 'admin' } }));
    const unusedCode = await db.redeemCode.create({ data: { code: tag + '_PRIVATE_UNUSED', courseId: ids.published, issuedBy: adminId } });
    const revoked = await adminCodes.revoke(unusedCode.id);
    assert.deepEqual(Object.keys(revoked).sort(), ['id', 'revoked_at', 'status']);
    assert.equal(revoked.id, unusedCode.id); assert.equal(revoked.status, 'revoked');
    const revokedRow = await db.redeemCode.findUniqueOrThrow({ where: { id: unusedCode.id } });
    assert.equal(revokedRow.revokedBy, adminId); assert.equal(revokedRow.revokedAt.toISOString(), revoked.revoked_at);
    await db.$disconnect(); await db.$connect();
    assert.deepEqual(await adminCodes.revoke(unusedCode.id), revoked);
    assert.deepEqual(await db.redeemCode.findUniqueOrThrow({ where: { id: unusedCode.id } }), revokedRow);
    const paid = await db.course.create({ data: { slug: tag + '_paid_redeem', title: tag, instructorId: accountId,
      category: 'test', level: 'test', priceMinor: 12000, status: 'published', publishedAt: new Date() } });
    const usedCode = await db.redeemCode.create({ data: { code: tag + '_PRIVATE_USED', courseId: paid.id, issuedBy: adminId } });
    const { RedeemWriter } = require(path.join(root, 'dist/features/redeem/redeem-writer.service.js'));
    const { EntitlementWriter } = require(path.join(root, 'dist/features/enrollments/public/entitlement-writer.service.js'));
    const grant = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM courses WHERE id=${paid.id} FOR SHARE`;
      return new RedeemWriter(new EntitlementWriter()).redeem(tx, usedCode.id, learnerId, paid.id);
    });
    assert.equal(grant.enrollment.source, 'redeem'); assert.equal(grant.already_enrolled, false);
    const usedRow = await db.redeemCode.findUniqueOrThrow({ where: { id: usedCode.id } });
    assert.equal(usedRow.usedBy, learnerId); assert.equal(usedRow.enrollmentId, grant.enrollment.id);
    await assert.rejects(adminCodes.revoke(usedCode.id), error => error instanceof HttpClientError && error.status === 409);
    await assert.rejects(adminCodes.revoke(randomUUID()), error => error instanceof HttpClientError && error.status === 404);
    await assert.rejects(wrongAppCodes.revoke(unusedCode.id), error => error instanceof HttpClientError && error.status === 403);
    await assert.rejects(anonymousCodes.revoke(unusedCode.id), error => error instanceof HttpClientError && error.status === 401);
    assert.deepEqual(await db.redeemCode.findUniqueOrThrow({ where: { id: usedCode.id } }), usedRow);
    phase = 'frontend-video-unavailable-transport';
    let uploadSuccessDecodes = 0;
    const uploadRequest = (http, id = ids.published) => http.request(`courses/${encodeURIComponent(id)}/videos/uploads`, {
      method: 'POST', decoder: value => { uploadSuccessDecodes++; return value; },
    });
    const ownerUploadClient = createHttpClient({ baseUrl: `http://127.0.0.1:${port}/api/v1`,
      fetcher: globalThis.fetch.bind(globalThis), credentials: 'omit', timeoutMs: 5000,
      headers: { 'x-melearn-app': 'web', Cookie: `melearn_web_session=${sessions.owner}` } });
    const learnerUploadClient = createHttpClient({ baseUrl: `http://127.0.0.1:${port}/api/v1`,
      fetcher: globalThis.fetch.bind(globalThis), credentials: 'omit', timeoutMs: 5000,
      headers: { 'x-melearn-app': 'web', Cookie: `melearn_web_session=${sessions.learner}` } });
    const anonymousUploadClient = createHttpClient({ baseUrl: `http://127.0.0.1:${port}/api/v1`,
      fetcher: globalThis.fetch.bind(globalThis), credentials: 'omit', timeoutMs: 5000, headers: { 'x-melearn-app': 'web' } });
    const beforeUploads = await counts(), originalCourse = await db.course.findUniqueOrThrow({ where: { id: ids.published } });
    const originalItems = await db.courseItem.findMany({ where: { courseId: ids.published }, orderBy: { id: 'asc' } });
    await assert.rejects(uploadRequest(ownerUploadClient), error => error instanceof HttpClientError && error.status === 503);
    await assert.rejects(uploadRequest(adminHttp('admin')), error => error instanceof HttpClientError && error.status === 503);
    await assert.rejects(uploadRequest(learnerUploadClient), error => error instanceof HttpClientError && error.status === 403);
    await assert.rejects(uploadRequest(anonymousUploadClient), error => error instanceof HttpClientError && error.status === 401);
    await assert.rejects(uploadRequest(adminHttp('admin'), randomUUID()), error => error instanceof HttpClientError && error.status === 404);
    assert.deepEqual(await counts(), beforeUploads);
    assert.deepEqual(await db.course.findUniqueOrThrow({ where: { id: ids.published } }), originalCourse);
    assert.deepEqual(await db.courseItem.findMany({ where: { courseId: ids.published }, orderBy: { id: 'asc' } }), originalItems);
    phase = 'frontend-certificate-detail';
    // A trusted historical completed fixture is independent of a future
    // automatic Completion/Certificate issuer. This does not test issuance.
    const issueTime = new Date('2026-10-10T17:01:02.123Z');
    await db.enrollment.update({ where: { id: firstGrant.id }, data: { completedAt: issueTime,
      completionSnapshot: { total_items: 1, completed_items: 1, private: 'PRIVATE_HISTORICAL_FIXTURE' } } });
    const historicalCertificate = await db.certificate.create({ data: { enrollmentId: firstGrant.id, code: tag + '_CERT',
      courseName: 'ชื่อคอร์สตอนออกใบ', recipientName: 'ชื่อผู้เรียนตอนออกใบ', issuedAt: issueTime } });
    for (const [name, client] of [['certificate-owner', learnerUploadClient], ['certificate-foreign', ownerUploadClient],
      ['certificate-admin', adminHttp('admin')], ['certificate-guest', anonymousUploadClient]]) globalThis[learningClientSlot].set(name, client);
    const certificateApiFor = async name => (await import(pathToFileURL(path.join(frontend,
      'apps/web/src/features/certificate/api/certificate-api.ts')).href + '?learning-actor=' + name)).certificateApi;
    const ownCertificateApi = await certificateApiFor('certificate-owner');
    const expectedCertificate = { id: historicalCertificate.id, code: historicalCertificate.code, course_id: ids.published,
      course_title: historicalCertificate.courseName, learner_name: historicalCertificate.recipientName,
      issued_at: issueTime.toISOString(), enrollment_id: firstGrant.id };
    const certificateCounts = await counts();
    assert.deepEqual(await ownCertificateApi.get(historicalCertificate.id), expectedCertificate);
    assert.ok(!JSON.stringify(expectedCertificate).includes('PRIVATE_'));
    await assert.rejects((await certificateApiFor('certificate-foreign')).get(historicalCertificate.id), error => error instanceof HttpClientError && error.status === 404);
    await assert.rejects((await certificateApiFor('certificate-admin')).get(historicalCertificate.id), error => error instanceof HttpClientError && error.status === 404);
    await assert.rejects((await certificateApiFor('certificate-guest')).get(historicalCertificate.id), error => error instanceof HttpClientError && error.status === 401);
    await assert.rejects(ownCertificateApi.get(randomUUID()), error => error instanceof HttpClientError && error.status === 404);
    await db.account.update({ where: { id: learnerId }, data: { displayName: 'ชื่อปัจจุบันเปลี่ยนแล้ว' } });
    await db.course.update({ where: { id: ids.published }, data: { title: 'ชื่อคอร์สปัจจุบันเปลี่ยนแล้ว', status: 'archived' } });
    await db.$disconnect(); await db.$connect();
    assert.deepEqual(await ownCertificateApi.get(historicalCertificate.id), expectedCertificate);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    assert.deepEqual(await counts(), certificateCounts);
    phase = 'frontend-ai-practice-answer';
    const practiceConversation = await db.aIConversation.create({ data: { accountId: learnerId, courseId: null,
      title: 'ชื่อที่ผู้ใช้ตั้งเอง', contextSnapshot: { private: 'PRIVATE_GENERAL_CONTEXT' } } });
    const practiceMessage = await db.aIMessage.create({ data: { accountId: learnerId, conversationId: practiceConversation.id,
      role: 'assistant', position: 0, content: 'ชุดฝึกเดิม', contextSnapshot: {} } });
    const practicePayload = { version: 1, questions: [1, 2].map(index => ({ id: 'q' + index, prompt: 'โจทย์ ' + index,
      options: [{ id: 'right' + index, text: 'ถูก' }, { id: 'wrong' + index, text: 'ผิด' }],
      correct_option_id: 'right' + index, explanation: 'อธิบายข้อ ' + index })) };
    const practiceSet = await db.aIPractice.create({ data: { accountId: learnerId, conversationId: practiceConversation.id,
      messageId: practiceMessage.id, payloadSnapshot: practicePayload } });
    const aiApiFor = async name => (await import(pathToFileURL(path.join(frontend,
      'apps/web/src/features/ai/api/ai-api.ts')).href + '?learning-actor=' + name)).aiApi;
    const ownAi = await aiApiFor('certificate-owner');
    const sendAnswer = (api, question = 'q1', option = 'right1') => api.answerPractice(practiceConversation.id, practiceMessage.id, question, option);
    const beforePracticeCounts = await counts(), originalEnrollment = await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } });
    const originalProgress = await db.progress.findMany({ where: { enrollmentId: firstGrant.id }, orderBy: { id: 'asc' } });
    assert.deepEqual(await sendAnswer(ownAi, 'q1', 'wrong1'), { question_id: 'q1', correct: false, explanation: 'อธิบายข้อ 1', summary: null });
    assert.deepEqual((await sendAnswer(ownAi, 'q2', 'right2')).summary, { answered: 2, total: 2, correct_count: 1 });
    assert.deepEqual((await sendAnswer(ownAi)).summary, { answered: 2, total: 2, correct_count: 2 });
    await assert.rejects(sendAnswer(await aiApiFor('certificate-foreign')), error => error instanceof HttpClientError && error.status === 404);
    await assert.rejects(sendAnswer(await aiApiFor('certificate-admin')), error => error instanceof HttpClientError && error.status === 404);
    await assert.rejects(sendAnswer(await aiApiFor('certificate-guest')), error => error instanceof HttpClientError && error.status === 401);
    await assert.rejects(sendAnswer(ownAi, 'q1', 'right2'), error => error instanceof HttpClientError && error.status === 422);
    await db.$disconnect(); await db.$connect();
    const persistedPractice = await db.aIPractice.findUniqueOrThrow({ where: { id: practiceSet.id } });
    assert.deepEqual(persistedPractice.payloadSnapshot, practicePayload); assert.equal(persistedPractice.answers.q1.option_id, 'right1');
    assert.equal(persistedPractice.answers.q2.option_id, 'right2');
    assert.equal((await db.aIConversation.findUniqueOrThrow({ where: { id: practiceConversation.id } })).title, practiceConversation.title);
    assert.deepEqual(await counts(), beforePracticeCounts);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } }), originalEnrollment);
    assert.deepEqual(await db.progress.findMany({ where: { enrollmentId: firstGrant.id }, orderBy: { id: 'asc' } }), originalProgress);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    phase = 'frontend-ai-usage';
    const { quotaWindow: builtQuotaWindow } = require(path.join(root, 'dist/features/ai/quota-window.js'));
    const quotaInstant = (await db.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
    const quotaDay = await builtQuotaWindow(db, quotaInstant);
    for (const [id, used, pending] of [[learnerId, 7, 2], [accountId, 9, 0], [adminId, 20, 0]])
      await db.aIUsageDaily.create({ data: { accountId: id, usageDate: quotaDay.usageDate, successCount: used, pendingCount: pending } });
    const beforeUsageCounts = await counts();
    const usageRows = () => db.aIUsageDaily.findMany({ where: { accountId: { in: [learnerId, accountId, adminId] } }, orderBy: { accountId: 'asc' } });
    const originalUsage = await usageRows();
    const expectedUsage = used => ({ limit: 20, used, remaining: 20 - used, reset_at: quotaDay.resetAt.toISOString() });
    assert.deepEqual(await ownAi.usage(), expectedUsage(7));
    assert.deepEqual(await (await aiApiFor('certificate-foreign')).usage(), expectedUsage(9));
    assert.deepEqual(await (await aiApiFor('certificate-admin')).usage(), expectedUsage(20));
    await assert.rejects((await aiApiFor('certificate-guest')).usage(), error => error instanceof HttpClientError && error.status === 401);
    assert.deepEqual(await counts(), beforeUsageCounts); assert.deepEqual(await usageRows(), originalUsage);
    await db.aIUsageDaily.update({ where: { accountId_usageDate: { accountId: learnerId, usageDate: quotaDay.usageDate } },
      data: { successCount: 20, pendingCount: 0 } });
    const exhaustedUsage = await usageRows();
    assert.deepEqual(await ownAi.usage(), expectedUsage(20));
    await db.$disconnect(); await db.$connect();
    assert.deepEqual(await ownAi.usage(), expectedUsage(20));
    assert.deepEqual(await counts(), beforeUsageCounts); assert.deepEqual(await usageRows(), exhaustedUsage);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } }), originalEnrollment);
    assert.deepEqual(await db.progress.findMany({ where: { enrollmentId: firstGrant.id }, orderBy: { id: 'asc' } }), originalProgress);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    phase = 'frontend-ai-rename';
    const beforeRenameCounts = await counts(), beforeRenameConversation = await db.aIConversation.findUniqueOrThrow({ where: { id: practiceConversation.id } });
    const unchangedAiHistory = () => Promise.all([
      db.aIMessage.findMany({ where: { conversationId: practiceConversation.id }, orderBy: { id: 'asc' } }),
      db.aIPractice.findMany({ where: { conversationId: practiceConversation.id }, orderBy: { id: 'asc' } }),
      db.aIRequest.findMany({ where: { conversationId: practiceConversation.id }, orderBy: { id: 'asc' } }), usageRows(),
    ]);
    const beforeRenameHistory = await unchangedAiHistory();
    const renamed = await ownAi.renameConversation(practiceConversation.id, 'ชื่อใหม่ของผู้ใช้');
    assert.equal(renamed.id, practiceConversation.id); assert.equal(renamed.title, 'ชื่อใหม่ของผู้ใช้');
    assert.equal(renamed.course_id, null); assert.equal(renamed.created_at, practiceConversation.createdAt.toISOString());
    assert.equal(renamed.updated_at, (await db.aIConversation.findUniqueOrThrow({ where: { id: practiceConversation.id } })).updatedAt.toISOString());
    for (const [name, status] of [['certificate-foreign', 404], ['certificate-admin', 404], ['certificate-guest', 401]])
      await assert.rejects((await aiApiFor(name)).renameConversation(practiceConversation.id, 'forged'), error => error instanceof HttpClientError && error.status === status);
    await assert.rejects(ownAi.renameConversation(practiceConversation.id, ' '), error => error instanceof HttpClientError && error.status === 422);
    await db.$disconnect(); await db.$connect();
    assert.equal((await db.aIConversation.findUniqueOrThrow({ where: { id: practiceConversation.id } })).title, 'ชื่อใหม่ของผู้ใช้');
    assert.equal((await ownAi.renameConversation(practiceConversation.id, 'ชื่อหลัง reconnect')).title, 'ชื่อหลัง reconnect');
    assert.deepEqual((await db.aIConversation.findUniqueOrThrow({ where: { id: practiceConversation.id } })).contextSnapshot, beforeRenameConversation.contextSnapshot);
    assert.deepEqual(await counts(), beforeRenameCounts); assert.deepEqual(await unchangedAiHistory(), beforeRenameHistory);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } }), originalEnrollment);
    assert.deepEqual(await db.progress.findMany({ where: { enrollmentId: firstGrant.id }, orderBy: { id: 'asc' } }), originalProgress);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    phase = 'frontend-self-profile';
    const profileChecks = [];
    const authApiFor = async name => (await import(pathToFileURL(path.join(frontend,
      'apps/web/src/features/auth/api/auth-session.ts')).href + '?learning-actor=' + name)).authSessionApi;
    const ownAuth = await authApiFor('certificate-owner');
    phase = 'frontend-self-profile-learner';
    const ownProfile = await ownAuth.me();
    assert.deepEqual(ownProfile, { id: learnerId, display_name: 'ชื่อปัจจุบันเปลี่ยนแล้ว', username: null, email: null,
      email_verified: false, avatar_url: null, roles: ['learner'], origin: 'admin_created', auth_methods: [], learning_eligible: true, profile: {} });
    profileChecks.push('canonical-nullable-owner-and-normalized-roles');
    phase = 'frontend-self-profile-instructor';
    const instructorProfile = await (await authApiFor('certificate-foreign')).me();
    assert.equal(instructorProfile.id, accountId); assert.deepEqual(instructorProfile.roles, ['instructor']);
    assert.deepEqual(instructorProfile.profile, { phone: 'PRIVATE_PHONE' });
    profileChecks.push('instructor-self-projection');
    phase = 'frontend-self-profile-admin';
    const adminProfile = await (await authApiFor('certificate-admin')).me();
    assert.equal(adminProfile.id, adminId); assert.deepEqual(adminProfile.roles, ['admin']); assert.equal(adminProfile.learning_eligible, false);
    profileChecks.push('admin-self-projection-and-ineligible');
    phase = 'frontend-self-profile-anonymous';
    await assert.rejects((await authApiFor('certificate-guest')).me(), error => error instanceof HttpClientError && error.status === 401);
    profileChecks.push('anonymous401');
    phase = 'frontend-self-profile-reconnect';
    await db.account.update({ where: { id: learnerId }, data: { profileJson: '{"bio":"บันทึกไว้ใน PostgreSQL","interests":[],"internalAudit":"PRIVATE_AUDIT"}' } });
    await db.$disconnect(); await db.$connect();
    const savedProfile = await ownAuth.me();
    assert.deepEqual(savedProfile.profile, { bio: 'บันทึกไว้ใน PostgreSQL', interests: [] });
    assert.equal(JSON.stringify(savedProfile).includes('PRIVATE_AUDIT'), false);
    profileChecks.push('saved-fixture-reconnect-and-public-whitelist');
    phase = 'frontend-self-profile-corrupt';
    const validProfileJson = (await db.account.findUniqueOrThrow({ where: { id: learnerId } })).profileJson;
    await db.account.update({ where: { id: learnerId }, data: { profileJson: '{"bio":false}' } });
    await assert.rejects(ownAuth.me(), error => error instanceof HttpClientError && error.status === 500);
    assert.equal((await db.account.findUniqueOrThrow({ where: { id: learnerId } })).profileJson, '{"bio":false}');
    await db.account.update({ where: { id: learnerId }, data: { profileJson: validProfileJson } });
    profileChecks.push('corrupt-storage-safe500-without-repair');
    phase = 'frontend-self-profile-readonly';
    const beforeProfileCounts = await counts(), beforeProfileAccount = await db.account.findUniqueOrThrow({ where: { id: learnerId } });
    const profileSessions = () => db.appSession.findMany({ where: { accountId: learnerId }, orderBy: { tokenHash: 'asc' } });
    const beforeProfileSessions = await profileSessions();
    assert.deepEqual(await ownAuth.me(), savedProfile); assert.deepEqual(await ownAuth.me(), savedProfile);
    assert.deepEqual(await counts(), beforeProfileCounts); assert.deepEqual(await db.account.findUniqueOrThrow({ where: { id: learnerId } }), beforeProfileAccount);
    assert.deepEqual(await profileSessions(), beforeProfileSessions);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } }), originalEnrollment);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    profileChecks.push('read-only-identity-session-and-academic-persistence');
    phase = 'frontend-owned-payment-status';
    const paymentChecks = [];
    const paymentApiFor = async name => (await import(pathToFileURL(path.join(frontend,
      'apps/web/src/features/payment/api/payment-api.ts')).href + '?learning-actor=' + name)).paymentApi;
    const ownPayments = await paymentApiFor('certificate-owner');
    const paymentFixtures = {};
    for (const kind of ['pending', 'failed', 'granted']) paymentFixtures[kind] = await db.payment.create({ data: {
      accountId: learnerId, courseId: ids.published, requestId: tag + kind, amountMinor: 12300, payloadHash: 'PRIVATE_PAYMENT_PROOF',
      status: kind === 'pending' ? 'pending' : 'succeeded', paidAt: kind === 'pending' ? null : new Date(),
      fulfillmentStatus: kind === 'pending' ? 'pending' : kind, enrollmentId: kind === 'granted' ? firstGrant.id : null,
    } });
    const paymentRows = () => db.payment.findMany({ where: { accountId: learnerId }, orderBy: { id: 'asc' } });
    const beforePaymentCounts = await counts(), beforePaymentRows = await paymentRows();
    const pendingPayment = await ownPayments.status(paymentFixtures.pending.id);
    assert.deepEqual(pendingPayment, { payment_id: paymentFixtures.pending.id, course_id: ids.published,
      status: 'pending', fulfillment_status: 'pending', enrollment: null });
    paymentChecks.push('canonical-pending-without-inferred-existing-enrollment');
    const failedGrant = await ownPayments.status(paymentFixtures.failed.id);
    assert.equal(failedGrant.status, 'succeeded'); assert.equal(failedGrant.fulfillment_status, 'failed'); assert.equal(failedGrant.enrollment, null);
    paymentChecks.push('succeeded-money-failed-fulfillment-without-retry');
    assert.deepEqual((await ownPayments.status(paymentFixtures.granted.id)).enrollment, firstGrant);
    paymentChecks.push('linked-lifetime-enrollment-original-source');
    await assert.rejects((await paymentApiFor('certificate-foreign')).status(paymentFixtures.pending.id), error => error instanceof HttpClientError && error.status === 404);
    await assert.rejects((await paymentApiFor('certificate-admin')).status(paymentFixtures.pending.id), error => error instanceof HttpClientError && error.status === 404);
    paymentChecks.push('foreign-instructor-and-admin404');
    await assert.rejects((await paymentApiFor('certificate-guest')).status(paymentFixtures.pending.id), error => error instanceof HttpClientError && error.status === 401);
    paymentChecks.push('anonymous401');
    await assert.rejects(ownPayments.status(randomUUID()), error => error instanceof HttpClientError && error.status === 404);
    paymentChecks.push('unknown404');
    await db.$disconnect(); await db.$connect();
    assert.deepEqual(await ownPayments.status(paymentFixtures.pending.id), pendingPayment);
    assert.deepEqual(await counts(), beforePaymentCounts); assert.deepEqual(await paymentRows(), beforePaymentRows);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } }), originalEnrollment);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    paymentChecks.push('reconnect-and-polls-preserve-money-and-academic-history');
    phase = 'frontend-own-attempt-detail';
    const attemptChecks = [];
    const adminWebSecret = randomUUID();
    await db.appSession.create({ data: { accountId: adminId, audience: 'web', expiresAt: new Date(Date.now() + 3600000),
      tokenHash: createHash('sha256').update(adminWebSecret).digest('hex').toUpperCase() } });
    globalThis[learningClientSlot].set('attempt-admin-web', createHttpClient({ baseUrl: `http://127.0.0.1:${port}/api/v1`,
      fetcher: globalThis.fetch.bind(globalThis), credentials: 'omit', timeoutMs: 5000,
      headers: { 'x-melearn-app': 'web', Cookie: `melearn_web_session=${adminWebSecret}` } }));
    const assessmentApiFor = async name => (await import(pathToFileURL(path.join(frontend,
      'apps/web/src/features/learning/api/assessment-api.ts')).href + '?learning-actor=' + name)).assessmentApi;
    const ownAssessments = await assessmentApiFor('certificate-owner'), attemptFixtures = {};
    for (const [index, status] of ['in_progress', 'pending_review', 'graded', 'bad'].entries()) {
      const graded = status === 'graded';
      const attempt = await db.quizAttempt.create({ data: { enrollmentId: firstGrant.id, quizId: quiz.id, courseId: ids.published,
        number: index + 1, status: status === 'bad' ? 'in_progress' : status, maxScore: 10,
        definitionSnapshot: { item_id: quizItem.id, correct_key: 'PRIVATE_ATTEMPT_KEY' },
        submittedAt: status === 'pending_review' || graded ? new Date() : null, gradedAt: graded ? new Date() : null,
        earnedScore: graded ? 8 : null, passed: graded ? true : null,
        snapshotQuestions: { create: { questionId: 'historical_question', position: 0, type: 'essay', maxScore: 10,
          payloadSnapshot: { prompt: status === 'bad' ? false : 'คำถามจากชุดเดิม', options: [], correct_key: 'PRIVATE_ATTEMPT_KEY' } } } } });
      attemptFixtures[status] = attempt;
      await db.answer.create({ data: { attemptId: attempt.id, questionId: 'historical_question', response: { text: 'คำตอบเดิม', private: 'PRIVATE_ANSWER' },
        score: graded ? 8 : null, comment: graded ? 'ความคิดเห็นจากผู้สอน' : null, gradedAt: graded ? new Date() : null, gradedBy: graded ? accountId : null } });
    }
    const attemptRows = () => Promise.all([
      db.quizAttempt.findMany({ where: { enrollmentId: firstGrant.id }, orderBy: { id: 'asc' } }),
      db.answer.findMany({ where: { attemptId: { in: Object.values(attemptFixtures).map(row => row.id) } }, orderBy: { id: 'asc' } }),
    ]);
    const beforeAttemptRows = await attemptRows(), beforeAttemptCounts = await counts();
    const openAttempt = await ownAssessments.attempt(attemptFixtures.in_progress.id);
    assert.equal(openAttempt.item_id, quizItem.id); assert.equal(openAttempt.status, 'in_progress');
    assert.equal(openAttempt.earned, null); assert.equal(openAttempt.percent, null); assert.equal(openAttempt.passed, null); assert.equal(openAttempt.question_results, null);
    attemptChecks.push('open-snapshot-canonical-nullable-result');
    const pendingAttempt = await ownAssessments.attempt(attemptFixtures.pending_review.id);
    assert.equal(pendingAttempt.status, 'pending_review'); assert.equal(pendingAttempt.passed, null); assert.equal(pendingAttempt.question_results, null);
    attemptChecks.push('pending-does-not-publish-a-final-score');
    const gradedAttempt = await ownAssessments.attempt(attemptFixtures.graded.id);
    assert.equal(gradedAttempt.max, 10); assert.equal(gradedAttempt.earned, 8); assert.equal(gradedAttempt.percent, 80); assert.equal(gradedAttempt.passed, true);
    assert.deepEqual(gradedAttempt.answers, { historical_question: { text: 'คำตอบเดิม' } });
    assert.deepEqual(gradedAttempt.question_results, [{ question_id: 'historical_question', score: 8, max: 10, comment: 'ความคิดเห็นจากผู้สอน' }]);
    assert.equal(JSON.stringify(gradedAttempt).includes('PRIVATE_'), false);
    attemptChecks.push('graded-owned-original-snapshot-feedback-no-private-keys');
    for (const name of ['certificate-foreign', 'attempt-admin-web']) await assert.rejects((await assessmentApiFor(name)).attempt(attemptFixtures.graded.id), error => error instanceof HttpClientError && error.status === 404);
    await assert.rejects((await assessmentApiFor('certificate-admin')).attempt(attemptFixtures.graded.id), error => error instanceof HttpClientError && error.status === 401);
    attemptChecks.push('foreign-instructor-admin404');
    await assert.rejects((await assessmentApiFor('certificate-guest')).attempt(attemptFixtures.graded.id), error => error instanceof HttpClientError && error.status === 401);
    attemptChecks.push('anonymous401');
    await assert.rejects(ownAssessments.attempt(randomUUID()), error => error instanceof HttpClientError && error.status === 404);
    attemptChecks.push('unknown404');
    await assert.rejects(ownAssessments.attempt(attemptFixtures.bad.id), error => error instanceof HttpClientError && error.status === 500);
    assert.deepEqual(await attemptRows(), beforeAttemptRows);
    attemptChecks.push('invalid-stored-snapshot-safe500-no-repair');
    await db.$disconnect(); await db.$connect(); assert.deepEqual(await ownAssessments.attempt(attemptFixtures.graded.id), gradedAttempt);
    assert.deepEqual(await attemptRows(), beforeAttemptRows); assert.deepEqual(await counts(), beforeAttemptCounts);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } }), originalEnrollment);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    attemptChecks.push('reconnect-no-grade-completion-or-history-writes');
    phase = 'frontend-instructor-grant';
    const instructorGrantChecks = [];
    const adminResourceFor = async (name, http, app = 'admin') => {
      globalThis[learningClientSlot].set(name, http);
      const location = pathToFileURL(path.join(frontend, 'apps', app, 'src/shared/api/resources.ts'));
      location.searchParams.set('learning-actor', name); return (await import(location.href)).resource;
    };
    const adminResource = await adminResourceFor('grant-admin', adminHttp('admin'));
    const wrongResource = await adminResourceFor('grant-wrong-app', adminHttp('web'));
    const anonymousResource = await adminResourceFor('grant-anonymous', createHttpClient({
      baseUrl: `http://127.0.0.1:${port}/api/v1`, credentials: 'omit', timeoutMs: 5000,
      headers: { 'x-melearn-app': 'admin' }, fetcher: globalThis.fetch.bind(globalThis),
    }));
    const grantPath = 'admin/users/' + encodeURIComponent(learnerId) + '/instructor';
    const beforeAcademicGrant = await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } });
    const beforeGrantSessionCount = await db.appSession.count();
    const grantResult = await adminResource(grantPath, 'POST', {});
    assert.deepEqual(grantResult.user.roles, ['instructor', 'learner']); assert.equal(grantResult.added_by, adminId);
    assert.equal(grantResult.user.id, learnerId); assert.equal(grantResult.user.learning_eligible, true);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } }), beforeAcademicGrant);
    assert.equal(await db.appSession.count(), beforeGrantSessionCount);
    instructorGrantChecks.push('actual-admin-resource-and-canonical-decoder-durable-normalized-grant');
    const beforeRepeat = await db.account.findUniqueOrThrow({ where: { id: learnerId } });
    await db.$disconnect(); await db.$connect();
    for (const value of await Promise.all([adminResource(grantPath, 'POST', {}), adminResource(grantPath, 'POST', {})])) assert.deepEqual(value, grantResult);
    assert.deepEqual(await db.account.findUniqueOrThrow({ where: { id: learnerId } }), beforeRepeat);
    assert.equal(await db.userRole.count({ where: { accountId: learnerId, role: 'instructor' } }), 1);
    instructorGrantChecks.push('concurrent-replay-reconnect-preserves-original-audit');
    await assert.rejects(wrongResource(grantPath, 'POST', {}), error => error instanceof HttpClientError && error.status === 403);
    instructorGrantChecks.push('wrong-admin-namespace403');
    await assert.rejects(adminResource('admin/users/' + encodeURIComponent(adminId) + '/instructor', 'POST', {}), error => error instanceof HttpClientError && error.status === 409);
    instructorGrantChecks.push('admin-target409');
    await assert.rejects(adminResource('admin/users/unknown/instructor', 'POST', {}), error => error instanceof HttpClientError && error.status === 404);
    instructorGrantChecks.push('unknown404');
    await assert.rejects(anonymousResource(grantPath, 'POST', {}), error => error instanceof HttpClientError && error.status === 401);
    instructorGrantChecks.push('anonymous401');
    await assert.rejects(adminResource(grantPath, 'POST', { role: 'admin' }), error => error instanceof HttpClientError && error.status === 422);
    instructorGrantChecks.push('strict-body422-no-admin-elevation');
    phase = 'frontend-managed-quiz-locator';
    const locatorChecks = [];
    const webResourceFor = (name, secret) => adminResourceFor(name, createHttpClient({
      baseUrl: `http://127.0.0.1:${port}/api/v1`, credentials: 'omit', timeoutMs: 5000,
      headers: { 'x-melearn-app': 'web', Cookie: `melearn_web_session=${secret}` },
      fetcher: globalThis.fetch.bind(globalThis),
    }), 'web');
    const ownerResource = await webResourceFor('locator-owner', sessions.owner);
    const foreignResource = await webResourceFor('locator-enrolled-foreign', sessions.learner);
    const locatorPath = 'managed-quizzes/' + encodeURIComponent(quizItem.id);
    const expectedLocator = { course_id: ids.published, item_id: quizItem.id };
    const beforeLocatorCounts = await counts();
    const locatorDefinitions = () => Promise.all([
      db.quiz.findUniqueOrThrow({ where: { id: quiz.id } }),
      db.question.findMany({ where: { quizId: quiz.id }, orderBy: { id: 'asc' } }),
      attemptRows(),
    ]);
    const beforeLocatorDefinitions = await locatorDefinitions();
    assert.deepEqual(await ownerResource(locatorPath), expectedLocator);
    assert.notEqual(quizItem.id, quiz.id);
    locatorChecks.push('actual-web-resource-and-canonical-two-ID-decoder');
    assert.deepEqual(await adminResource(locatorPath), expectedLocator);
    locatorChecks.push('actual-admin-resource-authority');
    // Pure current frontend form mapping is a wire-ID interoperability check,
    // not evidence that the full authoring HTTP/editor feature is implemented.
    const { authoringForm,authoringWrite } = await import(pathToFileURL(path.join(frontend, 'packages/course-authoring/src/http-view.ts')).href);
    const form = authoringForm({ id: ids.published, instructor: { id: accountId },
      chapters: [{ id: learningChapter.id, title: 'บทจริง', items: [{ id: quizItem.id, type: 'quiz', title: quizItem.title, has_history: true }] }] });
    assert.equal(form.quizzes[0].id, quizItem.id);
    assert.equal(form.course.chapters[0].items[0].quizId, quizItem.id);
    assert.deepEqual(await ownerResource('managed-quizzes/' + encodeURIComponent(form.quizzes[0].id)), expectedLocator);
    locatorChecks.push('current-pure-authoring-form-item-ID-roundtrip');
    await assert.rejects(foreignResource(locatorPath), error => error instanceof HttpClientError && error.status === 404);
    locatorChecks.push('enrolled-foreign-instructor404');
    await assert.rejects(anonymousResource(locatorPath), error => error instanceof HttpClientError && error.status === 401);
    locatorChecks.push('anonymous401');
    for (const id of [randomUUID(), articleItem.id, quiz.id])
      await assert.rejects(ownerResource('managed-quizzes/' + encodeURIComponent(id)), error => error instanceof HttpClientError && error.status === 404);
    locatorChecks.push('unknown-nonquiz-private-UUID404-without-fallback');
    await db.$disconnect(); await db.$connect();
    for (const value of await Promise.all([ownerResource(locatorPath), adminResource(locatorPath)])) assert.deepEqual(value, expectedLocator);
    assert.deepEqual(await counts(), beforeLocatorCounts);
    assert.deepEqual(await locatorDefinitions(), beforeLocatorDefinitions);
    locatorChecks.push('reconnect-read-preserves-all-models-definition-and-academic-history');
    phase = 'frontend-admin-user-detail';
    const adminDetailChecks = [];
    const nonAdminSecret = randomUUID();
    await db.appSession.create({ data: { accountId: learnerId, audience: 'admin',
      tokenHash: createHash('sha256').update(nonAdminSecret).digest('hex').toUpperCase(), expiresAt: new Date(Date.now() + 3600000) } });
    const nonAdminResource = await adminResourceFor('detail-nonadmin', createHttpClient({
      baseUrl: `http://127.0.0.1:${port}/api/v1`, credentials: 'omit', timeoutMs: 5000,
      headers: { 'x-melearn-app': 'admin', Cookie: `melearn_admin_session=${nonAdminSecret}` }, fetcher: globalThis.fetch.bind(globalThis),
    }));
    const detailPath = 'admin/users/' + encodeURIComponent(learnerId);
    const beforeAdminDetailCounts = await counts();
    const beforeAdminDetailAccount = await db.account.findUniqueOrThrow({ where: { id: learnerId } });
    const adminDetail = await adminResource(detailPath);
    assert.equal(adminDetail.id, learnerId); assert.equal(adminDetail.created_at, beforeAdminDetailAccount.createdAt.toISOString());
    assert.deepEqual(adminDetail.roles, ['instructor', 'learner']);
    assert.equal(Object.hasOwn(adminDetail, 'learning_eligible'), false);
    adminDetailChecks.push('actual-admin-resource-canonical-bounded-identity-detail');
    const adminSelf = await adminResource('admin/users/' + encodeURIComponent(adminId));
    const otherInstructor = await adminResource('admin/users/' + encodeURIComponent(accountId));
    assert.deepEqual(adminSelf.roles, ['admin']); assert.deepEqual(adminSelf.profile, {}); assert.deepEqual(adminSelf.auth_methods, []);
    assert.equal(adminSelf.email, null); assert.equal(adminSelf.username, null); assert.deepEqual(otherInstructor.roles, ['instructor']);
    adminDetailChecks.push('self-and-other-role-details-nullable-unlinked-fields');
    assert.deepEqual(adminDetail.profile, grantResult.user.profile); assert.deepEqual(adminDetail.auth_methods, grantResult.user.auth_methods);
    assert.deepEqual(adminDetail.roles, grantResult.user.roles);
    adminDetailChecks.push('normalized-grant-to-detail-consistency');
    const longInterests = Array.from({ length: 31 }, (_, i) => 'หัวข้อ ' + i);
    try {
      await db.account.update({ where: { id: learnerId }, data: { profileJson: JSON.stringify({ interests: longInterests }) } });
      const stored = await db.account.findUniqueOrThrow({ where: { id: learnerId } });
      assert.deepEqual((await adminResource(detailPath)).profile.interests, longInterests);
      assert.deepEqual(await db.account.findUniqueOrThrow({ where: { id: learnerId } }), stored);
      adminDetailChecks.push('Admin-inline-profile-array-limit-does-not-inherit-CurrentUser-cap');
    } finally { await db.account.update({ where: { id: learnerId }, data: { profileJson: beforeAdminDetailAccount.profileJson } }); }
    await assert.rejects(wrongResource(detailPath), error => error instanceof HttpClientError && error.status === 403);
    adminDetailChecks.push('wrong-admin-namespace403');
    await assert.rejects(nonAdminResource(detailPath), error => error instanceof HttpClientError && error.status === 403);
    adminDetailChecks.push('nonadmin-normalized-proof403');
    await assert.rejects(adminResource('admin/users/unknown'), error => error instanceof HttpClientError && error.status === 404);
    adminDetailChecks.push('unknown404');
    await assert.rejects(anonymousResource(detailPath), error => error instanceof HttpClientError && error.status === 401);
    adminDetailChecks.push('anonymous401');
    await db.$disconnect(); await db.$connect();
    for (const result of await Promise.all([adminResource(detailPath), adminResource(detailPath)])) assert.deepEqual(result, adminDetail);
    assert.deepEqual(await counts(), beforeAdminDetailCounts);
    assert.deepEqual(await db.account.findUniqueOrThrow({ where: { id: learnerId } }), beforeAdminDetailAccount);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } }), originalEnrollment);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    adminDetailChecks.push('reconnect-all-model-identity-and-academic-preservation');
    phase = 'frontend-profile-patch';
    const profilePatchChecks = [];
    const academicBeforePatch = await attemptRows(), sessionsBeforePatch = await profileSessions();
    const patched = await ownAuth.updateProfile({ display_name: 'ชื่อแก้ผ่าน API จริง', profile: { bio: null, interests: [], learningGoals: ['เรียนต่อ'] }, avatar_url: null });
    assert.equal(patched.display_name, 'ชื่อแก้ผ่าน API จริง'); assert.equal(patched.avatar_url, null);
    assert.deepEqual(patched.profile, { bio: '', interests: [], learningGoals: ['เรียนต่อ'] });
    assert.equal(JSON.parse((await db.account.findUniqueOrThrow({ where: { id: learnerId } })).profileJson).internalAudit, 'PRIVATE_AUDIT');
    profilePatchChecks.push('actual-frontend-profile-update-and-canonical-decoder');
    await db.$disconnect(); await db.$connect(); assert.deepEqual(await ownAuth.me(), patched);
    profilePatchChecks.push('persistence-reconnect-omission-null-array-semantics');
    await assert.rejects(ownAuth.updateProfile({ roles: ['admin'] }), error => error instanceof HttpClientError && error.status === 422);
    profilePatchChecks.push('forged-role422');
    await assert.rejects((await authApiFor('certificate-guest')).updateProfile({}), error => error instanceof HttpClientError && error.status === 401);
    profilePatchChecks.push('anonymous401');
    assert.deepEqual(await attemptRows(), academicBeforePatch); assert.deepEqual(await profileSessions(), sessionsBeforePatch);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    profilePatchChecks.push('credential-session-academic-history-preserved');

    phase = 'frontend-managed-attempt-read';
    const managedAttemptChecks = [], managedPath = 'instructor/attempts/' + encodeURIComponent(attemptFixtures.graded.id);
    const beforeManagedRows = await attemptRows(), beforeManagedCounts = await counts();
    const managed = await ownerResource(managedPath);
    assert.equal(managed.user_id, learnerId); assert.equal(managed.learner_display_name, patched.display_name);
    assert.equal(managed.item_id, quizItem.id); assert.equal(managed.max, 10); assert.equal(managed.earned, 8);
    assert.deepEqual(managed.grades, { historical_question: { score: 8, comment: 'ความคิดเห็นจากผู้สอน' } });
    assert.equal(JSON.stringify(managed).includes('PRIVATE_'), false);
    managedAttemptChecks.push('actual-owner-resource-and-management-decoder-historical-snapshot');
    await assert.rejects(foreignResource(managedPath), error => error instanceof HttpClientError && error.status === 404);
    managedAttemptChecks.push('enrolled-foreign-instructor404');
    await assert.rejects(adminResource(managedPath), error => error instanceof HttpClientError && error.status === 401);
    managedAttemptChecks.push('Admin-session-cannot-grade');
    await assert.rejects(ownerResource('instructor/attempts/unknown'), error => error instanceof HttpClientError && error.status === 404);
    managedAttemptChecks.push('unknown404');
    await db.$disconnect(); await db.$connect(); assert.deepEqual(await ownerResource(managedPath), managed);
    assert.deepEqual(await attemptRows(), beforeManagedRows); assert.deepEqual(await counts(), beforeManagedCounts);
    managedAttemptChecks.push('reconnect-no-academic-or-identity-writes');

    phase = 'frontend-code-issue-redeem';
    const codeCommandChecks = [];
    const issued = await adminCodes.create(paid.id, 2); assert.equal(issued.length, 2); assert.notEqual(issued[0].code, issued[1].code);
    for (const item of issued) { const row = await db.redeemCode.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(row.issuedBy, adminId); assert.equal(row.usedBy, null); assert.equal(row.status, 'unused'); }
    codeCommandChecks.push('actual-admin-code-issue-client-and-durable-audit');
    const redeemed = await ownPayments.redeem(issued[0].code);
    assert.equal(redeemed.already_enrolled, true); assert.equal(redeemed.enrollment.id, grant.enrollment.id);
    assert.equal((await db.redeemCode.findUniqueOrThrow({ where: { id: issued[0].id } })).status, 'unused');
    codeCommandChecks.push('already-enrolled-preserves-new-code-and-original-source');
    phase = 'frontend-fresh-public-redeem';
    const freshPaid = await db.course.create({ data: { slug: tag + '_paid_public_redeem', title: tag, category: 'test', level: 'test',
      instructorId: accountId, status: 'published', publishedAt: new Date(), priceMinor: 12000 } });
    const freshCodes = await adminCodes.create(freshPaid.id, 1), publicGrant = await ownPayments.redeem(freshCodes[0].code);
    assert.equal(publicGrant.already_enrolled, false); assert.equal(publicGrant.enrollment.source, 'redeem');
    assert.equal((await db.redeemCode.findUniqueOrThrow({ where: { id: freshCodes[0].id } })).enrollmentId, publicGrant.enrollment.id);
    codeCommandChecks.push('actual-web-redeem-client-and-durable-one-use-grant');
    await assert.rejects(ownPayments.redeem(freshCodes[0].code), error => error instanceof HttpClientError && error.status === 404);
    codeCommandChecks.push('used-code404');
    await assert.rejects(wrongAppCodes.create(freshPaid.id, 1), error => error instanceof HttpClientError && error.status === 403);
    await assert.rejects(anonymousCodes.create(freshPaid.id, 1), error => error instanceof HttpClientError && error.status === 401);
    codeCommandChecks.push('wrong-namespace-and-anonymous-issue-denied');
    await db.course.update({ where: { id: freshPaid.id }, data: { priceMinor: null } });
    await assert.rejects(adminCodes.create(freshPaid.id, 1), error => error instanceof HttpClientError && error.status === 409);
    codeCommandChecks.push('free-course-issue409');
    await db.$disconnect(); await db.$connect();
    assert.equal((await db.enrollment.findUniqueOrThrow({ where: { id: publicGrant.enrollment.id } })).accountId, learnerId);
    assert.equal(await db.payment.count({ where: { courseId: freshPaid.id } }), 0);
    codeCommandChecks.push('reconnect-no-synthetic-payment');

    phase = 'frontend-continuation-public-and-owned-lists';
    const continuationChecks = [];
    const continuationHttp = createHttpClient({ baseUrl: `http://127.0.0.1:${port}/api/v1`, credentials:'omit', timeoutMs:5000,
      headers:{'x-melearn-app':'web',Cookie:`melearn_web_session=${sessions.learner}`},fetcher:globalThis.fetch.bind(globalThis) });
    const continuationCatalog = createCatalogApi(continuationHttp);
    globalThis[learningClientSlot].set('continuation-learner',continuationHttp);
    const continuationLearning = await learningApiFor('continuation-learner');
    await db.course.update({where:{id:ids.published},data:{status:'published',category:tag}});
    await db.course.update({where:{id:freshPaid.id},data:{category:tag}});
    // Earlier component deliberately proved malformed published detail ->500.
    // Keep that fixture outside this valid Instructor-detail page projection.
    await db.course.update({where:{id:ids.corrupt},data:{status:'draft',publishedAt:null}});
    const catalogFirst = await continuationCatalog.listCourses({category:tag,limit:1});
    const catalogSecond = await continuationCatalog.listCourses({category:tag,limit:1,cursor:catalogFirst.next_cursor});
    assert.equal(catalogFirst.items.length,1);assert.equal(catalogSecond.items.length,1);
    assert.notEqual(catalogFirst.items[0].id,catalogSecond.items[0].id);
    continuationChecks.push('actual-Catalog-client-keyset-pagination-and-decoder');
    await assert.rejects(continuationCatalog.listCourses({category:tag,limit:2,cursor:catalogFirst.next_cursor}),error=>error instanceof HttpClientError&&error.status===422);
    continuationChecks.push('Catalog-filter-limit-binding422');
    const publicCourses=await ownerResource('instructors/'+encodeURIComponent(accountId)+'/courses?limit=50');
    assert.ok(publicCourses.items.some(row=>row.id===ids.published&&Array.isArray(row.outline)&&Array.isArray(row.outcomes)));
    continuationChecks.push('actual-public-Instructor-page-resource-full-CourseDetail-shape');
    const ownEnrollments=await continuationLearning.myEnrollments();
    assert.ok(ownEnrollments.some(row=>row.enrollment.id===firstGrant.id&&row.progress.completed_items===0));
    assert.equal(ownEnrollments.some(row=>row.enrollment.id===publicGrant.enrollment.id),true);
    continuationChecks.push('actual-learning-owned-list-and-current-progress-decoder');
    assert.deepEqual(await ownCertificateApi.list(),[expectedCertificate]);
    assert.deepEqual(await (await certificateApiFor('certificate-admin')).list(),[]);
    continuationChecks.push('actual-Certificate-list-historical-owner-snapshots');
    const maskedCodes=await adminCodes.codes();
    assert.ok(maskedCodes.some(row=>row.id===freshCodes[0].id&&row.status==='used'&&row.used_by===learnerId));
    for(const code of [...issued,...freshCodes])assert.equal(JSON.stringify(maskedCodes).includes(code.code),false);
    continuationChecks.push('actual-Admin-Redeem-list-mask-and-durable-used-audit');
    await assert.rejects(anonymousCodes.codes(),error=>error instanceof HttpClientError&&error.status===401);
    continuationChecks.push('anonymous-protected-list401');
    const managedSummary=await ownerResource('instructor/summary'),adminSummary=await adminResource('admin/summary');
    assert.equal(managedSummary.course_count,await db.course.count({where:{instructorId:accountId}}));
    assert.equal(adminSummary.user_count,await db.account.count());assert.equal('user_count' in managedSummary,false);
    continuationChecks.push('actual-management-summary-decoders-and-scope-counts');
    const continuationResume=await continuationLearning.resume(videoItem.id,18);
    assert.equal(continuationResume.resume.position_seconds,18);
    assert.equal((await continuationLearning.course(ids.published)).resume_item_id,videoItem.id);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({where:{id:firstGrant.id}}),originalEnrollment);
    continuationChecks.push('actual-resume-client-and-unchanged-completion-history');
    await db.$disconnect();await db.$connect();
    assert.equal((await continuationLearning.course(ids.published)).outline[0].items.find(row=>row.id===videoItem.id).resume.position_seconds,18);
    continuationChecks.push('resume-read-back-after-reconnect');

    phase = 'frontend-continuation-ai-history';
    const aiHistoryChecks=[];
    const newChat=await ownAi.createConversation(null);
    assert.equal(newChat.title,'แชตใหม่');assert.equal(newChat.course_id,null);
    aiHistoryChecks.push('actual-AI-create-client-and-persisted-owner');
    const wireAt=new Date().toISOString();
    const newMessage=await db.aIMessage.create({data:{accountId:learnerId,conversationId:newChat.id,position:0,role:'assistant',content:tag+' searchable answer',
      contextSnapshot:{private:'PRIVATE_HISTORY_CONTEXT',_wire:{version:1,request_id:tag+'_history',kind:'text',status:'succeeded',completed_at:wireAt,error_code:null}}}});
    const historyPage=await ownAi.conversations('searchable answer');
    assert.deepEqual(historyPage.items.map(row=>row.id),[newChat.id]);
    aiHistoryChecks.push('actual-AI-search-own-messages-and-conversation-decoder');
    const messagePage=await ownAi.messages(newChat.id);assert.equal(messagePage.items[0].id,newMessage.id);
    assert.equal(JSON.stringify(messagePage).includes('PRIVATE_'),false);
    aiHistoryChecks.push('actual-AI-message-history-wire-decoder-and-private-projection');
    await assert.rejects((await aiApiFor('certificate-admin')).messages(newChat.id),error=>error instanceof HttpClientError&&error.status===404);
    await assert.rejects((await aiApiFor('certificate-foreign')).deleteConversation(newChat.id),error=>error instanceof HttpClientError&&error.status===404);
    aiHistoryChecks.push('foreign-Admin-history-and-foreign-delete404');
    const beforeDeleteQuota=await db.aIUsageDaily.findMany({where:{accountId:learnerId}});
    assert.equal(await ownAi.deleteConversation(newChat.id),undefined);assert.equal(await ownAi.deleteConversation(newChat.id),undefined);
    assert.ok((await db.aIConversation.findUniqueOrThrow({where:{id:newChat.id}})).deletedAt);
    assert.equal((await ownAi.conversations('searchable answer')).items.length,0);
    await assert.rejects(ownAi.messages(newChat.id),error=>error instanceof HttpClientError&&error.status===404);
    assert.deepEqual(await db.aIUsageDaily.findMany({where:{accountId:learnerId}}),beforeDeleteQuota);
    aiHistoryChecks.push('actual-AI-delete-repeat204-tombstone-without-quota-refund');

    phase = 'frontend-Admin-account-create-and-directories';
    const accountDirectoryChecks=[];
    const adminCreatedInput={username:'new_'+randomUUID().replaceAll('-','').slice(0,20),password:'FixturePassword_123',display_name:tag+' new account'};
    const adminCreated=await adminResource('admin/users','POST',adminCreatedInput);additionalFixtureAccounts.push(adminCreated.user.id);
    assert.deepEqual(adminCreated.user.roles,['learner']);assert.equal(adminCreated.user.learning_eligible,true);
    assert.equal(adminCreated.user.email,null);assert.equal(adminCreated.created_by,adminId);
    assert.equal((await db.localCredential.findUniqueOrThrow({where:{accountId:adminCreated.user.id}})).passwordHash.includes(adminCreatedInput.password),false);
    accountDirectoryChecks.push('actual-Admin-create-resource-and-canonical-CurrentUser-decoder');
    const accountDirectory=await adminResource('admin/users?q='+encodeURIComponent(adminCreatedInput.username)+'&limit=1');
    assert.deepEqual(accountDirectory.items.map(row=>row.id),[adminCreated.user.id]);
    assert.equal(JSON.stringify(accountDirectory).includes('FixturePassword'),false);
    accountDirectoryChecks.push('actual-Admin-user-search-directory-decoder');
    const addedInstructor=await adminResource('admin/users/'+encodeURIComponent(adminCreated.user.id)+'/instructor','POST',{});
    assert.ok(addedInstructor.user.roles.includes('instructor'));
    const instructorDirectory=await adminResource('admin/instructors?limit=50');
    assert.ok(instructorDirectory.items.some(row=>row.id===adminCreated.user.id));
    assert.deepEqual(Object.keys(instructorDirectory.items.find(row=>row.id===adminCreated.user.id)).sort(),['avatar_url','display_name','id']);
    accountDirectoryChecks.push('actual-Admin-Instructor-grant-to-directory-canonical-projection');
    await assert.rejects(adminResource('admin/users','POST',adminCreatedInput),error=>error instanceof HttpClientError&&error.status===409);
    accountDirectoryChecks.push('duplicate-create409-without-extra-user');
    await assert.rejects(anonymousResource('admin/users'),error=>error instanceof HttpClientError&&error.status===401);
    await assert.rejects(anonymousResource('admin/instructors'),error=>error instanceof HttpClientError&&error.status===401);
    accountDirectoryChecks.push('anonymous-directory401');
    await db.$disconnect();await db.$connect();
    assert.equal((await adminResource('admin/users/'+encodeURIComponent(adminCreated.user.id))).id,adminCreated.user.id);
    assert.equal(await db.appSession.count({where:{accountId:adminCreated.user.id}}),0);
    accountDirectoryChecks.push('created-identity-reconnect-and-no-auto-session');

    phase = 'frontend-real-completion-certificate';
    const completionChecks=[];
    const completionCourse=await db.course.create({data:{slug:tag+'_completion',title:'คอร์สจบผ่าน API',category:'test',level:'test',
      instructorId:accountId,status:'published',publishedAt:new Date(),chapters:{create:{title:'บท',position:0,
        items:{create:[{title:'Video',type:'video',position:0},{title:'Article',type:'article',position:1}]}}}},
      include:{chapters:{include:{items:{orderBy:{position:'asc'}}}}}});
    const completionGrant=await continuationCatalog.enrollFree(completionCourse.id);
    const completionVideo=completionCourse.chapters[0].items[0].id,completionArticle=completionCourse.chapters[0].items[1].id;
    const completeApi=await learningApiFor('continuation-learner');
    const completedVideo=await completeApi.complete(completionVideo);
    assert.equal(completedVideo.progress.completed_items,1);assert.equal(completedVideo.progress.total_items,2);assert.equal(completedVideo.certificate_id,null);
    completionChecks.push('actual-learning-client-first-item-does-not-finish-course');
    const completedArticle=await completeApi.complete(completionArticle);
    assert.equal(completedArticle.progress.completed_items,2);assert.ok(completedArticle.certificate_id);assert.equal(completedArticle.course_completed_at,completedArticle.progress.completed_at);
    completionChecks.push('actual-learning-client-last-item-atomic-certificate');
    assert.deepEqual(await completeApi.complete(completionArticle),completedArticle);
    assert.equal(await db.certificate.count({where:{enrollmentId:completionGrant.id}}),1);
    completionChecks.push('repeat-completion-preserves-first-time-and-certificate');
    const completedCourseRead=await completeApi.course(completionCourse.id);
    assert.equal(completedCourseRead.certificate_id,completedArticle.certificate_id);assert.equal(completedCourseRead.progress.completed_items,2);
    const actualIssuedCertificate=await certificateApiFor('certificate-owner');
    const actualCertificate=await actualIssuedCertificate.get(completedArticle.certificate_id);
    assert.equal(actualCertificate.course_title,completionCourse.title);
    completionChecks.push('actual-learning-and-certificate-read-decoders-see-issued-record');
    globalThis[learningClientSlot].set('completion-owner',ownerUploadClient);
    await assert.rejects((await learningApiFor('completion-owner')).complete(completionVideo),error=>error instanceof HttpClientError&&error.status===403);
    completionChecks.push('owner-preview-cannot-create-progress');
    await db.$disconnect();await db.$connect();
    assert.deepEqual(await completeApi.complete(completionArticle),completedArticle);
    completionChecks.push('completion-snapshot-and-certificate-survive-reconnect');

    phase = 'frontend-course-create-directory-authoring';
    const courseAuthoringChecks=[];
    // Keep deliberately unknown legacy audits outside this valid Draft page.
    // Their fail-closed behavior is checked by dedicated PostgreSQL tests.
    await db.course.updateMany({where:{instructorId:accountId,status:'draft',createdBy:null},data:{status:'archived'}});
    const createdCourse=await ownerResource('instructor/courses','POST',{title:tag+' owned authoring',category:'test',level:'test'});
    assert.equal(createdCourse.created_by,accountId);assert.equal(createdCourse.instructor.id,accountId);assert.equal(createdCourse.revision,1);assert.equal(createdCourse.status,'draft');
    courseAuthoringChecks.push('actual-Instructor-create-resource-canonical-authoring-decoder');
    const adminCourse=await adminResource('admin/courses','POST',{title:tag+' Admin authoring',instructor_id:accountId,category:'test',level:'test'});
    assert.equal(adminCourse.created_by,adminId);assert.equal(adminCourse.instructor.id,accountId);
    courseAuthoringChecks.push('actual-Admin-create-resource-distinct-creator-and-Instructor');
    const ownedCoursePage=await ownerResource('instructor/courses?status=draft&limit=1');
    const ownedCourseNext=await ownerResource('instructor/courses?status=draft&limit=1&cursor='+encodeURIComponent(ownedCoursePage.next_cursor));
    assert.notEqual(ownedCoursePage.items[0].id,ownedCourseNext.items[0].id);
    courseAuthoringChecks.push('actual-owned-Course-list-keyset-and-management-decoder');
    const adminCoursePage=await adminResource('admin/courses?status=draft&limit=50');
    assert.deepEqual(new Set(adminCoursePage.items.map(c=>c.id)),new Set([createdCourse.id,adminCourse.id]));
    courseAuthoringChecks.push('actual-Admin-directory-decoder-and-Draft-filter');
    const authoringChapter=await db.courseChapter.create({data:{courseId:createdCourse.id,title:'บทที่บันทึกจริง',position:0,description:'คำอธิบายบท'}});
    const authoringArticle=await db.courseItem.create({data:{courseId:createdCourse.id,chapterId:authoringChapter.id,title:'บทอ่านจริง',type:'article',position:0,
      body:'เนื้อหาจริงจาก PostgreSQL',contentDoc:{type:'doc',content:[{type:'paragraph',text:'ย่อหน้า'}]}}});
    const fullAuthoring=await ownerResource('courses/'+encodeURIComponent(createdCourse.id)+'/authoring');
    assert.equal(fullAuthoring.chapters[0].items[0].body,'เนื้อหาจริงจาก PostgreSQL');
    assert.equal(authoringForm(fullAuthoring).course.chapters[0].items[0].id,authoringArticle.id);
    courseAuthoringChecks.push('actual-authoring-resource-and-shared-form-from-persisted-content');
    const authoringPreview=await ownerResource('courses/'+encodeURIComponent(createdCourse.id)+'/authoring-preview');
    assert.equal(authoringPreview.chapters[0].items[0].body,'เนื้อหาจริงจาก PostgreSQL');assert.equal(JSON.stringify(authoringPreview).includes('correct_option_ids'),false);
    courseAuthoringChecks.push('actual-Preview-decoder-without-authoring-answer-keys');
    assert.equal((await adminResource('courses/'+encodeURIComponent(createdCourse.id)+'/authoring')).id,createdCourse.id);
    courseAuthoringChecks.push('actual-Admin-authoring-read-without-enrollment');
    await assert.rejects(foreignResource('courses/'+encodeURIComponent(createdCourse.id)+'/authoring'),error=>error instanceof HttpClientError&&error.status===404);
    courseAuthoringChecks.push('enrolled-foreign-Instructor-cannot-read-authoring');
    await db.$disconnect();await db.$connect();
    assert.equal((await ownerResource('courses/'+encodeURIComponent(createdCourse.id)+'/authoring')).chapters[0].items[0].body,'เนื้อหาจริงจาก PostgreSQL');
    courseAuthoringChecks.push('created-course-audit-and-content-survive-reconnect');

    phase = 'frontend-authoring-review-lifecycle';
    const authoringReviewChecks=[],coursePath='courses/'+encodeURIComponent(createdCourse.id);
    const existingForm=authoringForm(fullAuthoring);
    existingForm.course.chapters.push({id:'draft-'+randomUUID(),title:'บทใหม่',items:[{id:'draft-'+randomUUID(),type:'article',title:'บทอ่านใหม่',articleBody:'เนื้อหาจาก Editor'}]});
    const written=await ownerResource(coursePath,'PATCH',{expected_revision:fullAuthoring.revision,chapters:authoringWrite(existingForm.course,existingForm.quizzes,fullAuthoring)});
    assert.equal(written.revision,2);assert.equal(written.chapters[0].items[0].id,authoringArticle.id);assert.equal(written.chapters[1].items[0].body,'เนื้อหาจาก Editor');
    assert.equal(written.chapters[1].id.startsWith('draft-'),false);
    authoringReviewChecks.push('actual-pure-Frontend-authoringWrite-and-resource-preserve-server-IDs');
    const submittedReview=await ownerResource(coursePath+'/submit-review','POST',{expected_revision:2});
    assert.equal(submittedReview.status,'pending');assert.equal(submittedReview.revision,2);
    authoringReviewChecks.push('actual-owner-submit-client-canonical-review');
    const reviewQueue=await adminResource('admin/course-reviews?status=pending&limit=50');
    assert.ok(reviewQueue.items.some(review=>review.id===submittedReview.id));
    const reviewDetail=await adminResource('admin/course-reviews/'+submittedReview.id);
    assert.equal(reviewDetail.course.revision,2);assert.equal(reviewDetail.course.chapters[1].items[0].body,'เนื้อหาจาก Editor');
    authoringReviewChecks.push('actual-Admin-review-queue-and-full-submitted-detail-decoders');
    const returnedReview=await adminResource('admin/course-reviews/'+submittedReview.id+'/return','POST',{reason:'เพิ่มคำอธิบาย'});
    assert.equal(returnedReview.status,'returned');assert.equal(returnedReview.reason,'เพิ่มคำอธิบาย');
    authoringReviewChecks.push('actual-Admin-return-reason-client-and-Draft-transition');
    const newReview=await ownerResource(coursePath+'/submit-review','POST',{expected_revision:2});assert.notEqual(newReview.id,submittedReview.id);
    const approvedReview=await adminResource('admin/course-reviews/'+newReview.id+'/approve','POST',{expected_revision:2});assert.equal(approvedReview.status,'approved');
    authoringReviewChecks.push('actual-resubmit-and-Admin-approve-current-revision');
    const firstPublished=await ownerResource(coursePath+'/publish','POST',{});
    assert.equal(firstPublished.status,'published');assert.equal(firstPublished.chapters[1].items[0].body,'เนื้อหาจาก Editor');
    authoringReviewChecks.push('actual-owner-publication-full-authoring-response-decoder');
    const publicationSave=await ownerResource(coursePath,'PATCH',{expected_revision:2,title:'แก้ Published ผ่าน API จริง'});
    assert.equal(publicationSave.status,'published');assert.equal(publicationSave.published_at,firstPublished.published_at);
    const publicWritten=await createCatalogApi(createHttpClient({baseUrl:globalThis[learningClientSlot].apiConfig.baseUrl,headers:{},credentials:'omit',timeoutMs:5000,fetcher:fetch})).getCourse(createdCourse.id);
    assert.equal(publicWritten.title,'แก้ Published ผ่าน API จริง');
    authoringReviewChecks.push('Published-save-visible-through-real-public-Catalog-client');
    await assert.rejects(ownerResource(coursePath,'PATCH',{expected_revision:2,title:'stale'}),error=>error instanceof HttpClientError&&error.status===409);
    await db.$disconnect();await db.$connect();assert.equal((await adminResource('admin/course-reviews/'+submittedReview.id)).course.title,createdCourse.title);
    assert.equal((await ownerResource(coursePath+'/authoring')).title,'แก้ Published ผ่าน API จริง');
    authoringReviewChecks.push('stale-revision-rejected-and-original-submitted-snapshot-survives-reconnect');

    phase = 'frontend-blog-lifecycle';
    const blogChecks=[],blogSlug='article-'+randomUUID();
    globalThis[learningClientSlot].set('blog-public',createHttpClient({baseUrl:globalThis[learningClientSlot].apiConfig.baseUrl,
      headers:{},credentials:'omit',timeoutMs:5000,fetcher:fetch}));
    const {blogApi}=await import(pathToFileURL(path.join(frontend,'apps/web/src/features/blog/api/blog-api.ts')).href+'?learning-actor=blog-public');
    const blogDraft=await adminResource('admin/blog','POST',{title:'บทความที่บันทึกจริง',slug:blogSlug,category:'test',cover_url:null,excerpt:'คำเกริ่น',
      content:'เนื้อหาแรก',content_doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'ย่อหน้าแรก'}]}]}});
    assert.equal(blogDraft.author_id,adminId);assert.equal(blogDraft.status,'draft');assert.equal((await adminResource('admin/blog/'+blogDraft.id+'/preview')).content,'เนื้อหาแรก');
    blogChecks.push('actual-Admin-create-and-preview-decoders-preserve-rich-Draft');
    await assert.rejects(blogApi.detail(blogSlug),error=>error instanceof HttpClientError&&error.status===404);
    blogChecks.push('actual-public-client-cannot-read-Draft');
    const publishedBlog=await adminResource('admin/blog/'+blogDraft.id+'/publish','POST',{expected_revision:1});
    assert.equal(publishedBlog.status,'published');assert.equal((await blogApi.detail(blogSlug)).id,blogDraft.id);
    assert.ok((await blogApi.list()).some(post=>post.id===blogDraft.id));
    blogChecks.push('actual-Guest-Blog-list-and-detail-read-saved-Published-content');
    const savedBlog=await adminResource('admin/blog/'+blogDraft.id,'PATCH',{expected_revision:2,content:'เนื้อหาที่แก้แล้ว'});
    assert.equal((await blogApi.detail(blogSlug)).content,'เนื้อหาที่แก้แล้ว');assert.equal(savedBlog.published_at,publishedBlog.published_at);
    blogChecks.push('actual-Published-save-is-immediate-and-preserves-publication');
    await assert.rejects(adminResource('admin/blog/'+blogDraft.id,'PATCH',{expected_revision:2,content:'stale'}),error=>error instanceof HttpClientError&&error.status===409);
    assert.equal((await adminResource('admin/blog/'+blogDraft.id+'/preview')).revision,3);
    blogChecks.push('stale-revision409-keeps-saved-ID-and-content');
    await adminResource('admin/blog/'+blogDraft.id+'/unpublish','POST',{expected_revision:3});
    await assert.rejects(blogApi.detail(blogSlug),error=>error instanceof HttpClientError&&error.status===404);
    blogChecks.push('actual-Admin-unpublish-hides-public-content');
    assert.deepEqual(await adminResource('admin/blog/'+blogDraft.id,'DELETE',{expected_revision:4}),{id:blogDraft.id,deleted:true});
    await assert.rejects(adminResource('admin/blog/'+blogDraft.id+'/preview'),error=>error instanceof HttpClientError&&error.status===404);
    assert.equal((await db.blogPost.findUniqueOrThrow({where:{id:blogDraft.id}})).deletedBy,adminId);
    blogChecks.push('actual-DELETE-JSON-precondition-retains-audit-and-hides-preview');
    await assert.rejects(ownerResource('admin/blog'),error=>error instanceof HttpClientError&&error.status===401);
    blogChecks.push('Instructor-Web-cannot-manage-Blog');
    await db.$disconnect();await db.$connect();assert.equal((await db.blogPost.findUniqueOrThrow({where:{id:blogDraft.id}})).content,'เนื้อหาที่แก้แล้ว');
    blogChecks.push('Blog-content-and-deletion-audit-survive-reconnect');

    phase = 'frontend-management-history';
    const historyChecks = [];
    const rosterPath='courses/'+encodeURIComponent(ids.published)+'/learners';
    const attemptListPath='courses/'+encodeURIComponent(ids.published)+'/attempts';
    // The earlier single-detail corruption proof intentionally owns a malformed fixture.
    // Remove only that fixture after asserting fail-closed list behavior; no API repairs it.
    await assert.rejects(ownerResource(attemptListPath),error=>error instanceof HttpClientError&&error.status===500);
    await db.answer.deleteMany({where:{attemptId:attemptFixtures.bad.id}});
    await db.attemptQuestion.deleteMany({where:{attemptId:attemptFixtures.bad.id}});
    await db.quizAttempt.delete({where:{id:attemptFixtures.bad.id}});
    delete attemptFixtures.bad;
    const beforeHistoryCounts=await counts(),beforeHistoryRows=await attemptRows();
    const rosterPage=await ownerResource(rosterPath+'?limit=50');
    assert.ok(rosterPage.items.some(row=>row.user_id===learnerId&&row.course_id===ids.published));
    assert.equal(JSON.stringify(rosterPage).includes('PRIVATE_'),false);
    historyChecks.push('actual-owner-course-roster-archived-history-canonical-decoder');
    assert.deepEqual(await adminResource(rosterPath+'?limit=50'),rosterPage);
    const accountEnrollments=await adminResource('admin/users/'+encodeURIComponent(learnerId)+'/enrollments?limit=50');
    assert.ok(accountEnrollments.items.some(row=>row.course_id===ids.published));
    historyChecks.push('actual-Admin-course-and-account-enrollments');
    const instructorLearners=await ownerResource('instructor/learners?limit=50');
    assert.ok(instructorLearners.items.some(row=>row.user_id===learnerId&&row.course_id===ids.published));
    historyChecks.push('actual-Instructor-learners-per-Enrollment');
    const allLearners=await adminResource('admin/learners?limit=50');
    assert.ok(allLearners.items.some(row=>row.user_id===learnerId&&row.course_id===ids.published));
    historyChecks.push('actual-Admin-learners-directory');
    const attemptsPage=await ownerResource(attemptListPath+'?limit=50');
    assert.deepEqual(attemptsPage.items.find(row=>row.id===managed.id),managed);
    assert.equal(JSON.stringify(attemptsPage).includes('PRIVATE_'),false);
    historyChecks.push('actual-owner-course-Attempt-list-historical-snapshot-no-keys');
    const accountAttempts=await adminResource('admin/users/'+encodeURIComponent(learnerId)+'/attempts?limit=50');
    assert.deepEqual(accountAttempts.items.find(row=>row.id===managed.id),managed);
    historyChecks.push('actual-Admin-account-Attempt-list');
    await assert.rejects(foreignResource(rosterPath),error=>error instanceof HttpClientError&&error.status===404);
    await assert.rejects(ownerResource('admin/learners'),error=>error instanceof HttpClientError&&error.status===401);
    const firstHistoryPage=await ownerResource(attemptListPath+'?limit=1');
    assert.ok(firstHistoryPage.next_cursor);
    const nextHistoryPage=await ownerResource(attemptListPath+'?limit=1&cursor='+encodeURIComponent(firstHistoryPage.next_cursor));
    assert.notEqual(firstHistoryPage.items[0].id,nextHistoryPage.items[0].id);
    await assert.rejects(adminResource('admin/users/'+encodeURIComponent(learnerId)+'/attempts?limit=1&cursor='+encodeURIComponent(firstHistoryPage.next_cursor)),error=>error instanceof HttpClientError&&error.status===422);
    historyChecks.push('ownership-namespace-and-signed-resource-cursor-isolation');
    await db.$disconnect();await db.$connect();
    assert.deepEqual(await ownerResource(attemptListPath+'?limit=50'),attemptsPage);
    assert.deepEqual(await counts(),beforeHistoryCounts);assert.deepEqual(await attemptRows(),beforeHistoryRows);
    historyChecks.push('reconnect-preserves-all-academic-model-counts');

    phase = 'frontend-admin-payment-detail';
    const adminPaymentChecks=[];
    const adminPaymentApiFor=async name=>(await import(pathToFileURL(path.join(frontend,
      'apps/admin/src/features/payment/api/admin-payment-api.ts')).href+'?learning-actor='+name)).adminPaymentApi;
    const adminPayments=await adminPaymentApiFor('grant-admin'),beforeAdminPaymentRows=await paymentRows(),beforeAdminPaymentCounts=await counts();
    const adminPending=await adminPayments.get(paymentFixtures.pending.id);
    assert.equal(adminPending.user_id,learnerId);assert.equal(adminPending.status,'pending');assert.equal(adminPending.enrollment,null);
    assert.equal(JSON.stringify(adminPending).includes('PRIVATE_'),false);
    adminPaymentChecks.push('actual-Admin-payment-client-canonical-money-and-private-projection');
    const adminGrant=await adminPayments.get(paymentFixtures.granted.id);
    assert.deepEqual(adminGrant.enrollment,firstGrant);assert.equal(adminGrant.fulfillment_status,'granted');
    adminPaymentChecks.push('Admin-lookup-retains-original-entitlement-source');
    await assert.rejects((await adminPaymentApiFor('locator-owner')).get(paymentFixtures.pending.id),error=>error instanceof HttpClientError&&error.status===401);
    await assert.rejects((await adminPaymentApiFor('grant-anonymous')).get(paymentFixtures.pending.id),error=>error instanceof HttpClientError&&error.status===401);
    await assert.rejects(adminPayments.get(randomUUID()),error=>error instanceof HttpClientError&&error.status===404);
    adminPaymentChecks.push('anonymous-Web-and-unknown-lookup-denied');
    await db.$disconnect();await db.$connect();assert.deepEqual(await adminPayments.get(paymentFixtures.pending.id),adminPending);
    assert.deepEqual(await counts(),beforeAdminPaymentCounts);assert.deepEqual(await paymentRows(),beforeAdminPaymentRows);
    adminPaymentChecks.push('Admin-read-reconnect-never-charges-or-grants');

    phase = 'frontend-assessment-write-grade-completion';
    const assessmentLifecycleChecks=[];
    const assessmentCourse=await ownerResource('instructor/courses','POST',{title:tag+' assessment lifecycle',category:'test',level:'test'});
    const assessmentAuthoring=await ownerResource('courses/'+assessmentCourse.id,'PATCH',{expected_revision:1,chapters:[{title:'Quiz chapter',items:[{type:'quiz',title:'Snapshot Quiz',quiz:{questions:[
      {type:'single_choice',prompt:'Choice',points:3,options:[{text:'A'},{text:'B'}],correct_option_indices:[0]},
      {type:'essay',prompt:'Essay',points:2,response_mode:'either'},
      {type:'image',prompt:'Image evidence',points:0},
    ],pass_percent:70}}]}]});
    const assessmentReview=await ownerResource('courses/'+assessmentCourse.id+'/submit-review','POST',{expected_revision:2});
    await adminResource('admin/course-reviews/'+assessmentReview.id+'/approve','POST',{expected_revision:2});
    await ownerResource('courses/'+assessmentCourse.id+'/publish','POST',{});
    const enrolledAssessment=await createCatalogApi(continuationHttp).enrollFree(assessmentCourse.id);
    const assessmentItem=assessmentAuthoring.chapters[0].items[0],actualLearnerAssessments=await assessmentApiFor('continuation-learner'),actualOwnerAssessments=await assessmentApiFor('locator-owner');
    const startedAssessment=await actualLearnerAssessments.start(assessmentItem.id);
    phase='frontend-assessment-start';
    assert.equal(startedAssessment.max,5);assert.equal(startedAssessment.status,'in_progress');
    assert.equal((await actualLearnerAssessments.start(assessmentItem.id)).id,startedAssessment.id);
    assessmentLifecycleChecks.push('actual-authoring-review-publication-enrollment-and-assessment-Start-clients');
    assert.equal(JSON.stringify(startedAssessment).includes('correct_key'),false);
    const [assessmentChoice,assessmentEssay,assessmentImage]=startedAssessment.questions;
    await assert.rejects(actualLearnerAssessments.submit(startedAssessment.id),error=>error instanceof HttpClientError&&error.status===422);
    const assessmentAnswers={[assessmentChoice.id]:{option_ids:[assessmentChoice.options[0].id]},[assessmentEssay.id]:{text:'Actual answer'},[assessmentImage.id]:{image_url:'https://example.test/answer.png'}};
    await actualLearnerAssessments.saveAnswers(startedAssessment.id,assessmentAnswers);
    const submittedAssessment=await actualLearnerAssessments.submit(startedAssessment.id);
    assert.equal(submittedAssessment.status,'pending_review');assert.equal(submittedAssessment.earned,null);
    assert.deepEqual(await actualLearnerAssessments.submit(startedAssessment.id),submittedAssessment);
    await assert.rejects(actualLearnerAssessments.saveAnswers(startedAssessment.id,assessmentAnswers),error=>error instanceof HttpClientError&&error.status===409);
    assessmentLifecycleChecks.push('actual-Save-Submit-pending-decoder-incomplete422-frozen409-and-submit-replay');
    const actualQueue=await actualOwnerAssessments.gradingQueue();assert.ok(actualQueue.some(row=>row.attempt_id===startedAssessment.id&&row.questions_to_grade.length===2));
    phase='frontend-assessment-queue';
    assert.equal((await ownerResource('instructor/grading-queue')).items.find(row=>row.attempt_id===startedAssessment.id).questions_to_grade[1].max,0);
    await assert.rejects(actualOwnerAssessments.grade(startedAssessment.id,assessmentEssay.id,2.5,null),error=>error instanceof HttpClientError&&error.status===422);
    await assert.rejects((await assessmentApiFor('continuation-learner')).grade(startedAssessment.id,assessmentEssay.id,2,null),error=>error instanceof HttpClientError&&error.status===404);
    assessmentLifecycleChecks.push('actual-owner-grading-queue-zero-point-decoder-overmax-and-foreign-grade-denials');
    await actualOwnerAssessments.grade(startedAssessment.id,assessmentEssay.id,2,'checked');
    const assessmentFinal=await actualOwnerAssessments.grade(startedAssessment.id,assessmentImage.id,0,null);
    phase='frontend-assessment-final-grade';
    assert.equal(assessmentFinal.passed,true);assert.equal(assessmentFinal.percent,100);
    const resourceFinal=await ownerResource('instructor/attempts/'+startedAssessment.id+'/questions/'+assessmentImage.id+'/grade','PUT',{score:0,comment:null});
    assert.equal(resourceFinal.id,assessmentFinal.id);assert.equal(resourceFinal.passed,assessmentFinal.passed);assert.deepEqual(resourceFinal.question_results,assessmentFinal.question_results);
    assessmentLifecycleChecks.push('actual-last-grade-and-canonical-resource-serialize-full-result');
    const assessmentResults=await foreignResource('learn/items/'+assessmentItem.id+'/results');assert.equal(assessmentResults.best.attempt_id,startedAssessment.id);assert.equal(assessmentResults.completed,true);
    phase='frontend-assessment-results';
    const assessmentLearning=await continuationLearning.course(assessmentCourse.id);assert.ok(assessmentLearning.certificate_id);assert.equal(assessmentLearning.progress.completed_items,1);
    const certificateAfterQuiz=await (await certificateApiFor('continuation-learner')).get(assessmentLearning.certificate_id);assert.equal(certificateAfterQuiz.course_title,assessmentCourse.title);
    assessmentLifecycleChecks.push('actual-results-Learning-and-Certificate-clients-see-atomic-last-grade-completion');
    const assessmentSecond=await actualLearnerAssessments.start(assessmentItem.id);assert.equal(assessmentSecond.number,2);
    await actualLearnerAssessments.saveAnswers(assessmentSecond.id,{...assessmentAnswers,[assessmentChoice.id]:{option_ids:[assessmentChoice.options[1].id]}});
    await actualLearnerAssessments.submit(assessmentSecond.id);await actualOwnerAssessments.grade(assessmentSecond.id,assessmentEssay.id,0,null);await actualOwnerAssessments.grade(assessmentSecond.id,assessmentImage.id,0,null);
    assert.equal((await foreignResource('learn/items/'+assessmentItem.id+'/results')).best.attempt_id,startedAssessment.id);
    assert.equal((await continuationLearning.course(assessmentCourse.id)).certificate_id,assessmentLearning.certificate_id);
    assessmentLifecycleChecks.push('actual-retake-lower-score-keeps-best-and-first-Certificate');
    await db.$disconnect();await db.$connect();assert.deepEqual(await actualLearnerAssessments.attempt(startedAssessment.id),assessmentFinal);
    assert.deepEqual(await (await certificateApiFor('continuation-learner')).get(assessmentLearning.certificate_id),certificateAfterQuiz);
    assert.equal((await db.enrollment.findUniqueOrThrow({where:{id:enrolledAssessment.id}})).completedItems,1);
    assessmentLifecycleChecks.push('reconnect-keeps-frozen-attempt-and-Certificate-snapshots');

    phase='frontend-certificate-download';
    const certificateDownloadChecks=[];
    const beforeDownloadRows=await db.certificate.findMany({where:{enrollment:{accountId:learnerId}},orderBy:{id:'asc'}}),beforeDownloadCounts=await counts();
    const downloadedHistorical=await ownCertificateApi.download(historicalCertificate.id);
    assert.equal(downloadedHistorical.content_type,'text/plain');assert.match(downloadedHistorical.filename,/^melearn-certificate-[a-f0-9]{20}\.txt$/);
    assert.ok(downloadedHistorical.content.includes(historicalCertificate.courseName));assert.ok(downloadedHistorical.content.includes(historicalCertificate.recipientName));
    certificateDownloadChecks.push('actual-Certificate-download-client-private-canonical-text-from-original-snapshot');
    assert.deepEqual(await ownCertificateApi.download(historicalCertificate.id),downloadedHistorical);
    certificateDownloadChecks.push('repeat-download-stable-bytes-no-second-issuance');
    await assert.rejects((await certificateApiFor('certificate-foreign')).download(historicalCertificate.id),error=>error instanceof HttpClientError&&error.status===404);
    await assert.rejects((await certificateApiFor('certificate-admin')).download(historicalCertificate.id),error=>error instanceof HttpClientError&&error.status===404);
    await assert.rejects((await certificateApiFor('certificate-guest')).download(historicalCertificate.id),error=>error instanceof HttpClientError&&error.status===401);
    certificateDownloadChecks.push('actual-foreign-Admin-and-Guest-download-denials');
    await db.$disconnect();await db.$connect();assert.deepEqual(await ownCertificateApi.download(historicalCertificate.id),downloadedHistorical);
    assert.deepEqual(await db.certificate.findMany({where:{enrollment:{accountId:learnerId}},orderBy:{id:'asc'}}),beforeDownloadRows);assert.deepEqual(await counts(),beforeDownloadCounts);
    certificateDownloadChecks.push('reconnect-download-preserves-academic-and-all-model-counts');

    phase = 'frontend-current-session-logout';
    const logoutChecks = [];
    await assert.rejects((await authApiFor('certificate-guest')).logout(), error => error instanceof HttpClientError && error.status === 401);
    logoutChecks.push('anonymous401');
    const beforeLogoutCounts = await counts();
    const beforeLogoutAccount = await db.account.findUniqueOrThrow({ where: { id: learnerId } });
    const learnerHash = createHash('sha256').update(sessions.learner).digest('hex').toUpperCase();
    const otherSessions = () => db.appSession.findMany({ where: { accountId: { in: [accountId, learnerId, adminId] }, tokenHash: { not: learnerHash } }, orderBy: { tokenHash: 'asc' } });
    const beforeOtherSessions = await otherSessions();
    assert.equal(await ownAuth.logout(), undefined);
    logoutChecks.push('unchanged-logout-client-bodyless204');
    assert.ok((await db.appSession.findUniqueOrThrow({ where: { tokenHash: learnerHash } })).revokedAt);
    await db.$disconnect(); await db.$connect();
    await assert.rejects(ownAuth.me(), error => error instanceof HttpClientError && error.status === 401);
    logoutChecks.push('durable-revocation-reconnect-me401');
    const revokedSession = await db.appSession.findUniqueOrThrow({ where: { tokenHash: learnerHash } });
    await assert.rejects(ownAuth.logout(), error => error instanceof HttpClientError && error.status === 401);
    assert.deepEqual(await db.appSession.findUniqueOrThrow({ where: { tokenHash: learnerHash } }), revokedSession);
    logoutChecks.push('replay401-without-timestamp-change');
    assert.equal((await (await authApiFor('certificate-admin')).me()).id, adminId);
    assert.equal((await (await authApiFor('certificate-foreign')).me()).id, accountId);
    assert.deepEqual(await otherSessions(), beforeOtherSessions);
    logoutChecks.push('other-account-and-admin-sessions-unchanged');
    assert.deepEqual(await counts(), beforeLogoutCounts);
    assert.deepEqual(await db.account.findUniqueOrThrow({ where: { id: learnerId } }), beforeLogoutAccount);
    assert.deepEqual(await db.enrollment.findUniqueOrThrow({ where: { id: firstGrant.id } }), originalEnrollment);
    assert.deepEqual(await db.certificate.findUniqueOrThrow({ where: { id: historicalCertificate.id } }), historicalCertificate);
    logoutChecks.push('identity-and-academic-history-preserved');
    // Anonymous enroll used the same public fetcher; the final network read
    // brings that fetcher's request count to seven (six Catalog checks + one).
    await stop();
    await assert.rejects(api.getCourse(ids.published), error => error instanceof HttpClientError && error.kind === 'network');
    await assert.rejects(learning.course(ids.published), error => error instanceof HttpClientError && error.kind === 'network');
    await assert.rejects(adminCodes.revoke(unusedCode.id), error => error instanceof HttpClientError && error.kind === 'network');
    await assert.rejects(uploadRequest(ownerUploadClient), error => error instanceof HttpClientError && error.kind === 'network');
    await assert.rejects(ownCertificateApi.get(historicalCertificate.id), error => error instanceof HttpClientError && error.kind === 'network');
    await assert.rejects(sendAnswer(ownAi), error => error instanceof HttpClientError && error.kind === 'network');
    await assert.rejects(ownAi.usage(), error => error instanceof HttpClientError && error.kind === 'network');
    await assert.rejects(ownAi.renameConversation(practiceConversation.id, 'offline'), error => error instanceof HttpClientError && error.kind === 'network');
    await assert.rejects(ownAuth.me(), error => error instanceof HttpClientError && error.kind === 'network');
    profileChecks.push('network-failure-without-mock-fallback');
    await assert.rejects(ownAuth.logout(), error => error instanceof HttpClientError && error.kind === 'network');
    logoutChecks.push('network-failure-without-mock-fallback');
    await assert.rejects(ownPayments.status(paymentFixtures.pending.id), error => error instanceof HttpClientError && error.kind === 'network');
    paymentChecks.push('network-failure-without-mock-fallback');
    await assert.rejects(ownAssessments.attempt(attemptFixtures.graded.id), error => error instanceof HttpClientError && error.kind === 'network');
    attemptChecks.push('network-failure-without-mock-fallback');
    await assert.rejects(adminResource(grantPath, 'POST', {}), error => error instanceof HttpClientError && error.kind === 'network');
    instructorGrantChecks.push('network-failure-without-mock-fallback');
    await assert.rejects(ownerResource(locatorPath), error => error instanceof HttpClientError && error.kind === 'network');
    locatorChecks.push('network-failure-without-mock-fallback');
    await assert.rejects(adminResource(detailPath), error => error instanceof HttpClientError && error.kind === 'network');
    adminDetailChecks.push('network-failure-without-mock-fallback');
    assert.equal(uploadSuccessDecodes, 0);
    assert.equal(learningRequests, 11);
    assert.equal(requests, 7);
    const result = { component: 'INTEGRATION-01 course detail', database: 'melearn_test', checks: 6,
      unchangedFrontendClient: true, actualNestHttp: true, mockFetcher: false,
      publicDetailDecoded: true, hiddenAndUnknown404ToNull: true, savedEditAndReconnect: true,
      server500Surfaced: true, noReadOrStartupWrites: true, networkFailureSurfaced: true,
      browserAcceptance: false, fullFeatureGate: false };
    result.freeEnroll = { component: 'ENROLL-01', checks: 7, unchangedFrontendMutation: true,
      normalizedSessionFixture: true, canonicalDecodeAndPersistence: true, repeatAndConcurrentSameGrant: true,
      ownCourse403: true, paidCourse409: true, anonymous401: true, loginProviderGate: false, browserAcceptance: false };
    result.learningRead = { component: 'LEARN-01 enrolled reads', checks: 11, unchangedFrontendApiAndDecoders: true,
      realTransportWithFixtureConfiguration: true, freeGrantToCourseAndItem: true, noPrivateQuizTranscriptOrProfile: true,
      ownerDenied: true, foreignItemDenied: true, ownResumeAndReconnect: true, safeServerAndNetworkFailure: true,
      noReadWrites: true, actualInternalResumeWriter: true, publicResumeMutationGate: false,
      loginProviderGate: false, browserAcceptance: false };
    result.adminRevoke = { component: 'REDEEM-01 revoke', checks: 7, unchangedFrontendApiAndDecoder: true,
      realTransportWithFixtureConfiguration: true, canonicalRevokeAndPersistence: true, originalAuditOnReplayAndReconnect: true,
      used409: true, unknown404: true, wrongAudience403: true, anonymous401: true, networkFailure: true,
      actualInternalRedeemWriter: true, publicRedeemMutationGate: false, loginProviderGate: false, browserAcceptance: false };
    result.videoUnavailableTransport = { component: 'VIDEO-01', checks: 6, unchangedGenericHttpClient: true,
      actualNestAndPostgres: true, owner503: true, admin503: true, learner403: true, anonymous401: true,
      unknown404: true, networkFailure: true, successDecoderNeverCalled: true, noUploadOrCourseMutation: true,
      frontendAuthoringHandlerGate: false, loginProviderGate: false, browserAcceptance: false };
    result.certificateDetail = { component: 'CERT-01 detail', checks: 7, unchangedFrontendApiAndDecoder: true,
      actualNestAndPostgres: true, historicalFixture: true, ownerProjection: true, foreignInstructor404: true,
      foreignAdmin404: true, anonymous401: true, unknown404: true, renameArchiveAndReconnectPreserveSnapshot: true,
      networkFailure: true, noReadWrites: true, automaticIssueGate: false, downloadGate: false,
      loginProviderGate: false, browserAcceptance: false };
    result.aiPracticeAnswer = { component: 'AI-04', checks: 8, unchangedFrontendApiAndDecoder: true,
      actualNestAndPostgres: true, trustedSnapshotFixture: true, partialAndCompleteSummary: true,
      latestAnswerAndReconnect: true, foreignInstructorAndAdmin404: true, anonymous401: true, foreignOption422: true,
      networkFailure: true, originalDefinitionsTitleAcademicHistoryPreserved: true, noNewQuotaRows: true,
      providerGenerationGate: false, loginProviderGate: false, browserAcceptance: false };
    result.aiUsage = { component: 'AI-03 daily usage read', checks: 7, unchangedFrontendApiAndDecoder: true,
      actualNestAndPostgres: true, ownedAllRolesSameLimit: true, successfulOnlyNoPendingCharge: true,
      anonymous401: true, exhaustedQuotaStillReadable: true, reconnectPreservesCounters: true,
      networkFailure: true, noReadOrAcademicWrites: true, providerReservationGate: false,
      loginProviderGate: false, browserAcceptance: false };
    result.aiRename = { component: 'AI-05 owned rename', checks: 7, unchangedFrontendApiAndDecoder: true,
      actualNestAndPostgres: true, ownerProjectionAndPersistence: true, foreignInstructorAndAdmin404: true,
      anonymous401: true, blank422: true, reconnect: true, networkFailure: true,
      historyQuotaAcademicSnapshotsPreserved: true, deleteRetentionGate: false,
      providerGenerationGate: false, loginProviderGate: false, browserAcceptance: false };
    result.selfProfile = { component: 'ACCOUNT-01 self read', checks: profileChecks.length, checkNames: profileChecks,
      unchangedFrontendApiAndDecoder: true, actualNestAndPostgres: true, normalizedStoredRoles: true,
      exactNullableOwnerProjection: true, savedFixtureReconnect: true, publicProfileWhitelist: true,
      corruptStorageSafe500: true, noReadWrites: true, networkFailure: true,
      profileMutationGate: false, loginProviderGate: false, browserAcceptance: false };
    result.logout = { component: 'AUTH-01 current session logout', checks: logoutChecks.length, checkNames: logoutChecks,
      unchangedFrontendApi: true, actualNestAndPostgres: true, sessionFixture: true,
      durableSingleSessionRevocation: true, academicHistoryPreserved: true,
      cookieBrowserGate: false, loginProviderGate: false, fullFeatureGate: false, browserAcceptance: false };
    result.ownPaymentStatus = { component: 'PAY-01 own status read', checks: paymentChecks.length, checkNames: paymentChecks,
      unchangedFrontendApiAndDecoder: true, actualNestAndPostgres: true, storedFinancialFixtures: true,
      noChargeOrGrant: true, noReadWrites: true, checkoutProviderGate: false,
      loginProviderGate: false, fullFeatureGate: false, browserAcceptance: false };
    result.attemptRead = { component: 'ASSESS-02 single owned attempt read', checks: attemptChecks.length, checkNames: attemptChecks,
      unchangedFrontendApiAndDecoder: true, actualNestAndPostgres: true, storedAcademicFixtures: true,
      noGradeOrComplete: true, noReadWrites: true, bestResultSelectionGate: false,
      attemptMutationGate: false, loginProviderGate: false, fullFeatureGate: false, browserAcceptance: false };
    const directory = path.resolve(process.env.EXECUTION_ARTIFACT_DIR || path.join(root, '../artifacts/nest-execution'));
    fs.mkdirSync(directory, { recursive: true });
    result.instructorGrant = { component: 'MGMT-02 grant', checks: instructorGrantChecks.length, checkNames: instructorGrantChecks,
      unchangedAdminResourceAndDecoder: true, normalizedRolesAndAudit: true, originalAcademicHistory: true,
      sessionFixture: true, instructorDirectoryGate: false, loginProviderGate: false, browserAcceptance: false, fullFeatureGate: false };
    result.managedQuizLocator = { component: 'MGMT-04 locator', checks: locatorChecks.length, checkNames: locatorChecks,
      unchangedWebAdminResourcesAndDecoder: true, actualNestAndPostgres: true, publicCourseItemID: true,
      actualPureAuthoringForm: true, noReadWrites: true, sessionFixture: true,
      authoringHttpGate: false, managementDirectoryGate: false, loginProviderGate: false,
      browserAcceptance: false, fullFeatureGate: false };
    result.adminUserDetail = { component: 'MGMT-01 detail', checks: adminDetailChecks.length, checkNames: adminDetailChecks,
      unchangedAdminResourceAndDecoder: true, actualNestAndPostgres: true, normalizedTargetRoles: true,
      boundedCanonicalProfileAndMethods: true, noReadWrites: true, sessionFixture: true,
      userCreationGate: false, directoryQueryGate: false, loginProviderGate: false,
      browserAcceptance: false, fullFeatureGate: false };
    result.selfProfilePatch = { checks: profilePatchChecks.length, checkNames: profilePatchChecks, actualNestAndPostgres: true, browserAcceptance: false };
    result.managedAttemptRead = { checks: managedAttemptChecks.length, checkNames: managedAttemptChecks, actualNestAndPostgres: true, browserAcceptance: false };
    result.codeCommands = { checks: codeCommandChecks.length, checkNames: codeCommandChecks, actualNestAndPostgres: true, browserAcceptance: false };
    result.continuationListsResume = {checks:continuationChecks.length,checkNames:continuationChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.aiHistory = {checks:aiHistoryChecks.length,checkNames:aiHistoryChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.adminAccountDirectory = {checks:accountDirectoryChecks.length,checkNames:accountDirectoryChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.completion = {checks:completionChecks.length,checkNames:completionChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.courseAuthoring = {checks:courseAuthoringChecks.length,checkNames:courseAuthoringChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.blog = {checks:blogChecks.length,checkNames:blogChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.managementHistory = {checks:historyChecks.length,checkNames:historyChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.adminPayment = {checks:adminPaymentChecks.length,checkNames:adminPaymentChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.authoringReview = {checks:authoringReviewChecks.length,checkNames:authoringReviewChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.assessmentLifecycle = {checks:assessmentLifecycleChecks.length,checkNames:assessmentLifecycleChecks,actualNestAndPostgres:true,browserAcceptance:false};
    result.certificateDownload = {checks:certificateDownloadChecks.length,checkNames:certificateDownloadChecks,actualNestAndPostgres:true,browserAcceptance:false};
    fs.writeFileSync(path.join(directory, 'frontend-detail-integration.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await stop();
    const ownedAccounts = [accountId, learnerId, adminId,...additionalFixtureAccounts].filter(Boolean);
    const ownedAttempts = await db.quizAttempt.findMany({ where: { enrollment: { accountId: { in: ownedAccounts } } }, select: { id: true } });
    const ownedAttemptIds = ownedAttempts.map(row => row.id);
    await db.answer.deleteMany({ where: { attemptId: { in: ownedAttemptIds } } });
    await db.attemptQuestion.deleteMany({ where: { attemptId: { in: ownedAttemptIds } } });
    await db.quizAttempt.deleteMany({ where: { id: { in: ownedAttemptIds } } });
    const ownedPayments = await db.payment.findMany({ where: { accountId: { in: ownedAccounts } }, select: { id: true } });
    await db.paymentEvent.deleteMany({ where: { paymentId: { in: ownedPayments.map(row => row.id) } } });
    await db.payment.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    await db.aIPractice.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    await db.aIRequest.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    await db.aIMessage.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    await db.aIConversation.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    await db.aIUsageDaily.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    if (accountId) await db.redeemCode.deleteMany({ where: { course: { instructorId: accountId } } });
    if (accountId) await db.certificate.deleteMany({ where: { enrollment: { course: { instructorId: accountId } } } });
    if (accountId) await db.progress.deleteMany({ where: { enrollment: { course: { instructorId: accountId } } } });
    if (accountId) await db.enrollment.deleteMany({ where: { course: { instructorId: accountId } } });
    if (accountId) await db.videoTranscript.deleteMany({ where: { item: { chapter: { course: { instructorId: accountId } } } } });
    if (accountId) await db.question.deleteMany({ where: { quiz: { item: { chapter: { course: { instructorId: accountId } } } } } });
    if (accountId) await db.quiz.deleteMany({ where: { item: { chapter: { course: { instructorId: accountId } } } } });
    if (accountId) await db.courseReview.deleteMany({where:{course:{instructorId:accountId}}});
    if (accountId) await db.course.deleteMany({ where: { instructorId: accountId } });
    await db.blogPost.deleteMany({where:{authorId:{in:ownedAccounts}}});
    await db.appSession.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    await db.localCredential.deleteMany({where:{accountId:{in:additionalFixtureAccounts}}});
    await db.userRole.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    await db.account.deleteMany({ where: { id: { in: ownedAccounts } } });
    await db.$disconnect(); hook.deregister(); delete globalThis[learningClientSlot];
  }
}
main().catch(error => {
  const code = typeof error.code === 'string' && /^(?:ERR_[A-Z_]+|P\d{4})$/.test(error.code) ? error.code : 'WITHHELD';
  console.error(`Frontend-detail component failed at ${phase} (${code}); credential-bearing diagnostics withheld.`);
  // Stack locations only; never print assertion values, URLs or error messages.
  for (const location of String(error.stack||'').split('\n').slice(1,5)) {
    const match=location.match(/(?:[A-Za-z]:[\\/]|\/)[^()\n]+:\d+:\d+/);
    if(match)console.error('at '+match[0]);
  }
  process.exitCode = 1;
});
