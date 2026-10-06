#!/bin/bash
# Pulls the latest code and rebuilds/restarts the single-server production stack.
# Run from the repo root:
#   ./scripts/redeploy.sh
# Or specify a custom compose file:
#   ./scripts/redeploy.sh docker-compose.prod.yml
#
# Also what .github/workflows/deploy.yml runs automatically over SSH on
# every push to main.
#
# Images are built ONE AT A TIME on purpose. `docker compose up -d --build`
# builds api, web and worker concurrently, and each runs a full-monorepo
# `npm ci` plus a webpack/Next build — three at once exhausted RAM/CPU on this
# single VPS and froze the whole server (needing a reboot). Sequential builds
# also let `worker` reuse `api`'s identical dependency layers from cache, so
# it is usually *faster* overall, not just safer.
#
# `api`'s entrypoint runs `prisma migrate deploy` on every start (idempotent,
# never destructive — see Dockerfile.api), so pending migrations apply
# automatically here too.
set -e

COMPOSE_FILE="${1:-docker-compose.prod.yml}"

# Refuse to run two deploys at once (e.g. a manual run overlapping the GitHub
# Actions one) — two concurrent builds is exactly the load spike to avoid.
exec 9>/tmp/uptime-redeploy.lock
if ! flock -n 9; then
  echo "[ERROR] Another redeploy is already running — wait for it to finish." >&2
  exit 1
fi

# Belt and braces alongside the explicit one-by-one loop below.
export COMPOSE_PARALLEL_LIMIT=1

echo "[INFO] Memory before deploy:"
free -m

echo "[INFO] Pulling latest code..."
git pull

# api first: worker's `deps` stage is identical, so it hits the layer cache.
for service in api worker web; do
  echo "[INFO] Building $service..."
  docker compose -f "$COMPOSE_FILE" build "$service"
done

echo "[INFO] Restarting ($COMPOSE_FILE)..."
docker compose -f "$COMPOSE_FILE" up -d

echo "[INFO] Pruning old, now-unused images (keeps disk usage bounded)..."
docker image prune -f

echo "[INFO] Done. Current status:"
docker compose -f "$COMPOSE_FILE" ps
