import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';

/** Trimmed Site fields to embed on an Incident so the dashboard can show which monitor it's for without a second round trip. */
const SITE_SUMMARY_SELECT = { id: true, domain: true, label: true } as const;

/** Read-only. apps/api never writes an Incident row — that's apps/worker's down/recovery state machine. */
@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  findAll(siteId?: string, openOnly?: boolean) {
    return this.prisma.incident.findMany({
      where: {
        ...(siteId ? { siteId } : {}),
        ...(openOnly ? { endedAt: null } : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: { site: { select: SITE_SUMMARY_SELECT } },
    });
  }

  async findForSite(siteId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, deletedAt: null },
    });
    if (!site) {
      throw new NotFoundException(`Site ${siteId} not found`);
    }

    return this.prisma.incident.findMany({
      where: { siteId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: { site: { select: SITE_SUMMARY_SELECT } },
    });
    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }
    return incident;
  }
}
