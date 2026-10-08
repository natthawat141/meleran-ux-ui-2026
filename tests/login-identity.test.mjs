import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticatePrototypeUser, findUserByLoginIdentifier } from '../packages/store/src/lib/auth-identity.ts';

const users = [
  { id: 'learner-1', email: 'somchai@example.com', username: 'somchai.learn', password: 'learner-pass', role: 'learner' },
  { id: 'admin-1', email: 'admin@example.com', password: 'admin-pass', role: 'admin' },
];

test('login identifier finds a username or email without case sensitivity', () => {
  assert.equal(findUserByLoginIdentifier(users, '  SOMCHAI.LEARN ')?.id, 'learner-1');
  assert.equal(findUserByLoginIdentifier(users, 'SOMCHAI@EXAMPLE.COM')?.id, 'learner-1');
  assert.equal(findUserByLoginIdentifier(users, ' ADMIN@EXAMPLE.COM ')?.id, 'admin-1');
});

test('login identifier does not match a missing username or a blank value', () => {
  assert.equal(findUserByLoginIdentifier(users, 'admin'), undefined);
  assert.equal(findUserByLoginIdentifier(users, '   '), undefined);
});

test('Admin audience rejects a non-admin account even when its credentials are correct', () => {
  const immutableUsers = Object.freeze(users.map((user) => Object.freeze({ ...user })));
  const result = authenticatePrototypeUser(immutableUsers, 'somchai.learn', 'learner-pass', 'admin');

  assert.deepEqual(result, { ok: false, reason: 'role' });
  assert.equal(immutableUsers[0].role, 'learner');
  assert.equal(authenticatePrototypeUser(immutableUsers, 'admin@example.com', 'admin-pass', 'admin').ok, true);
});
