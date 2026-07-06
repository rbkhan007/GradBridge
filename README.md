<p align="center">
  <a href="https://github.com/rbkhan007/GradBridge">
    <img src="public/logo.svg" alt="GradBridge Logo" width="120" />
  </a>
</p>

<h1 align="center">GradBridge</h1>

<p align="center">
  <strong>From graduation to shipped.</strong><br/>
  An autonomous AI agent workspace for fresh CS graduates — plan, build, debug, optimize, and grow your career.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-tech-stack">Tech Stack</a> ·
  <a href="#-api-reference">API</a> ·
  <a href="#-deployment">Deployment</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/GradBridge-v0.2.0-emerald?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?style=for-the-badge&logo=tailwindcss" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Prisma-6-2d3748?style=for-the-badge&logo=prisma" alt="Prisma 6" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/pgvector-ready-00ff00?style=for-the-badge" alt="pgvector" />
  <img src="https://img.shields.io/badge/Rust-CLI-orange?style=for-the-badge&logo=rust" alt="Rust CLI" />
  <img src="https://img.shields.io/badge/Neon_Auth-0.4-00e599?style=for-the-badge" alt="Neon Auth" />
  <img src="https://img.shields.io/badge/License-Apache_2.0-green?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge" alt="PRs Welcome" />
  <img src="https://img.shields.io/github/actions/workflow/status/rbkhan007/GradBridge/ci.yml?style=for-the-badge&label=CI" alt="CI" />
</p>

---

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/rbkhan007/GradBridge/main/public/screenshot-landing.png" alt="Landing Page" width="80%" />
</p>

<p align="center">
  <em>Landing page with animated terminal demo, feature cards, and dark theme</em>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/rbkhan007/GradBridge/main/public/screenshot-chat.png" alt="Chat Interface" width="80%" />
</p>

<p align="center">
  <em>AI chat with streaming responses, RAG context, and agent mode selector</em>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/rbkhan007/GradBridge/main/public/screenshot-files.png" alt="File Orchestrator" width="80%" />
</p>

<p align="center">
  <em>File orchestrator with diff preview, commit history, and syntax highlighting</em>
</p>

---

## What is GradBridge?

