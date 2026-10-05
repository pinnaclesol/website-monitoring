import type { RoleSummary } from '@uptime/auth';

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
    errorType: string | null;
    finalUrl: string | null;
    redirectCount: number | null;
    /** Up, but slower than the configured slow threshold (display only). */
    isSlow: boolean;
  } | null;
  history: Array<'up' | 'down'>;
  uptime24h: number | null;
  hasOpenIncident: boolean;
}

export type MonitorStatus = 'up' | 'down' | 'paused' | 'checking';

/** Only affects the badge — slow monitors still count as `up` everywhere else (filters, stats, alerts). */
export function isSlowMonitor(monitor: MonitorWithStatus): boolean {
  return monitorStatus(monitor) === 'up' && monitor.latestCheck?.isSlow === true;
}

export function monitorStatus(monitor: MonitorWithStatus): MonitorStatus {
  if (monitor.isPaused) return 'paused';
  if (!monitor.latestCheck) return 'checking';
  return monitor.latestCheck.isUp ? 'up' : 'down';
}

/** `GET /api/monitors` — server-side paginated; `data` is only the current page. */
export interface MonitorListResponse {
  data: MonitorWithStatus[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * `GET /api/monitors/stats` — dashboard-wide stat-card figures computed
 * across every monitor, independent of the paginated list's current
 * page/search/status filter. See apps/api's `MonitorsService.computeStats()`
 * for why `down` and `openIncidents` are deliberately different counts.
 */
export interface MonitorStats {
  total: number;
  paused: number;
  up: number;
  down: number;
  openIncidents: number;
  /** Whichever active monitor's outage has been running longest right now — `null` when nothing is currently down. */
  longestOpenIncident: {
    monitorId: string;
    domain: string;
    label: string | null;
    startedAt: string;
  } | null;
}

export interface IncidentWithMonitor {
  id: string;
  monitorId: string;
  timestamp: string;
  isUp: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
  checkLabel: string;
  checkNumber: number;
  totalChecks: number;
  monitor: { id: string; domain: string; label: string | null };
}

/** `GET /api/incidents` — server-side paginated; `data` is only the current page. */
export interface IncidentListResponse {
  data: IncidentWithMonitor[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AlertSettings {
  id: string;
  repeatIntervalSeconds: number;
  recoveryAlertEnabled: boolean;
}

/** How often apps/worker checks each active Monitor — mirrors apps/api's `settings/monitoring` response shape. */
export interface MonitoringSettings {
  id: string;
  checkIntervalSeconds: number;
  timeoutSeconds: number;
  slowThresholdMs: number;
  retryAttempts: number;
  retryDelaySeconds: number;
}

export interface TelegramAccount {
  id: string;
  label: string;
  botToken: string;
  chatId: string;
  isActive: boolean;
}

export interface SignalGroup {
  id: string;
  groupId: string;
  name: string | null;
  accountId: string;
  isActive: boolean;
  receiveAlerts: boolean;
}

export interface SignalAccount {
  id: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  groups: SignalGroup[];
}

export interface SignalConfig {
  id?: string;
  senderNumber?: string;
  recipientNumber?: string;
  isActive?: boolean;
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
  /** Every role this user holds — effective permissions are their union. */
  roles: RoleSummary[];
  /** The one bootstrap admin account — immutable via this API, by anyone. */
  isProtected: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One row from the fixed permission catalog (`GET /api/permissions`) — groups the Roles page's checkbox grid. */
export interface PermissionRecord {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

/** Mirrors apps/api's `roles` resource response shape. */
export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  /** True only for the seeded Admin role — cannot be renamed, have its permissions edited, or be deleted. */
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { permissions: number; users: number };
}

/** `GET /api/roles/:id` — adds the actual assigned permission ids, for pre-checking the edit modal's grid. */
export interface RoleDetail extends RoleRecord {
  permissionIds: string[];
}
