import { HttpClientError } from '@melearn/api-client';
import { apiClient } from './client';
import type { ResourcePage } from '@melearn/contracts';
export class ResourceError extends HttpClientError {
  readonly code: string;
  readonly fields: { field: string; code: string }[];
  constructor(status: number, code: string, fields: { field: string; code: string }[]) {
    super('http', status);
    this.code = code;
    this.fields = fields;
    const messages: Record<string, string> = {
      revision_conflict: 'ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดล่าสุดก่อนบันทึก ฉบับร่างของคุณยังอยู่',
      learning_history_conflict: 'เนื้อหานี้มีประวัติการเรียนหรือคำตอบแล้ว จึงแก้คำถามหรือลบไม่ได้',
      validation_failed: 'ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจชื่อ เนื้อหา ตัวเลือก และเฉลย',
      invalid_state: 'สถานะปัจจุบันไม่รองรับคำสั่งนี้',
      slug_taken: 'URL บทความนี้ถูกใช้แล้ว',
      forbidden: 'ไม่มีสิทธิ์จัดการข้อมูลนี้',
      not_found: 'ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์เข้าถึง',
    };
    this.message =
      messages[code] ??
      (status === 401
        ? 'กรุณาเข้าสู่ระบบอีกครั้ง'
        : status === 422
          ? 'ข้อมูลบางช่องไม่ถูกต้อง'
          : status === 409
            ? 'ข้อมูลเปลี่ยนแปลงหรือสถานะไม่รองรับคำสั่งนี้'
            : 'ติดต่อ API ไม่สำเร็จ');
  }
}
function decodeResourceError(value: unknown, status: number): ResourceError {
  const record = value as { error?: { code?: unknown; details?: { fields?: unknown } } };
  const code =
    typeof record?.error?.code === 'string' && /^[a-z_]{1,80}$/.test(record.error.code)
      ? record.error.code
      : 'http_error';
  const fields = Array.isArray(record?.error?.details?.fields)
    ? record.error.details.fields
        .slice(0, 30)
        .filter(
          (f): f is { field: string; code: string } =>
            !!f &&
            typeof f.field === 'string' &&
            /^[a-zA-Z0-9_.\[\]]{1,160}$/.test(f.field) &&
            typeof f.code === 'string' &&
            /^[a-z_]{1,80}$/.test(f.code),
        )
    : [];
  return new ResourceError(status, code, fields);
}
/** Resource transport only. Feature APIs own DTOs and endpoint selection. */
export function resource<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  return apiClient.request(path, {
    method,
    signal,
    errorDecoder: decodeResourceError,
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    decoder: (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError('Invalid resource response');
      return value as T;
    },
  });
}
export async function resourceList<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const result: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const page: ResourcePage<T> = await resource(
      path +
        (path.includes('?') ? '&' : '?') +
        'limit=50' +
        (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      'GET',
      undefined,
      signal,
    );
    if (!Array.isArray(page.items) || (page.next_cursor !== null && typeof page.next_cursor !== 'string'))
      throw new TypeError('Invalid resource pagination');
    result.push(...page.items);
    cursor = page.next_cursor;
    if (cursor && seen.has(cursor)) throw new TypeError('Repeated resource cursor');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return result;
}
