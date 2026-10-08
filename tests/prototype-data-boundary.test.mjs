import assert from 'node:assert/strict';
import test from 'node:test';
import { usesPrototypeData as web } from '../apps/web/src/app/providers/prototype-routes.ts';
import { usesPrototypeData as admin } from '../apps/admin/src/app/providers/prototype-routes.ts';

test('API flows never mount the prototype persistence provider', () => {
  for (const path of ['/', '/login', '/register', '/reset-password', '/verify-email', '/courses', '/courses/mock',
    '/explore/courses', '/articles', '/articles/blg_mock_001', '/learn', '/learn/courses/mock', '/learn/attempts/one',
    '/checkout/mock', '/account/profile', '/account/certificates', '/learn/ai', '/learn/redeem', '/teach/reviews']) {
    assert.equal(web(path), false, path);
  }
  for (const path of ['/login', '/account/profile', '/admin/payments', '/admin/ai', '/admin/access-codes']) {
    assert.equal(admin(path), false, path);
  }
});

test('unfinished authoring/admin pages retain their explicitly tracked persistence boundary', () => {
  assert.equal(web('/teach/courses/new'), true);
  assert.equal(web('/instructors/one'), true);
  assert.equal(web('/teach/attempts/one/grade'), true);
  assert.equal(admin('/admin/courses/one/settings'), true);
  assert.equal(admin('/admin/articles/new'), true);
});
