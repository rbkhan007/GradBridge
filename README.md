<p align="center">
  <img src="https://raw.githubusercontent.com/gradbridge/gradbridge/main/public/logo.svg" alt="GradBridge" width="120" />
</p>

<h1 align="center">GradBridge</h1>

<p align="center">
  <strong>From graduation to shipped.</strong><br/>
  An autonomous AI agent that helps fresh CS graduates plan, build, debug, optimize, and grow their careers.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#api-reference">API</a> ·
  <a href="#deployment">Deployment</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/GradBridge-v0.2.0-emerald" alt="Version" />
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Prisma-6-2d3748" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/License-Apache_2.0-green" alt="Apache 2.0 License" />
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen" alt="PRs Welcome" />
  <img src="https://img.shields.io/badge/Contributions-Welcome-orange" alt="Contributions Welcome" />
</p>

---

## What is GradBridge?

GradBridge is a production-ready, multi-user AI agent workspace built for fresh Computer Science & Software Engineering graduates. It combines RAG-powered chat, safe file editing with diff approval, a curated knowledge base, and persistent career memory — all personalized to each user.

**Key capabilities:**

- **6 agent modes** — Chat, Plan, Build, Debug, Optimize, Career
- **7 specialized sub-agents** — each with tuned system prompts
- **RAG search** — hybrid keyword + semantic search over project files and knowledge base
- **Safe file editing** — unified diff preview with explicit approval before any write
- **Persistent memory** — university, skills, goals personalize every response
- **Multi-user auth** — scrypt-hashed passwords, HMAC-signed session cookies
- **Real-time streaming** — token-by-token SSE rendering

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- A terminal

### Install & Run

```bash
# Clone the repository
git clone https://github.com/gradbridge/gradbridge.git
cd gradbridge

# Install dependencies
bun install

# Set up the database
bun run db:push    # Create SQLite schema
bun run db:seed    # Seed knowledge base + project files

# Start the dev server
bun run dev        # → http://localhost:3000
```

### First Login

1. Open `http://localhost:3000` — you'll see the landing page
2. Click **Get started** to register
3. Fill your name, email, and password (min 8 chars)
4. You're automatically logged in and land on the dashboard

---

## Features

### Authentication & Multi-User

- **Scrypt password hashing** — per-user salt, timing-safe comparison
- **HMAC-SHA256 session cookies** — httpOnly, SameSite=Lax, 7-day expiry
- **Per-user data isolation** — every conversation, plan, and profile is scoped
- **Race-condition safe** — Prisma `$transaction` for atomic operations
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

### Sub-Agents

| Agent | Role | Accent |
|-------|------|--------|
| Plan Agent | Read-only strategist | emerald → teal |
| Build Agent | Execution | amber → orange |
| Coder Agent | Implementation | emerald → green |
| Reviewer Agent | Code review | sky → cyan |
| Debugger Agent | Diagnosis | rose → red |
| Optimizer Agent | Performance | violet → fuchsia |
| Career Mentor | Career guidance | amber → yellow |

### RAG Knowledge Base

7 seeded articles covering:
- Backend & Frontend Developer Roadmaps 2026
- System Design Basics for Interviews
- Resume Tips for Fresh CS Graduates
- DSA Interview Prep Plan
- Clean Code & Testing Best Practices
- Git & Collaboration for New Engineers

### File Orchestrator

- Virtual workspace with syntax-highlighted file viewer
- **Edit with AI** → unified diff preview → approve/reject
- Nothing is written without explicit approval
- LCS-based diff generator with GitHub-style headers

### Design System

- Emerald/teal developer-tool aesthetic (no indigo/blue)
- Full light/dark theme with tuned contrast
- Custom animated SVG art library (logo, flow diagram, agent orbs)
- Framer Motion transitions, glassmorphism, animated gradient borders
- `prefers-reduced-motion` support
- Responsive (mobile-first, Sheet sidebar on mobile)
- Colorful animated shadcn-style SVG icons (sparkle, shield, rocket, brain, code)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| UI Primitives | Radix UI + Lucide icons |
| Animation | Framer Motion |
| Database | Prisma ORM + SQLite (Postgres-ready) |
| LLM | `z-ai-web-dev-sdk` (GLM family) |
| Auth | Custom (node:crypto scrypt + HMAC-SHA256) |
| State | Zustand (client) + Prisma (persistent) |
| Markdown | react-markdown + react-syntax-highlighter |

