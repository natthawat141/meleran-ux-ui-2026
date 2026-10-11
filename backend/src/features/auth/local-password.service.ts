import { Injectable } from '@nestjs/common';
import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiException } from '../../shared/errors/api-exception';

const derive = promisify(pbkdf2);
export const LOCAL_PASSWORD_ITERATIONS = 600_000;
const prefix = `melearn:pbkdf2-sha256:v1:${LOCAL_PASSWORD_ITERATIONS}:`;
const encodedPattern = /^melearn:pbkdf2-sha256:v1:600000:([a-f0-9]{32}):([a-f0-9]{64})$/;
const dummy = prefix + '00'.repeat(16) + ':' + '00'.repeat(32);
export const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,30}$/;

/** ASCII usernames need no Unicode folding or whitespace normalization. */
export function normalizedLocalUsername(value: unknown): string | null {
  return typeof value === 'string' && USERNAME_PATTERN.test(value) ? value.toUpperCase() : null;
}

@Injectable()
export class LocalPasswordService {
  isEncoded(value: unknown): value is string {
    return typeof value === 'string' && encodedPattern.test(value);
  }

  async create(password: string): Promise<string> {
    const length = typeof password === 'string' ? [...password].length : 0;
    if (length < 8 || length > 128) throw ApiException.validationFailed('รหัสผ่านต้องยาว 8–128 ตัวอักษร');
    const salt = randomBytes(16);
    const key = await derive(password, salt, LOCAL_PASSWORD_ITERATIONS, 32, 'sha256');
    return prefix + salt.toString('hex') + ':' + key.toString('hex');
  }

  async verify(encoded: unknown, password: unknown): Promise<boolean> {
    if (typeof password !== 'string' || [...password].length < 1 || [...password].length > 128) return false;
    const valid = this.isEncoded(encoded);
    // Unknown/malformed storage uses the same bounded KDF work; never weak-hash fallback.
    const match = encodedPattern.exec(valid ? encoded : dummy)!;
    const actual = await derive(password, Buffer.from(match[1], 'hex'), LOCAL_PASSWORD_ITERATIONS, 32, 'sha256');
    const equal = timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
    return valid && equal;
  }
}
