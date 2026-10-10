import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../errors/api-exception';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const audienceHeader = request.headers['x-melearn-app'] as string;
    const audience = audienceHeader === 'admin' ? 'admin' : 'web';

    const cookieName = `melearn_${audience}_session`;
    const secret = request.cookies?.[cookieName];

    if (!secret) {
      if (isPublic) return true;
      throw ApiException.unauthorized();
    }

    const tokenHash = crypto.createHash('sha256').update(secret).digest('hex').toUpperCase();

    const session = await this.prisma.appSession.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (
      !session ||
      session.audience !== audience ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.account.disabled
    ) {
      if (isPublic) return true;
      throw ApiException.unauthorized();
    }

    if (audience === 'admin' && !session.account.roles.split(',').includes('admin')) {
      throw new ApiException('audience_not_allowed', 403, 'บัญชีนี้เข้าส่วนผู้ดูแลไม่ได้');
    }

    (request as any).user = session.account;
    (request as any).session = session;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles = session.account.roles.split(',');
      const hasRole = requiredRoles.some((role) => userRoles.includes(role));
      if (!hasRole) {
        throw ApiException.forbidden();
      }
    }

    return true;
  }
}
