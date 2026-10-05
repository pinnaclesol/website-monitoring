import { Injectable } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { MonitorsService } from '../../monitors/monitors.service';
import { UpdateMonitoringSettingsDto } from './dto/update-monitoring-settings.dto';

/** Singleton row: how often and how apps/worker checks each active Monitor (interval, timeout, slow threshold, retries). */
@Injectable()
export class MonitoringSettingsService {
  constructor(
    private readonly prisma: UptimePrismaService,
    private readonly monitorsService: MonitorsService,
  ) {}

  async getOrCreate() {
    const existing = await this.prisma.monitoringSettings.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    // Default (checkIntervalSeconds: 60) comes from the Prisma schema.
    return this.prisma.monitoringSettings.create({ data: {} });
  }

  async update(dto: UpdateMonitoringSettingsDto) {
    const current = await this.getOrCreate();
    const updated = await this.prisma.monitoringSettings.update({
      where: { id: current.id },
      data: dto,
    });

    // Existing monitors' BullMQ schedules were registered with the old
    // interval and won't pick up the new one on their own — re-register
    // every active one so the change is immediate, not just for monitors
    // created/resumed after this point.
    // The retry policy (attempts/backoff) is baked into the same schedule,
    // so changing it needs the same re-registration.
    if (
      updated.checkIntervalSeconds !== current.checkIntervalSeconds ||
      updated.retryAttempts !== current.retryAttempts ||
      updated.retryDelaySeconds !== current.retryDelaySeconds
    ) {
      await this.monitorsService.rescheduleAllActive();
    }

    return updated;
  }
}
