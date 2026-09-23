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
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { id: user.id, username: user.username, name: user.name, role: user.role };
  }
}
