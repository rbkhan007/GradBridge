# =============================================================================
# GradBridge — Next.js 16 standalone production image (multi-stage).
# =============================================================================
# Stages:
#   1. deps      — install all dependencies (cached layer)
#   2. builder   — generate Prisma client, build Next.js standalone
#   3. migrator  — runs prisma db push + seed before web starts
#   4. runner    — minimal Node 20 alpine image serving the standalone app
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — deps
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2 — builder
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bunx prisma generate
RUN bun run build

# -----------------------------------------------------------------------------
# Stage 3 — migrator
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS migrator
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN apk add --no-cache netcat-openbsd

COPY --from=builder /app ./

RUN bun add -g prisma@6 tsx

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

RUN apk add --no-cache dumb-init netcat-openbsd

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src/lib ./src/lib

RUN npm install -g prisma@6 tsx --no-save && npm cache clean --force

COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["serve"]
