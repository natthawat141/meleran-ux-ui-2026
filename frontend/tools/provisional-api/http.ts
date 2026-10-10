// PROVISIONAL MOCK — development and tests only.
//
// Request/response plumbing shared by every flow module: routes, the request context, the error envelope
// (draft D6), and small validation/pagination/permission helpers. Nothing here is a contract.

import type { Clock, CourseRecord, Db, Role, UserRecord } from './db.ts';

export function sessionCookieNameForApp(app: string | null): string {
  return app === 'web' || app === 'admin' ? `melearn_mock_session_${app}` : 'melearn_mock_session';
}

export interface FieldError { field: string; code: string }

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  headers: Record<string, string> | undefined;
  constructor(status: number, code: string, message: string, options?: { fields?: FieldError[]; details?: Record<string, unknown>; headers?: Record<string, string> }) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = options?.fields ? { ...options.details, fields: options.fields } : options?.details;
    this.headers = options?.headers;
  }
}

export interface MockConfig {
  /** Draft D7 defaults. */
  defaultPageSize: number;
  maxPageSize: number;
  /** Scope 5.8: verification links live 24 hours. */
  verificationLinkHours: number;
  /** [รอ Backend] reset link lifetime. The mock picks one hour. */
  resetLinkMinutes: number;
  /** [รอ Backend] minimum interval between resend/reset emails. The mock picks 60 seconds. */
  emailCooldownSeconds: number;
  /** Scope 6.11: AI_DAILY_PROMPT_LIMIT. */
  aiDailyPromptLimit: number;
  /** Mock stand-in for the Stripe-Signature check on the webhook route. */
  stripeWebhookSignature: string;
}

export const defaultMockConfig: MockConfig = {
  defaultPageSize: 20,
  maxPageSize: 50,
  verificationLinkHours: 24,
  resetLinkMinutes: 60,
  emailCooldownSeconds: 60,
  aiDailyPromptLimit: 20,
  stripeWebhookSignature: 'mock-stripe-signature-valid',
};

export interface RequestContext {
  db: Db;
  clock: Clock;
  config: MockConfig;
  /** Prefix the client was configured with; used to build redirect and checkout URLs. */
  basePath: string;
  method: string;
  path: string;
  query: URLSearchParams;
  params: Record<string, string>;
  headers: Headers;
  /** Raw request text. The Stripe webhook verifies the signature against this, not against parsed JSON. */
  rawBody: string;
  /** Parsed JSON body, or undefined when the request had no body. Use readObject() to require an object. */
  body: unknown;
  /** The account behind the session cookie, or null for a guest. */
  principal: UserRecord | null;
  audience: 'web' | 'admin' | null;
  sessionId: string | null;
  requestId: string;
}

export interface HandlerResult { status: number; body?: unknown; headers?: Record<string, string> }
export type Handler = (context: RequestContext) => HandlerResult | Promise<HandlerResult>;
export interface Route { method: string; path: string; handler: Handler }

export const ok = (body: unknown, headers?: Record<string, string>): HandlerResult => ({ status: 200, body, headers });
export const created = (body: unknown, headers?: Record<string, string>): HandlerResult => ({ status: 201, body, headers });
export const accepted = (body: unknown): HandlerResult => ({ status: 202, body });
export const noContent = (headers?: Record<string, string>): HandlerResult => ({ status: 204, headers });

export const notFound = (): ApiError => new ApiError(404, 'not_found', 'ไม่พบข้อมูลที่ขอ');

export function requireUser(context: RequestContext): UserRecord {
  if (!context.principal) throw new ApiError(401, 'unauthenticated', 'กรุณาเข้าสู่ระบบ');
  return context.principal;
}

export function requireRole(context: RequestContext, role: Role): UserRecord {
  const user = requireUser(context);
  if (!user.roles.includes(role)) throw new ApiError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานส่วนนี้');
  return user;
}

/** Scope 2.1: self-registered accounts must verify email; Google and Admin-created accounts are exempt. */
export function isLearningEligible(user: UserRecord): boolean {
  return user.origin !== 'self_email' || user.email_verified;
}

