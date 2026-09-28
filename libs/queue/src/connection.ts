import IORedis from 'ioredis';

let connection: IORedis | undefined;

/**
 * Shared Redis connection for every BullMQ Queue/Worker in the workspace.
 * `apps/api` and `apps/worker` must go through this — never construct a
 * second `IORedis` instance directly.
 */
export function getRedisConnection(): IORedis {
  if (!connection) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error('REDIS_URL is not set');
    }
    // BullMQ requires maxRetriesPerRequest: null on the shared connection.
    connection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return connection;
}
