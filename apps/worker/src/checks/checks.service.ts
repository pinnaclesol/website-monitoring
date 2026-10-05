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

/** Fallbacks used only if the MonitoringSettings row can't be read. */
const DEFAULT_TIMEOUT_MS = 10_000;
const SETTINGS_CACHE_MS = 30_000;

/** Redirect hops followed before a chain is reported as broken. */
const MAX_REDIRECTS = 10;

/**
 * Look like a normal visitor — a bare Node `fetch` sends `user-agent: node`,
 * which many sites/CDNs answer with 403 (reported as a false "down").
 */
const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

type CheckErrorType =
  | 'dns'
  | 'timeout'
  | 'tls'
  | 'connection_refused'
  | 'connection_reset'
  | 'redirect_loop'
  | 'too_many_redirects'
  | 'http_status'
  | 'unknown';

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
  errorType: CheckErrorType | null;
  finalUrl: string | null;
  redirectCount: number;
}

/** Outcome of one request chain (all redirects) against a single URL. */
class CheckFailure extends Error {
  constructor(
    message: string,
    readonly errorType: CheckErrorType,
    readonly finalUrl: string,
    readonly redirectCount: number,
  ) {
    super(message);
  }
}

/** Maps a low-level fetch/undici error to a category and a readable message. */
function classifyError(err: unknown): { errorType: CheckErrorType; message: string } {
  const cause = (err as { cause?: { code?: string; message?: string; errors?: Array<{ code?: string }> } })?.cause;
  // A host with both IPv4 and IPv6 addresses fails as an AggregateError whose
  // top-level `code` is empty — the real code is on the first inner error.
  const code = cause?.code || cause?.errors?.[0]?.code || (err as { code?: string })?.code || '';
  const name = (err as { name?: string })?.name ?? '';

  if (name === 'AbortError' || name === 'TimeoutError' || code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return { errorType: 'timeout', message: 'Request timed out' };
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { errorType: 'dns', message: 'DNS lookup failed — domain not found' };
  }
  if (code === 'ECONNREFUSED') {
    return { errorType: 'connection_refused', message: 'Connection refused' };
  }
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') {
    return { errorType: 'connection_reset', message: 'Connection reset by the server' };
  }
  if (/^(CERT_|ERR_TLS|ERR_SSL|DEPTH_ZERO|SELF_SIGNED|UNABLE_TO_VERIFY|HOSTNAME_MISMATCH)/.test(code) || /certificate|ssl|tls/i.test(cause?.message ?? '')) {
    return { errorType: 'tls', message: `TLS/certificate error${code ? ` (${code})` : ''}` };
  }
  return { errorType: 'unknown', message: err instanceof Error ? err.message : 'Unknown error' };
}

