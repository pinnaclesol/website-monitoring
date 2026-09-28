import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as exempt from the global internal API key guard. Used
 * sparingly — today just `POST /api/auth/validate` (no session/API key
 * exists yet to send) and `GET /api/health` (a container/load-balancer
 * liveness probe can't supply the internal API key either). Every other
 * route in apps/api requires the shared `x-internal-api-key` header from
 * apps/web.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
