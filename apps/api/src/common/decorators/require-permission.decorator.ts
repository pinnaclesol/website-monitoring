import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@uptime/auth';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Marks a route as requiring a specific `Permission` (per `@uptime/auth`'s
 * fixed ADMIN/EDITOR/VIEWER role table). Read by `PermissionGuard`, which
 * runs after `InternalApiKeyGuard` in the global guard chain. Routes with no
 * `@RequirePermission(...)` still require an authenticated, active user —
 * they just don't gate on a specific permission.
 */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);
