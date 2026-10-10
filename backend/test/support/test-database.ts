import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Environment, loadLocalEnvironment } from '../../src/shared/config/environment';

/** Reject destructive setup unless the operator selected a disposable PostgreSQL target. */
export function assertIsolatedTestDatabase(env: Environment): string {
  if (env.NODE_ENV !== 'test' || env.ALLOW_TEST_DATABASE_RESET !== 'yes') {
    throw new Error('Database tests require NODE_ENV=test and ALLOW_TEST_DATABASE_RESET=yes.');
  }
  let target: URL;
  try { target = new URL(env.TEST_DATABASE_URL || ''); }
  catch { throw new Error('TEST_DATABASE_URL must identify an isolated PostgreSQL database.'); }
  const name = decodeURIComponent(target.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !target.hostname ||
    !name.endsWith('_test') || name !== env.TEST_DATABASE_NAME || !target.username ||
    ['postgres', 'template0', 'template1'].includes(name)) {
    throw new Error('Test database must be PostgreSQL, end in _test, and match TEST_DATABASE_NAME.');
  }
  if (target.searchParams.has('schema') && target.searchParams.get('schema') !== 'public') {
    throw new Error('Only the isolated test database public schema is supported.');
  }
  if (env.DATABASE_URL) {
    let runtime: URL;
    try { runtime = new URL(env.DATABASE_URL); }
    catch { throw new Error('DATABASE_URL is invalid; refusing test setup.'); }
    if (runtime.hostname === target.hostname && (runtime.port || '5432') === (target.port || '5432') &&
      decodeURIComponent(runtime.pathname) === decodeURIComponent(target.pathname)) {
      throw new Error('Test reset target must differ from the configured application database.');
    }
  }
  return target.toString();
}

export function prepareTestDatabase(): void {
  loadLocalEnvironment();
  const url = assertIsolatedTestDatabase(process.env);
  const schema = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');
  if (!/provider\s*=\s*"postgresql"/.test(schema)) {
    throw new Error('DB-01 PostgreSQL schema is required; SQLite tests cannot satisfy persistence gates.');
  }
  process.env.DATABASE_URL = url;
}
