# uptime-monitor

A self-hosted uptime monitor (Pingdom replacement): a dashboard to manage monitored URLs and view status/history/incidents, plus a worker that checks every monitor on a schedule and alerts via Telegram, Signal, and email when something goes down.

See [CLAUDE.md](./CLAUDE.md) for the full architecture doc (apps, libs, data model, queue design, conventions).

## Quickstart

```bash
# 1. Clone and install
git clone <repo-url>
cd website-monitoring
npm install   # also runs `prisma generate` via postinstall

# 2. Set up environment — ONE root .env for every app/lib, not a per-app one
cp .env.example .env
# then edit .env: set a real DATABASE_URL/REDIS_URL, generate secrets for
# NEXTAUTH_SECRET/INTERNAL_API_KEY, and set ADMIN_USERNAME/ADMIN_PASSWORD
# for the seed script. See CLAUDE.md's Environment Setup section for how
# each app loads this file.

# 3. Set up the database (requires a running Postgres at DATABASE_URL)
npm run uptime:migrate
npm run uptime:seed

# 4. Run everything (requires a running Redis at REDIS_URL)
npm run dev
```

- Dashboard: http://localhost:4000
- API: http://localhost:4001
- Worker (internal — health check + Bull Board): http://localhost:4002/health, http://localhost:4002/admin/queues

## Individual apps

```bash
npm run dev:web       # web dashboard :4000
npm run serve:api     # api :4001
npm run serve:worker  # worker :4002
```

## Build / lint / typecheck

```bash
nx build web
nx run-many --target=build --all
nx lint web
nx run-many --target=lint --all
npm run typecheck
```

## Database

```bash
npm run uptime:generate   # prisma generate
npm run uptime:migrate    # prisma migrate dev
npm run uptime:studio     # Prisma Studio
npm run uptime:seed       # seed the single admin User
```

## Claude Code automation

This repo has a `.claude/` setup with specialized agents (`web-agent`, `api-agent`, `worker-agent`, `db-agent`, `ui-agent`, `code-reviewer`) and slash-command skills (`/new-api-resource`, `/db-migrate`, `/new-queue-job`, `/new-component`, `/design-check`, `/review`, `/lint-fix`, `/commit`, `/list-flow`) for building out this project consistently — see CLAUDE.md's "Skills" section for the full list.
