import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrincipalService } from '../../src/features/auth/public/index';
import { VideoUploadService } from '../../src/features/courses/video-upload.service';
import { ApiException } from '../../src/shared/errors/api-exception';
import { VideoUploadUnavailableException } from '../../src/shared/errors/video-upload-unavailable.exception';
import { PrismaService } from '../../src/prisma/prisma.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract } from '../support/contract-validator';

describe('VIDEO-01 exact unavailable HTTP / fresh authoring authority / Test PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const tag = 'video_unavailable_' + randomUUID(), previousUrl = process.env.DATABASE_URL;
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {}, courses: string[] = [];
  const upload = (name = 'owner', audience = 'web', courseId = courses[0]) => request(app.getHttpServer())
    .post('/api/v1/courses/' + courseId + '/videos/uploads').set('x-melearn-app', audience)
    .set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`);
  async function counts() {
    return Promise.all(Object.values(Prisma.ModelName).map(name => (db as any)[name[0].toLowerCase() + name.slice(1)].count()));
  }
  async function state() {
    return Promise.all([db.course.findMany({ where: { id: { in: courses } }, orderBy: { id: 'asc' } }),
      db.courseItem.findMany({ where: { courseId: { in: courses } }, orderBy: { id: 'asc' } }),
      db.enrollment.findMany({ where: { courseId: { in: courses } }, orderBy: { id: 'asc' } }),
      db.progress.findMany({ where: { courseId: { in: courses } }, orderBy: { id: 'asc' } }),
      db.certificate.findMany({ where: { enrollment: { courseId: { in: courses } } }, orderBy: { id: 'asc' } })]);
  }
  function unavailable(response: request.Response) {
    assertErrorContract(response.body);
    expect(response.body).toEqual({ error: { code: 'video_upload_not_available', message: 'ขออภัย ระบบนี้ยังไม่พร้อมใช้งาน',
      request_id: response.headers['x-request-id'] } });
    expect(response.headers['content-type']).toContain('application/json'); expect(response.headers.location).toBeUndefined();
  }
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const name of ['owner', 'other', 'admin', 'learner']) {
      const role = ['owner', 'other'].includes(name) ? 'instructor' : name;
      accounts[name] = (await db.account.create({ data: { displayName: tag + name, roles: role === 'admin' ? 'learner' : 'admin',
        origin: name === 'owner' ? 'self_email' : 'admin_created', emailVerified: false, roleGrants: { create: { role } } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[name + '_' + audience] = secret;
        await db.appSession.create({ data: { accountId: accounts[name], audience,
          tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase(), expiresAt: new Date(Date.now() + 3600000) } });
      }
    }
    for (const status of ['draft', 'published']) {
      courses.push((await db.course.create({ data: { title: tag, slug: tag + status, category: 'test', level: 'test',
        instructorId: accounts.owner, status, publishedAt: status === 'published' ? new Date() : null,
        coverUrl: 'https://example.invalid/cover.png', chapters: { create: { title: tag, position: 0,
          items: { create: { title: tag, position: 0, type: 'video', videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk' } } } } } })).id);
    }
    const item = await db.courseItem.findFirstOrThrow({ where: { courseId: courses[1] } });
    const enrollment = await db.enrollment.create({ data: { accountId: accounts.learner, courseId: courses[1], completedItems: 1,
      completedAt: new Date('2026-10-10T00:00:00Z'), completionSnapshot: { preserved: true } } });
    await db.progress.create({ data: { enrollmentId: enrollment.id, courseId: courses[1], itemId: item.id,
      completedAt: new Date('2026-10-10T00:00:00Z'), resumeData: { position_seconds: 12 } } });
    await db.certificate.create({ data: { enrollmentId: enrollment.id, code: tag, recipientName: tag, courseName: tag } });
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      await db.certificate.deleteMany({ where: { enrollment: { courseId: { in: courses } } } });
      await db.progress.deleteMany({ where: { courseId: { in: courses } } }); await db.enrollment.deleteMany({ where: { courseId: { in: courses } } });
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await db.appSession.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.userRole.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.account.deleteMany({ where: { id: { in: Object.values(accounts) } } }); await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('owner gets exact canonical 503 for Draft; authoring does not require enrollment/email learning readiness', async () => {
    unavailable(await upload().expect(503));
  });
  it('owner gets the same unavailable result for Published and existing YouTube is untouched', async () => {
    const before = await state(); unavailable(await upload('owner', 'web', courses[1]).expect(503)); expect(await state()).toEqual(before);
  });
  it('normalized Admin can manage another instructor course through either canonical audience', async () => {
    unavailable(await upload('admin', 'admin').expect(503)); unavailable(await upload('admin', 'web').expect(503));
  });
  it('foreign Instructor is denied even when compatibility role claims Admin', async () => {
    const response = await upload('other').expect(403); assertErrorContract(response.body); expect(response.body.error.code).toBe('forbidden');
  });
  it('Learner and anonymous cannot call an authoring capability', async () => {
    await upload('learner').expect(403); await upload('learner', 'admin').expect(403);
    await request(app.getHttpServer()).post('/api/v1/courses/' + courses[0] + '/videos/uploads').expect(401);
  });
  it('app header only selects session namespace and cannot upgrade Web Instructor to Admin audience', async () => {
    await upload().set('x-melearn-app', 'admin').expect(401); await upload('owner', 'admin').expect(403);
    await upload().set('x-melearn-app', 'unknown').expect(403);
    await upload().unset('x-melearn-app').expect(403);
  });
  it('expired/revoked sessions and disabled accounts fail before any capability access', async () => {
    const tokenHash = createHash('sha256').update(secrets.owner_web).digest('hex').toUpperCase();
    const session = await db.appSession.findUniqueOrThrow({ where: { tokenHash } });
    try {
      await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(0) } }); await upload().expect(401);
      await db.appSession.update({ where: { tokenHash }, data: { expiresAt: session.expiresAt, revokedAt: new Date() } }); await upload().expect(401);
      await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null } });
      await db.account.update({ where: { id: accounts.owner }, data: { disabled: true } }); await upload().expect(401);
    } finally {
      await db.appSession.update({ where: { tokenHash }, data: { expiresAt: session.expiresAt, revokedAt: null } });
      await db.account.update({ where: { id: accounts.owner }, data: { disabled: false } });
    }
  });
  it('authorized missing Course returns 404 rather than claiming an upload capability', async () => {
    const response = await upload('admin', 'admin', 'unknown-' + tag).expect(404); assertErrorContract(response.body);
  });
  it('multipart file bytes and attempted JSON URL/actor fields never create storage rows or modify images/YouTube/history', async () => {
    const before = await state(), beforeCounts = await counts();
    unavailable(await upload().attach('file', Buffer.from('PRIVATE_VIDEO_BYTES'), 'fixture.mp4').expect(503));
    unavailable(await upload().send({ video_url: 'https://example.invalid/forged', actor_id: accounts.admin }).expect(503));
    expect(await state()).toEqual(before); expect(await counts()).toEqual(beforeCounts);
  });
  it('repeat/concurrent calls leave all 27 model counts and actual Course/learning values unchanged after reconnect', async () => {
    const before = await state(), beforeCounts = await counts();
    const responses = await Promise.all(Array.from({ length: 4 }, () => upload())); responses.forEach(response => { expect(response.status).toBe(503); unavailable(response); });
    await db.$disconnect(); await db.$connect(); expect(await state()).toEqual(before); expect(await counts()).toEqual(beforeCounts);
  });
  it('post-guard role removal is revalidated inside the resource transaction', async () => {
    const service = app.get(VideoUploadService), original = service.unavailable.bind(service);
    const spy = jest.spyOn(service, 'unavailable').mockImplementationOnce(async (...args) => {
      await db.userRole.deleteMany({ where: { accountId: accounts.owner, role: 'instructor' } }); return original(...args);
    });
    try { await upload().expect(403); }
    finally { spy.mockRestore(); await db.userRole.create({ data: { accountId: accounts.owner, role: 'instructor' } }); }
  });
  it('arbitrary database failure is generic safe 500, not a successful/unavailable upload receipt', async () => {
    const spy = jest.spyOn(app.get(PrismaService), '$transaction').mockRejectedValueOnce(new Error('PRIVATE_DB_SECRET'));
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const response = await upload().expect(500); assertErrorContract(response.body); expect(response.body.error.code).toBe('internal_error');
      expect(JSON.stringify(response.body) + JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_DB_SECRET');
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('unclassified ApiException 503 diagnostics remain hidden; typed planned error exposes only fixed canonical text', async () => {
    const spy = jest.spyOn(app.get(VideoUploadService), 'unavailable').mockRejectedValueOnce(new ApiException('video_upload_not_available', 503, 'PRIVATE_DIAGNOSTIC'));
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const hidden = await upload().expect(500); expect(JSON.stringify(hidden.body)).not.toContain('PRIVATE_DIAGNOSTIC');
      const planned = new VideoUploadUnavailableException(); planned.message = 'PRIVATE_DIAGNOSTIC';
      spy.mockRejectedValueOnce(planned); unavailable(await upload().expect(503));
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  it('holds authoring authority until transaction ends; concurrent disable waits then next request is denied', async () => {
    const principals = app.get(PrincipalService), original = principals.requireAuthoring.bind(principals);
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; }), held = new Promise<void>(resolve => { ready = resolve; });
    const changing = new Promise<void>(resolve => { started = resolve; });
    const spy = jest.spyOn(principals, 'requireAuthoring').mockImplementationOnce(async (...args) => { const actor = await original(...args); ready(); await gate; return actor; });
    const command = upload().then(response => response); await held;
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
      expect(blocked).toBe(true); release(); expect((await command).status).toBe(503); await mutation; await upload().expect(401);
    } finally { release(); await Promise.allSettled([command, mutation]); spy.mockRestore(); await db.account.update({ where: { id: accounts.owner }, data: { disabled: false } }); }
  });
});
