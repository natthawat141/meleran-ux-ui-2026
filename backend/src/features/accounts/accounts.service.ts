import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ApiException } from '../../shared/errors/api-exception';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async getProfile(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw ApiException.notFound('ไม่พบบัญชีผู้ใช้');

    const authMethods = await this.authService.getAuthMethods(accountId);

    return {
      id: account.id,
      display_name: account.displayName,
      username: account.username,
      email: account.email,
      email_verified: account.emailVerified,
      avatar_url: account.avatarUrl,
      roles: account.roles.split(','),
      profile: JSON.parse(account.profileJson || '{}'),
      auth_methods: authMethods,
    };
  }

  async updateProfile(accountId: string, patch: any) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw ApiException.validationFailed('ข้อมูลไม่ถูกต้อง');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw ApiException.notFound('ไม่พบบัญชีผู้ใช้');

    const dataToUpdate: any = {
      revision: { increment: 1 },
    };

    const currentProfile = JSON.parse(account.profileJson || '{}');

    for (const key of Object.keys(patch)) {
      const val = patch[key];
      switch (key) {
        case 'display_name':
          if (typeof val !== 'string' || !val.trim() || val.length > 80) {
            throw ApiException.validationFailed('ชื่อแสดงผลไม่ถูกต้อง');
          }
          dataToUpdate.displayName = val.trim();
          break;

        case 'username':
          if (typeof val !== 'string' || !/^[A-Za-z0-9_.]{3,30}$/.test(val)) {
            throw ApiException.validationFailed('Username ไม่ถูกต้อง');
          }
          const normalized = this.authService.normalize(val);
          const conflict = await this.prisma.account.findFirst({
            where: { normalizedUsername: normalized, id: { not: accountId } },
          });
          if (conflict) {
            throw ApiException.conflict('username_conflict', 'Username นี้ถูกใช้แล้ว');
          }
          dataToUpdate.username = val;
          dataToUpdate.normalizedUsername = normalized;
          break;

        case 'avatar_url':
          if (val !== null && (typeof val !== 'string' || !val.startsWith('https://') || val.length > 2048)) {
            throw ApiException.validationFailed('URL ภาพต้องเป็น HTTPS');
          }
          dataToUpdate.avatarUrl = val;
          break;

        case 'profile':
          if (typeof val !== 'object' || val === null || Array.isArray(val)) {
            throw ApiException.validationFailed('Profile ไม่ถูกต้อง');
          }
          for (const pKey of Object.keys(val)) {
            if (val[pKey] === null) {
              delete currentProfile[pKey];
            } else {
              currentProfile[pKey] = val[pKey];
            }
          }
          dataToUpdate.profileJson = JSON.stringify(currentProfile);
          break;

        default:
          throw ApiException.validationFailed('ฟิลด์นี้แก้ไขไม่ได้');
      }
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: dataToUpdate,
    });

    const authMethods = await this.authService.getAuthMethods(accountId);

    return {
      id: updated.id,
      display_name: updated.displayName,
      username: updated.username,
      email: updated.email,
      email_verified: updated.emailVerified,
      avatar_url: updated.avatarUrl,
      roles: updated.roles.split(','),
      profile: JSON.parse(updated.profileJson || '{}'),
      auth_methods: authMethods,
    };
  }
}
