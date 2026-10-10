import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { assertIsolatedTestDatabase } from './test-database';

export function testConnections(): { runtime: PrismaClient; migrator: PrismaClient; migrationUrl: string } {
  const env = { ...parseEnv(readFileSync(resolve(__dirname, '../../.env'), 'utf8')), ...process.env };
  const runtimeUrl = assertIsolatedTestDatabase(env);
  const url = new URL(env.MIGRATION_DATABASE_URL || '');
  const runtime = new URL(runtimeUrl);
  if (url.hostname !== runtime.hostname || url.port !== runtime.port || url.pathname !== runtime.pathname ||
      url.username !== 'melearn_test_migrator') throw new Error('Migrator must match the isolated test target.');
  return { runtime: new PrismaClient({ datasources: { db: { url: runtimeUrl } } }),
    migrator: new PrismaClient({ datasources: { db: { url: url.toString() } } }), migrationUrl: url.toString() };
}

export async function assertMigration(client: PrismaClient, name: string): Promise<void> {
  const bytes = readFileSync(resolve(__dirname, '../../prisma/migrations', name, 'migration.sql'));
  const records = await client.$queryRaw<Array<{ checksum: string; finished_at: Date | null }>>
    `SELECT checksum,finished_at FROM _prisma_migrations WHERE migration_name=${name}`;
  expect(records).toHaveLength(1);
  expect(records[0].checksum).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(records[0].finished_at).not.toBeNull();
}

/** Exercise actual SQL (including functions) in one rolled-back, isolated schema. */
export async function assertMigrationRollback(url: string, client: PrismaClient, batches: string[], tables: number): Promise<void> {
  const schema = `ddl_probe_${randomUUID().replaceAll('-', '')}`;
  const sql = batches.map(name => readFileSync(resolve(__dirname, '../../prisma/migrations', name, 'migration.sql'), 'utf8')
    .replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, '')
    .replace('CREATE SCHEMA IF NOT EXISTS "public";', '')).join('\n');
  const target = new URL(url);
  const result = spawnSync(process.env.PSQL_PATH || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/16/bin/psql.exe' : 'psql'),
    ['-h', target.hostname, '-p', target.port, '-U', target.username, '-d', target.pathname.slice(1), '-X', '-Atq', '-v', 'ON_ERROR_STOP=1'], {
      encoding: 'utf8', env: { ...process.env, PGPASSWORD: target.password, PGCONNECT_TIMEOUT: '10' },
      input: `BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";\n${sql}\nSELECT count(*) FROM information_schema.tables WHERE table_schema='${schema}'; ROLLBACK;`,
    });
  if (result.status !== 0) throw new Error('DDL rollback probe failed; private connection diagnostics withheld.');
  expect(result.stdout.trim().split('\n').at(-1)).toBe(String(tables));
  const rows = await client.$queryRaw<Array<{ count: bigint }>>
    `SELECT count(*) FROM information_schema.schemata WHERE schema_name=${schema}`;
  expect(Number(rows[0].count)).toBe(0);
}
