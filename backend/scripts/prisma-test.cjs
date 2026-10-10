const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const config = { ...parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8')), ...process.env };
const target = new URL(config.MIGRATION_DATABASE_URL || '');
if (target.hostname !== '127.0.0.1' || target.port !== '5433' || target.pathname !== '/melearn_test' ||
  target.username !== 'melearn_test_migrator' || config.TEST_DATABASE_NAME !== 'melearn_test') {
  throw new Error('Refusing Prisma operation outside the confirmed isolated test target.');
}
const operation = process.argv[2];
let args;
if (operation === 'generate') args = ['generate', '--schema', 'prisma/schema.prisma'];
else if (operation === 'validate') args = ['validate', '--schema', 'prisma/schema.prisma'];
else if (operation === 'status') args = ['migrate', 'status', '--schema', 'prisma/schema.prisma'];
else if (operation === 'diff-db01') args = ['migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'];
else if (operation === 'migrate') {
  if (config.ALLOW_TEST_DATABASE_MIGRATION !== 'yes') throw new Error('Reviewed Test PostgreSQL migrations require ALLOW_TEST_DATABASE_MIGRATION=yes.');
  args = ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'];
} else throw new Error('Expected generate, validate, status, diff-db01 or migrate.');
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
  cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: config.MIGRATION_DATABASE_URL },
});
function redact(text) {
  return (text || '').replaceAll(config.MIGRATION_DATABASE_URL, '[REDACTED_URL]').replaceAll(target.password, '[REDACTED]');
}
if (operation === 'diff-db01' && result.status === 0) {
  const destination = path.join(root, 'prisma/migrations/20261011002000_db01/migration.sql');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, result.stdout, { flag: 'wx' });
  console.log('Generated DB-01 SQL for review; no database changes applied.');
} else if (result.stdout) process.stdout.write(redact(result.stdout));
if (result.stderr) process.stderr.write(redact(result.stderr));
if (operation === 'migrate' && result.status === 0) {
  // Runtime CRUD defaults must not grant access to migration bookkeeping.
  const grant = spawnSync(process.env.PSQL_PATH || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/16/bin/psql.exe' : 'psql'),
    ['-h', target.hostname, '-p', target.port, '-U', target.username, '-d', 'melearn_test', '-X', '-v', 'ON_ERROR_STOP=1'],
    { input: 'REVOKE ALL ON TABLE public._prisma_migrations FROM melearn_test_app;', encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: target.password, PGCONNECT_TIMEOUT: '10' } });
  if (grant.status !== 0) throw new Error('Failed to restrict migration bookkeeping; diagnostics withheld.');
  console.log('Runtime access to migration bookkeeping revoked.');
}
process.exitCode = result.status === null ? 1 : result.status;
