// PROVISIONAL MOCK — Flow A (Auth and Account), operations FA1–FA13 of
// docs/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md plus two clearly-marked proposals for the Admin gap in §3.4
// (`GET /admin/users`, `GET /admin/instructors`). Draft, not a contract.
//
// Mock-only assumptions (each is a Backend question):
// - Registration does not create a session; the user logs in afterwards (scope: "Login ได้ แต่ยังทำธุรกรรมไม่ได้").
// - A used verification link answers `200 already_verified`; an expired one `410`.
// - Resend accepts a session or `{ email }`, and always answers 202 (draft D10); cooldown is 60 seconds.
// - Password policy is "at least 8 characters"; a password reset ends every session of that user.
// - The Google provider is simulated by `mock_google_*` query/body fields; no OAuth happens.

import type { Clock, Db, OutboxEmail, TokenRecord, UserRecord } from './db.ts';
import { iso, nextId } from './db.ts';
import { toCurrentUser } from './domain.ts';
import {
  ApiError, accepted, created, noContent, notFound, ok, optionalString, paginate, queryProblems, readObject,
  rejectUnknownFields, requireRole, requireUser, requiredString, validationFailed,
} from './http.ts';
import type { FieldError, HandlerResult, MockConfig, RequestContext, Route } from './http.ts';

const sessionCookie = 'melearn_mock_session';
const minPasswordLength = 8;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-z0-9._-]{3,32}$/;
const sessionCookieAttributes = 'HttpOnly; Path=/; SameSite=Lax';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

function findByEmail(db: Db, email: string): UserRecord | undefined {
  const wanted = normalizeEmail(email);
  for (const user of db.users.values()) if (user.email && normalizeEmail(user.email) === wanted) return user;
  return undefined;
}

function findByUsername(db: Db, username: string): UserRecord | undefined {
  const wanted = username.trim().toLowerCase();
  for (const user of db.users.values()) if (user.username && user.username.toLowerCase() === wanted) return user;
  return undefined;
}

function findByIdentifier(db: Db, identifier: string): UserRecord | undefined {
  return findByUsername(db, identifier) ?? findByEmail(db, identifier);
}

function checkPassword(value: unknown, problems: FieldError[], field: string): string {
  if (typeof value !== 'string' || value === '') { problems.push({ field, code: 'required' }); return ''; }
  if (value.length < minPasswordLength) problems.push({ field, code: 'too_short' });
  if (value.length > 128) problems.push({ field, code: 'too_long' });
  return value;
}

/** Throws 429 with Retry-After when the same key was used within the cooldown; otherwise records the use. */
function takeCooldown(db: Db, clock: Clock, config: MockConfig, key: string): void {
  const last = db.rateLimits.get(key);
  const now = clock.now().getTime();
  if (last) {
    const elapsed = (now - new Date(last).getTime()) / 1000;
    if (elapsed < config.emailCooldownSeconds) {
      const retryAfter = Math.ceil(config.emailCooldownSeconds - elapsed);
      throw new ApiError(429, 'rate_limited', 'ขอบ่อยเกินไป กรุณารอสักครู่', { headers: { 'retry-after': String(retryAfter) }, details: { retry_after_seconds: retryAfter } });
    }
  }
  db.rateLimits.set(key, iso(clock.now()));
}

function sendLink(db: Db, clock: Clock, user: UserRecord, kind: OutboxEmail['kind'], lifetimeMs: number): void {
  if (!user.email) return;
  const token = `${kind === 'verify_email' ? 'verify' : 'reset'}-token-${nextId(db, 'tok').slice(4)}`;
  const record: TokenRecord = {
    token, kind, user_id: user.id, created_at: iso(clock.now()),
    expires_at: iso(new Date(clock.now().getTime() + lifetimeMs)), used_at: null,
  };
  db.tokens.set(token, record);
  db.outbox.push({ id: nextId(db, 'mail'), to: user.email, kind, token, sent_at: iso(clock.now()) });
}

const sendVerificationLink = (context: Pick<RequestContext, 'db' | 'clock' | 'config'>, user: UserRecord): void =>
  sendLink(context.db, context.clock, user, 'verify_email', context.config.verificationLinkHours * 3600 * 1000);

