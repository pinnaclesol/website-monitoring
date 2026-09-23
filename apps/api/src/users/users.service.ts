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
  role: true,
  isProtected: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: UptimePrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: { username: dto.username, name: dto.name, password: hashedPassword, role: dto.role },
      select: SAFE_USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, requestingUserId: string) {
    const existing = await this.findExisting(id);

    // The one bootstrap account (always the env-seeded admin) is immutable
    // through this API entirely, by anyone — including itself — so there's
    // always a guaranteed way back in via `npm run uptime:seed`.
    if (existing.isProtected) {
      throw new BadRequestException('The default admin account cannot be modified');
    }

    // Compare against the *current* value, not just presence — the frontend
    // always sends `role`/`active` on every edit (even unchanged), so a
    // presence-only check would block a user from editing their own
    // username/password too.
    if (id === requestingUserId) {
      if (dto.role !== undefined && dto.role !== existing.role) {
        throw new BadRequestException('You cannot change your own role');
      }
      if (dto.active !== undefined && dto.active !== existing.active) {
        throw new BadRequestException('You cannot change your own active status');
      }
    }

    const removesActiveAdmin =
      existing.role === 'ADMIN' &&
      existing.active &&
      ((dto.role !== undefined && dto.role !== 'ADMIN') || dto.active === false);

    if (removesActiveAdmin) {
      await this.assertNotLastActiveAdmin();
    }

    const data: {
      username?: string;
      name?: string | null;
      password?: string;
      role?: UpdateUserDto['role'];
      active?: boolean;
    } = {
      username: dto.username,
      name: dto.name,
      role: dto.role,
      active: dto.active,
    };

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_USER_SELECT,
    });
  }

  async remove(id: string, requestingUserId: string): Promise<void> {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const existing = await this.findExisting(id);

    if (existing.isProtected) {
      throw new BadRequestException('The default admin account cannot be deleted');
    }

    if (existing.role === 'ADMIN' && existing.active) {
      await this.assertNotLastActiveAdmin();
    }

    await this.prisma.user.delete({ where: { id } });
  }

  private async findExisting(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, active: true, isProtected: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  /** Guards the "at least one active Admin" invariant before a demotion, deactivation, or delete. */
  private async assertNotLastActiveAdmin(): Promise<void> {
    const activeAdminCount = await this.prisma.user.count({
      where: { role: 'ADMIN', active: true },
    });
    if (activeAdminCount <= 1) {
      throw new BadRequestException('Cannot remove the last active Admin');
    }
  }
}
