import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ROLE_SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { permissions: true, users: true } },
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: UptimePrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      select: ROLE_SUMMARY_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** The fixed permission catalog — grouped client-side by `resource`/`action` to render the checkbox grid, never created/edited through this API. */
  findAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { ...ROLE_SUMMARY_SELECT, permissions: { select: { permissionId: true } } },
    });
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    const { permissions, ...rest } = role;
    return { ...rest, permissionIds: permissions.map((p) => p.permissionId) };
  }

  async create(dto: CreateRoleDto) {
    await this.assertPermissionIdsValid(dto.permissionIds);
    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: { create: dto.permissionIds.map((permissionId) => ({ permissionId })) },
      },
      select: ROLE_SUMMARY_SELECT,
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const existing = await this.findExisting(id);
    if (existing.isSystem) {
      throw new BadRequestException('The Admin role cannot be modified');
    }
    if (dto.permissionIds !== undefined) {
      await this.assertPermissionIdsValid(dto.permissionIds);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds !== undefined) {
        // Replace, not diff/patch — the checkbox grid always submits its
        // full current state.
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (dto.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          });
        }
      }
      return tx.role.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
        select: ROLE_SUMMARY_SELECT,
      });
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findExisting(id);
    if (existing.isSystem) {
      throw new BadRequestException('The Admin role cannot be deleted');
    }

    const userCount = await this.prisma.roleUser.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new ConflictException(
        `Cannot delete a role while ${userCount} user(s) still hold it — reassign them first`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
  }

  private async findExisting(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, select: { id: true, isSystem: true } });
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    return role;
  }

  private async assertPermissionIdsValid(permissionIds: string[]): Promise<void> {
    if (permissionIds.length === 0) return;
    const count = await this.prisma.permission.count({ where: { id: { in: permissionIds } } });
    if (count !== permissionIds.length) {
      throw new BadRequestException('One or more permissionIds are invalid');
    }
  }
}
