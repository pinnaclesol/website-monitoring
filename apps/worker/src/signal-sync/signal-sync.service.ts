import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import {
  createSignalSyncQueue,
  createWorker,
  QUEUE_NAMES,
  SignalSyncJobData,
} from '@uptime/queue';
import { UptimePrismaService } from '@uptime/uptime-db';

const SIGNAL_SYNC_JOB_ID = 'signal-sync-recurring';
/** Repeat every 5 minutes, matching ecom-dashboard */
const SIGNAL_SYNC_CRON = '*/5 * * * *';

@Injectable()
export class SignalSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SignalSyncService.name);
  private queue?: Queue<SignalSyncJobData>;
  private worker?: Worker<SignalSyncJobData>;

  constructor(private readonly prisma: UptimePrismaService) {}

  private get signalApiUrl(): string {
    return (process.env.SIGNAL_REST_API_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  }

  async onModuleInit(): Promise<void> {
    this.queue = createSignalSyncQueue();

    // Schedule repeatable background job every 5 minutes in BullMQ (matches ecom-dashboard)
    await this.queue.upsertJobScheduler(
      SIGNAL_SYNC_JOB_ID,
      { pattern: SIGNAL_SYNC_CRON },
      { name: 'sync-signal-accounts', data: { manual: false } }
    );
    this.logger.log(`Scheduled repeatable BullMQ job ${SIGNAL_SYNC_JOB_ID} (${SIGNAL_SYNC_CRON})`);

    // Worker processor
    this.worker = createWorker<SignalSyncJobData>(
      QUEUE_NAMES.SIGNAL_SYNC,
      (job) => this.processJob(job),
      { concurrency: 1 }
    );

    this.worker.on('error', (err) => {
      this.logger.error(`signal-sync worker error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async processJob(job: Job<SignalSyncJobData>): Promise<any> {
    this.logger.log(`Processing BullMQ Signal sync job ${job.id} (${job.name})...`);
    await job.updateProgress(10);

    const result = await this.syncAccountsAndGroups();
    await job.updateProgress(100);

    this.logger.log(`Signal sync job ${job.id} completed: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Syncs connected Signal accounts and groups from signal-bridge into PostgreSQL.
   */
  async syncAccountsAndGroups(): Promise<{ accountsSynced: number; groupsSynced: number; removed: number }> {
    let accountsSynced = 0;
    let groupsSynced = 0;
    let removed = 0;

    try {
      let accountsRes: Response;
      try {
        accountsRes = await fetch(`${this.signalApiUrl}/v1/accounts`, {
          signal: AbortSignal.timeout(15000),
        });
      } catch (fetchErr: any) {
        this.logger.warn(`Signal bridge at ${this.signalApiUrl} is currently unreachable: ${fetchErr.message}`);
        return { accountsSynced: 0, groupsSynced: 0, removed: 0 };
      }

      if (!accountsRes.ok) {
        this.logger.warn(`Failed to fetch accounts from Signal bridge (HTTP ${accountsRes.status})`);
        return { accountsSynced: 0, groupsSynced: 0, removed: 0 };
      }

      const data = await accountsRes.json();
      let connectedAccounts: string[] = [];

      if (Array.isArray(data)) {
        connectedAccounts = data
          .map((item) => (typeof item === 'string' ? item : item?.number || item?.account || ''))
          .filter(Boolean);
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.accounts)) {
          connectedAccounts = data.accounts
            .map((item: any) => (typeof item === 'string' ? item : item?.number || item?.account || ''))
            .filter(Boolean);
        } else {
          connectedAccounts = Object.keys(data).filter((k) => k.startsWith('+'));
        }
      }

      this.logger.log(`Found ${connectedAccounts.length} connected account(s) on Signal bridge: ${JSON.stringify(connectedAccounts)}`);

      const seenAccountIds: string[] = [];
      const seenGroupIds: string[] = [];
      const validActiveAccounts: string[] = [];
      const deviceName = process.env.SIGNAL_DEVICE_NAME || 'UptimeMonitor';

      for (const phoneNumber of connectedAccounts) {
        this.logger.log(`Processing sync for account: ${phoneNumber}`);

        let isStillLinked = true;
        try {
          const encodedPhone = encodeURIComponent(phoneNumber);
          const devicesRes = await fetch(`${this.signalApiUrl}/v1/devices/${encodedPhone}`, {
            signal: AbortSignal.timeout(15000),
          });

          if (devicesRes.ok) {
            const devicesData = await devicesRes.json();
            const devices = Array.isArray(devicesData) ? devicesData : [];
            const ourDevice =
              devices.find((d: any) => d.name?.toLowerCase() === deviceName.toLowerCase()) ||
              devices.find((d: any) => d.id > 1);

            if (!ourDevice && devices.length > 0) {
              this.logger.warn(
                `Account ${phoneNumber} is registered on bridge but our device "${deviceName}" is not linked. Cleaning up.`
              );
              isStillLinked = false;
            }
          } else {
            const status = devicesRes.status;
            let errorMsg = '';
            try {
              const errJson = await devicesRes.json();
              errorMsg = typeof errJson === 'string' ? errJson : errJson?.error || JSON.stringify(errJson);
            } catch {
              errorMsg = await devicesRes.text().catch(() => '');
            }

            if (
              status === 401 ||
              status === 403 ||
              errorMsg.toLowerCase().includes('unauthorized') ||
              errorMsg.toLowerCase().includes('auth') ||
              errorMsg.toLowerCase().includes('verification failed')
            ) {
              this.logger.warn(`Definitive authorization failure for ${phoneNumber}. Treating as unlinked.`);
              isStillLinked = false;
            }
          }
        } catch (deviceError: any) {
          this.logger.warn(`Could not verify devices for ${phoneNumber}: ${deviceError.message}`);
        }

        if (!isStillLinked) {
          try {
            await fetch(`${this.signalApiUrl}/v1/accounts/${encodeURIComponent(phoneNumber)}`, {
              method: 'DELETE',
              signal: AbortSignal.timeout(10000),
            });
            this.logger.log(`Removed unlinked account ${phoneNumber} from Signal bridge.`);
          } catch (e: any) {
            this.logger.error(`Failed to remove account ${phoneNumber} from bridge: ${e.message}`);
          }
          continue;
        }

        validActiveAccounts.push(phoneNumber);

        // Upsert account
        const account = await (this.prisma as any).signalAccount.upsert({
          where: { phoneNumber },
          update: { isActive: true },
          create: { phoneNumber, isActive: true },
        });

        seenAccountIds.push(account.id);
        accountsSynced++;

        // Fetch groups
        try {
          const encodedPhone = encodeURIComponent(phoneNumber);
          const groupsRes = await fetch(`${this.signalApiUrl}/v1/groups/${encodedPhone}`, {
            signal: AbortSignal.timeout(30000),
          });

          if (groupsRes.ok) {
            const allGroups = await groupsRes.json();
            const activeGroups = Array.isArray(allGroups)
              ? allGroups.filter((g: any) => Array.isArray(g.members) && g.members.includes(phoneNumber))
              : [];

            for (const groupData of activeGroups) {
              const group = await (this.prisma as any).signalGroup.upsert({
                where: {
                  accountId_groupId: {
                    accountId: account.id,
                    groupId: groupData.id,
                  },
                },
                update: {
                  name: groupData.name || 'Unnamed Group',
                  isActive: true,
                },
                create: {
                  accountId: account.id,
                  groupId: groupData.id,
                  name: groupData.name || 'Unnamed Group',
                  isActive: true,
                  receiveAlerts: false,
                },
              });

              seenGroupIds.push(group.id);
              groupsSynced++;
            }
          }
        } catch (groupError: any) {
          this.logger.error(`Failed to fetch groups for ${phoneNumber}: ${groupError.message}`);
        }
      }

      // Cleanup inactive groups
      if (seenAccountIds.length > 0) {
        await (this.prisma as any).signalGroup.updateMany({
          where: {
            accountId: { in: seenAccountIds },
            id: { notIn: seenGroupIds },
          },
          data: { isActive: false },
        });
      }

      // Cleanup missing / unlinked accounts from DB
      const accountsToRemove = await (this.prisma as any).signalAccount.findMany({
        where: { phoneNumber: { notIn: validActiveAccounts } },
      });

      if (accountsToRemove.length > 0) {
        const deleteResult = await (this.prisma as any).signalAccount.deleteMany({
          where: {
            id: { in: accountsToRemove.map((a: any) => a.id) },
          },
        });
        removed = deleteResult.count;
        this.logger.log(`Deleted ${removed} accounts that were unlinked from Signal.`);
      }

      return { accountsSynced, groupsSynced, removed };
    } catch (err: any) {
      this.logger.error(`Error during BullMQ Signal sync: ${err.message}`);
      throw err;
    }
  }
}
