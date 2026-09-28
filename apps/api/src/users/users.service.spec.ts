import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

function makePrismaMock() {
  return {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    role: { count: jest.fn() },
    $transaction: jest.fn(),
  };
}

const ADMIN_ROLE = { roleId: 'role_admin', role: { isSystem: true } };
const VIEWER_ROLE = { roleId: 'role_viewer', role: { isSystem: false } };

describe('UsersService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: UsersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new UsersService(prisma as never);
  });

  describe('create', () => {
    it('rejects an invalid roleId', async () => {
      prisma.role.count.mockResolvedValue(0);
      await expect(
        service.create({ username: 'x', password: 'password123', roleIds: ['bogus'] } as never),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('update — self-lockout', () => {
    it('a user cannot change their own role assignment', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        active: true,
        isProtected: false,
        roles: [VIEWER_ROLE],
      });
      await expect(
        service.update('u1', { roleIds: ['role_editor'] } as never, 'u1'),
      ).rejects.toThrow('You cannot change your own roles');
    });

    it('a user CAN re-submit their own current roles unchanged (frontend always sends roleIds)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        active: true,
        isProtected: false,
        roles: [VIEWER_ROLE],
      });
      prisma.role.count.mockResolvedValue(1);
      const tx = { roleUser: { deleteMany: jest.fn(), createMany: jest.fn() }, user: { update: jest.fn().mockResolvedValue({ id: 'u1', roles: [] }) } };
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));

      await expect(
        service.update('u1', { roleIds: ['role_viewer'], active: true } as never, 'u1'),
      ).resolves.toBeDefined();
    });

    it('a user cannot change their own active status', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        active: true,
        isProtected: false,
        roles: [VIEWER_ROLE],
      });
      await expect(service.update('u1', { active: false } as never, 'u1')).rejects.toThrow(
        'You cannot change your own active status',
      );
    });
  });

  describe('update — bootstrap admin immutability', () => {
    it('refuses ANY update to the isProtected bootstrap admin, even by itself', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin1',
        active: true,
        isProtected: true,
        roles: [ADMIN_ROLE],
      });
      await expect(service.update('admin1', { name: 'New Name' } as never, 'someone-else')).rejects.toThrow(
        'The default admin account cannot be modified',
      );
    });
  });

  describe('update — last active isSystem-role holder', () => {
    it('CRITICAL: blocks removing the isSystem role from the only active holder', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin2',
        active: true,
        isProtected: false,
        roles: [ADMIN_ROLE],
      });
      prisma.role.count.mockResolvedValueOnce(1); // assertRoleIdsValid: role_viewer exists
      prisma.role.count.mockResolvedValueOnce(0); // anyIsSystem: new roleIds contain no isSystem role
      prisma.user.count.mockResolvedValue(1); // this user is the only active isSystem holder

      await expect(
        service.update('admin2', { roleIds: ['role_viewer'] } as never, 'requester'),
      ).rejects.toThrow('Cannot remove the last active Admin');
    });

    it('CRITICAL: blocks deactivating the only active isSystem-role holder', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin2',
        active: true,
        isProtected: false,
        roles: [ADMIN_ROLE],
      });
      prisma.user.count.mockResolvedValue(1);

      await expect(service.update('admin2', { active: false } as never, 'requester')).rejects.toThrow(
        'Cannot remove the last active Admin',
      );
    });

    it('allows demoting a non-system-holding-critical admin when another active isSystem holder still exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin2',
        active: true,
        isProtected: false,
        roles: [ADMIN_ROLE],
      });
      prisma.role.count.mockResolvedValueOnce(1); // assertRoleIdsValid: role_viewer exists
      prisma.role.count.mockResolvedValueOnce(0); // anyIsSystem: new roleIds contain no isSystem role
      prisma.user.count.mockResolvedValue(2); // at least one other active isSystem holder besides this one
      const tx = { roleUser: { deleteMany: jest.fn(), createMany: jest.fn() }, user: { update: jest.fn().mockResolvedValue({ id: 'admin2', roles: [] }) } };
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));

      await expect(
        service.update('admin2', { roleIds: ['role_viewer'] } as never, 'requester'),
      ).resolves.toBeDefined();
    });

    it('does not run the last-active-holder check for a user who never held an isSystem role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        active: true,
        isProtected: false,
        roles: [VIEWER_ROLE],
      });
      prisma.role.count.mockResolvedValue(1);
      const tx = { roleUser: { deleteMany: jest.fn(), createMany: jest.fn() }, user: { update: jest.fn().mockResolvedValue({ id: 'u1', roles: [] }) } };
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));

      await service.update('u1', { roleIds: ['role_editor'] } as never, 'requester');
      expect(prisma.user.count).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('a user cannot delete their own account', async () => {
      await expect(service.remove('u1', 'u1')).rejects.toThrow('You cannot delete your own account');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('404s deleting an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope', 'requester')).rejects.toThrow(NotFoundException);
    });

    it('refuses to delete the isProtected bootstrap admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin1', active: true, isProtected: true, roles: [ADMIN_ROLE] });
      await expect(service.remove('admin1', 'requester')).rejects.toThrow('The default admin account cannot be deleted');
    });

    it('CRITICAL: refuses to delete the last active isSystem-role holder', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin2', active: true, isProtected: false, roles: [ADMIN_ROLE] });
      prisma.user.count.mockResolvedValue(1);
      await expect(service.remove('admin2', 'requester')).rejects.toThrow('Cannot remove the last active Admin');
    });

    it('allows deleting a non-critical user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', active: true, isProtected: false, roles: [VIEWER_ROLE] });
      await service.remove('u1', 'requester');
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });
});
