import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ApiException } from '../../shared/errors/api-exception';

@Injectable()
export class ManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listUsers(q?: string, limit = 20, cursor?: string) {
    if (limit < 1 || limit > 50) {
      throw ApiException.validationFailed('Limit ต้องอยู่ระหว่าง 1 ถึง 50');
    }

    let offset = 0;
    if (cursor) {
      if (cursor.startsWith('o:')) {
        const parsed = parseInt(cursor.substring(2), 10);
        if (!isNaN(parsed) && parsed >= 0) offset = parsed;
        else throw ApiException.validationFailed('Cursor ไม่ถูกต้อง');
      } else {
        throw ApiException.validationFailed('Cursor ไม่ถูกต้อง');
      }
    }

    const where: any = {};
    if (q) {
      where.OR = [
        { displayName: { contains: q } },
        { username: { contains: q } },
      ];
    }

    const accounts = await this.prisma.account.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = accounts.length > limit;
    const items = accounts.slice(0, limit).map((a) => ({
      id: a.id,
      display_name: a.displayName,
      username: a.username,
      email: a.email,
      email_verified: a.emailVerified,
      avatar_url: a.avatarUrl,
      roles: a.roles.split(','),
      origin: a.origin,
      status: a.origin === 'self_email' && !a.emailVerified ? 'pending' : 'active',
      created_at: a.createdAt,
    }));

    const nextCursor = hasMore ? `o:${offset + limit}` : null;
    return { items, next_cursor: nextCursor };
  }

  async createUser(actorId: string, body: { username: string; password: string; display_name: string; email?: string }) {
    if (body.email !== undefined && body.email !== null) {
      throw new ApiException('email_verification_required', 422, 'การผูกอีเมลต้องผ่าน flow ยืนยันอีเมล; สร้าง Username โดยไม่มีอีเมลก่อน');
    }

    if (!body.username || !/^[A-Za-z0-9_.]{3,30}$/.test(body.username) || !body.password || body.password.length < 12 || !body.display_name || body.display_name.trim().length > 80) {
      throw ApiException.validationFailed('ข้อมูลบัญชีไม่ถูกต้อง');
    }

    const normalized = this.authService.normalize(body.username);
    const conflict = await this.prisma.account.findFirst({
      where: { normalizedUsername: normalized },
    });
    if (conflict) {
      throw ApiException.conflict('username_conflict', 'Username นี้ถูกใช้แล้ว');
    }

    const passwordHash = this.authService.hashPassword(body.password);

    const account = await this.prisma.account.create({
      data: {
        username: body.username,
        normalizedUsername: normalized,
        displayName: body.display_name.trim(),
        createdBy: actorId,
        localCredential: {
          create: {
            passwordHash,
          },
        },
      },
    });

    const authMethods = await this.authService.getAuthMethods(account.id);

    return {
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
      created_by: actorId,
      created_at: account.createdAt,
    };
  }

  async getUserDetail(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });
    if (!account) throw ApiException.notFound('ไม่พบบัญชีผู้ใช้');

    const authMethods = await this.authService.getAuthMethods(id);

    return {
      id: account.id,
      display_name: account.displayName,
      username: account.username,
      email: account.email,
      email_verified: account.emailVerified,
      avatar_url: account.avatarUrl,
      roles: account.roles.split(','),
      origin: account.origin,
      status: account.origin === 'self_email' && !account.emailVerified ? 'pending' : 'active',
      created_at: account.createdAt,
      profile: JSON.parse(account.profileJson || '{}'),
      auth_methods: authMethods,
    };
  }

  async listInstructors(limit = 20, cursor?: string) {
    if (limit < 1 || limit > 50) {
      throw ApiException.validationFailed('Limit ต้องอยู่ระหว่าง 1 ถึง 50');
    }

    let offset = 0;
    if (cursor) {
      if (cursor.startsWith('o:')) {
        const parsed = parseInt(cursor.substring(2), 10);
        if (!isNaN(parsed) && parsed >= 0) offset = parsed;
        else throw ApiException.validationFailed('Cursor ไม่ถูกต้อง');
      } else {
        throw ApiException.validationFailed('Cursor ไม่ถูกต้อง');
      }
    }

    const instructors = await this.prisma.account.findMany({
      where: {
        roles: { contains: 'instructor' },
      },
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = instructors.length > limit;
    const items = instructors.slice(0, limit).map((i) => ({
      id: i.id,
      display_name: i.displayName,
      avatar_url: i.avatarUrl,
    }));

    const nextCursor = hasMore ? `o:${offset + limit}` : null;
    return { items, next_cursor: nextCursor };
  }
}
