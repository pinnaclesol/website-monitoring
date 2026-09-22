import { Injectable } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

/** Singleton row: general alert behavior shared by all notification channels. */
@Injectable()
export class NotificationSettingsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  async getOrCreate() {
    const existing = await this.prisma.notificationSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return existing;
    }
    // Defaults (alertIntervalSeconds: 300, recoveryAlertEnabled: true) come from the Prisma schema.
    return this.prisma.notificationSettings.create({ data: {} });
  }

  async update(dto: UpdateNotificationSettingsDto) {
    const current = await this.getOrCreate();
    return this.prisma.notificationSettings.update({
      where: { id: current.id },
      data: dto,
    });
  }
}
