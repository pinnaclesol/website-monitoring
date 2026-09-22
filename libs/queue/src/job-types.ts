/** Payload for a `site-checks` job — one repeatable job per active Site, plus one-off "check now" jobs. */
export interface SiteCheckJobData {
  siteId: string;
  domain: string;
}

export type AlertEvent = 'down' | 'reminder' | 'recovery';

/** Payload for an `alert-dispatch` job — one job per alert event, enqueued by apps/worker. */
export interface AlertDispatchJobData {
  siteId: string;
  event: AlertEvent;
  /** ISO timestamp the event was detected/triggered at. */
  occurredAt: string;
  /** Only present for `recovery` events. */
  downtimeMs?: number;
}

/** Payload for the daily `cleanup` job — trims each Site's Check rows to the newest 100. No fields needed. */
export type CleanupJobData = Record<string, never>;