export function requireEligible(context: RequestContext): UserRecord {
  const user = requireUser(context);
  if (!isLearningEligible(user)) throw new ApiError(403, 'email_not_verified', 'กรุณายืนยันอีเมลก่อนดำเนินการ');
  return user;
}

export const canManageCourse = (user: UserRecord, course: CourseRecord): boolean =>
  user.roles.includes('admin') || (user.roles.includes('instructor') && course.instructor_id === user.id);

/** Object body or a 422 with a single field problem. */
export function readObject(context: RequestContext): Record<string, unknown> {
  const body = context.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(422, 'validation_failed', 'ข้อมูลที่ส่งไม่ถูกต้อง', { fields: [{ field: 'body', code: 'object_required' }] });
  }
  return body as Record<string, unknown>;
}

/** Rejects names that are not in `allowed`, so a Client cannot smuggle fields such as `roles` or `price`. */
export function rejectUnknownFields(body: Record<string, unknown>, allowed: readonly string[]): void {
  const fields = Object.keys(body).filter((name) => !allowed.includes(name)).map((field) => ({ field, code: 'unsupported' }));
  if (fields.length) throw new ApiError(422, 'validation_failed', 'ข้อมูลที่ส่งไม่ถูกต้อง', { fields });
}

export function validationFailed(fields: FieldError[]): ApiError {
  return new ApiError(422, 'validation_failed', 'ข้อมูลที่ส่งไม่ถูกต้อง', { fields });
}

export function requiredString(body: Record<string, unknown>, field: string, problems: FieldError[], options?: { max?: number; min?: number }): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push({ field, code: 'required' });
    return '';
  }
  const text = value.trim();
  if (options?.max !== undefined && text.length > options.max) problems.push({ field, code: 'too_long' });
  if (options?.min !== undefined && text.length < options.min) problems.push({ field, code: 'too_short' });
  return text;
}

export function optionalString(body: Record<string, unknown>, field: string, problems: FieldError[], options?: { max?: number }): string | null | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (value === null) return null;
  if (typeof value !== 'string') {
    problems.push({ field, code: 'invalid' });
    return undefined;
  }
  const text = value.trim();
  if (options?.max !== undefined && text.length > options.max) problems.push({ field, code: 'too_long' });
  return text === '' ? null : text;
}

export interface Page<T> { items: T[]; next_cursor: string | null }

/** Draft D7 cursor pagination. The cursor is opaque to clients; the mock encodes an offset. */
export function paginate<T>(items: readonly T[], query: URLSearchParams, config: MockConfig, extraProblems: FieldError[] = []): Page<T> {
  const problems = [...extraProblems];
  let limit = config.defaultPageSize;
  const limitText = query.get('limit');
  if (limitText !== null) {
    limit = /^\d{1,4}$/.test(limitText) ? Number(limitText) : 0;
    if (limit < 1 || limit > config.maxPageSize) problems.push({ field: 'limit', code: 'out_of_range' });
  }
  let offset = 0;
  const cursor = query.get('cursor');
  if (cursor !== null) {
    const match = /^o:(\d{1,6})$/.exec(cursor);
    if (match) offset = Number(match[1]);
    else problems.push({ field: 'cursor', code: 'invalid' });
  }
  if (problems.length) throw validationFailed(problems);
  const next = offset + limit;
  return { items: items.slice(offset, next), next_cursor: next < items.length ? `o:${next}` : null };
}

/** Reports names outside `allowed` and names given more than once, in order of appearance. */
export function queryProblems(query: URLSearchParams, allowed: readonly string[]): FieldError[] {
  const problems: FieldError[] = [];
  for (const name of new Set(query.keys())) {
    if (!allowed.includes(name)) problems.push({ field: name, code: 'unsupported' });
    else if (query.getAll(name).length > 1) problems.push({ field: name, code: 'duplicate' });
  }
  return problems;
}

/** Bangkok calendar date (YYYY-MM-DD) for the quota rule (scope 6.11). Thailand has no daylight saving. */
export function bangkokDate(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
