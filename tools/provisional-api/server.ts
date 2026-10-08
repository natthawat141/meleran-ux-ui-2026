// PROVISIONAL MOCK — development and tests only.
//
// A fetch-compatible stand-in for the Backend that does not exist yet. `createProvisionalApi` returns an
// in-memory server plus `createFetcher()`, which gives each caller its own "browser" (its own cookie jar), so
// Web and Admin sessions are independent exactly as draft D2 assumes. The fetcher is meant to be injected as
// the `fetcher` of createHttpClient from @melearn/api-client.
//
// Guard rails:
// - Creation throws outside the `development` and `test` environments.
// - Nothing in apps/ or packages/ may import this directory (tests/provisional-api-boundary.test.mjs enforces it).
// - It proves nothing about a real Backend. Every route, field and rule is a draft or a mock-only assumption
//   listed in docs/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md §8 and docs/PROVISIONAL_API_MOCK_TH.md.

import type { Clock, Db, OutboxEmail } from './db.ts';
import { createClock, createEmptyDb } from './db.ts';
import { ApiError, defaultMockConfig, sessionCookieNameForApp } from './http.ts';
import type { HandlerResult, MockConfig, RequestContext, Route } from './http.ts';
import { seedDefaultData } from './seed.ts';
import { authRoutes } from './flow-a-auth.ts';
import { catalogRoutes } from './flow-b-catalog.ts';
import { learningRoutes } from './flow-c-learning.ts';
import { assessmentRoutes } from './flow-d-assessment.ts';
import { authoringRoutes } from './flow-e-authoring.ts';
import { paymentRoutes, createStripeSimulator, createDevStripeSimulationRoutes } from './flow-f-payments.ts';
import { aiRoutes } from './flow-g-ai.ts';
import { blogRoutes } from './flow-h-blog.ts';

export const sessionCookieName = 'melearn_mock_session';
const allowedEnvironments: readonly string[] = ['development', 'test'];
// Parsing-only origin; never used to reach a network.
const parsingOrigin = 'https://provisional-mock.invalid';

export interface ProvisionalApiOptions {
  /** Pass the real environment name; anything other than `development` or `test` throws. */
  environment: string | null | undefined;
  /** Path prefix the HTTP client was configured with, for example `/mock-api/v1`. */
  basePath: string;
  now?: Date;
  config?: Partial<MockConfig>;
  /** `empty` starts with no data at all; tests that need a specific world build it through `db`. */
  seed?: 'default' | 'empty';
}

export interface ProvisionalApi {
  /** A fetch client with an isolated cookie jar, optionally hydrated from an HTTP Cookie header. */
  createFetcher(options?: { cookieHeader?: string }): typeof fetch;
  db: Db;
  clock: Clock;
  config: MockConfig;
  /** Stand-in for Resend: read link tokens here. */
  outbox: readonly OutboxEmail[];
  /** Bugs in the mock itself (an exception that was not an ApiError). Tests should assert this stays empty. */
  unexpectedErrors: unknown[];
  stripe: ReturnType<typeof createStripeSimulator>;
}

const allRoutes: readonly Route[] = [
  ...authRoutes, ...catalogRoutes, ...learningRoutes, ...assessmentRoutes,
  ...authoringRoutes, ...paymentRoutes, ...aiRoutes, ...blogRoutes,
];

