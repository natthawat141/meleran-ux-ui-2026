import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SelfProfileService } from '../../src/features/accounts/self-profile.service';
import { SelfProfileUpdateService } from '../../src/features/accounts/self-profile-update.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('ACCOUNT-01 GET /me / actual HTTP and PostgreSQL identity projection', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const previousUrl = process.env.DATABASE_URL, tag = 'profile_' + randomUUID();
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {};
  const hash = (secret: string) => createHash('sha256').update(secret).digest('hex').toUpperCase();
  const read = (name = 'learner', audience = 'web', query = '') => request(app.getHttpServer()).get('/api/v1/me' + query)
    .set('x-melearn-app', audience).set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`);
  const stored = (name = 'learner') => db.account.findUniqueOrThrow({ where: { id: accounts[name] } });
  const counts = () => Promise.all(Object.values(Prisma.ModelName).map(name => (db as any)[name[0].toLowerCase() + name.slice(1)].count()));
  const canonical = (body: unknown) => assertTaskContract('ACCOUNT-01', 'CurrentUser', body);
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const role of ['learner', 'instructor', 'admin']) {
      accounts[role] = (await db.account.create({ data: { displayName: tag + role, origin: 'admin_created',
        roles: role === 'admin' ? 'learner' : 'admin', roleGrants: { create: { role } } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[role + '_' + audience] = secret;
        await db.appSession.create({ data: { accountId: accounts[role], audience, expiresAt: new Date(Date.now() + 3600000), tokenHash: hash(secret) } });
      }
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
      await db.externalIdentity.deleteMany({ where: { accountId: { in: ids } } });
      await db.localCredential.deleteMany({ where: { accountId: { in: ids } } });
      await db.appSession.deleteMany({ where: { accountId: { in: ids } } });
      await db.userRole.deleteMany({ where: { accountId: { in: ids } } });
      await db.account.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });

  const patch = (body: object, name = 'learner', audience = 'web') => request(app.getHttpServer()).patch('/api/v1/me')
    .set('x-melearn-app', audience).set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`).send(body);

  it('returns all eleven canonical fields with normalized roles and explicit nullable identity', async () => {
    const before = await stored(), response = await read().expect(200); canonical(response.body);
    expect(response.body).toEqual({ id: accounts.learner, display_name: before.displayName, username: null, email: null,
      email_verified: false, avatar_url: null, roles: ['learner'], origin: 'admin_created', auth_methods: [], learning_eligible: true, profile: {} });
    expect(await stored()).toEqual(before);
  });
  it('binds only the session owner despite account, user, role and eligibility query claims', async () => {
    await db.account.update({ where: { id: accounts.instructor }, data: { email: tag + '@example.test', profileJson: '{"phone":"PRIVATE_FOREIGN"}' } });
    const response = await read('learner', 'web', `?account_id=${accounts.instructor}&user_id=${accounts.admin}&roles=admin&learning_eligible=false`).expect(200);
    canonical(response.body); expect(response.body.id).toBe(accounts.learner); expect(response.body.roles).toEqual(['learner']);
    expect(response.body.learning_eligible).toBe(true); expect(JSON.stringify(response.body)).not.toContain('PRIVATE_FOREIGN');
  });
  it('projects Instructor and multi-role grants and Admin self profiles in either bound namespace', async () => {
    const instructor = await read('instructor').expect(200); canonical(instructor.body); expect(instructor.body.roles).toEqual(['instructor']);
    await db.userRole.create({ data: { accountId: accounts.instructor, role: 'learner' } });
    try {
      const response = await read('instructor').expect(200); canonical(response.body); expect(response.body.roles).toEqual(['instructor', 'learner']);
      for (const audience of ['web', 'admin']) {
        const admin = await read('admin', audience).expect(200); canonical(admin.body); expect(admin.body.roles).toEqual(['admin']); expect(admin.body.learning_eligible).toBe(false);
      }
    } finally { await db.userRole.delete({ where: { accountId_role: { accountId: accounts.instructor, role: 'learner' } } }); }
  });
  it('unverified self-email/Google can read self while eligibility follows stored verified identity', async () => {
    for (const origin of ['self_email', 'google']) for (const emailVerified of [false, true]) {
      await db.account.update({ where: { id: accounts.learner }, data: { origin, emailVerified } });
      const response = await read().expect(200); canonical(response.body);
      expect(response.body.origin).toBe(origin); expect(response.body.email_verified).toBe(emailVerified); expect(response.body.learning_eligible).toBe(emailVerified);
    }
    await db.account.update({ where: { id: accounts.learner }, data: { origin: 'admin_created', emailVerified: false } });
  });
  it('returns deduplicated method metadata without selecting credential hashes or provider subjects', async () => {
    await db.localCredential.create({ data: { accountId: accounts.learner, passwordHash: 'PRIVATE_NOT_A_LOGIN_CREDENTIAL' } });
    for (const method of ['password', 'google', 'google']) await db.externalIdentity.create({ data: {
      accountId: accounts.learner, method, provider: 'firebase', project: 'PRIVATE_PROJECT', subject: 'PRIVATE_' + randomUUID() } });
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma);
    let projection: unknown;
    const capture = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => {
        const spy = jest.spyOn(tx.account, 'findUniqueOrThrow');
        try { const result = await callback(tx); projection = spy.mock.calls[0][0]; return result; } finally { spy.mockRestore(); }
      }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(capture);
    try {
      const response = await read().expect(200); canonical(response.body); expect(response.body.auth_methods).toEqual(['google', 'password']);
      expect(projection).toMatchObject({ select: { localCredential: { select: { accountId: true } }, externalIdentities: { select: { method: true } } } });
      expect(JSON.stringify(response.body) + JSON.stringify(projection)).not.toMatch(/PRIVATE_|passwordHash|subject|project/);
    } finally { spy.mockRestore(); }
  });
  it('retains every declared profile string and array, including legal thirty-item arrays', async () => {
    const profile = Object.fromEntries(['bio', 'firstName', 'lastName', 'firstNameEnglish', 'lastNameEnglish', 'certificateName',
      'birthDate', 'phone', 'school', 'educationLevel'].map(key => [key, key === 'bio' ? '' : 'ค่า ' + key]));
    const all = { ...profile, interests: Array.from({ length: 30 }, (_, index) => String(index)), learningGoals: [] };
    await db.account.update({ where: { id: accounts.learner }, data: { profileJson: JSON.stringify(all), username: tag, avatarUrl: 'https://example.test/avatar.png' } });
    const response = await read().expect(200); canonical(response.body); expect(response.body.profile).toEqual(all);
    expect(response.body.username).toBe(tag); expect(response.body.avatar_url).toBe('https://example.test/avatar.png');
  });
  it('excludes unknown storage metadata without repairing raw JSON or inventing profile defaults', async () => {
    const raw = '{"bio":"ข้อความ","privateAudit":"PRIVATE_META","__proto__":{"roles":["admin"]}}';
    await db.account.update({ where: { id: accounts.learner }, data: { profileJson: raw } });
    const before = await stored(), response = await read().expect(200); canonical(response.body);
    expect(response.body.profile).toEqual({ bio: 'ข้อความ' }); expect(JSON.stringify(response.body)).not.toContain('PRIVATE_'); expect(await stored()).toEqual(before);
    await db.account.update({ where: { id: accounts.learner }, data: { profileJson: '{}' } });
    expect((await read().expect(200)).body.profile).toEqual({});
  });
  it('denies anonymous, wrong namespace, non-Admin Admin session, expired/revoked and disabled identities', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').set('x-melearn-app', 'web').expect(401);
    await request(app.getHttpServer()).get('/api/v1/me').set('x-melearn-app', 'admin').set('Cookie', `melearn_web_session=${secrets.learner_web}`).expect(401);
    await read('learner', 'admin').expect(403);
    const tokenHash = hash(secrets.learner_web);
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: new Date() } }); await read().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null, expiresAt: new Date(0) } }); await read().expect(401);
    await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() + 3600000) } });
    await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } });
    try { await read().expect(401); } finally { await db.account.update({ where: { id: accounts.learner }, data: { disabled: false } }); }
  });
  it('rechecks identity after the guard instead of returning cached profile authority', async () => {
    const service = app.get(SelfProfileService), original = service.read.bind(service);
    const spy = jest.spyOn(service, 'read').mockImplementationOnce(async reference => {
      await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } }); return original(reference);
    });
    try { const response = await read().expect(401); assertErrorContract(response.body); }
    finally { spy.mockRestore(); await db.account.update({ where: { id: accounts.learner }, data: { disabled: false } }); }
  });
  it('returns safe500 for malformed persisted profile shapes without diagnostics or read repair', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      for (const json of ['PRIVATE_MALFORMED', 'null', '[]', '{"phone":null}', '{"interests":[1]}', JSON.stringify({ learningGoals: Array(31).fill('x') })]) {
        await db.account.update({ where: { id: accounts.learner }, data: { profileJson: json } });
        const before = await stored(), response = await read().expect(500); assertErrorContract(response.body);
        expect(await stored()).toEqual(before); expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|JSON|persisted|postgresql/);
      }
    } finally { log.mockRestore(); await db.account.update({ where: { id: accounts.learner }, data: { profileJson: '{}' } }); }
  });
  it('fails safely for unsupported persisted authentication methods rather than inventing a wire enum', async () => {
    const identity = await db.externalIdentity.create({ data: { accountId: accounts.learner, subject: 'PRIVATE_' + randomUUID(), method: 'unsupported' } });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { const response = await read().expect(500); assertErrorContract(response.body); expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_|unsupported/); }
    finally { log.mockRestore(); await db.externalIdentity.delete({ where: { id: identity.id } }); }
  });
  it('an actual PostgreSQL error returns safe500 and never a fabricated profile', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma), before = await stored();
    const failing = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await callback(tx); await tx.$queryRaw`SELECT 1/0`; }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(failing), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const response = await read().expect(500); assertErrorContract(response.body); expect(response.body.id).toBeUndefined();
      expect(await stored()).toEqual(before); expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toMatch(/division|postgresql|PRIVATE_/);
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('reconnect and parallel reads preserve every model count and owned identity/session state', async () => {
    const ids = Object.values(accounts), beforeCounts = await counts(), before = await stored();
    const identity = () => Promise.all([
      db.localCredential.findMany({ where: { accountId: { in: ids } }, orderBy: { accountId: 'asc' } }),
      db.externalIdentity.findMany({ where: { accountId: { in: ids } }, orderBy: { id: 'asc' } }),
      db.appSession.findMany({ where: { accountId: { in: ids } }, orderBy: { tokenHash: 'asc' } }),
    ]);
    const oldIdentity = await identity(); await db.$disconnect(); await db.$connect();
    for (const response of await Promise.all(Array.from({ length: 6 }, () => read()))) { expect(response.status).toBe(200); canonical(response.body); }
    expect(await counts()).toEqual(beforeCounts); expect(await stored()).toEqual(before); expect(await identity()).toEqual(oldIdentity);
  });
  it('a concurrent identity edit waits for the held self-read transaction and is visible on the next read', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma), before = await stored();
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), held = new Promise<void>(resolve => { ready = resolve; });
    const changing = new Promise<void>(resolve => { started = resolve; });
    const hold = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { const result = await callback(tx); ready(); await gate; return result; }, { ...options, timeout: 15000 })) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(hold);
    const command = read().then(response => response); await held;
    const mutation = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid; started();
      await tx.account.update({ where: { id: accounts.learner }, data: { displayName: tag + '_after', profileJson: '{"bio":"หลังแก้"}' } });
    }, { timeout: 15000 }); await changing;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); const response = await command; expect(response.status).toBe(200); canonical(response.body);
      expect(response.body.display_name).toBe(before.displayName); await mutation;
      const next = await read().expect(200); canonical(next.body); expect(next.body.display_name).toBe(tag + '_after'); expect(next.body.profile).toEqual({ bio: 'หลังแก้' });
    } finally { release(); await Promise.allSettled([command, mutation]); spy.mockRestore(); }
  });
  it('PATCH persists only owned fields, preserves omitted/private metadata and returns the canonical profile', async () => {
    await db.account.update({ where: { id: accounts.learner }, data: { profileJson: '{"bio":"old","school":"old school","privateAudit":"PRIVATE_META"}' } });
    const foreign = await stored('instructor'), before = await stored();
    const response = await patch({ display_name: 'ชื่อใหม่', username: 'p' + randomUUID().replace(/-/g, '').slice(0, 20),
      avatar_url: 'https://example.test/own.png', profile: { bio: 'ใหม่', interests: ['AI'] } }).expect(200);
    canonical(response.body); expect(response.body.display_name).toBe('ชื่อใหม่');
    expect(response.body.profile).toEqual({ bio: 'ใหม่', school: 'old school', interests: ['AI'] });
    const changed = await stored(); expect(changed.revision).toBe(before.revision + 1);
    expect(changed.normalizedUsername).toBe(response.body.username.toUpperCase());
    expect(JSON.parse(changed.profileJson).privateAudit).toBe('PRIVATE_META');
    for (const key of ['email', 'emailVerified', 'origin', 'roles', 'disabled'] as const) expect(changed[key]).toEqual(before[key]);
    expect(await stored('instructor')).toEqual(foreign); expect((await read().expect(200)).body).toEqual(response.body);
  });
  it('PATCH nullable text clears to canonical empty string, arrays replace and avatar null clears', async () => {
    const response = await patch({ avatar_url: null, profile: { bio: null, interests: [], learningGoals: ['one'] } }).expect(200);
    canonical(response.body); expect(response.body.avatar_url).toBeNull();
    expect(response.body.profile).toMatchObject({ bio: '', interests: [], learningGoals: ['one'] });
    expect(response.body.profile.school).toBe('old school');
  });
  it('PATCH empty payload performs no persistence mutation', async () => {
    const before = await stored(), beforeCounts = await counts();
    canonical((await patch({}).expect(200)).body); expect(await stored()).toEqual(before); expect(await counts()).toEqual(beforeCounts);
  });
  it('PATCH rejects privilege/identity injection and malformed nested input atomically', async () => {
    const before = await stored();
    for (const body of [{ roles: ['admin'] }, { email: 'foreign@example.test' }, { profile: { interests: null } },
      { display_name: 'valid', profile: { phone: 123 } }, { username: 'ab' }]) {
      const response = await patch(body).expect(422); assertErrorContract(response.body); expect(await stored()).toEqual(before);
    }
  });
  it('PATCH case-insensitive Username uniqueness returns canonical conflict without partial edits', async () => {
    const name = 'u' + randomUUID().replace(/-/g, '').slice(0, 20);
    await db.account.update({ where: { id: accounts.instructor }, data: { username: name, normalizedUsername: name.toUpperCase() } });
    const before = await stored(), response = await patch({ username: name.toUpperCase(), display_name: 'discard' }).expect(409);
    assertErrorContract(response.body); expect(response.body.error.code).toBe('username_taken'); expect(await stored()).toEqual(before);
  });
  it('PATCH two concurrent Username claims have exactly one winner', async () => {
    const name = 'r' + randomUUID().replace(/-/g, '').slice(0, 20);
    const responses = await Promise.all([patch({ username: name }, 'learner'), patch({ username: name.toUpperCase() }, 'instructor')]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await db.account.count({ where: { normalizedUsername: name.toUpperCase() } })).toBe(1);
  });
  it('PATCH allows unverified self editing and Admin own profile but enforces audience and anonymous boundaries', async () => {
    await db.account.update({ where: { id: accounts.learner }, data: { origin: 'self_email', emailVerified: false } });
    const result = await patch({ display_name: 'unverified own' }).expect(200); canonical(result.body); expect(result.body.learning_eligible).toBe(false);
    canonical((await patch({ display_name: 'admin own' }, 'admin', 'admin').expect(200)).body);
    await patch({}, 'learner', 'admin').expect(403);
    await request(app.getHttpServer()).patch('/api/v1/me').set('x-melearn-app', 'web').send({}).expect(401);
    await request(app.getHttpServer()).patch('/api/v1/me').set('x-melearn-app', 'admin')
      .set('Cookie', `melearn_web_session=${secrets.learner_web}`).send({}).expect(401);
  });
  it('PATCH rechecks revoked session after the guard and leaves the account untouched', async () => {
    const service = app.get(SelfProfileUpdateService), original = service.update.bind(service), before = await stored();
    const spy = jest.spyOn(service, 'update').mockImplementationOnce(async (reference, body) => {
      await db.appSession.update({ where: { tokenHash: reference.tokenHash }, data: { revokedAt: new Date() } });
      return original(reference, body);
    });
    try { await patch({ display_name: 'discard' }).expect(401); expect(await stored()).toEqual(before); }
    finally { spy.mockRestore(); await db.appSession.update({ where: { tokenHash: hash(secrets.learner_web) }, data: { revokedAt: null } }); }
  });
  it('PATCH rolls back the mutation on an actual database failure without leaking diagnostics', async () => {
    const prisma = app.get(PrismaService), original = prisma.$transaction.bind(prisma), before = await stored();
    const failing = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      original(async tx => { await callback(tx); await tx.$queryRaw`SELECT 1/0`; }, options)) as typeof prisma.$transaction;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(failing), log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try { const response = await patch({ display_name: 'rolled back' }).expect(500); assertErrorContract(response.body);
      expect(await stored()).toEqual(before); expect(JSON.stringify(response.body)).not.toMatch(/division|postgresql/); }
    finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('PATCH reconnect preserves profile and does not write credential, session or academic records', async () => {
    const beforeCounts = await counts(), sessions = await db.appSession.findMany({ where: { accountId: accounts.learner }, orderBy: { tokenHash: 'asc' } });
    const credential = await db.localCredential.findUnique({ where: { accountId: accounts.learner } });
    const response = await patch({ profile: { phone: '123', learningGoals: [] } }).expect(200); canonical(response.body);
    await db.$disconnect(); await db.$connect(); expect((await read().expect(200)).body).toEqual(response.body);
    expect(await counts()).toEqual(beforeCounts); expect(await db.localCredential.findUnique({ where: { accountId: accounts.learner } })).toEqual(credential);
    expect(await db.appSession.findMany({ where: { accountId: accounts.learner }, orderBy: { tokenHash: 'asc' } })).toEqual(sessions);
  });
});