function startSession(context: RequestContext, user: UserRecord, audience: 'web' | 'admin'): string {
  const { db, clock } = context;
  if (context.sessionId) db.sessions.delete(context.sessionId);
  const id = nextId(db, 'ses');
  db.sessions.set(id, { id, user_id: user.id, audience, created_at: iso(clock.now()) });
  return `${sessionCookie}=${id}; ${sessionCookieAttributes}`;
}

const clearedSessionCookie = `${sessionCookie}=; Max-Age=0; ${sessionCookieAttributes}`;

/** Only same-app absolute paths are accepted as return targets (scope: no open redirects). */
function safeReturnPath(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/[\r\n]/.test(value)) return value;
  return '/';
}

function redirect(location: string, setCookie?: string): HandlerResult {
  return { status: 302, headers: { location, ...(setCookie ? { 'set-cookie': setCookie } : {}) } };
}

const withResult = (path: string, name: string, value: string): string => `${path}${path.includes('?') ? '&' : '?'}${name}=${value}`;

interface MockGoogleIdentity { subject: string | null; email: string | null; name: string | null; failed: boolean }

function mockGoogleFrom(source: URLSearchParams | Record<string, unknown>): MockGoogleIdentity {
  const read = (name: string): string | null => {
    const value = source instanceof URLSearchParams ? source.get(name) : source[name];
    return typeof value === 'string' && value !== '' ? value : null;
  };
  return { subject: read('mock_google_subject'), email: read('mock_google_email'), name: read('mock_google_name'), failed: read('mock_google_error') !== null };
}

function mockGoogleQuery(identity: MockGoogleIdentity, returnTo: string): string {
  const parts: string[] = [];
  if (identity.subject) parts.push(`mock_google_subject=${encodeURIComponent(identity.subject)}`);
  if (identity.email) parts.push(`mock_google_email=${encodeURIComponent(identity.email)}`);
  if (identity.name) parts.push(`mock_google_name=${encodeURIComponent(identity.name)}`);
  if (identity.failed) parts.push('mock_google_error=1');
  parts.push(`return_to=${encodeURIComponent(returnTo)}`);
  return parts.join('&');
}

