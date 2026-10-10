import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PrincipalRequest } from './session.guard';
import { ApiException } from '../errors/api-exception';

export const CurrentPrincipal = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const principal = ctx.switchToHttp().getRequest<PrincipalRequest>().principal;
  if (!principal) throw ApiException.unauthorized();
  return principal;
});

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export const CurrentSession = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.session;
  },
);
