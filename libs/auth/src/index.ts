// Fixed role set — no custom/flexible roles, no Role/Permission DB tables.
// ADMIN is an implicit super-admin: it bypasses granular checks entirely, so
// a newly added Permission automatically applies to Admins with no seed or
// data update required.
export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

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
  | 'users:delete';

const ROLE_PERMISSIONS: Record<Role, Permission[] | 'ALL'> = {
  ADMIN: 'ALL',
  EDITOR: [
    'monitors:view',
    'monitors:create',
    'monitors:update',
    'monitors:delete',
    'incidents:view',
    'notifications:view',
    'notifications:update',
    'settings:view',
    'settings:update',
  ],
  VIEWER: ['monitors:view', 'incidents:view', 'notifications:view', 'settings:view'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions === 'ALL' || permissions.includes(permission);
}

export interface AuthUser {
  id: string;
  username: string;
  /** Display name — shown in the UI instead of `username`; falls back to it when unset. */
  name: string | null;
  role: Role;
}
