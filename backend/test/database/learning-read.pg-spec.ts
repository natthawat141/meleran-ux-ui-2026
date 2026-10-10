import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { LearningCourseDto } from '../../src/features/learning/dto/learning.dto';
import { VerifiedSessionReference } from '../../src/features/auth/public/index';
import { LearningReadService } from '../../src/features/learning/learning-read.service';
import { testConnections } from '../support/postgres';
import { assertErrorContract, assertTaskContract } from '../support/contract-validator';

describe('LEARN-01 enrolled course/item reads / actual HTTP / Test PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const tag = 'learning_read_' + randomUUID(), previousUrl = process.env.DATABASE_URL;
  const accounts: Record<string, string> = {}, secrets: Record<string, string> = {}, courses: Record<string, string> = {};
  const items: Record<string, string> = {}, grants: Record<string, string> = {};
  let quizId: string, lateChapterId: string;
  const hash = (secret: string) => createHash('sha256').update(secret).digest('hex').toUpperCase();
  const actor = (call: request.Test, name = 'learner') => call.set('x-melearn-app', 'web').set('Cookie', `melearn_web_session=${secrets[name]}`);
  const course = (name = 'learner', which = 'published') => actor(request(app.getHttpServer()).get('/api/v1/learn/courses/' + courses[which]), name);
  const item = (key: string, name = 'learner', which = 'published') => actor(request(app.getHttpServer()).get('/api/v1/learn/courses/' + courses[which] + '/items/' + (items[key] ?? key)), name);
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const name of ['learner', 'other', 'owner', 'instructor', 'admin', 'mixed', 'unverified']) {
      const roles = name === 'mixed' ? ['admin', 'learner'] : [name === 'admin' ? 'admin' : ['owner', 'instructor'].includes(name) ? 'instructor' : 'learner'];
      accounts[name] = (await db.account.create({ data: { displayName: tag + name, avatarUrl: null,
        profileJson: '{"phone":"PRIVATE_PROFILE"}', roles: name === 'admin' ? 'learner' : 'admin',
        origin: name === 'unverified' ? 'self_email' : 'admin_created', emailVerified: false,
        roleGrants: { create: roles.map(role => ({ role })) } } })).id;
      const secret = randomUUID(); secrets[name] = secret;
      await db.appSession.create({ data: { tokenHash: hash(secret), accountId: accounts[name], audience: 'web', expiresAt: new Date(Date.now() + 3600000) } });
    }
    for (const status of ['published', 'draft', 'archived', 'paid']) {
      courses[status] = (await db.course.create({ data: { slug: tag + status, title: 'คอร์สจริง', category: 'test', level: 'test',
        status: status === 'paid' ? 'published' : status, publishedAt: ['published', 'paid'].includes(status) ? new Date('2026-10-11T00:00:00Z') : null,
        priceMinor: status === 'paid' ? 2500 : null, instructorId: accounts.owner } })).id;
    }
    const firstChapter = await db.courseChapter.create({ data: { courseId: courses.published, title: 'บทแรก', position: 0 } });
    lateChapterId = (await db.courseChapter.create({ data: { courseId: courses.published, title: 'บทถัดไป', position: 1 } })).id;
    for (const [key, type, position, chapterId] of [
      ['article', 'article', 0, firstChapter.id], ['video', 'video', 1, firstChapter.id], ['quiz', 'quiz', 0, lateChapterId], ['missing_quiz', 'quiz', 1, lateChapterId],
    ] as const) {
      items[key] = (await db.courseItem.create({ data: { courseId: courses.published, chapterId, type, position, title: key,
        videoUrl: type === 'video' ? 'https://www.youtube.com/watch?v=abcdefghijk' : 'PRIVATE_UNUSED_VIDEO',
        contentDoc: type === 'article' ? { type: 'doc', nodes: [{ type: 'paragraph', text: 'บทอ่านจริง' }] } : { private: 'PRIVATE_NON_ARTICLE_DOC' } } })).id;
    }
    const foreignChapter = await db.courseChapter.create({ data: { courseId: courses.paid, title: 'อีกคอร์ส', position: 0 } });
    items.foreign = (await db.courseItem.create({ data: { courseId: courses.paid, chapterId: foreignChapter.id, title: 'PRIVATE_FOREIGN_LESSON', type: 'article', position: 0 } })).id;
    quizId = (await db.quiz.create({ data: { courseId: courses.published, itemId: items.quiz, title: 'Quiz', instructions: { private: 'PRIVATE_EDITOR_INSTRUCTIONS' },
      questions: { create: [{ position: 0, type: 'single_choice', prompt: 'PRIVATE_QUESTION', options: ['PRIVATE_OPTION'], correctKey: 'PRIVATE_CORRECT_KEY', maxScore: '1.25' },
        { position: 1, type: 'essay', prompt: 'PRIVATE_QUESTION2', options: [], correctKey: 'PRIVATE_CORRECT_KEY2', maxScore: '2.50' }] } } })).id;
    await db.videoTranscript.create({ data: { itemId: items.video, text: 'PRIVATE_RAW_TRANSCRIPT', editedBy: accounts.admin } });
    for (const name of ['other', 'instructor', 'owner', 'unverified']) grants[name] = (await db.enrollment.create({ data: { accountId: accounts[name], courseId: courses.published } })).id;
    await db.progress.create({ data: { enrollmentId: grants.other, courseId: courses.published, itemId: items.video,
      completedAt: new Date('2026-10-11T02:00:00Z'), resumeData: { position_seconds: 999, private: 'PRIVATE_FOREIGN_PROGRESS' } } });
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      const enrollmentIds = (await db.enrollment.findMany({ where: { courseId: { in: Object.values(courses) } }, select: { id: true } })).map(row => row.id);
      await db.certificate.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
      await db.progress.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
      await db.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
      await db.videoTranscript.deleteMany({ where: { itemId: items.video } });
      if (quizId) await db.question.deleteMany({ where: { quizId } });
      await db.quiz.deleteMany({ where: { courseId: { in: Object.values(courses) } } });
      await db.course.deleteMany({ where: { id: { in: Object.values(courses) } } });
      await db.appSession.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.userRole.deleteMany({ where: { accountId: { in: Object.values(accounts) } } });
      await db.account.deleteMany({ where: { id: { in: Object.values(accounts) } } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('denies course/content access without Enrollment and does not turn GET into a free grant', async () => {
    for (const call of [course(), item('article')]) { const response = await call.expect(403); assertErrorContract(response.body); }
    expect(await db.enrollment.count({ where: { accountId: accounts.learner } })).toBe(0);
  });
  it('opens canonical course after the real Free Enroll command with stable outline and no invented progress', async () => {
    const grant = await actor(request(app.getHttpServer()).post('/api/v1/courses/' + courses.published + '/enroll')).expect(200);
    grants.learner = grant.body.id;
    const response = await course().expect(200); assertTaskContract('LEARN-01', 'WireLearningCourse', response.body);
    expect(response.body.access).toEqual({ mode: 'enrolled', enrollment: grant.body });
    expect((response.body as LearningCourseDto).outline.map(chapter => chapter.title)).toEqual(['บทแรก', 'บทถัดไป']);
    expect((response.body as LearningCourseDto).outline.flatMap(chapter => chapter.items).map(entry => entry.id)).toEqual([items.article, items.video, items.quiz, items.missing_quiz]);
    expect(response.body.progress).toEqual({ completed_items: 0, total_items: 4, completed_at: null });
    expect(response.body.resume_item_id).toBeNull(); expect(response.body.certificate_id).toBeNull();
    expect(await db.progress.count({ where: { enrollmentId: grants.learner } })).toBe(0);
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_');
  });
  it('returns type-specific Article/YouTube/Quiz metadata without answer keys, instructions or raw Transcript', async () => {
    const article = await item('article').expect(200); assertTaskContract('LEARN-01', 'WireLearningItemContent', article.body);
    expect(article.body).toEqual({ id: items.article, type: 'article', title: 'article', body: null,
      body_doc: { type: 'doc', nodes: [{ type: 'paragraph', text: 'บทอ่านจริง' }] } });
    const video = await item('video').expect(200); assertTaskContract('LEARN-01', 'WireLearningItemContent', video.body);
    expect(video.body).toEqual({ id: items.video, type: 'video', title: 'video', video_url: 'https://www.youtube.com/watch?v=abcdefghijk' });
    const quiz = await item('quiz').expect(200); assertTaskContract('LEARN-01', 'WireLearningItemContent', quiz.body);
    expect(quiz.body).toEqual({ id: items.quiz, type: 'quiz', title: 'quiz', quiz: { question_count: 2, max_score: 3.75 } });
    for (const response of [article, video, quiz]) expect(JSON.stringify(response.body)).not.toContain('PRIVATE_');
  });
  it('allows Instructor learning another instructors course and all stored lifetime grant sources without expiry', async () => {
    const instructor = await course('instructor').expect(200); assertTaskContract('LEARN-01', 'WireLearningCourse', instructor.body);
    for (const [name, source] of [['learner', 'stripe'], ['instructor', 'redeem']] as const) {
      const grant = await db.enrollment.create({ data: { accountId: accounts[name], courseId: courses.paid, source, grantedAt: new Date('2000-01-01T00:00:00Z') } });
      const response = await course(name, 'paid').expect(200); assertTaskContract('LEARN-01', 'WireLearningCourse', response.body);
      expect(response.body.access.enrollment.source).toBe(source); expect(response.body.access.enrollment.id).toBe(grant.id);
      expect(response.body.price).toEqual({ amount_minor: 2500, currency: 'THB' });
    }
  });
  it('denies Admin/mixed/owner management authority as learner access, even with an existing owner grant', async () => {
    for (const name of ['admin', 'mixed', 'owner']) for (const call of [course(name), item('video', name)]) {
      const response = await call.expect(403); assertErrorContract(response.body);
    }
    expect(await db.progress.count({ where: { enrollmentId: grants.owner } })).toBe(0);
    expect(await db.certificate.count({ where: { enrollmentId: grants.owner } })).toBe(0);
  });
  it('denies unverified, anonymous, expired/revoked/disabled and wrong-audience readers', async () => {
    for (const call of [course('unverified'), item('article', 'unverified')]) {
      const response = await call.expect(403); expect(response.body.error.code).toBe('email_not_verified');
    }
    const path = '/api/v1/learn/courses/' + courses.published;
    await request(app.getHttpServer()).get(path).expect(401);
    await actor(request(app.getHttpServer()).get(path)).set('x-melearn-app', 'admin').expect(403);
    await request(app.getHttpServer()).get(path).set('x-melearn-app', 'admin').set('Cookie', `melearn_admin_session=${secrets.learner}`).expect(401);
    const tokenHash = hash(secrets.learner), session = await db.appSession.findUniqueOrThrow({ where: { tokenHash } });
    try {
      await db.appSession.update({ where: { tokenHash }, data: { expiresAt: new Date(0) } }); await course().expect(401);
      await db.appSession.update({ where: { tokenHash }, data: { expiresAt: session.expiresAt, revokedAt: new Date() } }); await item('article').expect(401);
      await db.appSession.update({ where: { tokenHash }, data: { revokedAt: null } });
      await db.account.update({ where: { id: accounts.learner }, data: { disabled: true } }); await course().expect(401);
    } finally {
      await db.appSession.update({ where: { tokenHash }, data: { expiresAt: session.expiresAt, revokedAt: null } });
      await db.account.update({ where: { id: accounts.learner }, data: { disabled: false } });
    }
  });
  it('hides draft/archived/unknown courses and rejects a foreign or unknown item within an authorized course', async () => {
    for (const which of ['draft', 'archived']) for (const call of [course('learner', which), item('article', 'learner', which)]) {
      const response = await call.expect(404); assertErrorContract(response.body);
    }
    for (const key of ['foreign', randomUUID()]) { const response = await item(key).expect(404); assertErrorContract(response.body); }
    await actor(request(app.getHttpServer()).get('/api/v1/learn/courses/' + randomUUID())).expect(404);
  });
  it('reads only own completed/resume rows, computes current counts from rows rather than a stale cached counter', async () => {
    await db.progress.createMany({ data: [
      { enrollmentId: grants.learner, courseId: courses.published, itemId: items.article, completedAt: new Date('2026-10-11T01:00:00Z'), resumeData: { position_seconds: null }, updatedAt: new Date('2026-10-11T02:00:00Z') },
      { enrollmentId: grants.learner, courseId: courses.published, itemId: items.video, completedAt: null, resumeData: { position_seconds: 42.125, private: 'PRIVATE_RESUME_EXTRA' }, updatedAt: new Date('2026-10-11T03:00:00Z') },
    ] });
    await db.enrollment.update({ where: { id: grants.learner }, data: { completedItems: 999 } });
    const response = await course().expect(200); assertTaskContract('LEARN-01', 'WireLearningCourse', response.body);
    expect(response.body.progress).toEqual({ completed_items: 1, total_items: 4, completed_at: null });
    expect(response.body.resume_item_id).toBe(items.video);
    const ownVideo = (response.body as LearningCourseDto).outline.flatMap(chapter => chapter.items).find(entry => entry.id === items.video);
    expect(ownVideo!.completed_at).toBeNull(); expect(ownVideo!.resume).toEqual({ position_seconds: 42.125, updated_at: '2026-10-11T03:00:00.000Z' });
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_');
    const otherVideo = ((await course('other').expect(200)).body as LearningCourseDto).outline.flatMap(chapter => chapter.items).find(entry => entry.id === items.video);
    expect(otherVideo!.resume!.position_seconds).toBe(999); expect(otherVideo!.completed_at).not.toBeNull();
  });
  it('preserves historical completion/certificate while exposing a later added optional item without granting or completing it', async () => {
    const completedAt = new Date('2026-10-11T04:00:00Z');
    await db.enrollment.update({ where: { id: grants.learner }, data: { completedAt, completionSnapshot: { original_items: [items.article, items.video], preserved: true } } });
    const certificate = await db.certificate.create({ data: { enrollmentId: grants.learner, code: tag, recipientName: tag, courseName: tag } });
    items.added = (await db.courseItem.create({ data: { courseId: courses.published, chapterId: lateChapterId, type: 'article', position: 2, title: 'เพิ่มภายหลัง' } })).id;
    const before = await db.enrollment.findUniqueOrThrow({ where: { id: grants.learner } });
    const response = await course().expect(200); assertTaskContract('LEARN-01', 'WireLearningCourse', response.body);
    expect(response.body.progress.completed_at).toBe(completedAt.toISOString()); expect(response.body.progress.total_items).toBe(5);
    expect(response.body.certificate_id).toBe(certificate.id);
    expect((response.body as LearningCourseDto).outline.flatMap(chapter => chapter.items).find(entry => entry.id === items.added)!.completed_at).toBeNull();
    expect(await db.enrollment.findUniqueOrThrow({ where: { id: grants.learner } })).toEqual(before);
    expect(await db.progress.count({ where: { enrollmentId: grants.learner, itemId: items.added } })).toBe(0);
  });
  it('fails closed for invalid stored resume and missing quiz definition without leaking diagnostics or creating a result', async () => {
    const original = await db.progress.findUniqueOrThrow({ where: { enrollmentId_itemId: { enrollmentId: grants.learner, itemId: items.video } } });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await db.progress.update({ where: { id: original.id }, data: { resumeData: { position_seconds: -1, secret: 'PRIVATE_RESUME_INVALID' } } });
      const badResume = await course().expect(500); assertErrorContract(badResume.body); expect(JSON.stringify(badResume.body)).not.toContain('PRIVATE_');
      const missingQuiz = await item('missing_quiz').expect(500); assertErrorContract(missingQuiz.body);
      expect(JSON.stringify(missingQuiz.body)).not.toContain('definition');
    } finally { await db.progress.update({ where: { id: original.id }, data: { resumeData: original.resumeData!, updatedAt: original.updatedAt } }); log.mockRestore(); }
  });
  it('rechecks normalized authority inside the read transaction rather than accepting a stale reference', async () => {
    const reference = { tokenHash: hash(secrets.learner), audience: 'web' as const };
    await db.appSession.update({ where: { tokenHash: reference.tokenHash }, data: { revokedAt: new Date() } });
    try { await expect(app.get(LearningReadService).course(reference, courses.published)).rejects.toMatchObject({ status: 401 }); }
    finally { await db.appSession.update({ where: { tokenHash: reference.tokenHash }, data: { revokedAt: null } }); }
  });
  it('holds Course and Enrollment locks through a coherent read while coordinated authoring/progress writes wait', async () => {
    const service = app.get(LearningReadService) as unknown as { authorize(tx: Prisma.TransactionClient, reference: VerifiedSessionReference, courseId: string): Promise<string> };
    const original = service.authorize.bind(service);
    let release!: () => void, locked!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { locked = resolve; });
    const spy = jest.spyOn(service, 'authorize').mockImplementation(async (...args) => { const id = await original(...args); locked(); await gate; return id; });
    const before = (await db.course.findUniqueOrThrow({ where: { id: courses.published } })).title;
    const read = course().expect(200).then(response => response.body as LearningCourseDto);
    await ready;
    const pids: number[] = [], starts: Promise<void>[] = [], mutations: Promise<unknown>[] = [];
    for (const kind of ['course', 'progress']) {
      let started!: () => void; starts.push(new Promise<void>(resolve => { started = resolve; }));
      mutations.push(db.$transaction(async tx => {
        pids.push((await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid);
        started();
        if (kind === 'course') await tx.course.update({ where: { id: courses.published }, data: { title: 'แก้หลัง reader จบ' } });
        else {
          await tx.$queryRaw`SELECT id FROM enrollments WHERE id=${grants.learner} FOR UPDATE`;
          await tx.progress.update({ where: { enrollmentId_itemId: { enrollmentId: grants.learner, itemId: items.video } }, data: { completedAt: new Date() } });
        }
      }, { timeout: 10000 }));
    }
    await Promise.all(starts);
    try {
      for (const pid of pids) {
        let blocked = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const rows = await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`;
          if (rows[0].blocked) { blocked = true; break; }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(blocked).toBe(true);
      }
      release(); const response = await read;
      expect(response.title).toBe(before); expect(response.progress.completed_items).toBe(1);
      await Promise.all(mutations); spy.mockRestore();
      const refreshed = (await course().expect(200)).body as LearningCourseDto;
      expect(refreshed.title).toBe('แก้หลัง reader จบ'); expect(refreshed.progress.completed_items).toBe(2);
    } finally { release(); await Promise.allSettled([read, ...mutations]); spy.mockRestore(); }
  });
  it('survives reconnect and both GET operations leave all owned academic/authority/source rows unchanged', async () => {
    const snapshot = () => Promise.all([
      db.account.findMany({ where: { id: { in: Object.values(accounts) } }, orderBy: { id: 'asc' } }),
      db.appSession.findMany({ where: { accountId: { in: Object.values(accounts) } }, orderBy: { tokenHash: 'asc' } }),
      db.enrollment.findMany({ where: { courseId: { in: Object.values(courses) } }, orderBy: { id: 'asc' } }),
      db.progress.findMany({ where: { courseId: { in: Object.values(courses) } }, orderBy: { id: 'asc' } }),
      db.certificate.findMany({ where: { enrollment: { courseId: courses.published } } }),
      db.course.findMany({ where: { id: { in: Object.values(courses) } }, orderBy: { id: 'asc' } }),
      db.question.findMany({ where: { quizId }, orderBy: { id: 'asc' } }), db.videoTranscript.findMany({ where: { itemId: items.video } }),
      db.quizAttempt.findMany({ where: { courseId: courses.published } }), db.payment.findMany({ where: { courseId: courses.published } }),
    ]);
    const before = await snapshot(), previous = (await course().expect(200)).body;
    await db.$disconnect(); await db.$connect();
    expect((await course().expect(200)).body).toEqual(previous);
    await item('article').expect(200); await item('video').expect(200); await item('quiz').expect(200);
    expect(await snapshot()).toEqual(before);
    expect(Prisma.Decimal.precision).toBe(20);
  });
});
