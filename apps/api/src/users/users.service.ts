import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UptimePrismaService } from '@uptime/uptime-db';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Matches libs/uptime-db/src/seed.ts and apps/api/src/auth/auth.service.ts's
// bcrypt usage.
const SALT_ROUNDS = 10;

// Never select `password` back out — same convention as not returning other
// secrets (Telegram bot tokens, Signal numbers) beyond where they're needed.
const SAFE_USER_SELECT = {
  id: true,
  username: true,
  name: true,
  isProtected: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
} as const;

type RawUser = {
  roles: { role: { id: string; name: string } }[];
  [key: string]: unknown;
};

/** Flattens the RoleUser wrapper shape into a plain `roles: [{id,name}]` array for the API response. */
function toApiUser<T extends RawUser>(user: T) {
  const { roles, ...rest } = user;
  return { ...rest, roles: roles.map((ru) => ru.role) };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: UptimePrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(toApiUser);
  }

  async create(dto: CreateUserDto) {
    await this.assertRoleIdsValid(dto.roleIds);
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        name: dto.name,
        password: hashedPassword,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      select: SAFE_USER_SELECT,
    });
    return toApiUser(user);
  }

  async update(id: string, dto: UpdateUserDto, requestingUserId: string) {
    const existing = await this.findExisting(id);

    // The one bootstrap account (always the env-seeded admin) is immutable
    // through this API entirely, by anyone — including itself — so there's
    // always a guaranteed way back in via `npm run uptime:seed`.
    if (existing.isProtected) {
      throw new BadRequestException('The default admin account cannot be modified');
    }

    const existingRoleIds = existing.roles.map((r) => r.roleId).sort();
    const newRoleIds = dto.roleIds !== undefined ? [...dto.roleIds].sort() : undefined;
    const roleIdsChanged = newRoleIds !== undefined && JSON.stringify(newRoleIds) !== JSON.stringify(existingRoleIds);

    // Compare against the *current* value, not just presence — the frontend
    // always sends `roleIds`/`active` on every edit (even unchanged), so a
    // presence-only check would block a user from editing their own
    // username/password too.
    if (id === requestingUserId) {
      if (roleIdsChanged) {
        throw new BadRequestException('You cannot change your own roles');
      }
      if (dto.active !== undefined && dto.active !== existing.active) {
        throw new BadRequestException('You cannot change your own active status');
      }
    }

    if (dto.roleIds !== undefined) {
      await this.assertRoleIdsValid(dto.roleIds);
    }

    const willBeActive = dto.active ?? existing.active;
    const willHoldSystemRole = dto.roleIds !== undefined ? await this.anyIsSystem(dto.roleIds) : existing.isSystemHolder;
    const removesActiveSystemHolder = existing.isSystemHolder && existing.active && (!willHoldSystemRole || !willBeActive);

    if (removesActiveSystemHolder) {
      await this.assertNotLastActiveSystemHolder();
    }

    const hashedPassword = dto.password ? await bcrypt.hash(dto.password, SALT_ROUNDS) : undefined;

    const user = await this.prisma.$transaction(async (tx) => {
      if (dto.roleIds !== undefined) {
        await tx.roleUser.deleteMany({ where: { userId: id } });
        if (dto.roleIds.length > 0) {
          await tx.roleUser.createMany({ data: dto.roleIds.map((roleId) => ({ userId: id, roleId })) });
        }
      }
      return tx.user.update({
        where: { id },
        data: {
          username: dto.username,
          name: dto.name,
          active: dto.active,
          ...(hashedPassword ? { password: hashedPassword } : {}),
        },
        select: SAFE_USER_SELECT,
      });
    });

    return toApiUser(user);
  }

  async remove(id: string, requestingUserId: string): Promise<void> {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const existing = await this.findExisting(id);

    if (existing.isProtected) {
      throw new BadRequestException('The default admin account cannot be deleted');
    }

    if (existing.isSystemHolder && existing.active) {
      await this.assertNotLastActiveSystemHolder();
    }

    await this.prisma.user.delete({ where: { id } });
  }

  private async findExisting(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        active: true,
        isProtected: true,
        roles: { select: { roleId: true, role: { select: { isSystem: true } } } },
      },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return { ...user, isSystemHolder: user.roles.some((r) => r.role.isSystem) };
  }

  private async assertRoleIdsValid(roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    const count = await this.prisma.role.count({ where: { id: { in: roleIds } } });
    if (count !== roleIds.length) {
      throw new BadRequestException('One or more roleIds are invalid');
    }
  }

  private async anyIsSystem(roleIds: string[]): Promise<boolean> {
    if (roleIds.length === 0) return false;
    const count = await this.prisma.role.count({ where: { id: { in: roleIds }, isSystem: true } });
    return count > 0;
  }

  /** Guards the "at least one active user holding an isSystem role" invariant before a role removal, deactivation, or delete. */
  private async assertNotLastActiveSystemHolder(): Promise<void> {
    const activeSystemHolderCount = await this.prisma.user.count({
      where: { active: true, roles: { some: { role: { isSystem: true } } } },
    });
    if (activeSystemHolderCount <= 1) {
      throw new BadRequestException('Cannot remove the last active Admin');
    }
  }
}