@Injectable()
export class ChecksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChecksService.name);
  private worker?: Worker<MonitorCheckJobData>;
  private readonly alertDispatchQueue: Queue<AlertDispatchJobData> = createAlertDispatchQueue();
  private cachedTimeout?: { ms: number; at: number };

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

    // job.attemptsMade counts *prior* attempts (0 on the first run), so
    // `attemptsMade + 1` is the attempt currently in progress.
    const attemptsAllowed = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade + 1 >= attemptsAllowed;

    const result = await this.performCheck(domain);

    if (!result.isUp && !isFinalAttempt) {
      // Let BullMQ's native attempts/backoff retry this job — a check only
      // counts as confirmed-down once both attempts have failed, so we
      // deliberately do not write a MonitorCheck row (or run alert logic)
      // yet. Throwing here is what tells BullMQ to schedule the retry.
      throw new Error(result.error ?? `Monitor check failed for ${domain}`);
    }

    await this.writeCheckResult(monitorId, result);
  }

  /** Cached briefly — read once per ~30s, not once per check, at thousands-of-monitors scale. */
  private async getTimeoutMs(): Promise<number> {
    if (this.cachedTimeout && Date.now() - this.cachedTimeout.at < SETTINGS_CACHE_MS) {
      return this.cachedTimeout.ms;
    }
    const settings = await this.prisma.monitoringSettings
      .findFirst({ orderBy: { createdAt: 'asc' }, select: { timeoutSeconds: true } })
      .catch(() => null);
    const ms = settings ? settings.timeoutSeconds * 1000 : DEFAULT_TIMEOUT_MS;
    this.cachedTimeout = { ms, at: Date.now() };
    return ms;
  }

  /**
   * Checks `https://<domain>` first; only if that fails at the connection/TLS
   * level (not a timeout or DNS failure, which http would hit too) does it
   * retry once over plain `http://`, for sites that don't serve HTTPS at all.
   * Never throws — failures are captured into the result.
   */
  private async performCheck(domain: string): Promise<CheckResult> {
    const timeoutMs = await this.getTimeoutMs();
    const startedAt = Date.now();

    try {
      return await this.requestChain(`https://${domain}`, timeoutMs, startedAt);
    } catch (httpsErr) {
      const failure = httpsErr as CheckFailure;
      const canTryHttp = ['tls', 'connection_refused', 'connection_reset'].includes(failure.errorType);
      if (canTryHttp) {
        try {
          return await this.requestChain(`http://${domain}`, timeoutMs, Date.now());
        } catch {
          // Report the original HTTPS failure — it's the one the user cares about.
        }
      }
      return {
        isUp: false,
        statusCode: null,
        responseTimeMs: Date.now() - startedAt,
        error: failure.message,
        errorType: failure.errorType,
        finalUrl: failure.finalUrl,
        redirectCount: failure.redirectCount,
      };
    }
  }

  /**
   * One request plus its whole redirect chain, followed manually so we can
   * count hops, record the final URL, and catch loops. The timeout covers the
   * entire chain. Throws `CheckFailure` on any transport-level problem.
   */
  private async requestChain(startUrl: string, timeoutMs: number, startedAt: number): Promise<CheckResult> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    const visited = new Set<string>();
    let currentUrl = startUrl;
    let redirectCount = 0;

    try {
      for (;;) {
        visited.add(currentUrl);
        let response: Response;
        try {
          response = await fetch(currentUrl, {
            signal: controller.signal,
            redirect: 'manual',
            headers: BROWSER_HEADERS,
          });
        } catch (err) {
          const { errorType, message } = classifyError(err);
          throw new CheckFailure(message, errorType, currentUrl, redirectCount);
        }
        // We only need the status line — free the socket instead of buffering the body.
        void response.body?.cancel().catch(() => undefined);

        const location = response.headers.get('location');
        const isRedirect = response.status >= 300 && response.status < 400 && location;
        if (isRedirect) {
          const nextUrl = new URL(location, currentUrl).toString();
          redirectCount++;
          if (visited.has(nextUrl)) {
            throw new CheckFailure('Redirect loop detected', 'redirect_loop', nextUrl, redirectCount);
          }
          if (redirectCount > MAX_REDIRECTS) {
            throw new CheckFailure(`Too many redirects (more than ${MAX_REDIRECTS})`, 'too_many_redirects', nextUrl, redirectCount);
          }
          currentUrl = nextUrl;
          continue;
        }

        // 2xx/3xx counts as up; 4xx/5xx counts as down — the site
        // responded, but should still be flagged as an outage.
        const isUp = response.status >= 200 && response.status < 400;
        return {
          isUp,
          statusCode: response.status,
          responseTimeMs: Date.now() - startedAt,
          error: isUp ? null : `Non-success status ${response.status}`,
          errorType: isUp ? null : 'http_status',
          finalUrl: currentUrl,
          redirectCount,
        };
      }
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
        errorType: result.errorType,
        finalUrl: result.finalUrl,
        redirectCount: result.redirectCount,
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
