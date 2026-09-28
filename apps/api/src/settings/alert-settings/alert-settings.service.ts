import { Injectable } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { UpdateAlertSettingsDto } from './dto/update-alert-settings.dto';

/** Singleton row: recovery-alert behavior shared by all notification channels. */
@Injectable()
export class AlertSettingsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  async getOrCreate() {
    const existing = await this.prisma.alertSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return existing;
    }
    // Default (recoveryAlertEnabled: true) comes from the Prisma schema.
    return this.prisma.alertSettings.create({ data: {} });
  }

  async update(dto: UpdateAlertSettingsDto) {
    const current = await this.getOrCreate();
    return this.prisma.alertSettings.update({
      where: { id: current.id },
      data: dto,
    });
  }
}
