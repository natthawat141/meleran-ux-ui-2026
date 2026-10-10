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
import { AppAudience, AuthPrincipal, PrincipalService } from '../../features/auth/public';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const AUTHORITATIVE_AUDIENCE_KEY = 'authoritative_audience';
/** Opt-in verified feature boundary; legacy transport remains pending D01. */
export const AuthoritativeAudience = (audience: AppAudience) => SetMetadata(AUTHORITATIVE_AUDIENCE_KEY, audience);
export interface PrincipalRequest extends Request { principal?: AuthPrincipal }

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly principals: PrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const verifiedAudience = this.reflector.getAllAndOverride<AppAudience>(AUTHORITATIVE_AUDIENCE_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (verifiedAudience) {
      // Reuse only the current cookie names; no new lifetime/CSRF/issue policy.
      const principal = await this.principals.resolve(request.cookies?.[`melearn_${verifiedAudience}_session`], verifiedAudience);
      if (!principal) throw ApiException.unauthorized();
      if (request.headers['x-melearn-app'] !== verifiedAudience) {
        throw new ApiException('audience_not_allowed', 403, 'พื้นที่เข้าสู่ระบบไม่ตรงกับแอป');
      }
      const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
      if (verifiedAudience === 'admin' && !principal.roles.includes('admin')) throw ApiException.forbidden();
      if (roles?.length && !roles.some(role => principal.roles.some(granted => granted === role))) throw ApiException.forbidden();
      (request as PrincipalRequest).principal = principal;
      return true;
    }
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
