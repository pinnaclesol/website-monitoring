import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@uptime/uptime-db';
import { UptimePrismaService } from '@uptime/uptime-db';
import { createMonitorChecksQueue } from '@uptime/queue';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';
import { ListMonitorsQueryDto, type MonitorStatusFilter } from './dto/list-monitors-query.dto';

const MONITOR_CHECK_JITTER_MS = 10_000;
const MONITOR_CHECK_JOB_NAME = 'monitor-check';

// Requires at least two dot-separated labels (blocks bare garbage like
// "asdf") — mirrors the same check apps/web's monitor modal runs client-side
// for instant feedback; this is the real, never-trust-the-client boundary.
const HOSTNAME_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

/** Stable per-monitor jobId so repeated create/resume calls re-use (rather than duplicate) the repeatable schedule. */
function monitorCheckJobId(monitorId: string): string {
  return `monitor-check:${monitorId}`;
}

/** How many of a monitor's most recent checks the dashboard's history bars show. */
const HISTORY_SIZE = 30;
const UPTIME_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * apps/api is the BullMQ *producer* only — it registers/removes the
 * repeatable `monitor-checks` job and enqueues one-off "check now" jobs. It
 * never performs a health check itself and never imports a BullMQ `Worker`;
 * that consumer side lives exclusively in apps/worker.
 */
@Injectable()
export class MonitorsService {
  private readonly monitorChecksQueue = createMonitorChecksQueue();

  constructor(private readonly prisma: UptimePrismaService) {}

