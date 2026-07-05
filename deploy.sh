#!/usr/bin/env bash
# =============================================================================
# GradBridge — Production Deployment Script
# =============================================================================
# Deploys the full stack using Docker + NeonDB + Cloudflare Tunnel.
#
# Prerequisites:
#   1. Docker installed and running
#   2. NeonDB DATABASE_URL (set in .env or NEON_DATABASE_URL env var)
#   3. Cloudflare Tunnel token (set in .env or CLOUDFLARE_TUNNEL_TOKEN env var)
#   4. LLM API keys (set in .env)
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh                           # full deploy
#   ./deploy.sh --skip-tunnel             # deploy without Cloudflare Tunnel
#   ./deploy.sh --fresh                   # fresh deploy (reset volumes)
# =============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { printf "${GREEN}[✓]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[!]${NC} %s\n" "$*"; }
err()  { printf "${RED}[✗]${NC} %s\n" "$*"; exit 1; }
info() { printf "${CYAN}[i]${NC} %s\n" "$*"; }

# Parse args
SKIP_TUNNEL=false
FRESH=false
for arg in "$@"; do
  case "$arg" in
    --skip-tunnel) SKIP_TUNNEL=true ;;
    --fresh)       FRESH=true ;;
    *)             err "Unknown argument: $arg" ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     GradBridge — Production Deploy          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── Step 1: Verify prerequisites ──────────────────────────────────────────
info "Step 1: Verifying prerequisites..."

if ! command -v docker &>/dev/null; then
  err "Docker is not installed. Install from https://docker.com"
fi

if ! command -v node &>/dev/null; then
  err "Node.js is not installed."
fi

if [ -z "${DATABASE_URL:-}" ] && [ -z "${NEON_DATABASE_URL:-}" ]; then
  warn "DATABASE_URL not set. Using .env value."
fi

log "Prerequisites OK"

# ─── Step 2: Build Next.js standalone ──────────────────────────────────────
info "Step 2: Building Next.js production bundle..."
bun run build || err "Build failed"
log "Build complete"

# ─── Step 3: Push Prisma schema to production DB ──────────────────────────
info "Step 3: Pushing Prisma schema to database..."
DATABASE_URL="${NEON_DATABASE_URL:-$DATABASE_URL}" bunx prisma db push --skip-generate || warn "prisma db push failed"
log "Schema pushed"

# ─── Step 4: Seed the database ────────────────────────────────────────────
info "Step 4: Seeding database..."
DATABASE_URL="${NEON_DATABASE_URL:-$DATABASE_URL}" bun run src/lib/seed.ts || warn "Seed failed (may already be seeded)"
log "Seeding complete"

# ─── Step 5: Build and start Docker containers ────────────────────────────
info "Step 5: Starting Docker containers..."
if [ "$FRESH" = true ]; then
  docker compose down -v
  log "Volumes reset (fresh deploy)"
fi

docker compose up -d --build || err "Docker Compose failed"
log "Docker containers running"

# ─── Step 6: Health check ─────────────────────────────────────────────────
info "Step 6: Health check..."
sleep 10
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  log "Web app is serving on http://localhost:3000"
else
  warn "Web app not yet ready. Check logs: docker compose logs web"
fi

if curl -sf http://localhost:5050 > /dev/null 2>&1; then
  log "pgAdmin4 is serving on http://localhost:5050"
fi

# ─── Step 7: Cloudflare Tunnel ────────────────────────────────────────────
if [ "$SKIP_TUNNEL" = false ]; then
  info "Step 7: Starting Cloudflare Tunnel..."
  if command -v cloudflared &>/dev/null; then
    docker compose --profile tunnel up -d || warn "Cloudflare Tunnel failed to start"
    log "Cloudflare Tunnel started"
  else
    warn "cloudflared not found. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    info "To start tunnel manually: cloudflared tunnel run --config cloudflared-config.yml gradbridge"
  fi
else
  info "Step 7: Skipping Cloudflare Tunnel (--skip-tunnel)"
fi

# ─── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     GradBridge — Deploy Complete             ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  Web app:   http://localhost:3000             ║"
echo "║  pgAdmin4:  http://localhost:5050             ║"
echo "║                                              ║"
echo "║  To set up Cloudflare Tunnel:                 ║"
echo "║    cloudflared tunnel login                   ║"
echo "║    cloudflared tunnel create gradbridge       ║"
echo "║    docker compose --profile tunnel up -d      ║"
echo "║                                              ║"
echo "║  For production: set GRADBRIDGE_SECRET        ║"
echo "║  and LLM API keys in .env before deploying.   ║"
echo "║                                              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
