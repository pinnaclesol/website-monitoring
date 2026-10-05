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

  /** Whether apps/worker has the proxy configured — it reads the same root .env, so the dashboard can say whether `locations` will actually be used. */
  private proxyEnabled(): boolean {
    const { SMARTPROXY_ENABLED, SMARTPROXY_HOST, SMARTPROXY_PORT, SMARTPROXY_USERNAME, SMARTPROXY_PASSWORD } = process.env;
    return SMARTPROXY_ENABLED === 'true' && !!(SMARTPROXY_HOST && SMARTPROXY_PORT && SMARTPROXY_USERNAME && SMARTPROXY_PASSWORD);
  }

  async getOrCreate() {
    return { ...(await this.findOrCreateRow()), proxyEnabled: this.proxyEnabled() };
  }

  private async findOrCreateRow() {
    const existing = await this.prisma.monitoringSettings.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    // Defaults (interval, timeout, retries, locations) come from the Prisma schema.
    return this.prisma.monitoringSettings.create({ data: {} });
  }

  async update(dto: UpdateMonitoringSettingsDto) {
    const current = await this.findOrCreateRow();
    const updated = await this.prisma.monitoringSettings.update({
      where: { id: current.id },
      // US is the primary location apps/worker always checks first, so it can
      // never be deselected; the rest only confirm a failure.
      data: dto.locations ? { ...dto, locations: ['US', ...dto.locations.filter((l) => l !== 'US')] } : dto,
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

    return { ...updated, proxyEnabled: this.proxyEnabled() };
  }
}
