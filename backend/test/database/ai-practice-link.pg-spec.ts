import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { assertMigration, assertMigrationRollback, testConnections } from '../support/postgres';

describe('DB-05 follow-up / AI general chat and owned message-practice linkage', () => {
  let db: PrismaClient, migrator: PrismaClient, migrationUrl: string;
  const accounts: string[] = [], conversations: string[] = [], messages: string[] = [], tag = 'practice_link_' + randomUUID();
  beforeAll(() => { const connections = testConnections(); db = connections.runtime; migrator = connections.migrator; migrationUrl = connections.migrationUrl; });
  afterAll(async () => {
    await db.aIPractice.deleteMany({ where: { accountId: { in: accounts } } });
    await db.aIMessage.deleteMany({ where: { accountId: { in: accounts } } });
    await db.aIConversation.deleteMany({ where: { accountId: { in: accounts } } });
    await db.account.deleteMany({ where: { id: { in: accounts } } });
    await db.$disconnect(); await migrator.$disconnect();
  });
  it('full reviewed chain rolls back its DDL and all 27 tables before test-target apply', async () => {
    await assertMigrationRollback(migrationUrl, migrator, ['20261011002000_db01', '20261011010000_db02',
      '20261011020000_db05', '20261011030000_db03', '20261011040000_db04',
      '20261011041000_db04_history_guard', '20261011043000_db05_practice_message',
      '20261011044000_db05_practice_message_lock'], 27);
  });
  it('records exact applied checksum and allows general conversation without a fabricated Course', async () => {
    await assertMigration(migrator, '20261011043000_db05_practice_message');
    await assertMigration(migrator, '20261011044000_db05_practice_message_lock');
    for (let index = 0; index < 2; index++) {
      accounts.push((await db.account.create({ data: { displayName: tag + index } })).id);
      conversations.push((await db.aIConversation.create({ data: { accountId: accounts[index], courseId: null,
        title: tag, contextSnapshot: { kind: 'general' } } })).id);
    }
    expect((await db.aIConversation.findUniqueOrThrow({ where: { id: conversations[0] } })).courseId).toBeNull();
    await expect(db.aIConversation.create({ data: { accountId: accounts[0], courseId: randomUUID(), contextSnapshot: {} } })).rejects.toThrow();
  });
  it('links one practice to its own assistant message; foreign owner/conversation, user message and duplicate are rejected', async () => {
    for (let index = 0; index < 2; index++) messages.push((await db.aIMessage.create({ data: {
      accountId: accounts[index], conversationId: conversations[index], position: 0, role: 'assistant', content: 'ฝึก', contextSnapshot: {} } })).id);
    const userMessage = await db.aIMessage.create({ data: { accountId: accounts[0], conversationId: conversations[0], position: 1,
      role: 'user', content: 'สร้างชุดฝึก', contextSnapshot: {} } });
    const base = { accountId: accounts[0], conversationId: conversations[0], payloadSnapshot: { version: 1, questions: [] } };
    await db.aIPractice.create({ data: { ...base, messageId: messages[0] } });
    await expect(db.aIPractice.create({ data: { ...base, messageId: messages[0] } })).rejects.toThrow();
    await expect(db.aIPractice.create({ data: { ...base, messageId: messages[1] } })).rejects.toThrow();
    await expect(db.aIPractice.create({ data: { ...base, messageId: userMessage.id } })).rejects.toThrow();
    expect(await db.aIPractice.count({ where: { accountId: accounts[0] } })).toBe(1);
  });
  it('holds snapshot/message identity immutable and retains unlinked legacy rows without guessing a backfill', async () => {
    const practice = await db.aIPractice.findUniqueOrThrow({ where: { messageId: messages[0] } });
    await expect(db.aIPractice.update({ where: { id: practice.id }, data: { messageId: null } })).rejects.toThrow();
    await expect(db.aIPractice.update({ where: { id: practice.id }, data: { payloadSnapshot: {} } })).rejects.toThrow();
    await expect(db.aIMessage.update({ where: { id: messages[0] }, data: { role: 'user' } })).rejects.toThrow();
    await expect(db.aIMessage.update({ where: { id: messages[0] }, data: { conversationId: conversations[1] } })).rejects.toThrow();
    const legacy = await db.aIPractice.create({ data: { accountId: accounts[0], conversationId: conversations[0], payloadSnapshot: {} } });
    expect(legacy.messageId).toBeNull();
    await expect(db.aIPractice.update({ where: { id: legacy.id }, data: { messageId: messages[0] } })).rejects.toThrow();
    expect((await db.aIPractice.findUniqueOrThrow({ where: { id: legacy.id } })).messageId).toBeNull();
  });
  it.each(['practice-first', 'role-first'])('serializes message role and practice creation in %s order', async order => {
    const message = await db.aIMessage.create({ data: { accountId: accounts[0], conversationId: conversations[0],
      position: order === 'practice-first' ? 2 : 3, role: 'assistant', content: 'ฝึกพร้อมกัน', contextSnapshot: {} } });
    const practiceData = { accountId: accounts[0], conversationId: conversations[0], messageId: message.id, payloadSnapshot: {} };
    let release!: () => void, ready!: () => void, started!: () => void, pid!: number;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const holding = new Promise<void>(resolve => { ready = resolve; });
    const contending = new Promise<void>(resolve => { started = resolve; });
    const first = db.$transaction(async tx => {
      if (order === 'practice-first') await tx.aIPractice.create({ data: practiceData });
      else await tx.aIMessage.update({ where: { id: message.id }, data: { role: 'user' } });
      ready(); await gate;
    }, { timeout: 15000 });
    await holding;
    const second = db.$transaction(async tx => {
      pid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid; started();
      if (order === 'practice-first') await tx.aIMessage.update({ where: { id: message.id }, data: { role: 'user' } });
      else await tx.aIPractice.create({ data: practiceData });
    }, { timeout: 15000 }).then(() => ({ succeeded: true }), () => ({ succeeded: false }));
    await contending;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await migrator.$queryRaw<Array<{ blocked: boolean }>>`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`)[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true); release(); await first;
      expect((await second).succeeded).toBe(false);
      const storedMessage = await db.aIMessage.findUniqueOrThrow({ where: { id: message.id } });
      const storedPractice = await db.aIPractice.findUnique({ where: { messageId: message.id } });
      if (order === 'practice-first') { expect(storedMessage.role).toBe('assistant'); expect(storedPractice).not.toBeNull(); }
      else { expect(storedMessage.role).toBe('user'); expect(storedPractice).toBeNull(); }
    } finally { release(); await Promise.allSettled([first, second]); }
  });
});