export const authRoutes: Route[] = [
  {
    // FA1
    method: 'POST', path: 'auth/register',
    handler: (context) => {
      const { db, clock } = context;
      const body = readObject(context);
      rejectUnknownFields(body, ['display_name', 'email', 'password']);
      const problems: FieldError[] = [];
      const displayName = requiredString(body, 'display_name', problems, { max: 80 });
      const email = requiredString(body, 'email', problems, { max: 254 });
      if (email && !emailPattern.test(email)) problems.push({ field: 'email', code: 'invalid' });
      const password = checkPassword(body.password, problems, 'password');
      if (problems.length) throw validationFailed(problems);
      if (findByEmail(db, email)) throw new ApiError(409, 'email_taken', 'อีเมลนี้ถูกใช้แล้ว', { fields: [{ field: 'email', code: 'taken' }] });
      const user: UserRecord = {
        id: nextId(db, 'usr'), display_name: displayName, username: null, email, email_verified: false, avatar_url: null,
        roles: ['learner'], origin: 'self_email', password, google_subject: null, created_at: iso(clock.now()),
        created_by: null, instructor_added_by: null, instructor_added_at: null,
      };
      db.users.set(user.id, user);
      takeCooldown(db, clock, context.config, `verify-email:${normalizeEmail(email)}`);
      sendVerificationLink(context, user);
      return created({ user: toCurrentUser(user), verification_email: 'queued' });
    },
  },
  {
    // FA2
    method: 'POST', path: 'auth/verify-email',
    handler: (context) => {
      const { db, clock, principal } = context;
      const body = readObject(context);
      rejectUnknownFields(body, ['token']);
      const problems: FieldError[] = [];
      const token = requiredString(body, 'token', problems);
      if (problems.length) throw validationFailed(problems);
      const record = db.tokens.get(token);
      if (!record || record.kind !== 'verify_email') throw new ApiError(400, 'verification_link_invalid', 'ลิงก์ยืนยันอีเมลไม่ถูกต้อง');
      const user = db.users.get(record.user_id) as UserRecord;
      if (record.used_at) return ok({ status: 'already_verified' });
      if (new Date(record.expires_at).getTime() <= clock.now().getTime()) throw new ApiError(410, 'verification_link_expired', 'ลิงก์ยืนยันอีเมลหมดอายุ');
      record.used_at = iso(clock.now());
      user.email_verified = true;
      return ok({ status: 'verified', ...(principal?.id === user.id ? { user: toCurrentUser(user) } : {}) });
    },
  },
  {
    // FA3
    method: 'POST', path: 'auth/resend-verification-email',
    handler: (context) => {
      const { db, clock, config } = context;
      let target: UserRecord | undefined;
      let key: string;
      if (context.body !== undefined) {
        const body = readObject(context);
        rejectUnknownFields(body, ['email']);
        const problems: FieldError[] = [];
        const email = requiredString(body, 'email', problems, { max: 254 });
        if (problems.length) throw validationFailed(problems);
        key = `verify-email:${normalizeEmail(email)}`;
        target = findByEmail(db, email);
      } else {
        const user = requireUser(context);
        key = `verify-email:${normalizeEmail(user.email ?? user.id)}`;
        target = user;
      }
      takeCooldown(db, clock, config, key);
      // Same 202 whether or not the account exists or is already verified (draft D10).
      if (target && target.origin === 'self_email' && !target.email_verified) sendVerificationLink(context, target);
      return accepted({ status: 'accepted', retry_after_seconds: config.emailCooldownSeconds });
    },
  },
  {
    // FA4
    method: 'POST', path: 'auth/login',
    handler: (context) => {
      const { db } = context;
      const body = readObject(context);
      rejectUnknownFields(body, ['identifier', 'password', 'audience']);
      const problems: FieldError[] = [];
      const identifier = requiredString(body, 'identifier', problems);
      const password = typeof body.password === 'string' ? body.password : '';
      if (password === '') problems.push({ field: 'password', code: 'required' });
      const audience = body.audience;
      if (audience !== 'web' && audience !== 'admin') problems.push({ field: 'audience', code: 'invalid' });
      if (problems.length) throw validationFailed(problems);
      const user = findByIdentifier(db, identifier);
      // The same answer whether the account exists, has no password, or the password is wrong.
      if (!user || user.password === null || user.password !== password) throw new ApiError(401, 'credentials_invalid', 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
      if (audience === 'admin' && !user.roles.includes('admin')) throw new ApiError(403, 'audience_not_allowed', 'บัญชีนี้เข้าส่วนผู้ดูแลไม่ได้');
      const cookie = startSession(context, user, audience as 'web' | 'admin');
      return ok({ user: toCurrentUser(user) }, { 'set-cookie': cookie });
    },
  },
  {
    // FA5 (start): mock-only; a real server redirects the browser to Google.
    method: 'GET', path: 'auth/google/start',
    handler: ({ query, basePath }) => {
      const returnTo = safeReturnPath(query.get('return_to'));
      return redirect(`${basePath}/auth/google/callback?${mockGoogleQuery(mockGoogleFrom(query), returnTo)}`);
    },
  },
  {
    // FA5 (callback)
    method: 'GET', path: 'auth/google/callback',
    handler: (context) => {
      const { db, clock, query } = context;
      const returnTo = safeReturnPath(query.get('return_to'));
      const identity = mockGoogleFrom(query);
      if (identity.failed || !identity.subject || !identity.email) return redirect(withResult(returnTo, 'auth_result', 'failed'));
      let user = [...db.users.values()].find((candidate) => candidate.google_subject === identity.subject);
      if (!user) {
        // Never auto-merge by email (scope 2.1).
        if (findByEmail(db, identity.email)) return redirect(withResult(returnTo, 'auth_result', 'google_link_required'));
        user = {
          id: nextId(db, 'usr'), display_name: identity.name ?? identity.email, username: null, email: identity.email, email_verified: true,
          avatar_url: null, roles: ['learner'], origin: 'google', password: null, google_subject: identity.subject,
          created_at: iso(clock.now()), created_by: null, instructor_added_by: null, instructor_added_at: null,
        };
        db.users.set(user.id, user);
      }
      return redirect(withResult(returnTo, 'auth_result', 'signed_in'), startSession(context, user, 'web'));
    },
  },
  {
    // FA6 (start)
    method: 'POST', path: 'me/auth-identities/google',
    handler: (context) => {
      requireUser(context);
      const body = context.body === undefined ? {} : readObject(context);
      rejectUnknownFields(body, ['return_to', 'mock_google_subject', 'mock_google_email', 'mock_google_name', 'mock_google_error']);
      const returnTo = safeReturnPath(typeof body.return_to === 'string' ? body.return_to : null);
      return ok({ redirect_url: `${context.basePath}/me/auth-identities/google/callback?${mockGoogleQuery(mockGoogleFrom(body), returnTo)}` });
    },
  },
  {
    // FA6 (callback)
    method: 'GET', path: 'me/auth-identities/google/callback',
    handler: ({ db, query, principal }) => {
      const returnTo = safeReturnPath(query.get('return_to'));
      const identity = mockGoogleFrom(query);
      if (!principal || identity.failed || !identity.subject) return redirect(withResult(returnTo, 'link_result', 'failed'));
      const owner = [...db.users.values()].find((candidate) => candidate.google_subject === identity.subject);
      if (owner && owner.id !== principal.id) return redirect(withResult(returnTo, 'link_result', 'google_identity_linked_elsewhere'));
      if (principal.google_subject && principal.google_subject !== identity.subject) return redirect(withResult(returnTo, 'link_result', 'failed'));
      principal.google_subject = identity.subject;
      return redirect(withResult(returnTo, 'link_result', 'linked'));
    },
  },
  {
    // FA7
    method: 'POST', path: 'auth/password-reset/request',
    handler: (context) => {
      const { db, clock, config } = context;
      const body = readObject(context);
      rejectUnknownFields(body, ['identifier']);
      const problems: FieldError[] = [];
      const identifier = requiredString(body, 'identifier', problems);
      if (problems.length) throw validationFailed(problems);
      takeCooldown(db, clock, config, `reset:${identifier.toLowerCase()}`);
      const user = findByIdentifier(db, identifier);
      // Only a verified email can receive a link (A13); the answer is identical either way (draft D10).
      if (user && user.email && (user.email_verified || user.origin === 'google')) sendLink(db, clock, user, 'reset_password', config.resetLinkMinutes * 60 * 1000);
      return accepted({ status: 'accepted', retry_after_seconds: config.emailCooldownSeconds });
    },
  },
  {
    // FA8
    method: 'POST', path: 'auth/password-reset/confirm',
    handler: (context) => {
      const { db, clock } = context;
      const body = readObject(context);
      rejectUnknownFields(body, ['token', 'new_password']);
      const problems: FieldError[] = [];
      const token = requiredString(body, 'token', problems);
      const password = checkPassword(body.new_password, problems, 'new_password');
      if (problems.length) throw validationFailed(problems);
      const record = db.tokens.get(token);
      if (!record || record.kind !== 'reset_password') throw new ApiError(400, 'reset_link_invalid', 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง');
      if (record.used_at) throw new ApiError(409, 'reset_link_used', 'ลิงก์ตั้งรหัสผ่านถูกใช้แล้ว');
      if (new Date(record.expires_at).getTime() <= clock.now().getTime()) throw new ApiError(410, 'reset_link_expired', 'ลิงก์ตั้งรหัสผ่านหมดอายุ');
      const user = db.users.get(record.user_id) as UserRecord;
      record.used_at = iso(clock.now());
      user.password = password;
      for (const [id, session] of db.sessions) if (session.user_id === user.id) db.sessions.delete(id);
      return ok({ status: 'password_changed' });
    },
  },
  {
    // FA9
    method: 'POST', path: 'auth/logout',
    handler: ({ db, sessionId }) => {
      if (sessionId) db.sessions.delete(sessionId);
      return noContent({ 'set-cookie': clearedSessionCookie });
    },
  },
  {
    // FA10
    method: 'GET', path: 'me',
    handler: (context) => ok(toCurrentUser(requireUser(context))),
  },
  {
    // FA11: only fields the draft lists as editable; roles, email_verified and the like are rejected.
    method: 'PATCH', path: 'me',
    handler: (context) => {
      const user = requireUser(context);
      const body = readObject(context);
      rejectUnknownFields(body, ['display_name', 'avatar_url']);
      const problems: FieldError[] = [];
      let displayName: string | undefined;
      if ('display_name' in body) {
        displayName = requiredString(body, 'display_name', problems, { max: 80 });
      }
      const avatar = optionalString(body, 'avatar_url', problems, { max: 2048 });
      if (problems.length) throw validationFailed(problems);
      if (displayName !== undefined) user.display_name = displayName;
      if (avatar !== undefined) user.avatar_url = avatar;
      return ok(toCurrentUser(user));
    },
  },
  {
    // FA12
    method: 'POST', path: 'admin/users',
    handler: (context) => {
      const { db, clock } = context;
      const admin = requireRole(context, 'admin');
      const body = readObject(context);
      rejectUnknownFields(body, ['username', 'password', 'display_name', 'email']);
      const problems: FieldError[] = [];
      const username = requiredString(body, 'username', problems).toLowerCase();
      if (username && !usernamePattern.test(username)) problems.push({ field: 'username', code: 'invalid' });
      const password = checkPassword(body.password, problems, 'password');
      const displayName = requiredString(body, 'display_name', problems, { max: 80 });
      const email = optionalString(body, 'email', problems, { max: 254 }) ?? null;
      if (email && !emailPattern.test(email)) problems.push({ field: 'email', code: 'invalid' });
      if (problems.length) throw validationFailed(problems);
      if (findByUsername(db, username)) throw new ApiError(409, 'username_taken', 'Username นี้ถูกใช้แล้ว', { fields: [{ field: 'username', code: 'taken' }] });
      if (email && findByEmail(db, email)) throw new ApiError(409, 'email_taken', 'อีเมลนี้ถูกใช้แล้ว', { fields: [{ field: 'email', code: 'taken' }] });
      const user: UserRecord = {
        id: nextId(db, 'usr'), display_name: displayName, username, email, email_verified: false, avatar_url: null,
        roles: ['learner'], origin: 'admin_created', password, google_subject: null, created_at: iso(clock.now()),
        created_by: admin.id, instructor_added_by: null, instructor_added_at: null,
      };
      db.users.set(user.id, user);
      return created({ user: toCurrentUser(user), created_by: admin.id, created_at: user.created_at });
    },
  },
  {
    // FA13
    method: 'POST', path: 'admin/users/:id/instructor',
    handler: (context) => {
      const { db, clock, params } = context;
      const admin = requireRole(context, 'admin');
      if (context.body !== undefined) rejectUnknownFields(readObject(context), []);
      const user = db.users.get(params.id);
      if (!user) throw notFound();
      if (user.roles.includes('admin')) throw new ApiError(409, 'invalid_state', 'บัญชี Admin เป็น Instructor ไม่ได้', { details: { reason: 'admin_account' } });
      if (!user.roles.includes('instructor')) {
        user.roles.push('instructor');
        user.instructor_added_by = admin.id;
        user.instructor_added_at = iso(clock.now());
      }
      return ok({ user: toCurrentUser(user), added_by: user.instructor_added_by, added_at: user.instructor_added_at });
    },
  },
  {
    // PROPOSAL for the §3.4 gap: search users so Admin can pick one to make an Instructor.
    method: 'GET', path: 'admin/users',
    handler: (context) => {
      requireRole(context, 'admin');
      const { db, query, config } = context;
      const problems = queryProblems(query, ['q', 'limit', 'cursor']);
      const q = query.get('q')?.trim().toLowerCase() ?? '';
      const matches = [...db.users.values()]
        .filter((user) => !q || [user.display_name, user.username ?? '', user.email ?? ''].some((text) => text.toLowerCase().includes(q)))
        .sort((a, b) => a.id.localeCompare(b.id));
      const page = paginate(matches, query, config, problems);
      return ok({
        items: page.items.map((user) => ({
          id: user.id, display_name: user.display_name, username: user.username, email: user.email,
          email_verified: user.email_verified, roles: [...user.roles], origin: user.origin,
        })),
        next_cursor: page.next_cursor,
      });
    },
  },
  {
    // PROPOSAL for the §3.4 gap: Instructors an Admin may pick as the owner of a course.
    method: 'GET', path: 'admin/instructors',
    handler: (context) => {
      requireRole(context, 'admin');
      const { db, query, config } = context;
      const problems = queryProblems(query, ['limit', 'cursor']);
      const matches = [...db.users.values()].filter((user) => user.roles.includes('instructor')).sort((a, b) => a.id.localeCompare(b.id));
      const page = paginate(matches, query, config, problems);
      return ok({ items: page.items.map((user) => ({ id: user.id, display_name: user.display_name, avatar_url: user.avatar_url })), next_cursor: page.next_cursor });
    },
  },
];
