import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { testConnections, assertMigration, assertMigrationRollback } from '../support/postgres';

describe('DB-05 Blog/AI constraints on PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, migrationUrl: string;
  const tag = `db05_${randomUUID()}`;
  const day = new Date('2026-10-11T00:00:00Z');
  const nextDay = new Date('2026-10-12T00:00:00Z');
  let accountId: string, strangerId: string, courseId: string, videoId: string, articleId: string, conversationId: string;
  beforeAll(async () => {
    ({ runtime: db, migrator, migrationUrl } = testConnections());
    accountId = (await db.account.create({ data: { displayName: tag } })).id;
    strangerId = (await db.account.create({ data: { displayName: tag + '_stranger' } })).id;
    const course = await db.course.create({ data: { slug: tag, title: tag, category: 'test', level: 'test', instructorId: accountId,
      chapters: { create: { title: tag, position: 0, items: { create: [
        { title: 'video', type: 'video', position: 0 }, { title: 'article', position: 1 },
      ] } } } }, include: { chapters: { include: { items: true } } } });
    courseId = course.id;
    videoId = course.chapters[0].items.find(item => item.type === 'video')!.id;
    articleId = course.chapters[0].items.find(item => item.type === 'article')!.id;
    conversationId = (await db.aIConversation.create({ data: { accountId, courseId, contextSnapshot: { course_id: courseId } } })).id;
    await db.aIUsageDaily.createMany({ data: [{ accountId, usageDate: day, successCount: 18 }, { accountId, usageDate: nextDay }] });
  });
  afterAll(async () => {
    if (db) {
      if (accountId) {
        await db.aIRequest.deleteMany({ where: { accountId } });
        await db.aIPractice.deleteMany({ where: { accountId } });
        await db.aIMessage.deleteMany({ where: { accountId } });
        await db.aIConversation.deleteMany({ where: { accountId } });
        await db.aIUsageDaily.deleteMany({ where: { accountId } });
        await db.videoTranscript.deleteMany({ where: { editedBy: accountId } });
        await db.blogPost.deleteMany({ where: { authorId: accountId } });
        await db.course.deleteMany({ where: { instructorId: accountId } });
        await db.account.deleteMany({ where: { id: { in: [accountId, strangerId].filter(Boolean) } } });
      }
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('records reviewed checksum and rolls back all 19 tables', async () => {
    await assertMigration(migrator, '20261011020000_db05');
    await assertMigrationRollback(migrationUrl, migrator, ['20261011002000_db01', '20261011010000_db02', '20261011020000_db05'], 19);
  });
  it('enforces blog slug uniqueness/status independently of course content', async () => {
    const data = { slug: tag, title: tag, contentDoc: { type: 'doc', content: [] }, authorId: accountId };
    await db.blogPost.create({ data });
    await expect(db.blogPost.create({ data })).rejects.toMatchObject({ code: 'P2002' });
    await expect(db.blogPost.update({ where: { slug: tag }, data: { status: 'private' } })).rejects.toThrow();
    expect(await db.courseItem.count({ where: { courseId } })).toBe(2);
  });
  it('allows one transcript only for a video without changing learning revision', async () => {
    const before = await db.course.findUniqueOrThrow({ where: { id: courseId } });
    await db.videoTranscript.create({ data: { itemId: videoId, editedBy: accountId, text: 'knowledge' } });
    await expect(db.videoTranscript.create({ data: { itemId: videoId, editedBy: accountId, text: 'duplicate' } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(db.videoTranscript.create({ data: { itemId: articleId, editedBy: accountId, text: 'invalid' } })).rejects.toMatchObject({ code: 'P2003' });
    expect((await db.course.findUniqueOrThrow({ where: { id: courseId } })).revision).toBe(before.revision);
  });
  it('enforces message/practice ownership and stable order', async () => {
    await db.aIMessage.create({ data: { accountId, conversationId, position: 0, role: 'user', content: tag, contextSnapshot: { item_id: videoId } } });
    await expect(db.aIMessage.create({ data: { accountId: strangerId, conversationId, position: 1, role: 'user', content: tag, contextSnapshot: {} } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(db.aIMessage.create({ data: { accountId, conversationId, position: 0, role: 'assistant', content: tag, contextSnapshot: {} } })).rejects.toMatchObject({ code: 'P2002' });
    const practice = await db.aIPractice.create({ data: { accountId, conversationId, payloadSnapshot: { questions: [{ id: 'q1' }] } } });
    await expect(db.aIPractice.update({ where: { id: practice.id }, data: { payloadSnapshot: {} } })).rejects.toThrow();
    await db.aIPractice.update({ where: { id: practice.id }, data: { answers: { q1: 'a1' } } });
    expect(await db.progress.count({ where: { courseId } })).toBe(0);
    expect(await db.enrollment.count({ where: { accountId, courseId } })).toBe(0);
  });
  it('bounds concurrent pending reservations without exceeding shared 20', async () => {
    const results = await Promise.allSettled([0, 1, 2].map(() => db.aIUsageDaily.update({ where: { accountId_usageDate: { accountId, usageDate: day } }, data: { pendingCount: { increment: 1 } } })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
    expect(await db.aIUsageDaily.findUniqueOrThrow({ where: { accountId_usageDate: { accountId, usageDate: day } } })).toMatchObject({ successCount: 18, pendingCount: 2 });
    await expect(db.aIUsageDaily.update({ where: { accountId_usageDate: { accountId, usageDate: day } }, data: { successCount: -1 } })).rejects.toThrow();
  });
  it('keeps idempotency/original quota day through midnight and atomic finalization', async () => {
    const data = { accountId, requestId: tag, payloadHash: 'digest', usageDate: day, conversationId };
    const request = await db.aIRequest.create({ data });
    await expect(db.aIRequest.create({ data: { ...data, usageDate: nextDay } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(db.aIRequest.update({ where: { id: request.id }, data: { usageDate: nextDay } })).rejects.toThrow();
    await expect(db.$transaction(async tx => {
      await tx.aIUsageDaily.update({ where: { accountId_usageDate: { accountId, usageDate: day } }, data: { pendingCount: { decrement: 1 }, successCount: { increment: 1 } } });
      await tx.aIRequest.update({ where: { id: request.id }, data: { status: 'succeeded', result: { answer: tag }, finalizedAt: new Date() } });
      throw new Error('rollback AI finalize');
    })).rejects.toThrow('rollback AI finalize');
    expect((await db.aIRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('pending');
    await db.$transaction(async tx => {
      await tx.aIUsageDaily.update({ where: { accountId_usageDate: { accountId, usageDate: day } }, data: { pendingCount: { decrement: 1 }, successCount: { increment: 1 } } });
      await tx.aIRequest.update({ where: { id: request.id }, data: { status: 'succeeded', result: { answer: tag }, finalizedAt: new Date() } });
    });
    await expect(db.aIRequest.update({ where: { id: request.id }, data: { result: {} } })).rejects.toThrow();
    expect((await db.aIUsageDaily.findUniqueOrThrow({ where: { accountId_usageDate: { accountId, usageDate: nextDay } } })).successCount).toBe(0);
  });
  it('retains quota/result after hiding conversation and deleting messages; reconnect reads back', async () => {
    await db.aIConversation.update({ where: { id: conversationId }, data: { deletedAt: new Date() } });
    await db.aIMessage.deleteMany({ where: { conversationId } });
    await db.$disconnect(); await db.$connect();
    expect((await db.aIUsageDaily.findUniqueOrThrow({ where: { accountId_usageDate: { accountId, usageDate: day } } })).successCount).toBe(19);
    expect(await db.aIRequest.findUniqueOrThrow({ where: { accountId_requestId: { accountId, requestId: tag } } })).toMatchObject({ result: { answer: tag } });
  });
});
