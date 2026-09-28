import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@uptime/uptime-db';
import { UptimePrismaService } from '@uptime/uptime-db';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';

/** Trimmed Monitor fields to embed on an Incident so the dashboard can show which monitor it's for without a second round trip. */
const MONITOR_SUMMARY_SELECT = { id: true, domain: true, label: true } as const;

/** Read-only. apps/api never writes an Incident row — that's apps/worker's down/recovery state machine. */
@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  /**
   * The Incidents page's log — **server-side paginated** (page/pageSize,
   * default 20/page), with search (matches the incident's monitor's domain
   * or label) and a status filter (open/recovered) applied in the DB query
   * itself, same pattern as `MonitorsService.findAll()`.
   */
  async findAll(query: ListIncidentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    const where: Prisma.IncidentWhereInput = {
      ...(query.monitorId ? { monitorId: query.monitorId } : {}),
      ...(query.status === 'open' ? { endedAt: null } : query.status === 'recovered' ? { endedAt: { not: null } } : {}),
      ...(search
        ? {
            monitor: {
              OR: [
                { domain: { contains: search, mode: 'insensitive' } },
                { label: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { monitor: { select: MONITOR_SUMMARY_SELECT } },
      }),
    ]);

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
