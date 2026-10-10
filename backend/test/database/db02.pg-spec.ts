import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { testConnections, assertMigration, assertMigrationRollback } from '../support/postgres';

describe('DB-02 academic persistence constraints on PostgreSQL', () => {
  let db: PrismaClient;
  let migrator: PrismaClient;
  let migrationUrl: string;
  const tag = `db02_${randomUUID()}`;
  let accountId: string;
  let courseId: string;
  let otherCourseId: string;
  let enrollmentId: string;
  let itemId: string;
  let otherItemId: string;
  beforeAll(async () => {
    ({ runtime: db, migrator, migrationUrl } = testConnections());
    accountId = (await db.account.create({ data: { displayName: tag } })).id;
    for (const suffix of ['', '_other']) {
      const course = await db.course.create({ data: { slug: tag + suffix, title: tag, category: 'test', level: 'test',
        instructorId: accountId, chapters: { create: { title: tag, position: 0, items: { create: { title: tag, position: 0 } } } } },
        include: { chapters: { include: { items: true } } } });
      if (!suffix) { courseId = course.id; itemId = course.chapters[0].items[0].id; }
      else { otherCourseId = course.id; otherItemId = course.chapters[0].items[0].id; }
    }
    enrollmentId = (await db.enrollment.create({ data: { accountId, courseId } })).id;
  });
  afterAll(async () => {
    if (db) {
      if (enrollmentId) {
        await db.certificate.deleteMany({ where: { enrollmentId } });
        await db.progress.deleteMany({ where: { enrollmentId } });
        await db.enrollment.deleteMany({ where: { id: enrollmentId } });
      }
      if (accountId) {
        await db.course.deleteMany({ where: { instructorId: accountId } });
        await db.userRole.deleteMany({ where: { accountId } });
        await db.account.deleteMany({ where: { id: accountId } });
      }
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('records reviewed migration and rolls back the entire chain', async () => {
    await assertMigration(migrator, '20261011010000_db02');
    await assertMigrationRollback(migrationUrl, migrator, ['20261011002000_db01', '20261011010000_db02'], 12);
  });
  it('normalizes multiple roles and rejects duplicates/unknown roles', async () => {
    await db.userRole.createMany({ data: ['learner', 'instructor'].map(role => ({ accountId, role })) });
    await expect(db.userRole.create({ data: { accountId, role: 'learner' } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(db.userRole.create({ data: { accountId, role: 'unknown' } })).rejects.toThrow();
    expect(await db.userRole.count({ where: { accountId } })).toBe(2);
  });
  it('rejects cross-course progress through both compound foreign keys', async () => {
    await expect(db.progress.create({ data: { enrollmentId, itemId: otherItemId, courseId } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(db.progress.create({ data: { enrollmentId, itemId: otherItemId, courseId: otherCourseId } })).rejects.toMatchObject({ code: 'P2003' });
  });
  it('allows one progress row under concurrent writes and retains resume JSON', async () => {
    const results = await Promise.allSettled([0, 1].map(() => db.progress.create({ data: { enrollmentId, itemId, courseId, resumeData: { seconds: 3 } } })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.progress.count({ where: { enrollmentId, itemId } })).toBe(1);
  });
  it('rejects premature certificate and rolls back failed completion plus issuance', async () => {
    await expect(db.certificate.create({ data: { code: tag, enrollmentId, recipientName: tag, courseName: tag } })).rejects.toThrow();
    await expect(db.$transaction(async tx => {
      await tx.enrollment.update({ where: { id: enrollmentId }, data: { completedAt: new Date(), completionSnapshot: { items: [itemId] } } });
      await tx.certificate.create({ data: { code: tag, enrollmentId, recipientName: tag, courseName: tag } });
      throw new Error('intentional rollback');
    })).rejects.toThrow('intentional rollback');
    expect((await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).completedAt).toBeNull();
    expect(await db.certificate.count({ where: { enrollmentId } })).toBe(0);
  });
  it('issues atomically once and prevents completion/history overwrite', async () => {
    await db.$transaction(async tx => {
      await tx.enrollment.update({ where: { id: enrollmentId }, data: { completedAt: new Date(), completionSnapshot: { items: [{ id: itemId, type: 'article', completed: true }] } } });
      await tx.certificate.create({ data: { code: tag, enrollmentId, recipientName: tag, courseName: tag } });
    });
    await expect(db.enrollment.update({ where: { id: enrollmentId }, data: { completionSnapshot: { items: [] } } })).rejects.toThrow();
    await expect(db.enrollment.update({ where: { id: enrollmentId }, data: { completedAt: null } })).rejects.toThrow();
    await expect(db.certificate.update({ where: { enrollmentId }, data: { courseName: 'overwrite' } })).rejects.toThrow();
    await expect(db.certificate.create({ data: { code: tag + '2', enrollmentId, recipientName: tag, courseName: tag } })).rejects.toMatchObject({ code: 'P2002' });
  });
  it('preserves issued names/snapshot after edits and reconnect', async () => {
    const before = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    await db.account.update({ where: { id: accountId }, data: { displayName: 'new name' } });
    await db.course.update({ where: { id: courseId }, data: { title: 'new title' } });
    await db.$disconnect(); await db.$connect();
    expect((await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).completionSnapshot).toEqual(before.completionSnapshot);
    expect(await db.certificate.findUniqueOrThrow({ where: { enrollmentId } })).toMatchObject({ recipientName: tag, courseName: tag });
  });
  it('restricts deletion of academic parents rather than cascading records', async () => {
    await expect(db.enrollment.delete({ where: { id: enrollmentId } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(db.courseItem.delete({ where: { id: itemId } })).rejects.toMatchObject({ code: 'P2003' });
    expect(await db.certificate.count({ where: { enrollmentId } })).toBe(1);
  });
});
