# Local setup (5 minutes)

Everything runs in Docker — you do **not** need to install Node, Postgres, or Redis on your machine.

## 1. Install Docker Desktop

Download it here if you don't have it yet: https://www.docker.com/products/docker-desktop/

Open Docker Desktop and make sure it's running (you'll see its icon in your system tray/menu bar) before continuing.

## 2. Clone the repo

```bash
git clone <repo-url>
cd website-monitoring
```

## 3. Set up your environment file

Copy the example file:

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

## 4. Start everything

```bash
docker compose -f docker-compose.dev.yml up --build
```

First run takes a couple of minutes (downloading images, installing packages). Leave this running in its own terminal — it's your dev server. Wait until you see all five containers logging (`postgres`, `redis`, `api`, `web`, `worker`) with no errors.

## 5. Create the first admin login

In a **new** terminal (leave the one from step 4 running):

```bash
docker compose -f docker-compose.dev.yml exec api npm run uptime:seed
```

This creates your admin account using the `ADMIN_USERNAME`/`ADMIN_PASSWORD` you set in `.env`.

## 6. Open the app

- Dashboard: http://localhost:4000 — log in with the admin username/password from step 3
- API health check: http://localhost:4001/api/health (should say `{"status":"ok"}`)
- Worker queue dashboard: http://localhost:4002/admin/queues

You're set up. Edit any file in `apps/` or `libs/` and the running app updates automatically — no restart needed.

## Everyday commands

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

## If something goes wrong

**"NX Recursive task invocation detected" in the logs, or a container keeps restarting** — this happens if the stack was shut down uncleanly (e.g. Docker Desktop was force-quit, or your computer slept while it was running). Fix:
```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build
```
This wipes the local database too, so re-run step 5 afterward to get your admin login back.

**Docker Desktop won't start / containers won't start at all** — make sure Docker Desktop is actually open and fully started (not just launching) before running any `docker compose` command.

**Port already in use (4000/4001/4002)** — something else on your machine is using that port. Close it, or ask in the team channel — these ports aren't meant to be changed lightly since they're wired into the compose file.
