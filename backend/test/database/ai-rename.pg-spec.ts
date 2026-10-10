import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RenameConversationService } from '../../src/features/ai/rename-conversation.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('AI-05 rename own conversation / real HTTP, fresh authority and preserved history', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const previousUrl = process.env.DATABASE_URL, tag = 'ai_rename_' + randomUUID();
  const accounts: Record<string, string> = {}, conversations: Record<string, string> = {}, secrets: Record<string, string> = {};
  const rename = (title: string, key = 'learner', name = 'learner', audience = 'web') =>
    request(app.getHttpServer()).patch('/api/v1/me/ai/conversations/' + conversations[key])
      .set('x-melearn-app', audience).set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`).send({ title });
  const stored = (key = 'learner') => db.aIConversation.findUniqueOrThrow({ where: { id: conversations[key] } });
  const counts = () => Promise.all(Object.values(Prisma.ModelName).map(name => (db as any)[name[0].toLowerCase() + name.slice(1)].count()));
  const history = () => Promise.all([
    db.aIMessage.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { id: 'asc' } }),
    db.aIPractice.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { id: 'asc' } }),
    db.aIUsageDaily.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: [{ accountId: 'asc' }, { usageDate: 'asc' }] }),
    db.aIRequest.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { id: 'asc' } }),
  ]);
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const role of ['learner', 'instructor', 'admin']) {
      accounts[role] = (await db.account.create({ data: { displayName: tag + role, origin: 'self_email', emailVerified: false,
        roles: role === 'admin' ? 'learner' : 'admin', roleGrants: { create: { role } } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[role + '_' + audience] = secret;
        await db.appSession.create({ data: { accountId: accounts[role], audience, expiresAt: new Date(Date.now() + 3600000),
          tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase() } });
      }
      const conversation = await db.aIConversation.create({ data: { accountId: accounts[role], courseId: null,
        title: role === 'learner' ? null : 'ชื่อเดิม', contextSnapshot: { private: 'PRIVATE_ORIGINAL_CONTEXT' } } });
      conversations[role] = conversation.id;
      const message = await db.aIMessage.create({ data: { accountId: accounts[role], conversationId: conversation.id,
        role: 'assistant', position: 0, content: 'ข้อความเดิม', contextSnapshot: { private: 'PRIVATE_MESSAGE_CONTEXT' } } });
      await db.aIPractice.create({ data: { accountId: accounts[role], conversationId: conversation.id, messageId: message.id,
        payloadSnapshot: { version: 1, private: 'PRIVATE_KEY', questions: [] } } });
      const usageDate = new Date('2026-10-10T00:00:00Z');
      await db.aIUsageDaily.create({ data: { accountId: accounts[role], usageDate, successCount: 20 } });
      await db.aIRequest.create({ data: { accountId: accounts[role], usageDate, conversationId: conversation.id,
        requestId: tag + role, payloadHash: 'PRIVATE_PAYLOAD_HASH', status: 'succeeded', finalizedAt: new Date('2026-10-10T12:00:00Z'),
        result: { private: 'PRIVATE_RESULT' } } });
    }
    for (const key of ['rollback', 'hidden', 'concurrent']) conversations[key] = (await db.aIConversation.create({ data: {
      accountId: accounts.learner, courseId: null, title: 'เดิม', deletedAt: key === 'hidden' ? new Date() : null, contextSnapshot: {} } })).id;
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.init();
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
      await db.account.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('renames an owned general conversation with exact canonical persisted metadata and DB activity time', async () => {
    const before = await stored(), response = await rename('ชื่อแชตใหม่').expect(200);
    assertTaskContract('AI-05', 'WireAiConversation', response.body);
    const after = await stored();
    expect(response.body).toEqual({ id: before.id, title: 'ชื่อแชตใหม่', course_id: null,
      created_at: before.createdAt.toISOString(), updated_at: after.updatedAt.toISOString() });
    expect(after.contextSnapshot).toEqual(before.contextSnapshot); expect(after.accountId).toBe(before.accountId);
    expect(after.createdAt).toEqual(before.createdAt); expect(after.deletedAt).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_');
  });
  it('accepts exactly 80 Unicode code points and preserves valid input without undocumented normalization', async () => {
    const title = '🙂'.repeat(80); const response = await rename(title).expect(200);
    assertTaskContract('AI-05', 'WireAiConversation', response.body); expect((await stored()).title).toBe(title);
    await rename('  ชื่อที่ผู้ใช้ระบุ  ').expect(200); expect((await stored()).title).toBe('  ชื่อที่ผู้ใช้ระบุ  ');
  });
  it('rejects empty/blank/81-code-point/missing/null/non-string titles and extra ownership/context fields without writes', async () => {
    const before = await stored();
    for (const body of [{}, [], { title: '' }, { title: ' \t\n' }, { title: '🙂'.repeat(81) }, { title: null }, { title: 1 },
      { title: 'forged', account_id: accounts.admin, course_id: randomUUID(), contextSnapshot: {} }]) {
      const response = await request(app.getHttpServer()).patch('/api/v1/me/ai/conversations/' + conversations.learner)
        .set('x-melearn-app', 'web').set('Cookie', `melearn_web_session=${secrets.learner_web}`).send(body).expect(422);
      assertErrorContract(response.body);
    }
    await request(app.getHttpServer()).patch('/api/v1/me/ai/conversations/' + conversations.learner).set('x-melearn-app', 'web')
      .set('Cookie', `melearn_web_session=${secrets.learner_web}`).set('Content-Type', 'application/json').send('{broken').expect(400);
    expect(await stored()).toEqual(before);
  });
  it('hides foreign conversations from Instructor and Admin and does not modify their titles', async () => {
    const before = await stored();
    await rename('forged', 'learner', 'instructor').expect(404); await rename('forged', 'learner', 'admin', 'admin').expect(404);
    expect(await stored()).toEqual(before);
  });
  it('allows own Instructor/Admin history rename even when learning eligibility is not granted', async () => {
    await rename('ชื่อผู้สอน', 'instructor', 'instructor').expect(200);
    for (const audience of ['web', 'admin']) await rename('ชื่อแอดมิน', 'admin', 'admin', audience).expect(200);
  });
  it('unknown and already-hidden conversations return404 without resurrection or replacement rows', async () => {
    const before = await stored('hidden'), beforeCounts = await counts();
    await rename('new', 'hidden').expect(404);
    await request(app.getHttpServer()).patch('/api/v1/me/ai/conversations/' + randomUUID()).set('x-melearn-app', 'web')
      .set('Cookie', `melearn_web_session=${secrets.learner_web}`).send({ title: 'new' }).expect(404);
    expect(await stored('hidden')).toEqual(before); expect(await counts()).toEqual(beforeCounts);
  });
  it('denies anonymous and non-Admin Admin sessions and expired/revoked/disabled identities', async () => {
    await request(app.getHttpServer()).patch('/api/v1/me/ai/conversations/' + conversations.learner).set('x-melearn-app', 'web').send({ title: 'x' }).expect(401);
    await rename('x', 'learner', 'learner', 'admin').expect(403);
    const tokenHash = createHash('sha256').update(secrets.learner_web).digest('hex').toUpperCase();
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: new Date() } }); await rename('x').expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null, expiresAt: new Date(0) } }); await rename('x').expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() + 3600000) } });
    await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } });
    try { await rename('x').expect(401); } finally { await db.account.update({ where: { id: accounts.learner }, data: { disabled: false } }); }
  });
  it('fresh authority rejects post-guard disable before the rename write', async () => {
    const service = app.get(RenameConversationService), original = service.rename.bind(service), before = await stored();
    const spy = jest.spyOn(service, 'rename').mockImplementationOnce(async (...args) => {
      await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } }); return original(...args);
    });
    try { await rename('x').expect(401); expect(await stored()).toEqual(before); }
    finally { spy.mockRestore(); await db.account.update({ where: { id: accounts.learner }, data: { disabled: false } }); }
  });
  it('reconnect/repeated rename retains all message/practice/request/quota proofs and model counts', async () => {
    const before = await history(), beforeCounts = await counts();
    await db.$disconnect(); await db.$connect();
    await rename('ชื่อหลัง reconnect').expect(200); await rename('ชื่อหลัง reconnect').expect(200);
    expect((await stored()).title).toBe('ชื่อหลัง reconnect'); expect(await history()).toEqual(before); expect(await counts()).toEqual(beforeCounts);
  });
  it('an actual PostgreSQL error after the write rolls back both title/activity with a safe500', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma), before = await stored('rollback');
    const failing = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await callback(tx); await tx.$queryRaw`SELECT 1/0`; }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(failing), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const response = await rename('new', 'rollback').expect(500); assertErrorContract(response.body);
      expect(await stored('rollback')).toEqual(before); expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|division|postgresql/);
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('practice answer after rename preserves the manual title and original immutable definition', async () => {
    const message = await db.aIMessage.create({ data: { accountId: accounts.learner, conversationId: conversations.concurrent,
      role: 'assistant', position: 0, content: 'โจทย์เดิม', contextSnapshot: {} } });
    const payload = { version: 1, questions: [{ id: 'q', prompt: 'โจทย์', options: [{ id: 'right', text: 'ถูก' }],
      correct_option_id: 'right', explanation: 'เหตุผล' }] };
    const practice = await db.aIPractice.create({ data: { accountId: accounts.learner, conversationId: conversations.concurrent,
      messageId: message.id, payloadSnapshot: payload } });
    await rename('ชื่อผู้ใช้ตั้งเอง', 'concurrent').expect(200);
    await request(app.getHttpServer()).put('/api/v1/me/ai/conversations/' + conversations.concurrent + '/messages/' + message.id + '/practice/answers')
      .set('x-melearn-app', 'web').set('Cookie', `melearn_web_session=${secrets.learner_web}`).send({ question_id: 'q', option_id: 'right' }).expect(200);
    expect((await stored('concurrent')).title).toBe('ชื่อผู้ใช้ตั้งเอง');
    expect((await db.aIPractice.findUniqueOrThrow({ where: { id: practice.id } })).payloadSnapshot).toEqual(payload);
  });
  it('a competing history mutation waits for the rename transaction instead of clobbering its snapshot', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma);
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), held = new Promise<void>(resolve => { ready = resolve; });
    const changing = new Promise<void>(resolve => { started = resolve; });
    const hold = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { const result = await callback(tx); ready(); await gate; return result; }, { ...options, timeout: 15000 })) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(hold);
    const command = rename('ชื่อสุดท้าย', 'concurrent').then(response => response); await held;
    const mutation = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid; started();
      await tx.aIConversation.update({ where: { id: conversations.concurrent }, data: { updatedAt: new Date() } });
    }, { timeout: 15000 }); await changing;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); expect((await command).status).toBe(200); await mutation;
      expect((await stored('concurrent')).title).toBe('ชื่อสุดท้าย');
    } finally { release(); await Promise.allSettled([command, mutation]); spy.mockRestore(); }
  });
});
