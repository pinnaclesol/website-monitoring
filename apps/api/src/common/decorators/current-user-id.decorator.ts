import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Pulls the requesting user's id off the `x-user-id` header — the same
 * header `PermissionGuard` reads to identify the caller. Only meaningful on
 * non-`@Public()` routes, where that guard has already verified the header
 * is present and belongs to a real, active user before the handler runs.
 *
 * Not importing express's `Request` type here on purpose — apps/api doesn't
 * declare an @types/express devDependency, and we only need the one header.
 */
export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.headers['x-user-id'];
});
