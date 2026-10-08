import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultUsername, validateProfile, certificateRecipient, snapshotLegacyCertificateNames } from '../packages/store/src/lib/profile-model.ts';

const users = [{ id: 'learner-1', name: 'Legacy name' }, { id: 'learner-2', name: 'Other learner', username: 'taken.name' }];

test('profile username defaults avoid a collision and validate case-insensitive uniqueness', () => {
  assert.equal(defaultUsername(users[0], users), 'learner1');
  assert.equal(validateProfile({ name: 'Name', username: 'TAKEN.NAME' }, users, users[0].id), 'ชื่อผู้ใช้นี้มีผู้ใช้แล้ว');
  assert.equal(validateProfile({ name: 'Name', username: 'new_name.1' }, users, users[0].id), undefined);
});

test('profile dates reject impossible and future civil dates', () => {
  assert.match(validateProfile({ name: 'Name', username: 'user.123', birthDate: '2001-02-29' }, users, users[0].id), /วันเกิดไม่ถูกต้อง/);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const future = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  assert.match(validateProfile({ name: 'Name', username: 'user.123', birthDate: future }, users, users[0].id), /วันเกิดไม่ถูกต้อง/);
});

test('certificate names prefer the explicit recipient and snapshot legacy names', () => {
  assert.equal(certificateRecipient({ id: 'u', name: 'Display', firstName: 'First', lastName: 'Last', certificateName: ' Full Name ' }), 'Full Name');
  const old = [{ id: 'c1', userId: 'learner-1' }];
  const migrated = snapshotLegacyCertificateNames(old, users);
  assert.equal(migrated[0].recipientName, 'Legacy name');
  assert.equal(snapshotLegacyCertificateNames(migrated, [{ id: 'learner-1', name: 'Changed' }])[0].recipientName, 'Legacy name');
});
