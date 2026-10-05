import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cashCodeShareAmounts, commitCashCodeRedemption, markAccessCodeRedeemed, quoteAccessCode } from '../src/lib/access-code-utils.ts';
import type { AccessCode } from '../src/types/index.ts';

const cashCode = {
  id: 'code-1', code: 'COURSE-1', courseId: 'course-1', kind: 'cash' as const,
  receivedAmount: 750, maxUses: 1, usedCount: 0, status: 'active' as const,
  createdAt: '2026-10-05T00:00:00.000Z', createdBy: 'admin',
};

test('unassigned course code quotes at configured sale price and only binds on redemption', () => {
  const quote = quoteAccessCode({ accessCodes: [cashCode], courseId: 'course-1', coursePrice: 1000, userId: 'learner-1', enrollments: [], code: 'course-1' });
  assert.equal(quote.ok, true);
  if (!quote.ok) return;
  assert.equal(quote.source, 'cash_code');
  assert.equal(quote.amount, 750);
  assert.equal('userId' in cashCode, false);
  const redeemed = markAccessCodeRedeemed(cashCode, 'learner-1', '2026-10-05T01:00:00.000Z');
  assert.equal(redeemed?.userId, 'learner-1');
  assert.equal(redeemed?.usedCount, 1);
  assert.equal(redeemed?.lastUsedAt, '2026-10-05T01:00:00.000Z');
});

test('legacy assigned course codes remain account restricted and redemption is single-use', () => {
  const legacy = { ...cashCode, userId: 'learner-1' };
  const wrongUser = quoteAccessCode({ accessCodes: [legacy], courseId: 'course-1', coursePrice: 1000, userId: 'learner-2', enrollments: [], code: legacy.code });
  assert.equal(wrongUser.ok, false);
  const redeemed = markAccessCodeRedeemed(legacy, 'learner-1', '2026-10-05T01:00:00.000Z');
  assert.equal(redeemed?.userId, 'learner-1');
  assert.ok(redeemed);
  assert.equal(markAccessCodeRedeemed(redeemed, 'learner-1', '2026-10-05T01:01:00.000Z'), null);
  const alreadyUsed = quoteAccessCode({ accessCodes: [{ ...legacy, usedCount: 1 }], courseId: 'course-1', coursePrice: 1000, userId: 'learner-1', enrollments: [], code: legacy.code });
  assert.equal(alreadyUsed.ok, false);
});

test('cash sale amount produces the expected instructor/platform split', () => {
  const shares = cashCodeShareAmounts(750, 70);
  assert.deepEqual(shares, { instructorShareAmount: 525, platformShareAmount: 225 });
  assert.equal(shares.instructorShareAmount + shares.platformShareAmount, 750);
});

test('quote rejects expired, disabled, wrong-course, logged-out and invalid-price redemption codes', () => {
  const quote = (overrides: Partial<AccessCode> = {}, userId = 'learner-1', courseId = 'course-1') => quoteAccessCode({ accessCodes: [{ ...cashCode, ...overrides }], courseId, coursePrice: 1000, userId, enrollments: [], code: cashCode.code });
  assert.equal(quote({ expiresAt: '2020-01-01T00:00:00.000Z' }).ok, false);
  assert.equal(quote({ status: 'inactive' }).ok, false);
  assert.equal(quote({}, 'learner-1', 'course-2').ok, false);
  assert.equal(quote({}, '').ok, false);
  assert.equal(quote({ receivedAmount: Number.NaN }).ok, false);
});

test('cash redemption atomically binds the code, adds one paid order and enrolls the redeemer', () => {
  const shares = cashCodeShareAmounts(750, 70);
  const order = { id: 'order-1', courseId: 'course-1', userId: 'learner-1', amount: 750, listPrice: 1000, discountAmount: 250, status: 'paid' as const, method: 'เงินสดผ่านโค้ด', source: 'cash_code' as const, accessCodeId: cashCode.id, createdAt: '2026-10-05T01:00:00.000Z', instructorSharePercent: 70, ...shares };
  const transition = commitCashCodeRedemption({ accessCodes: [cashCode], orders: [], enrollments: [], accessCodeId: cashCode.id, userId: 'learner-1', order, redeemedAt: order.createdAt });
  assert.ok(transition);
  assert.equal(transition.accessCodes[0].userId, 'learner-1');
  assert.equal(transition.accessCodes[0].usedCount, 1);
  assert.equal(transition.orders.length, 1);
  assert.equal(transition.orders[0].amount, 750);
  assert.equal(transition.orders[0].instructorShareAmount, 525);
  assert.equal(transition.orders[0].platformShareAmount, 225);
  assert.deepEqual(transition.enrollments.map(({ courseId, userId }) => ({ courseId, userId })), [{ courseId: 'course-1', userId: 'learner-1' }]);
  assert.equal(commitCashCodeRedemption({ accessCodes: transition.accessCodes, orders: transition.orders, enrollments: transition.enrollments, accessCodeId: cashCode.id, userId: 'learner-1', order: { ...order, id: 'order-2' }, redeemedAt: order.createdAt }), null);
});
