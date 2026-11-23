#!/usr/bin/env bash
# Runs the Supabase migrations + backend tests against a throwaway local Postgres.
# Needs Postgres 15+ binaries (initdb, pg_ctl, psql). Postgres refuses to run as root, so use a
# normal user, e.g.:  sudo -u postgres bash scripts/test-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [ -z "$PGBIN" ] && command -v initdb >/dev/null; then PGBIN="$(dirname "$(command -v initdb)")"; fi
PORT="${PORT:-54329}"
DATA="$(mktemp -d)"
export PGOPTIONS='-c client_min_messages=warning'

cleanup() {
  "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/server.log" -w start >/dev/null

PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -X -q)
"${PSQL[@]}" -d postgres -c "create database dayorbit_test" >/dev/null

"${PSQL[@]}" -d dayorbit_test -f supabase/tests/00_local_auth_shim.sql >/dev/null
for f in supabase/migrations/*.sql; do
  echo "Applying $(basename "$f")"
  "${PSQL[@]}" -d dayorbit_test -f "$f" >/dev/null
done
"${PSQL[@]}" -d dayorbit_test -f supabase/tests/10_backend_test.sql