GradBridge is a production-ready, multi-user AI agent workspace built for fresh Computer Science & Software Engineering graduates. It combines RAG-powered chat, safe file editing with diff approval, a curated knowledge base, and persistent career memory — all personalized to each user.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **6 Agent Modes** | Chat, Plan, Build, Debug, Optimize, Career |
| **7 Sub-Agents** | Each with tuned system prompts and specialized roles |
| **Enhanced RAG** | BM25 + TF-IDF + query expansion + EmbeddingFS |
| **pgvector Search** | VECTOR(1536) embeddings for semantic retrieval |
| **Safe File Editing** | Unified diff preview with explicit approval before any write |
| **Persistent Memory** | University, skills, goals personalize every response |
| **Multi-User Auth** | Scrypt-hashed passwords, HMAC-signed session cookies |
| **Real-Time Streaming** | Token-by-token SSE rendering |
| **API Key Management** | Users bring their own OpenRouter keys for unlimited usage |
| **Free Tier** | 5 messages/day with shared fallback key |
| **Finetune Pipeline** | Feedback tracking + JSONL export for model improvement |

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- [Neon Auth](https://neon.tech/docs/guides/neon-auth) account (for production) OR a terminal for local dev
- A PostgreSQL database (production) — SQLite works for local dev

### Install & Run (Local Dev)

```bash
# Clone the repository
git clone https://github.com/rbkhan007/GradBridge.git
cd GradBridge

# Install dependencies
bun install

# Generate Prisma client (SQLite for local dev)
bun run db:generate:sqlite

# Push the SQLite schema & seed data
bun run db:sqlite
bun run db:seed

# Start the dev server
bun run dev               # → http://localhost:3000
```

The app starts in **local auth fallback** mode — registration, sign-in, and sessions work without any external dependencies. No Neon Auth credentials needed for development.

### First Login

1. Open `http://localhost:3000` — you'll see the landing page
2. Click **Get started** to register
3. Fill your name, email, and password (min 8 chars)
4. You're automatically logged in and land on the dashboard
5. Start chatting with the AI agent!

### Production Setup (Vercel + Neon Auth)

For a live deployment, set these environment variables in your Vercel project:

```env
DATABASE_URL="postgresql://user:password@host:5432/gradbridge?schema=public"
NEON_AUTH_BASE_URL="https://your-neon-auth-instance.region.neon.tech"
NEON_AUTH_COOKIE_SECRET="your-32-char-minimum-secret"
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"
```

Auth is handled by [Neon Auth](https://neon.tech/docs/guides/neon-auth) — a managed Better Auth service — with automatic fallback to a local cookie-based auth when env vars are unset.

---

## Features

### Authentication & Multi-User

- **Scrypt password hashing** — per-user salt, timing-safe comparison
- **HMAC-SHA256 session cookies** — httpOnly, SameSite=Lax, 7-day expiry
- **Per-user data isolation** — every conversation, plan, and profile is scoped
- **Race-condition safe** — Prisma transactions for atomic operations
- **Anti-enumeration** — login always runs password verify

### Agent Workspace

| Mode | Default Agent | Description |
|------|--------------|-------------|
| Chat | Coder | Free-form coding help with RAG context |
| Plan | Plan | Read-only structured plan (approve before build) |
| Build | Build | Execute approved changes with diff preview |
| Debug | Debugger | Diagnose errors and propose fixes |
| Optimize | Optimizer | Performance + readability improvements |
| Career | Mentor | Roadmaps, resume tips, interview prep |

### Enhanced RAG Pipeline

```
Query → Expand (CS/SE synonyms) → Tokenize → BM25 + TF-IDF Hybrid
     → EmbeddingFS search → Score fusion → Dedup → Context windowing
     → Token budget (3000 max) → Inject into LLM prompt
```

| Component | Description |
|-----------|-------------|
| **BM25 Scoring** | Industry-standard Okapi BM25 for keyword relevance |
| **TF-IDF Vectors** | IDF-weighted cosine similarity for semantic-lite matching |
| **Query Expansion** | CS/SE-specific synonyms (react→hooks, rag→embedding) |
| **EmbeddingFS** | Persistent vector storage on filesystem with cosine search |
| **Context Builder** | Token budgeting, deduplication, smart snippet extraction |
| **Finetune** | Feedback tracking + JSONL export for model improvement |

### PostgreSQL + pgvector

- **VECTOR(1536)** — matches OpenAI text-embedding-3-small dimension
- **HNSW index** — fast approximate nearest neighbor search
- **Row-Level Security** — RLS policies on all user-scoped tables
- **User partitioning** — all vector queries scoped with `WHERE user_id = $1`
- **ON DELETE CASCADE** — strict foreign key cascades for user isolation

### Agent Task State Machine

```
PENDING → RUNNING → SUCCESS
                    → FAILED (retry up to 3x)
                    → TIMEOUT
```

- Prevents duplicate API calls on connection drops
- Indexed partial index on pending tasks for fast polling
- Retry logic with configurable max retries

### SkillAudit Time-Series

Track career growth over time:
- Skills scored 0-100 with evidence
- AI visualizes growth path by querying audit history
- Composite indexes for efficient time-range queries

### File Orchestrator

- Virtual workspace with syntax-highlighted file viewer
- **Edit with AI** → unified diff preview → approve/reject
- Nothing is written without explicit approval
- LCS-based diff generator with GitHub-style headers
- Git-like commit history with version snapshots

### Design System

- Emerald/teal developer-tool aesthetic (no indigo/blue)
- Full light/dark theme with tuned contrast
- Custom animated SVG art library (logo, flow diagram, agent orbs)
- Framer Motion transitions, glassmorphism, animated gradient borders
- `prefers-reduced-motion` support
- Responsive (mobile-first, Sheet sidebar on mobile)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Chat     │ │  Files   │ │  Plan    │ │  Career   │  │
│  │  View     │ │  View    │ │  View    │ │  View     │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       └─────────────┼───────────┼──────────────┘        │
│                     └───────────┘                       │
├─────────────────────────────────────────────────────────┤
│                    API Layer (Next.js API Routes)       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Auth    │ │  Chat    │ │  Files   │ │  Knowledge│  │
│  │  Routes  │ │  Routes  │ │  Routes  │ │  Routes   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       └─────────────┼───────────┼──────────────┘        │
├─────────────────────────────────────────────────────────┤
│                    Core Lib                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Auth    │ │  LLM     │ │  RAG     │ │  Diff     │  │
│  │  (crypto)│ │  (multi) │ │  (BM25+  │ │  (LCS)    │  │
│  │          │ │  provider│ │  TF-IDF) │ │           │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       └─────────────┼───────────┼──────────────┘        │
├─────────────────────────────────────────────────────────┤
│                    Database (Prisma ORM)                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │  PostgreSQL + pgvector (production)               │   │
│  │  SQLite (local development)                       │   │
│  │                                                   │   │
│  │  Models: User, UserProfile, Conversation,         │   │
│  │  Message, ProjectFile, KnowledgeEntry, Plan,      │   │
│  │  AgentRun, AgentTask, SkillAudit, VectorEmbedding,│   │
│  │  RagFeedback, UserApiKey, DailyUsage, Commit      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) | Full-stack React framework |
| Language | TypeScript 5 | Type-safe development |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first CSS + component library |
| UI Primitives | Radix UI + Lucide icons | Accessible, composable components |
| Animation | Framer Motion | Smooth transitions and animations |
| Database | Prisma ORM | Type-safe database access |
| Production DB | PostgreSQL 16 + pgvector | Vector embeddings + RAG search |
| Local Dev DB | SQLite | Lightweight local development |
| LLM | z-ai-web-dev-sdk + OpenRouter | Multi-provider LLM with fallback |
| Embeddings | TF-IDF + OpenAI API | Hybrid semantic search |
| Auth | node:crypto (scrypt + HMAC) | Zero-dependency authentication |
| State | Zustand (client) + Prisma (server) | Client + server state management |
| Markdown | react-markdown + react-syntax-highlighter | Rendered agent responses |
| CLI | Rust (ratatui) | Terminal UI edition |

---

## Project Structure

```
GradBridge/
├── prisma/
│   ├── schema.prisma              # Production PostgreSQL + pgvector schema
│   ├── schema.sqlite.prisma       # Local SQLite development schema
│   └── migrations/
│       └── 001_init/
│           └── migration.sql      # PostgreSQL migration with RLS policies
├── src/
│   ├── app/
│   │   ├── page.tsx               # Single route → GradBridgeApp
│   │   ├── layout.tsx             # Root layout (ThemeProvider, Toaster)
│   │   ├── globals.css            # Design tokens + animations + utilities
│   │   └── api/
│   │       ├── auth/              # register, login, logout, me
│   │       ├── chat/              # POST (non-streaming + SSE streaming)
│   │       ├── plan/              # POST (plan agent)
│   │       ├── agents/            # GET (list agents + modes)
│   │       ├── files/             # GET/POST, diff, apply, commit
│   │       ├── knowledge/         # GET (list/search)
│   │       ├── memory/            # GET/POST (user profile)
│   │       ├── user/
│   │       │   ├── api-key/       # GET/POST (API key management)
│   │       │   └── message-usage/ # GET (daily usage tracking)
│   │       └── chat/clear/        # POST (delete all conversations)
│   ├── components/
│   │   ├── gradbridge/            # 18 custom components
│   │   │   ├── about-view.tsx     # Team page with member cards
│   │   │   ├── agents-view.tsx    # Agent overview dashboard
│   │   │   ├── art.tsx            # Custom animated SVG art library
│   │   │   ├── auth-view.tsx      # Login + register forms
│   │   │   ├── chat-view.tsx      # AI chat with streaming
│   │   │   ├── files-view.tsx     # File orchestrator with diffs
│   │   │   ├── gradbridge-app.tsx # Main app shell + routing
│   │   │   ├── guide-view.tsx     # User guide documentation
│   │   │   ├── knowledge-view.tsx # Knowledge base browser
│   │   │   ├── landing-view.tsx   # Public landing page
│   │   │   ├── memory-view.tsx    # Career memory editor
│   │   │   ├── settings-view.tsx  # API key + usage settings
│   │   │   ├── sidebar.tsx        # Dashboard navigation
│   │   │   └── topbar.tsx         # Top bar with user menu
│   │   └── ui/                    # 40+ shadcn/ui primitives
│   └── lib/
│       ├── auth.ts                # Scrypt + HMAC session auth
│       ├── agents.ts              # 7 agent definitions + prompts
│       ├── llm.ts                 # Multi-provider LLM orchestration
│       ├── rag.ts                 # Enhanced hybrid RAG search
│       ├── context.ts             # System prompt builder
│       ├── diff.ts                # LCS unified diff generator
│       ├── db.ts                  # Prisma client singleton
│       ├── store.ts               # Zustand client state
│       ├── types.ts               # TypeScript type definitions
│       ├── seed.ts                # Database seed script
│       ├── workspace.ts           # Virtual file workspace
│       └── rag/
│           ├── transformers.ts    # BM25, TF-IDF, tokenization
│           ├── embeddings.ts      # TF-IDF + API embedding providers
│           ├── embeddings-fs.ts   # Persistent vector storage
│           ├── context-builder.ts # Token budgeting + dedup
│           └── finetune.ts        # Feedback tracking + export
├── rust-cli/                      # Rust TUI CLI edition
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI
├── CONTRIBUTING.md
├── SECURITY.md
├── DEPLOY.md
├── AGENT.md
├── Dockerfile
├── docker-compose.yml
├── LICENSE                        # Apache 2.0
└── README.md
```

---

## API Reference

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create user + session |
| POST | `/api/auth/login` | — | Verify credentials + session |
| POST | `/api/auth/logout` | — | Clear session |
| GET | `/api/auth/me` | — | Current user or 401 |

### Agent Chat

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | ✅ | Agent chat (non-streaming) |
| POST | `/api/chat/stream` | ✅ | SSE streaming chat |
| POST | `/api/chat/clear` | ✅ | Delete all conversations |
| POST | `/api/plan` | ✅ | Plan agent |
| GET | `/api/agents` | ✅ | List agents + modes + providers |

### File Orchestrator

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/files` | ✅ | List user files |
| POST | `/api/files` | ✅ | Read file content |
| POST | `/api/files/diff` | ✅ | Generate unified diff |
| POST | `/api/files/apply` | ✅ | Apply approved diff |
| POST | `/api/files/commit` | ✅ | Commit version snapshot |
| GET | `/api/files/commits` | ✅ | List commit history |

### Knowledge & Memory

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/knowledge` | ✅ | List/search knowledge base |
| GET | `/api/memory` | ✅ | Get user profile |
| POST | `/api/memory` | ✅ | Update user profile |

### User Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/user/api-key` | ✅ | Get masked API key |
| POST | `/api/user/api-key` | ✅ | Save/delete API key |
| GET | `/api/user/message-usage` | ✅ | Get daily usage count |

---

## Scripts

```bash
# Development
bun run dev              # Start dev server (port 3000)
bun run build            # Production build
bun run start            # Start production server

# Code Quality
bun run lint             # ESLint check
bun run typecheck        # TypeScript type check
bun run test             # Run test suite (68 tests)

# Database (SQLite - Local Dev)
bun run db:sqlite        # Push SQLite schema
bun run db:generate:sqlite  # Generate Prisma client (SQLite)

# Database (PostgreSQL - Production)
bun run db:pg            # Push PostgreSQL schema
bun run db:generate:pg   # Generate Prisma client (PostgreSQL)
bun run db:migrate       # Create + apply migration
bun run db:reset         # Reset database
bun run db:seed          # Seed knowledge base + files
```

---

## Environment Variables

```env
# ─── Database ──────────────────────────────────────────────
# Production: PostgreSQL + pgvector
DATABASE_URL="postgresql://user:password@host:5432/gradbridge?schema=public"

# Local dev: SQLite (uncomment below, comment out PostgreSQL)
# DATABASE_URL="file:./db/custom.db"

# ─── Neon Auth (required for production) ───────────────────
# Local dev / CI: leave unset — app falls back to local cookie-based auth
NEON_AUTH_BASE_URL="https://your-neon-auth-instance.region.neon.tech"
NEON_AUTH_COOKIE_SECRET="at-least-32-characters-long-secret-key!!"
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"

# ─── LLM Providers (optional — falls back to local responder) ─
ZAI_API_KEY="your-zai-api-key"

# OpenRouter (provides free tier + user API keys)
# OPENROUTER_API_KEY="sk-or-v1-..."
# OPENROUTER_MODEL="deepseek/deepseek-coder"
# OPENROUTER_FALLBACK_KEY="sk-or-v1-..."  # shared free tier key (5 msg/day)

# Groq (fast inference)
# GROQ_API_KEY="gsk_..."
# GROQ_MODEL="llama-3.3-70b-versatile"

# Ollama (local models)
# OLLAMA_BASE_URL="http://localhost:11434"
# OLLAMA_MODEL="qwen2.5-coder:7b"

# ─── Security ──────────────────────────────────────────────
# Session secret (auto-generated if not set — REQUIRED for production)
# GRADBRIDGE_SECRET="your-secret-key"
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Set the required environment variables:
   - `DATABASE_URL` — PostgreSQL connection string
   - `NEON_AUTH_BASE_URL` — your Neon Auth instance URL
   - `NEON_AUTH_COOKIE_SECRET` — minimum 32 characters
   - `NEXT_PUBLIC_APP_URL` — your production domain
   - `ZAI_API_KEY` (or other LLM provider key)
4. Deploy — the build command in `vercel.json` handles Prisma generation automatically

### Docker Compose

```bash
docker compose up -d
```

Includes PostgreSQL 16 + pgvector + the web service.

### Railway

1. Connect your GitHub repo
2. Set all required environment variables
3. Deploy

### Switching to PostgreSQL

```bash
# 1. Update .env
DATABASE_URL="postgresql://user:password@host:5432/gradbridge?schema=public"

# 2. Push PostgreSQL schema
bun run db:pg

# 3. Generate Prisma client
bun run db:generate:pg

# 4. Start dev server
bun run dev
```

---

## Rust CLI

A terminal UI edition built with Rust (requires Rust 1.75+):

```bash
cd rust-cli
cargo build --release
./target/release/gradbridge --help
```

### Commands

| Command | Description |
|---------|-------------|
| `gradbridge login` | Authenticate against the web app |
| `gradbridge chat "prompt"` | One-shot chat (Chat mode) |
| `gradbridge plan "goal"` | Plan agent → structured plan |
| `gradbridge tui` | Launch the interactive TUI |
| `gradbridge files` | List indexed project files |
| `gradbridge rag reindex` | Rebuild local RAG index |

### Local-First Mode

Run without a web backend by passing `--local` — uses direct Ollama API calls + offline SQLite RAG:

```bash
gradbridge --local chat "explain this code"
gradbridge --local plan "build a REST API"
```

Configure the Ollama endpoint and model:
```bash
gradbridge local set-url http://localhost:11434
gradbridge local set-model qwen2.5-coder:7b
gradbridge local check          # verify Ollama is reachable
```

### Features

- **Local-first mode** — Ollama + offline RAG, no auth required
- **SSE streaming** — token-by-token rendering in the TUI
- **6 agent modes** — Chat, Plan, Build, Debug, Optimize, Career
- **ratatui interface** — keyboard-driven, split-pane layout, spinner + context panel

---

## Troubleshooting

### Auth Issues on Vercel

**Problem:** Sign-up or sign-in fails, or `getSession` returns null on Vercel.

**Check:**
1. **`NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`** must be set in Vercel project settings (not just `.env`).
2. **Cookie secret** must be at least 32 characters.
3. **`NEXT_PUBLIC_APP_URL`** must match your production domain.
4. **Cold starts** — in serverless environments, in-memory auth stores don't persist. The app uses Neon Auth in production to avoid this.

### Build Fails — Prisma Client Generation

```bash
# Ensure DATABASE_URL is set (format only needed, DB doesn't need to be reachable)
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public" bunx prisma generate --schema=prisma/schema.prisma

# For local dev with SQLite:
bun run db:generate:sqlite
```

### CI Pipeline

The project includes a GitHub Actions CI pipeline (`.github/workflows/ci.yml`) that runs:
- **Type Check & Lint** — TypeScript type checking + ESLint
- **Build** — Production build verification
- **Rust CLI** — `cargo check` on stable Rust (MSRV 1.75)
- **Integration Tests** — Python test suite against the running dev server

### Agent Prompts

See [AGENT.md](AGENT.md) for the full system prompts of all 7 sub-agents.

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- Report bugs via [GitHub Issues](https://github.com/rbkhan007/GradBridge/issues)
- Submit pull requests for features and fixes
- Join the community and help improve GradBridge

---

## Security

See [SECURITY.md](SECURITY.md) for the security policy.

- Report vulnerabilities via email
- All user data is isolated with Row-Level Security
- API keys are masked in responses
- Passwords are scrypt-hashed with per-user salts

---

## License

Apache 2.0 — Built for fresh CS graduates, by GradBridge.

See [LICENSE](LICENSE) for full text.

---

<p align="center">
  <strong>GradBridge</strong> — from graduation to shipped.
</p>

<p align="center">
  <sub>Designed & Developed by <a href="https://rhasan-dev-bd-com.vercel.app/" target="_blank">Rhasan</a></sub>
</p>

<p align="center">
  <a href="https://github.com/rbkhan007/GradBridge">
    <img src="https://img.shields.io/github/stars/rbkhan007/GradBridge?style=social" alt="GitHub Stars" />
  </a>
  <a href="https://github.com/rbkhan007/GradBridge/fork">
    <img src="https://img.shields.io/github/forks/rbkhan007/GradBridge?style=social" alt="GitHub Forks" />
  </a>
</p>