  /**
   * The dashboard's monitor list — **server-side paginated** (page/pageSize,
   * default 20/page) with search and status filtering done in the DB query
   * itself, not client-side over a fully-loaded array — the whole point at
   * thousands-of-monitors scale is that the browser only ever holds one
   * page's worth of monitors, and only that page's checks/incidents get
   * enriched below. Each returned Monitor carries its latest check, a
   * 30-check history for the sparkline, 24h uptime (incident-overlap based,
   * per CLAUDE.md — not a raw MonitorCheck-sample ratio), and whether it has
   * an open incident right now. Still entirely read-only on
   * MonitorCheck/Incident data — apps/api only ever reads them, never
   * writes. Dashboard-wide aggregates (total counts, avg response time) do
   * NOT come from this paginated list — see `computeStats()`, which scans
   * every monitor regardless of page.
   */
  async findAll(query: ListMonitorsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildListWhere(query);

    const [total, monitors] = await Promise.all([
      this.prisma.monitor.count({ where }),
      this.prisma.monitor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data: await this.enrich(monitors), total, page, pageSize };
  }

  private buildListWhere(query: ListMonitorsQueryDto): Prisma.MonitorWhereInput {
    const search = query.search?.trim();
    return {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { domain: { contains: search, mode: 'insensitive' } },
              { label: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...this.statusWhere(query.status ?? 'all'),
    };
  }

  /**
   * Mirrors `apps/web`'s `monitorStatus()` derivation exactly (isPaused
   * first, then whether it's ever been checked, then its latest result) —
   * expressed as `Monitor`↔`MonitorCheck`/`Incident` relation filters so
   * the DB does the filtering, not a client-side `.filter()` over every
   * monitor.
   */
  private statusWhere(status: MonitorStatusFilter): Prisma.MonitorWhereInput {
    switch (status) {
      case 'paused':
        return { isPaused: true };
      case 'down':
        return { isPaused: false, incidents: { some: { endedAt: null } } };
      case 'up':
        return { isPaused: false, incidents: { none: { endedAt: null } }, checks: { some: {} } };
      case 'checking':
        return { isPaused: false, checks: { none: {} } };
      case 'all':
      default:
        return {};
    }
  }

  /**
   * Dashboard-wide stat-card figures (total/up/down/longest ongoing outage)
   * — computed across *every* non-deleted monitor, independent of the
   * paginated list's current page/search/status filter. `down` here mirrors
   * the stat card's pre-existing definition (latest check failed);
   * `openIncidents` is the separate, state-machine-confirmed "down" count
   * the incident banner uses (see its own comment below for why they can
   * differ). `distinct: ['monitorId']` gets each monitor's single latest
   * check in one indexed query — no per-monitor round trip, no over-fetch.
   */
  async computeStats() {
    const [total, paused, activeMonitors] = await Promise.all([
      this.prisma.monitor.count({ where: { deletedAt: null } }),
      this.prisma.monitor.count({ where: { deletedAt: null, isPaused: true } }),
      this.prisma.monitor.findMany({ where: { deletedAt: null, isPaused: false }, select: { id: true } }),
    ]);
    const activeIds = activeMonitors.map((m) => m.id);

    let up = 0;
    let down = 0;

    if (activeIds.length > 0) {
      const latestChecks = await this.prisma.monitorCheck.findMany({
        where: { monitorId: { in: activeIds } },
        orderBy: [{ monitorId: 'asc' }, { timestamp: 'desc' }],
        distinct: ['monitorId'],
        select: { isUp: true },
      });
      for (const check of latestChecks) {
        if (check.isUp) up++;
        else down++;
      }
    }

    // Distinct from `down` above on purpose — a monitor's latest check can
    // flip to failed on the very first attempt, before checks.service.ts's
    // retry-then-confirm state machine has actually opened an Incident.
    // This is what the "N monitors are currently down" banner uses instead,
    // matching every other confirmed-down signal in the app
    // (`hasOpenIncident` on the list, the Incidents page).
    const openIncidents = await this.prisma.monitor.count({
      where: { deletedAt: null, isPaused: false, incidents: { some: { endedAt: null } } },
    });

    // The single oldest still-open Incident (among active monitors) — i.e.
    // whichever outage has been running longest right now. `sortBy
    // startedAt asc` + take 1 is enough; the frontend computes the live
    // duration itself (now - startedAt) rather than a snapshot age that
    // goes stale between polls.
    const longestOpenIncidentRow = await this.prisma.incident.findFirst({
      where: { endedAt: null, monitor: { isPaused: false, deletedAt: null } },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true, monitor: { select: { id: true, domain: true, label: true } } },
    });
    const longestOpenIncident = longestOpenIncidentRow
      ? {
          monitorId: longestOpenIncidentRow.monitor.id,
          domain: longestOpenIncidentRow.monitor.domain,
          label: longestOpenIncidentRow.monitor.label,
          startedAt: longestOpenIncidentRow.startedAt,
        }
      : null;

    return { total, paused, up, down, openIncidents, longestOpenIncident };
  }

  /** Enqueues a one-off check for every active (non-paused) monitor — the bulk version of `checkNow`, so the client never needs every monitor's id loaded to trigger this. */
  async checkAll(): Promise<{ queued: number }> {
    const monitors = await this.prisma.monitor.findMany({
      where: { deletedAt: null, isPaused: false },
      select: { id: true, domain: true },
    });
    await Promise.all(
      monitors.map((m) =>
        this.monitorChecksQueue.add(MONITOR_CHECK_JOB_NAME, { monitorId: m.id, domain: m.domain }, { priority: 1 }),
      ),
    );
    return { queued: monitors.length };
  }

  async findOneWithStatus(id: string) {
    const monitor = await this.findOne(id);
    const [enriched] = await this.enrich([monitor]);
    return enriched;
  }

  private async enrich(monitors: Awaited<ReturnType<MonitorsService['findOne']>>[]) {
    if (monitors.length === 0) return [];
    const monitorIds = monitors.map((m) => m.id);
    const windowStart = new Date(Date.now() - UPTIME_WINDOW_MS);

    const [checks, openIncidentCounts, windowIncidents, monitoringSettings] = await Promise.all([
      this.prisma.monitorCheck.findMany({
        where: { monitorId: { in: monitorIds } },
        orderBy: { timestamp: 'desc' },
        // Enough rows to cover HISTORY_SIZE per monitor even in the worst
        // case where all checks belong to one monitor; each monitor's own
        // slice is still capped to HISTORY_SIZE below.
        take: monitorIds.length * HISTORY_SIZE,
      }),
      this.prisma.incident.groupBy({
        by: ['monitorId'],
        where: { monitorId: { in: monitorIds }, endedAt: null },
        _count: { _all: true },
      }),
      this.prisma.incident.findMany({
        where: {
          monitorId: { in: monitorIds },
          OR: [{ endedAt: null }, { endedAt: { gt: windowStart } }],
        },
        select: { monitorId: true, startedAt: true, endedAt: true },
      }),
      this.prisma.monitoringSettings.findFirst({ orderBy: { createdAt: 'asc' }, select: { slowThresholdMs: true } }),
    ]);
    const slowThresholdMs = monitoringSettings?.slowThresholdMs ?? 2000;

    const checksByMonitor = new Map<string, typeof checks>();
    for (const check of checks) {
      const list = checksByMonitor.get(check.monitorId) ?? [];
      if (list.length < HISTORY_SIZE) list.push(check);
      checksByMonitor.set(check.monitorId, list);
    }

    const openIncidentMonitorIds = new Set(openIncidentCounts.map((c) => c.monitorId));

    const incidentsByMonitor = new Map<string, typeof windowIncidents>();
    for (const incident of windowIncidents) {
      const list = incidentsByMonitor.get(incident.monitorId) ?? [];
      list.push(incident);
      incidentsByMonitor.set(incident.monitorId, list);
    }

    const now = Date.now();

    return monitors.map((monitor) => {
      // Newest-first from the query; reverse to oldest-first for the sparkline.
      const monitorChecks = [...(checksByMonitor.get(monitor.id) ?? [])].reverse();
      const latestCheck = monitorChecks[monitorChecks.length - 1] ?? null;

      const history = monitorChecks.map((c) => (c.isUp ? 'up' : 'down'));

      // Clamp the window's start when the monitor is younger than 24h —
      // otherwise a monitor added 1 minute ago and down that entire minute
      // divides its downtime by the full 24h window and shows ~99.9%
      // ("healthy") instead of the 0% it actually deserves. Clamped to its
      // *first observed check*, not raw `createdAt`: the gap between
      // registration and that first check (scheduling jitter, plus the
      // "retry once before confirming down" delay) was never actually
      // verified up — counting it as uptime is exactly how a monitor
      // checked exactly once, and down on that one check, still showed a
      // small nonzero uptime% instead of ~0%.
      //
      // Only clamped forward for a monitor younger than the window itself —
      // an established monitor keeps the full `windowStart` as before,
      // since `monitorChecks` here is capped to the newest 30 fetched and
      // can't be trusted to say "checking started here" for one with far
      // more history than that.
      const effectiveWindowStart =
        monitor.createdAt > windowStart ? (monitorChecks[0]?.timestamp ?? monitor.createdAt) : windowStart;
      const windowMs = now - effectiveWindowStart.getTime();

      const monitorIncidents = incidentsByMonitor.get(monitor.id) ?? [];
      let downtimeMs = 0;
      for (const incident of monitorIncidents) {
        const start = incident.startedAt > effectiveWindowStart ? incident.startedAt : effectiveWindowStart;
        const end = incident.endedAt ?? new Date(now);
        if (end.getTime() > start.getTime()) {
          downtimeMs += end.getTime() - start.getTime();
        }
      }
      const uptime24h =
        monitorChecks.length === 0 || windowMs <= 0
          ? null
          : Math.round(((windowMs - Math.min(downtimeMs, windowMs)) / windowMs) * 1000) / 10;

      return {
        ...monitor,
        latestCheck: latestCheck
          ? {
              isUp: latestCheck.isUp,
              statusCode: latestCheck.statusCode,
              responseTimeMs: latestCheck.responseTimeMs,
              timestamp: latestCheck.timestamp,
              error: latestCheck.error,
              errorType: latestCheck.errorType,
              finalUrl: latestCheck.finalUrl,
              redirectCount: latestCheck.redirectCount,
              // Derived at read time (no stored flag) so changing the
              // threshold in Settings applies to existing checks too.
              isSlow: latestCheck.isUp && (latestCheck.responseTimeMs ?? 0) > slowThresholdMs,
            }
          : null,
        history,
        uptime24h,
        hasOpenIncident: openIncidentMonitorIds.has(monitor.id),
      };
    });
  }

  async findOne(id: string) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id, deletedAt: null },
    });
    if (!monitor) {
      throw new NotFoundException(`Monitor ${id} not found`);
    }
    return monitor;
  }

  async create(dto: CreateMonitorDto) {
    const domain = this.normalizeDomain(dto.domain);
    this.assertValidDomain(domain);
    await this.assertDomainNotTaken(domain);

    const monitor = await this.prisma.monitor.create({
      data: { domain, label: dto.label },
    });
    await this.registerRepeatableCheck(monitor.id, monitor.domain);
    return monitor;
  }

  async update(id: string, dto: UpdateMonitorDto) {
    const existing = await this.findOne(id);

    let domain: string | undefined;
    if (dto.domain !== undefined) {
      domain = this.normalizeDomain(dto.domain);
      this.assertValidDomain(domain);
      await this.assertDomainNotTaken(domain, id);
    }

    const updated = await this.prisma.monitor.update({
      where: { id },
      data: { domain, label: dto.label },
    });

    // The repeatable job's data (the domain it actually checks) is fixed at
    // registration time — if the domain changed, refresh the schedule so
    // apps/worker doesn't keep checking the old one. Stable jobId means this
    // updates the existing schedule rather than duplicating it. Skip this
    // for a paused monitor — it has no active schedule to refresh.
    if (domain && domain !== existing.domain && !existing.isPaused) {
      await this.registerRepeatableCheck(updated.id, updated.domain);
    }

    return updated;
  }

  /** Strips a pasted protocol/trailing slashes — never trust the client already did this. */
  private normalizeDomain(input: string): string {
    return input.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }

  private assertValidDomain(domain: string): void {
    let hostname: string;
    try {
      hostname = new URL(`https://${domain}`).hostname;
    } catch {
      throw new BadRequestException('Enter a valid URL, e.g. example.com');
    }
    if (!HOSTNAME_REGEX.test(hostname)) {
      throw new BadRequestException('Enter a valid URL, e.g. example.com');
    }
  }

  /** Case-insensitive — "Example.com" and "example.com" are the same monitor. `excludeId` lets an edit keep its own domain. */
  private async assertDomainNotTaken(domain: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.monitor.findFirst({
      where: {
        deletedAt: null,
        domain: { equals: domain, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('A monitor for this URL already exists');
    }
  }

  async remove(id: string): Promise<void> {
    const monitor = await this.findOne(id);
    await this.prisma.monitor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.removeRepeatableCheck(monitor.id);

    // A deleted monitor gets no more checks, so a still-open Incident could
    // never be closed by a real recovery — it would sit as "still down"
    // forever. Close it now; this is bookkeeping (we stopped watching), not
    // a claim that the site actually recovered.
    await this.prisma.incident.updateMany({
      where: { monitorId: id, endedAt: null },
      data: { endedAt: new Date() },
    });
  }

  async pause(id: string) {
    const monitor = await this.findOne(id);
    const updated = await this.prisma.monitor.update({
      where: { id },
      data: { isPaused: true },
    });
    await this.removeRepeatableCheck(monitor.id);
    return updated;
  }

  async resume(id: string) {
    const monitor = await this.findOne(id);
    const updated = await this.prisma.monitor.update({
      where: { id },
      data: { isPaused: false },
    });
    await this.registerRepeatableCheck(monitor.id, monitor.domain);
    return updated;
  }

  /** Enqueues a one-off, high-priority job for this one monitor. Never writes to a polling table, never calls the monitored URL itself. */
  async checkNow(id: string): Promise<void> {
    const monitor = await this.findOne(id);
    await this.monitorChecksQueue.add(
      MONITOR_CHECK_JOB_NAME,
      { monitorId: monitor.id, domain: monitor.domain },
      { priority: 1 },
    );
  }

  /**
   * BullMQ 6.x replaced `queue.add(..., { repeat })` + getRepeatableJobs/
   * removeRepeatableByKey with the Job Scheduler API (upsertJobScheduler/
   * removeJobScheduler), and dropped the old `jitter` repeat option
   * entirely. We emulate CLAUDE.md's "jitter spreads thousands of jobs
   * across the interval window instead of firing them all at once"
   * requirement by randomizing each monitor's scheduler `startDate` within
   * one interval — every monitor still repeats every `intervalMs` after
   * that, just starting from a staggered offset instead of all in lockstep.
   *
   * `intervalMs` is optional purely as a batching optimization for
   * `rescheduleAllActive()`, which fetches MonitoringSettings once and
   * passes it to every monitor instead of each one querying it separately.
   */
  private async registerRepeatableCheck(
    monitorId: string,
    domain: string,
    schedule?: Awaited<ReturnType<MonitorsService['getScheduleSettings']>>,
  ): Promise<void> {
    const { intervalMs, attempts, backoffMs } = schedule ?? (await this.getScheduleSettings());
    const jitterOffsetMs = Math.floor(Math.random() * MONITOR_CHECK_JITTER_MS);

    await this.monitorChecksQueue.upsertJobScheduler(
      monitorCheckJobId(monitorId),
      { every: intervalMs, startDate: Date.now() + jitterOffsetMs },
      {
        name: MONITOR_CHECK_JOB_NAME,
        data: { monitorId, domain },
        opts: { attempts, backoff: { type: 'fixed', delay: backoffMs } },
      },
    );
  }

  /** Always read fresh from the DB (never cache/hardcode) — same discipline as apps/worker's alert-dispatch config reads. */
  private async getScheduleSettings() {
    const settings = await this.prisma.monitoringSettings.findFirst({ orderBy: { createdAt: 'asc' } });
    return {
      intervalMs: (settings?.checkIntervalSeconds ?? 60) * 1000,
      attempts: settings?.retryAttempts ?? 2,
      backoffMs: (settings?.retryDelaySeconds ?? 5) * 1000,
    };
  }

  /**
   * Called by MonitoringSettingsService when the global check interval
   * changes — re-registers every active monitor's schedule with the new
   * interval so the change takes effect immediately, not just for monitors
   * created/resumed after the change (a paused monitor has no active
   * schedule to refresh, so it's skipped; it'll pick up the current
   * interval whenever it's next resumed).
   */
  async rescheduleAllActive(): Promise<void> {
    const [monitors, schedule] = await Promise.all([
      this.prisma.monitor.findMany({
        where: { deletedAt: null, isPaused: false },
        select: { id: true, domain: true },
      }),
      this.getScheduleSettings(),
    ]);
    await Promise.all(monitors.map((m) => this.registerRepeatableCheck(m.id, m.domain, schedule)));
  }

  private async removeRepeatableCheck(monitorId: string): Promise<void> {
    await this.monitorChecksQueue.removeJobScheduler(monitorCheckJobId(monitorId));
  }
}
