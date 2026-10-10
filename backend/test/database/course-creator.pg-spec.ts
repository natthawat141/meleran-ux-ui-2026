import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { testConnections, assertMigration, assertMigrationRollback } from '../support/postgres';

describe('DB-01 Course original creator distinct from current Instructor', () => {
  let db: PrismaClient, migrator: PrismaClient, migrationUrl: string;
  let creatorId: string, instructorId: string, otherId: string, courseId: string, legacyId: string;
  const tag = `creator_${randomUUID()}`;
  const name = '20261011045000_db01_course_creator';
  const batches = readdirSync(resolve(__dirname, '../../prisma/migrations'))
    .filter(entry => /^\d+_/.test(entry)).sort();
  const courseData = (suffix: string) => ({ slug: tag + suffix, title: tag, category: 'test', level: 'test', instructorId });
  const counts = () => Promise.all(Object.values(Prisma.ModelName).map(model =>
    (db as unknown as Record<string, { count(): Promise<number> }>)[model[0].toLowerCase() + model.slice(1)].count()));
  beforeAll(async () => {
    ({ runtime: db, migrator, migrationUrl } = testConnections());
    creatorId = (await db.account.create({ data: { displayName: tag + '_admin', roles: 'learner', roleGrants: { create: { role: 'admin' } } } })).id;
    instructorId = (await db.account.create({ data: { displayName: tag + '_instructor', roles: 'admin', roleGrants: { create: { role: 'instructor' } } } })).id;
    otherId = (await db.account.create({ data: { displayName: tag + '_other', roleGrants: { create: { role: 'instructor' } } } })).id;
    courseId = (await db.course.create({ data: { ...courseData('_owned'), createdBy: creatorId } })).id;
    legacyId = (await db.course.create({ data: courseData('_unknown') })).id;
  });
  afterAll(async () => {
    if (db) {
      await db.course.deleteMany({ where: { id: { in: [courseId, legacyId].filter(Boolean) } } });
      const accountId = { in: [creatorId, instructorId, otherId].filter(Boolean) };
      await db.userRole.deleteMany({ where: { accountId } });
      await db.account.deleteMany({ where: { id: accountId } });
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('records exact reviewed checksum and rolls back all nine migration batches / 27 models', async () => {
    expect(batches).toHaveLength(9);
    await assertMigration(migrator, name);
    await assertMigrationRollback(migrationUrl, migrator, batches, 27);
  });
  it('upgrades existing rows with truthful NULL creator and preserves every old Course field', async () => {
    const schema = `creator_probe_${randomUUID().replaceAll('-', '')}`;
    const sqlFor = (batch: string) => readFileSync(resolve(__dirname, '../../prisma/migrations', batch, 'migration.sql'), 'utf8')
      .replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, '').replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
    const sql = `BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";
${batches.filter(batch => batch !== name).map(sqlFor).join('\n')}
INSERT INTO accounts (id,"displayName") VALUES ('old_instructor','known Instructor');
INSERT INTO courses (id,slug,title,category,level,"instructorId","updatedAt")
 VALUES ('old_course','old-slug','Original title','test','test','old_instructor',now());
CREATE TEMP TABLE old_course_before AS SELECT to_jsonb(c) AS payload FROM courses c;
${sqlFor(name)}
DO $$ BEGIN
 IF (SELECT "createdBy" IS NOT NULL FROM courses WHERE id='old_course') THEN RAISE EXCEPTION 'invented creator'; END IF;
 IF (SELECT to_jsonb(c)-'createdBy' FROM courses c WHERE id='old_course') IS DISTINCT FROM
    (SELECT payload FROM old_course_before) THEN RAISE EXCEPTION 'changed historical course'; END IF;
END $$;
SELECT 'creator-upgrade-preserves-history'; ROLLBACK;`;
    const target = new URL(migrationUrl);
    const result = spawnSync(process.env.PSQL_PATH || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/16/bin/psql.exe' : 'psql'),
      ['-h', target.hostname, '-p', target.port, '-U', target.username, '-d', target.pathname.slice(1), '-X', '-Atq', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, encoding: 'utf8', env: { ...process.env, PGPASSWORD: decodeURIComponent(target.password), PGCONNECT_TIMEOUT: '10' } });
    if (result.status !== 0) throw new Error('Course creator upgrade probe failed; private diagnostics withheld');
    expect(result.stdout).toContain('creator-upgrade-preserves-history');
    const rows = await migrator.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM information_schema.schemata WHERE schema_name=${schema}`;
    expect(Number(rows[0].count)).toBe(0);
  });
  it('retains distinct Admin creator across Instructor transfer, role changes and reconnect', async () => {
    const before = await db.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(before.createdBy).toBe(creatorId); expect(before.instructorId).toBe(instructorId);
    try {
      await db.course.update({ where: { id: courseId }, data: { instructorId: otherId } });
      await db.userRole.deleteMany({ where: { accountId: creatorId, role: 'admin' } });
      const beforeCounts = await counts(); await db.$disconnect(); await db.$connect();
      const saved = await db.course.findUniqueOrThrow({ where: { id: courseId }, include: { creator: true, instructor: true } });
      expect(saved.createdBy).toBe(creatorId); expect(saved.creator?.id).toBe(creatorId);
      expect(saved.instructor.id).toBe(otherId); expect(saved.createdAt).toEqual(before.createdAt);
      expect((await db.course.findUniqueOrThrow({ where: { id: legacyId } })).createdBy).toBeNull();
      expect(await counts()).toEqual(beforeCounts);
    } finally {
      await db.course.update({ where: { id: courseId }, data: { instructorId } });
      await db.userRole.createMany({ data: [{ accountId: creatorId, role: 'admin' }], skipDuplicates: true });
    }
  });
  it('rejects creator rewrites/clears and guessed legacy backfill atomically', async () => {
    for (const [id, createdBy] of [[courseId, otherId], [courseId, null], [legacyId, creatorId]] as const) {
      const before = await db.course.findUniqueOrThrow({ where: { id } });
      await expect(db.course.update({ where: { id }, data: { createdBy, title: 'must rollback' } })).rejects.toThrow();
      expect(await db.course.findUniqueOrThrow({ where: { id } })).toEqual(before);
    }
  });
  it('requires a real creator Account and prevents deleting the retained creator', async () => {
    const before = await counts();
    await expect(db.course.create({ data: { ...courseData('_bad'), createdBy: randomUUID() } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(db.account.delete({ where: { id: creatorId } })).rejects.toMatchObject({ code: 'P2003' });
    expect(await counts()).toEqual(before);
  });
  it('rolls back new course/audit together on a real later PostgreSQL failure', async () => {
    const before = await counts();
    await expect(db.$transaction(async tx => {
      await tx.course.create({ data: { ...courseData('_rollback'), createdBy: creatorId } });
      await tx.$queryRaw`SELECT 1/0`;
    })).rejects.toThrow();
    expect(await counts()).toEqual(before);
    expect(await db.course.findUnique({ where: { slug: tag + '_rollback' } })).toBeNull();
  });
  it('a concurrent creator deletion waits for Course insert then fails FK instead of losing audit', async () => {
    const transient = await db.account.create({ data: { displayName: tag + '_concurrent' } });
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(r => { release = r; });
    const held = new Promise<void>(r => { ready = r; });
    const deleting = new Promise<void>(r => { started = r; });
    const insert = db.$transaction(async tx => {
      const course = await tx.course.create({ data: { ...courseData('_concurrent'), createdBy: transient.id } });
      ready(); await gate; return course;
    }, { timeout: 15000 });
    await held;
    const remove = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      started(); await tx.account.delete({ where: { id: transient.id } });
    }, { timeout: 15000 }).then(() => 'unexpected deletion', error => error.code as string);
    await deleting;
    try {
      let blocked = false;
      for (let i = 0; i < 100; i++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(r => setTimeout(r, 10));
      }
      expect(blocked).toBe(true); release(); const course = await insert;
      expect(await remove).toBe('P2003');
      expect((await db.course.findUniqueOrThrow({ where: { id: course.id } })).createdBy).toBe(transient.id);
    } finally {
      release(); await Promise.allSettled([insert, remove]);
      await db.course.deleteMany({ where: { slug: tag + '_concurrent' } });
      await db.account.delete({ where: { id: transient.id } });
    }
  });
});
