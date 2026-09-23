import { SetMetadata } from '@nestjs/common';

export const SKIP_PERMISSION_CHECK_KEY = 'skipPermissionCheck';

/**
 * Exempts a route from `PermissionGuard`'s `x-user-id`/permission
 * requirement, while still requiring the shared `x-internal-api-key`
 * (`InternalApiKeyGuard`) — unlike `@Public()`, which exempts both.
 *
 * Use only for reads that are genuinely safe pre-authentication: today,
 * just `GET /api/settings/branding`, which `apps/web`'s root layout calls
 * directly (not through the session-checked proxy) to render the page
 * title/favicon/sidebar branding on `/login` itself, before any session
 * exists to supply a user id.
 */
export const SkipPermissionCheck = () => SetMetadata(SKIP_PERMISSION_CHECK_KEY, true);
