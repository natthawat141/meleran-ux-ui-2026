import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { LogoutService } from '../../src/features/auth/logout.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract } from '../support/contract-validator';

describe('AUTH-01 current app logout / real HTTP and PostgreSQL isolation', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication, courseId: string, enrollmentId: string;
  const previousUrl = process.env.DATABASE_URL, tag = 'logout_' + randomUUID();
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {};
  const hash = (secret: string) => createHash('sha256').update(secret).digest('hex').toUpperCase();
  const cookie = (name = 'learner', audience = 'web') => `melearn_${audience}_session=${secrets[name + '_' + audience]}`;
  const logout = (name = 'learner', audience = 'web') => request(app.getHttpServer()).post('/api/v1/auth/logout').set('x-melearn-app', audience).set('Cookie', cookie(name, audience));
  const me = (name = 'learner', audience = 'web') => request(app.getHttpServer()).get('/api/v1/me').set('x-melearn-app', audience).set('Cookie', cookie(name, audience));
  const selected = (name = 'learner', audience = 'web') => db.appSession.findUniqueOrThrow({ where: { tokenHash: hash(secrets[name + '_' + audience]) } });
  const counts = () => Promise.all(Object.values(Prisma.ModelName).map(name => (db as any)[name[0].toLowerCase() + name.slice(1)].count()));
  const academic = () => Promise.all([
    db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } }),
    db.progress.findMany({ where: { enrollmentId }, orderBy: { id: 'asc' } }),
    db.certificate.findMany({ where: { enrollmentId }, orderBy: { id: 'asc' } }),
  ]);
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const role of ['learner', 'instructor', 'admin']) {
      accounts[role] = (await db.account.create({ data: { displayName: tag + role, origin: 'self_email', emailVerified: false,
        roles: role === 'admin' ? 'learner' : 'admin', roleGrants: { create: { role } } } })).id;
      await db.localCredential.create({ data: { accountId: accounts[role], passwordHash: 'PRIVATE_CREDENTIAL_HASH' } });
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[role + '_' + audience] = secret;
        await db.appSession.create({ data: { accountId: accounts[role], audience, expiresAt: new Date(Date.now() + 3600000), tokenHash: hash(secret) } });
      }
    }
    secrets.second_web = randomUUID();
    await db.appSession.create({ data: { accountId: accounts.learner, audience: 'web', expiresAt: new Date(Date.now() + 3600000), tokenHash: hash(secrets.second_web) } });
    const course = await db.course.create({ data: { instructorId: accounts.instructor, slug: tag, title: 'ประวัติคอร์ส', category: 'test', level: 'test',
      status: 'published', publishedAt: new Date('2026-09-01T00:00:00Z') } }); courseId = course.id;
    const chapter = await db.courseChapter.create({ data: { courseId, title: 'บทเดิม', position: 0 } });
    const item = await db.courseItem.create({ data: { courseId, chapterId: chapter.id, title: 'บทอ่าน', type: 'article', position: 0 } });
    const completedAt = new Date('2026-10-01T00:00:00Z');
    const enrollment = await db.enrollment.create({ data: { accountId: accounts.learner, courseId, source: 'free',
      grantedAt: new Date('2026-09-01T01:00:00Z'), completedAt, completedItems: 1, completionSnapshot: { total_items: 1, completed_items: 1 } } });
    enrollmentId = enrollment.id;
    await db.progress.create({ data: { enrollmentId, itemId: item.id, courseId, completedAt, resumeData: { private: 'PRIVATE_RESUME' } } });
    await db.certificate.create({ data: { enrollmentId, code: tag, recipientName: 'ชื่อเดิม', courseName: 'ชื่อคอร์สเดิม', issuedAt: completedAt } });
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
      if (enrollmentId) {
        await db.certificate.deleteMany({ where: { enrollmentId } }); await db.progress.deleteMany({ where: { enrollmentId } });
        await db.enrollment.deleteMany({ where: { id: enrollmentId } });
      }
      if (courseId) await db.course.deleteMany({ where: { id: courseId } });
      const ids = Object.values(accounts);
      await db.localCredential.deleteMany({ where: { accountId: { in: ids } } });
      await db.appSession.deleteMany({ where: { accountId: { in: ids } } });
      await db.userRole.deleteMany({ where: { accountId: { in: ids } } });
      await db.account.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });

  it('returns bodyless204, expires exactly the selected cookie and durably revokes using DB time', async () => {
    const before = await selected(), early = (await db.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
    const response = await logout().expect(204), after = await selected();
    expect(response.text).toBe(''); expect(response.headers['set-cookie']).toHaveLength(1);
    expect(response.headers['set-cookie'][0]).toMatch(/^melearn_web_session=;/);
    expect(response.headers['set-cookie'][0]).toContain('Path=/api/v1'); expect(response.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
    expect(after).toEqual({ ...before, revokedAt: after.revokedAt }); expect(after.revokedAt!.getTime()).toBeGreaterThanOrEqual(early.getTime());
    await me().expect(401);
  });
  it('both cookies and Web selection revoke only Admin account Web session, preserving Admin session', async () => {
    const beforeAdmin = await selected('admin', 'admin');
    const response = await logout('admin').set('Cookie', cookie('admin') + '; ' + cookie('admin', 'admin')).expect(204);
    expect(response.headers['set-cookie'][0]).toMatch(/^melearn_web_session=;/); expect(await selected('admin', 'admin')).toEqual(beforeAdmin);
    await me('admin').expect(401); await me('admin', 'admin').expect(200);
  });
  it('both cookies and Admin selection revoke only Admin session, preserving the same account Web session', async () => {
    const beforeWeb = await selected('admin');
    const response = await logout('admin', 'admin').set('Cookie', cookie('admin') + '; ' + cookie('admin', 'admin')).expect(204);
    expect(response.headers['set-cookie'][0]).toMatch(/^melearn_admin_session=;/); expect(await selected('admin')).toEqual(beforeWeb);
    await me('admin', 'admin').expect(401); await me('admin').expect(200);
  });
  it('preserves another device session in the same audience and sessions of foreign accounts', async () => {
    const all = await db.appSession.findMany({ where: { accountId: { in: Object.values(accounts) }, tokenHash: { not: hash(secrets.learner_web) } }, orderBy: { tokenHash: 'asc' } });
    await logout().expect(204);
    expect(await db.appSession.findMany({ where: { accountId: { in: Object.values(accounts) }, tokenHash: { not: hash(secrets.learner_web) } }, orderBy: { tokenHash: 'asc' } })).toEqual(all);
    await me('second').expect(200); await me('instructor').expect(200); await me('admin', 'admin').expect(200);
  });
  it('allows unverified Learner/Instructor Web logout and normalized Admin logout without learning eligibility', async () => {
    for (const name of ['learner', 'instructor', 'admin']) await logout(name).expect(204);
    await logout('admin', 'admin').expect(204);
  });
  it('rejects anonymous, missing/unknown namespace, wrong cookie and non-Admin Admin authority without writes', async () => {
    const before = await counts(), session = await selected();
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('x-melearn-app', 'web').expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Cookie', cookie()).expect(403);
    await logout().set('x-melearn-app', 'other').expect(403);
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('x-melearn-app', 'admin').set('Cookie', cookie()).expect(401);
    const denied = await logout('learner', 'admin').expect(403); assertErrorContract(denied.body);
    expect(await counts()).toEqual(before); expect(await selected()).toEqual(session);
  });
  it('expired/revoked/disabled sessions cannot clear cookies or modify other identity rows', async () => {
    const tokenHash = hash(secrets.learner_web);
    for (const data of [{ expiresAt: new Date(0) }, { expiresAt: new Date(Date.now() + 3600000), revokedAt: new Date() }]) {
      await db.appSession.update({ where: { tokenHash }, data }); const before = await selected();
      const response = await logout().expect(401); expect(response.headers['set-cookie']).toBeUndefined(); expect(await selected()).toEqual(before);
    }
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null } });
    await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } });
    const before = await selected(); await logout().expect(401); expect(await selected()).toEqual(before);
  });
  it('does not accept body claims about a target identity, session, role or logout-all policy', async () => {
    const before = await selected();
    for (const body of [{ account_id: accounts.admin }, { tokenHash: hash(secrets.admin_admin) }, { roles: ['admin'] }, { logout_all: true }, []]) {
      const response = await logout().send(body).expect(422); assertErrorContract(response.body); expect(response.headers['set-cookie']).toBeUndefined();
    }
    await logout().set('content-type', 'application/json').send('null').expect(400);
    expect(await selected()).toEqual(before); await logout().send({}).expect(204);
  });
  it('post-guard revocation is rechecked and does not falsely report another successful logout', async () => {
    const service = app.get(LogoutService), original = service.logout.bind(service), tokenHash = hash(secrets.learner_web);
    let revokedAt!: Date;
    const spy = jest.spyOn(service, 'logout').mockImplementationOnce(async reference => {
      revokedAt = new Date(); await db.appSession.update({ where: { tokenHash }, data: { revokedAt } }); return original(reference);
    });
    try { const response = await logout().expect(401); assertErrorContract(response.body); expect(response.headers['set-cookie']).toBeUndefined(); expect((await selected()).revokedAt).toEqual(revokedAt); }
    finally { spy.mockRestore(); }
  });
  it('parallel logout serializes one current session without deadlock, over-revocation or phantom success', async () => {
    const responses = await Promise.all([logout(), logout()]); expect(responses.map(r => r.status).sort()).toEqual([204, 401]);
    expect((await selected()).revokedAt).not.toBeNull(); await me('second').expect(200);
  });
  it('keeps model counts, profile, credentials and historical progress/certificate snapshots unchanged', async () => {
    const beforeCounts = await counts(), beforeAcademic = await academic();
    const identity = () => Promise.all([db.account.findUniqueOrThrow({ where: { id: accounts.learner } }), db.localCredential.findUniqueOrThrow({ where: { accountId: accounts.learner } })]);
    const beforeIdentity = await identity(); const response = await logout().expect(204);
    expect(await counts()).toEqual(beforeCounts); expect(await academic()).toEqual(beforeAcademic); expect(await identity()).toEqual(beforeIdentity);
    expect(JSON.stringify(response.body) + JSON.stringify(response.headers)).not.toMatch(/PRIVATE_|tokenHash|passwordHash/);
  });
  it('revocation remains after database reconnect and ordinary replay is unauthorized without timestamp changes', async () => {
    await logout().expect(204); const before = await selected(); await db.$disconnect(); await db.$connect();
    await me().expect(401); await logout().expect(401); expect(await selected()).toEqual(before); await me('second').expect(200);
  });
  it('an actual SQL failure after revocation rolls back and sends no expired cookie or private diagnostics', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma), before = await selected();
    const failing = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await callback(tx); await tx.$queryRaw`SELECT 1/0`; }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(failing), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const response = await logout().expect(500); assertErrorContract(response.body); expect(response.headers['set-cookie']).toBeUndefined();
      expect(await selected()).toEqual(before); expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|division|postgresql/); await me().expect(200);
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('a competing identity edit waits for the held logout transaction until revocation commits', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma);
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), held = new Promise<void>(resolve => { ready = resolve; });
    const changing = new Promise<void>(resolve => { started = resolve; });
    const hold = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { const result = await callback(tx); ready(); await gate; return result; }, { ...options, timeout: 15000 })) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(hold);
    const command = logout().then(response => response); await held;
    const mutation = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid; started();
      await tx.account.update({ where: { id: accounts.learner }, data: { displayName: tag + '_changed' } });
    }, { timeout: 15000 }); await changing;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); expect((await command).status).toBe(204); await mutation; await me().expect(401);
    } finally { release(); await Promise.allSettled([command, mutation]); spy.mockRestore(); }
  });
});
