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
# =============================================================================

set -e

DATABASE_URL="${DATABASE_URL:-}"
CMD="${1:-serve}"

PG_WAIT_TIMEOUT="${PG_WAIT_TIMEOUT:-60}"
PG_WAIT_INTERVAL="${PG_WAIT_INTERVAL:-2}"

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

pg_host_port() {
    url="${DATABASE_URL#*://}"
    url="${url%%/*}"
    url="${url%%?*}"
    host_port="${url##*@}"
    host="${host_port%%:*}"
    port="${host_port##*:}"
    [ "$host" = "$host_port" ] && port="5432"
    [ -z "$host" ] && host="${POSTGRES_HOST:-postgres}"
    [ -z "$port" ] && port="${POSTGRES_PORT:-5432}"
    printf '%s %s' "$host" "$port"
}

wait_for_postgres() {
    if [ -z "$DATABASE_URL" ]; then
        log "DATABASE_URL not set — skipping Postgres wait."
        return 0
    fi
    case "$DATABASE_URL" in
        postgres://* | postgresql://*) ;;
        file:* | *)
            log "DATABASE_URL is not Postgres — skipping wait."
            return 0
            ;;
    esac

    set -- $(pg_host_port)
    host="$1"
    port="$2"
    log "Waiting for Postgres at ${host}:${port} (up to ${PG_WAIT_TIMEOUT}s)…"

    elapsed=0
    while [ "$elapsed" -lt "$PG_WAIT_TIMEOUT" ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            log "Postgres is accepting connections at ${host}:${port}."
            return 0
        fi
        sleep "$PG_WAIT_INTERVAL"
        elapsed=$((elapsed + PG_WAIT_INTERVAL))
    done

    die "Postgres did not become ready within ${PG_WAIT_TIMEOUT}s at ${host}:${port}."
}

run_migrations() {
    if ! command -v prisma >/dev/null 2>&1; then
        warn "prisma CLI not found — skipping migrations."
        return 0
    fi
    if [ -z "$DATABASE_URL" ]; then
        warn "DATABASE_URL not set — skipping migrations."
        return 0
    fi
    log "Running prisma db push …"
    prisma db push --skip-generate
    log "Schema push complete."
}

run_seed() {
    if [ ! -f "src/lib/seed.ts" ]; then
        warn "src/lib/seed.ts not found — skipping seed."
        return 0
    fi
    if command -v bun >/dev/null 2>&1; then
        log "Running seed via bun …"
        bun run src/lib/seed.ts
    elif command -v tsx >/dev/null 2>&1; then
        log "Running seed via tsx …"
        tsx src/lib/seed.ts
    else
        warn "Neither tsx nor bun is available — skipping seed."
        return 0
    fi
    log "Seed complete."
}

start_server() {
    log "Starting Next.js standalone server (node server.js) …"
    exec node server.js
}

log "GradBridge entrypoint — mode: ${CMD}"

wait_for_postgres

case "$CMD" in
    migrate)
        run_migrations
        run_seed
        log "Migration mode complete. Exiting."
        exit 0
        ;;
    serve)
        run_migrations
        run_seed
        start_server
        ;;
    *)
        die "Unknown command: '${CMD}'. Expected 'serve' or 'migrate'."
        ;;
esac
