import { Queue, QueueOptions, Worker, WorkerOptions, Processor } from 'bullmq';
import { getRedisConnection } from './connection';
import { QUEUE_NAMES } from './queue-names';
import { MonitorCheckJobData, AlertDispatchJobData, CleanupJobData, SignalGroupsSyncJobData } from './job-types';

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

export function createMonitorChecksQueue(opts?: Partial<QueueOptions>) {
  return createQueue<MonitorCheckJobData>(QUEUE_NAMES.MONITOR_CHECKS, opts);
}

export function createAlertDispatchQueue(opts?: Partial<QueueOptions>) {
  return createQueue<AlertDispatchJobData>(QUEUE_NAMES.ALERT_DISPATCH, opts);
}

export function createCleanupQueue(opts?: Partial<QueueOptions>) {
  return createQueue<CleanupJobData>(QUEUE_NAMES.CLEANUP, opts);
}

export function createSignalGroupsSyncQueue(opts?: Partial<QueueOptions>) {
  return createQueue<SignalGroupsSyncJobData>(QUEUE_NAMES.SIGNAL_GROUPS_SYNC, opts);
}
