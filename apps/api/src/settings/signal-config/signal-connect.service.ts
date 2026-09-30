import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { createSignalGroupsSyncQueue } from '@uptime/queue';
import { SignalConfigService } from './signal-config.service';

const DEFAULT_DEVICE_NAME = 'Uptime Monitor Alerts';
const TEST_MESSAGE = 'Test message from Uptime Monitor — Signal is connected.';

export interface SignalGroupSummary {
  id: string;
  name: string;
}

export type SignalConnectStatus =
  | { state: 'not_configured' }
  | { state: 'sidecar_unreachable'; detail: string }
  | {
      state: 'connected';
      senderNumber: string;
      isActive: boolean;
      deviceName?: string;
      linkedAt?: string;
      recipientGroupId?: string;
      recipientGroupName?: string;
    };

/**
 * Handles the "Connect Signal" QR-link flow against the signal-cli-rest-api
 * sidecar. Talks to the sidecar with the same discipline as
 * `apps/worker`'s `AlertsService.sendSignalAlert()`: plain global `fetch`,
 * `process.env.SIGNAL_REST_API_URL` read directly (no ConfigService), no
 * shared HTTP client abstraction, and phone numbers / raw sidecar response
 * bodies are never logged — only HTTP status codes / generic messages.
 */
@Injectable()
export class SignalConnectService {
  private readonly logger = new Logger(SignalConnectService.name);

  constructor(
    private readonly prisma: UptimePrismaService,
    private readonly signalConfigService: SignalConfigService
  ) {}

  private getBaseUrl(): string | undefined {
    const apiUrl = process.env.SIGNAL_REST_API_URL;
    if (!apiUrl) return undefined;
    return apiUrl.replace(/\/+$/, '');
  }

  /**
   * Fetches the sidecar's registered accounts list. Returns `undefined` on
   * any network/parse failure (caller treats that as "sidecar
   * unreachable") — never throws, never logs the raw body.
   */
  private async fetchRegisteredNumbers(baseUrl: string): Promise<string[] | undefined> {
    try {
      const res = await fetch(`${baseUrl}/v1/accounts`);
      if (!res.ok) {
        this.logger.warn(`Signal sidecar /v1/accounts returned HTTP ${res.status}`);
        return undefined;
      }
      const body = (await res.json()) as unknown;
      if (!Array.isArray(body)) return [];
      return body
        .map((entry) => (typeof entry === 'string' ? entry : (entry as { number?: string })?.number))
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
    } catch (err) {
      this.logger.warn(
        `Signal sidecar /v1/accounts unreachable: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      return undefined;
    }
  }

  /**
   * `GET settings/signal-config/groups` — reads from the locally cached
   * `SignalGroup` table (kept fresh by a separate ~60s background sync job
   * in `apps/worker`) rather than live-hitting the sidecar on every request.
   * Still requires a `SignalConfig` to exist first, matching
   * `getLinkQrCode()`'s "sidecar not configured" handling.
   */
  async getGroups(): Promise<{ groups: SignalGroupSummary[] }> {
    const config = await this.signalConfigService.findCurrent();
    if (!config) {
      throw new BadRequestException('Signal is not connected yet');
    }

    const groups = await this.prisma.signalGroup.findMany({ orderBy: { name: 'asc' } });
    return { groups: groups.map((g) => ({ id: g.groupId, name: g.name })) };
  }

  /**
   * Manual "refresh now" — enqueues a one-off job on the SAME
   * `signal-groups-sync` queue the every-60s repeatable job already runs
   * on, so `apps/worker`'s existing `SignalGroupsSyncService` consumer
   * processes it with no duplicated sync logic here (same producer/consumer
   * split as `MonitorsService.checkNow()`'s manual "check now" for
   * monitors). The frontend re-fetches `getGroups()` shortly after calling
   * this — the job usually finishes in well under a second since the
   * worker is normally idle between its own 60s ticks.
   */
  async triggerGroupsSync(): Promise<{ triggered: true }> {
    const config = await this.signalConfigService.findCurrent();
    if (!config || !config.senderNumber) {
      throw new BadRequestException('Signal is not connected yet');
    }

    const queue = createSignalGroupsSyncQueue();
    await queue.add('sync-signal-groups-manual', {}, { priority: 1 });
    return { triggered: true };
  }

  async getStatus(): Promise<SignalConnectStatus> {
    const config = await this.signalConfigService.findCurrent();
    if (!config) {
      return { state: 'not_configured' };
    }

    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { state: 'sidecar_unreachable', detail: 'Signal sidecar is not configured' };
    }

    const numbers = await this.fetchRegisteredNumbers(baseUrl);
    if (numbers === undefined) {
      return { state: 'sidecar_unreachable', detail: 'Signal sidecar is unreachable' };
    }

    if (!numbers.includes(config.senderNumber)) {
      return { state: 'not_configured' };
    }

    const device = await this.fetchOwnDeviceInfo(baseUrl, config.senderNumber);

    // Trust whatever's currently stored — the background sync job (running
    // independently in `apps/worker` every ~60s) is what keeps
    // `recipientGroupId`/`recipientGroupName` accurate, including
    // auto-clearing them if the group stops appearing in Signal's live
    // list. No live sidecar group check/re-validation happens here anymore.
    return {
      state: 'connected',
      senderNumber: config.senderNumber,
      isActive: config.isActive,
      ...(device ? { deviceName: device.name, linkedAt: device.linkedAt } : {}),
      ...(config.recipientGroupId
        ? {
            recipientGroupId: config.recipientGroupId,
            recipientGroupName: config.recipientGroupName ?? undefined,
          }
        : {}),
    };
  }

  /**
   * Best-effort only — device metadata is a display nicety (see the
   * Notifications UI's "Linked as ... since ..." line), never load-bearing:
   * `getStatus()` still reports `connected` even if this fails, since the
   * account-list check above is what actually determines connectivity.
   * Matches by `DEFAULT_DEVICE_NAME` since that's the exact name this
   * service itself requests via `getLinkQrCode()` — the linked phone (or
   * any other companion device) shows up in this same list but won't match.
   */
  private async fetchOwnDeviceInfo(
    baseUrl: string,
    senderNumber: string
  ): Promise<{ name: string; linkedAt: string } | undefined> {
    try {
      const res = await fetch(`${baseUrl}/v1/devices/${encodeURIComponent(senderNumber)}`);
      if (!res.ok) return undefined;
      const devices = (await res.json()) as Array<{ name?: string; creation_timestamp?: number }>;
      const ownDevice = devices.find((d) => d.name === DEFAULT_DEVICE_NAME);
      if (!ownDevice?.creation_timestamp) return undefined;
      return { name: DEFAULT_DEVICE_NAME, linkedAt: new Date(ownDevice.creation_timestamp).toISOString() };
    } catch {
      return undefined;
    }
  }

  async getLinkQrCode(deviceName?: string): Promise<{ dataUrl: string }> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new BadRequestException('Signal sidecar is not configured');
    }

    const name = deviceName?.trim() || DEFAULT_DEVICE_NAME;

    try {
      const res = await fetch(`${baseUrl}/v1/qrcodelink?device_name=${encodeURIComponent(name)}`);
      if (!res.ok) {
        this.logger.error(`Signal sidecar QR link request failed (HTTP ${res.status})`);
        throw new BadRequestException(`Signal sidecar returned an error (HTTP ${res.status})`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return { dataUrl: `data:image/png;base64,${base64}` };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Signal sidecar QR link error: ${err instanceof Error ? err.message : 'unknown error'}`);
      throw new BadRequestException('Failed to reach the Signal sidecar');
    }
  }

