import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@uptime/auth';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Marks a route as requiring a specific `Permission` (the fixed catalog
 * defined in `@uptime/auth` — see its file header for why the catalog
 * itself stays fixed even though which `Role`s grant it is fully dynamic).
 * Read by `PermissionGuard`, which runs after `InternalApiKeyGuard` in the
 * global guard chain. Routes with no `@RequirePermission(...)` still
 * require an authenticated, active user — they just don't gate on a
 * specific permission.
 */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);
