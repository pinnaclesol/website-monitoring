# uptime-monitor

A self-hosted uptime monitor (Pingdom replacement): a dashboard to manage monitored URLs and view status/history/incidents, plus a worker that checks every monitor on a schedule and alerts via Telegram, Signal, and email when something goes down.

See [CLAUDE.md](./CLAUDE.md) for the full architecture doc (apps, libs, data model, queue design, conventions).

## Architecture at a glance

Three apps, each its own Docker image — never merged together:

| App | Port | Role |
|---|---|---|
| `apps/web` | 4000 | Next.js dashboard. Talks only to `apps/api`. |
| `apps/api` | 4001 | NestJS. Auth + CRUD + BullMQ **producer**. Never reaches monitored sites. |
| `apps/worker` | 4002 | NestJS. BullMQ **consumer** — the only app allowed to call monitored sites. Hosts Bull Board (`/admin/queues`) and `/health`. |

Postgres and Redis are **not** containers this repo runs in production — they're externally managed (DigitalOcean Managed Databases). Locally, `docker-compose.dev.yml` runs throwaway Postgres/Redis containers for convenience only.

In production this is split across **two separate servers**, on purpose — a slow/hanging check against an arbitrary external site must never be able to degrade the login/dashboard:

- **Server 1 ("app")** — `docker-compose.web-api.yml`: `api` + `web` containers + an `nginx` container reverse-proxying to `web` (nginx is the only container with a published port; `api` has none, so it's unreachable except from `web`/`nginx` on the compose network).
- **Server 2 ("worker")** — `docker-compose.worker.yml`: `worker` container + its own `nginx` container fronting Bull Board/`/health`.

Both servers currently run **plain HTTP** (no domain/TLS wired up yet — see "Adding HTTPS back" below).

## Local development

Everything runs in Docker — you do **not** need to install Node, Postgres, or Redis on your machine.

### 1. Install Docker Desktop

Download it here if you don't have it yet: https://www.docker.com/products/docker-desktop/

Open Docker Desktop and make sure it's running (you'll see its icon in your system tray/menu bar) before continuing.

### 2. Clone the repo

```bash
git clone <repo-url>
cd website-monitoring
```

### 3. Set up your environment file

Copy the example files:

```bash
cp .env.example .env
cp .env.docker.example .env.docker
```

Open `.env` and fill in these values (ask a teammate or check the team's password manager for real values — never commit this file, it's already git-ignored):

- `INTERNAL_API_KEY` — any random string, e.g. run `openssl rand -hex 32` and paste the result
- `NEXTAUTH_SECRET` — same idea, run `openssl rand -base64 32` and paste the result
- `ADMIN_USERNAME` / `ADMIN_NAME` / `ADMIN_PASSWORD` — the login you'll use to sign in the first time (pick anything, this account gets created for you)

You can leave `SIGNAL_REST_API_URL`, `BULL_BOARD_USER`, and `BULL_BOARD_PASS` blank for now — nothing breaks locally without them.

`.env.docker` needs no changes — it already points at the Postgres/Redis containers this stack creates for you.

### 4. Start everything

```bash
docker compose -f docker-compose.dev.yml up --build
```

First run takes a couple of minutes (downloading images, installing packages). Leave this running in its own terminal — it's your dev server. Wait until you see all five containers logging (`postgres`, `redis`, `api`, `web`, `worker`) with no errors.

### 5. Create the first admin login

In a **new** terminal (leave the one from step 4 running):

```bash
docker compose -f docker-compose.dev.yml exec api npm run uptime:seed
```

This creates your admin account using the `ADMIN_USERNAME`/`ADMIN_PASSWORD` you set in `.env`.

### 6. Open the app

- Dashboard: http://localhost:4000 — log in with the admin username/password from step 3
- API health check: http://localhost:4001/api/health (should say `{"status":"ok"}`)
- Worker queue dashboard: http://localhost:4002/admin/queues

You're set up. Edit any file in `apps/` or `libs/` and the running app updates automatically — no restart needed.

### Everyday commands

Stop everything:
```bash
docker compose -f docker-compose.dev.yml down
```

Start it again later (keeps your data):
```bash
docker compose -f docker-compose.dev.yml up
```

See logs for one service:
```bash
docker compose -f docker-compose.dev.yml logs -f web
```
(swap `web` for `api` or `worker`)

### If something goes wrong

**"NX Recursive task invocation detected" in the logs, or a container keeps restarting** — this happens if the stack was shut down uncleanly (e.g. Docker Desktop was force-quit, or your computer slept while it was running). Fix:
```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build
```
This wipes the local database too, so re-run step 5 afterward to get your admin login back.

**Docker Desktop won't start / containers won't start at all** — make sure Docker Desktop is actually open and fully started (not just launching) before running any `docker compose` command.

**Port already in use (4000/4001/4002)** — something else on your machine is using that port. Close it, or ask in the team channel — these ports aren't meant to be changed lightly since they're wired into the compose file.

### Without Docker (native Node)

```bash
npm install   # also runs `prisma generate` via postinstall
npm run uptime:migrate
npm run uptime:seed
npm run dev              # all three apps in parallel
# or individually:
npm run dev:web       # :4000
npm run serve:api     # :4001
npm run serve:worker  # :4002
```

## Production deployment

Each server is a standalone `docker compose` stack — no shared state between them beyond the managed Postgres/Redis both connect to.

