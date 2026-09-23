---
name: list-flow
description: Re-derive the check to confirm-down to alert to repeat to recovery flow from the current code and print it as a short numbered flow.
allowed-tools: Read, Glob, Grep
user-invocable: true
---

Re-derive the uptime-monitor's core stateful flow directly from the current code (not from memory/docs) and print it as a short numbered list — this is the single easiest part of the app to quietly break, so it's worth being able to sanity-check against spec at any time.

1. Find the `monitor-checks` queue producer (monitor registration/removal on create/pause/delete) in `apps/api`.
2. Find the `monitor-checks` consumer/processor in `apps/worker` — trace the check → retry-on-failure → confirmed-down logic and the exact job options used for retry/backoff.
3. Find the `MonitorAlertState`/`Incident` transition logic — trace exactly when a down alert fires, when a reminder fires (and what gates it), and when recovery fires and closes the incident.
4. Find the `alert-dispatch` consumer — trace which channels (Telegram/Signal/email) actually get called and in what order.
5. Print the full flow as a numbered list, each step citing the file:line it was derived from, e.g.:
   ```
   1. [apps/api/src/monitors/monitors.service.ts:42] Monitor created → repeatable job registered on `monitor-checks` (every 60s, jittered)
   2. [apps/worker/src/checks/checks.service.ts:18] Job fires → GET request, 10s timeout
   3. [apps/worker/src/checks/checks.service.ts:31] Non-200/timeout → BullMQ retries once after 5s (job options)
   4. ...
   ```
6. Flag any place where the actual code diverges from the invariants in `worker-agent.md` (e.g. a reminder that could fire before `alertIntervalSeconds` elapses, a code path that could leave two open `Incident`s for one monitor).
