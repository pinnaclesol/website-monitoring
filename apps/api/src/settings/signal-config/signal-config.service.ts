import { Injectable } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { UpsertSignalConfigDto } from './dto/upsert-signal-config.dto';

/** Single config (not multi-account) — GET returns it or null, PUT upserts it. */
@Injectable()
export class SignalConfigService {
  constructor(private readonly prisma: UptimePrismaService) {}

  findCurrent() {
    return this.prisma.signalConfig.findFirst({ orderBy: { createdAt: 'desc' } });
  }

  async upsert(dto: UpsertSignalConfigDto) {
    const existing = await this.findCurrent();
    const isActive = dto.isActive ?? true;

    if (!existing) {
      return this.prisma.signalConfig.create({
        data: {
          senderNumber: dto.senderNumber,
          recipientNumber: dto.recipientNumber,
          isActive,
        },
      });
    }

    return this.prisma.signalConfig.update({
      where: { id: existing.id },
      data: {
        senderNumber: dto.senderNumber,
        recipientNumber: dto.recipientNumber,
        isActive,
      },
    });
  }
}
