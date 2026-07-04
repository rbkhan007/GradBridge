# =============================================================================
# GradBridge — Next.js 16 standalone production image (multi-stage).
# =============================================================================
# The committed `next.config.ts` already sets `output: "standalone"`, so Next.js
# emits a self-contained `.next/standalone/server.js` plus a `.next/static`
# folder that we copy into the runner image.
#
# Stages:
#   1. deps      — install all dependencies with bun (cached layer)
#   2. builder   — swap Prisma datasource to PostgreSQL, generate client, build
#   3. migrator  — full toolchain image used by the `prisma-migrate` compose
#                  service to run `prisma db push` + seed before the web starts
#   4. runner    — minimal Node 20 alpine image that serves the standalone app
#
# NOTE on the Prisma provider swap:
#   `prisma/schema.prisma` is committed with `provider = "sqlite"` for local
#   development. Production Docker uses PostgreSQL (see docker-compose.yml).
#   Rather than maintain two schema files, the builder swaps the provider to
#   `postgresql` with `sed` before `prisma generate` + `next build` so the
#   generated Prisma client in the standalone bundle is PostgreSQL-capable.
#   The original schema.prisma is NOT modified on disk outside the image.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — deps
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy only manifests so this layer is cached unless deps change.
COPY package.json bun.lock ./

# --frozen-lockfile enforces reproducible installs (fails if bun.lock is out of
# sync with package.json). If you intentionally change deps, rebuild the lockfile
# locally first: `bun install`.
RUN bun install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2 — builder
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Reuse the deps layer.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Swap Prisma datasource provider: sqlite -> postgresql (production).
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

# Generate the Prisma client for PostgreSQL. This client gets bundled into the
# Next.js standalone output during `next build`.
RUN bunx prisma generate

# Build the standalone Next.js output.
# `next build` (with output: "standalone") produces `.next/standalone/server.js`
# plus `.next/static` (the latter is NOT auto-bundled — we copy it separately).
RUN bun run build

# -----------------------------------------------------------------------------
# Stage 3 — migrator (used by the prisma-migrate compose service)
# -----------------------------------------------------------------------------
# A full-toolchain image (bun + prisma CLI + tsx + source) used to run schema
# migrations and the seed script. The `prisma-migrate` compose service runs
# this once, exits, and the `web` service starts after it completes.
FROM oven/bun:1-alpine AS migrator
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Copy the built app (with the postgres-swapped schema + generated client).
COPY --from=builder /app ./

# Entry + default command — run migrations + seed, then exit.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["migrate"]

# -----------------------------------------------------------------------------
# Stage 4 — runner (production web server)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install dumb-init for proper PID 1 signal handling (graceful shutdown).
RUN apk add --no-cache dumb-init

# Create a non-root user for the server process.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# --- Standalone server bundle ---
# `.next/standalone` contains server.js + a trimmed node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# --- Static + public assets (NOT bundled in standalone, copy separately) ---
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# --- Prisma schema + seed (so the entrypoint can re-run migrations idempotently) ---
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src/lib ./src/lib

# Install a slim Prisma CLI + tsx so docker-entrypoint.sh can run `prisma db
# push` + the TS seed script. (~50MB; keeps the runner self-sufficient so the
# entrypoint's migrate/seed steps work even if the prisma-migrate service is
# skipped — both flows are idempotent.)
RUN npm install -g prisma@5 tsx --no-save && npm cache clean --force

# Entrypoint: wait for postgres, run prisma db push, seed, then exec node server.
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["serve"]
