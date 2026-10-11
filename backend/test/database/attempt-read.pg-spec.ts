import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AttemptReadService } from '../../src/features/assessments/attempt-read.service';
import { ManagedAttemptReadService } from '../../src/features/assessments/managed-attempt-read.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('ASSESS-02 single owned Attempt / actual HTTP and PostgreSQL historical snapshots', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication, courseId: string, itemId: string, quizId: string, liveQuestionId: string;
  const previousUrl = process.env.DATABASE_URL, tag = 'attempt_read_' + randomUUID();
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {}, grants: Record<string, string> = {}, attempts: Record<string, string> = {};
  const hash = (secret: string) => createHash('sha256').update(secret).digest('hex').toUpperCase();
  const read = (id = attempts.graded, actor = 'learner') => request(app.getHttpServer()).get('/api/v1/learn/attempts/' + encodeURIComponent(id))
    .set('x-melearn-app', 'web').set('Cookie', `melearn_web_session=${secrets[actor]}`);
  const counts = () => Promise.all(Object.values(Prisma.ModelName).map(name => (db as any)[name[0].toLowerCase() + name.slice(1)].count()));
  const academic = () => Promise.all([
    db.quizAttempt.findMany({ where: { courseId }, orderBy: { id: 'asc' } }),
    db.attemptQuestion.findMany({ where: { attempt: { courseId } }, orderBy: [{ attemptId: 'asc' }, { position: 'asc' }] }),
    db.answer.findMany({ where: { question: { attempt: { courseId } } }, orderBy: { id: 'asc' } }),
    db.enrollment.findMany({ where: { courseId }, orderBy: { id: 'asc' } }),
    db.progress.findMany({ where: { courseId }, orderBy: { id: 'asc' } }),
    db.certificate.findMany({ where: { enrollment: { courseId } }, orderBy: { id: 'asc' } }),
  ]);
  const time = new Date('2026-10-01T00:00:00Z');
  const definitions = [
    { questionId: 'single', type: 'single_choice', position: 0, maxScore: 2, response: { option_ids: ['a'] }, score: 1.5 },
    { questionId: 'multiple', type: 'multiple_choice', position: 1, maxScore: 3, response: { option_ids: ['a', 'b'] }, score: 3 },
    { questionId: 'essay', type: 'essay', position: 2, maxScore: 4, response: { text: 'คำตอบเดิม', private: 'PRIVATE_RESPONSE' }, score: 3 },
    { questionId: 'image', type: 'image', position: 3, maxScore: 1, response: { image_url: 'https://example.test/owned-historical-image.png' }, score: 1 },
  ];
  async function createAttempt(name: string, owner: string, number: number, status: string) {
    const graded = status === 'graded';
    const row = await db.quizAttempt.create({ data: { enrollmentId: grants[owner], quizId, courseId, number, status,
      definitionSnapshot: { item_id: itemId, correct_keys: 'PRIVATE_DEFINITION' }, maxScore: 10,
      startedAt: time, submittedAt: status === 'in_progress' ? null : time, gradedAt: graded ? time : null,
      earnedScore: graded ? 8.5 : null, passed: graded ? true : null,
      snapshotQuestions: { create: [...definitions].reverse().map(q => ({ questionId: q.questionId, type: q.type, position: q.position, maxScore: q.maxScore,
        payloadSnapshot: { prompt: 'คำถามเดิม ' + q.questionId, prompt_doc: { type: 'doc', text: 'บทเดิม' },
          options: q.type.endsWith('choice') ? [{ id: 'a', text: 'A', correct: true, private: 'PRIVATE_OPTION' }, { id: 'b', text: 'B' }] : [],
          correct_key: 'PRIVATE_KEY', provider: 'PRIVATE_PROVIDER', ...(q.questionId === 'essay' ? { rubric: 'historical rubric', response_mode: 'either' } : {}) } })) } } }); attempts[name] = row.id;
    for (const q of definitions) if (status !== 'in_progress' || q.questionId === 'single') {
      const scored = graded || (status === 'pending_review' && q.type.endsWith('choice'));
      await db.answer.create({ data: { attemptId: row.id, questionId: q.questionId, response: q.response,
        score: scored ? q.score : null, comment: scored ? 'ความคิดเห็นเดิม' : null,
        gradedAt: scored ? time : null, gradedBy: scored && !q.type.endsWith('choice') ? accounts.instructor : null } });
    }
  }
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const role of ['learner', 'instructor', 'admin']) {
      accounts[role] = (await db.account.create({ data: { displayName: tag + role, origin: 'self_email', emailVerified: false,
        roles: role === 'admin' ? 'learner' : 'admin', roleGrants: { create: { role } } } })).id;
      secrets[role] = randomUUID(); await db.appSession.create({ data: { accountId: accounts[role], audience: 'web',
        expiresAt: new Date(Date.now() + 3600000), tokenHash: hash(secrets[role]) } });
    }
    const course = await db.course.create({ data: { instructorId: accounts.instructor, slug: tag, title: 'คอร์สเดิม', category: 'test', level: 'test',
      status: 'published', publishedAt: time, chapters: { create: { title: 'บทเดิม', position: 0,
        items: { create: { title: 'Quiz เดิม', type: 'quiz', position: 0 } } } } }, include: { chapters: { include: { items: true } } } });
    courseId = course.id; itemId = course.chapters[0].items[0].id;
    quizId = (await db.quiz.create({ data: { courseId, itemId, title: 'Quiz เดิม' } })).id;
    liveQuestionId = (await db.question.create({ data: { quizId, position: 0, type: 'essay', prompt: 'LIVE_DEFINITION', options: [], correctKey: 'PRIVATE_LIVE_KEY', maxScore: 100 } })).id;
    for (const role of Object.keys(accounts)) grants[role] = (await db.enrollment.create({ data: { accountId: accounts[role], courseId, source: 'redeem', grantedAt: time } })).id;
    await db.enrollment.update({ where: { id: grants.learner }, data: { completedAt: time, completedItems: 1, completionSnapshot: { total_items: 1, completed_items: 1 } } });
    await db.progress.create({ data: { enrollmentId: grants.learner, courseId, itemId, completedAt: time } });
    await db.certificate.create({ data: { enrollmentId: grants.learner, code: tag, courseName: 'ชื่อเดิม', recipientName: 'ผู้เรียนเดิม', issuedAt: time } });
    await createAttempt('in_progress', 'learner', 1, 'in_progress'); await createAttempt('pending_review', 'learner', 2, 'pending_review');
    await createAttempt('graded', 'learner', 3, 'graded'); await createAttempt('instructor', 'instructor', 1, 'graded');
    await createAttempt('admin', 'admin', 1, 'graded'); await createAttempt('submitted', 'learner', 4, 'submitted');
    const bad = await db.quizAttempt.create({ data: { enrollmentId: grants.learner, quizId, courseId, number: 5,
      definitionSnapshot: { item_id: itemId }, maxScore: 10, snapshotQuestions: { create: { questionId: 'bad', position: 0,
        type: 'essay', maxScore: 10, payloadSnapshot: { prompt: 42, options: [], correct_key: 'PRIVATE_BAD' } } } } }); attempts.bad = bad.id;
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = module.createNestApplication(); configureApplication(app, []); await app.init();
  });
  beforeEach(async () => {
    await db.appSession.updateMany({ where: { accountId: { in: Object.values(accounts) } }, data: { revokedAt: null, expiresAt: new Date(Date.now() + 3600000) } });
    await db.account.updateMany({ where: { id: { in: Object.values(accounts) } }, data: { disabled: false } });
  });
  afterAll(async () => {
    if (app) await app.close(); if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      const ids = Object.values(attempts);
      await db.answer.deleteMany({ where: { attemptId: { in: ids } } }); await db.attemptQuestion.deleteMany({ where: { attemptId: { in: ids } } });
      await db.quizAttempt.deleteMany({ where: { id: { in: ids } } });
      if (quizId) { await db.question.deleteMany({ where: { quizId } }); await db.quiz.deleteMany({ where: { id: quizId } }); }
      if (courseId) {
        await db.certificate.deleteMany({ where: { enrollment: { courseId } } }); await db.progress.deleteMany({ where: { courseId } });
        await db.enrollment.deleteMany({ where: { courseId } }); await db.course.deleteMany({ where: { id: courseId } });
      }
      const owners = Object.values(accounts); await db.appSession.deleteMany({ where: { accountId: { in: owners } } });
      await db.userRole.deleteMany({ where: { accountId: { in: owners } } }); await db.account.deleteMany({ where: { id: { in: owners } } }); await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });

  it.each(['in_progress', 'pending_review', 'graded'])('projects canonical %s with sorted immutable questions/all four types and exact nullable fields', async status => {
    const response = await read(attempts[status]).expect(200); assertTaskContract('ASSESS-02', 'WireAttemptView', response.body);
    expect(response.body.item_id).toBe(itemId); expect(response.body.questions.map((q: { id: string }) => q.id)).toEqual(definitions.map(q => q.questionId));
    expect(response.body.max).toBe(10); expect(response.body.started_at).toBe(time.toISOString());
    if (status === 'graded') { expect(response.body.earned).toBe(8.5); expect(response.body.percent).toBe(85); expect(response.body.passed).toBe(true); expect(response.body.question_results).toHaveLength(4); }
    else { expect(response.body.earned).toBeNull(); expect(response.body.percent).toBeNull(); expect(response.body.passed).toBeNull(); expect(response.body.question_results).toBeNull(); }
  });
  it('pending partial automatic grades cannot become a final score or Progress mutation from GET', async () => {
    const before = await academic(); const response = await read(attempts.pending_review).expect(200);
    expect(response.body.answers.multiple).toEqual({ option_ids: ['a', 'b'] }); expect(response.body.earned).toBeNull(); expect(response.body.question_results).toBeNull(); expect(await academic()).toEqual(before);
  });
  it('never serializes correct keys, private answer/option/definition metadata or grader identity', async () => {
    const response = await read().expect(200);
    expect(response.body.questions[0].options).toEqual([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }]); expect(response.body.answers.essay).toEqual({ text: 'คำตอบเดิม' });
    expect(response.body.question_results[2].comment).toBe('ความคิดเห็นเดิม');
    expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_|correct|gradedBy|LIVE_DEFINITION|definitionSnapshot|payloadSnapshot|enrollmentId/);
  });
  it('historical snapshots survive live question edit/deletion, Course archive and account rename without read repair', async () => {
    const original = (await read().expect(200)).body;
    await db.question.update({ where: { id: liveQuestionId }, data: { prompt: 'ข้อสอบใหม่', maxScore: 999 } });
    await db.question.delete({ where: { id: liveQuestionId } }); await db.quiz.update({ where: { id: quizId }, data: { title: 'ชื่อใหม่' } });
    await db.course.update({ where: { id: courseId }, data: { status: 'archived', title: 'ชื่อใหม่' } });
    await db.account.update({ where: { id: accounts.learner }, data: { displayName: 'ชื่อใหม่' } });
    const before = await academic(); await db.$disconnect(); await db.$connect(); expect((await read().expect(200)).body).toEqual(original); expect(await academic()).toEqual(before);
  });
  it('self historical read uses normalized identity and preserves records after role/eligibility changes', async () => {
    await read(attempts.instructor, 'instructor').expect(200); await read(attempts.admin, 'admin').expect(200);
    expect((await db.account.findUniqueOrThrow({ where: { id: accounts.learner } })).emailVerified).toBe(false); await read().expect(200);
  });
  it('foreign learner, course-owner Instructor and Admin cannot bypass ownership; unknown/malformed IDs get the same404', async () => {
    for (const [id, actor] of [[attempts.graded, 'instructor'], [attempts.graded, 'admin'], [attempts.instructor, 'learner'], [randomUUID(), 'learner'], ['bad-id', 'learner']]) {
      const response = await read(id, actor).expect(404); assertErrorContract(response.body); expect(response.body.error.code).toBe('not_found');
    }
  });
  it('anonymous and forged app namespace cannot access self academic data', async () => {
    await request(app.getHttpServer()).get('/api/v1/learn/attempts/' + attempts.graded).set('x-melearn-app', 'web').expect(401);
    await read().set('x-melearn-app', 'admin').expect(403); await read().set('x-melearn-app', 'other').expect(403);
  });
  it('expired, revoked and disabled sessions fail before returning academic records', async () => {
    const tokenHash = hash(secrets.learner);
    for (const data of [{ expiresAt: new Date(0) }, { expiresAt: new Date(Date.now() + 3600000), revokedAt: new Date() }]) {
      await db.appSession.update({ where: { tokenHash }, data }); const response = await read().expect(401); assertErrorContract(response.body);
    }
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null } });
    await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } }); await read().expect(401);
  });
  it('rechecks post-guard revocation inside the held academic transaction', async () => {
    const service = app.get(AttemptReadService), original = service.read.bind(service);
    const spy = jest.spyOn(service, 'read').mockImplementationOnce(async (reference, id) => {
      await db.appSession.update({ where: { tokenHash: hash(secrets.learner) }, data: { revokedAt: new Date() } }); return original(reference, id);
    }); try { await read().expect(401); } finally { spy.mockRestore(); }
  });
  it('unsupported Submitted/invalid snapshot states fail closed with canonical500 and preserve originals', async () => {
    const before = await academic(), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { for (const id of [attempts.submitted, attempts.bad]) { const response = await read(id).expect(500); assertErrorContract(response.body); expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_|snapshot|submitted/); } expect(await academic()).toEqual(before); }
    finally { log.mockRestore(); }
  });
  it('repeated/concurrent reads and reconnect never grade, grant, complete, issue or update sessions', async () => {
    const before = await academic(), modelCounts = await counts();
    const sessions = await db.appSession.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { tokenHash: 'asc' } });
    const responses = await Promise.all([read(), read(), read(attempts.in_progress)]); expect(responses.map(r => r.status)).toEqual([200, 200, 200]);
    await db.$disconnect(); await db.$connect(); await read().expect(200);
    expect(await academic()).toEqual(before); expect(await counts()).toEqual(modelCounts);
    expect(await db.appSession.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { tokenHash: 'asc' } })).toEqual(sessions);
  });
  it('actual SQL failure gives masked canonical500 without synthetic results or private diagnostics', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma), before = await academic();
    const fail = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await callback(tx); await tx.$queryRaw`SELECT 1/0`; }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(fail), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { const response = await read().expect(500); assertErrorContract(response.body); expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|division|postgresql/); expect(await academic()).toEqual(before); }
    finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('a grade writer waits on actual parent Attempt lock until the coherent read commits', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma);
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), held = new Promise<void>(resolve => { ready = resolve; });
    const changing = new Promise<void>(resolve => { started = resolve; });
    const hold = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { const result = await callback(tx); ready(); await gate; return result; }, { ...options, timeout: 15000 })) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(hold), reading = read().then(r => r); await held;
    const mutation = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid; started();
      await tx.$queryRaw(Prisma.sql`SELECT id FROM quiz_attempts WHERE id=${attempts.graded} FOR UPDATE`);
      await tx.answer.update({ where: { attemptId_questionId: { attemptId: attempts.graded, questionId: 'essay' } }, data: { comment: 'ความคิดเห็นใหม่' } });
    }, { timeout: 15000 }); await changing;
    try {
      let blocked = false;
      for (let i = 0; i < 100; i++) { if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; } await new Promise(r => setTimeout(r, 10)); }
      expect(blocked).toBe(true); release(); expect((await reading).body.question_results[2].comment).toBe('ความคิดเห็นเดิม'); await mutation;
      expect((await read().expect(200)).body.question_results[2].comment).toBe('ความคิดเห็นใหม่');
    } finally { release(); await Promise.allSettled([reading, mutation]); spy.mockRestore(); }
  });
  const managed = (id = attempts.graded, actor = 'instructor') => request(app.getHttpServer())
    .get('/api/v1/instructor/attempts/' + encodeURIComponent(id)).set('x-melearn-app', 'web')
    .set('Cookie', `melearn_web_session=${secrets[actor]}`);
  it.each(['in_progress', 'pending_review', 'graded', 'submitted'])('MGMT-04 owner reads canonical %s historical attempt with learner and choice subtotals', async status => {
    const response = await managed(attempts[status]).expect(200); assertTaskContract('MGMT-04', 'ManagedAttemptDto', response.body);
    expect(response.body.status).toBe(status); expect(response.body.user_id).toBe(accounts.learner);
    expect(response.body.learner_display_name).toBe((await db.account.findUniqueOrThrow({ where: { id: accounts.learner } })).displayName);
    expect(response.body.course_id).toBe(courseId); expect(response.body.item_id).toBe(itemId);
    expect(response.body.choice_max).toBe(5); expect(response.body.choice_earned).toBe(status === 'graded' || status === 'pending_review' ? 4.5 : 0);
    expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_|correct_key|correctKey|gradedBy|passwordHash/);
    expect(Object.keys(response.body.grades).sort()).toEqual(status === 'graded' ? ['essay', 'image', 'multiple', 'single'] : status === 'pending_review' ? ['multiple', 'single'] : []);
  });
  it('MGMT-04 preserves optional historical rubric/response mode and does not consult edited live questions', async () => {
    const response = await managed().expect(200); assertTaskContract('MGMT-04', 'ManagedAttemptDto', response.body);
    expect(response.body.questions.find((q: { id: string }) => q.id === 'essay')).toMatchObject({ rubric: 'historical rubric', response_mode: 'either' });
    expect(response.body.max).toBe(10);
  });
  it('MGMT-04 rejects learner, Admin including combined Admin/Instructor and wrong session namespace', async () => {
    await managed(attempts.graded, 'learner').expect(403); await managed(attempts.graded, 'admin').expect(403);
    await db.userRole.create({ data: { accountId: accounts.admin, role: 'instructor' } });
    try { await managed(attempts.graded, 'admin').expect(403); }
    finally { await db.userRole.delete({ where: { accountId_role: { accountId: accounts.admin, role: 'instructor' } } }); }
    await request(app.getHttpServer()).get('/api/v1/instructor/attempts/' + attempts.graded).set('x-melearn-app', 'admin')
      .set('Cookie', `melearn_web_session=${secrets.instructor}`).expect(403);
    await request(app.getHttpServer()).get('/api/v1/instructor/attempts/' + attempts.graded).set('x-melearn-app', 'web').expect(401);
  });
  it('MGMT-04 enrolled foreign Instructor has no authoring access; unknown attempt also hides existence', async () => {
    await db.userRole.create({ data: { accountId: accounts.learner, role: 'instructor' } });
    try { await managed(attempts.graded, 'learner').expect(404); await managed('missing').expect(404); }
    finally { await db.userRole.delete({ where: { accountId_role: { accountId: accounts.learner, role: 'instructor' } } }); }
  });
  it('MGMT-04 rechecks fresh owner identity after guard and blocks revoked/disabled authority', async () => {
    const service = app.get(ManagedAttemptReadService), original = service.read.bind(service);
    const spy = jest.spyOn(service, 'read').mockImplementationOnce(async (reference, id) => {
      await db.account.update({ where: { id: accounts.instructor }, data: { disabled: true } }); return original(reference, id);
    });
    try { const response = await managed().expect(401); assertErrorContract(response.body); }
    finally { spy.mockRestore(); }
  });
  it('MGMT-04 malformed snapshots fail safely and reads never repair stored data', async () => {
    const before = await academic(), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { const response = await managed(attempts.bad).expect(500); assertErrorContract(response.body);
      expect(await academic()).toEqual(before); expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|snapshot|postgresql/); }
    finally { log.mockRestore(); }
  });
  it('MGMT-04 parallel and reconnect reads preserve all academic and model state', async () => {
    const before = await academic(), beforeCounts = await counts(); await db.$disconnect(); await db.$connect();
    for (const response of await Promise.all(Array.from({ length: 4 }, () => managed()))) {
      expect(response.status).toBe(200); assertTaskContract('MGMT-04', 'ManagedAttemptDto', response.body);
    }
    expect(await academic()).toEqual(before); expect(await counts()).toEqual(beforeCounts);
  });
});
