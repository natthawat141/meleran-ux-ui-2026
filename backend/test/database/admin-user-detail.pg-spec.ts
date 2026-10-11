import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AdminUserDetailService } from '../../src/features/management/admin-user-detail.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('MGMT-01 bounded Admin identity detail / actual HTTP and PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const tag = 'admin_detail_' + randomUUID(), saved = process.env.DATABASE_URL;
  const ids: Record<string, string> = {}, secrets: Record<string, string> = {};
  const profile = { bio: 'ประวัติ', firstName: 'ชื่อ', lastName: 'สกุล', firstNameEnglish: 'First', lastNameEnglish: 'Last',
    certificateName: 'ชื่อใบรับรอง', birthDate: '2000-01-01', phone: '0000000000', school: 'โรงเรียน',
    educationLevel: 'มัธยม', interests: ['คณิต'], learningGoals: ['ฝึกทำโจทย์'] };
  const rawProfile = JSON.stringify({ ...profile, private: 'PRIVATE_PROFILE', passwordHash: 'PRIVATE_PROFILE_HASH', role: 'admin' });
  const hash = (value: string) => createHash('sha256').update(value).digest('hex').toUpperCase();
  const call = (id = ids.target, actor = 'admin', audience = 'admin') => request(app.getHttpServer())
    .get('/api/v1/admin/users/' + encodeURIComponent(id)).set('x-melearn-app', audience)
    .set('Cookie', `melearn_${audience}_session=${secrets[actor + '_' + audience]}`);
  const canonical = (body: unknown) => assertTaskContract('MGMT-01', 'AdminUserDetailDto', body);
  const counts = () => Promise.all(Object.values(Prisma.ModelName).map(model =>
    (db as unknown as Record<string, { count(): Promise<number> }>)[model[0].toLowerCase() + model.slice(1)].count()));
  const data = () => Promise.all([
    db.account.findMany({ where: { id: { in: Object.values(ids) } }, orderBy: { id: 'asc' } }),
    db.userRole.findMany({ where: { accountId: { in: Object.values(ids) } }, orderBy: [{ accountId: 'asc' }, { role: 'asc' }] }),
    db.localCredential.findMany({ where: { accountId: { in: Object.values(ids) } }, orderBy: { accountId: 'asc' } }),
    db.externalIdentity.findMany({ where: { accountId: { in: Object.values(ids) } }, orderBy: { id: 'asc' } }),
    db.appSession.findMany({ where: { accountId: { in: Object.values(ids) } }, orderBy: { tokenHash: 'asc' } }),
  ]);
  beforeAll(async () => {
    const c = testConnections(); db = c.runtime; migrator = c.migrator; process.env.DATABASE_URL = c.runtimeUrl;
    for (const actor of ['admin', 'peer', 'learner', 'instructor', 'target', 'nullable']) {
      const role = ['admin', 'peer'].includes(actor) ? 'admin' : actor === 'instructor' ? 'instructor' : 'learner';
      ids[actor] = (await db.account.create({ data: { displayName: tag + actor, roles: role === 'admin' ? 'learner' : 'admin',
        origin: 'admin_created', emailVerified: false, profileJson: actor === 'target' ? rawProfile : '{}',
        createdAt: new Date('2026-10-10T12:30:00Z'), roleGrants: { create: { role } } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[actor + '_' + audience] = secret;
        await db.appSession.create({ data: { accountId: ids[actor], tokenHash: hash(secret), audience, expiresAt: new Date(Date.now() + 3600000) } });
      }
    }
    await db.localCredential.create({ data: { accountId: ids.target, passwordHash: 'PRIVATE_CREDENTIAL_HASH' } });
    for (const method of ['google', 'password', 'google']) await db.externalIdentity.create({ data: {
      accountId: ids.target, provider: 'firebase', project: 'fixture', subject: 'PRIVATE_SUBJECT_' + randomUUID(), method } });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.init();
  });
  beforeEach(async () => {
    await db.account.updateMany({ where: { id: { in: Object.values(ids) } }, data: { disabled: false } });
    await db.account.update({ where: { id: ids.target }, data: { origin: 'admin_created', emailVerified: false, profileJson: rawProfile } });
    await db.appSession.updateMany({ where: { accountId: { in: Object.values(ids) } }, data: { revokedAt: null, expiresAt: new Date(Date.now() + 3600000) } });
  });
  afterAll(async () => {
    if (app) await app.close(); if (saved === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved;
    if (db) {
      const accountId = { in: Object.values(ids) };
      await db.externalIdentity.deleteMany({ where: { accountId } }); await db.localCredential.deleteMany({ where: { accountId } });
      await db.appSession.deleteMany({ where: { accountId } }); await db.userRole.deleteMany({ where: { accountId } });
      await db.account.deleteMany({ where: { id: accountId } }); await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('returns exact canonical target profile/method/date/normalized roles without private credentials or extra identity fields', async () => {
    const target = await db.account.findUniqueOrThrow({ where: { id: ids.target } });
    const r = await call().expect(200); canonical(r.body);
    expect(r.body).toEqual({ id: target.id, display_name: target.displayName, username: null, email: null,
      email_verified: false, avatar_url: null, roles: ['learner'], origin: 'admin_created', profile,
      auth_methods: ['google', 'password'], status: 'active', created_at: target.createdAt.toISOString() });
    expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE_|learning_eligible|instructorAdded|tokenHash|passwordHash|subject/);
  });
  it('preserves required nullable fields and empty auth/profile metadata for a valid unlinked target', async () => {
    const r = await call(ids.nullable).expect(200); canonical(r.body);
    expect(r.body.username).toBeNull(); expect(r.body.email).toBeNull(); expect(r.body.avatar_url).toBeNull();
    expect(r.body.profile).toEqual({}); expect(r.body.auth_methods).toEqual([]);
  });
  it('honors the Admin inline profile schema rather than importing CurrentUser array limits or truncating data', async () => {
    const interests = Array.from({ length: 31 }, (_, i) => 'หัวข้อ ' + i);
    await db.account.update({ where: { id: ids.target }, data: { profileJson: JSON.stringify({ interests, learningGoals: interests }) } });
    const before = await data(); const r = await call().expect(200); canonical(r.body);
    expect(r.body.profile).toEqual({ interests, learningGoals: interests }); expect(await data()).toEqual(before);
  });
  it('projects Draft verification status from stored self-email proof without approving or verifying users', async () => {
    for (const [origin, emailVerified, status] of [['self_email', false, 'pending'], ['self_email', true, 'active'], ['google', true, 'active']] as const) {
      await db.account.update({ where: { id: ids.target }, data: { origin, emailVerified } });
      const before = await data(); const r = await call().expect(200); canonical(r.body);
      expect(r.body.status).toBe(status); expect(r.body.email_verified).toBe(emailVerified); expect(await data()).toEqual(before);
    }
  });
  it('authorized Admin can inspect self and another Admin without gaining mutation or learning rights', async () => {
    for (const id of [ids.admin, ids.peer]) { const r = await call(id).expect(200); canonical(r.body); expect(r.body.roles).toEqual(['admin']); }
  });
  it('wrong/missing audience or bound cookie and anonymous requests cannot read PII', async () => {
    await call(ids.target, 'admin', 'web').expect(401);
    await call().set('x-melearn-app', 'web').expect(403);
    await request(app.getHttpServer()).get('/api/v1/admin/users/' + ids.target).set('x-melearn-app', 'admin')
      .set('Cookie', 'melearn_web_session=' + secrets.admin_web).expect(401);
    await request(app.getHttpServer()).get('/api/v1/admin/users/' + ids.target).expect(401);
    await request(app.getHttpServer()).get('/api/v1/admin/users/' + ids.target).set('Cookie', 'melearn_admin_session=' + secrets.admin_admin).expect(403);
  });
  it('normalized Learner/Instructor remain forbidden even with compatibility Admin strings and forged role headers', async () => {
    for (const actor of ['learner', 'instructor']) {
      const r = await call(ids.target, actor).set('x-role', 'admin').set('x-user-id', ids.admin).expect(403);
      assertErrorContract(r.body); expect(JSON.stringify(r.body)).not.toContain(profile.phone);
    }
  });
  it('expired/revoked/disabled Admin proof is denied before returning target identity', async () => {
    const tokenHash = hash(secrets.admin_admin);
    await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(0) } }); await call().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() + 3600000), revokedAt: new Date() } }); await call().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null } });
    await db.account.update({ where: { id: ids.admin }, data: { disabled: true } }); await call().expect(401);
  });
  it('session revoked after guard is rechecked inside the caller transaction', async () => {
    const service = app.get(AdminUserDetailService), original = service.read.bind(service);
    const spy = jest.spyOn(service, 'read').mockImplementationOnce(async (reference, id) => {
      await db.appSession.update({ where: { tokenHash: reference.tokenHash }, data: { revokedAt: new Date() } });
      return original(reference, id);
    });
    try { await call().expect(401); } finally { spy.mockRestore(); }
  });
  it('normalized Admin removal after guard is rechecked without compatibility fallback', async () => {
    const service = app.get(AdminUserDetailService), original = service.read.bind(service);
    const spy = jest.spyOn(service, 'read').mockImplementationOnce(async (reference, id) => {
      await db.userRole.deleteMany({ where: { accountId: ids.admin, role: 'admin' } });
      await db.userRole.create({ data: { accountId: ids.admin, role: 'learner' } });
      return original(reference, id);
    });
    try { await call().expect(403); } finally {
      spy.mockRestore(); await db.userRole.deleteMany({ where: { accountId: ids.admin, role: 'learner' } });
      await db.userRole.create({ data: { accountId: ids.admin, role: 'admin' } });
    }
  });
  it('unknown target404 and path ID controls selection despite query claims', async () => {
    const r = await call(randomUUID()).expect(404); assertErrorContract(r.body);
    const own = await call().query({ id: ids.peer, account_id: ids.peer, fields: 'passwordHash' }).expect(200);
    canonical(own.body); expect(own.body.id).toBe(ids.target); expect(own.body.roles).toEqual(['learner']);
  });
  it('Admin can inspect a disabled target; Draft active metadata never changes the disabled flag or session authority', async () => {
    await db.account.update({ where: { id: ids.target }, data: { disabled: true } });
    const before = await data(); const r = await call().expect(200); canonical(r.body);
    expect(r.body.status).toBe('active'); expect(r.body).not.toHaveProperty('learning_eligible');
    expect(await data()).toEqual(before);
    await request(app.getHttpServer()).get('/api/v1/me').set('x-melearn-app', 'web')
      .set('Cookie', 'melearn_web_session=' + secrets.target_web).expect(401);
  });
  it('missing normalized target roles is a safe storage failure instead of fabricating compatibility roles', async () => {
    await db.userRole.deleteMany({ where: { accountId: ids.target } });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { const r = await call().expect(500); assertErrorContract(r.body); expect(JSON.stringify(r.body)).not.toContain('PRIVATE_'); }
    finally { log.mockRestore(); await db.userRole.create({ data: { accountId: ids.target, role: 'learner' } }); }
  });
  it('corrupt recognized profile fields fail safely without repairing or exposing storage', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { for (const profileJson of ['PRIVATE_NOT_JSON', '{"phone":123,"private":"PRIVATE_PROFILE"}']) {
      await db.account.update({ where: { id: ids.target }, data: { profileJson } }); const before = await data();
      const r = await call().expect(500); assertErrorContract(r.body); expect(JSON.stringify(r.body) + JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_');
      expect(await data()).toEqual(before);
    } } finally { log.mockRestore(); }
  });
  it('actual later SQL failure returns safe500 with no target or authority mutation', async () => {
    const p = app.get(PrismaService), original = p.$transaction.bind(p), before = await data();
    const failing = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await callback(tx); await tx.$queryRaw`SELECT 1/0`; }, options)) as typeof p.$transaction;
    const spy = jest.spyOn(p, '$transaction').mockImplementationOnce(failing), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { const r = await call().expect(500); assertErrorContract(r.body); expect(JSON.stringify(r.body) + JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|division|postgresql/); expect(await data()).toEqual(before); }
    finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('parallel/reconnect reads preserve all27 model counts and identity/credentials/role/session rows', async () => {
    const before = await data(), beforeCounts = await counts(); await db.$disconnect(); await db.$connect();
    for (const r of await Promise.all(Array.from({ length: 5 }, () => call()))) { expect(r.status).toBe(200); canonical(r.body); }
    expect(await data()).toEqual(before); expect(await counts()).toEqual(beforeCounts);
  });
  async function holdReadAndWriter(writer: (tx: Prisma.TransactionClient) => Promise<void>) {
    const p = app.get(PrismaService), original = p.$transaction.bind(p);
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(r => { release = r; }), held = new Promise<void>(r => { ready = r; }), changing = new Promise<void>(r => { started = r; });
    const hold = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { const value = await callback(tx); ready(); await gate; return value; }, { ...options, timeout: 15000 })) as typeof p.$transaction;
    const spy = jest.spyOn(p, '$transaction').mockImplementationOnce(hold), read = call().then(r => r); await held;
    const update = db.$transaction(async tx => { pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid; started(); await writer(tx); }, { timeout: 15000 }); await changing;
    try {
      let blocked = false; for (let i = 0; i < 100; i++) { if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; } await new Promise(r => setTimeout(r, 10)); }
      expect(blocked).toBe(true); release(); const r = await read; expect(r.status).toBe(200); canonical(r.body); await update; return r.body;
    } finally { release(); await Promise.allSettled([read, update]); spy.mockRestore(); }
  }
  it('a concurrent target profile writer waits on the Account lock; subsequent read sees committed metadata', async () => {
    const body = await holdReadAndWriter(async tx => { await tx.account.update({ where: { id: ids.target }, data: { profileJson: '{"bio":"บันทึกใหม่"}' } }); });
    expect(body.profile).toEqual(profile); expect((await call().expect(200)).body.profile).toEqual({ bio: 'บันทึกใหม่' });
  });
  it('opposite Admin read and grant use sorted Account locks without upgrade deadlock', async () => {
    const p = app.get(PrismaService), original = p.$transaction.bind(p); let release!: () => void, ready!: () => void;
    const gate = new Promise<void>(r => { release = r; }), held = new Promise<void>(r => { ready = r; });
    const hold = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { const value = await callback(tx); ready(); await gate; return value; }, { ...options, timeout: 15000 })) as typeof p.$transaction;
    const spy = jest.spyOn(p, '$transaction').mockImplementationOnce(hold);
    const read = call(ids.peer).then(r => r); await held;
    const grant = request(app.getHttpServer()).post('/api/v1/admin/users/' + ids.admin + '/instructor')
      .set('x-melearn-app', 'admin').set('Cookie', 'melearn_admin_session=' + secrets.peer_admin).send({}).then(r => r);
    try {
      let blocked = false;
      for (let i = 0; i < 100; i++) { const rows = await migrator.$queryRaw<Array<{ blocked: boolean }>>
        `SELECT bool_or(cardinality(pg_blocking_pids(pid))>0) AS blocked FROM pg_stat_activity WHERE datname=current_database() AND usename='melearn_test_app'`;
        if (rows[0].blocked) { blocked = true; break; } await new Promise(r => setTimeout(r, 10)); }
      expect(blocked).toBe(true); release(); expect((await read).status).toBe(200); expect((await grant).status).toBe(409);
    } finally { release(); await Promise.allSettled([read, grant]); spy.mockRestore(); }
  });
});
