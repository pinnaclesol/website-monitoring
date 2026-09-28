import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';

const DEFAULT_LIMIT = 100;

/**
 * Read-only. apps/api never writes a MonitorCheck row and never performs a
 * health check itself — that's apps/worker's job exclusively.
 */
@Injectable()
export class ChecksService {
  constructor(private readonly prisma: UptimePrismaService) {}

  async findForMonitor(monitorId: string, limit = DEFAULT_LIMIT) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id: monitorId, deletedAt: null },
    });
    if (!monitor) {
      throw new NotFoundException(`Monitor ${monitorId} not found`);
    }

    return this.prisma.monitorCheck.findMany({
      where: { monitorId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findOne(id: string) {
    const check = await this.prisma.monitorCheck.findUnique({ where: { id } });
    if (!check) {
      throw new NotFoundException(`Check ${id} not found`);
    }
    return check;
  }
}
