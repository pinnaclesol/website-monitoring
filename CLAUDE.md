# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A self-hosted uptime monitor (Pingdom replacement): a dashboard to manage monitored URLs and view status/history/incidents, and a worker that checks every monitor on a schedule and alerts via Telegram, Signal, and email when something goes down. Standalone NX monorepo — own repo, own VPS(s), own dedicated Postgres, own Redis, own login. **Not** part of the `billing-manager` repo; it deliberately reuses that repo's proven Claude Code setup *format* and a few architectural patterns (auth flow, `libs/<x>-db` Prisma pattern, BullMQ usage), not its code or its RBAC.

Designed for scale from day one: **thousands of monitors**, each checked independently on its own schedule via a Redis-backed job queue — not a single-process interval loop.

## Architecture

Three independently deployable apps, two dedicated infra dependencies (Postgres, Redis):

- **`apps/web`** — Dashboard frontend (port 4000): Next.js + Tailwind + shadcn/ui. Login-only auth (no sign-up, no roles/permissions — single admin). Views: Dashboard (monitor grid/table, stats, search/filter), Incidents (downtime log), Settings (branding + Telegram/Signal/email + alert behavior — the sidebar nav label is "Settings", the route is still `/notifications` to avoid churn). Talks only to `apps/api`. **Never makes outbound HTTP requests to monitored sites.**
- **`apps/api`** — Backend (port 4001): NestJS. Auth (`/api/auth/validate` against its own `User` table), Monitors/Checks/Incidents/Settings CRUD, all **read-only** on `MonitorCheck`/`Incident` data. Also the **BullMQ producer**: registers/removes each monitor's repeatable check job on create/pause/delete, enqueues one-off jobs for manual "check now." Imports `@uptime/queue` for a typed `Queue` client — never imports a BullMQ `Worker`, never makes an HTTP request to a monitored site itself.
- **`apps/worker`** — Check engine (port 4002, internal — own VPS): NestJS. The **BullMQ consumer(s)** — one or more `Worker` processes draining the `monitor-checks` queue (the actual outbound HTTP checks live here and *only* here), the `alert-dispatch` queue (Telegram/Signal/email sends), and a daily `cleanup` job. Hosts Bull Board (auth-gated) for queue observability and `GET /health` for ops. This is the only app allowed to talk to monitored sites' URLs directly.

Kept as **separate apps/servers on purpose** (not merged into `apps/api` the way `billing-api` merges its BullMQ queues into itself): the checking workload makes thousands of outbound HTTP calls to arbitrary, unpredictable external sites — slow, hanging, or misbehaving responses must never be able to degrade the login/dashboard API's responsiveness, and checking capacity needs to scale independently of dashboard traffic.

## Libs

- **`libs/uptime-db`** — Prisma client + schema, used by `apps/api` and `apps/worker`. Mirrors `billing-manager`'s `libs/rebil-db` pattern: `UptimePrismaService`/`UptimePrismaModule` (`@Global()`), `run-prisma.js` env loader, no `project.json` needed (Nx auto-discovers from `package.json` scripts). Import as `@uptime/uptime-db`.
- **`libs/queue`** — Shared BullMQ setup used by `apps/api` (producer) and `apps/worker` (consumer): Redis connection factory (`REDIS_URL`), queue name constants, typed job payloads. Neither app should construct its own `IORedis`/`Queue`/`Worker` instance outside this lib. Import as `@uptime/queue`.
- **`libs/ui`** — shadcn/ui primitives + composed components (`LoginForm`, `StatCard`, `MonitorTable`, `HistoryBars`, notification settings forms), plus the **design-token system** (Tailwind theme ported from the client-approved mockup: CSS custom properties for light/dark via `[data-theme]`, Geist/Geist Mono fonts, badge/button/toggle/modal/toast/dropdown/stat-card styles). `apps/web` imports everything from `@uptime/ui`.
- **`libs/auth`** — shared `AuthUser` type.

## Data model (`libs/uptime-db/prisma/schema.prisma`)

Plain PascalCase model names — this Postgres instance is fully dedicated to this app, so there's no need for the `Rebil_`-style disambiguation prefix `billing-manager` uses on a shared DB. Names are deliberately self-descriptive (`Monitor`, `MonitorCheck`, `MonitorAlertState`, `AlertSettings`, `BrandingSettings`) rather than generic (`Site`, `Check`, `AlertState`, `NotificationSettings`, `AppSettings`, used in an earlier pass) — a dev browsing the table list or the generated Prisma Client should be able to tell what each one is for without cross-referencing this file.

