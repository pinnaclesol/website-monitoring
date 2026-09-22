import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';

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
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }
    return incident;
  }
}
