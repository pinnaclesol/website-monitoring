import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { createWorker, QUEUE_NAMES, AlertDispatchJobData, AlertEvent } from '@uptime/queue';
import { UptimePrismaService } from '@uptime/uptime-db';

/**
 * Separate, smaller concurrency than `monitor-checks` on purpose: a
 * slow/rate-limited Telegram or SMTP call must never delay the next monitor
 * check cycle. Kept as a named constant so it's clearly a deliberate choice.
 */
const ALERT_DISPATCH_CONCURRENCY = 10;

/**
 * Processes `alert-dispatch` jobs. Telegram (Bot API) and Signal (the
 * signal-cli-rest-api sidecar at `SIGNAL_REST_API_URL`) sending are real.
 * Email (nodemailer via `SmtpConfig`) is still a STUB — logged only, not
 * sent — future work via `/new-queue-job` or a dedicated follow-up pass.
 *
 * Each channel is independent: a Telegram/Signal failure must never block
 * the other (or email, once that's real) for the same event, so every
 * channel's send is caught and logged on its own, never thrown — and
 * within Telegram, one destination failing never blocks the others.
 */
@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertsService.name);
  private worker?: Worker<AlertDispatchJobData>;

  constructor(private readonly prisma: UptimePrismaService) {}

  onModuleInit(): void {
    this.worker = createWorker<AlertDispatchJobData>(
      QUEUE_NAMES.ALERT_DISPATCH,
      (job) => this.dispatchAlert(job),
      { concurrency: ALERT_DISPATCH_CONCURRENCY }
    );

    this.worker.on('error', (err) => {
      this.logger.error(`alert-dispatch worker error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async dispatchAlert(job: Job<AlertDispatchJobData>): Promise<void> {
    const { monitorId, event, occurredAt, downtimeMs } = job.data;

    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { domain: true, label: true },
    });
    if (!monitor) {
      // Monitor was deleted between the check that triggered this event and
      // dispatch running — nothing to alert about anymore.
      this.logger.warn(`Alert dispatch skipped — monitor ${monitorId} no longer exists`);
      return;
    }

    const name = monitor.label || monitor.domain;
    const message = buildAlertMessage(name, event, occurredAt, downtimeMs);

    const [telegramSentCount, signalSentCount, emailCount] = await Promise.all([
      this.sendTelegramAlerts(message),
      this.sendSignalAlert(message),
      this.prisma.emailRecipient.count({ where: { isActive: true } }),
    ]);

    this.logger.log(
      `Dispatched "${event}" alert for ${name} — Telegram sent to ${telegramSentCount} destination(s), ` +
        `Signal sent to ${signalSentCount} group(s) (group-only, fallback numbers disabled), ` +
        `email (${emailCount} recipient(s)) still stubbed`
    );
  }

  /**
   * Reads active TelegramAccount rows fresh from the DB every call (never
   * cached) and POSTs to each one's Bot API `sendMessage`. Every
   * destination is independent — one failing/misconfigured bot never blocks
   * the others. Never logs a bot token (only the human-chosen `label`,
   * which isn't a secret) or the upstream response body. Returns how many
   * sends actually succeeded, for the summary log line.
   */
  private async sendTelegramAlerts(message: string): Promise<number> {
    const accounts = await this.prisma.telegramAccount.findMany({ where: { isActive: true } });
    if (accounts.length === 0) return 0;

    const results = await Promise.all(
      accounts.map(async (account) => {
        try {
          const res = await fetch(`https://api.telegram.org/bot${account.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: account.chatId, text: message }),
          });
          if (!res.ok) {
            this.logger.error(`Telegram send failed for "${account.label}" (HTTP ${res.status})`);
            return false;
          }
          return true;
        } catch (err) {
          this.logger.error(
            `Telegram send error for "${account.label}": ${err instanceof Error ? err.message : 'unknown error'}`
          );
          return false;
        }
      })
    );

    return results.filter(Boolean).length;
  }

  /**
   * Reads SignalConfig fresh from the DB every call (never cached).
   * Silently no-ops if Signal isn't configured/active — that's a normal
   * state, not an error. Never logs the sender/recipient numbers, group
   * id, or the upstream response body (which could itself echo them back)
   * — only counts/status codes, matching this app's secrets discipline for
   * phone numbers.
   *
   * GROUP-ONLY FOR NOW (product decision): fallback-number sending is
   * temporarily disabled — if `recipientGroupId` isn't set, this returns 0
   * with no send attempt at all (not an error/warning, just "no group
   * configured yet"). This mirrors the equivalent frontend flag
   * (`SIGNAL_FALLBACK_NUMBERS_ENABLED = false` in apps/web's Notifications
   * page); re-enabling both sides symmetrically is the whole revert if the
   * fallback-number path comes back. `SignalRecipientNumber` rows/CRUD are
   * untouched — only unused here. `recipientGroupId` is already in the
   * literal "group.<base64>" format signal-cli-rest-api's `recipients`
   * array expects, so no transformation is needed. Returns how many sends
   * actually succeeded (a group send counts as 1 destination if it
   * succeeds), for the summary log line.
   */
  private async sendSignalAlert(message: string): Promise<number> {
    const config = await this.prisma.signalConfig.findFirst({ where: { isActive: true } });
    if (!config || !config.recipientGroupId) return 0;

    const apiUrl = process.env.SIGNAL_REST_API_URL;
    if (!apiUrl) {
      this.logger.warn('SignalConfig is active but SIGNAL_REST_API_URL is not set — skipping Signal alert');
      return 0;
    }

    return (await this.postSignalMessage(apiUrl, config.senderNumber, config.recipientGroupId, message)) ? 1 : 0;
  }

  private async postSignalMessage(apiUrl: string, senderNumber: string, recipient: string, message: string): Promise<boolean> {
    try {
      const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/v2/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          number: senderNumber,
          recipients: [recipient],
        }),
      });
      if (!res.ok) {
        this.logger.error(`Signal send failed (HTTP ${res.status})`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Signal send error: ${err instanceof Error ? err.message : 'unknown error'}`);
      return false;
    }
  }
}

function buildAlertMessage(name: string, event: AlertEvent, occurredAt: string, downtimeMs?: number): string {
  const when = new Date(occurredAt).toLocaleString();
  switch (event) {
    case 'down':
      return `🔴 ${name} is DOWN\nDetected at ${when}`;
    case 'reminder':
      return `⚠️ REMINDER: ${name} is STILL DOWN\nOngoing since ${when}`;
    case 'recovery':
      return `✅ ${name} is back up\nWas down for ${formatDuration(downtimeMs)}`;
  }
}

function formatDuration(ms: number | undefined): string {
  if (!ms || ms < 0) return 'an unknown duration';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!hours && seconds) parts.push(`${seconds}s`);
  return parts.length ? parts.join(' ') : '0s';
}
