import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { createSiteChecksQueue } from '@uptime/queue';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

const SITE_CHECK_INTERVAL_MS = 60_000;
const SITE_CHECK_JITTER_MS = 10_000;
const SITE_CHECK_JOB_NAME = 'site-check';

/** Stable per-site jobId so repeated create/resume calls re-use (rather than duplicate) the repeatable schedule. */
function siteCheckJobId(siteId: string): string {
  return `site-check:${siteId}`;
}

/**
 * apps/api is the BullMQ *producer* only — it registers/removes the
 * repeatable `site-checks` job and enqueues one-off "check now" jobs. It
 * never performs a health check itself and never imports a BullMQ `Worker`;
 * that consumer side lives exclusively in apps/worker.
 */
@Injectable()
export class SitesService {
  private readonly siteChecksQueue = createSiteChecksQueue();

  constructor(private readonly prisma: UptimePrismaService) {}

  findAll() {
    return this.prisma.site.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findFirst({
      where: { id, deletedAt: null },
    });
    if (!site) {
      throw new NotFoundException(`Site ${id} not found`);
    }
    return site;
  }

  async create(dto: CreateSiteDto) {
    const site = await this.prisma.site.create({
      data: { domain: dto.domain, label: dto.label },
    });
    await this.registerRepeatableCheck(site.id, site.domain);
    return site;
  }

  async update(id: string, dto: UpdateSiteDto) {
    await this.findOne(id);
    return this.prisma.site.update({
      where: { id },
      data: { domain: dto.domain, label: dto.label },
    });
  }

  async remove(id: string): Promise<void> {
    const site = await this.findOne(id);
    await this.prisma.site.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.removeRepeatableCheck(site.id);
  }

  async pause(id: string) {
    const site = await this.findOne(id);
    const updated = await this.prisma.site.update({
      where: { id },
      data: { isPaused: true },
    });
    await this.removeRepeatableCheck(site.id);
    return updated;
  }

  async resume(id: string) {
    const site = await this.findOne(id);
    const updated = await this.prisma.site.update({
      where: { id },
      data: { isPaused: false },
    });
    await this.registerRepeatableCheck(site.id, site.domain);
    return updated;
  }

  /** Enqueues a one-off, high-priority job for this one site. Never writes to a polling table, never calls the site's URL itself. */
  async checkNow(id: string): Promise<void> {
    const site = await this.findOne(id);
    await this.siteChecksQueue.add(
      SITE_CHECK_JOB_NAME,
      { siteId: site.id, domain: site.domain },
      { priority: 1 },
    );
  }

  /**
   * BullMQ 6.x replaced `queue.add(..., { repeat })` + getRepeatableJobs/
   * removeRepeatableByKey with the Job Scheduler API (upsertJobScheduler/
   * removeJobScheduler), and dropped the old `jitter` repeat option
   * entirely. We emulate CLAUDE.md's "jitter spreads thousands of jobs
   * across the 60s window instead of firing them all at once" requirement
   * by randomizing each site's scheduler `startDate` within one interval —
   * every site still repeats every SITE_CHECK_INTERVAL_MS after that, just
   * starting from a staggered offset instead of all in lockstep.
   */
  private async registerRepeatableCheck(siteId: string, domain: string): Promise<void> {
    const jitterOffsetMs = Math.floor(Math.random() * SITE_CHECK_JITTER_MS);

    await this.siteChecksQueue.upsertJobScheduler(
      siteCheckJobId(siteId),
      { every: SITE_CHECK_INTERVAL_MS, startDate: Date.now() + jitterOffsetMs },
      {
        name: SITE_CHECK_JOB_NAME,
        data: { siteId, domain },
        opts: { attempts: 2, backoff: { type: 'fixed', delay: 5000 } },
      },
    );
  }

  private async removeRepeatableCheck(siteId: string): Promise<void> {
    await this.siteChecksQueue.removeJobScheduler(siteCheckJobId(siteId));
  }
}
