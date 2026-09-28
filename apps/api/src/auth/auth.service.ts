import { Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UptimePrismaService } from '@uptime/uptime-db';
import type { AuthUser } from '@uptime/auth';
import { ValidateUserDto } from './dto/validate-user.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: UptimePrismaService) {}

  /**
   * Single-admin login check. Deliberately returns the same generic error
   * for "no such user", "wrong password", and "inactive user" so callers
   * can't distinguish which one failed. Never returns or logs the password
   * hash.
   */
  async validate(dto: ValidateUserDto): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.roles.map((ru) => ({ id: ru.role.id, name: ru.role.name }));

    // Any held role being `isSystem` (the seeded Admin role, or any future
    // one) bypasses per-permission checks entirely — same reasoning as the
    // old fixed ADMIN: 'ALL' bypass, now generalized to any isSystem role.
    const isSystemBypass = user.roles.some((ru) => ru.role.isSystem);
    const permissions = isSystemBypass
      ? (await this.prisma.permission.findMany({ select: { key: true } })).map((p) => p.key)
      : [...new Set(user.roles.flatMap((ru) => ru.role.permissions.map((rp) => rp.permission.key)))];

    return { id: user.id, username: user.username, name: user.name, roles, permissions };
  }
}
