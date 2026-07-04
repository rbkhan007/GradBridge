#!/usr/bin/env sh
# =============================================================================
# GradBridge — Docker entrypoint.
# =============================================================================
# Responsibilities (in order):
#   1. Wait for PostgreSQL to accept connections.
#   2. Run `prisma db push` (creates / migrates the schema — idempotent).
#   3. Run the seed script (idempotent — only seeds if tables are empty).
#   4. Exec `node server.js` to start the Next.js standalone server.
#
# Usage (via the image CMD):
#   docker-entrypoint.sh serve        # default — runs all 4 steps + starts web
#   docker-entrypoint.sh migrate      # runs steps 1-3 then exits (used by the
#                                     # `prisma-migrate` compose service)
#
# This script is POSIX `sh` (not bash) so it works on plain alpine. It is
# copied to /usr/local/bin/docker-entrypoint.sh and chmod +x in the Dockerfile.
# =============================================================================

set -e

# --- Config from env (with sensible defaults) ---
DATABASE_URL="${DATABASE_URL:-}"
CMD="${1:-serve}"

# How long to wait for Postgres (seconds).
PG_WAIT_TIMEOUT="${PG_WAIT_TIMEOUT:-60}"
# Polling interval (seconds).
PG_WAIT_INTERVAL="${PG_WAIT_INTERVAL:-2}"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
log() {
    printf '[entrypoint] %s\n' "$*"
}

warn() {
    printf '[entrypoint] WARNING: %s\n' "$*" >&2
}

die() {
    printf '[entrypoint] FATAL: %s\n' "$*" >&2
    exit 1
}

# Extract the host + port from a postgres:// or postgresql:// URL.
# Falls back to the POSTGRES_HOST / POSTGRES_PORT env vars if set.
pg_host_port() {
    # Try to parse DATABASE_URL. Examples we handle:
    #   postgresql://user:pass@host:5432/db?schema=public
    #   postgres://host:5432/db
    url="${DATABASE_URL#*://}"          # strip scheme
    url="${url%%/*}"                     # strip path + query
    url="${url%%?*}"                     # strip query (if any remained)
    host_port="${url##*@}"               # strip credentials
    host="${host_port%%:*}"
    port="${host_port##*:}"
    [ "$host" = "$host_port" ] && port="5432"
    [ -z "$host" ] && host="${POSTGRES_HOST:-postgres}"
    [ -z "$port" ] && port="${POSTGRES_PORT:-5432}"
    printf '%s %s' "$host" "$port"
}

# Wait for Postgres to accept TCP connections.
wait_for_postgres() {
    if [ -z "$DATABASE_URL" ]; then
        log "DATABASE_URL not set — skipping Postgres wait (SQLite mode?)."
        return 0
    fi
    case "$DATABASE_URL" in
        postgres://* | postgresql://*) ;;
        file:* | *)
            log "DATABASE_URL is not Postgres — skipping wait ($DATABASE_URL)."
            return 0
            ;;
    esac

    set -- $(pg_host_port)
    host="$1"
    port="$2"
    log "Waiting for Postgres at ${host}:${port} (up to ${PG_WAIT_TIMEOUT}s)…"

    elapsed=0
    while [ "$elapsed" -lt "$PG_WAIT_TIMEOUT" ]; do
        # `nc` is in busybox on alpine. -z = scan without sending data.
        if nc -z "$host" "$port" 2>/dev/null; then
            log "Postgres is accepting connections at ${host}:${port}."
            return 0
        fi
        sleep "$PG_WAIT_INTERVAL"
        elapsed=$((elapsed + PG_WAIT_INTERVAL))
    done

    die "Postgres did not become ready within ${PG_WAIT_TIMEOUT}s at ${host}:${port}."
}

# Run `prisma db push` (creates/migrates the schema). Idempotent.
run_migrations() {
    if ! command -v prisma >/dev/null 2>&1; then
        warn "prisma CLI not found — skipping migrations. (Is this the runner stage?)"
        return 0
    fi
    if [ -z "$DATABASE_URL" ]; then
        warn "DATABASE_URL not set — skipping migrations."
        return 0
    fi
    log "Running prisma db push …"
    # --accept-data-loss: required when switching providers (sqlite -> postgres)
    # or when a non-additive schema change would drop columns. In a fresh prod
    # deploy this is a no-op; in an existing deploy it matches `db push` semantics.
    prisma db push --accept-data-loss --skip-generate
    log "Schema push complete."
}

# Run the seed script. Idempotent — the seed checks row counts before inserting.
run_seed() {
    if [ ! -f "src/lib/seed.ts" ]; then
        warn "src/lib/seed.ts not found — skipping seed."
        return 0
    fi
    if command -v tsx >/dev/null 2>&1; then
        log "Running seed via tsx …"
        tsx src/lib/seed.ts
    elif command -v bun >/dev/null 2>&1; then
        log "Running seed via bun …"
        bun run src/lib/seed.ts
    else
        warn "Neither tsx nor bun is available — skipping seed."
        return 0
    fi
    log "Seed complete."
}

start_server() {
    log "Starting Next.js standalone server (node server.js) …"
    # `exec` replaces the shell with node so signals (SIGTERM) propagate cleanly.
    exec node server.js
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
log "GradBridge entrypoint — mode: ${CMD}"

wait_for_postgres

case "$CMD" in
    migrate)
        # One-shot migration mode (used by the prisma-migrate compose service).
        run_migrations
        run_seed
        log "Migration mode complete. Exiting."
        exit 0
        ;;
    serve)
        # Full serve mode (used by the web service). Steps 2 + 3 are idempotent
        # so re-running them alongside the prisma-migrate service is safe.
        run_migrations
        run_seed
        start_server
        ;;
    *)
        die "Unknown command: '${CMD}'. Expected 'serve' or 'migrate'."
        ;;
esac
