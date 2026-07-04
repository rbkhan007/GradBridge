# GradBridge — Rust TUI CLI Edition

The native companion to the [GradBridge](https://gradbridge.dev) web app — an
OpenCode-style autonomous agent that helps fresh CS / Software Engineering
graduates **plan, build, debug, optimize, and navigate their career**.

```
┌──────────────────────────────────────────────────────────────┐
│  GradBridge   Autonomous Agent · v0.2   [Chat] Plan Build …  │
├────────────┬─────────────────────────────────────────────────┤
│  Modes     │  ┌ You ───────────────────────────────────────┐  │
│  ▸ Chat    │  │ how do I structure a JWT refresh flow?     │  │
│    Plan    │  └────────────────────────────────────────────┘  │
│    Build   │  ┌ Coder [chat] ──────────────────────────────┐  │
│    Debug   │  │ ## Approach                                │  │
│    Optimize│  │ Issue a short-lived access JWT (15m) + a    │  │
│    Career  │  │ long-lived refresh token (7d) stored in a   │  │
│            │  │ httpOnly cookie...                          │  │
│  Files     │  │ ```ts src/auth/jwt.ts                       │  │
│  · README  │  │ export const signAccess = (uid: string) =>  │  │
│  · src/... │  │ ...                                        │  │
│            │  └────────────────────────────────────────────┘  │
├────────────┴─────────────────────────────────────────────────┤
│ ● authenticated · mode Chat · agent Coder · 1.2k tok          │
├──────────────────────────────────────────────────────────────┤
│ › type a message... (Enter=send  Shift+Enter=newline)        │
└──────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────┐         HTTP + gb_session cookie
│   gradbridge CLI    │ ───────────────────────────────────────┐
│   (Rust + ratatui)  │                                        │
│                     │◀────── /api/auth/login (sets cookie) ──┤
│  • chat / plan /    │                                        │
│    debug / optimize │──────▶ /api/chat       (agent reply)   │
│    / career         │──────▶ /api/chat/stream (SSE stream)   │
│  • tui (ratatui)    │──────▶ /api/plan       (structured plan)│
│  • files / knowledge│──────▶ /api/files      (orchestrator)  │
│  • memory           │──────▶ /api/files/diff (diff preview)  │
│  • local RAG index  │──────▶ /api/files/apply (commit edit)  │
│    (SQLite)         │──────▶ /api/knowledge  (RAG corpus)    │
│                     │──────▶ /api/memory     (career profile)│
└─────────────────────┘                                        │
                                                                ▼
                                                ┌─────────────────────────┐
                                                │  GradBridge web app     │
                                                │  (Next.js 16 + Prisma)  │
                                                │                         │
                                                │  • z-ai-web-dev-sdk LLM │
                                                │  • server-side RAG      │
                                                │  • multi-user auth      │
                                                │  • Postgres + Redis     │
                                                └─────────────────────────┘
```

**The CLI never calls LLMs directly** — the web app is the backend. Every
command authenticates with the `gb_session` cookie issued by
`POST /api/auth/login`, then delegates to the web app's API routes. This keeps
LLM keys + the RAG corpus server-side and lets the CLI stay a thin, fast
client.

The only thing the CLI does locally is its own **lightweight RAG index**
(`~/.gradbridge/rag.db`) over the current directory's source files, used by
`gradbridge rag search` and `gradbridge debug <path>` for inline context.

---

## Build

Requirements: **Rust 1.75+** (2021 edition).

```bash
cd rust-cli
cargo build --release
# Binary: ./target/release/gradbridge
```

For a direct-LLM mode (calls LLMs from the CLI instead of the web app —
useful for offline work), enable the `direct-llm` feature:

```bash
cargo build --release --features direct-llm
```

---

## Quick start

> Prerequisites: a running GradBridge web app (the Next.js server at
> `http://localhost:3000` by default). Start it from the project root with
> `bun run dev`, or use the Docker Compose stack (`docker compose up`).

```bash
# 1. Point the CLI at the web app (defaults to http://localhost:3000)
./target/release/gradbridge --api-base http://localhost:3000 login
# Email: you@example.com
# Password: ********
# ✓  Logged in as You <you@example.com>

# 2. One-shot chat
./target/release/gradbridge chat "explain JWT refresh tokens"
./target/release/gradbridge plan "add cursor-based pagination to GET /api/jobs"
./target/release/gradbridge debug src/auth/jwt.ts
./target/release/gradbridge optimize src/routes/jobs.ts
./target/release/gradbridge career "backend developer roadmap"

# 3. Interactive TUI
./target/release/gradbridge tui

# 4. Data
./target/release/gradbridge files
./target/release/gradbridge knowledge "system design"
./target/release/gradbridge memory
./target/release/gradbridge whoami
./target/release/gradbridge logout

# 5. Local RAG index
./target/release/gradbridge rag reindex --dir .
./target/release/gradbridge rag search "cookie session"
./target/release/gradbridge rag list
```

---

## Commands

| Command | Description |
|---|---|
| `login` | Authenticate against the web app; stores the `gb_session` cookie. |
| `logout` | Clear the local session. |
| `whoami` | Show the currently authenticated user. |
| `chat <prompt>` | One-shot Chat-mode agent reply. `--agent coder\|reviewer\|…`, `--mode chat\|plan\|…`. |
| `plan <goal>` | Plan agent → structured markdown plan (Goal / Context / Steps / Files / Risks / Acceptance). |
| `debug <file>` | Read the file locally, send it to the Debugger agent. |
| `optimize <query>` | Optimize mode. If `query` is a file path, reads it; else treats as free text. |
| `career <query>` | Career Mentor mode — roadmaps, resume tips, interview prep. |
| `tui` | Launch the interactive TUI (see below). |
| `files` | List indexed project files. |
| `knowledge [query]` | Search the RAG knowledge base. |
| `memory` | Show your career profile (memory). |
| `rag reindex --dir .` | Rebuild the local SQLite RAG index. |
| `rag search <query> --limit 5` | Search the local RAG index. |
| `rag list` | List indexed files. |

Global flags: `--api-base <url>` (or `GRADBRIDGE_API_BASE` env var),
`--no-color`.

---

## Interactive TUI

`gradbridge tui` opens a full-screen, ratatui-based interface:

### Layout
- **Top bar**: brand + the 6 mode chips (active mode highlighted emerald).
- **Left sidebar**: the 6 modes (cycle with `Tab`) + the indexed file list
  (refresh with `r`).
- **Center**: scrollable message transcript with per-message agent headers
  (color-coded per agent), basic markdown rendering (headings, code blocks,
  bullets, numbered lists), and a live spinner while streaming.
- **Status bar**: session status, current mode, active agent, token count.
- **Bottom**: multi-line input box.

### Keybindings
| Key | Action |
|---|---|
| `Enter` | Send (or newline if `Shift` held) |
| `Shift+Enter` | Newline |
| `Tab` / `Shift+Tab` | Next / previous mode |
| `c` | Clear conversation |
| `r` | Refresh file list |
| `?` | Toggle help overlay |
| `q` / `Ctrl+C` | Quit |

### Streaming
When you send a message, the assistant reply is streamed in real-time via
`/api/chat/stream` (SSE). A braille spinner animates while waiting for the
first token, and each chunk is appended to the in-flight message as it
arrives. If the streaming endpoint is unavailable (it's a roadmap item on the
web app), the CLI transparently falls back to the non-streaming `/api/chat`
endpoint and emits the full reply as a single chunk.

### Terminal hygiene
The TUI enters raw mode + the alternate screen on start and restores the
original terminal state on exit via a `Drop` guard — so a panic never leaves
your terminal broken.

---

## Configuration

Config lives at `~/.gradbridge/config.toml`:

```toml
api_base = "http://localhost:3000"
session_token = "gb_session cookie value here"

[user]
id = "cuid..."
name = "Your Name"
email = "you@example.com"
```

- `api_base` — the GradBridge web app URL (default `http://localhost:3000`).
- `session_token` — the `gb_session` cookie value, set after `gradbridge login`.
- `user` — cached `SessionUser`, populated after login.

The local RAG index lives at `~/.gradbridge/rag.db` (SQLite).

---

## Agents + modes

Mirrors the web app's `src/lib/agents.ts` exactly:

**6 modes** (OpenCode-style): `chat`, `plan`, `build`, `debug`, `optimize`, `career`.

**7 sub-agents**:

| Agent | Role | Accent |
|---|---|---|
| Plan | Read-only strategist | emerald |
| Build | Execution | amber |
| Coder | Implementation | green |
| Reviewer | Code review | sky |
| Debugger | Diagnosis | rose |
| Optimizer | Performance & clarity | violet |
| Mentor | Career guidance | yellow |

Each mode has a default sub-agent (`chat`→Coder, `plan`→Plan, `build`→Build,
`debug`→Debugger, `optimize`→Optimizer, `career`→Mentor). Override with
`--agent` on the `chat` command, or `Tab` through modes in the TUI.

---

## Development

```bash
# Fast dev build (unoptimized)
cargo build

# Run with logging
RUST_LOG=gradbridge=debug cargo run -- chat "hello"

# Run tests (diff module has unit tests)
cargo test

# Check formatting + lints
cargo fmt --check
cargo clippy -- -D warnings
```

### Module layout
```
src/
  main.rs     # clap CLI entry + command dispatch
  config.rs   # ~/.gradbridge/config.toml load / save
  api.rs      # HTTP client wrapping the web API (reqwest + SSE streaming)
  agents.rs   # 7 agents + 6 modes + system prompts (mirrors src/lib/agents.ts)
  rag.rs      # local SQLite RAG index (sqlx) over the current directory
  diff.rs     # unified-diff generator (LCS over lines, no deps)
  tui.rs      # ratatui + crossterm interactive TUI
```

---

## License

Apache 2.0 — Built for fresh CS graduates, by GradBridge.

**GradBridge** — from graduation to shipped.
