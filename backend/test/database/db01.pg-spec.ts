import { PrismaClient } from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { assertIsolatedTestDatabase } from '../support/test-database';

describe('DB-01 real Test PostgreSQL', () => {
  let runtime: PrismaClient;
  let migrator: PrismaClient;
  let runtimeUrl: string;
  const tag = `db01_${randomUUID()}`;
  let accountId: string;
  let courseId: string;

  beforeAll(async () => {
    const env = { ...parseEnv(readFileSync(resolve(__dirname, '../../.env'), 'utf8')), ...process.env };
    runtimeUrl = assertIsolatedTestDatabase(env);
    const migrationUrl = new URL(env.MIGRATION_DATABASE_URL || '');
    const target = new URL(runtimeUrl);
    if (migrationUrl.hostname !== target.hostname || migrationUrl.port !== target.port ||
      migrationUrl.pathname !== target.pathname || migrationUrl.username !== 'melearn_test_migrator') {
      throw new Error('Migration connection must target the same isolated database with the separate migrator.');
    }
    runtime = new PrismaClient({ datasources: { db: { url: runtimeUrl } } });
    migrator = new PrismaClient({ datasources: { db: { url: migrationUrl.toString() } } });
    await runtime.$connect();
    await migrator.$connect();
    const identity = await runtime.$queryRaw<Array<{ database: string; user: string }>>
      `SELECT current_database() AS database, current_user AS "user"`;
    expect(identity).toEqual([{ database: 'melearn_test', user: 'melearn_test_app' }]);
    const account = await runtime.account.create({ data: { displayName: tag, username: tag, normalizedUsername: tag.toUpperCase() } });
    accountId = account.id;
    const course = await runtime.course.create({ data: { slug: tag, title: tag, category: 'test', level: 'test', instructorId: accountId } });
    courseId = course.id;
  });

  afterAll(async () => {
    if (runtime) {
      if (courseId) {
        await runtime.courseReview.deleteMany({ where: { courseId } });
        await runtime.enrollment.deleteMany({ where: { courseId } });
        await runtime.courseChapter.deleteMany({ where: { courseId } });
        await runtime.course.deleteMany({ where: { id: courseId } });
      }
      if (accountId) await runtime.account.deleteMany({ where: { id: accountId } });
      await runtime.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });

  it('records the exact reviewed migration checksum', async () => {
    const file = readFileSync(resolve(__dirname, '../../prisma/migrations/20261011002000_db01/migration.sql'));
    const rows = await migrator.$queryRaw<Array<{ checksum: string; finished_at: Date | null }>>
      `SELECT checksum, finished_at FROM _prisma_migrations WHERE migration_name = '20261011002000_db01'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].checksum).toBe(createHash('sha256').update(file).digest('hex'));
    expect(rows[0].finished_at).not.toBeNull();
  });

  it('keeps all eight prototype models and adds review history', async () => {
    const rows = await runtime.$queryRaw<Array<{ table_name: string }>>
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    expect(rows.map(row => row.table_name)).toEqual(expect.arrayContaining([
      'accounts', 'local_credentials', 'app_sessions', 'external_identities', 'courses',
      'course_chapters', 'course_items', 'enrollments', 'course_reviews',
    ]));
  });

  it('enforces normalized username uniqueness', async () => {
    await expect(runtime.account.create({ data: { displayName: 'duplicate', normalizedUsername: tag.toUpperCase() } }))
      .rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces foreign keys for credentials and course ownership', async () => {
    await expect(runtime.localCredential.create({ data: { accountId: randomUUID(), passwordHash: 'test-only' } }))
      .rejects.toMatchObject({ code: 'P2003' });
    await expect(runtime.course.create({ data: { slug: `${tag}_bad`, title: 'invalid', category: 'test', level: 'test', instructorId: randomUUID() } }))
      .rejects.toMatchObject({ code: 'P2003' });
  });

  it('protects money, content type and revision storage invariants', async () => {
    await expect(runtime.course.update({ where: { id: courseId }, data: { priceMinor: -1 } })).rejects.toThrow();
    await expect(runtime.course.update({ where: { id: courseId }, data: { currency: 'USD' } })).rejects.toThrow();
    await expect(runtime.course.update({ where: { id: courseId }, data: { revision: -1 } })).rejects.toThrow();
    const chapter = await runtime.courseChapter.create({ data: { courseId, title: 'test', position: 0 } });
    await expect(runtime.courseItem.create({ data: { chapterId: chapter.id, courseId, title: 'bad', position: 0, type: 'private' } })).rejects.toThrow();
  });

  it('allows at most one enrollment under simultaneous writes', async () => {
    const attempts = await Promise.allSettled([0, 1].map(() => runtime.enrollment.create({ data: { accountId, courseId } })));
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = attempts.find(result => result.status === 'rejected');
    expect(rejected && rejected.status === 'rejected' && rejected.reason.code).toBe('P2002');
    expect(await runtime.enrollment.count({ where: { accountId, courseId } })).toBe(1);
  });

  it('retains fixture data after disconnect and reconnect with a fresh client', async () => {
    const another = new PrismaClient({ datasources: { db: { url: runtimeUrl } } });
    try {
      await another.$connect();
      expect((await another.course.findUniqueOrThrow({ where: { id: courseId } })).title).toBe(tag);
      await another.$disconnect();
      await another.$connect();
      expect(await another.enrollment.count({ where: { accountId, courseId } })).toBe(1);
    } finally { await another.$disconnect(); }
  });

  it('rolls back related writes atomically', async () => {
    const revision = (await runtime.course.findUniqueOrThrow({ where: { id: courseId } })).revision;
    await expect(runtime.$transaction(async tx => {
      await tx.course.update({ where: { id: courseId }, data: { revision: { increment: 1 } } });
      await tx.courseReview.create({ data: { courseId, submittedRevision: revision, submittedBy: accountId } });
      throw new Error('test rollback');
    })).rejects.toThrow('test rollback');
    expect((await runtime.course.findUniqueOrThrow({ where: { id: courseId } })).revision).toBe(revision);
    expect(await runtime.courseReview.count({ where: { courseId } })).toBe(0);
  });

  it('denies runtime schema writes and migration bookkeeping updates', async () => {
    const permissions = await runtime.$queryRaw<Array<{ create_schema: boolean; migration_update: boolean }>>
      `SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS create_schema,
       has_table_privilege(current_user, 'public._prisma_migrations', 'UPDATE') AS migration_update`;
    expect(permissions).toEqual([{ create_schema: false, migration_update: false }]);
    await expect(runtime.$executeRawUnsafe('CREATE TABLE public.runtime_must_not_create (id integer)')).rejects.toThrow();
  });

  it('can apply and roll back the full DDL batch in an isolated probe schema', async () => {
    const schema = `db01_probe_${randomUUID().replaceAll('-', '')}`;
    const sql = readFileSync(resolve(__dirname, '../../prisma/migrations/20261011002000_db01/migration.sql'), 'utf8')
      .replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '')
      .replace('CREATE SCHEMA IF NOT EXISTS "public";', '')
      .replace(/^\s*--.*$/gm, '');
    await expect(migrator.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) {
        await tx.$executeRawUnsafe(statement);
      }
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>
        `SELECT count(*) FROM information_schema.tables WHERE table_schema=${schema}`;
      expect(Number(rows[0].count)).toBe(9);
      throw new Error('rollback reviewed migration probe');
    }, { timeout: 20000 })).rejects.toThrow('rollback reviewed migration probe');
    const rows = await migrator.$queryRaw<Array<{ count: bigint }>>
      `SELECT count(*) FROM information_schema.schemata WHERE schema_name=${schema}`;
    expect(Number(rows[0].count)).toBe(0);
  });
});
