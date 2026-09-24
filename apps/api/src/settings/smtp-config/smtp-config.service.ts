import { Injectable } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { UpsertSmtpConfigDto } from './dto/upsert-smtp-config.dto';

const SAFE_SELECT = {
  id: true,
  host: true,
  port: true,
  username: true,
  fromEmail: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Single config (not multi-account, same pattern as SignalConfig) — GET
 * returns it or null, PUT upserts it. `password` is never selected back out
 * — same convention as not returning TelegramAccount.botToken/User.password
 * — callers instead get a `hasPassword` boolean so the UI can show "leave
 * blank to keep current password" without ever seeing the actual secret.
 */
@Injectable()
export class SmtpConfigService {
  constructor(private readonly prisma: UptimePrismaService) {}

  async findCurrent() {
    const config = await this.prisma.smtpConfig.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { ...SAFE_SELECT, password: true },
    });
    if (!config) return null;
    const { password, ...safe } = config;
    return { ...safe, hasPassword: !!password };
  }

  async upsert(dto: UpsertSmtpConfigDto) {
    const existing = await this.prisma.smtpConfig.findFirst({ orderBy: { createdAt: 'desc' } });
    const isActive = dto.isActive ?? true;

    const data = {
      host: dto.host,
      port: dto.port,
      username: dto.username || null,
      fromEmail: dto.fromEmail,
      isActive,
      // Blank/omitted password means "keep the existing one" — only touch
      // the column when a new value was actually provided.
      ...(dto.password ? { password: dto.password } : {}),
    };

    const saved = existing
      ? await this.prisma.smtpConfig.update({
          where: { id: existing.id },
          data,
          select: { ...SAFE_SELECT, password: true },
        })
      : await this.prisma.smtpConfig.create({
          data: { ...data, password: dto.password || null },
          select: { ...SAFE_SELECT, password: true },
        });

    const { password, ...safe } = saved;
    return { ...safe, hasPassword: !!password };
  }
}
