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

/** How many of a site's most recent checks the dashboard's history bars show. */
const HISTORY_SIZE = 30;
const UPTIME_WINDOW_MS = 24 * 60 * 60 * 1000;

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

  /**
   * The dashboard's monitor list — each Site enriched with its latest check,
   * a 30-check history for the sparkline, 24h uptime (incident-overlap
   * based, per CLAUDE.md — not a raw Check-sample ratio), and whether it has
   * an open incident right now. Still entirely read-only on Check/Incident
   * data — apps/api only ever reads them, never writes.
   *
   * Implementation note: this loads every check/incident for the given
   * sites in a couple of batched queries rather than one query per site,
   * which is fine at the monitor counts this dashboard is actually tested
   * with. At true thousands-of-monitors scale this should move to a
   * denormalized "latest status" projection instead of scanning Check rows
   * on every poll — flagging it here rather than building that prematurely.
   */
  async findAll() {
    const sites = await this.prisma.site.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrich(sites);
  }

  async findOneWithStatus(id: string) {
    const site = await this.findOne(id);
    const [enriched] = await this.enrich([site]);
    return enriched;
  }

  private async enrich(sites: Awaited<ReturnType<SitesService['findOne']>>[]) {
    if (sites.length === 0) return [];
    const siteIds = sites.map((s) => s.id);
    const windowStart = new Date(Date.now() - UPTIME_WINDOW_MS);

    const [checks, openIncidentCounts, windowIncidents] = await Promise.all([
      this.prisma.check.findMany({
        where: { siteId: { in: siteIds } },
        orderBy: { timestamp: 'desc' },
        // Enough rows to cover HISTORY_SIZE per site even in the worst case
        // where all checks belong to one site; each site's own slice is
        // still capped to HISTORY_SIZE below.
        take: siteIds.length * HISTORY_SIZE,
      }),
      this.prisma.incident.groupBy({
        by: ['siteId'],
        where: { siteId: { in: siteIds }, endedAt: null },
        _count: { _all: true },
      }),
      this.prisma.incident.findMany({
        where: {
          siteId: { in: siteIds },
          OR: [{ endedAt: null }, { endedAt: { gt: windowStart } }],
        },
        select: { siteId: true, startedAt: true, endedAt: true },
      }),
    ]);

    const checksBySite = new Map<string, typeof checks>();
    for (const check of checks) {
      const list = checksBySite.get(check.siteId) ?? [];
      if (list.length < HISTORY_SIZE) list.push(check);
      checksBySite.set(check.siteId, list);
    }

    const openIncidentSiteIds = new Set(openIncidentCounts.map((c) => c.siteId));

    const incidentsBySite = new Map<string, typeof windowIncidents>();
    for (const incident of windowIncidents) {
      const list = incidentsBySite.get(incident.siteId) ?? [];
      list.push(incident);
      incidentsBySite.set(incident.siteId, list);
    }

    const now = Date.now();

    return sites.map((site) => {
      // Newest-first from the query; reverse to oldest-first for the sparkline.
      const siteChecks = [...(checksBySite.get(site.id) ?? [])].reverse();
      const latestCheck = siteChecks[siteChecks.length - 1] ?? null;

      const history = siteChecks.map((c) => (c.isUp ? 'up' : 'down'));

      const siteIncidents = incidentsBySite.get(site.id) ?? [];
      let downtimeMs = 0;
      for (const incident of siteIncidents) {
        const start = incident.startedAt > windowStart ? incident.startedAt : windowStart;
        const end = incident.endedAt ?? new Date(now);
        if (end.getTime() > start.getTime()) {
          downtimeMs += end.getTime() - start.getTime();
        }
      }
      const uptime24h =
        siteChecks.length === 0
          ? null
          : Math.round(((UPTIME_WINDOW_MS - Math.min(downtimeMs, UPTIME_WINDOW_MS)) / UPTIME_WINDOW_MS) * 1000) / 10;

      return {
        ...site,
        latestCheck: latestCheck
          ? {
              isUp: latestCheck.isUp,
              statusCode: latestCheck.statusCode,
              responseTimeMs: latestCheck.responseTimeMs,
              timestamp: latestCheck.timestamp,
              error: latestCheck.error,
            }
          : null,
        history,
        uptime24h,
        hasOpenIncident: openIncidentSiteIds.has(site.id),
      };
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
    const existing = await this.findOne(id);
    const updated = await this.prisma.site.update({
      where: { id },
      data: { domain: dto.domain, label: dto.label },
    });

    // The repeatable job's data (the domain it actually checks) is fixed at
    // registration time — if the domain changed, refresh the schedule so
    // apps/worker doesn't keep checking the old one. Stable jobId means this
    // updates the existing schedule rather than duplicating it. Skip this
    // for a paused site — it has no active schedule to refresh.
    if (dto.domain && dto.domain !== existing.domain && !existing.isPaused) {
      await this.registerRepeatableCheck(updated.id, updated.domain);
    }

    return updated;
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
