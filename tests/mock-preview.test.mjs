import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPreviewServer } from '../tools/mock-preview/server.mjs';

test('deployed demo adapters share data, preserve separate sessions, and serve SPA safely', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'melearn-preview-'));
  await writeFile(path.join(root, 'index.html'), '<html>demo</html>');
  const web = createPreviewServer({ app: 'web', root });
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  const webUrl = `http://127.0.0.1:${web.address().port}`;
  const admin = createPreviewServer({ app: 'admin', root, upstream: webUrl });
  await new Promise(resolve => admin.listen(0, '127.0.0.1', resolve));
  const adminUrl = `http://127.0.0.1:${admin.address().port}`;
  try {
    const login = async (base, audience, identifier) => {
      const res = await fetch(`${base}/mock-api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier, audience, password: 'mock-password-1' }) });
      assert.equal(res.status, 200, await res.clone().text());
      assert.match(res.headers.get('set-cookie'), /Secure/);
      return res.headers.get('set-cookie').split(';')[0];
    };
    const learnerCookie = await login(webUrl, 'web', 'learner@example.test');
    const adminCookie = await login(adminUrl, 'admin', 'admin');
    const adminMe = await fetch(`${adminUrl}/mock-api/v1/me`, { headers: { cookie: adminCookie } });
    assert.equal(adminMe.status, 200);
    assert.equal((await adminMe.json()).roles.includes('admin'), true);
    assert.equal((await fetch(`${adminUrl}/mock-api/v1/me`, { headers: { cookie: learnerCookie } })).status, 401);
    assert.equal((await fetch(`${webUrl}/mock-api/v1/me`, { headers: { cookie: adminCookie } })).status, 401);
    const webCatalog = await fetch(`${webUrl}/mock-api/v1/courses`);
    const adminCatalog = await fetch(`${adminUrl}/mock-api/v1/courses`);
    assert.equal(webCatalog.status, 200);
    assert.deepEqual(await adminCatalog.json(), await webCatalog.json());
    assert.equal(await (await fetch(`${webUrl}/health`)).text(), 'ok\n');
    assert.equal(await (await fetch(`${adminUrl}/admin/ai`)).text(), '<html>demo</html>');
    assert.equal((await fetch(`${webUrl}/.env`)).status, 404);
    assert.equal((await fetch(`${webUrl}/assets/missing.js`)).status, 404);
  } finally {
    await Promise.all([new Promise(resolve => web.close(resolve)), new Promise(resolve => admin.close(resolve))]);
    await rm(root, { recursive: true });
  }
});
