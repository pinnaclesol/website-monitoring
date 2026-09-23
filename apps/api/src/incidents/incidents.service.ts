import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';

/** Trimmed Monitor fields to embed on an Incident so the dashboard can show which monitor it's for without a second round trip. */
const MONITOR_SUMMARY_SELECT = { id: true, domain: true, label: true } as const;

/** Read-only. apps/api never writes an Incident row — that's apps/worker's down/recovery state machine. */
@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  findAll(monitorId?: string, openOnly?: boolean) {
    return this.prisma.incident.findMany({
      where: {
        ...(monitorId ? { monitorId } : {}),
        ...(openOnly ? { endedAt: null } : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: { monitor: { select: MONITOR_SUMMARY_SELECT } },
    });
  }

  async findForMonitor(monitorId: string) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id: monitorId, deletedAt: null },
    });
    if (!monitor) {
      throw new NotFoundException(`Monitor ${monitorId} not found`);
    }

    return this.prisma.incident.findMany({
      where: { monitorId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: { monitor: { select: MONITOR_SUMMARY_SELECT } },
    });
    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }
    return incident;
  }
}
