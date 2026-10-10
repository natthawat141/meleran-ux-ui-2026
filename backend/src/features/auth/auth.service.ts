import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../../shared/errors/api-exception';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  normalize(str: string): string {
    return str.trim().toUpperCase();
  }

  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(stored: string, attempt: string): boolean {
    const [salt, key] = stored.split(':');
    if (!salt || !key) return false;
    const attemptHash = crypto.pbkdf2Sync(attempt, salt, 1000, 64, 'sha512').toString('hex');
    return key === attemptHash;
  }

  async getAuthMethods(accountId: string): Promise<string[]> {
    const hasLocal = await this.prisma.localCredential.findUnique({
      where: { accountId },
    });
    const externals = await this.prisma.externalIdentity.findMany({
      where: { accountId },
      select: { method: true },
    });

    const list: string[] = [];
    if (hasLocal) list.push('password');
    for (const ext of externals) list.push(ext.method);
    return Array.from(new Set(list));
  }

  async login(identifier: string, password: string, audience: string, appHeader?: string) {
    if (!audience || (audience !== 'web' && audience !== 'admin')) {
      throw ApiException.validationFailed('พื้นที่เข้าสู่ระบบไม่ถูกต้อง');
    }
    if (appHeader !== audience) {
      throw new ApiException('validation_failed', 422, 'พื้นที่เข้าสู่ระบบไม่ตรงกับแอป');
    }

    const normalized = this.normalize(identifier);
    const account = await this.prisma.account.findFirst({
      where: {
        OR: [{ normalizedUsername: normalized }, { normalizedEmail: normalized }],
      },
      include: { localCredential: true },
    });

    const isValid = account && account.localCredential
      ? this.verifyPassword(account.localCredential.passwordHash, password)
      : false;

    if (!account || !isValid) {
      throw ApiException.unauthorized('ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
    }

    if (account.disabled) {
      throw new ApiException('account_disabled', 403, 'บัญชีนี้ถูกระงับ');
    }

    if (audience === 'admin' && !account.roles.split(',').includes('admin')) {
      throw new ApiException('audience_not_allowed', 403, 'บัญชีนี้เข้าส่วนผู้ดูแลไม่ได้');
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(secret).digest('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

    await this.prisma.appSession.create({
      data: {
        tokenHash,
        accountId: account.id,
        audience,
        expiresAt,
      },
    });

    const authMethods = await this.getAuthMethods(account.id);

    return {
      secret,
      expiresAt,
      user: {
        id: account.id,
        display_name: account.displayName,
        username: account.username,
        email: account.email,
        email_verified: account.emailVerified,
        avatar_url: account.avatarUrl,
        roles: account.roles.split(','),
        auth_methods: authMethods,
      },
    };
  }

  async logout(tokenHash: string) {
    await this.prisma.appSession.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }
}
