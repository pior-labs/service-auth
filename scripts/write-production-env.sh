#!/usr/bin/env bash
set -euo pipefail
if [ -z "${AUTH_ENV:-}" ]; then
  echo "Missing required production secret: AUTH_ENV"
  exit 1
fi

# A fixed-format generated value is safe to append to dotenv unquoted.
if [[ ! "${TASKS_CLIENT_SECRET:-}" =~ ^[0-9a-f]{64}$ ]]; then
  echo "TASKS_CLIENT_SECRET must be a separate secret containing 64 lowercase hex characters."
  exit 1
fi

umask 077
printf '%s\n' "$AUTH_ENV" > .env
sed -i \
  -e '/^DATABASE_URL=/d' \
  -e '/^DATABASE_URL_FILE=/d' \
  -e '/^AUTH_DATABASE_URL_FILE=/d' \
  -e '/^SHARED_DOCKER_NETWORK=/d' \
  -e '/^DATA_NETWORK=/d' \
  -e '/^AUTH_HOST_PORT=/d' \
  -e '/^COMPOSE_FILE=/d' \
  -e '/^[[:space:]]*\(export[[:space:]]\+\)\?TASKS_CLIENT_SECRET[[:space:]]*=/d' \
  .env

{
  printf '\n'
  printf 'COMPOSE_FILE=%s\n' "$COMPOSE_FILE"
  printf 'AUTH_DATABASE_URL_FILE=%s\n' "$AUTH_DATABASE_URL_FILE"
  printf 'DATA_NETWORK=%s\n' "$DATA_NETWORK"
  printf 'TASKS_CLIENT_SECRET=%s\n' "$TASKS_CLIENT_SECRET"
} >> .env
chmod 600 .env