  async getLinkStatus(): Promise<{ linked: boolean; senderNumber?: string; error?: string }> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { linked: false, error: 'sidecar_unreachable' };
    }

    const numbers = await this.fetchRegisteredNumbers(baseUrl);
    if (numbers === undefined) {
      return { linked: false, error: 'sidecar_unreachable' };
    }

    const [senderNumber] = numbers;
    if (!senderNumber) {
      return { linked: false };
    }

    const existing = await this.signalConfigService.findCurrent();
    await this.prisma.signalConfig.upsert({
      where: { id: existing?.id ?? '' },
      create: {
        senderNumber,
        isActive: true,
      },
      update: {
        senderNumber,
        isActive: true,
      },
    });

    return { linked: true, senderNumber };
  }

  /**
   * Group-only: fallback-number support is temporarily dropped from this
   * path (the CRUD module itself is untouched and still fully functional,
   * just unused here for now).
   */
  async testSend(): Promise<{ sent: true }> {
    const config = await this.signalConfigService.findCurrent();
    if (!config || !config.senderNumber) {
      throw new BadRequestException('Signal is not connected yet');
    }

    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new BadRequestException('Signal is not connected yet');
    }

    if (!config.recipientGroupId) {
      throw new BadRequestException('Select a Signal group before sending a test message.');
    }

    const sent = await this.postSignalMessage(baseUrl, config.senderNumber, config.recipientGroupId);
    if (!sent) {
      throw new BadRequestException('Failed to send Signal test message');
    }
    return { sent: true };
  }

  private async postSignalMessage(baseUrl: string, senderNumber: string, recipient: string): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/v2/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: TEST_MESSAGE,
          number: senderNumber,
          recipients: [recipient],
        }),
      });
      if (!res.ok) {
        this.logger.error(`Signal test send failed (HTTP ${res.status})`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Signal test send error: ${err instanceof Error ? err.message : 'unknown error'}`);
      return false;
    }
  }

  async disconnect(): Promise<{ disconnected: true }> {
    const config = await this.signalConfigService.findCurrent();
    if (!config) {
      return { disconnected: true };
    }

    const baseUrl = this.getBaseUrl();
    if (baseUrl) {
      try {
        const res = await fetch(`${baseUrl}/v1/accounts/${encodeURIComponent(config.senderNumber)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          this.logger.warn(`Signal sidecar unlink returned HTTP ${res.status} — proceeding to mark inactive anyway`);
        }
      } catch (err) {
        this.logger.warn(
          `Signal sidecar unlink error (proceeding to mark inactive anyway): ${
            err instanceof Error ? err.message : 'unknown error'
          }`
        );
      }
    }

    await this.prisma.signalConfig.update({
      where: { id: config.id },
      data: { isActive: false },
    });

    return { disconnected: true };
  }
}
