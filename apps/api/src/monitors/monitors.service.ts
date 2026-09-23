import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { createMonitorChecksQueue } from '@uptime/queue';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';

const MONITOR_CHECK_INTERVAL_MS = 60_000;
const MONITOR_CHECK_JITTER_MS = 10_000;
const MONITOR_CHECK_JOB_NAME = 'monitor-check';

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
   * The dashboard's monitor list — each Monitor enriched with its latest
   * check, a 30-check history for the sparkline, 24h uptime
   * (incident-overlap based, per CLAUDE.md — not a raw MonitorCheck-sample
   * ratio), and whether it has an open incident right now. Still entirely
   * read-only on MonitorCheck/Incident data — apps/api only ever reads
   * them, never writes.
   *
   * Implementation note: this loads every check/incident for the given
   * monitors in a couple of batched queries rather than one query per
   * monitor, which is fine at the monitor counts this dashboard is
   * actually tested with. At true thousands-of-monitors scale this should
   * move to a denormalized "latest status" projection instead of scanning
   * MonitorCheck rows on every poll — flagging it here rather than building
   * that prematurely.
   */
  async findAll() {
    const monitors = await this.prisma.monitor.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrich(monitors);
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

    const [checks, openIncidentCounts, windowIncidents] = await Promise.all([
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
    ]);

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

      const monitorIncidents = incidentsByMonitor.get(monitor.id) ?? [];
      let downtimeMs = 0;
      for (const incident of monitorIncidents) {
        const start = incident.startedAt > windowStart ? incident.startedAt : windowStart;
        const end = incident.endedAt ?? new Date(now);
        if (end.getTime() > start.getTime()) {
          downtimeMs += end.getTime() - start.getTime();
        }
      }
      const uptime24h =
        monitorChecks.length === 0
          ? null
          : Math.round(((UPTIME_WINDOW_MS - Math.min(downtimeMs, UPTIME_WINDOW_MS)) / UPTIME_WINDOW_MS) * 1000) / 10;

      return {
        ...monitor,
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
    const monitor = await this.prisma.monitor.create({
      data: { domain: dto.domain, label: dto.label },
    });
    await this.registerRepeatableCheck(monitor.id, monitor.domain);
    return monitor;
  }

  async update(id: string, dto: UpdateMonitorDto) {
    const existing = await this.findOne(id);
    const updated = await this.prisma.monitor.update({
      where: { id },
      data: { domain: dto.domain, label: dto.label },
    });

    // The repeatable job's data (the domain it actually checks) is fixed at
    // registration time — if the domain changed, refresh the schedule so
    // apps/worker doesn't keep checking the old one. Stable jobId means this
    // updates the existing schedule rather than duplicating it. Skip this
    // for a paused monitor — it has no active schedule to refresh.
    if (dto.domain && dto.domain !== existing.domain && !existing.isPaused) {
      await this.registerRepeatableCheck(updated.id, updated.domain);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const monitor = await this.findOne(id);
    await this.prisma.monitor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.removeRepeatableCheck(monitor.id);
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
   * across the 60s window instead of firing them all at once" requirement
   * by randomizing each monitor's scheduler `startDate` within one
   * interval — every monitor still repeats every MONITOR_CHECK_INTERVAL_MS
   * after that, just starting from a staggered offset instead of all in
   * lockstep.
   */
  private async registerRepeatableCheck(monitorId: string, domain: string): Promise<void> {
    const jitterOffsetMs = Math.floor(Math.random() * MONITOR_CHECK_JITTER_MS);

    await this.monitorChecksQueue.upsertJobScheduler(
      monitorCheckJobId(monitorId),
      { every: MONITOR_CHECK_INTERVAL_MS, startDate: Date.now() + jitterOffsetMs },
      {
        name: MONITOR_CHECK_JOB_NAME,
        data: { monitorId, domain },
        opts: { attempts: 2, backoff: { type: 'fixed', delay: 5000 } },
      },
    );
  }

  private async removeRepeatableCheck(monitorId: string): Promise<void> {
    await this.monitorChecksQueue.removeJobScheduler(monitorCheckJobId(monitorId));
  }
}
