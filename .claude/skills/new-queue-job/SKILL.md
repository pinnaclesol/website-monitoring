---
name: new-queue-job
description: Scaffold a new BullMQ job type - typed payload in libs/queue, producer call in apps/api, consumer processor in apps/worker. Usage: /new-queue-job <job-name>
allowed-tools: Read, Write, Glob, Grep
user-invocable: true
---

Scaffold a new BullMQ job end-to-end across `libs/queue` (types), `apps/api` (producer), and `apps/worker` (consumer).

Argument: `$ARGUMENTS` — job name in kebab-case (e.g. `monitor-check`, `send-recovery-alert`)

## Architecture reminder

- `libs/queue` owns queue name constants, the Redis connection factory, and typed job payloads — both apps import from `@uptime/queue`, neither constructs its own `IORedis`/`Queue`/`Worker`.
- `apps/api` only ever produces (`queue.add(...)`) — never processes.
- `apps/worker` only ever consumes (`new Worker(...)`) — never produces, except when a job needs to enqueue a follow-up job on another queue (e.g. a check job enqueuing an alert-dispatch job), which is expected and fine.
- Existing queues: `monitor-checks`, `alert-dispatch`, `cleanup`. Only add a new queue if this job doesn't fit one of those — most new work should be a new job *type* within an existing queue, not a new queue.

## Steps

### 1. Define the job payload type
`libs/queue/src/jobs/<job-name>.ts`:
```ts
export interface <PascalCase>JobData {
  // fields
}
export const <SCREAMING_SNAKE>_JOB = '<job-name>' as const
```
Export from `libs/queue/src/index.ts`.

### 2. Add the producer call
In the relevant `apps/api/src/<module>/<module>.service.ts`, inject the `Queue` client from `@uptime/queue` and call `queue.add(<SCREAMING_SNAKE>_JOB, data satisfies <PascalCase>JobData, { attempts, backoff, jitter, ... as appropriate })`.

### 3. Add the consumer processor
In `apps/worker/src/<module>/<module>.processor.ts`, handle the job type with proper error handling — every processor must:
- Wrap the core logic in try/catch and let BullMQ's retry/backoff handle transient failures (don't swallow the exception).
- Log failures with enough context to debug (monitor/job id) but **never log secrets** (bot tokens, phone numbers, SMTP creds).
- Respect the alert-state invariants in `worker-agent.md` if this job touches `MonitorAlertState`/`Incident`.

### 4. Confirm
List all files created/modified and which queue the job runs on.
