# Contributing to GradBridge

Thanks for your interest in contributing to GradBridge! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- [Docker](https://www.docker.com/) (optional, for PostgreSQL)
- [Rust](https://www.rust-lang.org/tools/install) (optional, for CLI edition)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/gradbridge/gradbridge.git
cd gradbridge

# Install dependencies
bun install

# Set up the database (SQLite for local dev)
bun run db:push
bun run db:seed

# Start the dev server
bun run dev
```

### Using PostgreSQL (Docker)

```bash
# Start PostgreSQL + Redis
docker compose up -d postgres redis

# Update .env with PostgreSQL URL
# DATABASE_URL="postgresql://gradbridge:gradbridge@localhost:5432/gradbridge?schema=public"

# Run migrations
bun run db:push
bun run db:seed
```

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/gradbridge/gradbridge/issues) first
2. Open a new issue using the **Bug Report** template
3. Include steps to reproduce, expected vs actual behavior

### Suggesting Features

1. Open a new issue using the **Feature Request** template
2. Describe the problem, proposed solution, and alternatives

### Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run verification:
   ```bash
   bun run typecheck
   bun run lint
   bun run build
   ```
5. Commit with a clear message: `git commit -m "feat: add amazing feature"`
6. Push and open a Pull Request

## Development Guidelines

### Code Style

- **TypeScript** — strict mode, no `any` types
- **ESLint** — zero errors required
- **Prettier** — consistent formatting
- **Tailwind CSS** — utility-first, no custom CSS unless necessary
- **Framer Motion** — for animations (120-150ms transitions)

### Component Guidelines

- Use `"use client"` for all interactive components
- Import UI primitives from `@/components/ui/`
- Import custom components from `./` (same directory)
- Use `cn()` from `@/lib/utils` for conditional classes
- Use `useId()` for unique SVG gradient IDs

### API Routes

- All routes require authentication via `requireUser(req)`
- Use try/catch around `req.json()` for body parsing
- Use `db.$transaction()` for atomic multi-table writes
- Return proper HTTP status codes (400, 401, 404, 500)

### Database

- Schema is in `prisma/schema.prisma`
- Use `bun run db:push` to sync schema changes
- Use `bun run db:seed` to populate knowledge base
- All user-scoped resources must link to `User` via `userId`

### Testing

```bash
# Run all tests
bun run test

# Or directly
python test.py
```

Tests cover:
- Authentication (register, login, logout, session)
- API endpoints (agents, files, knowledge, memory, chat)
- Edge cases (invalid JSON, 404s, validation)

## Project Structure

```
gradbridge/
├── prisma/           # Database schema
├── src/
│   ├── app/          # Next.js App Router (pages + API)
│   ├── components/   # React components
│   │   ├── gradbridge/  # Custom components
│   │   └── ui/          # shadcn/ui primitives
│   └── lib/          # Shared utilities
├── rust-cli/         # Rust TUI CLI edition
├── public/           # Static assets
└── docker-compose.yml
```

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `style:` — formatting, no code change
- `refactor:` — code restructuring
- `test:` — adding tests
- `chore:` — maintenance

Examples:
```
feat: add pgvector RAG search
fix: streaming SSE chunk boundary
docs: update API reference
```

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

---

Designed & Developed by [Rhasan](https://rhasan-dev-bd-com.vercel.app/)
