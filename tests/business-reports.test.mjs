// Node 24 (native TypeScript stripping); no browser data or external service needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getBusinessReport, localDate, rangeError, rangeDays } from '../src/api/businessAnalytics.ts';
import { csvText } from '../src/lib/reportCsv.ts';

const courses = [{ id: 'c1', title: 'Course', price: 100 }, { id: 'c2', title: 'Other', price: 50 }];
const event = (id, name, occurredAt, actorId = 'u1', sessionId = 's1', courseId = 'c1') => ({ id, name, occurredAt, actorId, sessionId, courseId });
const source = {
  classification: 'synthetic', coverageStart: '2026-09-01', coverageEnd: '2026-10-01',
  events: [
    event('view', 'course_viewed', '2026-09-30T17:00:00Z'),
    event('checkout', 'checkout_started', '2026-09-30T17:01:00Z'),
    event('buy', 'purchase_confirmed', '2026-09-30T17:02:00Z'),
    event('learn1', 'learning_engaged', '2026-09-30T16:59:00Z'),
    event('learn2', 'learning_engaged', '2026-09-30T17:03:00Z'),
    event('learn2', 'learning_engaged', '2026-09-30T17:03:00Z'),
    event('learn3', 'learning_engaged', '2026-09-30T17:04:00Z', 'u2', 's2', 'c2'),
  ],
  payments: [
    { id: 'p-old', orderId: 'o-old', courseId: 'c1', paidAt: '2026-09-01T01:00:00Z', amountMinor: 10000, feeMinor: 200 },
    { id: 'p-new', orderId: 'o-new', courseId: 'c1', paidAt: '2026-10-01T01:00:00Z', amountMinor: 10000, feeMinor: 200 },
  ],
  refunds: [{ id: 'r-old', paymentId: 'p-old', refundedAt: '2026-10-01T03:00:00Z', amountMinor: 5000 }],
};
test('Bangkok midnight and real date boundaries', () => {
  assert.equal(localDate('2026-09-30T16:59:59Z'), '2026-09-30');
  assert.equal(localDate('2026-09-30T17:00:00Z'), '2026-10-01');
  assert.ok(rangeError({ start: '2026-02-30', end: '2026-03-01', courseId: 'all' }));
  assert.ok(rangeError({ start: '2026-10-01', end: '2026-09-01', courseId: 'all' }));
  assert.ok(rangeError({ start: '2020-01-01', end: '2026-01-01', courseId: 'all' }));
  assert.deepEqual(rangeDays({ start: '2026-09-30', end: '2026-10-01', courseId: 'all' }), ['2026-09-30', '2026-10-01']);
});
test('unique learners across days, duplicate events and course scope', () => {
  const report = getBusinessReport(source, courses, { start: '2026-09-30', end: '2026-10-01', courseId: 'all' });
  assert.equal(report.active, 2);
  assert.equal(report.daily.reduce((sum, row) => sum + row.active, 0), 3);
  assert.deepEqual(report.funnel, [1, 1, 1]);
  const scoped = getBusinessReport(source, courses, { start: '2026-10-01', end: '2026-10-01', courseId: 'c2' });
  assert.equal(scoped.active, 1); assert.equal(scoped.collected, 0); assert.equal(scoped.refunded, 0);
});
test('refund dates cross periods and signed ledger reconciles exactly', () => {
  const report = getBusinessReport(source, courses, { start: '2026-10-01', end: '2026-10-01', courseId: 'c1' });
  assert.equal(report.collected, 10000); assert.equal(report.refunded, 5000); assert.equal(report.fees, 200);
  assert.equal(report.crossPeriodRefunds, 1); assert.equal(report.net, 4800);
  assert.equal(report.ledger.reduce((sum, row) => sum + row.amountMinor, 0), report.net);
  assert.equal(report.purchaseHeatmap[3][8], 1);
  const duplicated = getBusinessReport({ ...source, payments: [...source.payments, source.payments[1]], refunds: [...source.refunds, source.refunds[0]] }, courses, { start: '2026-10-01', end: '2026-10-01', courseId: 'c1' });
  assert.equal(duplicated.net, report.net);
  const onlyRefund = getBusinessReport({ ...source, payments: [source.payments[0]] }, courses, { start: '2026-10-01', end: '2026-10-01', courseId: 'all' });
  assert.equal(onlyRefund.net, -5000);
});
test('coverage is separate from zero and rejects invalid ranges', () => {
  const report = getBusinessReport(source, courses, { start: '2026-10-02', end: '2026-10-03', courseId: 'all' });
  assert.equal(report.complete, false); assert.ok(report.daily.every(row => !row.covered));
  assert.throws(() => getBusinessReport(source, courses, { start: '', end: '2026-10-01', courseId: 'all' }));
});
test('CSV Unicode, formula neutralization, quoting and signed numeric amounts', () => {
  const csv = csvText([['ภาษาไทย', '=CMD()', ' +SUM(1)', 'quote"line\n', -5000]]);
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\'=CMD()"')); assert.ok(csv.includes('"\' +SUM(1)"'));
  assert.ok(csv.includes('"quote""line\n"')); assert.ok(csv.endsWith('"-5000"'));
});
