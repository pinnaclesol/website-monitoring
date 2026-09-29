#!/bin/bash
# One-time Let's Encrypt certificate bootstrap for either server's nginx.
# Run this ONCE per server, after copying+filling in that server's real env
# file — it starts the stack for you, so you don't also need a separate
# `docker compose up`.
#
# Usage (run from the repo root on the target server):
#   ./scripts/init-letsencrypt.sh web-api
#   ./scripts/init-letsencrypt.sh worker
#
# Why this exists: nginx refuses to start if a `ssl_certificate` file it's
# configured to load doesn't exist yet — but on a brand new server, no
# certificate exists yet, and Let's Encrypt can only issue one to a domain
# that's already answering on port 80 (the HTTP-01 challenge nginx itself
# needs to be serving). This breaks the chicken-and-egg problem by:
#   1. Writing a throwaway self-signed certificate so nginx has *something*
#      to load and can start.
#   2. Starting the full stack (nginx now up and serving port 80).
#   3. Asking Let's Encrypt for the real certificate over HTTP, via nginx's
#      own /.well-known/acme-challenge/ location.
#   4. Reloading nginx so the real certificate takes effect immediately,
#      instead of waiting for its periodic 6-hour reload.
#
# Safe to re-run — step 1 is skipped if a real certificate already exists.
# After this, ordinary `docker compose up -d --build` (what
# scripts/redeploy.sh runs) is all you need going forward; renewal and the
# nginx reload that picks it up both happen automatically from here on.
set -e

ROLE="${1:?Usage: ./scripts/init-letsencrypt.sh <web-api|worker>}"
COMPOSE_FILE="docker-compose.$ROLE.yml"
ENV_FILE=".env.$ROLE"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "[ERROR] $COMPOSE_FILE not found — run this from the repo root." >&2
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "[ERROR] $ENV_FILE not found — copy ${ENV_FILE}.example to $ENV_FILE and fill it in first." >&2
    exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

: "${DOMAIN:?Set DOMAIN= in $ENV_FILE first}"
: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL= in $ENV_FILE first}"

COMPOSE="docker compose -f $COMPOSE_FILE"

echo "[INFO] Role: $ROLE | Domain: $DOMAIN | Compose file: $COMPOSE_FILE"

if docker run --rm -v certbot_certs:/etc/letsencrypt alpine:3 \
    sh -c "[ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]" 2>/dev/null; then
    echo "[INFO] A certificate for $DOMAIN already exists — skipping the dummy-certificate step."
else
    echo "[INFO] Creating a temporary self-signed certificate so nginx can start for the first time..."
    docker run --rm -v certbot_certs:/etc/letsencrypt alpine:3 sh -c "
        apk add --no-cache openssl >/dev/null 2>&1
        mkdir -p /etc/letsencrypt/live/$DOMAIN
        openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
            -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
            -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
            -subj '/CN=$DOMAIN'
    "
fi

echo "[INFO] Building and starting the stack..."
$COMPOSE up -d --build

echo "[INFO] Waiting for nginx to come up..."
sleep 5

echo "[INFO] Requesting the real certificate from Let's Encrypt..."
$COMPOSE run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email --force-renewal

echo "[INFO] Reloading nginx to pick up the real certificate..."
$COMPOSE exec nginx nginx -s reload

echo "[INFO] Done — https://$DOMAIN should now show a trusted certificate."
echo "[INFO] Renewal is automatic from here: certbot checks every 12h, nginx reloads every 6h."
