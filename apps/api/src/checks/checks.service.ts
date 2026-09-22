import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';

const DEFAULT_LIMIT = 100;

/**
 * Read-only. apps/api never writes a Check row and never performs a health
 * check itself — that's apps/worker's job exclusively.
 */
@Injectable()
export class ChecksService {
  constructor(private readonly prisma: UptimePrismaService) {}

  async findForSite(siteId: string, limit = DEFAULT_LIMIT) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, deletedAt: null },
    });
    if (!site) {
      throw new NotFoundException(`Site ${siteId} not found`);
    }

    return this.prisma.check.findMany({
      where: { siteId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findOne(id: string) {
    const check = await this.prisma.check.findUnique({ where: { id } });
    if (!check) {
      throw new NotFoundException(`Check ${id} not found`);
    }
    return check;
  }
}
