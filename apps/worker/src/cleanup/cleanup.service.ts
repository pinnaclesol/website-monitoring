import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { createCleanupQueue, createWorker, QUEUE_NAMES, CleanupJobData } from '@uptime/queue';
import { UptimePrismaService } from '@uptime/uptime-db';

/** Keep the newest N MonitorCheck rows per monitor; older rows are pruned daily. */
const CHECKS_TO_KEEP_PER_MONITOR = 500;

/**
 * Stable jobId so re-registering the repeatable job on every worker restart
 * upserts the same schedule instead of piling up duplicate repeatable jobs.
 */
const CLEANUP_REPEAT_JOB_ID = 'cleanup-daily';

/** Once a day, at midnight. */
const CLEANUP_CRON = '0 0 * * *';

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name);
  private queue?: Queue<CleanupJobData>;
  private worker?: Worker<CleanupJobData>;

  constructor(private readonly prisma: UptimePrismaService) {}

  async onModuleInit(): Promise<void> {
    this.queue = createCleanupQueue();

    // BullMQ 6.x replaced `queue.add(..., { repeat })` + getRepeatableJobs/
    // removeRepeatableByKey with the Job Scheduler API. upsertJobScheduler is
    // idempotent on `jobSchedulerId`, so calling this on every worker restart
    // is safe — it updates the existing schedule instead of duplicating it.
    await this.queue.upsertJobScheduler(
      CLEANUP_REPEAT_JOB_ID,
      { pattern: CLEANUP_CRON },
      { name: 'trim-checks', data: {} }
    );

    this.worker = createWorker<CleanupJobData>(QUEUE_NAMES.CLEANUP, () => this.trimChecks(), {
      concurrency: 1,
    });

    this.worker.on('error', (err) => {
      this.logger.error(`cleanup worker error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async trimChecks(): Promise<void> {
    const monitors = await this.prisma.monitor.findMany({ select: { id: true } });

    for (const { id: monitorId } of monitors) {
      const staleChecks = await this.prisma.monitorCheck.findMany({
        where: { monitorId },
        orderBy: { timestamp: 'desc' },
        skip: CHECKS_TO_KEEP_PER_MONITOR,
        select: { id: true },
      });

      if (staleChecks.length === 0) {
        continue;
      }

      await this.prisma.monitorCheck.deleteMany({
        where: { id: { in: staleChecks.map((check) => check.id) } },
      });
    }

    this.logger.log(
      `cleanup: trimmed MonitorCheck rows for ${monitors.length} monitor(s) to newest ${CHECKS_TO_KEEP_PER_MONITOR}`
    );
  }
}
