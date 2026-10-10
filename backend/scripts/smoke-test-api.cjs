// Build first. Starts a temporary local API against the dedicated test DB; never resets/seeds data.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { parseEnv } = require('node:util');
const { spawn } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const root = path.resolve(__dirname, '..');
const config = parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
const target = new URL(config.TEST_DATABASE_URL || '');
if (target.hostname !== '127.0.0.1' || target.port !== '5433' || target.pathname !== '/melearn_test' ||
  target.username !== 'melearn_test_app' || config.TEST_DATABASE_NAME !== 'melearn_test') {
  throw new Error('Runtime smoke requires the confirmed isolated test target.');
}
async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}
const wait = delay => new Promise(resolve => setTimeout(resolve, delay));
async function main() {
  const db = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  let child;
  try {
    const counts = async () => {
      const names = ['account', 'localCredential', 'appSession', 'externalIdentity', 'course', 'courseReview', 'courseChapter', 'courseItem', 'enrollment', 'userRole', 'progress', 'certificate', 'blogPost', 'videoTranscript', 'aIConversation', 'aIMessage', 'aIUsageDaily', 'aIRequest', 'aIPractice', 'quiz', 'question', 'quizAttempt', 'attemptQuestion', 'answer', 'redeemCode', 'payment', 'paymentEvent'];
      return Object.fromEntries(await Promise.all(names.map(async name => [name, await db[name].count()])));
    };
    const before = await counts();
    const port = await freePort();
    let output = '';
    child = spawn(process.execPath, ['dist/main.js'], { cwd: root,
      env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DATABASE_URL: target.toString() },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-20000); });
    child.stderr.on('data', () => {});
    const base = `http://127.0.0.1:${port}/api/v1`;
    for (let attempt = 0; attempt < 100 && !output.includes(`API listening on port ${port}`); attempt++) {
      if (child.exitCode !== null) throw new Error('Test API exited before becoming ready.');
      await wait(100);
    }
    if (!output.includes(`API listening on port ${port}`)) throw new Error('Test API readiness timed out.');
    const publicResponse = await fetch(base + '/courses');
    const publicBody = await publicResponse.json();
    if (publicResponse.status !== 200 || !Array.isArray(publicBody.items)) throw new Error('Public runtime read failed.');
    const unauthorized = await fetch(base + '/me');
    const missing = await fetch(base + '/not-an-endpoint');
    const invalid = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"audience":"invalid"}' });
    if (unauthorized.status !== 401 || missing.status !== 404 || invalid.status !== 422) throw new Error('Runtime error/validation smoke failed.');
    const errorBody = await invalid.json();
    if (errorBody.error?.request_id !== invalid.headers.get('x-request-id')) throw new Error('Runtime correlation failed.');
    const after = await counts();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Startup/read/validation unexpectedly changed data.');
    const result = { database: 'melearn_test', publicCatalog: 200, unauthorizedProfile: 401, unknownRoute: 404,
      invalidLogin: 422, requestCorrelation: true, noStartupOrReadWrites: true };
    const artifactDirectory = path.resolve(process.env.EXECUTION_ARTIFACT_DIR || path.join(root, '../artifacts/nest-execution'));
    fs.mkdirSync(artifactDirectory, { recursive: true });
    fs.writeFileSync(path.join(artifactDirectory, 'runtime-smoke.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), wait(3000)]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await db.$disconnect();
  }
}
main().catch(() => { console.error('Test API smoke failed; credential-bearing diagnostics withheld.'); process.exitCode = 1; });
