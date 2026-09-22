import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global guard: every route requires the `x-internal-api-key` header to
 * match `process.env.INTERNAL_API_KEY` (the shared secret with apps/web),
 * except routes explicitly marked `@Public()` — currently only
 * `POST /api/auth/validate`. apps/api is not meant to be directly
 * internet-exposed; this guard is the enforcement point for that.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Not importing `express`'s `Request` type here on purpose — apps/api
    // doesn't declare an @types/express devDependency, and we only need the
    // one header off the request.
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-internal-api-key'];
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    return true;
  }
}
