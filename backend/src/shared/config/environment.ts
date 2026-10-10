import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseEnv } from 'node:util';

export type Environment = Record<string, string | undefined>;

/** Node 22+ literal dotenv parsing; explicit process settings take precedence. */
export function loadLocalEnvironment(
  filePath = resolve(process.cwd(), '.env'),
  target: Environment = process.env,
): void {
  if (!existsSync(filePath)) return;
  const values = parseEnv(readFileSync(filePath, 'utf8'));
  for (const [key, value] of Object.entries(values)) {
    if (target[key] === undefined) target[key] = value;
  }
  const credentialPath = target.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialPath && values.GOOGLE_APPLICATION_CREDENTIALS === credentialPath) {
    target.GOOGLE_APPLICATION_CREDENTIALS = resolve(dirname(filePath), credentialPath);
  }
}

export function httpConfiguration(env: Environment = process.env): { port: number; origins: string[] } {
  const port = Number(env.PORT || '4000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }
  const configured = [env.CORS_ALLOWED_ORIGIN_WEB, env.CORS_ALLOWED_ORIGIN_ADMIN]
    .filter((value): value is string => Boolean(value));
  // Retain prototype development origins; production policy still requires D01 review.
  const origins = configured.length ? configured : env.NODE_ENV === 'production'
    ? [] : ['http://localhost:3000', 'http://localhost:3001'];
  for (const origin of origins) {
    let url: URL;
    try { url = new URL(origin); } catch { throw new Error('CORS origins must be exact HTTP(S) origins.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) {
      throw new Error('CORS origins must be exact HTTP(S) origins.');
    }
  }
  return { port, origins: [...new Set(origins)] };
}
