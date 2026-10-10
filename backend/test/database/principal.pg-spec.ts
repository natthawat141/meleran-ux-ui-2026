import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrincipalService } from '../../src/features/auth/public/principal.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { testConnections } from '../support/postgres';

describe('AUTH-BASE-01 normalized session/principal resolution on Test PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, principals: PrincipalService;
  const tag = 'principal_' + randomUUID();
  let accountId: string;
  const webSecret = randomUUID(), adminSecret = randomUUID();
  const hash = (secret: string) => createHash('sha256').update(secret).digest('hex').toUpperCase();
  const adminRef = { tokenHash: hash(adminSecret), audience: 'admin' as const };
  let initialSessionCount: number;
  beforeAll(async () => {
    ({ runtime: db, migrator } = testConnections());
    accountId = (await db.account.create({ data: { displayName: tag, roles: 'learner',
      profileJson: '{"phone":"PRIVATE_PHONE"}', email: tag + '@example.invalid',
      localCredential: { create: { passwordHash: 'PRIVATE_PASSWORD_HASH' } },
      roleGrants: { create: [{ role: 'learner' }, { role: 'admin' }] } } })).id;
    await db.appSession.createMany({ data: [{ tokenHash: hash(webSecret), accountId, audience: 'web', expiresAt: new Date(Date.now() + 3600000) },
      { tokenHash: hash(adminSecret), accountId, audience: 'admin', expiresAt: new Date(Date.now() + 3600000) }] });
    principals = new PrincipalService(db as unknown as PrismaService);
    initialSessionCount = await db.appSession.count();
  });
  afterAll(async () => {
    if (db) {
      if (accountId) { await db.appSession.deleteMany({ where: { accountId } }); await db.userRole.deleteMany({ where: { accountId } }); await db.account.delete({ where: { id: accountId } }); }
      await db.$disconnect();
    }
    if (migrator) await migrator.$disconnect();
  });
  it('resolves server-normalized roles and returns no password/profile/provider/raw-session data', async () => {
    const principal = await principals.resolve(adminSecret, 'admin');
    expect(principal).toEqual({ accountId, roles: ['admin', 'learner'], learningEligible: false, session: adminRef });
    const json = JSON.stringify(principal);
    for (const value of ['PRIVATE_PASSWORD_HASH', 'PRIVATE_PHONE', '@example.invalid', adminSecret, 'localCredential', 'profileJson']) expect(json).not.toContain(value);
  });
  it('keeps Web/Admin sessions isolated and fails closed for unknown/missing/malformed credentials', async () => {
    expect((await principals.resolve(webSecret, 'web'))?.accountId).toBe(accountId);
    expect(await principals.resolve(webSecret, 'admin')).toBeNull();
    expect(await principals.resolve(adminSecret, 'web')).toBeNull();
    for (const secret of [undefined, null, [], {}, '', 'x'.repeat(4097), randomUUID()]) expect(await principals.resolve(secret, 'admin')).toBeNull();
  });
  it('observes expiration, revocation and disabled-account changes on the next lookup', async () => {
    try {
      await db.appSession.update({ where: { tokenHash: adminRef.tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await principals.resolve(adminSecret, 'admin')).toBeNull();
      await db.appSession.update({ where: { tokenHash: adminRef.tokenHash }, data: { expiresAt: new Date(Date.now() + 3600000), revokedAt: new Date() } });
      expect(await principals.resolve(adminSecret, 'admin')).toBeNull();
      expect(await principals.resolve(webSecret, 'web')).not.toBeNull();
      await db.appSession.update({ where: { tokenHash: adminRef.tokenHash }, data: { revokedAt: null } });
      await db.account.update({ where: { id: accountId }, data: { disabled: true } });
      expect(await principals.resolve(adminSecret, 'admin')).toBeNull();
      expect(await principals.resolve(webSecret, 'web')).toBeNull();
    } finally { await db.account.update({ where: { id: accountId }, data: { disabled: false } }); }
  });
  it('never gives Admin authority from the compatibility role string or a stale principal', async () => {
    const stale = await principals.resolve(adminSecret, 'admin');
    await db.userRole.delete({ where: { accountId_role: { accountId, role: 'admin' } } });
    await db.account.update({ where: { id: accountId }, data: { roles: 'admin' } });
    try {
      expect((await principals.resolve(adminSecret, 'admin'))?.roles).toEqual(['learner']);
      await expect(db.$transaction(tx => principals.requireAdmin(tx, stale!.session))).rejects.toMatchObject({ code: 'forbidden' });
    } finally { await db.userRole.create({ data: { accountId, role: 'admin' } }); }
  });
  it('derives learning readiness from confirmed provenance/verification and roles without mutating the account', async () => {
    await db.userRole.delete({ where: { accountId_role: { accountId, role: 'admin' } } });
    try {
      for (const [origin, verified, eligible] of [['admin_created', false, true], ['self_email', false, false],
        ['self_email', true, true], ['google', true, true], ['google', false, false]] as const) {
        await db.account.update({ where: { id: accountId }, data: { origin, emailVerified: verified } });
        const before = await db.account.findUniqueOrThrow({ where: { id: accountId } });
        expect((await principals.resolve(webSecret, 'web'))?.learningEligible).toBe(eligible);
        expect(await db.account.findUniqueOrThrow({ where: { id: accountId } })).toEqual(before);
      }
    } finally {
      await db.account.update({ where: { id: accountId }, data: { origin: 'admin_created', emailVerified: false } });
      await db.userRole.create({ data: { accountId, role: 'admin' } });
    }
  });
  it('revalidates audience and revoked authority inside a caller-owned transaction', async () => {
    await expect(db.$transaction(tx => principals.requireAdmin(tx, { tokenHash: hash(webSecret), audience: 'web' }))).rejects.toMatchObject({ code: 'audience_not_allowed' });
    await db.appSession.update({ where: { tokenHash: adminRef.tokenHash }, data: { revokedAt: new Date() } });
    try { await expect(db.$transaction(tx => principals.requireAdmin(tx, adminRef))).rejects.toMatchObject({ code: 'credentials_invalid' }); }
    finally { await db.appSession.update({ where: { tokenHash: adminRef.tokenHash }, data: { revokedAt: null } }); }
  });
  it('holds authority locks until the resource transaction ends, blocking a concurrent revocation', async () => {
    let release!: () => void, locked!: () => void;
    const releasePromise = new Promise<void>(resolve => { release = resolve; });
    const lockedPromise = new Promise<void>(resolve => { locked = resolve; });
    const holder = db.$transaction(async tx => { await principals.requireAdmin(tx, adminRef); locked(); await releasePromise; }, { timeout: 10000 });
    await lockedPromise;
    let pid!: number, started!: () => void;
    const startedPromise = new Promise<void>(resolve => { started = resolve; });
    const revoker = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      started(); await tx.appSession.update({ where: { tokenHash: adminRef.tokenHash }, data: { revokedAt: new Date() } });
    }, { timeout: 10000 });
    await startedPromise;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`;
        if (rows[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      release(); await holder; await revoker;
      expect(await principals.resolve(adminSecret, 'admin')).toBeNull();
    } finally {
      release(); await Promise.allSettled([holder, revoker]);
      await db.appSession.update({ where: { tokenHash: adminRef.tokenHash }, data: { revokedAt: null } });
    }
  });
  it('survives reconnect without issuing, refreshing or revoking sessions on resolve', async () => {
    const before = await db.appSession.findMany({ where: { accountId }, orderBy: { tokenHash: 'asc' } });
    await db.$disconnect(); await db.$connect();
    expect(await principals.resolve(adminSecret, 'admin')).not.toBeNull();
    expect(await db.appSession.findMany({ where: { accountId }, orderBy: { tokenHash: 'asc' } })).toEqual(before);
    expect(await db.appSession.count()).toBe(initialSessionCount);
  });
});
