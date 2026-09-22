/** Mirrors apps/api's enriched GET /api/sites response shape (sites.service.ts's `enrich()`). */
export interface SiteWithStatus {
  id: string;
  domain: string;
  label: string | null;
  isPaused: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestCheck: {
    isUp: boolean;
    statusCode: number | null;
    responseTimeMs: number;
    timestamp: string;
    error: string | null;
  } | null;
  history: Array<'up' | 'down'>;
  uptime24h: number | null;
  hasOpenIncident: boolean;
}

export type MonitorStatus = 'up' | 'down' | 'paused' | 'checking';

export function monitorStatus(site: SiteWithStatus): MonitorStatus {
  if (site.isPaused) return 'paused';
  if (!site.latestCheck) return 'checking';
  return site.latestCheck.isUp ? 'up' : 'down';
}

export interface IncidentWithSite {
  id: string;
  siteId: string;
  startedAt: string;
  endedAt: string | null;
  site: { id: string; domain: string; label: string | null };
}

export interface NotificationSettings {
  id: string;
  alertIntervalSeconds: number;
  recoveryAlertEnabled: boolean;
}

export interface TelegramAccount {
  id: string;
  label: string;
  botToken: string;
  chatId: string;
  isActive: boolean;
}

export interface SignalConfig {
  id: string;
  senderNumber: string;
  recipientNumber: string;
  isActive: boolean;
}

export interface EmailRecipient {
  id: string;
  email: string;
  isActive: boolean;
}
