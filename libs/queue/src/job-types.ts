/** Payload for a `monitor-checks` job — one repeatable job per active Monitor, plus one-off "check now" jobs. */
export interface MonitorCheckJobData {
  monitorId: string;
  domain: string;
}

export type AlertEvent = 'down' | 'recovery' | 'reminder';

/** Payload for an `alert-dispatch` job — one job per alert event, enqueued by apps/worker. */
export interface AlertDispatchJobData {
  monitorId: string;
  event: AlertEvent;
  /** ISO timestamp the event was detected/triggered at. */
  occurredAt: string;
  /** Only present for `recovery` events. */
  downtimeMs?: number;
}

/** Payload for the daily `cleanup` job — trims each Monitor's MonitorCheck rows to the newest 500. No fields needed. */
export type CleanupJobData = Record<string, never>;
