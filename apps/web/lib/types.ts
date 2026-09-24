import type { Role } from '@uptime/auth';

/** Mirrors apps/api's enriched GET /api/monitors response shape (monitors.service.ts's `enrich()`). */
export interface MonitorWithStatus {
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

export function monitorStatus(monitor: MonitorWithStatus): MonitorStatus {
  if (monitor.isPaused) return 'paused';
  if (!monitor.latestCheck) return 'checking';
  return monitor.latestCheck.isUp ? 'up' : 'down';
}

export interface IncidentWithMonitor {
  id: string;
  monitorId: string;
  startedAt: string;
  endedAt: string | null;
  monitor: { id: string; domain: string; label: string | null };
}

export interface AlertSettings {
  id: string;
  recoveryAlertEnabled: boolean;
}

/** How often apps/worker checks each active Monitor — mirrors apps/api's `settings/monitoring` response shape. */
export interface MonitoringSettings {
  id: string;
  checkIntervalSeconds: number;
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

/** Mirrors apps/api's `settings/smtp-config` response shape — never includes the password. */
export interface SmtpConfig {
  id: string;
  host: string;
  port: number;
  username: string | null;
  fromEmail: string;
  isActive: boolean;
  hasPassword: boolean;
}

/** Mirrors apps/api's `users` resource response shape — never includes password. */
export interface UserRecord {
  id: string;
  username: string;
  name: string | null;
  role: Role;
  /** The one bootstrap admin account — immutable via this API, by anyone. */
  isProtected: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
