# Deployment Guide — GradBridge

This guide covers deploying GradBridge to **Vercel**, **Railway**, and **Docker Compose** (self-hosted). Pick the platform that fits your needs.

| Platform | Best for | Database | Cost |
|----------|----------|----------|------|
| Vercel | Frontend + serverless API | External Postgres | Free tier |
| Railway | Full-stack with managed DB | Railway Postgres | $5/mo hobby |
| Docker Compose | Self-hosted / on-prem | Postgres + Redis containers | Server cost |

---

## Prerequisites (all platforms)

1. **Neon Auth credentials** (for production Vercel/Railway):
   - `NEON_AUTH_BASE_URL` — your Neon Auth instance URL
   - `NEON_AUTH_COOKIE_SECRET` — generate one: `openssl rand -hex 32`
   - `NEXT_PUBLIC_APP_URL` — your production domain

2. **LLM provider keys** (optional — the app works without any, with a built-in local responder):
   - `OPENROUTER_API_KEY` — [get one](https://openrouter.ai/keys)
   - `GROQ_API_KEY` — [get one](https://console.groq.com/keys)
   - `OLLAMA_BASE_URL` — only for self-hosted with a local Ollama instance

3. **Database** — PostgreSQL 16 + pgvector (Docker includes this automatically; for Vercel/Railway use Neon or Supabase).

---

## Option A: Vercel (recommended for frontend + API)

Vercel hosts the Next.js app as serverless functions. You'll need an external Postgres database (Neon, Supabase, or Railway).

### Step 1: Prepare the database

Use **Neon** (free serverless Postgres):
1. Go to [neon.tech](https://neon.tech) → create a project
2. Copy the connection string: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/gradbridge?sslmode=require`

Or **Supabase**:
1. Go to [supabase.com](https://supabase.com) → create a project
2. Settings → Database → Connection string → URI

### Step 2: Switch Prisma to Postgres

Before deploying, update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 3: Deploy to Vercel

1. Push your code to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → import the repo.
3. Vercel auto-detects Next.js. Set these **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql://...` (from Step 1) |
   | `NEON_AUTH_BASE_URL` | Your Neon Auth instance URL |
   | `NEON_AUTH_COOKIE_SECRET` | `openssl rand -hex 32` (min 32 chars) |
   | `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` |
   | `OPENROUTER_API_KEY` | (optional) |
   | `GROQ_API_KEY` | (optional) |

4. **Build Command**: `bun run build` (or `npm run build`)
5. Click **Deploy**.

### Step 4: Run migrations

After the first deploy, run the Prisma migration:
```bash
# Install Vercel CLI
npm i -g vercel

# Link + pull env vars
vercel link
vercel env pull .env.local

# Push schema to database
npx prisma db push --schema=prisma/schema.prisma

# Seed knowledge base + file templates
bun run src/lib/seed.ts
```

### Step 5: Custom domain

Settings → Domains → add your domain. Vercel handles SSL automatically.

---

## Option B: Railway (full-stack with managed DB)

Railway hosts both the app and a managed Postgres instance in one platform.

### Step 1: Create a Railway project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Select your GradBridge repo.

### Step 2: Add Postgres

1. In the Railway dashboard → **New** → **Database** → **PostgreSQL**.
2. Railway creates the database and provides a `DATABASE_URL` variable.

### Step 3: Configure the web service

1. Click your web service → **Variables** → add:
   - `DATABASE_URL` → use the variable reference `${{Postgres.DATABASE_URL}}`
   - `NEON_AUTH_BASE_URL` → your Neon Auth instance URL
   - `NEON_AUTH_COOKIE_SECRET` → `openssl rand -hex 32`
   - `NEXT_PUBLIC_APP_URL` → your Railway domain
   - `OPENROUTER_API_KEY` → (optional)
   - `GROQ_API_KEY` → (optional)

2. **Build Command**: `bun install && bun run build`
3. **Start Command**: `bun run start` (or `npm run start`)

### Step 4: Switch Prisma to Postgres

Update `prisma/schema.prisma` (same as Vercel Step 2).

### Step 5: Run migrations + seed

Railway → your web service → **Settings** → **Start Command**:
```
npx prisma db push && bun run src/lib/seed.ts && bun run start
```

Or use the Railway CLI:
```bash
npm i -g @railway/cli
railway link
railway run npx prisma db push
railway run bun run src/lib/seed.ts
```

### Step 6: Generate a public domain

Railway → your web service → **Settings** → **Networking** → **Generate Domain**.

---

## Option C: Docker Compose (self-hosted)

The included `docker-compose.yml` runs a full production stack: PostgreSQL 16 + pgvector, Redis, pgAdmin, auto-migration, and the Next.js web app.

### Step 1: Clone + configure

```bash
git clone https://github.com/rbkhan007/GradBridge.git
cd GradBridge

# Copy the env template
cp .env.example .env
```

The default `.env` works out of the box for local Docker. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://gradbridge:gradbridge@localhost:5432/gradbridge` | PostgreSQL connection |
| `NEON_AUTH_BASE_URL` | *(empty)* | Leave empty for Docker — local auth fallback is used |
| `NEON_AUTH_COOKIE_SECRET` | *(set in .env)* | Cookie signing secret |
| `POSTGRES_USER` | `gradbridge` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `gradbridge` | PostgreSQL password |
| `POSTGRES_DB` | `gradbridge` | PostgreSQL database name |

### Step 2: Build + start

```bash
# Build + start all services (first build ~3 min)
docker compose up -d --build

# Check all services are running
docker compose ps
```

**Services:**
| Service | Port | Purpose |
|---------|------|---------|
| `web` | 3000 | Next.js standalone server |
| `postgres` | 5432 | PostgreSQL 16 + pgvector |
| `redis` | — | Cache + session backend |
| `pgadmin` | 5050 | Database management UI |
| `prisma-migrate` | — | Auto-runs schema push + seed on startup |

The `prisma-migrate` container runs once on startup, pushes the schema, seeds the database, and exits. The `web` container waits for it to complete before starting.

### Step 3: Access

- **Web app**: http://localhost:3000
- **pgAdmin**: http://localhost:5050 (email: `admin@gradbridge.com`, password: `admin`)
- **PostgreSQL**: `localhost:5432` (user: `gradbridge`, password: `gradbridge`)

### Step 4: Terminal access

```bash
# Shell into web container
docker compose exec web sh

# PostgreSQL shell
docker compose exec postgres psql -U gradbridge

# Redis CLI
docker compose exec redis redis-cli
```

### Step 5: Reverse proxy (production)

For production, put Caddy or Nginx in front for SSL, or use a Cloudflare Tunnel (free):

**Option A — Caddy (automatic HTTPS):**
```
gradbridge.yourdomain.com {
    reverse_proxy localhost:3000
}
```

**Option B — Cloudflare Tunnel (free, no port forwarding):**
```bash
# 1. Install cloudflared
# 2. Create tunnel
cloudflared tunnel create gradbridge

# 3. Add token to .env
CLOUDFLARE_TUNNEL_TOKEN="your-token-here"
CLOUDFLARE_DOMAIN="gradbridge.yourdomain.com"

# 4. Start with tunnel profile
docker compose --profile tunnel up -d
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://gradbridge:gradbridge@localhost:5432/gradbridge` | PostgreSQL connection string |
| `NEON_AUTH_BASE_URL` | ❌ | *(empty)* | Neon Auth instance URL (production only) |
| `NEON_AUTH_COOKIE_SECRET` | ✅ | *(must set)* | Cookie signing secret (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | ❌ | `http://localhost:3000` | Public URL of the app |
| `OPENROUTER_API_KEY` | ❌ | — | OpenRouter API key |
| `OPENROUTER_MODEL` | ❌ | `deepseek/deepseek-coder` | OpenRouter model |
| `OPENROUTER_FALLBACK_KEY` | ❌ | — | Shared fallback key (5 msg/day free tier) |
| `GROQ_API_KEY` | ❌ | — | Groq API key |
| `GROQ_MODEL` | ❌ | `llama-3.3-70b-versatile` | Groq model |
| `OLLAMA_BASE_URL` | ❌ | — | Ollama daemon URL (local LLM) |
| `OLLAMA_MODEL` | ❌ | — | Ollama model |
| `POSTGRES_USER` | ❌ | `gradbridge` | Docker: PostgreSQL username |
| `POSTGRES_PASSWORD` | ❌ | `gradbridge` | Docker: PostgreSQL password |
| `POSTGRES_DB` | ❌ | `gradbridge` | Docker: PostgreSQL database |
| `PGADMIN_EMAIL` | ❌ | `admin@gradbridge.com` | Docker: pgAdmin login email |
| `PGADMIN_PASSWORD` | ❌ | `admin` | Docker: pgAdmin login password |
| `CLOUDFLARE_TUNNEL_TOKEN` | ❌ | — | Docker: Cloudflare Tunnel token |
| `CLOUDFLARE_DOMAIN` | ❌ | — | Docker: Cloudflare Tunnel domain |

---

## Post-Deployment Checklist

- [ ] `NEON_AUTH_COOKIE_SECRET` set to a 32+ char value
- [ ] Database migrated (`prisma db push` — Docker handles this automatically)
- [ ] Knowledge base seeded (`bun run db:seed` — Docker handles this automatically)
- [ ] Can register a new account at `/auth/register`
- [ ] Can login + see the dashboard
- [ ] Chat returns a response (LLM working)
- [ ] Files view shows demo files (workspace auto-cloned)
- [ ] File edit → diff preview → approve → apply works
- [ ] Git commit works (modified files → commit → statuses reset)
- [ ] Logout works

---

## Troubleshooting

### "Cannot reach database" after deploy
- Verify `DATABASE_URL` is set correctly in the platform's env vars
- For Postgres, ensure `?sslmode=require` is appended (Neon, Supabase)
- Run `npx prisma db push` manually after the first deploy

### Streaming chat doesn't work (Vercel)
- Vercel serverless functions support streaming, but the response must use `runtime = "nodejs"`
- Ensure `maxDuration` is set (the `/api/chat/stream` route has `export const maxDuration = 60`)
- On Vercel Hobby plan, max duration is 60s; upgrade to Pro for longer

### LLM provider errors
- Check that API keys are set in the platform env vars
- The app automatically falls back to the next provider (z-ai → OpenRouter → Groq → Ollama → local)
- Check `/api/agents` to see which providers are available

### Docker build fails
- Ensure Docker has at least 2GB of memory allocated
- Try `docker compose build --no-cache` to force a clean build
- Check that `.dockerignore` excludes `node_modules` and `.next`

### Docker: prisma-migrate exits with error
- Check logs: `docker compose logs prisma-migrate`
- Common cause: PostgreSQL not ready — the entrypoint waits up to 60s
- Force restart: `docker compose restart prisma-migrate`

### Docker: web container can't reach database
- The `web` container uses `postgres:5432` (Docker network DNS), not `localhost:5432`
- Ensure `DATABASE_URL` uses `@postgres:5432` inside Docker, not `@localhost:5432`

### Terminal access to containers
```bash
docker compose exec web sh
docker compose exec postgres psql -U gradbridge
docker compose exec redis redis-cli
```

---

## Rust TUI CLI (connects to any deployed instance)

The Rust CLI (`rust-cli/`) connects to any running GradBridge web app — local, Vercel, Railway, or Docker.

```bash
# Build the CLI
cd rust-cli && cargo build --release

# Point it at your deployed instance
./target/release/gradbridge --api-base https://gradbridge.yourdomain.com login

# Use it
./target/release/gradbridge chat "Explain JWT refresh tokens"
./target/release/gradbridge plan "Add OAuth2 login"

# Local-first mode (direct Ollama, no web backend needed)
./target/release/gradbridge --local chat "Explain async/await in Rust"
./target/release/gradbridge local check    # verify Ollama is reachable
```

See `rust-cli/README.md` for full CLI documentation.
