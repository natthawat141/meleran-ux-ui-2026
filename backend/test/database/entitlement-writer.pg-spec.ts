import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EntitlementWriter, EntitlementSource } from '../../src/features/enrollments/public/entitlement-writer.service';
import { testConnections } from '../support/postgres';
import { assertTaskContract } from '../support/contract-validator';

describe('ENROLL-01 internal shared entitlement writer PostgreSQL component', () => {
  let db: PrismaClient, migrator: PrismaClient, accountId: string, instructorId: string, courseId: string;
  const writer = new EntitlementWriter(), tag = `grant_${randomUUID()}`;
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    accountId = (await db.account.create({ data: { displayName: tag } })).id;
    instructorId = (await db.account.create({ data: { displayName: tag + '_instructor' } })).id;
    courseId = (await db.course.create({ data: { slug: tag, title: tag, category: 'test', level: 'test', instructorId } })).id;
  });
  beforeEach(async () => { await db.enrollment.deleteMany({ where: { accountId, courseId } }); });
  afterAll(async () => {
    if (db) {
      if (accountId && courseId) await db.enrollment.deleteMany({ where: { accountId, courseId } });
      if (courseId) await db.course.deleteMany({ where: { id: courseId } });
      if (accountId) await db.account.deleteMany({ where: { id: { in: [accountId, instructorId].filter(Boolean) } } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  async function grant(source: EntitlementSource) {
    return db.$transaction(tx => writer.grantEntitlement(tx, accountId, courseId, source),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
  }
  it.each(['free','redeem','stripe'] as const)('stores a lifetime %s grant with canonical wire fields and reads after reconnect', async source => {
    const result = await grant(source); expect(result.created).toBe(true);
    assertTaskContract('ENROLL-01', 'EnrollmentDto', result.enrollment);
    await db.$disconnect(); await db.$connect();
    const replay = await grant(source); expect(replay.created).toBe(false);
    expect(replay.enrollment).toEqual(result.enrollment);
  });
  it('parallel competing sources create one entitlement and preserve the winning original source/time', async () => {
    const results = await Promise.all((['free','redeem','stripe','redeem','stripe','free'] as const).map(grant));
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect(new Set(results.map(result => JSON.stringify(result.enrollment))).size).toBe(1);
    expect(await db.enrollment.count({ where: { accountId, courseId } })).toBe(1);
  });
  it('returns an existing grant without overwriting source, time or academic completion state', async () => {
    const first = await grant('redeem');
    await db.enrollment.update({ where: { id: first.enrollment.id }, data: { completedItems: 2 } });
    const replay = await grant('stripe'); expect(replay.created).toBe(false);
    expect(replay.enrollment).toEqual(first.enrollment);
    expect((await db.enrollment.findUniqueOrThrow({ where: { id: replay.enrollment.id } })).completedItems).toBe(2);
  });
  it('participates in the caller transaction so a downstream failure rolls the grant back', async () => {
    await expect(db.$transaction(async tx => {
      await writer.grantEntitlement(tx, accountId, courseId, 'redeem');
      throw new Error('caller failed');
    })).rejects.toThrow('caller failed');
    expect(await db.enrollment.count({ where: { accountId, courseId } })).toBe(0);
  });
  it('stores the UTC grant timestamp even when the caller transaction timezone is Bangkok', async () => {
    await db.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Bangkok'`;
      const result = await writer.grantEntitlement(tx, accountId, courseId, 'free');
      const rows = await tx.$queryRaw<Array<{ difference: Prisma.Decimal }>>(Prisma.sql`
        SELECT abs(extract(epoch FROM ("grantedAt" - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))) AS difference
        FROM "enrollments" WHERE "id" = ${result.enrollment.id}
      `);
      expect(rows[0].difference.toNumber()).toBeLessThan(0.001);
    });
  });
  it('rejects missing FK resources and invalid source without leaving a grant', async () => {
    await expect(db.$transaction(tx => writer.grantEntitlement(tx, accountId, randomUUID(), 'free'))).rejects.toThrow();
    await expect(grant('untrusted' as EntitlementSource)).rejects.toThrow('Invalid entitlement source');
    expect(await db.enrollment.count({ where: { accountId, courseId } })).toBe(0);
  });
});
