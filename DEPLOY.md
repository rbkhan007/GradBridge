# Deployment Guide — GradBridge

This guide covers deploying GradBridge to **Vercel**, **Railway**, and **Docker Compose** (self-hosted). Pick the platform that fits your needs.

| Platform | Best for | Database | Cost |
|----------|----------|----------|------|
| Vercel | Frontend + serverless API | External Postgres | Free tier |
| Railway | Full-stack with managed DB | Railway Postgres | $5/mo hobby |
| Docker Compose | Self-hosted / on-prem | Postgres + Redis containers | Server cost |

---

## Prerequisites (all platforms)

1. **A GradBridge secret** — generate one:
   ```bash
   openssl rand -hex 32
   ```
   Set it as `GRADBRIDGE_SECRET` — this signs session JWTs.

2. **LLM provider keys** (optional — the built-in z-ai GLM provider works without keys):
   - `OPENROUTER_API_KEY` — [get one](https://openrouter.ai/keys)
   - `GROQ_API_KEY` — [get one](https://console.groq.com/keys)
   - `OLLAMA_BASE_URL` — only for self-hosted with a local Ollama instance

3. **Database** — GradBridge uses SQLite for dev and Postgres for production. You need a Postgres connection string.

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
   | `GRADBRIDGE_SECRET` | your generated secret |
   | `OPENROUTER_API_KEY` | (optional) |
   | `GROQ_API_KEY` | (optional) |

4. **Build Command**: `bun run build` (or `npm run build`)
5. Click **Deploy**.

### Step 4: Run migrations

After the first deploy, run the Prisma migration:
```bash
# Install Vercel CLI
npm i -g vercel

# Link + run migration
vercel link
vercel env pull .env.local
npx prisma db push
npx bun run src/lib/seed.ts   # seed knowledge base + file templates
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
   - `GRADBRIDGE_SECRET` → your generated secret
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

The included `docker-compose.yml` runs Postgres + Redis + the web app.

### Step 1: Clone + configure

```bash
git clone https://github.com/your-org/gradbridge.git
cd gradbridge

# Copy the env template
cp .env.example .env

# Edit .env — set at minimum:
#   GRADBRIDGE_SECRET=<openssl rand -hex 32>
#   DATABASE_URL=postgresql://gradbridge:gradbridge@postgres:5432/gradbridge
#   OPENROUTER_API_KEY=sk-or-... (optional)
#   GROQ_API_KEY=gsk_... (optional)
```

### Step 2: Switch Prisma to Postgres

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 3: Build + start

```bash
# Build + start all services (Postgres, Redis, Web)
docker compose up -d --build

# Run migrations + seed (first time only)
docker compose exec web npx prisma db push
docker compose exec web bun run src/lib/seed.ts

# Check logs
docker compose logs -f web
```

### Step 4: Access

The app is available at `http://localhost:3000` (or your server's IP on port 3000).

### Step 5: Reverse proxy (production)

For production, put Caddy or Nginx in front for SSL:

**Caddyfile** (automatic HTTPS):
```
gradbridge.yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
caddy start
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `file:./db/custom.db` | SQLite (dev) or Postgres (prod) connection string |
| `GRADBRIDGE_SECRET` | ✅ | `gradbridge-dev-secret-...` | HMAC-SHA256 signing secret for session JWTs |
| `OPENROUTER_API_KEY` | ❌ | — | OpenRouter API key (provider rotation) |
| `OPENROUTER_MODEL` | ❌ | `deepseek/deepseek-coder` | OpenRouter model |
| `GROQ_API_KEY` | ❌ | — | Groq API key (provider rotation) |
| `GROQ_MODEL` | ❌ | `llama-3.3-70b-versatile` | Groq model |
| `OLLAMA_BASE_URL` | ❌ | `http://localhost:11434` | Ollama daemon URL (local LLM) |
| `OLLAMA_MODEL` | ❌ | `qwen2.5-coder:7b` | Ollama model |
| `NODE_ENV` | ❌ | `development` | Set to `production` for prod |

---

## Post-Deployment Checklist

- [ ] Database migrated (`prisma db push`)
- [ ] Knowledge base seeded (`bun run src/lib/seed.ts`)
- [ ] `GRADBRIDGE_SECRET` set to a strong random value
- [ ] Can register a new account
- [ ] Can login + see the dashboard
- [ ] Chat returns a response (LLM working)
- [ ] Files view shows 6 demo files (workspace auto-cloned)
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
