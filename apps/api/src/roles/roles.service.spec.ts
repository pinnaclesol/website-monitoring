import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';

function makePrismaMock() {
  return {
    role: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    roleUser: {
      count: jest.fn(),
    },
    rolePermission: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe('RolesService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: RolesService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new RolesService(prisma as never);
  });

  describe('create', () => {
    it('rejects an invalid permissionId', async () => {
      prisma.permission.count.mockResolvedValue(1); // asked for 2, only 1 exists
      await expect(
        service.create({ name: 'Support', permissionIds: ['perm_a', 'perm_bogus'] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.role.create).not.toHaveBeenCalled();
    });

    it('creates a role with the given permissions when all ids are valid', async () => {
      prisma.permission.count.mockResolvedValue(2);
      prisma.role.create.mockResolvedValue({ id: 'role_x', name: 'Support' });
      const result = await service.create({ name: 'Support', permissionIds: ['perm_a', 'perm_b'] });
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Support',
            permissions: { create: [{ permissionId: 'perm_a' }, { permissionId: 'perm_b' }] },
          }),
        }),
      );
      expect(result).toEqual({ id: 'role_x', name: 'Support' });
    });
  });

  describe('update', () => {
    it('CRITICAL: refuses to modify the isSystem (Admin) role at all', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role_admin', isSystem: true });
      await expect(service.update('role_admin', { name: 'Not Admin' })).rejects.toThrow(BadRequestException);
      await expect(service.update('role_admin', { name: 'Not Admin' })).rejects.toThrow(
        'The Admin role cannot be modified',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('404s on an unknown role id', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('replaces (not merges) RolePermission rows for a non-system role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role_editor', isSystem: false });
      prisma.permission.count.mockResolvedValue(1);
      const tx = {
        rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
        role: { update: jest.fn().mockResolvedValue({ id: 'role_editor', name: 'Editor' }) },
      };
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));

      await service.update('role_editor', { permissionIds: ['perm_only_one'] });

      expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role_editor' } });
      expect(tx.rolePermission.createMany).toHaveBeenCalledWith({
        data: [{ roleId: 'role_editor', permissionId: 'perm_only_one' }],
      });
    });

    it('rejects an invalid permissionId on update the same as on create', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role_editor', isSystem: false });
      prisma.permission.count.mockResolvedValue(0);
      await expect(service.update('role_editor', { permissionIds: ['perm_bogus'] })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('CRITICAL: refuses to delete the isSystem (Admin) role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role_admin', isSystem: true });
      await expect(service.remove('role_admin')).rejects.toThrow(BadRequestException);
      await expect(service.remove('role_admin')).rejects.toThrow('The Admin role cannot be deleted');
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete a role still assigned to users', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role_support', isSystem: false });
      prisma.roleUser.count.mockResolvedValue(3);
      await expect(service.remove('role_support')).rejects.toThrow(ConflictException);
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('deletes a role with zero users assigned', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role_support', isSystem: false });
      prisma.roleUser.count.mockResolvedValue(0);
      await service.remove('role_support');
      expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 'role_support' } });
    });
  });

  describe('findOne', () => {
    it('404s on an unknown id', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });

    it('flattens RolePermission rows into a plain permissionIds array', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role_editor',
        name: 'Editor',
        permissions: [{ permissionId: 'perm_a' }, { permissionId: 'perm_b' }],
      });
      const result = await service.findOne('role_editor');
      expect(result.permissionIds).toEqual(['perm_a', 'perm_b']);
      expect(result).not.toHaveProperty('permissions');
    });
  });
});
