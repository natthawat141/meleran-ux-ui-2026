import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { testConnections, assertMigration, assertMigrationRollback } from '../support/postgres';

describe('DB-04 atomic redemption and durable payment storage', () => {
  let db: PrismaClient, migrator: PrismaClient, migrationUrl: string;
  const tag = `db04_${randomUUID()}`;
  let accounts: string[] = [], courseId: string, codeId: string, paymentId: string;
  beforeAll(async () => {
    ({ runtime: db, migrator, migrationUrl } = testConnections());
    for (let i = 0; i < 4; i++) accounts.push((await db.account.create({ data: { displayName: `${tag}_${i}` } })).id);
    courseId = (await db.course.create({ data: { slug: tag, title: tag, category: 'test', level: 'test', instructorId: accounts[0], priceMinor: 1000 } })).id;
    codeId = (await db.redeemCode.create({ data: { code: tag, courseId, issuedBy: accounts[0] } })).id;
    paymentId = (await db.payment.create({ data: { accountId: accounts[3], courseId, requestId: tag, payloadHash: 'digest', amountMinor: 1000 } })).id;
  });
  afterAll(async () => {
    if (db) {
      if (courseId) {
        await db.paymentEvent.deleteMany({ where: { payment: { courseId } } });
        await db.payment.deleteMany({ where: { courseId } });
        await db.redeemCode.deleteMany({ where: { courseId } });
        await db.enrollment.deleteMany({ where: { courseId } });
        await db.course.deleteMany({ where: { id: courseId } });
      }
      if (accounts.length) await db.account.deleteMany({ where: { id: { in: accounts } } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('checks immutable checksum and rolls back the complete 27-table chain', async () => {
    await assertMigration(migrator, '20261011040000_db04');
    await assertMigrationRollback(migrationUrl, migrator, ['20261011002000_db01', '20261011010000_db02', '20261011020000_db05', '20261011030000_db03', '20261011040000_db04'], 27);
  });
  it('rolls back redemption without leaving Used or an enrollment', async () => {
    await expect(db.$transaction(async tx => {
      const enrollment = await tx.enrollment.create({ data: { accountId: accounts[1], courseId, source: 'redeem' } });
      await tx.redeemCode.update({ where: { id: codeId }, data: { status: 'used', usedBy: accounts[1], usedAt: new Date(), enrollmentId: enrollment.id } });
      throw new Error('rollback redeem');
    })).rejects.toThrow('rollback redeem');
    expect((await db.redeemCode.findUniqueOrThrow({ where: { id: codeId } })).status).toBe('unused');
    expect(await db.enrollment.count({ where: { courseId } })).toBe(0);
  });
  it('permits only one user under simultaneous row-locked redemption', async () => {
    const redeem = (accountId: string) => db.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ status: string }>>`SELECT status FROM redeem_codes WHERE id=${codeId} FOR UPDATE`;
      if (rows[0].status !== 'unused') throw new Error('code consumed');
      const enrollment = await tx.enrollment.create({ data: { accountId, courseId, source: 'redeem' } });
      await tx.redeemCode.update({ where: { id: codeId }, data: { status: 'used', usedBy: accountId, usedAt: new Date(), enrollmentId: enrollment.id } });
      return enrollment;
    });
    const results = await Promise.allSettled([redeem(accounts[1]), redeem(accounts[2])]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.enrollment.count({ where: { courseId } })).toBe(1);
    const code = await db.redeemCode.findUniqueOrThrow({ where: { id: codeId } });
    expect(await db.enrollment.findUniqueOrThrow({ where: { id: code.enrollmentId! } })).toMatchObject({ accountId: code.usedBy, source: 'redeem' });
    await expect(db.redeemCode.update({ where: { id: codeId }, data: { status: 'revoked', revokedBy: accounts[0], revokedAt: new Date() } })).rejects.toThrow();
    await expect(db.enrollment.update({ where: { id: code.enrollmentId! }, data: { source: 'free' } })).rejects.toThrow();
  });
  it('rejects inconsistent redeem state and wrong grant owner', async () => {
    const code = await db.redeemCode.create({ data: { code: tag + '_invalid', courseId, issuedBy: accounts[0] } });
    await expect(db.redeemCode.update({ where: { id: code.id }, data: { status: 'used' } })).rejects.toThrow();
    const used = await db.redeemCode.findUniqueOrThrow({ where: { id: codeId } });
    await expect(db.redeemCode.update({ where: { id: code.id }, data: { status: 'used', enrollmentId: used.enrollmentId,
      usedBy: accounts[3], usedAt: new Date() } })).rejects.toThrow();
    expect((await db.redeemCode.findUniqueOrThrow({ where: { id: code.id } })).status).toBe('unused');
  });
  it('keeps checkout identity/price fixed and deduplicates provider events', async () => {
    await expect(db.payment.create({ data: { accountId: accounts[3], courseId, requestId: tag, payloadHash: 'digest', amountMinor: 1000 } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(db.payment.update({ where: { id: paymentId }, data: { amountMinor: 2000 } })).rejects.toThrow();
    await db.course.update({ where: { id: courseId }, data: { priceMinor: 2000 } });
    await db.payment.update({ where: { id: paymentId }, data: { checkoutSessionId: tag } });
    await expect(db.payment.update({ where: { id: paymentId }, data: { checkoutSessionId: 'replacement' } })).rejects.toThrow();
    const results = await Promise.allSettled([0, 1].map(() => db.paymentEvent.create({ data: { eventId: tag, type: 'checkout.session.completed', paymentId, eventSnapshot: { amount_minor: 1000 } } })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).amountMinor).toBe(1000);
  });
  it('retains paid money after failed grant and can retry fulfillment atomically', async () => {
    await db.payment.update({ where: { id: paymentId }, data: { status: 'succeeded', paidAt: new Date() } });
    await expect(db.$transaction(async tx => {
      const enrollment = await tx.enrollment.create({ data: { accountId: accounts[3], courseId, source: 'stripe' } });
      await tx.payment.update({ where: { id: paymentId }, data: { enrollmentId: enrollment.id, fulfillmentStatus: 'granted' } });
      throw new Error('rollback grant');
    })).rejects.toThrow('rollback grant');
    await db.payment.update({ where: { id: paymentId }, data: { fulfillmentStatus: 'failed' } });
    expect(await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).toMatchObject({ status: 'succeeded', fulfillmentStatus: 'failed', enrollmentId: null });
    expect(await db.enrollment.count({ where: { accountId: accounts[3], courseId } })).toBe(0);
    await db.$transaction(async tx => {
      const enrollment = await tx.enrollment.create({ data: { accountId: accounts[3], courseId, source: 'stripe' } });
      await tx.payment.update({ where: { id: paymentId }, data: { enrollmentId: enrollment.id, fulfillmentStatus: 'granted' } });
    });
    await expect(db.payment.update({ where: { id: paymentId }, data: { status: 'pending', paidAt: null } })).rejects.toThrow();
    await db.$disconnect(); await db.$connect();
    expect(await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).toMatchObject({ status: 'succeeded', fulfillmentStatus: 'granted' });
    expect(await db.enrollment.count({ where: { accountId: accounts[3], courseId } })).toBe(1);
  });
  it('rejects invalid payment money and premature fulfillment', async () => {
    for (const data of [{ amountMinor: 0 }, { amountMinor: -1 }, { currency: 'USD' }, { fulfillmentStatus: 'granted' }]) {
      await expect(db.payment.create({ data: { accountId: accounts[1], courseId, requestId: randomUUID(), payloadHash: 'test', amountMinor: 1000, ...data } })).rejects.toThrow();
    }
  });
});
