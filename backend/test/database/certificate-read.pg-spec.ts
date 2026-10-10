import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrincipalService } from '../../src/features/auth/public/index';
import { CertificateReadService } from '../../src/features/certificates/certificate-read.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('CERT-01 owned historical detail / actual Nest HTTP and PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication, courseId: string;
  const tag = 'certificate_read_' + randomUUID(), previousUrl = process.env.DATABASE_URL;
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {}, certificates: Record<string, string> = {};
  const enrollments: string[] = [], issuedAt = new Date('2026-10-10T17:01:02.123Z');
  const read = (name = 'owner', audience = 'web', id = certificates.owner) => request(app.getHttpServer())
    .get('/api/v1/me/certificates/' + id).set('x-melearn-app', audience)
    .set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`);
  async function counts() {
    return Promise.all(Object.values(Prisma.ModelName).map(name => (db as any)[name[0].toLowerCase() + name.slice(1)].count()));
  }
  async function history() {
    return Promise.all([db.certificate.findMany({ where: { enrollmentId: { in: enrollments } }, orderBy: { id: 'asc' } }),
      db.enrollment.findMany({ where: { id: { in: enrollments } }, orderBy: { id: 'asc' } }),
      db.progress.findMany({ where: { enrollmentId: { in: enrollments } }, orderBy: { id: 'asc' } })]);
  }
  function expected(name = 'owner') {
    return { id: certificates[name], code: tag + '_' + name, course_id: courseId,
      course_title: 'ชื่อคอร์ส ณ วันออก', learner_name: 'ชื่อผู้รับ ณ วันออก ' + name,
      issued_at: issuedAt.toISOString(), enrollment_id: enrollments[name === 'owner' ? 0 : 1] };
  }
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const name of ['owner', 'other', 'instructor', 'admin']) {
      accounts[name] = (await db.account.create({ data: { displayName: tag + name, roles: 'admin',
        origin: 'admin_created', emailVerified: false, profileJson: '{"phone":"PRIVATE_PROFILE"}',
        roleGrants: { create: { role: name === 'instructor' ? 'instructor' : 'learner' } } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[name + '_' + audience] = secret;
        await db.appSession.create({ data: { tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase(),
          accountId: accounts[name], audience, expiresAt: new Date(Date.now() + 3600000) } });
      }
    }
    courseId = (await db.course.create({ data: { slug: tag, title: 'ชื่อคอร์สปัจจุบัน', category: 'test', level: 'test',
      instructorId: accounts.instructor, status: 'published', publishedAt: new Date(), priceMinor: 9900 } })).id;
    const chapter = await db.courseChapter.create({ data: { courseId, title: 'บท', position: 0 } });
    const item = await db.courseItem.create({ data: { courseId, chapterId: chapter.id, title: 'บทอ่าน', position: 0 } });
    for (const name of ['owner', 'admin']) {
      const enrollment = await db.enrollment.create({ data: { courseId, accountId: accounts[name], source: 'stripe',
        completedAt: issuedAt, completionSnapshot: { private: 'PRIVATE_ORIGINAL_RESULT', total_items: 1 } } });
      enrollments.push(enrollment.id);
      await db.progress.create({ data: { courseId, enrollmentId: enrollment.id, itemId: item.id, completedAt: issuedAt,
        resumeData: { private: 'PRIVATE_RESUME' } } });
      certificates[name] = (await db.certificate.create({ data: { enrollmentId: enrollment.id, code: tag + '_' + name,
        recipientName: 'ชื่อผู้รับ ณ วันออก ' + name, courseName: 'ชื่อคอร์ส ณ วันออก', issuedAt } })).id;
    }
    // Historical certificate predates this management-role grant. Reading it
    // cannot create a new Admin enrollment, result, certificate or entitlement.
    await db.userRole.update({ where: { accountId_role: { accountId: accounts.admin, role: 'learner' } }, data: { role: 'admin' } });
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      await db.certificate.deleteMany({ where: { enrollmentId: { in: enrollments } } });
      await db.progress.deleteMany({ where: { enrollmentId: { in: enrollments } } });
      await db.enrollment.deleteMany({ where: { id: { in: enrollments } } });
      if (courseId) await db.course.deleteMany({ where: { id: courseId } });
      await db.appSession.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.userRole.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.account.deleteMany({ where: { id: { in: Object.values(accounts) } } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('returns exactly the seven canonical issue-time fields, with no academic/profile/internal fields', async () => {
    const response = await read().expect(200); assertTaskContract('CERT-01', 'WireServerCertificate', response.body);
    expect(response.body).toEqual(expected()); expect(JSON.stringify(response.body)).not.toContain('PRIVATE_');
    expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/i);
  });
  it('foreign learner, course instructor and Admin get the same 404 as an unknown certificate', async () => {
    for (const [name, audience] of [['other', 'web'], ['instructor', 'web'], ['admin', 'admin']]) {
      const response = await read(name, audience).expect(404); assertErrorContract(response.body);
      expect(response.body.error.code).toBe('not_found'); expect(JSON.stringify(response.body)).not.toContain(certificates.owner);
    }
    assertErrorContract((await read('owner', 'web', randomUUID()).expect(404)).body);
  });
  it('reads only the current Admin account historical record through either bound audience without creating results', async () => {
    const before = await counts();
    for (const audience of ['web', 'admin']) expect((await read('admin', audience, certificates.admin).expect(200)).body).toEqual(expected('admin'));
    expect(await counts()).toEqual(before);
  });
  it('rejects anonymous access, namespace forgery, non-Admin admin namespace and an invalid app header', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/certificates/' + certificates.owner).set('x-melearn-app', 'web').expect(401);
    await request(app.getHttpServer()).get('/api/v1/me/certificates/' + certificates.owner).set('x-melearn-app', 'admin')
      .set('Cookie', `melearn_web_session=${secrets.owner_web}`).expect(401);
    await read('owner', 'admin').expect(403);
    await request(app.getHttpServer()).get('/api/v1/me/certificates/' + certificates.owner).set('x-melearn-app', 'other')
      .set('Cookie', `melearn_web_session=${secrets.owner_web}`).expect(403);
  });
  it('does not turn historical self-read into a new-learning readiness or role prerequisite', async () => {
    await db.account.update({ where: { id: accounts.owner }, data: { origin: 'self_email', emailVerified: false } });
    await db.userRole.update({ where: { accountId_role: { accountId: accounts.owner, role: 'learner' } }, data: { role: 'instructor' } });
    try { expect((await read().expect(200)).body).toEqual(expected()); }
    finally {
      await db.account.update({ where: { id: accounts.owner }, data: { origin: 'admin_created' } });
      await db.userRole.update({ where: { accountId_role: { accountId: accounts.owner, role: 'instructor' } }, data: { role: 'learner' } });
    }
  });
  it('revoked/expired sessions and disabled accounts are denied even with a real owned certificate', async () => {
    const tokenHash = createHash('sha256').update(secrets.owner_web).digest('hex').toUpperCase();
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: new Date() } }); await read().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null, expiresAt: new Date(0) } }); await read().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() + 3600000) } });
    await db.account.update({ where: { id: accounts.owner }, data: { disabled: true } });
    try { await read().expect(401); } finally { await db.account.update({ where: { id: accounts.owner }, data: { disabled: false } }); }
  });
  it('retains original names/date/code after renames, archive, additional content and instructor reassignment', async () => {
    const before = await history();
    await db.account.update({ where: { id: accounts.owner }, data: { displayName: 'ชื่อใหม่', profileJson: '{"certificateName":"ชื่อใหม่"}' } });
    await db.course.update({ where: { id: courseId }, data: { title: 'ชื่อหลักสูตรใหม่', status: 'archived', instructorId: accounts.admin } });
    const chapter = await db.courseChapter.findFirstOrThrow({ where: { courseId } });
    await db.courseItem.create({ data: { courseId, chapterId: chapter.id, title: 'บทเพิ่มหลังจบ', position: 1 } });
    const beforeReadCounts = await counts(); expect((await read().expect(200)).body).toEqual(expected());
    expect(await history()).toEqual(before); expect(await counts()).toEqual(beforeReadCounts);
  });
  it('repeated/concurrent requests and reconnect preserve all 27 model counts and original academic snapshots', async () => {
    const before = await history(), beforeCounts = await counts();
    const responses = await Promise.all(Array.from({ length: 8 }, () => read().expect(200)));
    responses.forEach(response => expect(response.body).toEqual(expected()));
    await db.$disconnect(); await db.$connect(); expect((await read().expect(200)).body).toEqual(expected());
    expect(await history()).toEqual(before); expect(await counts()).toEqual(beforeCounts);
  });
  it('revalidates disabled state after guard resolution before selecting owned private data', async () => {
    const service = app.get(CertificateReadService), original = service.detail.bind(service);
    const spy = jest.spyOn(service, 'detail').mockImplementationOnce(async (...args) => {
      await db.account.update({ where: { id: accounts.owner }, data: { disabled: true } }); return original(...args);
    });
    try { await read().expect(401); } finally { spy.mockRestore(); await db.account.update({ where: { id: accounts.owner }, data: { disabled: false } }); }
  });
  it('revalidates normalized Admin namespace role after guard and never trusts the compatibility role string', async () => {
    const service = app.get(CertificateReadService), original = service.detail.bind(service);
    const spy = jest.spyOn(service, 'detail').mockImplementationOnce(async (...args) => {
      await db.userRole.deleteMany({ where: { accountId: accounts.admin, role: 'admin' } }); return original(...args);
    });
    try { await read('admin', 'admin', certificates.admin).expect(403); }
    finally { spy.mockRestore(); await db.userRole.create({ data: { accountId: accounts.admin, role: 'admin' } }); }
  });
  it('actual database failure produces a safe 500 without fabricating a certificate or disclosing diagnostics', async () => {
    const spy = jest.spyOn(app.get(PrismaService), '$transaction').mockRejectedValueOnce(new Error('PRIVATE_DB_DIAGNOSTIC'));
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined), before = await counts();
    try {
      const response = await read().expect(500); assertErrorContract(response.body);
      expect(response.body.error.code).toBe('internal_error');
      expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_DB_DIAGNOSTIC');
      expect(await counts()).toEqual(before);
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('waits on Enrollment before locking Certificate, allowing a competing history transaction to roll back without deadlock', async () => {
    const principals = app.get(PrincipalService), original = principals.requireSelfRead.bind(principals);
    let release!: () => void, ready!: () => void, readerReady!: () => void, readerPid!: number, rolledBack = false;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const held = new Promise<void>(resolve => { ready = resolve; }), reading = new Promise<void>(resolve => { readerReady = resolve; });
    class FixtureRollback extends Error {}
    const writer = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM enrollments WHERE id=${enrollments[0]} FOR UPDATE`;
      ready(); await gate;
      await tx.certificate.delete({ where: { id: certificates.owner } });
      throw new FixtureRollback();
    }, { timeout: 15000 }).catch(error => {
      if (!(error instanceof FixtureRollback)) throw new Error('Historical fixture transaction failed'); rolledBack = true;
    }); await held;
    const spy = jest.spyOn(principals, 'requireSelfRead').mockImplementationOnce(async (...args) => {
      const actor = await original(...args);
      readerPid = (await args[0].$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      readerReady(); return actor;
    });
    const command = read().then(response => response); await reading;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${readerPid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); await writer; expect(rolledBack).toBe(true);
      const response = await command; expect(response.status).toBe(200); expect(response.body).toEqual(expected());
    } finally { release(); await Promise.allSettled([writer, command]); spy.mockRestore(); }
  });
  it('observes real authority lock wait during concurrent disable; the next request is denied', async () => {
    const principals = app.get(PrincipalService), original = principals.requireSelfRead.bind(principals);
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), held = new Promise<void>(resolve => { ready = resolve; });
    const changing = new Promise<void>(resolve => { started = resolve; });
    const spy = jest.spyOn(principals, 'requireSelfRead').mockImplementationOnce(async (...args) => {
      const actor = await original(...args); ready(); await gate; return actor;
    });
    const command = read().then(response => response); await held;
    const mutation = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      started(); await tx.account.update({ where: { id: accounts.owner }, data: { disabled: true } });
    }, { timeout: 10000 }); await changing;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); expect((await command).body).toEqual(expected()); await mutation; await read().expect(401);
    } finally { release(); await Promise.allSettled([command, mutation]); spy.mockRestore(); await db.account.update({ where: { id: accounts.owner }, data: { disabled: false } }); }
  });
});
