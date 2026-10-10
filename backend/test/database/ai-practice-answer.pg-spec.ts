import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PracticeAnswerService } from '../../src/features/ai/practice-answer.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('AI-04 latest practice answers / actual HTTP, PostgreSQL, no provider/quota/academic mutation', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  let courseId: string, enrollmentId: string, quizId: string, attemptId: string;
  const tag = 'practice_answer_' + randomUUID(), previousUrl = process.env.DATABASE_URL;
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {}, conversations: Record<string, string> = {};
  const messages: Record<string, string> = {}, practices: Record<string, string> = {};
  const snapshot = () => ({ version: 1, private: 'PRIVATE_PROVIDER_CONTEXT', questions: [1, 2].map(index => ({
    id: 'q' + index, prompt: 'โจทย์ ' + index, options: [{ id: 'right' + index, text: 'ถูก' }, { id: 'wrong' + index, text: 'ผิด' }],
    correct_option_id: 'right' + index, explanation: 'คำอธิบายเฉพาะข้อ ' + index })) });
  const answer = (question_id = 'q1', option_id = 'right1', name = 'owner', key = 'owner', audience = 'web') =>
    request(app.getHttpServer()).put('/api/v1/me/ai/conversations/' + conversations[key] + '/messages/' + messages[key] + '/practice/answers')
      .set('x-melearn-app', audience).set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`).send({ question_id, option_id });
  const counts = () => Promise.all(Object.values(Prisma.ModelName).map(name => (db as any)[name[0].toLowerCase() + name.slice(1)].count()));
  const quotas = () => Promise.all([db.aIUsageDaily.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: [{ accountId: 'asc' }, { usageDate: 'asc' }] }),
    db.aIRequest.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { id: 'asc' } })]);
  const academic = () => Promise.all([db.course.findUniqueOrThrow({ where: { id: courseId } }),
    db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } }), db.progress.findMany({ where: { enrollmentId }, orderBy: { id: 'asc' } }),
    db.certificate.findMany({ where: { enrollmentId }, orderBy: { id: 'asc' } }), db.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } }),
    db.attemptQuestion.findMany({ where: { attemptId }, orderBy: { position: 'asc' } }), db.answer.findMany({ where: { attemptId }, orderBy: { id: 'asc' } })]);
  const stored = (key = 'owner') => db.aIPractice.findUniqueOrThrow({ where: { id: practices[key] } });
  async function newPractice(key: string, owner = 'owner', payload: Prisma.InputJsonValue = snapshot(), legacy = false) {
    conversations[key] = (await db.aIConversation.create({ data: { accountId: accounts[owner], courseId: null,
      title: 'ชื่อผู้ใช้ตั้งเอง', contextSnapshot: { private: 'PRIVATE_GENERAL_CONTEXT' } } })).id;
    messages[key] = (await db.aIMessage.create({ data: { accountId: accounts[owner], conversationId: conversations[key], position: 0,
      role: 'assistant', content: 'ชุดฝึก', contextSnapshot: { private: 'PRIVATE_MESSAGE_CONTEXT' } } })).id;
    practices[key] = (await db.aIPractice.create({ data: { id: legacy ? messages[key] : undefined, accountId: accounts[owner],
      conversationId: conversations[key], messageId: legacy ? null : messages[key], payloadSnapshot: payload } })).id;
  }
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const name of ['owner', 'other', 'admin']) {
      accounts[name] = (await db.account.create({ data: { displayName: tag + name, origin: 'admin_created', roles: 'admin',
        roleGrants: { create: { role: name === 'admin' ? 'admin' : name === 'other' ? 'instructor' : 'learner' } } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[name + '_' + audience] = secret;
        await db.appSession.create({ data: { accountId: accounts[name], audience, expiresAt: new Date(Date.now() + 3600000),
          tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase() } });
      }
      await db.aIUsageDaily.create({ data: { accountId: accounts[name], usageDate: new Date('2026-10-10T00:00:00Z'), successCount: 20 } });
      await db.aIRequest.create({ data: { accountId: accounts[name], requestId: tag + name, payloadHash: 'PRIVATE_HASH',
        usageDate: new Date('2026-10-10T00:00:00Z'), status: 'succeeded', result: { private: 'PRIVATE_PREVIOUS_RESPONSE' }, finalizedAt: new Date() } });
    }
    courseId = (await db.course.create({ data: { instructorId: accounts.other, slug: tag, title: tag, category: 'test', level: 'test',
      status: 'published', publishedAt: new Date(), aiEnabled: false } })).id;
    const chapter = await db.courseChapter.create({ data: { courseId, title: 'บทเดิม', position: 0 } });
    const article = await db.courseItem.create({ data: { courseId, chapterId: chapter.id, title: 'เดิม', position: 0 } });
    const completedAt = new Date('2026-10-10T00:00:00Z');
    enrollmentId = (await db.enrollment.create({ data: { accountId: accounts.owner, courseId, source: 'stripe', completedAt,
      completionSnapshot: { total_items: 1, private: 'PRIVATE_ORIGINAL_COMPLETION' } } })).id;
    await db.progress.create({ data: { enrollmentId, courseId, itemId: article.id, completedAt, resumeData: { private: 'PRIVATE_EXISTING_RESUME' } } });
    await db.certificate.create({ data: { enrollmentId, code: tag, recipientName: tag, courseName: tag, issuedAt: completedAt } });
    const quizItem = await db.courseItem.create({ data: { courseId, chapterId: chapter.id, title: 'แบบฝึกเพิ่มหลังจบ', position: 1, type: 'quiz' } });
    quizId = (await db.quiz.create({ data: { courseId, itemId: quizItem.id, title: tag } })).id;
    attemptId = (await db.quizAttempt.create({ data: { courseId, enrollmentId, quizId, number: 1, maxScore: 10,
      definitionSnapshot: { private: 'PRIVATE_EXISTING_ATTEMPT' }, snapshotQuestions: { create: { questionId: tag + '_q', position: 0,
        type: 'essay', maxScore: 10, payloadSnapshot: { prompt: tag, private: 'PRIVATE_EXISTING_KEY' } } } } })).id;
    await db.answer.create({ data: { attemptId, questionId: tag + '_q', response: { text: 'PRIVATE_EXISTING_ANSWER' } } });
    for (const [key, name] of [['owner', 'owner'], ['other', 'other'], ['admin', 'admin'], ['concurrent', 'owner'], ['rollback', 'owner'], ['deleted', 'owner']]) await newPractice(key, name);
    await newPractice('malformed', 'owner', { version: 99, private: 'PRIVATE_CORRUPT' });
    await newPractice('legacy', 'owner', {}, true);
    await db.aIMessage.create({ data: { id: tag + '_USER', accountId: accounts.owner, conversationId: conversations.owner,
      position: 1, role: 'user', content: 'คำถาม', contextSnapshot: {} } });
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      const ids = Object.values(accounts);
      await db.aIPractice.deleteMany({ where: { accountId: { in: ids } } });
      await db.aIRequest.deleteMany({ where: { accountId: { in: ids } } });
      await db.aIMessage.deleteMany({ where: { accountId: { in: ids } } });
      await db.aIConversation.deleteMany({ where: { accountId: { in: ids } } });
      await db.aIUsageDaily.deleteMany({ where: { accountId: { in: ids } } });
      await db.appSession.deleteMany({ where: { accountId: { in: ids } } });
      await db.userRole.deleteMany({ where: { accountId: { in: ids } } });
      if (attemptId) { await db.answer.deleteMany({ where: { attemptId } }); await db.attemptQuestion.deleteMany({ where: { attemptId } }); await db.quizAttempt.deleteMany({ where: { id: attemptId } }); }
      if (enrollmentId) { await db.certificate.deleteMany({ where: { enrollmentId } }); await db.progress.deleteMany({ where: { enrollmentId } }); await db.enrollment.deleteMany({ where: { id: enrollmentId } }); }
      if (quizId) await db.quiz.deleteMany({ where: { id: quizId } });
      if (courseId) await db.course.deleteMany({ where: { id: courseId } });
      await db.account.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('derives a wrong partial result from the stored key and reveals only the answered question explanation', async () => {
    const response = await answer('q1', 'wrong1').expect(200); assertTaskContract('AI-04', 'WireAiPracticeAnswer', response.body);
    expect(response.body).toEqual({ question_id: 'q1', correct: false, explanation: 'คำอธิบายเฉพาะข้อ 1', summary: null });
    expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_|correct_option_id|คำอธิบายเฉพาะข้อ 2/);
  });
  it('shows aggregate only when all answered; reanswer changes latest result without additive scores', async () => {
    expect((await answer('q2', 'right2').expect(200)).body.summary).toEqual({ answered: 2, total: 2, correct_count: 1 });
    expect((await answer('q1', 'right1').expect(200)).body.summary).toEqual({ answered: 2, total: 2, correct_count: 2 });
    expect((await answer('q1', 'wrong1').expect(200)).body.summary).toEqual({ answered: 2, total: 2, correct_count: 1 });
    expect(Object.keys((await stored()).answers as object)).toHaveLength(2);
  });
  it('persists latest answer/time and activity without replacing manual title/context/definitions', async () => {
    const before = await stored(), context = await db.aIConversation.findUniqueOrThrow({ where: { id: conversations.owner } });
    await answer('q1', 'right1').expect(200); const after = await stored();
    expect(after.payloadSnapshot).toEqual(before.payloadSnapshot);
    const saved = (after.answers as Record<string, { option_id: string; answered_at: string }>).q1;
    expect(saved.option_id).toBe('right1'); expect(new Date(saved.answered_at).toISOString()).toBe(saved.answered_at);
    const conversation = await db.aIConversation.findUniqueOrThrow({ where: { id: conversations.owner } });
    expect(conversation.title).toBe(context.title); expect(conversation.contextSnapshot).toEqual(context.contextSnapshot);
    expect(conversation.updatedAt.toISOString()).toBe(saved.answered_at);
  });
  it('concurrent different questions converge to both latest answers without lost updates', async () => {
    const responses = await Promise.all([answer('q1', 'right1', 'owner', 'concurrent'), answer('q2', 'right2', 'owner', 'concurrent')]);
    responses.forEach(response => expect(response.status).toBe(200));
    expect(responses.filter(response => response.body.summary !== null)).toHaveLength(1);
    expect((await answer('q1', 'right1', 'owner', 'concurrent').expect(200)).body.summary).toEqual({ answered: 2, total: 2, correct_count: 2 });
  });
  it('Instructor/Admin cannot answer another account practice; both roles can answer their own persisted set', async () => {
    await answer('q1', 'right1', 'other').expect(404); await answer('q1', 'right1', 'admin', 'owner', 'admin').expect(404);
    await answer('q1', 'right1', 'other', 'other').expect(200);
    for (const audience of ['web', 'admin']) await answer('q1', 'right1', 'admin', 'admin', audience).expect(200);
  });
  it('rejects mismatched paths, unknown/user messages and ambiguous legacy ID equality without guessing a link', async () => {
    for (const id of [messages.other, randomUUID(), tag + '_USER']) await request(app.getHttpServer())
      .put('/api/v1/me/ai/conversations/' + conversations.owner + '/messages/' + id + '/practice/answers')
      .set('x-melearn-app', 'web').set('Cookie', `melearn_web_session=${secrets.owner_web}`).send({ question_id: 'q1', option_id: 'right1' }).expect(404);
    await answer('q1', 'right1', 'owner', 'legacy').expect(404); expect((await stored('legacy')).messageId).toBeNull();
  });
  it('rejects fabricated question/option IDs without saving or returning server keys', async () => {
    const before = await stored();
    for (const [question, option] of [['foreign', 'right1'], ['q1', 'right2'], ['q1', 'foreign']]) {
      const response = await answer(question, option).expect(422); assertErrorContract(response.body);
      expect(response.body.error.code).toBe('validation_failed'); expect(JSON.stringify(response.body)).not.toContain('correct_option_id');
    }
    expect(await stored()).toEqual(before);
  });
  it('enforces required exact body and rejects client scores/keys/audit claims, arrays and malformed JSON', async () => {
    const base = () => request(app.getHttpServer()).put('/api/v1/me/ai/conversations/' + conversations.owner + '/messages/' + messages.owner + '/practice/answers')
      .set('x-melearn-app', 'web').set('Cookie', `melearn_web_session=${secrets.owner_web}`);
    const before = await stored();
    for (const body of [{}, [], { question_id: '', option_id: 'right1' }, { question_id: 1, option_id: 'right1' },
      { question_id: 'q1', option_id: 'right1', correct: true, score: 99, answered_at: 'forged', user_id: accounts.other }]) {
      assertErrorContract((await base().send(body).expect(422)).body);
    }
    await base().set('content-type', 'application/json').send('{broken').expect(400);
    expect(await stored()).toEqual(before);
  });
  it('denies anonymous, namespace forgery, non-Admin admin namespace and disabled/expired/revoked sessions', async () => {
    const path = '/api/v1/me/ai/conversations/' + conversations.owner + '/messages/' + messages.owner + '/practice/answers';
    await request(app.getHttpServer()).put(path).set('x-melearn-app', 'web').send({ question_id: 'q1', option_id: 'right1' }).expect(401);
    await answer('q1', 'right1', 'owner', 'owner', 'admin').expect(403);
    const tokenHash = createHash('sha256').update(secrets.owner_web).digest('hex').toUpperCase();
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: new Date() } }); await answer().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null, expiresAt: new Date(0) } }); await answer().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() + 3600000) } });
    await db.account.update({ where: { id: accounts.owner }, data: { disabled: true } });
    try { await answer().expect(401); } finally { await db.account.update({ where: { id: accounts.owner }, data: { disabled: false } }); }
  });
  it('revalidates post-guard disable before writing the practice', async () => {
    const service = app.get(PracticeAnswerService), original = service.answer.bind(service), before = await stored();
    const spy = jest.spyOn(service, 'answer').mockImplementationOnce(async (...args) => {
      await db.account.update({ where: { id: accounts.owner }, data: { disabled: true } }); return original(...args);
    });
    try { await answer().expect(401); expect(await stored()).toEqual(before); }
    finally { spy.mockRestore(); await db.account.update({ where: { id: accounts.owner }, data: { disabled: false } }); }
  });
  it('malformed persisted snapshot/answers fail closed with safe 500 and no repair', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined), before = await stored('malformed');
    try {
      const response = await answer('q1', 'right1', 'owner', 'malformed').expect(500); assertErrorContract(response.body);
      expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_'); expect(await stored('malformed')).toEqual(before);
      const current = await stored(); await db.aIPractice.update({ where: { id: practices.owner }, data: { answers: { foreign: 'invalid' } } });
      try { await answer().expect(500); } finally { await db.aIPractice.update({ where: { id: practices.owner }, data: { answers: current.answers as Prisma.InputJsonValue } }); }
    } finally { log.mockRestore(); }
  });
  it('real PostgreSQL failure after both writes rolls back answers/activity and surfaces a safe 500', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma);
    const before = await stored('rollback'), conversation = await db.aIConversation.findUniqueOrThrow({ where: { id: conversations.rollback } });
    const failAfterWrites = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await callback(tx); await tx.$queryRaw`SELECT 1/0`; }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(failAfterWrites), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      assertErrorContract((await answer('q1', 'right1', 'owner', 'rollback').expect(500)).body);
      expect(await stored('rollback')).toEqual(before);
      expect(await db.aIConversation.findUniqueOrThrow({ where: { id: conversations.rollback } })).toEqual(conversation);
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('reconnect/reanswer at exhausted old quota preserves every count, quota/request and original definition', async () => {
    const beforeCounts = await counts(), beforeQuota = await quotas(), before = await stored(), beforeAcademic = await academic();
    await db.$disconnect(); await db.$connect();
    const response = await answer().expect(200); expect(response.body.summary).toEqual({ answered: 2, total: 2, correct_count: 2 });
    expect((await stored()).payloadSnapshot).toEqual(before.payloadSnapshot);
    expect(await counts()).toEqual(beforeCounts); expect(await quotas()).toEqual(beforeQuota); expect(await academic()).toEqual(beforeAcademic);
  });
  it('conversation mutation waits for the answer transaction; a subsequently hidden chat cannot be resurrected', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma);
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), held = new Promise<void>(resolve => { ready = resolve; });
    const changing = new Promise<void>(resolve => { started = resolve; });
    const holdAfterWrites = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { const result = await callback(tx); ready(); await gate; return result; }, { ...options, timeout: 15000 })) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(holdAfterWrites);
    const command = answer('q1', 'right1', 'owner', 'deleted').then(response => response); await held;
    const mutation = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      started(); await tx.aIConversation.update({ where: { id: conversations.deleted }, data: { deletedAt: new Date() } });
    }, { timeout: 15000 }); await changing;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); expect((await command).status).toBe(200); await mutation;
      await answer('q1', 'right1', 'owner', 'deleted').expect(404);
    } finally { release(); await Promise.allSettled([command, mutation]); spy.mockRestore(); }
  });
});
