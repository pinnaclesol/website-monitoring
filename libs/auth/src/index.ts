// Fully flexible RBAC (billing-manager parity): Role/Permission/
// RolePermission/RoleUser are real DB tables (see
// libs/uptime-db/prisma/schema.prisma) — a user can hold any number of
// roles, and their effective permissions are the union of all of them.
//
// `Permission` stays a *fixed*, compile-time catalog here, deliberately:
// each string is an actual enforcement point (`@RequirePermission(...)` in
// apps/api, `hasPermission(...)` in apps/web) baked into code at specific
// call sites — adding a genuinely new one always requires a code change to
// add that enforcement point, dynamic roles or not. What's dynamic is only
// which of these fixed permissions get bundled into which named Role, and
// which roles a User holds. This list must stay in sync with the seeded
// Permission rows in libs/uptime-db/src/seed.ts.
export type Permission =
  | 'monitors:view'
  | 'monitors:create'
  | 'monitors:update'
  | 'monitors:delete'
  | 'incidents:view'
  | 'notifications:view'
  | 'notifications:update'
  | 'settings:view'
  | 'settings:update'
  | 'users:view'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'roles:view'
  | 'roles:create'
  | 'roles:update'
  | 'roles:delete';

export interface RoleSummary {
  id: string;
  name: string;
}

/**
 * A user's *effective* permission set — already resolved server-side
 * (apps/api's AuthService/PermissionGuard union every role a user holds
 * and dedupe, short-circuiting to the full catalog if any held role is
 * `isSystem`). This check itself stays a plain, synchronous array lookup;
 * the real enforcement is the server re-resolving this fresh from the DB on
 * every request — never trusting a client-supplied permissions array.
 */
export function hasPermission(permissions: string[], permission: Permission): boolean {
  return permissions.includes(permission);
}

export interface AuthUser {
  id: string;
  username: string;
  /** Display name — shown in the UI instead of `username`; falls back to it when unset. */
  name: string | null;
  /** Every role this user holds. */
  roles: RoleSummary[];
  /** Flattened, deduped union of every permission granted by any role above. */
  permissions: string[];
}
