// Explicit operator action for the already-approved Cloud SQL instance. Never called at startup.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const file = path.join(root, '.env');
const legacy = parseEnv(fs.readFileSync(process.env.LEGACY_ENV_FILE || path.resolve(root, '../../../melearn-tutor-api/.env'), 'utf8'));
const local = parseEnv(fs.readFileSync(file, 'utf8'));
const resume = process.argv[2] === '--resume-melearn-test';
if (!['--create-melearn-test', '--resume-melearn-test'].includes(process.argv[2]) ||
  local.CLOUD_SQL_INSTANCE_CONNECTION_NAME !== 'melearn-infra-prod:asia-southeast3:melearn-tutor-db') {
  throw new Error('Explicit test provisioning flag and confirmed instance are required.');
}
if (!legacy.CloudSql__AdminPassword) throw new Error('Operator credential is missing.');
const psql = 'C:/Program Files/PostgreSQL/16/bin/psql.exe';
function sql(database, statement, user = 'postgres', password = legacy.CloudSql__AdminPassword) {
  const result = spawnSync(psql,
    ['-h', '127.0.0.1', '-p', '5433', '-U', user, '-d', database, '-X', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: statement, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, PGCONNECT_TIMEOUT: '10', PGPASSWORD: password } });
  if (result.status !== 0) throw new Error('Test provisioning SQL failed; credential-bearing diagnostics withheld.');
  return result.stdout.trim();
}
if (sql('postgres', "SELECT count(*) FROM pg_database WHERE datname='melearn_test';") !== '0') {
  throw new Error('Test database already exists; no overwrite, reset or credential rotation performed.');
}
const roleCount = sql('postgres', "SELECT count(*) FROM pg_roles WHERE rolname IN ('melearn_test_migrator','melearn_test_app');");
if (roleCount !== (resume ? '2' : '0')) {
  throw new Error('A test role already exists; manual review required.');
}
const migratorPassword = resume ? new URL(local.MIGRATION_DATABASE_URL).password : randomBytes(32).toString('hex');
const runtimePassword = resume ? new URL(local.TEST_DATABASE_URL).password : randomBytes(32).toString('hex');
if (!/^[a-f0-9]{64}$/.test(migratorPassword) || !/^[a-f0-9]{64}$/.test(runtimePassword)) {
  throw new Error('Unexpected generated test credential format; review required.');
}
const additions = {
  TEST_DATABASE_NAME: 'melearn_test',
  MIGRATION_DATABASE_URL: `postgresql://melearn_test_migrator:${migratorPassword}@127.0.0.1:5433/melearn_test?schema=public&connection_limit=2`,
  TEST_DATABASE_URL: `postgresql://melearn_test_app:${runtimePassword}@127.0.0.1:5433/melearn_test?schema=public&connection_limit=2`,
};
for (const key of Object.keys(additions)) {
  if (local[key] && (!resume || local[key] !== additions[key])) throw new Error('Existing test configuration requires review.');
}
let text = fs.readFileSync(file, 'utf8');
for (const [key, value] of Object.entries(additions)) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  text = pattern.test(text) ? text.replace(pattern, line) : text.trimEnd() + '\n' + line + '\n';
}
// Persist credentials only in the ignored ENV before creating roles; resumable manual review on partial failure.
fs.writeFileSync(file, text);
if (resume) {
  sql('postgres', 'SELECT 1;', 'melearn_test_migrator', migratorPassword);
  sql('postgres', 'SELECT 1;', 'melearn_test_app', runtimePassword);
} else {
  sql('postgres', `CREATE ROLE melearn_test_migrator LOGIN PASSWORD '${migratorPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE melearn_test_app LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;`);
}
// PostgreSQL 16 requires the creator to be able to SET ROLE to the proposed database owner.
sql('postgres', `GRANT melearn_test_migrator TO postgres;
CREATE DATABASE melearn_test OWNER melearn_test_migrator;
REVOKE ALL ON DATABASE melearn_test FROM PUBLIC;
GRANT CONNECT ON DATABASE melearn_test TO melearn_test_migrator, melearn_test_app;`);
sql('melearn_test', `ALTER SCHEMA public OWNER TO melearn_test_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO melearn_test_app;
ALTER DEFAULT PRIVILEGES FOR ROLE melearn_test_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO melearn_test_app;
ALTER DEFAULT PRIVILEGES FOR ROLE melearn_test_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO melearn_test_app;`);
console.log('Created isolated melearn_test with separate migrator/runtime roles. Credentials saved only in ignored ENV.');
