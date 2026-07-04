# AGENT.md — GradBridge

**Project**: GradBridge
**Version**: 0.2.0 (OpenCode-Inspired Autonomous Agent)
**Tagline**: The bridge from CS graduation to real-world engineering — an autonomous AI agent that plans, builds, debugs, optimizes, and mentors.

---

## 1. Vision

GradBridge is an OpenCode-style autonomous AI agent built for fresh CSE / Software Engineering graduates. It helps them ship real projects, debug confidently, learn modern stacks, and navigate their early career — all through a single, opinionated agent experience.

The original spec targeted a Rust TUI CLI. This repository implements the **web edition** of GradBridge: a stunning Next.js dashboard that delivers the same agent modes, RAG knowledge base, file orchestrator, and persistent memory — accessible in the browser, with the Rust CLI architecture documented below for future native builds.

---

## 2. Core Architecture

### Tech Stack (Implemented — Web Edition)
- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York) + Framer Motion
- **Database**: Prisma ORM + SQLite (Postgres-ready schema)
- **LLM**: `z-ai-web-dev-sdk` (backend-only) with provider-rotation-ready abstraction
- **State**: Zustand (client) + Prisma (persistent memory)
- **Rendering**: React Markdown + react-syntax-highlighter for rich agent output

### Tech Stack (Documented — Future Rust CLI Edition)
- **Language**: Rust (performance + safety)
- **TUI**: `ratatui` + `crossterm`
- **LLM Orchestration**: `langchain-rust` (primary) + custom fallback
- **RAG**: Embedded vectors + Pgvector-ready
- **Memory**: Redis + local SQLite fallback
- **File Operations**: Safe diff-based editing

---

## 3. Agent Modes (OpenCode Style)

### Plan Agent (Read-Only)
- Analyzes the project / request
- Produces a structured markdown plan (goals, steps, files touched, risks)
- Asks for user confirmation before any change
- Uses RAG for context

### Build Agent (Execution)
- Applies approved code changes
- Runs commands (simulated in web edition)
- Edits files safely with diff preview + approval
- Tests & iterates

### Sub-Agents (Swarm)
| Agent | Responsibility |
|-------|----------------|
| **Coder** | Writes implementation code from a spec |
| **Reviewer** | Reviews diffs for bugs, style, security |
| **Debugger** | Diagnoses errors and proposes fixes |
| **Optimizer** | Improves performance / readability |
| **Career Mentor** | Roadmaps, resume tips, interview prep for fresh grads |

Each sub-agent has a dedicated system prompt tuned for fresh graduates.

---

## 4. Key Features

### RAG System
- Auto-indexed project files (`*.ts`, `*.tsx`, `*.js`, `*.py`, `*.md`, etc.)
- Curated knowledge base (career roadmaps, interview guides, best practices)
- Hybrid search: keyword (TF-style scoring) + semantic-lite (tag/section matching)

### File Orchestrator
- Fast project traversal (virtual workspace)
- Read files with syntax highlighting
- Write with **diff preview** and explicit approval
- Git-aware file status (simulated)

### LLM Integration
- Primary: `z-ai-web-dev-sdk` (GLM family)
- Abstraction layer (`lib/llm.ts`) ready for OpenRouter / Groq / Ollama fallback rotation
- Unlimited usage via provider rotation (configured in future CLI edition)

### Commands (Web Edition — mode selector + chat input)
- `Plan` — "Implement user authentication" → structured plan
- `Build` — apply approved changes
- `Debug` — paste an error / pick a file → diagnosis
- `Optimize` — pick a file → perf + readability suggestions
- `Career` — "Backend developer roadmap 2026" → mentor guidance
- `Chat` — free-form coding help

---

## 5. Memory & State

- **UserProfile**: university, graduation year, skills, goals, target role (persistent)
- **Conversation history**: per-session, stored in Prisma
- **Project context**: indexed files + active file
- **Agent runs**: audit log of agent invocations (mode, agent, tokens, result)

---

## 6. Safety & Security

- Always show a **diff preview** before editing files
- Explicit user approval for destructive/write actions
- Read-only mode by default for the Plan phase
- All LLM calls happen server-side (`z-ai-web-dev-sdk` never reaches the client)
- Input length limits + structured error responses on every API route

---

## 7. Project Structure (Web Edition)

```
src/
  app/
    page.tsx                  # Single-page GradBridge dashboard
    layout.tsx                # Root layout + theme + toaster
    globals.css               # Design tokens (emerald/teal dev-tool aesthetic)
    api/
      chat/route.ts           # Agent chat (mode + agent + memory + RAG)
      agents/route.ts         # List agents + capabilities
      files/route.ts          # List + read project files
      files/diff/route.ts     # Generate an edit diff for approval
      knowledge/route.ts      # Query the RAG knowledge base
      memory/route.ts         # Get / update user profile
      plan/route.ts           # Plan agent → structured markdown plan
  components/
    gradbridge/               # Feature components (chat, sidebar, panels)
    ui/                       # shadcn/ui primitives
  lib/
    db.ts                     # Prisma client
    types.ts                  # Shared types
    agents.ts                 # Agent definitions + system prompts
    llm.ts                    # z-ai SDK wrapper + fallback abstraction
    rag.ts                    # Hybrid search over files + knowledge base
    store.ts                  # Zustand client store
    seed.ts                   # Seed script (knowledge + files + profile)
  prisma/
    schema.prisma             # UserProfile, Conversation, Message, ProjectFile, KnowledgeEntry, Plan, AgentRun
```

---

## 8. Setup & Run

### Local (Web Edition)
```bash
bun install
bun run db:push      # create SQLite schema
bun run db:seed      # optional: seed knowledge base (handled in lib/seed.ts)
bun run dev          # http://localhost:3000
```

### Docker (future)
A `docker-compose.yml` is documented for the Postgres + Redis + Next.js production stack. See section 9.

---

## 9. Production Roadmap

- [x] Web dashboard with all agent modes
- [x] RAG over project files + curated knowledge base
- [x] Diff-preview file orchestrator with approval
- [x] Persistent memory (user profile + conversations + agent runs)
- [ ] Streaming chat (SSE)
- [ ] Provider rotation (OpenRouter / Groq / Ollama)
- [ ] Rust TUI CLI edition (`ratatui` + `langchain-rust`)
- [ ] Docker Compose (Postgres + Redis + Web)

---

**GradBridge** — from graduation to shipped. 🚀
