import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { SKIP_PERMISSION_CHECK_KEY } from '../decorators/skip-permission-check.decorator';

function makeContext(headers: Record<string, string | undefined>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as never;
}

function makeReflector(metadata: Record<string, unknown>) {
  return { getAllAndOverride: (key: string) => metadata[key] } as never;
}

function makePrismaMock() {
  return { user: { findUnique: jest.fn() } };
}

describe('PermissionGuard', () => {
  it('allows a @Public() route through without looking at x-user-id at all', async () => {
    const prisma = makePrismaMock();
    const guard = new PermissionGuard(makeReflector({ [IS_PUBLIC_KEY]: true }), prisma as never);
    await expect(guard.canActivate(makeContext({}))).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows a @SkipPermissionCheck() route through without a user lookup', async () => {
    const prisma = makePrismaMock();
    const guard = new PermissionGuard(makeReflector({ [SKIP_PERMISSION_CHECK_KEY]: true }), prisma as never);
    await expect(guard.canActivate(makeContext({}))).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a request with no x-user-id header', async () => {
    const prisma = makePrismaMock();
    const guard = new PermissionGuard(makeReflector({}), prisma as never);
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown or inactive user id', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const guard = new PermissionGuard(makeReflector({}), prisma as never);
    await expect(guard.canActivate(makeContext({ 'x-user-id': 'ghost' }))).rejects.toThrow(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValue({ id: 'u1', active: false, roles: [] });
    await expect(guard.canActivate(makeContext({ 'x-user-id': 'u1' }))).rejects.toThrow(UnauthorizedException);
  });

  it('allows a route with no @RequirePermission() as long as the user is active', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', active: true, roles: [] });
    const guard = new PermissionGuard(makeReflector({}), prisma as never);
    await expect(guard.canActivate(makeContext({ 'x-user-id': 'u1' }))).resolves.toBe(true);
  });

  it('denies a route requiring a permission the user does not hold', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      active: true,
      roles: [{ role: { isSystem: false, permissions: [{ permission: { key: 'monitors:view' } }] } }],
    });
    const guard = new PermissionGuard(makeReflector({ [PERMISSION_KEY]: 'users:delete' }), prisma as never);
    await expect(guard.canActivate(makeContext({ 'x-user-id': 'u1' }))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(makeContext({ 'x-user-id': 'u1' }))).rejects.toThrow(
      'Missing required permission: users:delete',
    );
  });

  it('allows a route requiring a permission the user holds via one of several roles', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      active: true,
      roles: [
        { role: { isSystem: false, permissions: [{ permission: { key: 'monitors:view' } }] } },
        { role: { isSystem: false, permissions: [{ permission: { key: 'users:delete' } }] } },
      ],
    });
    const guard = new PermissionGuard(makeReflector({ [PERMISSION_KEY]: 'users:delete' }), prisma as never);
    await expect(guard.canActivate(makeContext({ 'x-user-id': 'u1' }))).resolves.toBe(true);
  });

  it('CRITICAL: a user holding an isSystem role passes ANY @RequirePermission() check, even one no RolePermission row grants', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin1',
      active: true,
      // isSystem: true with an empty/stale permissions array on purpose —
      // the bypass must not depend on RolePermission rows being complete.
      roles: [{ role: { isSystem: true, permissions: [] } }],
    });
    const guard = new PermissionGuard(makeReflector({ [PERMISSION_KEY]: 'roles:delete' }), prisma as never);
    await expect(guard.canActivate(makeContext({ 'x-user-id': 'admin1' }))).resolves.toBe(true);
  });

  it('resolves permissions fresh from the DB on every call — never caches across invocations', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      active: true,
      roles: [{ role: { isSystem: false, permissions: [{ permission: { key: 'monitors:view' } }] } }],
    });
    const guard = new PermissionGuard(makeReflector({ [PERMISSION_KEY]: 'monitors:view' }), prisma as never);

    await guard.canActivate(makeContext({ 'x-user-id': 'u1' }));
    await guard.canActivate(makeContext({ 'x-user-id': 'u1' }));

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });
});