### First-time server setup

```bash
# On a fresh Ubuntu droplet, as root:
curl -fsSL https://raw.githubusercontent.com/pinnaclesol/website-monitoring/main/scripts/server-init.sh -o server-init.sh
# edit server-init.sh: fill in GITHUB_REPO_URL / PRIVATE_KEY_CONTENT (or clone by hand)
chmod +x server-init.sh && ./server-init.sh
```

`scripts/server-init.sh` installs Docker, sets up SSH access, clones the repo, configures the firewall (22/80/443), and sets up a 2GB swapfile. See its header for what each step does.

Then, per server:

```bash
cd /var/www/website-monitoring

# Server 1 ("app"):
cp .env.web-api.example .env.web-api
nano .env.web-api    # fill in DATABASE_URL, REDIS_URL, INTERNAL_API_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL
docker compose -f docker-compose.web-api.yml up -d --build

# Server 2 ("worker"):
cp .env.worker.example .env.worker
nano .env.worker      # fill in DATABASE_URL, REDIS_URL, BULL_BOARD_USER/PASS
docker compose -f docker-compose.worker.yml up -d --build
```

Generate the two secrets with:

```bash
openssl rand -hex 32      # INTERNAL_API_KEY
openssl rand -base64 32   # NEXTAUTH_SECRET
```

### Redeploying (after the first setup)

```bash
./scripts/redeploy.sh docker-compose.web-api.yml    # or docker-compose.worker.yml
```

Pulls latest `main`, rebuilds only what changed (Docker layer cache), restarts, and prunes old images. `api`'s container entrypoint runs `prisma migrate deploy` on every start — pending migrations apply automatically, no separate migration step needed.

### Adding HTTPS back

Both `nginx/*.conf.template` files currently serve plain HTTP (`listen 80 default_server`). Once a domain is pointed at a server:

1. Add `DOMAIN=` / `CERTBOT_EMAIL=` back to that server's `.env.*` file.
2. Restore the `443 ssl` server block + `ssl_certificate`/`ssl_certificate_key` lines in that server's `nginx/*.conf.template` (see git history — commits `e500d7d`/`b995494` removed them).
3. Add back the `certbot` service + `certbot_certs`/`certbot_webroot` volumes in that server's `docker-compose.*.yml`.
4. For `.env.web-api`, switch `NEXTAUTH_URL` to `https://` (plain `http://` was needed so NextAuth doesn't mark the session cookie `Secure`-only).
5. Run `./scripts/init-letsencrypt.sh web-api` (or `worker`) instead of a plain `docker compose up` for the first HTTPS boot — it bootstraps a temporary self-signed cert so nginx can start, then swaps in the real Let's Encrypt certificate. `docker compose up -d --build` (what `redeploy.sh` runs) is all you need after that; renewal is automatic.

## Manual Docker commands (without compose)

Useful for debugging a single container in isolation, or understanding what `docker compose` is doing under the hood. Run from the repo root.

**Build one image directly:**

```bash
docker build -f Dockerfile.api    --target production -t website-monitoring-api    .
docker build -f Dockerfile.web    --target production -t website-monitoring-web    .
docker build -f Dockerfile.worker --target production -t website-monitoring-worker .
```

Each Dockerfile is multi-stage (`deps` → `build` → `production`) — `--target production` skips straight to the final, minimal runtime stage instead of also building the (larger) `dev` stage.

**Run containers manually** (they need to share a network so `web` can reach `api` by name):

```bash
docker network create uptime-net    # once

docker run -d --name api --network uptime-net \
  --env-file .env.web-api \
  website-monitoring-api

docker run -d --name web --network uptime-net \
  --env-file .env.web-api \
  -e API_URL=http://api:4001 \
  -p 4000:4000 \
  website-monitoring-web

docker run -d --name worker --network uptime-net \
  --env-file .env.worker \
  -p 4002:4002 \
  website-monitoring-worker
```

**Run a one-off command inside a built image** (e.g. seeding, without starting the app):

```bash
docker run --rm --network uptime-net --env-file .env.web-api website-monitoring-api npm run uptime:seed
```

**Inspect / debug:**

```bash
docker ps                    # running containers
docker logs -f api           # follow one container's logs
docker exec -it api sh       # shell inside a running container
```

**Tear down:**

```bash
docker stop api web worker
docker rm api web worker
docker network rm uptime-net
```

In practice, prefer `docker compose -f docker-compose.web-api.yml ...` / `docker-compose.worker.yml` (or `scripts/redeploy.sh`) over the manual commands above — compose already wires up the network, env files, and nginx for you; the manual form above is mainly for isolating/debugging one container.

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
npm run uptime:seed       # idempotently seed the permission catalog, default roles, and the bootstrap admin User
```

## Tests

```bash
npm test   # jest — RBAC layer (RolesService, UsersService, PermissionGuard, AuthService, hasPermission())
```

## Claude Code automation

This repo has a `.claude/` setup with specialized agents (`web-agent`, `api-agent`, `worker-agent`, `db-agent`, `ui-agent`, `code-reviewer`) and slash-command skills (`/new-api-resource`, `/db-migrate`, `/new-queue-job`, `/new-component`, `/design-check`, `/review`, `/lint-fix`, `/commit`, `/list-flow`) for building out this project consistently — see CLAUDE.md's "Skills" section for the full list.
