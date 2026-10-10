import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { FreeEnrollmentService } from '../../src/features/enrollments/free-enrollment.service';
import { EntitlementWriter } from '../../src/features/enrollments/public/entitlement-writer.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('ENROLL-01 Free Enroll canonical HTTP / Test PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const tag = 'free_http_' + randomUUID(), previousUrl = process.env.DATABASE_URL;
  const accounts: Record<string, string> = {}, courses: Record<string, string> = {}, secrets: Record<string, string> = {};
  const hash = (secret: string) => createHash('sha256').update(secret).digest('hex').toUpperCase();
  const ref = (name: string) => ({ tokenHash: hash(secrets[name + '_web']), audience: 'web' as const });
  const actor = (call: request.Test, name = 'learner', audience = 'web') => call.set('x-melearn-app', audience)
    .set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`);
  const enroll = (course = 'free', name = 'learner', body?: object) => {
    const call = actor(request(app.getHttpServer()).post('/api/v1/courses/' + (courses[course] ?? course) + '/enroll'), name);
    return body === undefined ? call : call.send(body);
  };
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const name of ['learner', 'instructor', 'owner', 'admin', 'mixed', 'unverified', 'verified', 'google', 'google_unverified', 'no_role']) {
      const roles = name === 'mixed' ? ['admin', 'learner'] : name === 'no_role' ? [] :
        [name === 'admin' ? 'admin' : ['instructor', 'owner'].includes(name) ? 'instructor' : 'learner'];
      const origin = name.startsWith('google') ? 'google' : ['verified', 'unverified'].includes(name) ? 'self_email' : 'admin_created';
      accounts[name] = (await db.account.create({ data: { displayName: tag + name, origin,
        roles: name === 'admin' ? 'learner' : 'admin', emailVerified: ['verified', 'google'].includes(name),
        roleGrants: { create: roles.map(role => ({ role })) } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[name + '_' + audience] = secret;
        await db.appSession.create({ data: { tokenHash: hash(secret), accountId: accounts[name], audience, expiresAt: new Date(Date.now() + 3600000) } });
      }
    }
    for (const name of ['free', 'zero', 'paid', 'draft', 'submitted_for_review', 'approved', 'archived', 'no_publish_time', 'own', 'rollback', 'race', 'existing', 'authority_race', 'price_race']) {
      const status = ['draft', 'submitted_for_review', 'approved', 'archived'].includes(name) ? name : 'published';
      courses[name] = (await db.course.create({ data: { slug: tag + name, title: tag + name, category: 'test', level: 'test', status,
        publishedAt: status === 'published' && name !== 'no_publish_time' ? new Date() : null,
        priceMinor: name === 'paid' ? 2500 : name === 'zero' ? 0 : null, instructorId: accounts.owner } })).id;
    }
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      await db.enrollment.deleteMany({ where: { courseId: { in: Object.values(courses) } } });
      await db.course.deleteMany({ where: { id: { in: Object.values(courses) } } });
      await db.appSession.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.userRole.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.account.deleteMany({ where: { id: { in: Object.values(accounts) } } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('returns canonical lifetime grant, accepts omitted/empty body and persists across reconnect without refreshing authority', async () => {
    const sessions = await db.appSession.findMany({ where: { accountId: accounts.learner }, orderBy: { tokenHash: 'asc' } });
    const first = await enroll().expect(200); assertTaskContract('ENROLL-01', 'EnrollmentDto', first.body);
    expect(first.body).toMatchObject({ course_id: courses.free, source: 'free', access: 'lifetime' });
    await db.$disconnect(); await db.$connect();
    expect((await enroll('free', 'learner', {}).expect(200)).body).toEqual(first.body);
    expect(await db.enrollment.count({ where: { courseId: courses.free, accountId: accounts.learner } })).toBe(1);
    expect(await db.appSession.findMany({ where: { accountId: accounts.learner }, orderBy: { tokenHash: 'asc' } })).toEqual(sessions);
  });
  it('allows zero-price courses and Instructor learning another instructors course using normalized roles', async () => {
    const response = await enroll('zero', 'instructor', {}).expect(200);
    assertTaskContract('ENROLL-01', 'EnrollmentDto', response.body);
    expect((await db.enrollment.findUniqueOrThrow({ where: { id: response.body.id } })).accountId).toBe(accounts.instructor);
  });
  it('enforces self-email verification, accepts admin-created and verified Google provenance without trusting origin alone', async () => {
    for (const name of ['unverified', 'google_unverified']) {
      const response = await enroll('free', name).expect(403); assertErrorContract(response.body);
      expect(response.body.error.code).toBe('email_not_verified');
      expect(await db.enrollment.count({ where: { accountId: accounts[name] } })).toBe(0);
    }
    for (const name of ['verified', 'google']) await enroll('free', name).expect(200);
  });
  it('rejects Admin, mixed Admin/Learner, roleless and own-course actors without grants', async () => {
    for (const name of ['admin', 'mixed', 'no_role', 'owner']) {
      const response = await enroll('own', name).expect(403); assertErrorContract(response.body);
      expect(await db.enrollment.count({ where: { accountId: accounts[name] } })).toBe(0);
    }
  });
  it('rejects paid courses and hides every unpublished/archived/unknown course without granting access', async () => {
    const paid = await enroll('paid').expect(409); assertErrorContract(paid.body);
    expect(paid.body.error.code).toBe('paid_course_requires_checkout');
    for (const name of ['draft', 'submitted_for_review', 'approved', 'archived', 'no_publish_time', randomUUID()]) {
      const response = await enroll(name).expect(404); assertErrorContract(response.body);
    }
    expect(await db.enrollment.count({ where: { courseId: { in: ['paid', 'draft', 'submitted_for_review', 'approved', 'archived', 'no_publish_time'].map(name => courses[name]) } } })).toBe(0);
  });
  it('rejects client-owned IDs, source, price, roles and academic fields against EmptyRequest', async () => {
    const before = await db.enrollment.findMany({ where: { courseId: courses.free } });
    for (const body of [{ account_id: accounts.admin }, { source: 'stripe' }, { price: 0 }, { roles: ['admin'] }, { score: 100 }, { __proto__: null, other: true }]) {
      const response = await enroll('free', 'learner', body).expect(422); assertErrorContract(response.body);
    }
    const array = await actor(request(app.getHttpServer()).post('/api/v1/courses/' + courses.free + '/enroll')).send([]).expect(422);
    assertErrorContract(array.body);
    await actor(request(app.getHttpServer()).post('/api/v1/courses/' + courses.free + '/enroll')).set('Content-Type', 'application/json').send('null').expect(400);
    expect(await db.enrollment.findMany({ where: { courseId: courses.free } })).toEqual(before);
  });
  it('rejects missing/wrong audience, forged headers, expired/revoked sessions and disabled accounts', async () => {
    const path = '/api/v1/courses/' + courses.free + '/enroll';
    await request(app.getHttpServer()).post(path).expect(401);
    await actor(request(app.getHttpServer()).post(path), 'learner', 'admin').expect(401);
    await request(app.getHttpServer()).post(path).set('x-melearn-app', 'admin').set('Cookie', `melearn_web_session=${secrets.learner_web}`).expect(403);
    const stored = await db.appSession.findUniqueOrThrow({ where: { tokenHash: ref('learner').tokenHash } });
    try {
      await db.appSession.update({ where: { tokenHash: stored.tokenHash }, data: { expiresAt: new Date(0) } }); await enroll().expect(401);
      await db.appSession.update({ where: { tokenHash: stored.tokenHash }, data: { expiresAt: stored.expiresAt, revokedAt: new Date() } }); await enroll().expect(401);
      await db.appSession.update({ where: { tokenHash: stored.tokenHash }, data: { revokedAt: null } });
      await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } }); await enroll().expect(401);
    } finally {
      await db.appSession.update({ where: { tokenHash: stored.tokenHash }, data: { expiresAt: stored.expiresAt, revokedAt: null } });
      await db.account.update({ where: { id: accounts.learner }, data: { disabled: false } });
    }
  });
  it('rechecks revoked authority inside the command instead of trusting a previously resolved principal', async () => {
    const stored = ref('learner');
    await db.appSession.update({ where: { tokenHash: stored.tokenHash }, data: { revokedAt: new Date() } });
    try { await expect(app.get(FreeEnrollmentService).enroll(stored, courses.race)).rejects.toMatchObject({ status: 401 }); }
    finally { await db.appSession.update({ where: { tokenHash: stored.tokenHash }, data: { revokedAt: null } }); }
    expect(await db.enrollment.count({ where: { courseId: courses.race } })).toBe(0);
  });
  it('concurrent HTTP requests converge on one persisted original lifetime entitlement', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => enroll('race', 'learner', {}).expect(200)));
    results.forEach(response => assertTaskContract('ENROLL-01', 'EnrollmentDto', response.body));
    expect(new Set(results.map(response => JSON.stringify(response.body))).size).toBe(1);
    expect(await db.enrollment.count({ where: { courseId: courses.race, accountId: accounts.learner } })).toBe(1);
  });
  it('returns the existing grant without overwriting its source, time or historic completion snapshot', async () => {
    const previous = await db.enrollment.create({ data: { accountId: accounts.learner, courseId: courses.existing, source: 'stripe',
      grantedAt: new Date('2026-01-01T01:00:00Z'), completedItems: 4, completedAt: new Date('2026-01-02T00:00:00Z'), completionSnapshot: { historical: true } } });
    const response = await enroll('existing').expect(200); assertTaskContract('ENROLL-01', 'EnrollmentDto', response.body);
    expect(response.body).toEqual({ id: previous.id, course_id: previous.courseId, source: 'stripe', access: 'lifetime', granted_at: previous.grantedAt.toISOString() });
    expect(await db.enrollment.findUniqueOrThrow({ where: { id: previous.id } })).toEqual(previous);
  });
  it('rolls the real insert back if the downstream participant fails and returns a safe error', async () => {
    const writer = app.get(EntitlementWriter), original = writer.grantEntitlement.bind(writer);
    const spy = jest.spyOn(writer, 'grantEntitlement').mockImplementation(async (...args) => { await original(...args); throw new Error('PRIVATE_GRANT_SQL'); });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const response = await enroll('rollback').expect(500); assertErrorContract(response.body);
      expect(JSON.stringify(response.body)).not.toContain('PRIVATE_GRANT_SQL');
      expect(await db.enrollment.count({ where: { courseId: courses.rollback } })).toBe(0);
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  async function assertBlockedMutation(course: string, mutate: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    let release!: () => void, locked!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { locked = resolve; });
    const mutationStarted = new Promise<void>(resolve => { started = resolve; });
    const writer = app.get(EntitlementWriter), original = writer.grantEntitlement.bind(writer);
    const spy = jest.spyOn(writer, 'grantEntitlement').mockImplementation(async (...args) => { locked(); await gate; return original(...args); });
    const grant = enroll(course).expect(200).then(response => response);
    await ready;
    const mutation = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      started(); await mutate(tx);
    }, { timeout: 10000 });
    await mutationStarted;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`;
        if (rows[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); await grant; await mutation;
    } finally { release(); await Promise.allSettled([grant, mutation]); spy.mockRestore(); }
  }
  it('holds Course state through commit so concurrent conversion to paid cannot interleave with the grant', async () => {
    await assertBlockedMutation('price_race', tx => tx.course.update({ where: { id: courses.price_race }, data: { priceMinor: 900 } }));
    await enroll('price_race').expect(409);
    expect(await db.enrollment.count({ where: { courseId: courses.price_race } })).toBe(1);
  });
  it('blocks a new Admin role grant during the learning transaction, then denies further enrollment', async () => {
    try {
      await assertBlockedMutation('authority_race', tx => tx.userRole.create({ data: { accountId: accounts.learner, role: 'admin' } }));
      await enroll('zero').expect(403);
    } finally { await db.userRole.deleteMany({ where: { accountId: accounts.learner, role: 'admin' } }); }
    expect(await db.enrollment.count({ where: { courseId: courses.authority_race } })).toBe(1);
  });
});
