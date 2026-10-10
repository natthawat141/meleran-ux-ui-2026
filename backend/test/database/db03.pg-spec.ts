import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { testConnections, assertMigration, assertMigrationRollback } from '../support/postgres';

describe('DB-03 immutable assessment storage', () => {
  let db: PrismaClient, migrator: PrismaClient, migrationUrl: string;
  const tag = `db03_${randomUUID()}`;
  let accountId: string, courseId: string, itemId: string, enrollmentId: string, quizId: string, questionId: string, attemptId: string;
  beforeAll(async () => {
    ({ runtime: db, migrator, migrationUrl } = testConnections());
    accountId = (await db.account.create({ data: { displayName: tag } })).id;
    const course = await db.course.create({ data: { slug: tag, title: tag, category: 'test', level: 'test', instructorId: accountId,
      chapters: { create: { title: tag, position: 0, items: { create: { title: tag, type: 'quiz', position: 0 } } } } }, include: { chapters: { include: { items: true } } } });
    courseId = course.id; itemId = course.chapters[0].items[0].id;
    enrollmentId = (await db.enrollment.create({ data: { accountId, courseId } })).id;
    quizId = (await db.quiz.create({ data: { courseId, itemId, title: tag } })).id;
    questionId = (await db.question.create({ data: { quizId, position: 0, type: 'essay', prompt: { text: tag }, options: [], correctKey: {}, maxScore: 10 } })).id;
    attemptId = (await db.quizAttempt.create({ data: { enrollmentId, quizId, courseId, number: 1, maxScore: 10,
      definitionSnapshot: { title: tag }, snapshotQuestions: { create: { questionId, position: 0, type: 'essay', maxScore: 10,
        payloadSnapshot: { prompt: tag, correct_key: {}, max_score: 10 } } } } })).id;
  });
  afterAll(async () => {
    if (db) {
      if (attemptId) {
        await db.answer.deleteMany({ where: { attemptId } });
        await db.attemptQuestion.deleteMany({ where: { attemptId } });
        await db.quizAttempt.deleteMany({ where: { id: attemptId } });
      }
      if (quizId) { await db.question.deleteMany({ where: { quizId } }); await db.quiz.deleteMany({ where: { id: quizId } }); }
      if (enrollmentId) await db.enrollment.deleteMany({ where: { id: enrollmentId } });
      if (courseId) await db.course.deleteMany({ where: { id: courseId } });
      if (accountId) await db.account.deleteMany({ where: { id: accountId } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('checks checksum and rolls back complete 24-table chain', async () => {
    await assertMigration(migrator, '20261011030000_db03');
    await assertMigrationRollback(migrationUrl, migrator, ['20261011002000_db01', '20261011010000_db02', '20261011020000_db05', '20261011030000_db03'], 24);
  });
  it('rejects a quiz attached to a wrong course or content kind', async () => {
    const chapter = await db.courseChapter.findFirstOrThrow({ where: { courseId } });
    const article = await db.courseItem.create({ data: { chapterId: chapter.id, courseId, title: tag, position: 1 } });
    await expect(db.quiz.create({ data: { itemId: article.id, courseId, title: tag } })).rejects.toMatchObject({ code: 'P2003' });
    const quizItem = await db.courseItem.create({ data: { chapterId: chapter.id, courseId, type: 'quiz', title: tag, position: 2 } });
    await expect(db.quiz.create({ data: { itemId: quizItem.id, courseId: randomUUID(), title: tag } })).rejects.toMatchObject({ code: 'P2003' });
  });
  it('keeps question/answer-key/max snapshots after live authoring edit/deletion', async () => {
    await db.question.update({ where: { id: questionId }, data: { prompt: { text: 'changed' }, maxScore: 100 } });
    await db.question.delete({ where: { id: questionId } });
    await db.$disconnect(); await db.$connect();
    expect((await db.attemptQuestion.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId, questionId } } })).maxScore.toNumber()).toBe(10);
    await expect(db.attemptQuestion.update({ where: { attemptId_questionId: { attemptId, questionId } }, data: { payloadSnapshot: {} } })).rejects.toThrow();
    await expect(db.quizAttempt.update({ where: { id: attemptId }, data: { maxScore: 100 } })).rejects.toThrow();
  });
  it('requires an answer to reference its own snapshot question', async () => {
    await expect(db.answer.create({ data: { attemptId, questionId: randomUUID(), response: {} } })).rejects.toMatchObject({ code: 'P2003' });
    await db.answer.create({ data: { attemptId, questionId, response: { text: 'answer' } } });
    await expect(db.answer.create({ data: { attemptId, questionId } })).rejects.toMatchObject({ code: 'P2002' });
  });
  it('bounds grades by immutable snapshot maximum and rolls back grading', async () => {
    await expect(db.answer.update({ where: { attemptId_questionId: { attemptId, questionId } }, data: { score: 11 } })).rejects.toThrow();
    await expect(db.answer.update({ where: { attemptId_questionId: { attemptId, questionId } }, data: { score: -1 } })).rejects.toThrow();
    await expect(db.$transaction(async tx => {
      await tx.answer.update({ where: { attemptId_questionId: { attemptId, questionId } }, data: { score: 8 } });
      throw new Error('rollback grade');
    })).rejects.toThrow('rollback grade');
    expect((await db.answer.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId, questionId } } })).score).toBeNull();
  });
  it('rejects pending pass and applies strict greater-than-70 boundary', async () => {
    await expect(db.quizAttempt.update({ where: { id: attemptId }, data: { status: 'pending_review', passed: true } })).rejects.toThrow();
    await expect(db.quizAttempt.update({ where: { id: attemptId }, data: { status: 'graded', gradedAt: new Date(), earnedScore: 7, passed: true } })).rejects.toThrow();
    await db.quizAttempt.update({ where: { id: attemptId }, data: { status: 'graded', gradedAt: new Date(), earnedScore: 7, passed: false } });
    await db.quizAttempt.update({ where: { id: attemptId }, data: { earnedScore: '7.0001', passed: true } });
    expect((await db.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } })).passed).toBe(true);
    expect(await db.progress.count({ where: { enrollmentId } })).toBe(0);
  });
  it('preserves academic records through parent-delete restrictions', async () => {
    await expect(db.enrollment.delete({ where: { id: enrollmentId } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(db.quiz.delete({ where: { id: quizId } })).rejects.toMatchObject({ code: 'P2003' });
    expect(await db.answer.count({ where: { attemptId } })).toBe(1);
  });
});
