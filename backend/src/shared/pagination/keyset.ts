import { PipeTransform } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiException } from '../errors/api-exception';

export interface PageQuery { limit: number; cursor?: string; filters: Record<string,string> }
export interface PagePoint { id: string; at: Date }
export interface Page<T> { items: T[]; next_cursor: string | null }
const developmentKey = randomBytes(32).toString('hex');
const invalid = () => ApiException.validationFailed('Query หรือ cursor ไม่ถูกต้อง');

/** Feature declares permitted filters; duplicate/nested/unknown input is rejected. */
export class PageQueryPipe implements PipeTransform<unknown,PageQuery> {
  constructor(private readonly allowed: readonly string[] = []) {}
  transform(value: unknown): PageQuery {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
    const raw = value as Record<string,unknown>, keys = ['limit','cursor',...this.allowed];
    if (Object.entries(raw).some(([key,item]) => !keys.includes(key) || typeof item !== 'string')) throw invalid();
    const limitText = raw.limit;
    if (limitText !== undefined && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(limitText as string)) throw invalid();
    const cursor = raw.cursor as string | undefined;
    if (cursor !== undefined && (!cursor || cursor.length > 4096)) throw invalid();
    const filters: Record<string,string> = {};
    for (const key of this.allowed) if (raw[key] !== undefined) {
      const text = key === 'q' ? (raw[key] as string).trim() : raw[key] as string;
      if (key !== 'q' || text) filters[key] = text;
    }
    return { limit: limitText === undefined ? 20 : Number(limitText), cursor, filters };
  }
}

function key(): string {
  const value = process.env.CURSOR_SIGNING_SECRET;
  if (value && Buffer.byteLength(value) >= 32) return value;
  if (process.env.NODE_ENV === 'production') throw Error('Cursor signing configuration unavailable');
  // Development only. Set the ignored ENV key for continuity across restarts.
  return developmentKey;
}
function binding(route: string, query: PageQuery, owner?: string): string {
  const filters = Object.entries(query.filters).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
  return createHash('sha256').update(JSON.stringify([route,owner ?? null,query.limit,filters])).digest('hex');
}
export function encodeCursor(route: string, query: PageQuery, point: PagePoint, owner?: string): string {
  const body = Buffer.from(JSON.stringify({v:1,b:binding(route,query,owner),id:point.id,at:point.at.toISOString()})).toString('base64url');
  return body + '.' + createHmac('sha256',key()).update(body).digest('base64url');
}
export function decodeCursor(route: string, query: PageQuery, owner?: string): PagePoint | null {
  if (!query.cursor) return null;
  const signingKey = key();
  try {
    const [body,signature,...extra] = query.cursor.split('.');
    if (extra.length || !body || !signature || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(signature)) throw invalid();
    const expected = createHmac('sha256',signingKey).update(body).digest();
    const actual = Buffer.from(signature,'base64url');
    if (actual.toString('base64url') !== signature || Buffer.from(body,'base64url').toString('base64url') !== body ||
      actual.length !== expected.length || !timingSafeEqual(actual,expected)) throw invalid();
    const parsed: unknown = JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalid();
    const p = parsed as Record<string,unknown>;
    if (Object.keys(p).length !== 4 || p.v !== 1 || p.b !== binding(route,query,owner) ||
      typeof p.id !== 'string' || !p.id || typeof p.at !== 'string') throw invalid();
    const at = new Date(p.at);
    if (!Number.isFinite(at.getTime()) || at.toISOString() !== p.at) throw invalid();
    return { id:p.id,at };
  } catch (error) {
    if (error instanceof ApiException) throw error;
    throw invalid();
  }
}
export function page<T,R>(route: string, query: PageQuery, rows: R[], point: (row:R)=>PagePoint,
  project: (row:R)=>T, owner?:string): Page<T> {
  const selected = rows.slice(0,query.limit);
  return { items:selected.map(project), next_cursor:rows.length > query.limit && selected.length
    ? encodeCursor(route,query,point(selected[selected.length-1]),owner) : null };
}
