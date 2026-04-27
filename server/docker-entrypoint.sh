#!/usr/bin/env bash
# Wait for Postgres, run idempotent migrations, then exec the main process.
set -euo pipefail

DB_HOST="${DB_HOST:-crm-db}"
DB_PORT="${DB_PORT:-5432}"

echo "[entrypoint] waiting for postgres at ${DB_HOST}:${DB_PORT} ..."
for i in $(seq 1 60); do
  if (echo > "/dev/tcp/${DB_HOST}/${DB_PORT}") >/dev/null 2>&1; then
    echo "[entrypoint] postgres reachable"
    break
  fi
  sleep 1
  if [ "$i" = "60" ]; then
    echo "[entrypoint] ERROR: postgres unreachable after 60s" >&2
    exit 1
  fi
done

echo "[entrypoint] running db:migrate"
npm run db:migrate

# Auto-seed only when explicitly requested (one-time bootstrap on a fresh DB).
if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "[entrypoint] running db:seed (RUN_DB_SEED=true)"
  npm run db:seed || echo "[entrypoint] seed failed (continuing)"
fi

echo "[entrypoint] starting: $*"
exec "$@"
