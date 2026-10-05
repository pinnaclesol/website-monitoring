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
import { runHttpCheck, type CheckResult } from './http-check';
import { closeProxyAgents, getProxyAgent, isProxyEnabled } from './proxy';

/** Fallbacks used only if the MonitoringSettings row can't be read. */
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_LOCATIONS = ['US', 'DE', 'SG'];
/** Always checked first, every cycle; the other locations only confirm a failure. */
const PRIMARY_LOCATION = 'US';
/** Label for a direct request from this server (used only when the proxy fails for the primary). */
const SERVER_LOCATION = 'SERVER';
const SETTINGS_CACHE_MS = 30_000;

/**
 * How many monitor checks this Worker processes concurrently. This is an
 * explicit BullMQ `Worker` option (not a hardcoded/implicit default) because
 * apps/worker needs to scale to thousands of monitors on a single consumer
 * process without a thundering herd — see CLAUDE.md's queue architecture
 * notes. 50 is a reasonable starting point for outbound HTTP checks; tune via
 * deployment config in a later pass, not by hand-editing this constant.
 */
const MONITOR_CHECKS_CONCURRENCY = 50;

interface RegionResult {
  region: string;
  result: CheckResult;
  /** The proxy itself failed — excluded from the vote. */
  inconclusive: boolean;
}

/** What one check cycle decided: the verdict, the result to show for it, and each location's own result. */
interface CheckOutcome {
  isUp: boolean;
  result: CheckResult;
  regions: RegionResult[];
}