function matchPath(pattern: string, segments: string[]): Record<string, string> | null {
  const parts = pattern.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of parts.entries()) {
    if (part.startsWith(':')) params[part.slice(1)] = segments[index];
    else if (part !== segments[index]) return null;
  }
  return params;
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const responseHeaders = new Headers({ 'x-melearn-mock': 'provisional-api', ...headers });
  if (status === 204 || body === undefined) return new Response(null, { status, headers: responseHeaders });
  responseHeaders.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function createProvisionalApi(options: ProvisionalApiOptions): ProvisionalApi {
  if (typeof options.environment !== 'string' || !allowedEnvironments.includes(options.environment)) {
    throw new Error('The provisional API mock can only be created in the development or test environment.');
  }
  const prefix = options.basePath.replace(/\/+$/, '');
  const clock = createClock(options.now);
  const db = createEmptyDb();
  const config: MockConfig = { ...defaultMockConfig, ...options.config };
  if ((options.seed ?? 'default') === 'default') seedDefaultData(db);
  const unexpectedErrors: unknown[] = [];
  let requestCounter = 0;
  const stripe = createStripeSimulator(db, clock, config);
  const routes = options.environment === 'development' ? [...allRoutes, ...createDevStripeSimulationRoutes(stripe)] : allRoutes;

  const errorBody = (error: ApiError, requestId: string) => ({
    error: { code: error.code, message: error.message, request_id: requestId, ...(error.details ? { details: error.details } : {}) },
  });

  const handle = async (request: { method: string; url: URL; headers: Headers; rawBody: string }, jar: Map<string, string>): Promise<Response> => {
    requestCounter += 1;
    const requestId = `mock-request-${requestCounter}`;
    const fail = (error: ApiError) => jsonResponse(error.status, errorBody(error, requestId), error.headers);
    try {
      const { url } = request;
      if (prefix && url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) throw new ApiError(404, 'not_found', 'ไม่พบข้อมูลที่ขอ');
      let segments: string[];
      try {
        segments = url.pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '').split('/').map(decodeURIComponent);
      } catch {
        throw new ApiError(404, 'not_found', 'ไม่พบข้อมูลที่ขอ');
      }

      let params: Record<string, string> | null = null;
      let matched: Route | undefined;
      let pathMatched = false;
      for (const route of routes) {
        const candidate = matchPath(route.path, segments);
        if (!candidate) continue;
        pathMatched = true;
        if (route.method === request.method) { matched = route; params = candidate; break; }
      }
      if (!matched || !params) {
        if (pathMatched) throw new ApiError(405, 'method_not_allowed', 'ไม่รองรับ method นี้');
        throw new ApiError(404, 'not_found', 'ไม่พบข้อมูลที่ขอ');
      }

      let body: unknown;
      if (request.rawBody !== '') {
        try {
          body = JSON.parse(request.rawBody);
        } catch {
          throw new ApiError(422, 'validation_failed', 'ข้อมูลที่ส่งไม่ถูกต้อง', { fields: [{ field: 'body', code: 'invalid_json' }] });
        }
      }

      const sessionId = jar.get(sessionCookieNameForApp(request.headers.get('x-melearn-app'))) ?? null;
      const session = sessionId ? db.sessions.get(sessionId) ?? null : null;
      const principal = session ? db.users.get(session.user_id) ?? null : null;
      const context: RequestContext = {
        db, clock, config, basePath: prefix, method: request.method, path: url.pathname, query: url.searchParams, params,
        headers: request.headers, rawBody: request.rawBody, body, principal: principal ? principal : null,
        audience: principal && session ? session.audience : null, sessionId: principal ? sessionId : null, requestId,
      };
      const result: HandlerResult = await matched.handler(context);
      const setCookie = result.headers?.['set-cookie'];
      if (setCookie) applySetCookie(jar, setCookie);
      const { 'set-cookie': _ignored, ...otherHeaders } = result.headers ?? {};
      const headers = new Headers({ 'x-melearn-mock': 'provisional-api', ...otherHeaders });
      if (setCookie) headers.append('set-cookie', setCookie);
      if (result.status === 204 || result.body === undefined) return new Response(null, { status: result.status, headers });
      headers.set('content-type', 'application/json');
      return new Response(JSON.stringify(result.body), { status: result.status, headers });
    } catch (error) {
      if (error instanceof ApiError) return fail(error);
      unexpectedErrors.push(error);
      return fail(new ApiError(500, 'mock_internal_error', 'ข้อผิดพลาดภายในของ mock'));
    }
  };

  const createFetcher = (options: { cookieHeader?: string } = {}): typeof fetch => {
    const jar = new Map<string, string>();
    for (const part of (options.cookieHeader ?? '').split(';')) {
      const separator = part.indexOf('=');
      if (separator > 0) jar.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
    }
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = input instanceof Request ? input : undefined;
      const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
      const signal = init?.signal ?? request?.signal;
      if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const headers = new Headers(request?.headers);
      for (const [name, value] of new Headers(init?.headers).entries()) headers.set(name, value);
      let rawBody = '';
      if (typeof init?.body === 'string') rawBody = init.body;
      else if (init?.body !== undefined && init.body !== null) throw new TypeError('The provisional API mock accepts string request bodies only.');
      else if (request && method !== 'GET' && method !== 'HEAD') rawBody = await request.clone().text();
      return handle({ method, url: new URL(href, parsingOrigin), headers, rawBody }, jar);
    };
    return fetcher as typeof fetch;
  };

  return { createFetcher, db, clock, config, outbox: db.outbox, unexpectedErrors, stripe };
}

/** Minimal cookie-jar behaviour: `name=value`, and `Max-Age=0` or an empty value clears the cookie. */
function applySetCookie(jar: Map<string, string>, header: string): void {
  const [pair, ...attributes] = header.split(';').map((part) => part.trim());
  const separator = pair.indexOf('=');
  if (separator <= 0) return;
  const name = pair.slice(0, separator);
  const value = pair.slice(separator + 1);
  const expired = attributes.some((attribute) => /^max-age=0$/i.test(attribute));
  if (expired || value === '') jar.delete(name);
  else jar.set(name, value);
}
