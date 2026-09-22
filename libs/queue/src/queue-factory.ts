import { Queue, QueueOptions, Worker, WorkerOptions, Processor } from 'bullmq';
import { getRedisConnection } from './connection';
import { QUEUE_NAMES } from './queue-names';
import { SiteCheckJobData, AlertDispatchJobData, CleanupJobData } from './job-types';

/** Never construct a `Queue`/`Worker` directly — always go through these factories so every consumer shares the one Redis connection. */
export function createQueue<T>(name: string, opts?: Partial<QueueOptions>): Queue<T> {
  return new Queue<T>(name, { connection: getRedisConnection(), ...opts });
}

export function createWorker<T>(
  name: string,
  processor: Processor<T>,
  opts?: Partial<WorkerOptions>
): Worker<T> {
  return new Worker<T>(name, processor, { connection: getRedisConnection(), ...opts });
}

export function createSiteChecksQueue(opts?: Partial<QueueOptions>) {
  return createQueue<SiteCheckJobData>(QUEUE_NAMES.SITE_CHECKS, opts);
}

export function createAlertDispatchQueue(opts?: Partial<QueueOptions>) {
  return createQueue<AlertDispatchJobData>(QUEUE_NAMES.ALERT_DISPATCH, opts);
}

export function createCleanupQueue(opts?: Partial<QueueOptions>) {
  return createQueue<CleanupJobData>(QUEUE_NAMES.CLEANUP, opts);
}
