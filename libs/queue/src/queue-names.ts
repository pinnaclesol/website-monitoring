export const QUEUE_NAMES = {
  MONITOR_CHECKS: 'monitor-checks',
  ALERT_DISPATCH: 'alert-dispatch',
  CLEANUP: 'cleanup',
  SIGNAL_SYNC: 'signal-sync',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
