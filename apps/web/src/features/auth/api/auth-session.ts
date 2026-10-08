import { HttpClientError, createHttpClient } from '@melearn/api-client';

export interface ApiSessionUser {
  id: string;
  display_name: string;
  username: string | null;
  email: string | null;
  email_verified: boolean;
  avatar_url: string | null;
  roles: Array<'learner' | 'instructor' | 'admin'>;
  origin: string;
  auth_methods: string[];
  learning_eligible: boolean;
}

function decodeUser(value: unknown): ApiSessionUser {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid session user');
  const user = value as Record<string, unknown>;
  if (typeof user.id !== 'string' || typeof user.display_name !== 'string'
    || !Array.isArray(user.roles) || !user.roles.every((role) => ['learner', 'instructor', 'admin'].includes(String(role)))
    || typeof user.email_verified !== 'boolean' || typeof user.learning_eligible !== 'boolean') {
    throw new TypeError('Invalid session user');
  }
  return user as unknown as ApiSessionUser;
}

function decodeLogin(value: unknown): ApiSessionUser {
  if (!value || typeof value !== 'object' || !('user' in value)) throw new TypeError('Invalid login response');
  return decodeUser((value as { user: unknown }).user);
}

const http = createHttpClient({
  baseUrl: '/mock-api/v1',
  fetcher: globalThis.fetch.bind(globalThis),
  headers: { accept: 'application/json', 'x-melearn-app': 'web' },
  credentials: 'same-origin',
  timeoutMs: 8_000,
});

export const authSessionApi = {
  enabled: import.meta.env.DEV,
  async me(): Promise<ApiSessionUser> {
    return http.request('me', { method: 'GET', decoder: decodeUser });
  },
  async login(identifier: string, password: string, audience: 'web' | 'admin'): Promise<ApiSessionUser> {
    return http.request('auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password, audience }),
      decoder: decodeLogin,
    });
  },
  async logout(): Promise<void> {
    await http.request('auth/logout', { method: 'POST', decoder: () => undefined });
  },
};

export const provisionalLoginError = (error: unknown): string => {
  if (error instanceof HttpClientError && error.kind === 'http') {
    return error.status === 403 ? 'บัญชีนี้ไม่มีสิทธิ์เข้าสู่แอปนี้' : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
  }
  if (error instanceof HttpClientError) return 'เชื่อมต่อระบบบัญชีจำลองไม่ได้ กรุณาลองอีกครั้ง';
  return 'รูปแบบข้อมูลบัญชีจาก API จำลองไม่ถูกต้อง';
};

export const provisionalDemoAccounts = [
  { label: 'ผู้เรียน', identifier: 'learner@example.test', password: 'mock-password-1' },
  { label: 'ผู้สอน', identifier: 'instructor-a@example.test', password: 'mock-password-1' },
] as const;
