import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UptimePrismaService } from '@uptime/uptime-db';
import type { Permission } from '@uptime/auth';
import { hasPermission } from '@uptime/auth';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { SKIP_PERMISSION_CHECK_KEY } from '../decorators/skip-permission-check.decorator';

/**
 * Global guard: runs after `InternalApiKeyGuard`. Where that guard validates
 * the one shared system secret, this one identifies *which* user is calling
 * and enforces per-route `@RequirePermission(...)` checks against that
 * user's *effective* permissions — the union of every `Role` they hold via
 * `RoleUser`, resolved fresh from the DB on every request (never cached),
 * with any held `isSystem` role short-circuiting to every permission.
 *
 * apps/web's proxy attaches `x-user-id` (the session user's id) to every
 * forwarded request except the one `@Public()` route (`POST
 * /api/auth/validate`, which has no session yet) — this guard reads that
 * header, looks up the user, and checks the required permission (if any) for
 * the matched route. `@SkipPermissionCheck()` routes bypass all of this
 * (but still go through `InternalApiKeyGuard`) — for reads apps/web needs
 * before a session exists, e.g. branding on `/login`.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: UptimePrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const skipPermissionCheck = this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSION_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipPermissionCheck) {
      return true;
    }

    // Not importing `express`'s `Request` type here on purpose — apps/api
    // doesn't declare an @types/express devDependency, and we only need the
    // one header off the request.
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        active: true,
        roles: { select: { role: { select: { isSystem: true, permissions: { select: { permission: { select: { key: true } } } } } } } },
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid or inactive user');
    }

    const requiredPermission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermission) {
      return true;
    }

    const isSystemBypass = user.roles.some((ru) => ru.role.isSystem);
    const permissions = isSystemBypass
      ? [requiredPermission] // bypass — no need to fetch the full catalog just to prove membership
      : user.roles.flatMap((ru) => ru.role.permissions.map((rp) => rp.permission.key));

    if (!hasPermission(permissions, requiredPermission)) {
      throw new ForbiddenException(`Missing required permission: ${requiredPermission}`);
    }

    return true;
  }
}
