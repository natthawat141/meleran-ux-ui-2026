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
    if (specifier === '../../../shared/api/client' && context.parentURL?.includes('/features/learning/api/learning-api.ts')) {
      // Configuration injection only: retain the actual frontend singleton API,
      // endpoint builders/decoders and the real transport/fetch implementation.
      const name = new URL(context.parentURL).searchParams.get('learning-actor');
      if (!globalThis[learningClientSlot].has(name)) throw new Error('Unknown learning fixture client');
      const source = `export const apiClient=globalThis[${JSON.stringify(learningClientSlot)}].get(${JSON.stringify(name)});`;
      return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  } });
  const db = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  let child, accountId, learnerId;
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
    await db.userRole.create({ data: { accountId, role: 'instructor' } });
    const sessions = { learner: randomUUID(), owner: randomUUID() };
    for (const [name, secret] of Object.entries(sessions)) await db.appSession.create({ data: {
      tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase(),
      accountId: name === 'learner' ? learnerId : accountId, audience: 'web', expiresAt: new Date(Date.now() + 3600000),
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
    const resume = await db.progress.create({ data: { enrollmentId: firstGrant.id, courseId: ids.published, itemId: videoItem.id,
      resumeData: { position_seconds: 42.125, private: 'PRIVATE_RESUME_EXTRA' }, updatedAt: new Date('2026-10-11T03:00:00Z') } });
    const resumed = await learning.course(ids.published);
    assert.equal(resumed.resume_item_id, videoItem.id);
    assert.equal(resumed.outline[0].items[0].resume.position_seconds, 42.125);
    assert.ok(!JSON.stringify(resumed).includes('PRIVATE_'));
    await db.$disconnect(); await db.$connect();
    assert.deepEqual(await learning.course(ids.published), resumed);
    await db.progress.update({ where: { id: resume.id }, data: { resumeData: { position_seconds: -1 } } });
    await assert.rejects(learning.course(ids.published), error => error instanceof HttpClientError && error.status === 500);
    await db.progress.update({ where: { id: resume.id }, data: { resumeData: resume.resumeData, updatedAt: resume.updatedAt } });
    // Anonymous enroll used the same public fetcher; the final network read
    // brings that fetcher's request count to seven (six Catalog checks + one).
    await stop();
    await assert.rejects(api.getCourse(ids.published), error => error instanceof HttpClientError && error.kind === 'network');
    await assert.rejects(learning.course(ids.published), error => error instanceof HttpClientError && error.kind === 'network');
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
      noReadWrites: true, loginProviderGate: false, browserAcceptance: false };
    const directory = path.resolve(process.env.EXECUTION_ARTIFACT_DIR || path.join(root, '../artifacts/nest-execution'));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'frontend-detail-integration.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await stop();
    if (accountId) await db.progress.deleteMany({ where: { enrollment: { course: { instructorId: accountId } } } });
    if (accountId) await db.enrollment.deleteMany({ where: { course: { instructorId: accountId } } });
    if (accountId) await db.videoTranscript.deleteMany({ where: { item: { chapter: { course: { instructorId: accountId } } } } });
    if (accountId) await db.question.deleteMany({ where: { quiz: { item: { chapter: { course: { instructorId: accountId } } } } } });
    if (accountId) await db.quiz.deleteMany({ where: { item: { chapter: { course: { instructorId: accountId } } } } });
    if (accountId) await db.course.deleteMany({ where: { instructorId: accountId } });
    const ownedAccounts = [accountId, learnerId].filter(Boolean);
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
