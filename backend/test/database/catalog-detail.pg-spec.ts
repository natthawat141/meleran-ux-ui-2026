import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { testConnections } from '../support/postgres';
import { assertTaskContract, assertErrorContract } from '../support/contract-validator';

describe('CATALOG-01 get_courses_id real HTTP/PostgreSQL component', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const tag = `catalog_${randomUUID()}`;
  let accountId: string;
  const courses: Record<string, string> = {};
  const originalUrl = process.env.DATABASE_URL;
  async function counts() {
    const tables = ['accounts','app_sessions','enrollments','progress','quiz_attempts','answers','certificates'];
    return Promise.all(tables.map(async table => {
      const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*) FROM "${table}"`);
      return Number(rows[0].count);
    }));
  }
  let initialCounts: number[];
  beforeAll(async () => {
    const connections = testConnections();
    db = connections.runtime; migrator = connections.migrator;
    accountId = (await db.account.create({ data: { displayName: tag, email: tag + '@example.invalid',
      normalizedEmail: tag.toUpperCase() + '@EXAMPLE.INVALID', profileJson: JSON.stringify({ phone: 'PRIVATE_PHONE', bio: 'PRIVATE_BIO' }) } })).id;
    for (const status of ['published','draft','approved','pending_review','corrupt']) {
      courses[status] = (await db.course.create({ data: { slug: tag + status, title: tag, category: 'test', level: 'test',
        instructorId: accountId, status: status === 'corrupt' ? 'published' : status,
        publishedAt: ['published','corrupt'].includes(status) ? new Date('2026-10-11T01:00:00Z') : null,
        outcomesJson: status === 'corrupt' ? '{"private":"INTERNAL_DATA"}' : '["ผลการเรียน"]',
        chapters: { create: [{ title: 'Second', position: 1, items: { create: { title: 'Hidden body', position: 0, contentDoc: { secret: 'PRIVATE_BODY' } } } },
          { title: 'First', position: 0, items: { create: [{ title: 'Video second', type: 'video', position: 1 },
            { title: 'Quiz first', type: 'quiz', position: 0 }] } }] } } })).id;
    }
    initialCounts = await counts();
    // Guard ran before selecting TEST connection; restore process state after teardown.
    process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (originalUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl;
    if (db) {
      if (accountId) { await db.course.deleteMany({ where: { instructorId: accountId } }); await db.account.deleteMany({ where: { id: accountId } }); }
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('serves required nullable fields and published date exactly to an anonymous guest', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/courses/' + courses.published).expect(200);
    assertTaskContract('CATALOG-01', 'CourseDetail', response.body);
    expect(response.body).toMatchObject({ id: courses.published, subtitle: null, cover_url: null, price: null,
      description: null, published_at: '2026-10-11T01:00:00.000Z', outcomes: ['ผลการเรียน'] });
  });
  it('sorts chapter/item positions and omits account/content/answer-key fields', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/courses/' + courses.published).expect(200);
    expect(response.body.outline.map((chapter: { title: string }) => chapter.title)).toEqual(['First','Second']);
    expect(response.body.outline[0].items.map((item: { title: string }) => item.title)).toEqual(['Quiz first','Video second']);
    const json = JSON.stringify(response.body);
    for (const forbidden of ['PRIVATE_PHONE','PRIVATE_BIO','PRIVATE_BODY','@example.invalid','correctKey','passwordHash','contentDoc','aiEnabled']) expect(json).not.toContain(forbidden);
    expect(Object.keys(response.body.instructor).sort()).toEqual(['avatar_url','display_name','id']);
  });
  it('returns the same non-disclosing 404 for hidden and unknown IDs', async () => {
    for (const id of [courses.draft,courses.approved,courses.pending_review,randomUUID()]) {
      const response = await request(app.getHttpServer()).get('/api/v1/courses/' + id).expect(404);
      assertErrorContract(response.body); expect(response.body.error.code).toBe('not_found');
      expect(response.body.error.message).toBe('ไม่พบคอร์ส');
    }
  });
  it('maps paid prices as THB integer minor units and reads after reconnect', async () => {
    await db.course.update({ where: { id: courses.published }, data: { priceMinor: 19900 } });
    await db.$disconnect(); await db.$connect();
    const response = await request(app.getHttpServer()).get('/api/v1/courses/' + courses.published).expect(200);
    assertTaskContract('CATALOG-01', 'CourseDetail', response.body);
    expect(response.body.price).toEqual({ amount_minor: 19900, currency: 'THB' });
  });
  it('fails closed for invalid stored outcome shape without leaking stored data', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/courses/' + courses.corrupt).expect(500);
    assertErrorContract(response.body); expect(JSON.stringify(response.body)).not.toContain('INTERNAL_DATA');
  });
  it('does not create sessions/grants/academic results during startup or reads', async () => {
    expect(await counts()).toEqual(initialCounts);
  });
});
