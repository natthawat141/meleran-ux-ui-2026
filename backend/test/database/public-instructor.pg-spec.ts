import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { testConnections } from '../support/postgres';
import { assertTaskContract, assertErrorContract } from '../support/contract-validator';

describe('CATALOG-02 get_instructors_id actual HTTP/PostgreSQL component', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const tag = `instructor_${randomUUID()}`;
  const ids: Record<string, string> = {};
  const originalUrl = process.env.DATABASE_URL;
  let before: number[];
  async function counts() {
    return Promise.all(['appSession','enrollment','progress','quizAttempt','certificate'].map(async model =>
      Number((await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*) FROM "${({ appSession: 'app_sessions', enrollment: 'enrollments', progress: 'progress', quizAttempt: 'quiz_attempts', certificate: 'certificates' } as Record<string,string>)[model]}"`))[0].count)));
  }
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    for (const role of ['instructor','learner','admin','compatOnly','corrupt']) {
      ids[role] = (await db.account.create({ data: { displayName: tag + role,
        email: `${tag}_${role}@example.invalid`, roles: role === 'compatOnly' ? 'instructor' : 'learner',
        profileJson: role === 'corrupt' ? '{"bio":{"secret":"PRIVATE_BAD"}}' :
          JSON.stringify({ bio: 'ข้อมูลสาธารณะ', phone: 'PRIVATE_PHONE', bank: 'PRIVATE_BANK' }),
        roleGrants: role === 'compatOnly' ? undefined : { create: { role: role === 'corrupt' ? 'instructor' : role } },
      } })).id;
    }
    before = await counts(); process.env.DATABASE_URL = connections.runtimeUrl;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (originalUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl;
    if (db) {
      await db.userRole.deleteMany({ where: { accountId: { in: Object.values(ids) } } });
      await db.account.deleteMany({ where: { id: { in: Object.values(ids) } } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('returns only the canonical public profile to an anonymous guest, without requiring courses', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/instructors/' + ids.instructor).expect(200);
    assertTaskContract('CATALOG-02', 'PublicInstructorDto', response.body);
    expect(response.body).toEqual({ id: ids.instructor, display_name: tag + 'instructor', avatar_url: null, bio: 'ข้อมูลสาธารณะ' });
    for (const forbidden of ['PRIVATE_PHONE','PRIVATE_BANK','@example.invalid','profileJson','roles','passwordHash'])
      expect(JSON.stringify(response.body)).not.toContain(forbidden);
  });
  it('returns a non-disclosing canonical 404 for missing IDs and users without an Instructor grant', async () => {
    for (const id of [ids.learner,ids.admin,ids.compatOnly,randomUUID()]) {
      const response = await request(app.getHttpServer()).get('/api/v1/instructors/' + id).expect(404);
      assertErrorContract(response.body); expect(response.body.error.code).toBe('not_found');
      expect(response.body.error.message).toBe('ไม่พบผู้สอน');
    }
  });
  it('reads nullable bio and avatar after reconnect and observes saved profile edits', async () => {
    await db.account.update({ where: { id: ids.instructor }, data: { profileJson: '{}', avatarUrl: 'https://example.invalid/avatar.png' } });
    await db.$disconnect(); await db.$connect();
    const response = await request(app.getHttpServer()).get('/api/v1/instructors/' + ids.instructor).expect(200);
    assertTaskContract('CATALOG-02', 'PublicInstructorDto', response.body);
    expect(response.body.bio).toBeNull(); expect(response.body.avatar_url).toBe('https://example.invalid/avatar.png');
  });
  it('fails closed for malformed stored bio, without disclosing private data', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/instructors/' + ids.corrupt).expect(500);
    assertErrorContract(response.body); expect(JSON.stringify(response.body)).not.toContain('PRIVATE_BAD');
  });
  it('reflects grant removal and does not fall back to the prototype roles field', async () => {
    await db.userRole.delete({ where: { accountId_role: { accountId: ids.instructor, role: 'instructor' } } });
    const response = await request(app.getHttpServer()).get('/api/v1/instructors/' + ids.instructor).expect(404);
    assertErrorContract(response.body);
  });
  it('does not create sessions, enrollments, academic records or certificates', async () => {
    expect(await counts()).toEqual(before);
  });
});
