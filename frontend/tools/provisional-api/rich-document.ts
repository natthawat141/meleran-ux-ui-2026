import { validationFailed } from './http.ts';
import type { JsonValue } from '../../packages/contracts/src/management-http.ts';
/** Bounded JSON document, never raw HTML. Renderer also uses an allow-list. */
export function richDocument(value: unknown, field: string): JsonValue | null {
  if (value === null || value === undefined) return null;
  const fail = () => {
    throw validationFailed([{ field, code: 'invalid' }]);
  };
  if (JSON.stringify(value).length > 2_000_000) fail();
  let count = 0;
  const walk = (v: unknown, depth: number): void => {
    if (++count > 20000 || depth > 30) fail();
    if (
      v === null ||
      typeof v === 'string' ||
      typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v))
    )
      return;
    if (Array.isArray(v)) {
      v.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (!v || typeof v !== 'object') fail();
    for (const [key, child] of Object.entries(v as object)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
      if (
        (key === 'href' || key === 'src') &&
        typeof child === 'string' &&
        !/^(https?:\/\/|\/(?!\/)|data:image\/(?:png|jpeg|webp);base64,)/i.test(child)
      )
        fail();
      walk(child, depth + 1);
    }
  };
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (value as { type?: string }).type !== 'doc'
  )
    fail();
  walk(value, 0);
  return value as JsonValue;
}
