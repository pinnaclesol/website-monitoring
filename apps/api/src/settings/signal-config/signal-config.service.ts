import { BadGatewayException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { createSignalSyncQueue, SignalSyncJobData } from '@uptime/queue';
import { Queue } from 'bullmq';

@Injectable()
export class SignalConfigService implements OnModuleDestroy {
  private readonly logger = new Logger(SignalConfigService.name);
  private queue: Queue<SignalSyncJobData> = createSignalSyncQueue();

  constructor(private readonly prisma: UptimePrismaService) {}

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  private get signalApiUrl(): string {
    return (process.env.SIGNAL_REST_API_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  }

  private get signalDeviceName(): string {
    return process.env.SIGNAL_DEVICE_NAME || 'UptimeMonitor';
  }

  /**
   * Retrieves all linked Signal accounts and their groups from the database.
   */
  async getAccounts() {
    return (this.prisma as any).signalAccount.findMany({
      where: { isActive: true },
      include: {
        groups: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Syncs linked accounts and groups directly from the Signal bridge sidecar.
   * Mirrors ecom-dashboard's SignalSyncService logic.
   */
  async syncAccountsAndGroups(): Promise<{ accountsSynced: number; groupsSynced: number; removed: number }> {
    this.logger.log('Starting Signal accounts and groups sync...');

    let accountsSynced = 0;
    let groupsSynced = 0;
    let removed = 0;

    try {
      // 1. Fetch current accounts from Signal bridge
      let accountsRes: Response;
      try {
        accountsRes = await fetch(`${this.signalApiUrl}/v1/accounts`, {
          signal: AbortSignal.timeout(15000),
        });
      } catch (fetchErr: any) {
        this.logger.error(`Failed to reach Signal bridge at ${this.signalApiUrl}: ${fetchErr.message}`);
        throw new BadGatewayException(
          `Cannot reach Signal bridge at ${this.signalApiUrl}: ${fetchErr.message}. Ensure the signal-bridge container is running and healthy.`
        );
      }

      if (!accountsRes.ok) {
        const errBody = await accountsRes.text().catch(() => '');
        this.logger.error(`Signal bridge at ${this.signalApiUrl}/v1/accounts returned HTTP ${accountsRes.status}: ${errBody}`);
        throw new BadGatewayException(
          `Signal bridge returned HTTP ${accountsRes.status}: ${errBody || 'Unknown error'}`
        );
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
      const deviceName = this.signalDeviceName;

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

        // Upsert account in DB
        const account = await (this.prisma as any).signalAccount.upsert({
          where: { phoneNumber },
          update: { isActive: true },
          create: { phoneNumber, isActive: true },
        });

        seenAccountIds.push(account.id);
        accountsSynced++;

        // Fetch groups for this account
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
          } else {
            this.logger.warn(`Could not fetch groups for ${phoneNumber} (HTTP ${groupsRes.status})`);
          }
        } catch (groupError: any) {
          this.logger.error(`Failed to fetch groups for account ${phoneNumber}: ${groupError.message}`);
        }
      }

      // Cleanup: mark un-seen groups as inactive
      if (seenAccountIds.length > 0) {
        await (this.prisma as any).signalGroup.updateMany({
          where: {
            accountId: { in: seenAccountIds },
            id: { notIn: seenGroupIds },
          },
          data: { isActive: false },
        });
      }

      // Cleanup missing/unlinked accounts from DB
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

      this.logger.log(`Signal sync completed: ${accountsSynced} accounts, ${groupsSynced} groups.`);
      return { accountsSynced, groupsSynced, removed };
    } catch (error: any) {
      this.logger.error(`Error during Signal sync: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Toggles whether a specific Signal group receives uptime/downtime alerts.
   */
  async toggleGroupAlerts(groupId: string, receiveAlerts: boolean) {
    return (this.prisma as any).signalGroup.update({
      where: { id: groupId },
      data: { receiveAlerts },
    });
  }

  /**
   * Unlinks device from Signal bridge and deletes account from DB.
   */
  async deleteAccount(phoneNumber: string) {
    // 1. Unlink device (best effort)
    try {
      const devicesRes = await fetch(`${this.signalApiUrl}/v1/devices/${encodeURIComponent(phoneNumber)}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (devicesRes.ok) {
        const devices = await devicesRes.json();
        const ourDevice =
          devices.find((d: any) => d.name?.toLowerCase() === this.signalDeviceName.toLowerCase()) ||
          devices.find((d: any) => d.id > 1);

        if (ourDevice) {
          await fetch(
            `${this.signalApiUrl}/v1/devices/${encodeURIComponent(phoneNumber)}/${ourDevice.id}`,
            {
              method: 'DELETE',
              signal: AbortSignal.timeout(10000),
            }
          );
          this.logger.log(`Unlinked device ${ourDevice.id} for ${phoneNumber}`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Device unlinking failed or already unlinked: ${e.message}`);
    }

    // 2. Remove account from bridge
    try {
      await fetch(`${this.signalApiUrl}/v1/accounts/${encodeURIComponent(phoneNumber)}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(10000),
      });
    } catch (e: any) {
      this.logger.warn(`Account removal from bridge failed: ${e.message}`);
    }

    // 3. Delete from database
    await (this.prisma as any).signalAccount.deleteMany({
      where: { phoneNumber },
    });

    return { success: true };
  }
}
