import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import request = require('supertest');
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { testConnections } from '../support/postgres';
import { assertErrorContract } from '../support/contract-validator';

describe('PROVIDER-STRIPE-01 receiver real HTTP / Test PostgreSQL', () => {
  let db: PrismaClient, migrator: PrismaClient, app: INestApplication;
  const tag = 'evt_receiver_' + randomUUID().replaceAll('-', '');
  const secret = 'whsec_receiver_fixture_only';
  const path = '/api/v1/webhooks/stripe';
  const previous = { url: process.env.DATABASE_URL, secret: process.env.STRIPE_WEBHOOK_SECRET, mode: process.env.STRIPE_WEBHOOK_MODE };
  let initialCounts: number[];
  function event(suffix: string) {
    return { id: tag + suffix, object: 'event', type: 'checkout.session.completed', created: 1,
      api_version: '2026-09-30.clover', livemode: false, pending_webhooks: 5, data: { object: {
        id: 'cs_test_' + tag + suffix, object: 'checkout.session', mode: 'payment', status: 'complete',
        payment_status: 'paid', amount_total: 12000, currency: 'thb', payment_intent: 'pi_test_fixture',
        metadata: { user_id: 'FORGED_USER', course_id: 'FORGED_COURSE' },
        customer_details: { email: 'PRIVATE_CUSTOMER@example.invalid' }, client_secret: 'PRIVATE_PROVIDER_SECRET',
      } } };
  }
  function signature(body: string | Buffer, timestamp = Math.floor(Date.now() / 1000)) {
    return `t=${timestamp},v1=${createHmac('sha256', secret).update(timestamp + '.').update(body).digest('hex')}`;
  }
  function send(body: string, header = signature(body)) {
    return request(app.getHttpServer()).post(path).set('Content-Type', 'application/json').set('Stripe-Signature', header).send(body);
  }
  async function counts() {
    return Promise.all([db.payment.count(), db.enrollment.count(), db.appSession.count(), db.progress.count()]);
  }
  beforeAll(async () => {
    const connections = testConnections(); db = connections.runtime; migrator = connections.migrator;
    process.env.DATABASE_URL = connections.runtimeUrl; process.env.STRIPE_WEBHOOK_SECRET = secret; process.env.STRIPE_WEBHOOK_MODE = 'test';
    initialCounts = await counts();
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApplication(app, []); await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    for (const [key, value] of Object.entries({ DATABASE_URL: previous.url, STRIPE_WEBHOOK_SECRET: previous.secret, STRIPE_WEBHOOK_MODE: previous.mode })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    if (db) { await db.paymentEvent.deleteMany({ where: { eventId: { startsWith: tag } } }); await db.$disconnect(); }
    if (migrator) await migrator.$disconnect();
  });
  it('verifies original whitespace/UTF-8 bytes before decoding and durably receives without a browser session', async () => {
    const payload = event('_original'); payload.data.object.metadata.user_id = 'ทดสอบ';
    const body = JSON.stringify(payload, null, 2);
    const response = await send(body).expect(503);
    expect(response.body).toEqual({ received: true, processing: 'pending' });
    expect(response.headers['retry-after']).toBe('60');
    const stored = await db.paymentEvent.findUniqueOrThrow({ where: { eventId: payload.id } });
    expect(stored).toMatchObject({ type: payload.type, checkoutSessionId: payload.data.object.id, paymentId: null, status: 'received', processedAt: null });
    expect(stored.eventSnapshot).toMatchObject({ receipt_version: 1, event: { created: 1, livemode: false }, object: { amount_total: 12000, payment_status: 'paid' } });
    for (const privateValue of ['PRIVATE_CUSTOMER', 'PRIVATE_PROVIDER_SECRET', 'FORGED_COURSE', 'ทดสอบ', secret]) {
      expect(JSON.stringify(stored.eventSnapshot) + JSON.stringify(response.body)).not.toContain(privateValue);
    }
  });
  it('rejects forged/tampered/missing/expired/future signatures without persistence', async () => {
    const body = JSON.stringify(event('_invalid'));
    const invalid = await send(body, `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`).expect(400);
    assertErrorContract(invalid.body);
    await send(body + ' ', signature(body)).expect(400);
    await request(app.getHttpServer()).post(path).set('Content-Type', 'application/json').send(body).expect(400);
    await send(body, signature(body, Math.floor(Date.now() / 1000) - 600)).expect(400);
    await send(body, signature(body, Math.floor(Date.now() / 1000) + 600)).expect(400);
    expect(await db.paymentEvent.count({ where: { eventId: tag + '_invalid' } })).toBe(0);
  });
  it('fails closed for missing signing secret / invalid mode, and never substitutes the Stripe API key', async () => {
    const body = JSON.stringify(event('_config'));
    try {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      expect((await send(body).expect(503)).body.received).toBe(false);
      process.env.STRIPE_WEBHOOK_SECRET = 'sk_test_not_a_signing_secret';
      expect((await send(body).expect(503)).body.received).toBe(false);
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_';
      expect((await send(body).expect(503)).body.received).toBe(false);
      process.env.STRIPE_WEBHOOK_SECRET = secret; process.env.STRIPE_WEBHOOK_MODE = 'typo';
      await send(body).expect(503);
    } finally { process.env.STRIPE_WEBHOOK_SECRET = secret; process.env.STRIPE_WEBHOOK_MODE = 'test'; }
    expect(await db.paymentEvent.count({ where: { eventId: tag + '_config' } })).toBe(0);
  });
  it('rejects signed malformed JSON, invalid envelopes, live-mode mismatch and Connect events', async () => {
    await send('{').expect(400);
    for (const delta of [{ object: 'thin' }, { livemode: true }, { created: -1 }, { data: { object: {} } }, { account: 'acct_unapproved' }, { context: 'unapproved' }]) {
      await send(JSON.stringify({ ...event('_shape'), ...delta })).expect(400);
    }
    expect(await db.paymentEvent.count({ where: { eventId: tag + '_shape' } })).toBe(0);
  });
  it('deduplicates concurrent fresh signed deliveries and preserves the first receipt across reconnect', async () => {
    const payload = event('_duplicate'), body = JSON.stringify(payload);
    const responses = await Promise.all(Array.from({ length: 5 }, () => send(body)));
    expect(responses.map(response => response.status)).toEqual([503, 503, 503, 503, 503]);
    const before = await db.paymentEvent.findUniqueOrThrow({ where: { eventId: payload.id } });
    // Fresh signature over equivalent JSON with reordered keys/new whitespace.
    const reordered = Object.fromEntries(Object.entries({ ...payload, pending_webhooks: 0 }).reverse());
    await send(JSON.stringify(reordered, null, 2)).expect(503);
    await db.$disconnect(); await db.$connect();
    expect(await db.paymentEvent.findUniqueOrThrow({ where: { eventId: payload.id } })).toEqual(before);
    expect(await db.paymentEvent.count({ where: { eventId: payload.id } })).toBe(1);
  });
  it('rejects event-ID reuse with a different signed payload without overwriting proof', async () => {
    const payload = event('_collision'); await send(JSON.stringify(payload)).expect(503);
    const before = await db.paymentEvent.findUniqueOrThrow({ where: { eventId: payload.id } });
    payload.data.object.amount_total = 1;
    const collision = await send(JSON.stringify(payload)).expect(409);
    assertErrorContract(collision.body);
    expect(await db.paymentEvent.findUniqueOrThrow({ where: { eventId: payload.id } })).toEqual(before);
  });
  it('only ACKs an already processed event, preserving failed/pending state for retries', async () => {
    const payload = event('_processed'), body = JSON.stringify(payload);
    await send(body).expect(503);
    await db.paymentEvent.update({ where: { eventId: payload.id }, data: { status: 'failed', errorCode: 'fixture_failure' } });
    await send(body).expect(503);
    expect((await db.paymentEvent.findUniqueOrThrow({ where: { eventId: payload.id } })).errorCode).toBe('fixture_failure');
    // Simulates a future owning processor's terminal record; receiver cannot set it.
    await db.paymentEvent.update({ where: { eventId: payload.id }, data: { status: 'processed', processedAt: new Date(), errorCode: null } });
    expect((await send(body).expect(200)).body).toEqual({ received: true });
  });
  it('enforces raw JSON media type, size and no compression before persistence', async () => {
    const body = JSON.stringify(event('_parser'));
    await request(app.getHttpServer()).post(path).set('Content-Type', 'text/plain').set('Stripe-Signature', signature(body)).send(body).expect(400);
    await request(app.getHttpServer()).post(path).set('Content-Type', 'application/json').send(' '.repeat(102401)).expect(413);
    await request(app.getHttpServer()).post(path).set('Content-Type', 'application/json').set('Content-Encoding', 'gzip').send(gzipSync(body)).expect(415);
    expect(await db.paymentEvent.count({ where: { eventId: tag + '_parser' } })).toBe(0);
  });
  it('fails with a retryable response when PostgreSQL cannot durably store a verified event', async () => {
    const { PrismaService } = await import('../../src/prisma/prisma.service');
    const spy = jest.spyOn(app.get(PrismaService), '$executeRaw').mockRejectedValueOnce(new Error('PRIVATE_DB_DIAGNOSTIC'));
    const logs = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const response = await send(JSON.stringify(event('_failure'))).expect(500);
      expect(JSON.stringify(response.body) + JSON.stringify(logs.mock.calls)).not.toContain('PRIVATE_DB_DIAGNOSTIC');
      expect(await db.paymentEvent.count({ where: { eventId: tag + '_failure' } })).toBe(0);
    } finally { spy.mockRestore(); logs.mockRestore(); }
  });
  it('never grants entitlements or changes financial/session/academic state while receiving', async () => {
    expect(await counts()).toEqual(initialCounts);
  });
});
