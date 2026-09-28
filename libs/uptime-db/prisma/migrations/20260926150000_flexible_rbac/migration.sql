-- Replaces the fixed ADMIN/EDITOR/VIEWER Role enum with a fully dynamic
-- Role/Permission/RolePermission/RoleUser system (billing-manager parity):
-- admin-creatable roles with custom names, a permission checkbox grid per
-- role, and a user can hold multiple roles at once (effective permissions
-- are the union of all of them). Hand-written, not `prisma migrate dev`
-- generated, because every existing user's role must be preserved exactly
-- -- nobody should be silently locked out or re-permissioned by this
-- migration.

-- 0. Free up the "Role" name -- creating a table named "Role" below would
--    otherwise collide with the existing enum type of the same name.
--    Renaming (not dropping) keeps User.role's stored values intact and
--    readable under the new type name until we're done backfilling from it.
ALTER TYPE "Role" RENAME TO "_OldRole";

-- 1. New tables.
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

CREATE TABLE "RoleUser" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RoleUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoleUser_roleId_userId_key" ON "RoleUser"("roleId", "userId");
ALTER TABLE "RoleUser" ADD CONSTRAINT "RoleUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleUser" ADD CONSTRAINT "RoleUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Seed the fixed permission catalog -- one row per string ever passed to
--    @RequirePermission(...)/hasPermission(...). Same 13 strings the fixed
--    system already used, plus a new roles:* group for managing roles
--    themselves.
INSERT INTO "Permission" ("id","key","resource","action","description") VALUES
  ('perm_monitors_view',         'monitors:view',         'monitors',      'view',   'View monitors'),
  ('perm_monitors_create',       'monitors:create',       'monitors',      'create', 'Add monitors'),
  ('perm_monitors_update',       'monitors:update',       'monitors',      'update', 'Edit/pause/resume monitors'),
  ('perm_monitors_delete',       'monitors:delete',       'monitors',      'delete', 'Remove monitors'),
  ('perm_incidents_view',        'incidents:view',        'incidents',     'view',   'View incidents'),
  ('perm_notifications_view',    'notifications:view',    'notifications', 'view',   'View notification settings'),
  ('perm_notifications_update',  'notifications:update',  'notifications', 'update', 'Edit notification settings'),
  ('perm_settings_view',         'settings:view',         'settings',      'view',   'View branding/monitoring settings'),
  ('perm_settings_update',       'settings:update',       'settings',      'update', 'Edit branding/monitoring settings'),
  ('perm_users_view',            'users:view',            'users',         'view',   'View users'),
  ('perm_users_create',          'users:create',          'users',         'create', 'Add users'),
  ('perm_users_update',          'users:update',          'users',         'update', 'Edit users'),
  ('perm_users_delete',          'users:delete',          'users',         'delete', 'Remove users'),
  ('perm_roles_view',            'roles:view',            'roles',         'view',   'View roles'),
  ('perm_roles_create',          'roles:create',          'roles',         'create', 'Add roles'),
  ('perm_roles_update',          'roles:update',          'roles',         'update', 'Edit roles'),
  ('perm_roles_delete',          'roles:delete',          'roles',         'delete', 'Remove roles');

-- 3. Seed the 3 default roles, matching the exact permission sets the fixed
--    ADMIN/EDITOR/VIEWER roles used to have -- this migration changes the
--    mechanism, not anyone's actual access.
INSERT INTO "Role" ("id","name","description","isSystem","updatedAt") VALUES
  ('role_admin',  'Admin',  'Full access to everything, including user and role management.', true, CURRENT_TIMESTAMP),
  ('role_editor', 'Editor', 'Full operational control over monitors, incidents, and notifications. No user or role management.', false, CURRENT_TIMESTAMP),
  ('role_viewer', 'Viewer', 'Read-only access everywhere.', false, CURRENT_TIMESTAMP);

-- Admin: every permission explicitly, too -- redundant with isSystem's
-- bypass at enforcement time, but keeps the Roles page's checkbox grid
-- showing the truth (everything checked) rather than an empty-looking row.
INSERT INTO "RolePermission" ("id","roleId","permissionId")
  SELECT 'rp_admin_' || "id", 'role_admin', "id" FROM "Permission";

INSERT INTO "RolePermission" ("id","roleId","permissionId") VALUES
  ('rp_editor_monitors_view',        'role_editor', 'perm_monitors_view'),
  ('rp_editor_monitors_create',      'role_editor', 'perm_monitors_create'),
  ('rp_editor_monitors_update',      'role_editor', 'perm_monitors_update'),
  ('rp_editor_monitors_delete',      'role_editor', 'perm_monitors_delete'),
  ('rp_editor_incidents_view',       'role_editor', 'perm_incidents_view'),
  ('rp_editor_notifications_view',   'role_editor', 'perm_notifications_view'),
  ('rp_editor_notifications_update', 'role_editor', 'perm_notifications_update'),
  ('rp_editor_settings_view',        'role_editor', 'perm_settings_view'),
  ('rp_editor_settings_update',      'role_editor', 'perm_settings_update');

INSERT INTO "RolePermission" ("id","roleId","permissionId") VALUES
  ('rp_viewer_monitors_view',      'role_viewer', 'perm_monitors_view'),
  ('rp_viewer_incidents_view',     'role_viewer', 'perm_incidents_view'),
  ('rp_viewer_notifications_view', 'role_viewer', 'perm_notifications_view'),
  ('rp_viewer_settings_view',      'role_viewer', 'perm_settings_view');

-- 4. Backfill RoleUser from every existing user's old (now-renamed) role
--    column -- must happen before that column is dropped, below.
INSERT INTO "RoleUser" ("id", "roleId", "userId")
  SELECT 'ru_admin_'  || "id", 'role_admin',  "id" FROM "User" WHERE "role" = 'ADMIN';
INSERT INTO "RoleUser" ("id", "roleId", "userId")
  SELECT 'ru_editor_' || "id", 'role_editor', "id" FROM "User" WHERE "role" = 'EDITOR';
INSERT INTO "RoleUser" ("id", "roleId", "userId")
  SELECT 'ru_viewer_' || "id", 'role_viewer', "id" FROM "User" WHERE "role" = 'VIEWER';

-- 5. Drop the old column and the renamed-away old enum type.
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "_OldRole";
