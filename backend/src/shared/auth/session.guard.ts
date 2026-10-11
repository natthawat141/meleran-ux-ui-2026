import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiException } from '../errors/api-exception';
import { AppAudience, AuthPrincipal, PrincipalService } from '../../features/auth/public';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const AUTHORITATIVE_AUDIENCE_KEY = 'authoritative_audience';
/** Explicit session namespace; normalized grants determine permission. */
export const AuthoritativeAudience = (audience: AppAudience, ...additional: AppAudience[]) =>
  SetMetadata(AUTHORITATIVE_AUDIENCE_KEY, additional.length ? [audience, ...additional] : audience);
export interface PrincipalRequest extends Request { principal?: AuthPrincipal }

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly principals: PrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    // Public routes authenticate their own provider boundary if required.
    // An unrelated or stale browser cookie must never alter public behavior.
    if (isPublic) return true;
    const configuredAudience = this.reflector.getAllAndOverride<AppAudience | AppAudience[]>(AUTHORITATIVE_AUDIENCE_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (configuredAudience) {
      // For a canonical either-audience route, the app header selects only the
      // cookie/session namespace. Stored normalized roles still decide rights.
      const header = request.headers['x-melearn-app'];
      const verifiedAudience = Array.isArray(configuredAudience)
        ? configuredAudience.find(audience => audience === header) ?? configuredAudience[0]
        : configuredAudience;
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
    // A protected handler without an explicit namespace is an implementation error.
    // Never fall back to compatibility CSV roles or attach a full Account record.
    throw ApiException.unauthorized();
  }
}
