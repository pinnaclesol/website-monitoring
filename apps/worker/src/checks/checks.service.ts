import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { createWorker, QUEUE_NAMES, SiteCheckJobData } from '@uptime/queue';
import { UptimePrismaService } from '@uptime/uptime-db';

/** GET timeout for a single site-check attempt. */
const CHECK_TIMEOUT_MS = 10_000;

/**
 * How many site-checks this Worker processes concurrently. This is an
 * explicit BullMQ `Worker` option (not a hardcoded/implicit default) because
 * apps/worker needs to scale to thousands of monitors on a single consumer
 * process without a thundering herd — see CLAUDE.md's queue architecture
 * notes. 50 is a reasonable starting point for outbound HTTP checks; tune via
 * deployment config in a later pass, not by hand-editing this constant.
 */
const SITE_CHECKS_CONCURRENCY = 50;

interface CheckResult {
  isUp: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
}

@Injectable()
export class ChecksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChecksService.name);
  private worker?: Worker<SiteCheckJobData>;

  constructor(private readonly prisma: UptimePrismaService) {}

  onModuleInit(): void {
    this.worker = createWorker<SiteCheckJobData>(
      QUEUE_NAMES.SITE_CHECKS,
      (job) => this.processSiteCheck(job),
      {
        concurrency: SITE_CHECKS_CONCURRENCY,
        // NOTE: `attempts: 2` + `backoff: { type: 'fixed', delay: 5000 }`
        // are BullMQ *job* options, set by the PRODUCER (apps/api) when it
        // registers each site's repeatable `site-checks` job / enqueues a
        // one-off "check now" job — retry/backoff is configured at
        // `Queue.add()` time, not on the Worker, and this Worker must not
        // redeclare or fight that here. This Worker only needs to *behave*
        // correctly under that retry policy (see isFinalAttempt below):
        // a check counts as confirmed-down only once both attempts fail.
      }
    );

    this.worker.on('error', (err) => {
      this.logger.error(`site-checks worker error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processSiteCheck(job: Job<SiteCheckJobData>): Promise<void> {
    const { siteId, domain } = job.data;
    const url = `https://${domain}`;

    // job.attemptsMade counts *prior* attempts (0 on the first run), so
    // `attemptsMade + 1` is the attempt currently in progress.
    const attemptsAllowed = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade + 1 >= attemptsAllowed;

    const result = await this.performCheck(url);

    if (!result.isUp && !isFinalAttempt) {
      // Let BullMQ's native attempts/backoff retry this job — a check only
      // counts as confirmed-down once both attempts have failed, so we
      // deliberately do not write a Check row (or run alert logic) yet.
      // Throwing here is what tells BullMQ to schedule the retry.
      throw new Error(result.error ?? `Site check failed for ${domain}`);
    }

    await this.writeCheckResult(siteId, result);
  }

  /** Never throws — network errors/timeouts are captured into the result. */
  private async performCheck(url: string): Promise<CheckResult> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      const responseTimeMs = Date.now() - startedAt;
      // 2xx/3xx counts as up; 4xx/5xx counts as down — the site responded,
      // but a monitor should still flag it as an outage.
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

  private async writeCheckResult(siteId: string, result: CheckResult): Promise<void> {
    await this.prisma.check.create({
      data: {
        siteId,
        isUp: result.isUp,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        error: result.error,
      },
    });

    // TODO(alert-state-machine): out of scope for this bootstrap session.
    // This is where the up/down/recovery transition logic belongs — see
    // .claude/agents/worker-agent.md's "Alert-state machine" invariants:
    //   - up -> confirmed-down (result.isUp === false here, and this was the
    //     final attempt): open a new Incident (startedAt = now) *only if*
    //     one isn't already open for this site, enqueue a `down`
    //     alert-dispatch job for every active TelegramAccount, the active
    //     SignalConfig (if any), and every active EmailRecipient; set
    //     AlertState.isDown = true, lastAlertSentAt = now.
    //   - still down and
    //     now - AlertState.lastAlertSentAt >= NotificationSettings.alertIntervalSeconds:
    //     enqueue a `reminder` alert-dispatch job and bump lastAlertSentAt.
    //     Never enqueue a reminder before that interval has elapsed.
    //   - down -> recovered (result.isUp === true here and AlertState.isDown
    //     was true): close the open Incident (endedAt = now), enqueue a
    //     `recovery` alert-dispatch job (include downtimeMs) only if
    //     NotificationSettings.recoveryAlertEnabled, clear AlertState.isDown.
    //   - Hard invariants: never open a second Incident for a site that
    //     already has one open; never leave an Incident open after a
    //     recovered check.
  }
}
