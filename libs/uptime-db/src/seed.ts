import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from './generated';

// This workspace uses ONE root .env for every app and lib (not a per-app/lib
// .env) — see CLAUDE.md's Environment Setup section. Load it explicitly
// rather than relying on the caller's cwd — this script can be invoked via
// `npm run --prefix libs/uptime-db seed` from the repo root, or directly
// from within libs/uptime-db, and must behave the same either way.
// __dirname is libs/uptime-db/src, so three levels up is the repo root.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const BCRYPT_SALT_ROUNDS = 10;

// Mirrors the 17-row catalog seeded by the flexible_rbac migration exactly —
// kept here too (not just in that one-time migration) so a brand-new
// DATABASE_URL, seeded fresh with no migration history replay of old data,
// still ends up with the full catalog and the same 3 default roles.
const PERMISSIONS: { key: string; resource: string; action: string; description: string }[] = [
  { key: 'monitors:view', resource: 'monitors', action: 'view', description: 'View monitors' },
  { key: 'monitors:create', resource: 'monitors', action: 'create', description: 'Add monitors' },
  { key: 'monitors:update', resource: 'monitors', action: 'update', description: 'Edit/pause/resume monitors' },
  { key: 'monitors:delete', resource: 'monitors', action: 'delete', description: 'Remove monitors' },
  { key: 'incidents:view', resource: 'incidents', action: 'view', description: 'View incidents' },
  { key: 'notifications:view', resource: 'notifications', action: 'view', description: 'View notification settings' },
  { key: 'notifications:update', resource: 'notifications', action: 'update', description: 'Edit notification settings' },
  { key: 'settings:view', resource: 'settings', action: 'view', description: 'View branding/monitoring settings' },
  { key: 'settings:update', resource: 'settings', action: 'update', description: 'Edit branding/monitoring settings' },
  { key: 'users:view', resource: 'users', action: 'view', description: 'View users' },
  { key: 'users:create', resource: 'users', action: 'create', description: 'Add users' },
  { key: 'users:update', resource: 'users', action: 'update', description: 'Edit users' },
  { key: 'users:delete', resource: 'users', action: 'delete', description: 'Remove users' },
  { key: 'roles:view', resource: 'roles', action: 'view', description: 'View roles' },
  { key: 'roles:create', resource: 'roles', action: 'create', description: 'Add roles' },
  { key: 'roles:update', resource: 'roles', action: 'update', description: 'Edit roles' },
  { key: 'roles:delete', resource: 'roles', action: 'delete', description: 'Remove roles' },
];

const EDITOR_PERMISSION_KEYS = [
  'monitors:view',
  'monitors:create',
  'monitors:update',
  'monitors:delete',
  'incidents:view',
  'notifications:view',
  'notifications:update',
  'settings:view',
  'settings:update',
];

const VIEWER_PERMISSION_KEYS = ['monitors:view', 'incidents:view', 'notifications:view', 'settings:view'];

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  // Optional — falls back to "Super Admin" if unset, matching the display
  // name shown for this account everywhere else (sidebar, Users list).
  const name = process.env.ADMIN_NAME || 'Super Admin';

  if (!username || !password) {
    throw new Error(
      '[Uptime-DB] Seed failed: ADMIN_USERNAME and ADMIN_PASSWORD must both be set in the repo root .env before seeding the admin user.',
    );
  }

  const prisma = new PrismaClient();

  try {
    for (const perm of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { key: perm.key },
        update: { resource: perm.resource, action: perm.action, description: perm.description },
        create: perm,
      });
    }

    const adminRole = await prisma.role.upsert({
      where: { name: 'Admin' },
      update: { isSystem: true },
      create: {
        name: 'Admin',
        description: 'Full access to everything, including user and role management.',
        isSystem: true,
      },
    });
    const editorRole = await prisma.role.upsert({
      where: { name: 'Editor' },
      update: {},
      create: {
        name: 'Editor',
        description: 'Full operational control over monitors, incidents, and notifications. No user or role management.',
      },
    });
    const viewerRole = await prisma.role.upsert({
      where: { name: 'Viewer' },
      update: {},
      create: { name: 'Viewer', description: 'Read-only access everywhere.' },
    });

    const allPermissions = await prisma.permission.findMany();
    await assignRolePermissions(prisma, adminRole.id, allPermissions.map((p) => p.id));
    await assignRolePermissions(
      prisma,
      editorRole.id,
      allPermissions.filter((p) => EDITOR_PERMISSION_KEYS.includes(p.key)).map((p) => p.id),
    );
    await assignRolePermissions(
      prisma,
      viewerRole.id,
      allPermissions.filter((p) => VIEWER_PERMISSION_KEYS.includes(p.key)).map((p) => p.id),
    );

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { username },
      update: { password: hashedPassword, active: true, isProtected: true, name },
      create: { username, password: hashedPassword, active: true, isProtected: true, name },
    });
    await prisma.roleUser.upsert({
      where: { roleId_userId: { roleId: adminRole.id, userId: user.id } },
      update: {},
      create: { roleId: adminRole.id, userId: user.id },
    });

    console.log(`[Uptime-DB] Admin user "${user.username}" is ready.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function assignRolePermissions(prisma: PrismaClient, roleId: string, permissionIds: string[]): Promise<void> {
  for (const permissionId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
