import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const app = option('--app');
assert.ok(['web', 'admin'].includes(app), 'Use --app web or --app admin');
const image = option('--image', `melearn-${app}:local`);
const port = Number(option('--port', '8080'));
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, 'Use an unprivileged --port between 1024 and 65535');
const name = `melearn-${app}-smoke-${randomUUID()}`;
const docker = (...parameters) => execFileSync('docker', parameters, { encoding: 'utf8', timeout: 30_000 }).trim();

let started = false;
try {
  docker('run', '--detach', '--name', name, '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--publish', `127.0.0.1::${port}`, '--env', `PORT=${port}`, image);
  started = true;
  const binding = docker('port', name, `${port}/tcp`);
  const base = `http://${binding}`;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok && (await response.text()) === 'ok\n') { ready = true; break; }
    } catch { /* The static server may still be starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Health endpoint did not become ready');
  assert.notEqual(docker('exec', name, 'id', '-u'), '0', 'Static server must run as non-root');
  const healthCheck = JSON.parse(docker('inspect', '--format', '{{json .Config.Healthcheck}}', name));
  assert.ok(healthCheck?.Test?.some((command) => command.includes('/healthz')), 'Image must include the Docker health check for /healthz');
  docker('exec', name, 'nginx', '-t');
  docker('exec', name, 'sh', '-c', 'wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz"');

  const shell = await fetch(`${base}/index.html`);
  assert.equal(shell.status, 200);
  assert.match(shell.headers.get('cache-control') ?? '', /no-store/);
  const html = await shell.text();
  assert.match(html, /<div id="root"><\/div>/);
  const deepLink = app === 'web' ? '/learn/courses/container-smoke' : '/admin/courses/container-smoke';
  for (const path of ['/', deepLink]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, `${path} must serve the SPA shell`);
    assert.equal(await response.text(), html, `${path} must serve this app's index.html`);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  }

  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map((match) => match[1]))];
  assert.ok(assets.length > 0, 'Built HTML must reference its assets');
  for (const path of assets) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, `${path} is missing`);
    assert.match(response.headers.get('cache-control') ?? '', /immutable/);
    assert.doesNotMatch(response.headers.get('content-type') ?? '', /text\/html/);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  for (const path of ['/assets/missing.js', '/missing.css', '/api/container-smoke', '/.env']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, `${path} must not return SPA HTML`);
  }
  console.log(`${app} container smoke passed: non-root, health, assets, SPA deep links, cache headers, 404 boundaries, PORT=${port}`);
} catch (error) {
  if (started) {
    try { console.error(docker('logs', name)); } catch { /* Preserve the original failure. */ }
  }
  throw error;
} finally {
  if (started) docker('rm', '--force', name);
}
