import { HttpClientError } from '@melearn/api-client';
import { decodeCurrentUser } from '@melearn/contracts';
import type { CurrentUser, LoginRequest, RegisterRequest, UpdateProfileRequest } from '@melearn/contracts';
import { apiClient as http, apiConfig } from '../../../shared/api/client';

export type ApiSessionUser = CurrentUser;
function decodeLogin(value: unknown): CurrentUser {
  if (!value || typeof value !== 'object' || !('user' in value)) throw new TypeError('Invalid login response');
  return decodeCurrentUser(value.user);
}
const json = { 'content-type': 'application/json' };
export const authSessionApi = {
  enabled: true,
  mock: apiConfig.mock,
  googleStartUrl: () => apiConfig.baseUrl + '/auth/google/start?return_to=' + encodeURIComponent('/learn'),
  me: () => http.request('me', { method: 'GET', decoder: decodeCurrentUser }),
  login: (identifier: string, password: string, audience: 'web' | 'admin') => {
    const body: LoginRequest = { identifier, password, audience };
    return http.request('auth/login', { method: 'POST', headers: json, body: JSON.stringify(body), decoder: decodeLogin });
  },
  updateProfile: (body: UpdateProfileRequest) => http.request('me', { method: 'PATCH', headers: json, body: JSON.stringify(body), decoder: decodeCurrentUser }),
  register: (body: RegisterRequest) => http.request('auth/register', { method: 'POST', headers: json, body: JSON.stringify(body), decoder: decodeLogin }),
  verify: (token: string) => http.request('auth/verify-email', { method: 'POST', headers: json, body: JSON.stringify({ token }), decoder: () => undefined }),
  resend: (email: string) => http.request('auth/resend-verification-email', { method: 'POST', headers: json, body: JSON.stringify({ email }), decoder: () => undefined }),
  requestReset: (identifier: string) => http.request('auth/password-reset/request', { method: 'POST', headers: json, body: JSON.stringify({ identifier }), decoder: () => undefined }),
  confirmReset: (token: string, newPassword: string) => http.request('auth/password-reset/confirm', { method: 'POST', headers: json, body: JSON.stringify({ token, new_password: newPassword }), decoder: () => undefined }),
  logout: async () => { await http.request('auth/logout', { method: 'POST', decoder: () => undefined }); },
};
export const provisionalLoginError = (error: unknown): string => {
  if (error instanceof HttpClientError && error.kind === 'http') return error.status === 403
    ? 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้' : error.status === 422 ? 'ตรวจสอบข้อมูลที่กรอกอีกครั้ง'
    : error.status === 429 ? 'ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง' : error.message;
  return error instanceof HttpClientError ? 'เชื่อมต่อระบบบัญชีไม่ได้ กรุณาลองอีกครั้ง' : 'รูปแบบข้อมูลบัญชีจาก API ไม่ถูกต้อง';
};
export const provisionalDemoAccounts = [{ label: 'ผู้ดูแลระบบ', identifier: 'admin', password: 'mock-password-1' }] as const;
