import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { createWorker, QUEUE_NAMES, AlertDispatchJobData } from '@uptime/queue';
import { UptimePrismaService } from '@uptime/uptime-db';

/**
 * Separate, smaller concurrency than `site-checks` on purpose: a
 * slow/rate-limited Telegram or SMTP call must never delay the next site
 * check cycle. Kept as a named constant so it's clearly a deliberate choice.
 */
const ALERT_DISPATCH_CONCURRENCY = 10;

/**
 * STUB for this bootstrap session. Processes `alert-dispatch` jobs by
 * logging what *would* be sent, without actually calling Telegram's Bot API,
 * nodemailer/SMTP, or the signal-cli-rest-api sidecar. Real dispatch logic —
 * reading TelegramAccount/SignalConfig/EmailRecipient from the DB at send
 * time and performing the sends (Signal failures must not block
 * Telegram/email for the same event) — is future work via
 * `/new-queue-job` or a dedicated follow-up pass.
 *
 * This consumer registration is real and is the intended extension point:
 * swap the body of `dispatchAlert` for the real sends later without
 * touching how the Worker is wired up.
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
    const { siteId, event, occurredAt, downtimeMs } = job.data;

    // Always read channel config from the DB at dispatch time (never
    // cache/hardcode) — even for this stub, so the extension point is
    // already wired the right way. Only counts are logged, never contents
    // (bot tokens, phone numbers, SMTP credentials are never logged).
    const [telegramCount, activeSignal, emailCount] = await Promise.all([
      this.prisma.telegramAccount.count({ where: { isActive: true } }),
      this.prisma.signalConfig.findFirst({ where: { isActive: true }, select: { id: true } }),
      this.prisma.emailRecipient.count({ where: { isActive: true } }),
    ]);

    this.logger.log(
      `[stub] would dispatch "${event}" alert for site=${siteId} occurredAt=${occurredAt}` +
        `${downtimeMs !== undefined ? ` downtimeMs=${downtimeMs}` : ''} -> ` +
        `telegram=${telegramCount} signal=${activeSignal ? 1 : 0} email=${emailCount}`
    );
  }
}
