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
    if (specifier === '../../../shared/api/client' &&
        (context.parentURL?.includes('/features/learning/api/learning-api.ts') ||
         context.parentURL?.includes('/features/redeem/api/redeem-admin-api.ts') ||
         context.parentURL?.includes('/features/certificate/api/certificate-api.ts') ||
         context.parentURL?.includes('/features/ai/api/ai-api.ts') ||
         context.parentURL?.includes('/features/payment/api/payment-api.ts') ||
         context.parentURL?.includes('/features/auth/api/auth-session.ts'))) {
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
    phase = 'frontend-current-session-logout';
    const logoutChecks = [];
    await assert.rejects((await authApiFor('certificate-guest')).logout(), error => error instanceof HttpClientError && error.status === 401);
    logoutChecks.push('anonymous401');
    const beforeLogoutCounts = await counts();
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
    assert.deepEqual(await db.account.findUniqueOrThrow({ where: { id: learnerId } }), beforeProfileAccount);
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
    const directory = path.resolve(process.env.EXECUTION_ARTIFACT_DIR || path.join(root, '../artifacts/nest-execution'));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'frontend-detail-integration.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await stop();
    const ownedAccounts = [accountId, learnerId, adminId].filter(Boolean);
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
    if (accountId) await db.course.deleteMany({ where: { instructorId: accountId } });
    await db.appSession.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    await db.userRole.deleteMany({ where: { accountId: { in: ownedAccounts } } });
    await db.account.deleteMany({ where: { id: { in: ownedAccounts } } });
    await db.$disconnect(); hook.deregister(); delete globalThis[learningClientSlot];
  }
}
main().catch(error => {
  const code = typeof error.code === 'string' && /^(?:ERR_[A-Z_]+|P\d{4})$/.test(error.code) ? error.code : 'WITHHELD';
  console.error(`Frontend-detail component failed at ${phase} (${code}); credential-bearing diagnostics withheld.`);
  process.exitCode = 1;
});