- `User` — id, username, password (bcrypt hash), active, createdAt, updatedAt. Single admin, seeded via script — **no sign-up route**.
- `Monitor` — id, domain, label?, isPaused, deletedAt? (soft delete — history survives removal), createdAt, updatedAt. The core entity — a monitored URL/domain. Named `Monitor`, not `Site`, to match the app's own UI language ("Add monitor", "Monitors" table).
- `MonitorCheck` — id, monitorId, timestamp, isUp, statusCode?, responseTimeMs?, error?. Index `(monitorId, timestamp desc)`. Capped at newest 100/monitor by the daily `cleanup` job.
- `Incident` — id, monitorId, startedAt, endedAt?, createdAt. One open row (`endedAt = null`) per currently-down monitor — opened on down-confirmed, closed on recovery. Backs the Incidents view and 24h-uptime % (computed from incident overlap with the window, not from the raw `MonitorCheck` sample).
- `MonitorAlertState` — monitorId (unique), isDown, lastAlertSentAt?. Drives the down → repeat-every-N → recovery state machine.
- `TelegramAccount` — id, label, botToken, chatId, isActive, createdAt. Multiple rows = multiple destinations, managed from Settings.
- `SignalConfig` — senderNumber, recipientNumber, isActive. Single config (not multi-account) — requires a running `signal-cli-rest-api` sidecar with a registered phone number; this is an infra dependency, not just a credential.
- `EmailRecipient` — id, email, isActive, createdAt. Sent via one env-configured SMTP relay.
- `AlertSettings` — singleton row: alertIntervalSeconds (default 300), recoveryAlertEnabled (default true). Named `AlertSettings` (not the more generic `NotificationSettings`) since that's precisely what it holds.
- `BrandingSettings` — singleton row: siteName (default "Uptime Monitor"), faviconUrl? (one asset used as both the sidebar logo mark and the browser favicon). Edited from the "General" section at the top of the Settings view (`apps/web`'s `/notifications` route — the sidebar nav label is "Settings" since this page now covers more than notification channels, but the route/CLAUDE.md's "Notifications" framing below is unchanged to avoid churn). Named `BrandingSettings` (not `AppSettings`) to say exactly what it configures, matching its own API route (`/settings/branding`).

No `ForceCheckRequest`/polling table — manual "check now" is a direct BullMQ one-off enqueue from `apps/api`, not database-mediated.

## Queue architecture (BullMQ + Redis, via `libs/queue`)

Chosen specifically to handle **thousands of monitors** without a thundering herd or a single-process bottleneck — not a plain `setInterval`/`@nestjs/schedule` loop.

- **`monitor-checks`** queue — one repeatable job per active `Monitor`, registered via BullMQ's Job Scheduler API (`queue.upsertJobScheduler(jobId, { every: 60_000, startDate }, ...)` — BullMQ 6.x replaced the old `repeat`/`getRepeatableJobs`/`removeRepeatableByKey` API with `upsertJobScheduler`/`getJobSchedulers`/`removeJobScheduler`, and dropped the old `jitter` option). Jitter is emulated by randomizing each monitor's `startDate` within one interval, spreading thousands of jobs across the 60s window instead of firing them all at once. Job options `attempts: 2, backoff: { type: 'fixed', delay: 5000 }` implement the "wait 5s and retry once before confirming down" rule as native BullMQ behavior, not hand-rolled retry logic. `apps/api` registers/removes the repeatable job whenever a `Monitor` is created/paused/resumed/deleted; `apps/worker` consumes it, performs the check, writes the `MonitorCheck` row, and runs the `MonitorAlertState`/`Incident` transition logic.
- **`alert-dispatch`** queue — one job per alert event (down-confirmed, repeat reminder, recovery), consumed by `apps/worker`, decoupled from `monitor-checks` so a slow/rate-limited Telegram or SMTP call never delays the next check cycle.
- **`cleanup`** queue — one daily repeatable job trimming each monitor's `MonitorCheck` rows to the newest 100.
- **Manual "check now"** — `apps/api` enqueues a one-off (non-repeatable) high-priority job directly onto `monitor-checks` for that one monitor; the dashboard polls for the fresh result.
- **Bull Board**, mounted on `apps/worker`, auth-gated — queue observability, same proven pattern as `billing-manager`'s per-billing-plan BullMQ queues on `billing-api`.
- Redis is a new, explicit infra dependency (default: co-located on the `worker` VPS). It's a point of failure for the *checking pipeline* only — already-collected data stays safe in Postgres regardless of Redis state.

## Commands

```bash
# Run all apps in parallel
npm run dev

# Run individual apps
npm run dev:web       # web dashboard :4000
npm run serve:api     # api :4001
npm run serve:worker  # worker :4002 (BullMQ consumer + Bull Board + /health)

# Build / lint / typecheck
nx build web
nx run-many --target=build --all
nx lint web
nx run-many --target=lint --all
npm run typecheck

# uptime-db (libs/uptime-db)
npm run uptime:generate   # prisma generate
npm run uptime:migrate    # prisma migrate dev
npm run uptime:studio     # Prisma Studio
npm run uptime:seed       # seed the single admin User
```

