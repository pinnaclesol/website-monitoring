#!/bin/bash
# Pulls the latest code and rebuilds/restarts one server's containers.
# Run from the repo root:
#   ./scripts/redeploy.sh
# Or specify a custom compose file:
#   ./scripts/redeploy.sh docker-compose.prod.yml
#
# `docker compose up -d --build` only rebuilds images whose build context
# actually changed (Docker's own layer cache) — safe to run after every
# small change, not just major ones. `api`'s entrypoint runs `prisma
# migrate deploy` on every start (idempotent, never destructive — see
# Dockerfile.api), so pending migrations apply automatically here too.
set -e

COMPOSE_FILE="${1:-docker-compose.prod.yml}"

echo "[INFO] Pulling latest code..."
git pull

echo "[INFO] Rebuilding and restarting ($COMPOSE_FILE)..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "[INFO] Pruning old, now-unused images (keeps disk usage bounded)..."
docker image prune -f

echo "[INFO] Done. Current status:"
docker compose -f "$COMPOSE_FILE" ps
