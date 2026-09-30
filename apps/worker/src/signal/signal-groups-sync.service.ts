import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import {
  createSignalGroupsSyncQueue,
  createWorker,
  QUEUE_NAMES,
  SignalGroupsSyncJobData,
} from '@uptime/queue';
import { UptimePrismaService } from '@uptime/uptime-db';

/**
 * Stable jobId so re-registering the repeatable job on every worker restart
 * upserts the same schedule instead of piling up duplicate repeatable jobs.
 */
const SIGNAL_GROUPS_SYNC_REPEAT_JOB_ID = 'signal-groups-sync-60s';

/** Fixed interval, not a cron pattern — this job runs roughly every minute. */
const SIGNAL_GROUPS_SYNC_INTERVAL_MS = 60_000;

interface LiveSignalGroup {
  id: string;
  name: string;
}

/**
 * Keeps the local `SignalGroup` cache table in sync with signal-cli-rest-api's
 * live group list, polling every ~60s via BullMQ's Job Scheduler API — same
 * self-registering pattern as `CleanupService`. This is the single source of
 * truth for "is this group still valid" going forward: it also auto-clears
 * `SignalConfig.recipientGroupId`/`recipientGroupName` when the previously
 * selected group disappears from the live list, replacing the equivalent
 * live-validation logic that used to live in apps/api's `getStatus()`.
 *
 * Never logs phone numbers, group ids, or group names — only counts/status,
 * matching this app's secrets discipline throughout its Signal-related code.
 */
@Injectable()
export class SignalGroupsSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SignalGroupsSyncService.name);
  private queue?: Queue<SignalGroupsSyncJobData>;
  private worker?: Worker<SignalGroupsSyncJobData>;

  constructor(private readonly prisma: UptimePrismaService) {}

  async onModuleInit(): Promise<void> {
    this.queue = createSignalGroupsSyncQueue();

    await this.queue.upsertJobScheduler(
      SIGNAL_GROUPS_SYNC_REPEAT_JOB_ID,
      { every: SIGNAL_GROUPS_SYNC_INTERVAL_MS },
      { name: 'sync-signal-groups', data: {} }
    );

    this.worker = createWorker<SignalGroupsSyncJobData>(
      QUEUE_NAMES.SIGNAL_GROUPS_SYNC,
      () => this.syncGroups(),
      { concurrency: 1 }
    );

    this.worker.on('error', (err) => {
      this.logger.error(`signal-groups-sync worker error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async syncGroups(): Promise<void> {
    const config = await this.prisma.signalConfig.findFirst({ where: { isActive: true } });
    if (!config || !config.senderNumber) {
      // Signal isn't linked yet — a completely normal state, not a problem.
      this.logger.verbose('signal-groups-sync: no active/linked SignalConfig yet — skipping this run');
      return;
    }

    const apiUrl = process.env.SIGNAL_REST_API_URL;
    if (!apiUrl) {
      this.logger.warn('signal-groups-sync: SIGNAL_REST_API_URL is not set — skipping this run');
      return;
    }

    const liveGroups = await this.fetchLiveGroups(apiUrl.replace(/\/+$/, ''), config.senderNumber);
    if (liveGroups === undefined) {
      // Fetch failure already logged (status code only) — never let a
      // transient sidecar blip crash the repeatable job.
      return;
    }

    const liveGroupIds = new Set(liveGroups.map((g) => g.id));

    for (const group of liveGroups) {
      await this.prisma.signalGroup.upsert({
        where: { groupId: group.id },
        create: { groupId: group.id, name: group.name },
        update: { name: group.name },
      });
    }

    const cachedGroups = await this.prisma.signalGroup.findMany({ select: { groupId: true } });
    const staleGroupIds = cachedGroups
      .map((g) => g.groupId)
      .filter((groupId) => !liveGroupIds.has(groupId));

    if (staleGroupIds.length > 0) {
      await this.prisma.signalGroup.deleteMany({ where: { groupId: { in: staleGroupIds } } });
    }

    // Auto-clear a stale selection: if the currently-configured recipient
    // group no longer exists on Signal's side, clear it. This is now the
    // ONLY place this happens (previously duplicated as live-validation
    // logic in apps/api's getStatus()).
    if (config.recipientGroupId && !liveGroupIds.has(config.recipientGroupId)) {
      await this.prisma.signalConfig.update({
        where: { id: config.id },
        data: { recipientGroupId: null, recipientGroupName: null },
      });
    }

    this.logger.log(
      `signal-groups-sync: synced ${liveGroups.length} live group(s), removed ${staleGroupIds.length} stale cache row(s)`
    );
  }

  /**
   * Returns `undefined` on any fetch/parse failure (caller skips this run
   * entirely) — never throws, never logs the raw body or any group id/name,
   * only the HTTP status code.
   */
  private async fetchLiveGroups(baseUrl: string, senderNumber: string): Promise<LiveSignalGroup[] | undefined> {
    try {
      const res = await fetch(`${baseUrl}/v1/groups/${encodeURIComponent(senderNumber)}`);
      if (!res.ok) {
        this.logger.warn(`signal-groups-sync: sidecar /v1/groups returned HTTP ${res.status}`);
        return undefined;
      }
      const body = (await res.json()) as unknown;
      if (!Array.isArray(body)) return [];
      return body
        .map((entry) => {
          const e = entry as { id?: unknown; name?: unknown };
          return { id: e?.id, name: e?.name };
        })
        .filter(
          (g): g is LiveSignalGroup => typeof g.id === 'string' && g.id.length > 0 && typeof g.name === 'string'
        );
    } catch (err) {
      this.logger.warn(
        `signal-groups-sync: sidecar /v1/groups unreachable: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      return undefined;
    }
  }
}
