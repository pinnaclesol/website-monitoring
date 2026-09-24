import { Injectable } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { MonitorsService } from '../../monitors/monitors.service';
import { UpdateMonitoringSettingsDto } from './dto/update-monitoring-settings.dto';

/** Singleton row: how often apps/worker checks each active Monitor. */
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
    if (updated.checkIntervalSeconds !== current.checkIntervalSeconds) {
      await this.monitorsService.rescheduleAllActive();
    }

    return updated;
  }
}
