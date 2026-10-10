import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { AiUsageService } from '../../src/features/ai/ai-usage.service';
import { quotaWindow } from '../../src/features/ai/quota-window';
import { PrismaService } from '../../src/prisma/prisma.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('AI-03 own daily usage / actual HTTP, database clock, no quota or provider writes', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  let today: Date, resetAt: Date;
  const tag = 'ai_usage_' + randomUUID(), previousUrl = process.env.DATABASE_URL;
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {};
  const get = (name = 'learner', audience = 'web') => request(app.getHttpServer()).get('/api/v1/me/ai/usage')
    .set('x-melearn-app', audience).set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`);
  const countAll = () => Promise.all(Object.values(Prisma.ModelName).map(name => (db as any)[name[0].toLowerCase() + name.slice(1)].count()));
  const snapshots = () => Promise.all([
    db.aIUsageDaily.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: [{ accountId: 'asc' }, { usageDate: 'asc' }] }),
    db.aIRequest.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { id: 'asc' } }),
  ]);
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    const instant = (await db.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
    const window = await quotaWindow(db, instant); today = window.usageDate; resetAt = window.resetAt;
    for (const name of ['learner', 'instructor', 'admin', 'unused']) {
      const role = name === 'unused' ? 'learner' : name;
      accounts[name] = (await db.account.create({ data: { displayName: tag + name, origin: 'self_email', emailVerified: false,
        roles: role === 'admin' ? 'learner' : 'admin', roleGrants: { create: { role } } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[name + '_' + audience] = secret;
        await db.appSession.create({ data: { accountId: accounts[name], audience, expiresAt: new Date(Date.now() + 3600000),
          tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase() } });
      }
      const yesterday = new Date(today); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      await db.aIUsageDaily.create({ data: { accountId: accounts[name], usageDate: yesterday, successCount: 19, pendingCount: 1 } });
      await db.aIRequest.create({ data: { accountId: accounts[name], usageDate: yesterday, requestId: tag + name,
        payloadHash: 'PRIVATE_QUOTA_HASH', status: 'pending', result: { private: 'PRIVATE_PREVIOUS_DAY_CONTEXT' } } });
      if (name !== 'unused') await db.aIUsageDaily.create({ data: { accountId: accounts[name], usageDate: today,
        successCount: name === 'learner' ? 7 : name === 'instructor' ? 9 : 20, pendingCount: name === 'learner' ? 2 : 0 } });
    }
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      const ids = Object.values(accounts);
      await db.aIRequest.deleteMany({ where: { accountId: { in: ids } } });
      await db.aIUsageDaily.deleteMany({ where: { accountId: { in: ids } } });
      await db.appSession.deleteMany({ where: { accountId: { in: ids } } });
      await db.userRole.deleteMany({ where: { accountId: { in: ids } } });
      await db.account.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('uses stored successful prompts only and returns the exact canonical own projection', async () => {
    const response = await get().expect(200); assertTaskContract('AI-03', 'WireAiUsage', response.body);
    expect(response.body).toEqual({ limit: 20, used: 7, remaining: 13, reset_at: resetAt.toISOString() });
    expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_|accountId|pendingCount|usageDate/);
  });
  it('missing today returns fresh remaining capacity without inserting or resetting historical pending work', async () => {
    const before = await snapshots(), counts = await countAll();
    expect((await get('unused').expect(200)).body).toEqual({ limit: 20, used: 0, remaining: 20, reset_at: resetAt.toISOString() });
    expect(await snapshots()).toEqual(before); expect(await countAll()).toEqual(counts);
    expect(await db.aIUsageDaily.findUnique({ where: { accountId_usageDate: { accountId: accounts.unused, usageDate: today } } })).toBeNull();
  });
  it('Instructor and Admin receive their own account usage with the same limit and no role exemption', async () => {
    expect((await get('instructor').expect(200)).body).toEqual({ limit: 20, used: 9, remaining: 11, reset_at: resetAt.toISOString() });
    for (const audience of ['web', 'admin']) expect((await get('admin', audience).expect(200)).body)
      .toEqual({ limit: 20, used: 20, remaining: 0, reset_at: resetAt.toISOString() });
  });
  it('client account/date/count claims cannot select another account or overwrite usage', async () => {
    const before = await snapshots();
    const response = await request(app.getHttpServer()).get('/api/v1/me/ai/usage').query({ account_id: accounts.admin,
      usage_date: '2099-01-01', used: 0, remaining: 999 }).set('x-melearn-app', 'web')
      .set('Cookie', `melearn_web_session=${secrets.learner_web}`).expect(200);
    expect(response.body.used).toBe(7); expect(response.body.remaining).toBe(13); expect(await snapshots()).toEqual(before);
  });
  it('rejects anonymous, wrong app namespace and non-Admin admin sessions', async () => {
    assertErrorContract((await request(app.getHttpServer()).get('/api/v1/me/ai/usage').set('x-melearn-app', 'web').expect(401)).body);
    await get('learner', 'admin').expect(403);
    await request(app.getHttpServer()).get('/api/v1/me/ai/usage').set('x-melearn-app', 'admin')
      .set('Cookie', `melearn_web_session=${secrets.learner_web}`).expect(401);
  });
  it('denies disabled accounts and expired/revoked sessions even when quota exists', async () => {
    const tokenHash = createHash('sha256').update(secrets.learner_web).digest('hex').toUpperCase();
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: new Date() } }); await get().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null, expiresAt: new Date(0) } }); await get().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() + 3600000) } });
    await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } });
    try { await get().expect(401); } finally { await db.account.update({ where: { id: accounts.learner }, data: { disabled: false } }); }
  });
  it('fresh transaction authority rejects a post-guard disabled account before reading quota', async () => {
    const service = app.get(AiUsageService), original = service.read.bind(service), before = await snapshots();
    const spy = jest.spyOn(service, 'read').mockImplementationOnce(async reference => {
      await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } }); return original(reference);
    });
    try { await get().expect(401); expect(await snapshots()).toEqual(before); }
    finally { spy.mockRestore(); await db.account.update({ where: { id: accounts.learner }, data: { disabled: false } }); }
  });
  it('reconnect preserves original daily counters/requests, including old-day pending reservations', async () => {
    const before = await snapshots(); await db.$disconnect(); await db.$connect();
    expect((await get().expect(200)).body.used).toBe(7); expect(await snapshots()).toEqual(before);
  });
  it('simultaneous reads never reserve, consume, release or mutate any model', async () => {
    const before = await snapshots(), counts = await countAll();
    const responses = await Promise.all(Array.from({ length: 5 }, () => get()));
    responses.forEach(response => expect(response.body).toEqual({ limit: 20, used: 7, remaining: 13, reset_at: resetAt.toISOString() }));
    expect(await snapshots()).toEqual(before); expect(await countAll()).toEqual(counts);
  });
  it('actual database failure returns safe 500 instead of fabricated unused quota', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma), before = await snapshots();
    const failing = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await tx.$queryRaw`SELECT 1/0`; return callback(tx); }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(failing), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const response = await get().expect(500); assertErrorContract(response.body);
      expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|division|postgresql/);
      expect(await snapshots()).toEqual(before);
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  it.each(['UTC', 'Pacific/Honolulu'])('computes Thai midnight/month/year/leap boundaries independent of database timezone %s', async zone => {
    const cases = [
      ['2026-10-10T16:59:59.999Z', '2026-10-10', '2026-10-10T17:00:00.000Z'],
      ['2026-10-10T17:00:00.000Z', '2026-10-11', '2026-10-11T17:00:00.000Z'],
      ['2026-12-31T17:00:00.000Z', '2027-01-01', '2027-01-01T17:00:00.000Z'],
      ['2028-02-28T17:00:00.000Z', '2028-02-29', '2028-02-29T17:00:00.000Z'],
      ['2028-02-29T17:00:00.000Z', '2028-03-01', '2028-03-01T17:00:00.000Z'],
    ];
    await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT set_config('TimeZone', ${zone}, true)`);
      for (const [instant, date, reset] of cases) {
        const window = await quotaWindow(tx, new Date(instant));
        expect(window.usageDate.toISOString().slice(0, 10)).toBe(date); expect(window.resetAt.toISOString()).toBe(reset);
      }
    });
  });
});
