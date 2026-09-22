export const QUEUE_NAMES = {
  SITE_CHECKS: 'site-checks',
  ALERT_DISPATCH: 'alert-dispatch',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