---

## Project Structure

```
gradbridge/
├── prisma/
│   └── schema.prisma          # 10 models: User, UserProfile, Conversation, Message,
│                              #   ProjectFile, KnowledgeEntry, Plan, AgentRun
├── src/
│   ├── app/
│   │   ├── page.tsx           # Single route → GradBridgeApp
│   │   ├── layout.tsx         # Root layout (ThemeProvider, Toaster)
│   │   ├── globals.css        # Design tokens + animations + utilities
│   │   └── api/
│   │       ├── auth/          # register, login, logout, me
│   │       ├── chat/          # POST (non-streaming)
│   │       ├── chat/stream/   # POST (SSE streaming)
│   │       ├── plan/          # POST (plan agent)
│   │       ├── agents/        # GET (list agents + modes)
│   │       ├── files/         # GET/POST, diff, apply, commit
│   │       ├── knowledge/     # GET (list/search)
│   │       └── memory/        # GET/POST (user profile)
│   ├── components/
│   │   ├── gradbridge/        # 16 custom components
│   │   └── ui/                # 40+ shadcn/ui primitives
│   └── lib/
│       ├── auth.ts            # scrypt + JWT session
│       ├── agents.ts          # 7 agent definitions
│       ├── llm.ts             # LLM wrapper + fallback
│       ├── rag.ts             # Hybrid search
│       ├── diff.ts            # LCS unified diff
│       ├── store.ts           # Zustand store
│       └── types.ts           # TypeScript types
├── rust-cli/                  # Rust TUI CLI edition
├── package.json
├── tailwind.config.ts
└── next.config.ts
```

---

## API Reference

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create user + session |
| POST | `/api/auth/login` | — | Verify + session |
| POST | `/api/auth/logout` | — | Clear session |
| GET | `/api/auth/me` | — | Current user or 401 |

### Agent

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | ✅ | Agent chat |
| POST | `/api/chat/stream` | ✅ | SSE streaming chat |
| POST | `/api/plan` | ✅ | Plan agent |
| GET | `/api/agents` | ✅ | List agents + modes |

### Files

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/files` | ✅ | List files |
| POST | `/api/files` | ✅ | Read file |
| POST | `/api/files/diff` | ✅ | Generate diff |
| POST | `/api/files/apply` | ✅ | Apply approved diff |
| POST | `/api/files/commit` | ✅ | Commit version |

### Knowledge & Memory

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/knowledge` | ✅ | List/search knowledge |
| GET | `/api/memory` | ✅ | Get profile |
| POST | `/api/memory` | ✅ | Update profile |

---

## Scripts

```bash
bun run dev          # Start dev server (port 3000)
bun run build        # Production build
bun run start        # Start production server
bun run lint         # ESLint check
bun run typecheck    # TypeScript type check
bun run db:push      # Push schema to SQLite
bun run db:generate  # Regenerate Prisma client
bun run db:migrate   # Create + apply migration
bun run db:reset     # Reset database
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Set environment variables
4. Deploy

### Docker Compose

```bash
docker compose up -d
```

Includes Postgres 16 + Redis 7 + the web service.

### Railway

1. Connect your GitHub repo
2. Set `DATABASE_URL` to a Postgres connection string
3. Deploy

---

## Rust CLI

A terminal UI edition built with Rust:

```bash
cd rust-cli
cargo build --release
./target/release/gradbridge
```

Features: local-first mode (Ollama + offline RAG), SSE streaming, ratatui interface.

---

## Environment Variables

```env
# Database — PostgreSQL for production (Vercel + Neon/Supabase)
DATABASE_URL="postgresql://user:password@host:5432/gradbridge?schema=public"

# For local dev with SQLite (uncomment and comment out PostgreSQL):
# DATABASE_URL="file:./db/custom.db"

# LLM Provider (optional — falls back to local responder)
ZAI_API_KEY="your-api-key"

# Session secret (auto-generated if not set)
GRADBRIDGE_SECRET="your-secret-key"
```

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- Report bugs via [GitHub Issues](https://github.com/gradbridge/gradbridge/issues)
- Submit pull requests for features and fixes
- Join the community and help improve GradBridge

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
