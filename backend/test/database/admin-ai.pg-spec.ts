import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { testConnections } from '../support/postgres';
import { assertTaskContract, assertErrorContract } from '../support/contract-validator';

describe('AI-01 Admin settings/transcript real HTTP / Test PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const tag = 'admin_ai_' + randomUUID();
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {};
  const courses: string[] = [], videos: string[] = [];
  let articleId: string, enrollmentId: string;
  const previousUrl = process.env.DATABASE_URL;
  const base = (index = 0) => '/api/v1/admin/courses/' + courses[index];
  const transcript = (index = 0, item = videos[index]) => base(index) + '/videos/' + item + '/ai-transcript';
  const tokenHash = (secret: string) => createHash('sha256').update(secret).digest('hex').toUpperCase();
  const actor = (call: request.Test, name = 'admin', audience = 'admin') => call.set('x-melearn-app', audience).set('Cookie', `melearn_${audience}_session=${secrets[name + '_' + audience]}`);
  async function learningSnapshot() {
    return Promise.all([db.course.findMany({ where: { id: { in: courses } }, orderBy: { id: 'asc' } }),
      db.courseChapter.findMany({ where: { courseId: { in: courses } }, orderBy: { id: 'asc' } }),
      db.courseItem.findMany({ where: { courseId: { in: courses } }, orderBy: { id: 'asc' } }),
      db.enrollment.findMany({ where: { courseId: { in: courses } } }), db.progress.findMany({ where: { courseId: { in: courses } } }),
      db.certificate.findMany({ where: { enrollmentId } }), db.courseReview.findMany({ where: { courseId: { in: courses } } }),
      db.quiz.findMany({ where: { courseId: { in: courses } } })]);
  }
  let initial: Awaited<ReturnType<typeof learningSnapshot>>;
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const name of ['admin', 'admin2', 'learner', 'instructor']) {
      accounts[name] = (await db.account.create({ data: { displayName: tag + name,
        // Deliberately contradictory compatibility strings cannot decide new authority.
        roles: name.startsWith('admin') ? 'learner' : 'admin',
        roleGrants: { create: [{ role: name.startsWith('admin') ? 'admin' : name }] } } })).id;
      for (const audience of ['web', 'admin']) {
        const secret = randomUUID(); secrets[name + '_' + audience] = secret;
        await db.appSession.create({ data: { tokenHash: tokenHash(secret), accountId: accounts[name], audience, expiresAt: new Date(Date.now() + 3600000) } });
      }
    }
    for (let index = 0; index < 2; index++) {
      const course = await db.course.create({ data: { slug: tag + index, title: tag, category: 'test', level: 'test',
        status: index ? 'draft' : 'published', publishedAt: index ? null : new Date('2026-10-11T01:00:00Z'),
        revision: 4, updatedAt: new Date('2026-10-11T01:00:00Z'), instructorId: accounts.instructor,
        chapters: { create: { title: tag, position: 0, items: { create: [
          { title: 'Video', type: 'video', position: 0, videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk', revision: 3 },
          { title: 'Article', type: 'article', position: 1, contentDoc: { nodes: ['PRIVATE_LESSON'] }, revision: 2 },
        ] } } } }, include: { chapters: { include: { items: true } } } });
      courses.push(course.id); videos.push(course.chapters[0].items.find(item => item.type === 'video')!.id);
      if (!index) articleId = course.chapters[0].items.find(item => item.type === 'article')!.id;
    }
    const enrollment = await db.enrollment.create({ data: { accountId: accounts.learner, courseId: courses[0],
      completedAt: new Date('2026-10-11T02:00:00Z'), completedItems: 2, completionSnapshot: { title: tag, preserved: true } } });
    enrollmentId = enrollment.id;
    await db.progress.create({ data: { enrollmentId, itemId: articleId, courseId: courses[0], completedAt: new Date(), resumeData: { preserved: true } } });
    await db.certificate.create({ data: { enrollmentId, code: tag, recipientName: tag, courseName: tag } });
    await db.courseReview.create({ data: { courseId: courses[0], submittedRevision: 4, submittedBy: accounts.instructor,
      reviewedBy: accounts.admin, result: 'approved', reviewedAt: new Date('2026-10-11T00:50:00Z') } });
    // Existing historical completion remains intact when Published content grows.
    const chapter = await db.courseChapter.findFirstOrThrow({ where: { courseId: courses[0] } });
    const quizItem = await db.courseItem.create({ data: { chapterId: chapter.id, courseId: courses[0], type: 'quiz', title: 'Added after completion', position: 2 } });
    await db.quiz.create({ data: { courseId: courses[0], itemId: quizItem.id, title: 'Existing quiz', instructions: { preserved: true } } });
    await db.course.update({ where: { id: courses[0] }, data: { revision: 5, updatedAt: new Date('2026-10-11T03:00:00Z') } });
    initial = await learningSnapshot();
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      if (enrollmentId) { await db.certificate.deleteMany({ where: { enrollmentId } }); await db.progress.deleteMany({ where: { enrollmentId } }); await db.enrollment.delete({ where: { id: enrollmentId } }); }
      await db.videoTranscript.deleteMany({ where: { itemId: { in: videos } } });
      await db.quiz.deleteMany({ where: { courseId: { in: courses } } });
      await db.courseReview.deleteMany({ where: { courseId: { in: courses } } });
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await db.appSession.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.userRole.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.account.deleteMany({ where: { id: { in: Object.values(accounts) } } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('returns canonical empty transcript for an existing video without creating a row', async () => {
    const response = await actor(request(app.getHttpServer()).get(transcript())).expect(200);
    assertTaskContract('AI-01', 'WireAdminTranscript', response.body);
    expect(response.body).toEqual({ item_id: videos[0], text: '', edited_by: null, edited_at: null });
    expect(await db.videoTranscript.count({ where: { itemId: videos[0] } })).toBe(0);
  });
  it('persists false/true support flags using normalized Admin authority without touching course learning metadata', async () => {
    for (const enabled of [true, false, true]) {
      const response = await actor(request(app.getHttpServer()).patch(base() + '/ai-support')).send({ ai_enabled: enabled }).expect(200);
      assertTaskContract('AI-01', 'AiSupportResponse', response.body);
      expect(response.body).toEqual({ course_id: courses[0], ai_enabled: enabled });
      const stored = await db.course.findUniqueOrThrow({ where: { id: courses[0] } });
      expect({ ...stored, aiEnabled: false }).toEqual(initial[0].find(course => course.id === courses[0]));
    }
  });
  it('preserves exact plaintext whitespace/timestamps on save, replacement and reconnect', async () => {
    for (const name of ['admin', 'admin2']) {
      const text = `  [00:01.200] สวัสดี ${name}\r\n\n[02:05] บทถัดไป  `;
      const response = await actor(request(app.getHttpServer()).put(transcript()), name).send({ text }).expect(200);
      assertTaskContract('AI-01', 'WireAdminTranscript', response.body);
      expect(response.body).toMatchObject({ item_id: videos[0], text, edited_by: accounts[name] });
      expect(new Date(response.body.edited_at).toISOString()).toBe(response.body.edited_at);
      await db.$disconnect(); await db.$connect();
      const read = await actor(request(app.getHttpServer()).get(transcript())).expect(200);
      expect(read.body).toEqual(response.body);
    }
    expect(await db.videoTranscript.count({ where: { itemId: videos[0] } })).toBe(1);
  });
  it('allows an explicit empty-text replacement and disabling support preserves the transcript record', async () => {
    const before = await actor(request(app.getHttpServer()).put(transcript())).send({ text: '' }).expect(200);
    await actor(request(app.getHttpServer()).patch(base() + '/ai-support')).send({ ai_enabled: false }).expect(200);
    expect((await actor(request(app.getHttpServer()).get(transcript())).expect(200)).body).toEqual(before.body);
  });
  it('rejects Learner/Instructor and spoofed compatibility roles for all three operations without writes', async () => {
    const before = await db.videoTranscript.findUniqueOrThrow({ where: { itemId: videos[0] } });
    for (const name of ['learner', 'instructor']) {
      const denied = await actor(request(app.getHttpServer()).patch(base() + '/ai-support'), name).send({ ai_enabled: true }).expect(403);
      assertErrorContract(denied.body);
      await actor(request(app.getHttpServer()).put(transcript()), name).send({ text: 'forged' }).expect(403);
      await actor(request(app.getHttpServer()).get(transcript()), name).expect(403);
    }
    expect(await db.videoTranscript.findUniqueOrThrow({ where: { itemId: videos[0] } })).toEqual(before);
    expect((await db.course.findUniqueOrThrow({ where: { id: courses[0] } })).aiEnabled).toBe(false);
  });
  it('rejects anonymous, wrong audience, expired/revoked sessions and newly disabled actors', async () => {
    await request(app.getHttpServer()).get(transcript()).expect(401);
    await actor(request(app.getHttpServer()).get(transcript()), 'admin', 'web').expect(401);
    await request(app.getHttpServer()).get(transcript()).set('x-melearn-app', 'web').set('Cookie', `melearn_admin_session=${secrets.admin_admin}`).expect(403);
    const hash = tokenHash(secrets.admin_admin);
    try {
      await db.appSession.update({ where: { tokenHash: hash }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await actor(request(app.getHttpServer()).get(transcript())).expect(401);
      await db.appSession.update({ where: { tokenHash: hash }, data: { expiresAt: new Date(Date.now() + 3600000), revokedAt: new Date() } });
      await actor(request(app.getHttpServer()).get(transcript())).expect(401);
      await db.appSession.update({ where: { tokenHash: hash }, data: { revokedAt: null } });
      await db.account.update({ where: { id: accounts.admin }, data: { disabled: true } });
      await actor(request(app.getHttpServer()).put(transcript())).send({ text: 'disabled actor' }).expect(401);
    } finally { await db.account.update({ where: { id: accounts.admin }, data: { disabled: false } }); }
  });
  it('observes normalized Admin-role revocation on the next request without accepting the legacy string', async () => {
    await db.userRole.delete({ where: { accountId_role: { accountId: accounts.admin, role: 'admin' } } });
    try { await actor(request(app.getHttpServer()).get(transcript())).expect(403); }
    finally { await db.userRole.create({ data: { accountId: accounts.admin, role: 'admin' } }); }
  });
  it('validates bool/text bodies strictly, rejecting omitted/null/extra fields and overly long text', async () => {
    for (const body of [{}, { ai_enabled: null }, { ai_enabled: 'false' }, { ai_enabled: true, revision: 9 }])
      await actor(request(app.getHttpServer()).patch(base() + '/ai-support')).send(body).expect(422);
    for (const body of [{}, { text: null }, { text: 12 }, { text: 'ok', edited_by: accounts.admin2 }, { text: 'a'.repeat(200001) }])
      await actor(request(app.getHttpServer()).put(transcript())).send(body).expect(422);
    await actor(request(app.getHttpServer()).put(transcript())).set('Content-Type', 'application/json').send('{').expect(400);
    await actor(request(app.getHttpServer()).patch(base() + '/ai-support')).set('Content-Type', 'application/json').send(' '.repeat(102401)).expect(413);
  });
  it('accepts the canonical 200,000 Unicode-character limit even as fully escaped JSON over 2MB', async () => {
    const body = '{"text":"' + '\\ud83d\\ude00'.repeat(200000) + '"}';
    const response = await actor(request(app.getHttpServer()).put(transcript(1))).set('Content-Type', 'application/json').send(body).expect(200);
    expect(response.body.text.length).toBe(400000);
    expect(response.body.text.startsWith('😀')).toBe(true);
    assertTaskContract('AI-01', 'WireAdminTranscript', response.body);
  });
  it('enforces same Course/Chapter/video ownership and rejects article, unknown, or mismatched resources', async () => {
    for (const path of [transcript(0, videos[1]), transcript(0, articleId), transcript(0, randomUUID()),
      '/api/v1/admin/courses/' + randomUUID() + '/videos/' + videos[0] + '/ai-transcript']) {
      const denied = await actor(request(app.getHttpServer()).get(path)).expect(404); assertErrorContract(denied.body);
      await actor(request(app.getHttpServer()).put(path)).send({ text: 'wrong target' }).expect(404);
    }
    await actor(request(app.getHttpServer()).patch('/api/v1/admin/courses/' + randomUUID() + '/ai-support')).send({ ai_enabled: true }).expect(404);
  });
  it('serializes concurrent replacements into one transcript with matching editor/content evidence', async () => {
    const responses = await Promise.all(['admin', 'admin2'].map(name => actor(request(app.getHttpServer()).put(transcript()), name).send({ text: name })));
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    const stored = await db.videoTranscript.findUniqueOrThrow({ where: { itemId: videos[0] } });
    expect(['admin', 'admin2']).toContain(stored.text);
    expect(stored.editedBy).toBe(accounts[stored.text]);
    expect(await db.videoTranscript.count({ where: { itemId: videos[0] } })).toBe(1);
  });
  it('rolls back failed persistence without changing the old transcript or leaking private diagnostics', async () => {
    const before = await db.videoTranscript.findUniqueOrThrow({ where: { itemId: videos[0] } });
    const prisma = app.get(PrismaService), transaction = prisma.$transaction.bind(prisma);
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce((async (work: (tx: unknown) => Promise<unknown>) =>
      transaction(async tx => { await work(tx); throw new Error('PRIVATE_TX_DIAGNOSTIC'); })) as unknown as typeof prisma.$transaction);
    const logs = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const response = await actor(request(app.getHttpServer()).put(transcript())).send({ text: 'rollback' }).expect(500);
      expect(JSON.stringify(response.body) + JSON.stringify(logs.mock.calls)).not.toContain('PRIVATE_TX_DIAGNOSTIC');
      expect(await db.videoTranscript.findUniqueOrThrow({ where: { itemId: videos[0] } })).toEqual(before);
    } finally { spy.mockRestore(); logs.mockRestore(); }
  });
  it('keeps approval/content/enrollment/progress/certificate snapshots intact and public detail free of raw transcripts', async () => {
    expect(await learningSnapshot()).toEqual(initial);
    const publicDetail = await request(app.getHttpServer()).get('/api/v1/courses/' + courses[0]).expect(200);
    expect(JSON.stringify(publicDetail.body)).not.toMatch(/edited_by|ai_enabled|Transcript|PRIVATE_LESSON/);
    expect(publicDetail.body).not.toHaveProperty('text');
  });
});
