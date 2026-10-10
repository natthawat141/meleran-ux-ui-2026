import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { OwnPaymentReadService } from '../../src/features/payments/own-payment-read.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('PAY-01 own status / real HTTP, bounded historical projection, no fulfillment', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication, courseId: string, enrollmentId: string;
  const previousUrl = process.env.DATABASE_URL, tag = 'payment_read_' + randomUUID();
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {}, payments: Record<string, string> = {};
  const hash = (secret: string) => createHash('sha256').update(secret).digest('hex').toUpperCase();
  const read = (id = payments.pending, name = 'learner', audience = 'web') => request(app.getHttpServer())
    .get('/api/v1/me/payments/' + encodeURIComponent(id)).set('x-melearn-app', audience)
    .set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`);
  const counts = () => Promise.all(Object.values(Prisma.ModelName).map(name => (db as any)[name[0].toLowerCase() + name.slice(1)].count()));
  const stored = () => Promise.all([
    db.payment.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { id: 'asc' } }),
    db.paymentEvent.findMany({ where: { paymentId: { in: Object.values(payments) } }, orderBy: { eventId: 'asc' } }),
    db.enrollment.findMany({ where: { courseId }, orderBy: { id: 'asc' } }),
    db.appSession.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { tokenHash: 'asc' } }),
  ]);
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const role of ['learner', 'instructor', 'admin']) {
      accounts[role] = (await db.account.create({ data: { displayName: tag + role, origin: 'self_email', emailVerified: false,
        roles: role === 'admin' ? 'learner' : 'admin', roleGrants: { create: { role } } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[role + '_' + audience] = secret;
        await db.appSession.create({ data: { accountId: accounts[role], audience, expiresAt: new Date(Date.now() + 3600000), tokenHash: hash(secret) } });
      }
    }
    courseId = (await db.course.create({ data: { instructorId: accounts.instructor, slug: tag, title: 'ประวัติการซื้อ',
      category: 'test', level: 'test', status: 'archived', priceMinor: 999900 } })).id;
    enrollmentId = (await db.enrollment.create({ data: { accountId: accounts.learner, courseId, source: 'redeem',
      grantedAt: new Date('2026-10-01T00:00:00Z') } })).id;
    for (const status of ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired']) {
      payments[status] = (await db.payment.create({ data: { accountId: accounts.learner, courseId, requestId: tag + status,
        payloadHash: 'PRIVATE_PAYLOAD_HASH', amountMinor: 12300, status, paidAt: status === 'succeeded' ? new Date() : null } })).id;
    }
    for (const [name, accountId, fulfillmentStatus] of [['granted', accounts.learner, 'granted'],
      ['fulfillment_failed', accounts.learner, 'failed'], ['instructor', accounts.instructor, 'pending'],
      ['admin', accounts.admin, 'pending']]) {
      payments[name] = (await db.payment.create({ data: { accountId, courseId, requestId: tag + name, amountMinor: 12300,
        payloadHash: 'PRIVATE_PAYLOAD_HASH', status: 'succeeded', paidAt: new Date(), fulfillmentStatus,
        enrollmentId: name === 'granted' ? enrollmentId : null, checkoutSessionId: 'cs_PRIVATE_' + tag + name,
        paymentIntentId: 'pi_PRIVATE_' + tag + name } })).id;
    }
    await db.paymentEvent.create({ data: { eventId: tag, type: 'checkout.session.completed', paymentId: payments.pending,
      eventSnapshot: { private: 'PRIVATE_PROVIDER_PROOF' } } });
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.init();
  });
  beforeEach(async () => {
    await db.appSession.updateMany({ where: { accountId: { in: Object.values(accounts) } }, data: { revokedAt: null, expiresAt: new Date(Date.now() + 3600000) } });
    await db.account.updateMany({ where: { id: { in: Object.values(accounts) } }, data: { disabled: false } });
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      await db.paymentEvent.deleteMany({ where: { paymentId: { in: Object.values(payments) } } });
      await db.payment.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      if (enrollmentId) await db.enrollment.deleteMany({ where: { id: enrollmentId } });
      if (courseId) await db.course.deleteMany({ where: { id: courseId } });
      const ids = Object.values(accounts);
      await db.appSession.deleteMany({ where: { accountId: { in: ids } } }); await db.userRole.deleteMany({ where: { accountId: { in: ids } } });
      await db.account.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });

  it.each(['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired'])('projects stored %s with canonical nullable enrollment without granting existing unrelated rights', async status => {
    const before = await stored(), modelCounts = await counts();
    const response = await read(payments[status]).expect(200); assertTaskContract('PAY-01', 'WirePaymentView', response.body);
    expect(response.body).toEqual({ payment_id: payments[status], course_id: courseId, status, fulfillment_status: 'pending', enrollment: null });
    expect(await stored()).toEqual(before); expect(await counts()).toEqual(modelCounts);
  });
  it('succeeded money with failed fulfillment stays visible without provider retry or another charge', async () => {
    const before = await stored(); const response = await read(payments.fulfillment_failed).expect(200);
    assertTaskContract('PAY-01', 'WirePaymentView', response.body); expect(response.body.status).toBe('succeeded');
    expect(response.body.fulfillment_status).toBe('failed'); expect(response.body.enrollment).toBeNull(); expect(await stored()).toEqual(before);
  });
  it('projects the linked lifetime enrollment preserving the original Redeem source', async () => {
    const response = await read(payments.granted).expect(200); assertTaskContract('PAY-01', 'WirePaymentView', response.body);
    expect(response.body.enrollment).toEqual({ id: enrollmentId, course_id: courseId, source: 'redeem', access: 'lifetime', granted_at: '2026-10-01T00:00:00.000Z' });
    expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_|amount|request_id|checkout|paymentIntent|payloadHash|events|accountId/);
  });
  it('uses self ownership for all normalized roles; buying eligibility and current Course ownership/visibility cannot erase historical status', async () => {
    await read(payments.instructor, 'instructor').expect(200); await read(payments.admin, 'admin').expect(200);
    await read(payments.admin, 'admin', 'admin').expect(200);
    expect((await db.account.findUniqueOrThrow({ where: { id: accounts.learner } })).emailVerified).toBe(false);
    await read().expect(200);
  });
  it('foreign Instructor/Admin and malformed/unknown IDs return the same non-disclosing404', async () => {
    for (const [id, actor, audience] of [[payments.pending, 'instructor', 'web'], [payments.pending, 'admin', 'admin'],
      [randomUUID(), 'learner', 'web'], ['not-a-uuid', 'learner', 'web']]) {
      const response = await read(id, actor, audience).expect(404); assertErrorContract(response.body);
      expect(response.body.error.code).toBe('not_found'); expect(JSON.stringify(response.body)).not.toContain(payments.pending);
    }
  });
  it('anonymous, forged app namespace and non-Admin Admin session cannot read financial state', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/payments/' + payments.pending).set('x-melearn-app', 'web').expect(401);
    await read().set('x-melearn-app', 'other').expect(403); await read(payments.pending, 'learner', 'admin').expect(403);
  });
  it('expired, revoked and disabled sessions fail before private payment fields are exposed', async () => {
    const tokenHash = hash(secrets.learner_web);
    for (const data of [{ expiresAt: new Date(0) }, { expiresAt: new Date(Date.now() + 3600000), revokedAt: new Date() }]) {
      await db.appSession.update({ where: { tokenHash }, data }); const response = await read().expect(401); assertErrorContract(response.body);
    }
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null } });
    await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } }); await read().expect(401);
  });
  it('post-guard disable is rechecked inside the financial read transaction', async () => {
    const service = app.get(OwnPaymentReadService), original = service.read.bind(service);
    const spy = jest.spyOn(service, 'read').mockImplementationOnce(async (reference, id) => {
      await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } }); return original(reference, id);
    });
    try { await read().expect(401); } finally { spy.mockRestore(); }
  });
  it('success URL claims, repeated polls, concurrent tabs and reconnect cannot alter any payment, event, grant or session', async () => {
    const before = await stored(), modelCounts = await counts();
    const responses = await Promise.all([read().query({ status: 'succeeded', fulfillment_status: 'granted', user_id: accounts.admin }), read(), read()]);
    for (const response of responses) { expect(response.status).toBe(200); expect(response.body.status).toBe('pending'); expect(response.body.enrollment).toBeNull(); }
    await db.$disconnect(); await db.$connect(); await read().expect(200);
    expect(await stored()).toEqual(before); expect(await counts()).toEqual(modelCounts);
  });
  it('real SQL failure returns masked canonical500 without synthetic payment, repair or private diagnostics', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma), before = await stored();
    const failing = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await callback(tx); await tx.$queryRaw`SELECT 1/0`; }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(failing), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { const response = await read().expect(500); assertErrorContract(response.body); expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|division|postgresql/); expect(await stored()).toEqual(before); }
    finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('financial writer waits on actual PostgreSQL locks until the held coherent status read commits', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma);
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), held = new Promise<void>(resolve => { ready = resolve; });
    const changing = new Promise<void>(resolve => { started = resolve; });
    const hold = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { const result = await callback(tx); ready(); await gate; return result; }, { ...options, timeout: 15000 })) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(hold);
    const reading = read().then(response => response); await held;
    const mutation = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid; started();
      await tx.payment.update({ where: { id: payments.pending }, data: { status: 'processing' } });
    }, { timeout: 15000 }); await changing;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); expect((await reading).body.status).toBe('pending'); await mutation;
      expect((await read().expect(200)).body.status).toBe('processing');
    } finally { release(); await Promise.allSettled([reading, mutation]); spy.mockRestore(); }
  });
});