## Environment Setup

**One root `.env`, not a per-app `.env`.** Copy `.env.example` (repo root) to `.env` and fill it in — every app and lib loads this same file:

```
DATABASE_URL=postgresql://user:password@localhost:5432/uptime_db
REDIS_URL=redis://localhost:6379
INTERNAL_API_KEY=...

NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:4000
API_URL=http://localhost:4001
NEXT_PUBLIC_API_URL=http://localhost:4001

SIGNAL_REST_API_URL=http://localhost:8080   # signal-cli-rest-api sidecar
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=alerts@yourdomain.com
BULL_BOARD_USER=...
BULL_BOARD_PASS=...

ADMIN_USERNAME=admin
ADMIN_PASSWORD=...      # npm run uptime:seed
```

`PORT` is deliberately not one of these vars: `apps/api` and `apps/worker` would collide on the same key from a shared file, so each just keeps its own code-level default (`process.env.PORT ?? 4001` / `?? 4002`) and `PORT` is left unset here.

How each piece loads it (none of these rely on cwd — all resolve an explicit path to the repo-root `.env`):
- `apps/web` — `next.config.js` loads it via `dotenv` before Next boots (Next only auto-loads its own app-local `.env` otherwise).
- `apps/api` / `apps/worker` — `src/main.ts` loads it via `dotenv` as the first statement in `bootstrap()`, before `NestFactory.create(...)` instantiates anything that reads `process.env`.
- `libs/uptime-db` — `run-prisma.js` (used by `migrate`/`migrate:prod`/`studio`) and `src/seed.ts` both load it explicitly by resolved path.

## Key Conventions

- **`apps/worker` is the only piece allowed to make outbound HTTP requests to monitored sites.** `apps/web` and `apps/api` never do — `apps/api` only produces/manages queue jobs.
- **Scheduling is BullMQ + Redis**, not `@nestjs/schedule`/`setInterval` — see Queue architecture above. Do not "simplify" this back to a plain interval loop; it was chosen specifically for thousands-of-monitors scale and independent worker scaling.
- **Alert-state invariants**: exactly one open `Incident` per currently-down monitor; alert dedup is driven by `MonitorAlertState.lastAlertSentAt` + `AlertSettings.alertIntervalSeconds`; recovery always closes the open `Incident` and (if `recoveryAlertEnabled`) sends a "back online" message. Never send a second "down" alert for a monitor that's already down — only the interval-gated reminder.
- **Secrets discipline**: Telegram bot tokens, Signal phone numbers, and SMTP credentials are never logged, never returned in API responses, and always read from the DB (`TelegramAccount`/`SignalConfig`/`EmailRecipient`) or env — never hardcoded.
- **Design-token system**: every new `apps/web`/`libs/ui` component must use the ported Tailwind theme tokens (light/dark via `[data-theme]`) — no ad-hoc hex colors, no one-off component styles. This is the standing fix for "keep the design consistent/modern" instead of needing to be said every prompt.
- **Auto-checked on every edit**: a `PostToolUse` hook runs typecheck + affected-project lint after every `Write`/`Edit` automatically — you should never need to manually run `tsc`/`lint` to catch an obvious break. `/lint-fix` exists separately for deliberately auto-fixing what the hook surfaces.
- **Single admin login, no RBAC** — deliberate deviation from `billing-manager`'s roles/permissions system. Don't add roles/permissions machinery here.
- **Naming**: plain PascalCase Prisma models, `@uptime/<lib>` path aliases (not `@billing/<lib>`).
- Prisma migrations in `libs/uptime-db/prisma/migrations/` should not be manually edited. Never run `prisma migrate reset` — it wipes all data.

## Skills (slash commands)

| Skill | Purpose |
|-------|---------|
| `/new-api-resource <name>` | Scaffold a NestJS module + controller + service + DTO in `apps/api`, plus the matching Next.js proxy route in `apps/web` |
| `/db-migrate <name>` | Add/modify a Prisma model in `libs/uptime-db` and run a migration |
| `/new-queue-job <name>` | Scaffold a new BullMQ job: typed payload in `libs/queue`, producer call in `apps/api`, consumer processor in `apps/worker` |
| `/new-component <name>` | Scaffold a shared UI component in `libs/ui`, pre-wired to the design-token file |
| `/design-check` | Audit the current diff's frontend files against the design-token system (colors/spacing/dark-mode/typography) |
| `/review` | Independent code review of current changes — delegates to the `code-reviewer` agent |
| `/lint-fix` | Run lint + typecheck across all three apps and auto-fix |
| `/commit` | Stage all changes and create a formatted git commit |
| `/list-flow` | Re-derive the check → confirm-down → alert → repeat → recovery flow from the current code |
