"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueue = createQueue;
exports.createWorker = createWorker;
exports.createSiteChecksQueue = createSiteChecksQueue;
exports.createAlertDispatchQueue = createAlertDispatchQueue;
exports.createCleanupQueue = createCleanupQueue;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const queue_names_1 = require("./queue-names");
/** Never construct a `Queue`/`Worker` directly — always go through these factories so every consumer shares the one Redis connection. */
function createQueue(name, opts) {
    return new bullmq_1.Queue(name, { connection: (0, connection_1.getRedisConnection)(), ...opts });
}
function createWorker(name, processor, opts) {
    return new bullmq_1.Worker(name, processor, { connection: (0, connection_1.getRedisConnection)(), ...opts });
}
function createSiteChecksQueue(opts) {
    return createQueue(queue_names_1.QUEUE_NAMES.SITE_CHECKS, opts);
}
function createAlertDispatchQueue(opts) {
    return createQueue(queue_names_1.QUEUE_NAMES.ALERT_DISPATCH, opts);
}
function createCleanupQueue(opts) {
    return createQueue(queue_names_1.QUEUE_NAMES.CLEANUP, opts);
}
//# sourceMappingURL=queue-factory.js.map