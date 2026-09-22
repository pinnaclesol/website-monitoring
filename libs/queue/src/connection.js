"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisConnection = getRedisConnection;
const tslib_1 = require("tslib");
const ioredis_1 = tslib_1.__importDefault(require("ioredis"));
let connection;
/**
 * Shared Redis connection for every BullMQ Queue/Worker in the workspace.
 * `apps/api` and `apps/worker` must go through this — never construct a
 * second `IORedis` instance directly.
 */
function getRedisConnection() {
    if (!connection) {
        const url = process.env.REDIS_URL;
        if (!url) {
            throw new Error('REDIS_URL is not set');
        }
        // BullMQ requires maxRetriesPerRequest: null on the shared connection.
        connection = new ioredis_1.default(url, { maxRetriesPerRequest: null });
    }
    return connection;
}
//# sourceMappingURL=connection.js.map