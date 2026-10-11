import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { RedeemWriter } from '../../src/features/redeem/redeem-writer.service';
import { RevokeCodeService } from '../../src/features/redeem/revoke-code.service';
import { CodeIssuanceService } from '../../src/features/redeem/code-issuance.service';
import { RedeemCodeService } from '../../src/features/redeem/redeem-code.service';
import { EntitlementWriter } from '../../src/features/enrollments/public/index';
import { PrincipalService } from '../../src/features/auth/public/index';
import { PrismaService } from '../../src/prisma/prisma.service';
import { testConnections } from '../support/postgres';
import { assertTaskContract, assertErrorContract } from '../support/contract-validator';

describe('REDEEM-01 revoke HTTP / REDEEM-02 internal transaction / Test PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication, writer: RedeemWriter;
  const tag = 'redeem_tx_' + randomUUID(), previousUrl = process.env.DATABASE_URL;
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {};
  const courses: string[] = [];
  const reference = (name: string) => ({ tokenHash: createHash('sha256').update(secrets[name + '_web']).digest('hex').toUpperCase(), audience: 'web' as const });
  const revoke = (id: string, name = 'admin', audience = 'admin') => request(app.getHttpServer())
    .post('/api/v1/admin/redeem-codes/' + id + '/revoke').set('x-melearn-app', audience)
    .set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`);
  const codeRow = (id: string) => db.redeemCode.findUniqueOrThrow({ where: { id } });
  async function course() {
    const row = await db.course.create({ data: { slug: tag + courses.length, title: tag, category: 'test', level: 'test',
      instructorId: accounts.instructor, status: 'published', publishedAt: new Date(), priceMinor: 12000 } });
    courses.push(row.id); return row.id;
  }
  async function code(courseId = courses[0]) {
    return db.redeemCode.create({ data: { code: tag + '_PRIVATE_' + randomUUID(), courseId, issuedBy: accounts.admin,
      issuedAt: new Date('2000-01-01T00:00:00Z') } });
  }
  // Trusted test caller supplies fresh authority and known allowed-course context.
  // It is NOT a public Redeem request/lifecycle/normalization implementation.
  const redeem = (id: string, courseId: string, name = 'learner') => db.$transaction(async tx => {
    const principal = await app.get(PrincipalService).requireLearning(tx, reference(name));
    await tx.$queryRaw`SELECT id FROM courses WHERE id=${courseId} FOR SHARE`;
    return writer.redeem(tx, id, principal.accountId, courseId);
  });
  async function academic() {
    return Promise.all([db.enrollment.findMany({ where: { courseId: { in: courses } }, orderBy: { id: 'asc' } }),
      db.progress.findMany({ where: { courseId: { in: courses } }, orderBy: { id: 'asc' } }),
      db.certificate.findMany({ where: { enrollment: { courseId: { in: courses } } }, orderBy: { id: 'asc' } }),
      db.payment.findMany({ where: { courseId: { in: courses } }, orderBy: { id: 'asc' } })]);
  }
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const name of ['admin', 'admin2', 'learner', 'learner2', 'instructor']) {
      const role = name.replace(/2$/, '');
      accounts[name] = (await db.account.create({ data: { displayName: tag + name, roles: role === 'admin' ? 'learner' : 'admin',
        roleGrants: { create: { role } } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[name + '_' + audience] = secret;
        await db.appSession.create({ data: { accountId: accounts[name], audience,
          tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase(), expiresAt: new Date(Date.now() + 3600000) } });
      }
    }
    await course(); process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.listen(0, '127.0.0.1');
    writer = app.get(RedeemWriter);
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      await db.redeemCode.deleteMany({ where: { courseId: { in: courses } } });
      await db.certificate.deleteMany({ where: { enrollment: { courseId: { in: courses } } } });
      await db.progress.deleteMany({ where: { courseId: { in: courses } } }); await db.enrollment.deleteMany({ where: { courseId: { in: courses } } });
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await db.appSession.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.userRole.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.account.deleteMany({ where: { id: { in: Object.values(accounts) } } }); await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('Admin revokes an old Unused code with canonical response and durable original audit, no academic/financial writes', async () => {
    const row = await code(), before = await academic();
    const response = await revoke(row.id).expect(200); assertTaskContract('REDEEM-01', 'RevokeCodeResponse', response.body);
    expect(response.body).toEqual({ id: row.id, status: 'revoked', revoked_at: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toContain(row.code); expect(response.headers['x-request-id']).toBeTruthy();
    await db.$disconnect(); await db.$connect();
    const stored = await codeRow(row.id);
    expect(stored).toMatchObject({ status: 'revoked', revokedBy: accounts.admin, revokedAt: new Date(response.body.revoked_at),
      usedBy: null, usedAt: null, enrollmentId: null, issuedAt: row.issuedAt, issuedBy: row.issuedBy, code: row.code });
    expect(await academic()).toEqual(before);
  });
  it('repeated revoke by another Admin returns original result without changing actor/time or any rows', async () => {
    const row = await code(), first = await revoke(row.id).send({}).expect(200), before = await codeRow(row.id);
    expect((await revoke(row.id, 'admin2').send({}).expect(200)).body).toEqual(first.body);
    expect(await codeRow(row.id)).toEqual(before);
  });
  it('Used cannot be revoked and its grant/history remain intact', async () => {
    const courseId = await course(), row = await code(courseId); await redeem(row.id, courseId);
    const before = await codeRow(row.id), history = await academic();
    const response = await revoke(row.id).expect(409); assertErrorContract(response.body);
    expect(response.body.error).toMatchObject({ code: 'invalid_state', details: { reason: 'used' } });
    expect(await codeRow(row.id)).toEqual(before); expect(await academic()).toEqual(history);
  });
  it('unknown ID returns safe canonical 404 without disclosing codes', async () => {
    const response = await revoke('unknown-' + tag).expect(404); assertErrorContract(response.body);
    expect(response.body.error.code).toBe('not_found'); expect(JSON.stringify(response.body)).not.toContain('_PRIVATE_');
  });
  it('anonymous and Web sessions cannot revoke, including an Admin using the Web cookie', async () => {
    const row = await code(); await request(app.getHttpServer()).post('/api/v1/admin/redeem-codes/' + row.id + '/revoke').expect(401);
    for (const name of ['learner', 'instructor', 'admin']) await revoke(row.id, name, 'web').expect(401);
    expect((await codeRow(row.id)).status).toBe('unused');
  });
  it('normalized roles override forged compatibility Admin role; learner/Instructor Admin-audience fixtures are denied', async () => {
    const row = await code(); for (const name of ['learner', 'instructor']) await revoke(row.id, name).expect(403);
    expect((await codeRow(row.id)).status).toBe('unused');
  });
  it('wrong app header and client role/actor claims never confer revoke permission', async () => {
    const row = await code(); await revoke(row.id).set('x-melearn-app', 'web').expect(403);
    await revoke(row.id, 'learner').set('x-role', 'admin').send({ revoked_by: accounts.admin }).expect(403);
    expect((await codeRow(row.id)).status).toBe('unused');
  });
  it('expired and revoked Admin sessions cannot transition a code', async () => {
    const row = await code(), tokenHash = createHash('sha256').update(secrets.admin2_admin).digest('hex').toUpperCase();
    const session = await db.appSession.findUniqueOrThrow({ where: { tokenHash } });
    try {
      await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(0) } }); await revoke(row.id, 'admin2').expect(401);
      await db.appSession.update({ where: { tokenHash }, data: { expiresAt: session.expiresAt, revokedAt: new Date() } });
      await revoke(row.id, 'admin2').expect(401); expect((await codeRow(row.id)).status).toBe('unused');
    } finally { await db.appSession.update({ where: { tokenHash }, data: { expiresAt: session.expiresAt, revokedAt: null } }); }
  });
  it('EmptyRequest rejects null/array/string/additional fields without a transition', async () => {
    const row = await code();
    for (const body of [null, [], 'value', { status: 'revoked' }, { revoked_by: accounts.admin }]) {
      // Express strict JSON rejects primitive roots before DTO validation;
      // object/array roots reach the canonical EmptyRequest pipe.
      const status = body === null || typeof body === 'string' ? 400 : 422;
      const response = await revoke(row.id).set('Content-Type', 'application/json').send(JSON.stringify(body)).expect(status);
      assertErrorContract(response.body);
    }
    expect((await codeRow(row.id)).status).toBe('unused');
  });
  it('concurrent Admin revokes converge on one original timestamp/actor', async () => {
    const row = await code(); const responses = await Promise.all(['admin', 'admin2', 'admin', 'admin2'].map(name => revoke(row.id, name)));
    expect(responses.map(response => response.status)).toEqual([200, 200, 200, 200]);
    for (const response of responses) expect(response.body).toEqual(responses[0].body);
    const stored = await codeRow(row.id); expect([accounts.admin, accounts.admin2]).toContain(stored.revokedBy);
    expect(stored.revokedAt?.toISOString()).toBe(responses[0].body.revoked_at);
  });
  it('failure after actual revoke SQL rolls back and emits safe 500', async () => {
    const row = await code(), before = await codeRow(row.id), original = writer.revoke.bind(writer);
    const spy = jest.spyOn(writer, 'revoke').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('PRIVATE_SQL_FAILURE'); });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const response = await revoke(row.id).expect(500); assertErrorContract(response.body);
      expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_SQL_FAILURE');
      expect(await codeRow(row.id)).toEqual(before);
    } finally { spy.mockRestore(); log.mockRestore(); }
    await revoke(row.id).expect(200);
  });
  it('role removed after route guard is revalidated in the resource transaction before any code write', async () => {
    const row = await code(), service = app.get(RevokeCodeService), original = service.revoke.bind(service);
    const spy = jest.spyOn(service, 'revoke').mockImplementationOnce(async (...args) => {
      await db.userRole.deleteMany({ where: { accountId: accounts.admin2, role: 'admin' } }); return original(...args);
    });
    try { await revoke(row.id, 'admin2').expect(403); expect((await codeRow(row.id)).status).toBe('unused'); }
    finally { spy.mockRestore(); await db.userRole.create({ data: { accountId: accounts.admin2, role: 'admin' } }); }
  });
  it('holds fresh Admin authority through commit so disabling the actor waits, then subsequent request is denied', async () => {
    const row = await code(); let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), locked = new Promise<void>(resolve => { ready = resolve; });
    const changing = new Promise<void>(resolve => { started = resolve; }), original = writer.revoke.bind(writer);
    const spy = jest.spyOn(writer, 'revoke').mockImplementationOnce(async (...args) => { ready(); await gate; return original(...args); });
    const command = revoke(row.id, 'admin2').then(response => response); await locked;
    const mutation = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      started(); await tx.account.update({ where: { id: accounts.admin2 }, data: { disabled: true } });
    }, { timeout: 10000 }); await changing;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); expect((await command).status).toBe(200); await mutation;
      await revoke(row.id, 'admin2').expect(401);
    } finally {
      release(); await Promise.allSettled([command, mutation]); spy.mockRestore();
      await db.account.update({ where: { id: accounts.admin2 }, data: { disabled: false } });
    }
  });
  it('internal redeem consumes old Unused code and commits one same-course grant/audit with canonical result', async () => {
    const courseId = await course(), row = await code(courseId), result = await redeem(row.id, courseId);
    assertTaskContract('REDEEM-02', 'WireRedeemResult', result);
    expect(result).toMatchObject({ already_enrolled: false, enrollment: { course_id: courseId, source: 'redeem', access: 'lifetime' } });
    const stored = await codeRow(row.id);
    expect(stored).toMatchObject({ status: 'used', usedBy: accounts.learner, enrollmentId: result.enrollment.id, issuedAt: row.issuedAt,
      usedAt: expect.any(Date), revokedBy: null, revokedAt: null });
    await db.$disconnect(); await db.$connect();
    expect(await codeRow(row.id)).toEqual(stored); expect(await db.enrollment.count({ where: { courseId } })).toBe(1);
    expect(await db.progress.count({ where: { courseId } })).toBe(0); expect(await db.payment.count({ where: { courseId } })).toBe(0);
  });
  it('existing Stripe enrollment/history returns unchanged and leaves fresh code Unused', async () => {
    const courseId = await course(), row = await code(courseId);
    const enrollment = await db.enrollment.create({ data: { accountId: accounts.learner, courseId, source: 'stripe',
      grantedAt: new Date('2001-01-01T00:00:00Z'), completedAt: new Date('2002-01-01T00:00:00Z'), completedItems: 3,
      completionSnapshot: { preserved: true } } });
    await db.certificate.create({ data: { enrollmentId: enrollment.id, code: tag + courseId, recipientName: tag, courseName: tag } });
    const history = await academic();
    const result = await redeem(row.id, courseId); assertTaskContract('REDEEM-02', 'WireRedeemResult', result);
    expect(result).toMatchObject({ already_enrolled: true, enrollment: { id: enrollment.id, source: 'stripe', granted_at: enrollment.grantedAt.toISOString() } });
    expect(await codeRow(row.id)).toEqual(row); expect(await academic()).toEqual(history);
  });
  it('same-code concurrent different accounts have one winner, one grant and correct usedBy link', async () => {
    const courseId = await course(), row = await code(courseId);
    const results = await Promise.allSettled(['learner', 'learner2'].map(name => redeem(row.id, courseId, name)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const stored = await codeRow(row.id), grants = await db.enrollment.findMany({ where: { courseId } });
    expect(grants).toHaveLength(1); expect(stored).toMatchObject({ status: 'used', enrollmentId: grants[0].id, usedBy: grants[0].accountId });
  });
  it('two fresh codes for one account/course consume only the winner and preserve one original source', async () => {
    const courseId = await course(), rows = await Promise.all([code(courseId), code(courseId)]);
    const results = await Promise.all(rows.map(row => redeem(row.id, courseId)));
    expect(results.map(result => result.already_enrolled).sort()).toEqual([false, true]);
    expect(results[0].enrollment).toEqual(results[1].enrollment);
    expect((await db.redeemCode.findMany({ where: { courseId } })).map(row => row.status).sort()).toEqual(['unused', 'used']);
    expect(await db.enrollment.count({ where: { courseId } })).toBe(1);
  });
  it('grant failure and downstream failure after consumption both roll back to Unused/no grant; retry can succeed', async () => {
    const courseId = await course(), row = await code(courseId), grants = app.get(EntitlementWriter), original = grants.grantEntitlement.bind(grants);
    const spy = jest.spyOn(grants, 'grantEntitlement').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('grant failed'); });
    try { await expect(redeem(row.id, courseId)).rejects.toThrow('grant failed'); }
    finally { spy.mockRestore(); }
    expect(await codeRow(row.id)).toEqual(row); expect(await db.enrollment.count({ where: { courseId } })).toBe(0);
    await expect(db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM courses WHERE id=${courseId} FOR SHARE`;
      await writer.redeem(tx, row.id, accounts.learner, courseId); throw new Error('downstream failed');
    })).rejects.toThrow('downstream failed');
    expect(await codeRow(row.id)).toEqual(row); expect(await db.enrollment.count({ where: { courseId } })).toBe(0);
    expect((await redeem(row.id, courseId)).already_enrolled).toBe(false);
  });
  it('Used/Revoked/unknown/wrong-course participants never create a grant', async () => {
    const usedCourse = await course(), used = await code(usedCourse); await redeem(used.id, usedCourse);
    const revokedCourse = await course(), revoked = await code(revokedCourse); await revoke(revoked.id).expect(200);
    const fresh = await code(revokedCourse), history = await academic();
    for (const [id, courseId] of [[used.id, usedCourse], [revoked.id, revokedCourse], ['unknown-' + tag, usedCourse], [fresh.id, usedCourse]]) {
      await expect(redeem(id, courseId, 'learner2')).rejects.toMatchObject({ code: 'redeem_code_unavailable' });
    }
    expect(await academic()).toEqual(history); expect(await codeRow(fresh.id)).toEqual(fresh);
  });
  async function waitForBlockedBy(holder: number) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const rows = await migrator.$queryRaw<Array<{ blocked: boolean }>>`
        SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${holder}::integer=ANY(pg_blocking_pids(pid))) AS blocked`;
      if (rows[0].blocked) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Expected code lock wait was not observed');
  }
  it('revoke waits for in-flight redeem; after its commit Used remains and revoke is rejected', async () => {
    const courseId = await course(), row = await code(courseId); let release!: () => void, ready!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), locked = new Promise<void>(resolve => { ready = resolve; });
    const command = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM courses WHERE id=${courseId} FOR SHARE`;
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      const result = await writer.redeem(tx, row.id, accounts.learner, courseId); ready(); await gate; return result;
    }, { timeout: 10000 }); await locked;
    const revoking = revoke(row.id).then(response => response);
    try { await waitForBlockedBy(pid); release(); await command; expect((await revoking).status).toBe(409); }
    finally { release(); await Promise.allSettled([command, revoking]); }
    expect((await codeRow(row.id)).status).toBe('used'); expect(await db.enrollment.count({ where: { courseId } })).toBe(1);
  });
  it('redeem waits for in-flight Admin revoke; after its commit code stays Revoked and no grant is made', async () => {
    const courseId = await course(), row = await code(courseId); let release!: () => void, ready!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), locked = new Promise<void>(resolve => { ready = resolve; });
    const original = writer.revoke.bind(writer);
    const spy = jest.spyOn(writer, 'revoke').mockImplementationOnce(async (...args) => {
      pid = (await args[0].$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      const result = await original(...args); ready(); await gate; return result;
    });
    const revoking = revoke(row.id).then(response => response); await locked;
    // Install rejection handler immediately while the transaction is waiting.
    const redeeming = redeem(row.id, courseId).then(value => ({ value, error: null }), error => ({ value: null, error }));
    try {
      await waitForBlockedBy(pid); release(); expect((await revoking).status).toBe(200);
      expect((await redeeming).error).toMatchObject({ code: 'redeem_code_unavailable' });
    } finally { release(); await Promise.allSettled([revoking, redeeming]); spy.mockRestore(); }
    expect((await codeRow(row.id)).status).toBe('revoked'); expect(await db.enrollment.count({ where: { courseId } })).toBe(0);
  });
  const issueHttp = (body: object, name = 'admin', audience = 'admin') => request(app.getHttpServer()).post('/api/v1/admin/redeem-codes')
    .set('x-melearn-app', audience).set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`).send(body);
  const redeemHttp = (body: object, name = 'learner', audience = 'web') => request(app.getHttpServer()).post('/api/v1/me/redeem')
    .set('x-melearn-app', audience).set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`).send(body);
  it('issue creates unique Unused codes with server-bound Admin audit and no learner or academic changes', async () => {
    const courseId = await course(), before = await academic();
    const response = await issueHttp({ course_id: courseId, count: 3 }).expect(201); assertTaskContract('REDEEM-01', 'IssuedCodesResponse', response.body);
    expect(response.body.items).toHaveLength(3); expect(new Set(response.body.items.map((r: { code: string }) => r.code)).size).toBe(3);
    for (const item of response.body.items) { const row = await codeRow(item.id);
      expect(row).toMatchObject({ code: item.code, courseId, status: 'unused', issuedBy: accounts.admin, issuedAt: new Date(item.created_at),
        usedBy: null, usedAt: null, enrollmentId: null, revokedBy: null, revokedAt: null }); }
    expect(await academic()).toEqual(before);
  });
  it('issue omitted count creates one and the declared upper bound creates fifty atomically', async () => {
    const courseId = await course(); expect((await issueHttp({ course_id: courseId }).expect(201)).body.items).toHaveLength(1);
    const response = await issueHttp({ course_id: courseId, count: 50 }).expect(201); assertTaskContract('REDEEM-01', 'IssuedCodesResponse', response.body);
    expect(response.body.items).toHaveLength(50); expect(await db.redeemCode.count({ where: { courseId } })).toBe(51);
  });
  it('issue rejects free/hidden courses, invalid count and unknown fields without partial rows', async () => {
    const courseId = await course();
    for (const value of [{ course_id: courseId, count: 51 }, { course_id: courseId, count: null }, { course_id: courseId, issued_by: accounts.learner }]) {
      await issueHttp(value).expect(422);
    }
    await db.course.update({ where: { id: courseId }, data: { priceMinor: 0 } });
    const free = await issueHttp({ course_id: courseId }).expect(409); assertErrorContract(free.body); expect(free.body.error.details.reason).toBe('course_free');
    await db.course.update({ where: { id: courseId }, data: { status: 'draft' } }); await issueHttp({ course_id: courseId }).expect(404);
    await issueHttp({ course_id: 'unknown' }).expect(404); expect(await db.redeemCode.count({ where: { courseId } })).toBe(0);
  });
  it('issue enforces fresh normalized Admin and namespace authority', async () => {
    const courseId = await course(); await issueHttp({ course_id: courseId }, 'learner').expect(403);
    await issueHttp({ course_id: courseId }, 'admin', 'web').expect(401);
    await request(app.getHttpServer()).post('/api/v1/admin/redeem-codes').set('x-melearn-app', 'admin').send({ course_id: courseId }).expect(401);
    const service = app.get(CodeIssuanceService), original = service.issue.bind(service);
    const spy = jest.spyOn(service, 'issue').mockImplementationOnce(async (reference, input) => {
      await db.account.update({ where: { id: accounts.admin }, data: { disabled: true } }); return original(reference, input);
    });
    try { await issueHttp({ course_id: courseId }).expect(401); }
    finally { spy.mockRestore(); await db.account.update({ where: { id: accounts.admin }, data: { disabled: false } }); }
    expect(await db.redeemCode.count({ where: { courseId } })).toBe(0);
  });
  it('issue batch rolls back every created code on a real database failure', async () => {
    const courseId = await course(), prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma);
    const failing = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await callback(tx); await tx.$queryRaw`SELECT 1/0`; }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(failing), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { const response = await issueHttp({ course_id: courseId, count: 3 }).expect(500); assertErrorContract(response.body);
      expect(await db.redeemCode.count({ where: { courseId } })).toBe(0); expect(JSON.stringify(response.body)).not.toMatch(/division|postgresql/); }
    finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('public redeem grants exactly one lifetime entitlement and durably links the used actor/time/code', async () => {
    const courseId = await course(), row = await code(courseId);
    const response = await redeemHttp({ code: row.code }).expect(201); assertTaskContract('REDEEM-02', 'WireRedeemResult', response.body);
    expect(response.body.already_enrolled).toBe(false); expect(response.body.enrollment).toMatchObject({ course_id: courseId, source: 'redeem', access: 'lifetime' });
    await db.$disconnect(); await db.$connect();
    expect(await codeRow(row.id)).toMatchObject({ status: 'used', usedBy: accounts.learner, enrollmentId: response.body.enrollment.id, usedAt: expect.any(Date) });
    expect(await db.payment.count({ where: { courseId } })).toBe(0);
    expect(JSON.stringify(response.body)).not.toContain(row.code);
  });
  it('already enrolled returns the original grant with200 and does not consume the new code', async () => {
    const courseId = await course(), first = await code(courseId), second = await code(courseId);
    const initial = await redeemHttp({ code: first.code }).expect(201), response = await redeemHttp({ code: second.code }).expect(200);
    assertTaskContract('REDEEM-02', 'WireRedeemResult', response.body); expect(response.body.already_enrolled).toBe(true);
    expect(response.body.enrollment).toEqual(initial.body.enrollment); expect(await codeRow(second.id)).toEqual(second);
    await redeemHttp({ code: first.code }).expect(404); expect(await db.enrollment.count({ where: { courseId } })).toBe(1);
  });
  it('public redeem denies Admin, own course and unverified self accounts before consumption', async () => {
    const courseId = await course(), row = await code(courseId);
    await redeemHttp({ code: row.code }, 'admin').expect(403); await redeemHttp({ code: row.code }, 'admin', 'admin').expect(403);
    await redeemHttp({ code: row.code }, 'instructor').expect(403);
    await db.account.update({ where: { id: accounts.learner }, data: { origin: 'self_email', emailVerified: false } });
    try { const denied = await redeemHttp({ code: row.code }).expect(403); expect(denied.body.error.code).toBe('email_not_verified');
      const unknown = await redeemHttp({ code: 'unknown' }).expect(403); expect(unknown.body.error.code).toBe('email_not_verified'); }
    finally { await db.account.update({ where: { id: accounts.learner }, data: { origin: 'admin_created' } }); }
    expect(await codeRow(row.id)).toEqual(row); expect(await db.enrollment.count({ where: { courseId } })).toBe(0);
  });
  it('foreign Instructor may redeem while receiving no authoring ownership', async () => {
    const courseId = await course(), row = await code(courseId); await db.course.update({ where: { id: courseId }, data: { instructorId: accounts.learner2 } });
    const response = await redeemHttp({ code: row.code }, 'instructor').expect(201); assertTaskContract('REDEEM-02', 'WireRedeemResult', response.body);
    expect((await db.course.findUniqueOrThrow({ where: { id: courseId } })).instructorId).toBe(accounts.learner2);
    expect((await db.enrollment.findUniqueOrThrow({ where: { id: response.body.enrollment.id } })).accountId).toBe(accounts.instructor);
  });
  it('public redeem hides unknown/revoked/non-public/free codes with404 and rejects invalid bodies', async () => {
    const courseId = await course(), row = await code(courseId); await revoke(row.id).expect(200);
    for (const value of [row.code, 'unknown']) { const response = await redeemHttp({ code: value }).expect(404); assertErrorContract(response.body); }
    const fresh = await code(courseId); await db.course.update({ where: { id: courseId }, data: { status: 'draft' } }); await redeemHttp({ code: fresh.code }).expect(404);
    await db.course.update({ where: { id: courseId }, data: { status: 'published', priceMinor: 0 } }); await redeemHttp({ code: fresh.code }).expect(404);
    for (const value of [{ code: '' }, { code: fresh.code, account_id: accounts.admin }]) await redeemHttp(value).expect(422);
    expect(await codeRow(fresh.id)).toEqual(fresh); expect(await db.enrollment.count({ where: { courseId } })).toBe(0);
  });
  it('public concurrent same-code claims have one201 and one404 with one linked grant', async () => {
    const courseId = await course(), row = await code(courseId);
    const responses = await Promise.all(['learner', 'learner2'].map(name => redeemHttp({ code: row.code }, name)));
    expect(responses.map(r => r.status).sort()).toEqual([201, 404]); expect(await db.enrollment.count({ where: { courseId } })).toBe(1);
    const used = await codeRow(row.id), grant = await db.enrollment.findUniqueOrThrow({ where: { id: used.enrollmentId! } }); expect(used.usedBy).toBe(grant.accountId);
  });
  it('public revoke vs redeem has only one terminal winner', async () => {
    const courseId = await course(), row = await code(courseId);
    const [grant, revocation] = await Promise.all([redeemHttp({ code: row.code }), revoke(row.id)]), final = await codeRow(row.id);
    expect(final.status === 'used' ? [grant.status, revocation.status] : [revocation.status, grant.status]).toEqual(final.status === 'used' ? [201, 409] : [200, 404]);
    expect(await db.enrollment.count({ where: { courseId } })).toBe(final.status === 'used' ? 1 : 0);
  });
  it('public grant failure rolls back consumption and retry succeeds without a phantom payment', async () => {
    const courseId = await course(), row = await code(courseId), participant = app.get(EntitlementWriter), original = participant.grantEntitlement.bind(participant);
    const spy = jest.spyOn(participant, 'grantEntitlement').mockImplementationOnce(async (...args) => { await original(...args); throw Error('PRIVATE_FAILURE'); });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { const response = await redeemHttp({ code: row.code }).expect(500); assertErrorContract(response.body); expect(JSON.stringify(response.body)).not.toContain('PRIVATE_FAILURE'); }
    finally { spy.mockRestore(); log.mockRestore(); }
    expect(await codeRow(row.id)).toEqual(row); expect(await db.enrollment.count({ where: { courseId } })).toBe(0);
    await redeemHttp({ code: row.code }).expect(201); expect(await db.payment.count({ where: { courseId } })).toBe(0);
  });
  it('public redemption rechecks revoked sessions after guard without consuming', async () => {
    const courseId = await course(), row = await code(courseId), service = app.get(RedeemCodeService), original = service.redeem.bind(service);
    const spy = jest.spyOn(service, 'redeem').mockImplementationOnce(async (ref, value) => {
      await db.appSession.update({ where: { tokenHash: ref.tokenHash }, data: { revokedAt: new Date() } }); return original(ref, value);
    });
    try { await redeemHttp({ code: row.code }).expect(401); expect(await codeRow(row.id)).toEqual(row); }
    finally { spy.mockRestore(); await db.appSession.update({ where: { tokenHash: reference('learner').tokenHash }, data: { revokedAt: null } }); }
  });
});
