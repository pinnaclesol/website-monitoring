import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import {
  createAlertDispatchQueue,
  createWorker,
  QUEUE_NAMES,
  MonitorCheckJobData,
  AlertDispatchJobData,
} from '@uptime/queue';
import { UptimePrismaService } from '@uptime/uptime-db';

/** GET timeout for a single monitor-check attempt. */
const CHECK_TIMEOUT_MS = 10_000;

/**
 * How many monitor checks this Worker processes concurrently. This is an
 * explicit BullMQ `Worker` option (not a hardcoded/implicit default) because
 * apps/worker needs to scale to thousands of monitors on a single consumer
 * process without a thundering herd — see CLAUDE.md's queue architecture
 * notes. 50 is a reasonable starting point for outbound HTTP checks; tune via
 * deployment config in a later pass, not by hand-editing this constant.
 */
const MONITOR_CHECKS_CONCURRENCY = 50;

interface CheckResult {
  isUp: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
}

@Injectable()
export class ChecksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChecksService.name);
  private worker?: Worker<MonitorCheckJobData>;
  private readonly alertDispatchQueue: Queue<AlertDispatchJobData> = createAlertDispatchQueue();

  constructor(private readonly prisma: UptimePrismaService) {}

  onModuleInit(): void {
    this.worker = createWorker<MonitorCheckJobData>(
      QUEUE_NAMES.MONITOR_CHECKS,
      (job) => this.processMonitorCheck(job),
      {
        concurrency: MONITOR_CHECKS_CONCURRENCY,
        // NOTE: `attempts: 2` + `backoff: { type: 'fixed', delay: 5000 }`
        // are BullMQ *job* options, set by the PRODUCER (apps/api) when it
        // registers each monitor's repeatable `monitor-checks` job / enqueues
        // a one-off "check now" job — retry/backoff is configured at
        // `Queue.add()` time, not on the Worker, and this Worker must not
        // redeclare or fight that here. This Worker only needs to *behave*
        // correctly under that retry policy (see isFinalAttempt below):
        // a check counts as confirmed-down only once both attempts fail.
      }
    );

    this.worker.on('error', (err) => {
      this.logger.error(`monitor-checks worker error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.alertDispatchQueue.close();
  }

  private async processMonitorCheck(job: Job<MonitorCheckJobData>): Promise<void> {
    const { monitorId, domain } = job.data;
    const url = `https://${domain}`;

    // job.attemptsMade counts *prior* attempts (0 on the first run), so
    // `attemptsMade + 1` is the attempt currently in progress.
    const attemptsAllowed = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade + 1 >= attemptsAllowed;

    const result = await this.performCheck(url);

    if (!result.isUp && !isFinalAttempt) {
      // Let BullMQ's native attempts/backoff retry this job — a check only
      // counts as confirmed-down once both attempts have failed, so we
      // deliberately do not write a MonitorCheck row (or run alert logic)
      // yet. Throwing here is what tells BullMQ to schedule the retry.
      throw new Error(result.error ?? `Monitor check failed for ${domain}`);
    }

    await this.writeCheckResult(monitorId, result);
  }

  /** Never throws — network errors/timeouts are captured into the result. */
  private async performCheck(url: string): Promise<CheckResult> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      const responseTimeMs = Date.now() - startedAt;
      // 2xx/3xx counts as up; 4xx/5xx counts as down — the monitor
      // responded, but should still be flagged as an outage.
      const isUp = response.status >= 200 && response.status < 400;

      return {
        isUp,
        statusCode: response.status,
        responseTimeMs,
        error: isUp ? null : `Non-success status ${response.status}`,
      };
    } catch (err) {
      const responseTimeMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : 'Unknown error';

      return { isUp: false, statusCode: null, responseTimeMs, error: message };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async writeCheckResult(monitorId: string, result: CheckResult): Promise<void> {
    await this.prisma.monitorCheck.create({
      data: {
        monitorId,
        isUp: result.isUp,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        error: result.error,
      },
    });

    await this.runAlertStateMachine(monitorId, result.isUp);
  }

  /**
   * The down -> recovery state machine. See .claude/agents/worker-agent.md's
   * "Alert-state machine" section — these are hard invariants, not
   * guidelines:
   *   - up -> confirmed-down: open exactly one new Incident, set
   *     MonitorAlertState.isDown = true, lastAlertSentAt = now, enqueue a
   *     `down` alert-dispatch job.
   *   - still down: do nothing. Exactly one alert per down period — no
   *     repeat/reminder while it stays down, deliberately (a repeating nag
   *     was the previous behavior; removed because it's not what anyone
   *     wants from an uptime monitor).
   *   - down -> recovered: close the open Incident, enqueue a `recovery`
   *     alert-dispatch job (with downtimeMs) only if recoveryAlertEnabled,
   *     clear MonitorAlertState.isDown.
   *   - Never open a second Incident for an already-down monitor; never
   *     leave an Incident open after a recovered check. A fresh down period
   *     after a recovery naturally gets its own single `down` alert again
   *     (isDown was reset to false, so the up -> confirmed-down branch
   *     re-fires next time it goes down).
   *
   * Known limitation: this isn't wrapped in a DB transaction/lock. A single
   * monitor only ever has one repeatable job, so under normal operation
   * there's no concurrent check for the same monitor — a manual "check now"
   * racing the repeatable job for the same monitor is the one edge case
   * that could theoretically double-fire, acceptable for now, not addressed
   * here.
   */
  private async runAlertStateMachine(monitorId: string, isUp: boolean): Promise<void> {
    const existingState = await this.prisma.monitorAlertState.findUnique({ where: { monitorId } });
    const wasDown = existingState?.isDown ?? false;
    const now = new Date();

    const settings = await this.prisma.alertSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    const repeatIntervalSeconds = (settings as unknown as { repeatIntervalSeconds?: number })?.repeatIntervalSeconds ?? 300;
    const repeatIntervalMs = repeatIntervalSeconds * 1000;

    if (!isUp && !wasDown) {
      // up -> confirmed-down
      const openIncident = await this.prisma.incident.findFirst({
        where: { monitorId, endedAt: null },
      });
      if (!openIncident) {
        await this.prisma.incident.create({ data: { monitorId, startedAt: now } });
      }

      await this.prisma.monitorAlertState.upsert({
        where: { monitorId },
        update: { isDown: true, lastAlertSentAt: now },
        create: { monitorId, isDown: true, lastAlertSentAt: now },
      });

      await this.enqueueAlert(monitorId, 'down', now);
      return;
    }

    if (!isUp && wasDown) {
      // Still down — send a reminder alert every repeatIntervalMs
      const lastAlertSentAt = existingState?.lastAlertSentAt;
      if (lastAlertSentAt && now.getTime() - lastAlertSentAt.getTime() >= repeatIntervalMs) {
        await this.prisma.monitorAlertState.update({
          where: { monitorId },
          data: { lastAlertSentAt: now },
        });

        const openIncident = await this.prisma.incident.findFirst({
          where: { monitorId, endedAt: null },
        });
        const startedAt = openIncident?.startedAt ?? now;

        await this.enqueueAlert(monitorId, 'reminder', startedAt);
      }
      return;
    }

    if (isUp && wasDown) {
      // down -> recovered
      const openIncident = await this.prisma.incident.findFirst({
        where: { monitorId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (openIncident) {
        await this.prisma.incident.update({
          where: { id: openIncident.id },
          data: { endedAt: now },
        });
      }

      await this.prisma.monitorAlertState.update({
        where: { monitorId },
        data: { isDown: false },
      });

      if (settings?.recoveryAlertEnabled ?? true) {
        const downtimeMs = openIncident ? now.getTime() - openIncident.startedAt.getTime() : undefined;
        await this.enqueueAlert(monitorId, 'recovery', now, downtimeMs);
      }
      return;
    }

    // isUp && !wasDown — still up, nothing to do.
  }

  private async enqueueAlert(
    monitorId: string,
    event: AlertDispatchJobData['event'],
    occurredAt: Date,
    downtimeMs?: number
  ): Promise<void> {
    await this.alertDispatchQueue.add(`alert-${event}`, {
      monitorId,
      event,
      occurredAt: occurredAt.toISOString(),
      downtimeMs,
    });
  }
}
