import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { ResumeWriter } from '../../src/features/enrollments/public/resume-writer.service';
import { testConnections } from '../support/postgres';
import { assertTaskContract, assertErrorContract } from '../support/contract-validator';

describe('LEARN-02 internal Resume persistence / Test PostgreSQL / read integration', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const tag = 'resume_writer_' + randomUUID(), secret = randomUUID(), previousUrl = process.env.DATABASE_URL;
  const accounts: string[] = [], courses: string[] = [], items: string[] = [];
  const writer = new ResumeWriter();
  let enrollmentId: string;
  const courseRead = () => request(app.getHttpServer()).get('/api/v1/learn/courses/' + courses[0])
    .set('x-melearn-app', 'web').set('Cookie', `melearn_web_session=${secret}`);
  const save = (itemId: string, position: number | null) => db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM courses WHERE id=${courses[0]} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM enrollments WHERE id=${enrollmentId} FOR UPDATE`;
    return writer.save(tx, enrollmentId, itemId, courses[0], position);
  });
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const role of ['learner', 'instructor']) accounts.push((await db.account.create({ data: {
      displayName: tag + role, roles: role, roleGrants: { create: { role } } } })).id);
    await db.appSession.create({ data: { accountId: accounts[0], audience: 'web',
      tokenHash: createHash('sha256').update(secret).digest('hex').toUpperCase(), expiresAt: new Date(Date.now() + 3600000) } });
    for (let index = 0; index < 2; index++) {
      const course = await db.course.create({ data: { slug: tag + index, title: tag, category: 'test', level: 'test',
        instructorId: accounts[1], status: 'published', publishedAt: new Date(),
        chapters: { create: { title: tag, position: 0, items: { create: [
          { title: 'Video', type: 'video', position: 0 }, { title: 'Article', type: 'article', position: 1 },
        ] } } } }, include: { chapters: { include: { items: { orderBy: { position: 'asc' } } } } } });
      courses.push(course.id); items.push(...course.chapters[0].items.map(item => item.id));
    }
    enrollmentId = (await db.enrollment.create({ data: { accountId: accounts[0], courseId: courses[0], completedItems: 1,
      completedAt: new Date('2026-10-10T01:00:00Z'), completionSnapshot: { preserved: true } } })).id;
    await db.certificate.create({ data: { enrollmentId, code: tag, recipientName: tag, courseName: tag } });
    await db.progress.create({ data: { enrollmentId, courseId: courses[0], itemId: items[0], completedAt: new Date('2026-10-10T00:00:00Z') } });
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (db) {
      if (enrollmentId) {
        await db.certificate.deleteMany({ where: { enrollmentId } }); await db.progress.deleteMany({ where: { enrollmentId } });
        await db.enrollment.deleteMany({ where: { id: enrollmentId } });
      }
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await db.appSession.deleteMany({ where: { accountId: { in: accounts } } });
      await db.userRole.deleteMany({ where: { accountId: { in: accounts } } }); await db.account.deleteMany({ where: { id: { in: accounts } } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('persists exact explicit position and UTC timestamp with canonical response/reconnect without changing completion history', async () => {
    const enrollment = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    const certificate = await db.certificate.findUniqueOrThrow({ where: { enrollmentId } });
    const completed = (await db.progress.findUniqueOrThrow({ where: { enrollmentId_itemId: { enrollmentId, itemId: items[0] } } })).completedAt;
    const result = await save(items[0], 12.345); assertTaskContract('LEARN-02', 'ResumeResponse', result);
    expect(result.resume.position_seconds).toBe(12.345); expect(new Date(result.resume.updated_at).toISOString()).toBe(result.resume.updated_at);
    await db.$disconnect(); await db.$connect();
    const stored = await db.progress.findUniqueOrThrow({ where: { enrollmentId_itemId: { enrollmentId, itemId: items[0] } } });
    expect(stored.resumeData).toMatchObject(result.resume); expect(stored.updatedAt.toISOString()).toBe(result.resume.updated_at);
    expect(stored.completedAt).toEqual(completed); expect(await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toEqual(enrollment);
    expect(await db.certificate.findUniqueOrThrow({ where: { enrollmentId } })).toEqual(certificate);
  });
  it('upserts explicit null/zero while keeping one row and never completes a newly resumed Article', async () => {
    for (const position of [null, 0, 42, null]) {
      const result = await save(items[1], position); assertTaskContract('LEARN-02', 'ResumeResponse', result);
      expect(result.resume.position_seconds).toBe(position);
    }
    const rows = await db.progress.findMany({ where: { enrollmentId, itemId: items[1] } });
    expect(rows).toHaveLength(1); expect(rows[0].completedAt).toBeNull();
  });
  it('participates in caller rollback and same-course FKs reject a foreign item without changing the existing resume', async () => {
    const before = await db.progress.findMany({ where: { enrollmentId }, orderBy: { itemId: 'asc' } });
    await expect(db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM enrollments WHERE id=${enrollmentId} FOR UPDATE`;
      await writer.save(tx, enrollmentId, items[0], courses[0], 999); throw new Error('caller failed');
    })).rejects.toThrow('caller failed');
    await expect(save(items[2], 1)).rejects.toMatchObject({ code: 'P2010' });
    expect(await db.progress.findMany({ where: { enrollmentId }, orderBy: { itemId: 'asc' } })).toEqual(before);
  });
  it('rejects invalid trusted values before SQL and does not infer omitted-position behavior', async () => {
    const before = await db.progress.findMany({ where: { enrollmentId }, orderBy: { itemId: 'asc' } });
    for (const invalid of [-1, NaN, Infinity, undefined, '12']) {
      await expect(save(items[0], invalid as number)).rejects.toThrow('Invalid trusted resume position');
    }
    expect(await db.progress.findMany({ where: { enrollmentId }, orderBy: { itemId: 'asc' } })).toEqual(before);
  });
  it('uses actual write time and UTC formatting under Bangkok transaction timezone', async () => {
    await db.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Bangkok'`;
      await tx.$queryRaw`SELECT id FROM enrollments WHERE id=${enrollmentId} FOR UPDATE`;
      const before = (await tx.$queryRaw<Array<{ at: Date }>>`SELECT clock_timestamp() AS at`)[0].at;
      const result = await writer.save(tx, enrollmentId, items[0], courses[0], 2);
      const after = (await tx.$queryRaw<Array<{ at: Date }>>`SELECT clock_timestamp() AS at`)[0].at;
      const saved = Date.parse(result.resume.updated_at);
      expect(saved).toBeGreaterThanOrEqual(before.getTime()); expect(saved).toBeLessThanOrEqual(after.getTime());
      expect(result.resume.updated_at.endsWith('Z')).toBe(true);
    });
  });
  it('concurrent coordinated saves leave one consistent row and preserve completedAt', async () => {
    const before = (await db.progress.findUniqueOrThrow({ where: { enrollmentId_itemId: { enrollmentId, itemId: items[0] } } })).completedAt;
    const results = await Promise.all([5, 6, 7, 8].map(position => save(items[0], position)));
    const stored = await db.progress.findUniqueOrThrow({ where: { enrollmentId_itemId: { enrollmentId, itemId: items[0] } } });
    expect(results.some(result => result.resume.position_seconds === (stored.resumeData as Record<string, Prisma.JsonValue>).position_seconds && result.resume.updated_at === (stored.resumeData as Record<string, Prisma.JsonValue>).updated_at)).toBe(true);
    const ordinal=(stored.resumeData as Record<string, Prisma.JsonValue>)._resume_order; expect(typeof ordinal).toBe('string');
    expect(stored.completedAt).toEqual(before); expect(await db.progress.count({ where: { enrollmentId, itemId: items[0] } })).toBe(1);
  });
  it('read integration uses saved resume timestamp rather than a later completion update for the latest item', async () => {
    const first = await save(items[0], 12), last = await save(items[1], null);
    const commonAt = '2026-10-11T03:00:00.000Z';
    for (const id of items.slice(0,2)) {
      const current=await db.progress.findUniqueOrThrow({where:{enrollmentId_itemId:{enrollmentId,itemId:id}}});
      await db.progress.update({where:{id:current.id},data:{resumeData:{...(current.resumeData as Prisma.JsonObject),updated_at:commonAt}}});
    }
    await db.progress.update({ where: { enrollmentId_itemId: { enrollmentId, itemId: items[0] } }, data: { updatedAt: new Date('2099-01-01T00:00:00Z') } });
    const response = await courseRead().expect(200); assertTaskContract('LEARN-01', 'WireLearningCourse', response.body);
    expect(response.body.resume_item_id).toBe(items[1]); expect(JSON.stringify(response.body)).not.toContain('_resume_order');
    expect(response.body.outline[0].items[0].resume).toEqual({ ...first.resume, updated_at: commonAt });
    expect(response.body.outline[0].items[1].resume).toEqual({ ...last.resume, updated_at: commonAt });
    expect(response.body.progress.completed_at).toBe('2026-10-10T01:00:00.000Z');
  });
  it('fails closed for corrupt saved timestamp and explicit valid save repairs only the resume record', async () => {
    const before = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    await db.progress.update({ where: { enrollmentId_itemId: { enrollmentId, itemId: items[1] } }, data: { resumeData: { position_seconds: 0, updated_at: 'PRIVATE_BAD_TIMESTAMP' } } });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const denied = await courseRead().expect(500); assertErrorContract(denied.body);
      expect(JSON.stringify(denied.body)).not.toContain('PRIVATE_BAD_TIMESTAMP');
      await save(items[1], 0); await courseRead().expect(200);
    } finally { log.mockRestore(); }
    expect(await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toEqual(before);
  });
});
