import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as exempt from the global internal API key guard.
 * The only route this should ever be applied to is `POST /api/auth/validate`
 * — every other route in apps/api requires the shared `x-internal-api-key`
 * header from apps/web.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