@Injectable()
export class ChecksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChecksService.name);
  private worker?: Worker<MonitorCheckJobData>;
  private readonly alertDispatchQueue: Queue<AlertDispatchJobData> = createAlertDispatchQueue();
  private cachedSettings?: { timeoutMs: number; locations: string[]; at: number };

  constructor(private readonly prisma: UptimePrismaService) {}

  onModuleInit(): void {
    this.worker = createWorker<MonitorCheckJobData>(
      QUEUE_NAMES.MONITOR_CHECKS,
      (job) => this.processMonitorCheck(job),
      {
        concurrency: MONITOR_CHECKS_CONCURRENCY,
        // NOTE: attempts + backoff are BullMQ *job* options, set by the
        // PRODUCER (apps/api) when it registers each monitor's repeatable
        // `monitor-checks` job / enqueues a one-off "check now" job —
        // retry/backoff is configured at `Queue.add()` time, not on the
        // Worker, and this Worker must not redeclare or fight that here.
        // This Worker only needs to *behave* correctly under that retry
        // policy (see isFinalAttempt below): a check counts as
        // confirmed-down only once every allowed attempt has failed.
      }
    );

    this.worker.on('error', (err) => {
      this.logger.error(`monitor-checks worker error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.alertDispatchQueue.close();
    await closeProxyAgents();
  }

  private async processMonitorCheck(job: Job<MonitorCheckJobData>): Promise<void> {
    const { monitorId, domain } = job.data;

    // job.attemptsMade counts *prior* attempts (0 on the first run), so
    // `attemptsMade + 1` is the attempt currently in progress.
    const attemptsAllowed = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade + 1 >= attemptsAllowed;

    const outcome = await this.performCheck(domain);

    if (!outcome.isUp && !isFinalAttempt) {
      // Let BullMQ's native attempts/backoff retry this job — a check only
      // counts as confirmed-down once every allowed attempt has failed, so we
      // deliberately do not write a MonitorCheck row (or run alert logic)
      // yet. Throwing here is what tells BullMQ to schedule the retry.
      throw new Error(outcome.result.error ?? `Monitor check failed for ${domain}`);
    }

    await this.writeCheckResult(monitorId, outcome);
  }

  /** Cached briefly — read once per ~30s, not once per check, at thousands-of-monitors scale. */
  private async getCheckSettings(): Promise<{ timeoutMs: number; locations: string[] }> {
    if (this.cachedSettings && Date.now() - this.cachedSettings.at < SETTINGS_CACHE_MS) {
      return this.cachedSettings;
    }
    const settings = await this.prisma.monitoringSettings
      .findFirst({ orderBy: { createdAt: 'asc' }, select: { timeoutSeconds: true, locations: true } })
      .catch(() => null);
    this.cachedSettings = {
      timeoutMs: settings ? settings.timeoutSeconds * 1000 : DEFAULT_TIMEOUT_MS,
      locations: settings ? settings.locations : DEFAULT_LOCATIONS,
      at: Date.now(),
    };
    return this.cachedSettings;
  }

  /**
   * One check cycle. The site is always requested from the primary location
   * (US) first. If that succeeds the check is done — one request. Only if it
   * fails are the other selected locations asked to confirm, and the verdict
   * is then a vote across everyone who answered. This keeps proxy traffic at
   * one request per check while the site is healthy, and still stops a
   * problem local to one location from raising an alert. With the proxy off,
   * it's a single direct request from this server. Never throws.
   */
  private async performCheck(domain: string): Promise<CheckOutcome> {
    const { timeoutMs, locations } = await this.getCheckSettings();

    if (!isProxyEnabled()) {
      const result = await runHttpCheck(domain, timeoutMs);
      return { isUp: result.isUp, result, regions: [] };
    }

    // US is always the primary and always checked, whatever is stored.
    const confirmers = locations.filter((l) => l !== PRIMARY_LOCATION);
    const check = (region: string) =>
      runHttpCheck(domain, timeoutMs, getProxyAgent(region)).then(
        (result): RegionResult => ({ region, result, inconclusive: result.errorType === 'proxy' }),
      );

    const primary = await check(PRIMARY_LOCATION);
    const regions: RegionResult[] = [primary];

    if (primary.inconclusive) {
      // The proxy itself failed (bad credentials, outage, out of quota) — that
      // says nothing about the site. Use this server's own request as the
      // primary result instead of reporting a false outage.
      this.logger.warn(`Proxy failed for ${PRIMARY_LOCATION} checking ${domain}; using a direct check instead`);
      const direct = await runHttpCheck(domain, timeoutMs);
      regions.push({ region: SERVER_LOCATION, result: direct, inconclusive: false });
    }

    const firstAnswer = regions.find((r) => !r.inconclusive) as RegionResult;
    if (firstAnswer.result.isUp) {
      return { isUp: true, result: firstAnswer.result, regions };
    }

    // The first answer was a failure — don't alert yet. Ask the other
    // locations whether they see the same thing.
    regions.push(...(await Promise.all(confirmers.map(check))));

    const conclusive = regions.filter((r) => !r.inconclusive);
    const down = conclusive.filter((r) => !r.result.isUp);
    // Strict majority of the locations that answered must fail. A tie counts
    // as up: one bad exit node out of two shouldn't page anyone.
    const isUp = down.length * 2 <= conclusive.length;

    if (isUp) {
      // Report the fastest up location: every proxied request carries the
      // proxy's own overhead (1-3s), so it's the closest to the site's real speed.
      const fastest = conclusive
        .filter((r) => r.result.isUp)
        .sort((a, b) => a.result.responseTimeMs - b.result.responseTimeMs)[0];
      return { isUp, result: fastest.result, regions };
    }

    // Through a proxy, a failure to reach the site rarely says why (an unknown
    // domain just looks like a reset connection). When no location got an HTTP
    // response, ask this server directly for the real reason — it's display
    // only and never part of the vote.
    const sample = down.find((r) => r.result.statusCode !== null) ?? down[0];
    const diagnosis = sample.result.statusCode === null ? await runHttpCheck(domain, timeoutMs) : null;
    const reason = diagnosis && !diagnosis.isUp ? diagnosis : sample.result;
    const failedFrom = down.map((r) => r.region).join(', ');
    const error = `Down from ${down.length} of ${conclusive.length} locations (${failedFrom}): ${reason.error ?? 'request failed'}`;
    return { isUp, result: { ...reason, error }, regions };
  }

  private async writeCheckResult(monitorId: string, outcome: CheckOutcome): Promise<void> {
    const { result, regions } = outcome;
    await this.prisma.monitorCheck.create({
      data: {
        monitorId,
        isUp: outcome.isUp,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        error: result.error,
        errorType: result.errorType,
        finalUrl: result.finalUrl,
        redirectCount: result.redirectCount,
        regions: {
          create: regions.map((r) => ({
            region: r.region,
            isUp: r.result.isUp,
            inconclusive: r.inconclusive,
            statusCode: r.result.statusCode,
            responseTimeMs: r.result.responseTimeMs,
            error: r.result.error,
            errorType: r.result.errorType,
            finalUrl: r.result.finalUrl,
            redirectCount: r.result.redirectCount,
          })),
        },
      },
    });

    await this.runAlertStateMachine(monitorId, outcome.isUp);
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
