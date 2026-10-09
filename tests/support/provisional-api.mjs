// Test helpers for the provisional API mock (tools/provisional-api). Tests only.
import { createProvisionalApi, mockPassword } from '../../tools/provisional-api/index.ts';
import { assertContractResponse } from './contract-validator.mjs';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

export const basePath = '/mock-api/v1';
export { mockPassword };

/** A fresh mock server plus a helper that behaves like one browser (own cookie jar). */
export function createWorld(options = {}) {
  const api = createProvisionalApi({ environment: 'test', basePath, ...options });
  return { api, db: api.db, clock: api.clock, outbox: api.outbox, browser: () => createBrowser(api) };
}

/** One "browser": calls return `{ status, headers, body, text }` and never throw on HTTP errors. */
export function createBrowser(api) {
  const fetcher = api.createFetcher();
  const call = async (method, path, body, headers = {}) => {
    const init = { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers } };
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
    const response = await fetcher(`${basePath}/${path}`, init);
    const text = await response.text();
    let json;
    try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
    const result = { status: response.status, headers: response.headers, text, body: json };
    assertContractResponse(method,path,result);
    // Opt-in extraction from synthetic test fixtures only. Never capture cookies/headers.
    if (process.env.MELEARN_CONTRACT_FIXTURES) {
      appendFileSync(join(process.env.MELEARN_CONTRACT_FIXTURES,`${process.pid}.jsonl`),
        JSON.stringify({ method,path,request:body,response:json,status:response.status })+'\n');
    }
    return result;
  };
  return {
    fetcher,
    call,
    get: (path, headers) => call('GET', path, undefined, headers),
    post: (path, body, headers) => call('POST', path, body, headers),
    put: (path, body, headers) => call('PUT', path, body, headers),
    patch: (path, body, headers) => call('PATCH', path, body, headers),
    del: (path, headers) => call('DELETE', path, undefined, headers),
    /** Logs in and asserts success. Defaults to the shared seed password and the web audience. */
    async login(identifier, { password = mockPassword, audience = 'web' } = {}) {
      const result = await call('POST', 'auth/login', { identifier, password, audience });
      if (result.status !== 200) throw new Error(`login as ${identifier} failed: ${result.status} ${result.text}`);
      return result.body.user;
    },
  };
}

/** Seeded accounts (see tools/provisional-api/seed.ts). All share `mockPassword`. */
export const accounts = {
  admin: 'admin',
  instructorA: 'instructor-a@example.test', // owns crs_mock_001, crs_mock_003, crs_mock_draft
  instructorB: 'instructor-b@example.test', // owns crs_mock_002, crs_mock_pending, crs_mock_approved
  learner: 'learner@example.test',
  unverified: 'unverified@example.test',
  adminCreatedLearner: 'learner-admin',
};
