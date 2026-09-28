import bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn() },
    permission: { findMany: jest.fn() },
  };
}

const FULL_CATALOG = [
  { key: 'monitors:view' },
  { key: 'monitors:create' },
  { key: 'monitors:update' },
  { key: 'monitors:delete' },
  { key: 'incidents:view' },
  { key: 'notifications:view' },
  { key: 'notifications:update' },
  { key: 'settings:view' },
  { key: 'settings:update' },
  { key: 'users:view' },
  { key: 'users:create' },
  { key: 'users:update' },
  { key: 'users:delete' },
  { key: 'roles:view' },
  { key: 'roles:create' },
  { key: 'roles:update' },
  { key: 'roles:delete' },
];

describe('AuthService.validate', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AuthService(prisma as never);
  });

  it('rejects an unknown username with a generic "Invalid credentials" error', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.validate({ username: 'nobody', password: 'x' })).rejects.toThrow(UnauthorizedException);
    await expect(service.validate({ username: 'nobody', password: 'x' })).rejects.toThrow('Invalid credentials');
  });

  it('rejects an inactive user with the same generic error (never reveals which check failed)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'inactive',
      password: await bcrypt.hash('correct', 10),
      active: false,
      name: null,
      roles: [],
    });
    await expect(service.validate({ username: 'inactive', password: 'correct' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong password with the same generic error', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      password: await bcrypt.hash('correct', 10),
      active: true,
      name: null,
      roles: [],
    });
    await expect(service.validate({ username: 'admin', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
  });

  it('never leaks the password hash in the returned AuthUser', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'viewer',
      password: hash,
      active: true,
      name: null,
      roles: [
        {
          role: {
            id: 'role_viewer',
            name: 'Viewer',
            isSystem: false,
            permissions: [{ permission: { key: 'monitors:view' } }],
          },
        },
      ],
    });
    const result = await service.validate({ username: 'viewer', password: 'correct' });
    expect(result).not.toHaveProperty('password');
    expect(JSON.stringify(result)).not.toContain(hash);
  });

  it('CRITICAL: a user holding an isSystem role (superadmin) gets every permission in the catalog, not just its own RolePermission rows', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin1',
      username: 'admin',
      password: hash,
      active: true,
      name: 'Super Admin',
      roles: [
        {
          role: {
            id: 'role_admin',
            name: 'Admin',
            isSystem: true,
            // Deliberately sparse/stale RolePermission rows — a real isSystem
            // role always has every row seeded, but the bypass must not
            // depend on that: it must ignore RolePermission entirely and
            // fetch the live full catalog instead. This is exactly the
            // "newly added Permission automatically covers Admins with no
            // seed/migration update" guarantee from CLAUDE.md.
            permissions: [{ permission: { key: 'monitors:view' } }],
          },
        },
      ],
    });
    prisma.permission.findMany.mockResolvedValue(FULL_CATALOG);

    const result = await service.validate({ username: 'admin', password: 'correct' });

    expect(prisma.permission.findMany).toHaveBeenCalled();
    expect(result.permissions).toHaveLength(FULL_CATALOG.length);
    expect(new Set(result.permissions)).toEqual(new Set(FULL_CATALOG.map((p) => p.key)));
    expect(result.roles).toEqual([{ id: 'role_admin', name: 'Admin' }]);
  });

  it('a non-system role only gets the union of its own held roles' + "' permissions, not the full catalog", async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      username: 'multi',
      password: hash,
      active: true,
      name: null,
      roles: [
        {
          role: {
            id: 'role_support',
            name: 'Support',
            isSystem: false,
            permissions: [{ permission: { key: 'monitors:view' } }, { permission: { key: 'incidents:view' } }],
          },
        },
        {
          role: {
            id: 'role_editor',
            name: 'Editor',
            isSystem: false,
            permissions: [
              { permission: { key: 'monitors:view' } }, // duplicate across roles — must be deduped
              { permission: { key: 'monitors:create' } },
            ],
          },
        },
      ],
    });

    const result = await service.validate({ username: 'multi', password: 'correct' });

    expect(prisma.permission.findMany).not.toHaveBeenCalled();
    expect(result.permissions.sort()).toEqual(['incidents:view', 'monitors:create', 'monitors:view'].sort());
    expect(result.roles).toEqual([
      { id: 'role_support', name: 'Support' },
      { id: 'role_editor', name: 'Editor' },
    ]);
  });

  it('a user with no roles at all gets an empty permission set, not an error', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u3',
      username: 'noroles',
      password: hash,
      active: true,
      name: null,
      roles: [],
    });

    const result = await service.validate({ username: 'noroles', password: 'correct' });
    expect(result.permissions).toEqual([]);
    expect(result.roles).toEqual([]);
  });
});
