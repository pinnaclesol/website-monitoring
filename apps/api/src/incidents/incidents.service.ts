import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@uptime/uptime-db';
import { UptimePrismaService } from '@uptime/uptime-db';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';

/** Trimmed Monitor fields to embed on an Incident so the dashboard can show which monitor it's for without a second round trip. */
const MONITOR_SUMMARY_SELECT = { id: true, domain: true, label: true } as const;
const CHECKS_WINDOW_SIZE = 100;

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  /**
   * The Incidents page's log — displays check events from the recent 100 checks per monitor.
   * Server-side paginated (page/pageSize, default 20/page), with search (matches the monitor's domain or label).
   */
  async findAll(query: ListIncidentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    const monitorWhere: Prisma.MonitorWhereInput = {
      deletedAt: null,
      ...(query.monitorId ? { id: query.monitorId } : {}),
      ...(search
        ? {
            OR: [
              { domain: { contains: search, mode: 'insensitive' } },
              { label: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const monitors = await this.prisma.monitor.findMany({
      where: monitorWhere,
      select: MONITOR_SUMMARY_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    if (monitors.length === 0) {
      return { data: [], total: 0, page, pageSize };
    }

    const monitorIds = monitors.map((m) => m.id);
    const monitorMap = new Map(monitors.map((m) => [m.id, m]));

    // Fetch up to CHECKS_WINDOW_SIZE (100) recent checks for each monitor
    const checksByMonitor = await Promise.all(
      monitorIds.map(async (monitorId) => {
        const checks = await this.prisma.monitorCheck.findMany({
          where: { monitorId },
          orderBy: { timestamp: 'desc' },
          take: CHECKS_WINDOW_SIZE,
        });
        // Reverse so index 0 is the oldest check in this 100-check window (#1 of 100)
        return { monitorId, checks: checks.reverse() };
      })
    );

    const allCheckEvents: Array<{
      id: string;
      monitorId: string;
      timestamp: Date;
      isUp: boolean;
      statusCode: number | null;
      responseTimeMs: number | null;
      error: string | null;
      checkNumber: number;
      totalChecks: number;
      checkLabel: string;
      monitor: { id: string; domain: string; label: string | null };
    }> = [];

    for (const item of checksByMonitor) {
      const monitor = monitorMap.get(item.monitorId);
      if (!monitor) continue;

      const totalChecks = item.checks.length;
      item.checks.forEach((check, index) => {
        const checkNumber = index + 1;
        const isDown = !check.isUp;

        // Status filter:
        // 'open' -> only down checks
        // 'recovered' -> only up checks
        // default ('all') -> show failed/down checks by default
        if (query.status === 'open') {
          if (!isDown) return;
        } else if (query.status === 'recovered') {
          if (!check.isUp) return;
        } else {
          if (!isDown) return;
        }

        allCheckEvents.push({
          id: check.id,
          monitorId: check.monitorId,
          timestamp: check.timestamp,
          isUp: check.isUp,
          statusCode: check.statusCode,
          responseTimeMs: check.responseTimeMs,
          error: check.error,
          checkNumber,
          totalChecks,
          checkLabel: `#${checkNumber} of ${totalChecks}`,
          monitor,
        });
      });
    }

    // Sort events by timestamp descending (newest first)
    allCheckEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = allCheckEvents.length;
    const startIndex = (page - 1) * pageSize;
    const data = allCheckEvents.slice(startIndex, startIndex + pageSize);

    return { data, total, page, pageSize };
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
