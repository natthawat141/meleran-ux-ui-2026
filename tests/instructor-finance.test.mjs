import test from 'node:test';
import assert from 'node:assert/strict';
import { instructorForOrder, instructorShareForOrder, isReferralOrder } from '../src/pages/finance/finance-utils.ts';

const data = {
  courses: [{ id: 'c1', instructorId: 'teacher' }],
  users: [{ id: 'teacher', baseSharePercent: 65, referralSharePercent: 80 }],
};
const order = { id: 'o1', courseId: 'c1', userId: 'student', amount: 490, status: 'paid' };

test('direct and referred purchases use their respective instructor rates', () => {
  assert.equal(instructorForOrder(data, order)?.id, 'teacher');
  assert.equal(instructorShareForOrder(data, order), 318.5);
  assert.equal(instructorShareForOrder(data, { ...order, referralCode: 'CODE' }), 392);
  assert.equal(instructorShareForOrder(data, { ...order, referralLinkId: 'link' }), 392);
  assert.equal(isReferralOrder(order), false);
});

test('recorded commission amounts preserve historical earnings after a rate change', () => {
  const changed = { ...data, users: [{ id: 'teacher', baseSharePercent: 10, referralSharePercent: 20 }] };
  assert.equal(instructorShareForOrder(changed, { ...order, instructorShareAmount: 318.5 }), 318.5);
  assert.equal(instructorShareForOrder(changed, { ...order, instructorShareAmount: 0 }), 0);
  assert.equal(instructorShareForOrder(changed, { ...order, instructorSharePercent: 65 }), 318.5);
});

test('unpaid orders and missing instructors do not contribute earnings', () => {
  assert.equal(instructorShareForOrder(data, { ...order, status: 'failed', instructorShareAmount: 318.5 }), 0);
  assert.equal(instructorShareForOrder(data, { ...order, status: 'pending' }), 0);
  assert.equal(instructorShareForOrder({ ...data, users: [] }, order), 0);
  assert.equal(instructorShareForOrder(data, { ...order, courseId: 'missing' }), 0);
});
