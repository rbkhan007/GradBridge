// Seed script: populates the shared knowledge base + sample project files.
// No demo user is created — authentication is real; users register their own
// accounts. Idempotent — safe to run multiple times.
// Usage: bun run src/lib/seed.ts
import { db } from "./db";

async function seed() {
  console.log("🌱 Seeding GradBridge database...");

  // --- Knowledge base ---
  const kbCount = await db.knowledgeEntry.count();
  if (kbCount === 0) {
    await db.knowledgeEntry.createMany({ data: KNOWLEDGE });
    console.log(`  ✓ Seeded ${KNOWLEDGE.length} knowledge entries`);
  } else {
    console.log(`  • Knowledge base already has ${kbCount} entries, skipping`);
  }

  // --- File templates (shared; cloned into each user's workspace on first access) ---
  const tplCount = await db.fileTemplate.count();
  if (tplCount === 0) {
    const templates = FILES.map((f) => ({
      path: f.path,
      language: f.language,
      content: f.content,
    }));
    await db.fileTemplate.createMany({ data: templates });
    console.log(`  ✓ Seeded ${templates.length} file templates`);
  } else {
    console.log(`  • File templates already has ${tplCount} entries, skipping`);
  }

  console.log("✅ Seed complete.");
  console.log("   Register your own account from the app — no demo user is seeded.");
}

const KNOWLEDGE = [
  {
    title: "Backend Developer Roadmap 2026",
    category: "roadmap",
    tags: JSON.stringify(["backend", "node", "api", "database", "2026"]),
    source: "GradBridge Knowledge Base",
    content: `# Backend Developer Roadmap 2026 (Fresh Graduate)

## Phase 1 — Foundations (Weeks 1-4)
- **Language mastery**: Pick ONE backend language deeply (TypeScript/Node.js recommended for speed). Learn async, streams, error handling.
- **HTTP & REST**: Methods, status codes, idempotency, content negotiation.
- **Databases**: SQL fundamentals (PostgreSQL) — joins, indexes, transactions, normalization. Write 20 queries by hand.
- **Git workflow**: branching, rebasing, PR reviews.

## Phase 2 — Building (Month 2-3)
- **Framework**: NestJS or Express + Zod. Build a CRUD API with auth (JWT + refresh tokens).
- **ORM**: Prisma or Drizzle. Understand migrations, relations, N+1.
- **Testing**: Jest/Vitest — unit + integration. Aim for 70%+ on core paths.
- **Caching**: Redis for sessions + response caching.
- **Project**: Ship a job-portal or e-commerce backend to a public URL (Fly.io / Render).

## Phase 3 — Depth (Month 4-6)
- **System design**: Read "Designing Data-Intensive Applications". Cover load balancing, sharding, replication, message queues (Kafka/Redis Streams).
- **Observability**: structured logging (pino), metrics (Prometheus), tracing (OpenTelemetry).
- **CI/CD**: GitHub Actions → Docker → deploy.
- **Security**: OWASP Top 10, rate limiting, input validation, secrets management.

## Phase 4 — Interview Ready (Month 6+)
- DSA: NeetCode 150 (arrays → graphs).
- System design interviews: practice 15 mock designs (Exponent, pramp).
- Behavioral: STAR stories for 5 common questions.

## Resources
- roadmap.sh/backend
- "Designing Data-Intensive Applications" — Martin Kleppmann
- highscalability.com
- The Twelve-Factor App (12factor.net)`,
  },
  {
    title: "Frontend Developer Roadmap 2026",
    category: "roadmap",
    tags: JSON.stringify(["frontend", "react", "next", "css", "2026"]),
    source: "GradBridge Knowledge Base",
    content: `# Frontend Developer Roadmap 2026 (Fresh Graduate)

## Phase 1 — Web Foundations (Weeks 1-3)
- HTML semantics, accessibility (ARIA, keyboard nav).
- CSS: Flexbox, Grid, responsive design, custom properties. No framework first.
- JavaScript ES2024: modules, promises, async/await, destructuring, optional chaining.

## Phase 2 — React Deeply (Month 2)
- React 19: components, hooks (useState, useEffect, useMemo, useCallback, useReducer), custom hooks.
- State: Zustand or React Query for server state. Avoid prop drilling.
- Next.js 16 App Router: server components, route handlers, metadata, streaming.
- Styling: Tailwind CSS 4 + a component library (shadcn/ui).

## Phase 3 — Production Skills (Month 3-5)
- TypeScript: generics, discriminated unions, utility types.
- Testing: Vitest + Playwright (E2E).
- Performance: Core Web Vitals, code-splitting, image optimization, RSC.
- Accessibility audit with axe-core. Target WCAG AA.

## Phase 4 — Polish & Portfolio (Month 6+)
- Ship 3 polished projects to a custom domain.
- Animation: Framer Motion.
- Build a design system.

## Resources
- roadmap.sh/frontend
- react.dev (new docs)
- web.dev/learn
- Refactoring UI (visual design principles)`,
  },
  {
    title: "System Design Basics for Interviews",
    category: "system-design",
    tags: JSON.stringify(["system-design", "interview", "scalability"]),
    source: "GradBridge Knowledge Base",
    content: `# System Design Basics (Fresh Grad Interview Prep)

## The 4-Step Framework
1. **Clarify requirements** — functional + non-functional (scale, latency, availability). Ask before designing.
2. **Back-of-envelope estimates** — QPS, storage, bandwidth. Shows engineering judgment.
3. **High-level design** — draw boxes: clients, LB, services, DB, cache, queue.
4. **Deep dive** — pick the hardest component (usually the data model or a bottleneck) and detail it.

## Core Building Blocks
- **Load balancer**: distribute traffic, health checks. (Nginx, HAProxy, cloud LB)
- **API gateway**: auth, rate limiting, routing. (Kong, AWS API Gateway)
- **Database choices**: relational (Postgres) for strong consistency; NoSQL (Mongo, DynamoDB) for flexible schema / scale; columnar (ClickHouse) for analytics.
- **Cache**: Redis — write-through vs write-back vs cache-aside. Mind cache invalidation.
- **Message queue**: Kafka / RabbitMQ for decoupling producers/consumers + async work.
- **CDN**: serve static assets close to users.

## Scaling Patterns
- **Vertical** (bigger machine) vs **Horizontal** (more machines). Horizontal wins at scale.
- **Sharding**: partition data by key (user_id). Watch for hot partitions.
- **Replication**: primary-replica for reads. Eventual consistency trade-off.
- **CQRS**: separate read & write models for high-read systems.

## Classic Questions to Practice
- Design URL shortener (Bitly)
- Design a key-value store
- Design Twitter / news feed
- Design a chat application (WhatsApp)
- Design rate limiter

## Anti-patterns
- Premature sharding before exhausting indexes.
- Single point of failure (one DB, one queue).
- Ignoring idempotency for retries.

## Resources
- "Designing Data-Intensive Applications" — Kleppmann
- ByteByteGo (Alex Xu) — System Design Interview
- systemdesignprimer.github.io`,
  },
  {
    title: "Resume Tips for Fresh CS Graduates",
    category: "career",
    tags: JSON.stringify(["resume", "job", "career"]),
    source: "GradBridge Knowledge Base",
    content: `# Resume Tips for Fresh CS Graduates

## One Page. Always.
Recruiters spend 6-8 seconds. One page, 10-11pt, generous whitespace.

## Structure (top → bottom)
1. **Header**: Name, email, phone, GitHub, LinkedIn, portfolio/site. No full address.
2. **Summary (2 lines)**: target role + 1 differentiator. Skip if generic.
3. **Experience** (if any): internships, TA, freelance. Use STAR bullets.
4. **Projects**: 2-3 projects, each with a one-line impact metric + stack.
5. **Education**: degree, school, grad year, relevant coursework / GPA (if 3.5+).
6. **Skills**: grouped (Languages / Frameworks / Tools). Don't list 30 things.

## Bullet Formula
> Action verb + what you did + quantified impact + tech used.
- ❌ "Worked on the backend API."
- ✅ "Designed a REST API in Node.js + PostgreSQL serving 5k req/day, cutting p95 latency 40% via query indexing."

## Quantify Everything
- "reduced build time from 4min to 45s"
- "supported 200 concurrent users"
- "achieved 92% test coverage"
No metric is too small if honest.

## Projects Section (Critical for Fresh Grads)
- Each project: name, 1-line problem, 2-3 bullet outcomes, tech stack, GitHub link.
- Pick projects that mirror the job (building an API? show an API project).
- A live URL beats a GitHub link.

## Common Mistakes
- Listing coursework instead of projects.
- Soft skills ("team player") — show via bullets, don't list.
- Typos. Run it through 3 reviewers + Grammarly.
- Generic objective statement. Delete it.

## ATS Tips
- Single-column, standard fonts, no images/tables for parsing.
- Use the exact keywords from the job description.
- Export as PDF named "First_Last_Resume.pdf".`,
  },
  {
    title: "DSA Interview Prep Plan",
    category: "interview",
    tags: JSON.stringify(["dsa", "interview", "algorithms", "leetcode"]),
    source: "GradBridge Knowledge Base",
    content: `# DSA Interview Prep Plan (8-12 Weeks)

## The NeetCode 150 Approach
Don't grind randomly. Follow topic-sorted order so patterns compound.

### Week 1-2: Arrays & Hashing
Two Sum, Contains Duplicate, Group Anagrams, Top K Frequent, Product Except Self.

### Week 3: Two Pointers & Sliding Window
Valid Palindrome, 3Sum, Container With Most Water, Best Time to Buy/Sell Stock, Longest Substring Without Repeating.

### Week 4: Stack & Binary Search
Valid Parentheses, Min Stack, Search Rotated Array, Koko Eating Bananas.

### Week 5-6: Linked List & Trees
Reverse Linked List, Merge Sorted Lists, Cycle Detection, Invert Binary Tree, Max Depth, Level Order, Validate BST, Kth Smallest.

### Week 7: Heaps & Intervals
Kth Largest, Task Scheduler, Merge Intervals, Insert Interval.

### Week 8: Graphs & DP
Number of Islands, Clone Graph, Course Schedule, Pacific Atlantic. Then DP: Climbing Stairs, Coin Change, Longest Increasing Subsequence, Word Break.

## Practice Discipline
- **30-45 min/problem** solo before looking at solutions.
- Re-solve missed problems after 3 days (spaced repetition).
- Speak out loud — interviews test communication, not just code.

## Patterns to Master (these unlock ~70% of problems)
1. Frequency map / hash for O(1) lookups.
2. Two pointers (opposite ends / fast-slow).
3. Sliding window (fixed + variable).
4. Binary search on answer space.
5. BFS (shortest path) vs DFS (connectivity).
6. Topological sort (DAG ordering).
7. Backtracking template (choose → explore → unchoose).
8. DP: 1D & 2D memoization.

## Mock Interviews
- pramp.com (free peer mocks)
- interviewing.io (paid, real engineers)
- Aim for 2 mocks/week in final month.

## Red Flags in Interviews
- Silence for 5+ min. Narrate your thinking.
- Jumping to code without clarifying. Ask 2-3 questions first.
- No edge cases. Always discuss empty / negative / overflow inputs.`,
  },
  {
    title: "Clean Code & Testing Best Practices",
    category: "best-practice",
    tags: JSON.stringify(["clean-code", "testing", "quality"]),
    source: "GradBridge Knowledge Base",
    content: `# Clean Code & Testing Best Practices

## Naming
- Names reveal intent: \`fetchUserById\` not \`getUser\` (what if it throws?).
- Booleans read as questions: \`isAuthenticated\`, \`hasPermission\`.
- Avoid abbreviations except domain terms (\`db\`, \`url\`).

## Functions
- Small. Do one thing. < 30 lines, < 4 arguments.
- No flag arguments (split into two functions instead).
- Pure where possible — same input → same output, no side effects.

## Error Handling
- Fail fast. Validate at the boundary; fail with a clear message.
- Don't swallow errors (\`catch {} \`). At minimum log with context.
- Use discriminated unions for results: \`type Result = { ok: true; data } | { ok: false; error }\`.

## Testing Pyramid
1. **Unit (many)**: pure functions, fast, deterministic. Mock boundaries.
2. **Integration (some)**: real DB/test DB, real HTTP. Verify wiring.
3. **E2E (few)**: critical user journeys through the real UI.

## What to Test
- Public behavior, not private implementation.
- The unhappy path: null, empty, overflow, concurrency, timeouts.
- Boundary conditions: off-by-one, empty collections, max values.

## What NOT to Test
- Getters/setters (trivial).
- Third-party libraries (their job).
- Implementation details that will refactor (test the interface).

## Test Qualities (FIRST)
- **F**ast, **I**solated, **R**epeatable, **S**elf-validating, **T**imely (written near the code).

## Refactoring Signals
- Long method, large class, duplicate code, feature envy, data clumps.
- Refactor in green (tests passing) — small commits, run tests each step.

## Code Review Etiquette
- Review the code, not the author.
- Ask questions, don't command: "Could this be a Set?" > "Make this a Set."
- Praise good patterns — reinforcement scales knowledge.`,
  },
  {
    title: "Git & Collaboration for New Engineers",
    category: "best-practice",
    tags: JSON.stringify(["git", "collaboration", "workflow"]),
    source: "GradBridge Knowledge Base",
    content: `# Git & Collaboration for New Engineers

## Branching
- \`main\` is always deployable. Never commit directly.
- Feature branches: \`feat/auth\`, \`fix/login-redirect\`, \`chore/deps\`.
- Short-lived branches (< 3 days). Rebase onto main frequently.

## Commits
- Atomic: one logical change per commit.
- Conventional Commits: \`feat:\`, \`fix:\`, \`docs:\`, \`refactor:\`, \`test:\`, \`chore:\`.
- Subject < 50 chars, imperative mood: "Add JWT refresh" not "Added".
- Body explains *why*, not *what* (the diff shows what).

## Pull Requests
- Small (≤ 400 lines) review faster and better.
- PR description: what + why + how to test + screenshots/links.
- Self-review before requesting reviewers.
- Respond to every comment; resolve with a reply or a code change.

## Rebasing vs Merging
- Rebase your feature branch onto main to keep history linear.
- Squash-merge small PRs; one commit per PR in main.
- Never rebase shared branches (rewrites history, breaks teammates).

## Recovery
- \`git reflog\` — your safety net. Almost nothing is truly lost.
- \`git checkout --\` discards unstaged changes.
- \`git reset --soft HEAD~1\` undoes last commit, keeps changes staged.

## Team Etiquette
- Don't force-push to main/develop.
- Use draft PRs for early feedback.
- Keep \`main\` green — CI must pass before merge.

## Common New-Grad Mistakes
- Committing secrets. Use \`git secrets\` / pre-commit hooks; rotate if leaked.
- Huge PRs no one wants to review. Split them.
- Committing build artifacts (\`node_modules\`, \`.env\`). Maintain \`.gitignore\`.`,
  },
];

const FILES = [
  {
    path: "src/server.ts",
    language: "typescript",
    status: "modified",
    content: `import express from "express";
import { authRouter } from "./routes/auth";
import { jobsRouter } from "./routes/jobs";
import { errorHandler } from "./middleware/error";
import { logger } from "./utils/logger";

const app = express();

app.use(express.json());
app.use(logger);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/jobs", jobsRouter);

app.use(errorHandler);

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(\`Job portal API on :\${PORT}\`));
`,
  },
  {
    path: "src/routes/auth.ts",
    language: "typescript",
    status: "clean",
    content: `import { Router } from "express";
import { z } from "zod";
import { signTokens, verifyRefresh } from "../services/jwt";
import { hashPassword, verifyPassword } from "../services/hash";
import { db } from "../db/client";

export const authRouter = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const { email, password, name } = RegisterSchema.parse(req.body);
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const user = await db.user.create({
      data: { email, name, passwordHash: await hashPassword(password) },
    });
    const tokens = signTokens({ sub: user.id });
    res.status(201).json(tokens);
  } catch (e) {
    next(e);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json(signTokens({ sub: user.id }));
  } catch (e) {
    next(e);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const payload = verifyRefresh(refreshToken);
    res.json(signTokens({ sub: payload.sub }));
  } catch (e) {
    next(e);
  }
});
`,
  },
  {
    path: "src/routes/jobs.ts",
    language: "typescript",
    status: "added",
    content: `import { Router } from "express";
import { db } from "../db/client";

export const jobsRouter = Router();

// TODO: add pagination + full-text search
jobsRouter.get("/", async (_req, res, next) => {
  try {
    const jobs = await db.job.findMany({ orderBy: { createdAt: "desc" } });
    res.json(jobs);
  } catch (e) {
    next(e);
  }
});

jobsRouter.get("/:id", async (req, res, next) => {
  try {
    const job = await db.job.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (e) {
    next(e);
  }
});

jobsRouter.post("/", async (req, res, next) => {
  try {
    // NOTE: missing auth check here — Reviewer agent flagged this
    const job = await db.job.create({ data: req.body });
    res.status(201).json(job);
  } catch (e) {
    next(e);
  }
});
`,
  },
  {
    path: "src/services/jwt.ts",
    language: "typescript",
    status: "clean",
    content: `import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export function signTokens(payload: { sub: string }) {
  const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

export function verifyAccess(token: string) {
  return jwt.verify(token, ACCESS_SECRET) as { sub: string };
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}
`,
  },
  {
    path: "prisma/schema.prisma",
    language: "prisma",
    status: "clean",
    content: `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model User {
  id           String @id @default(cuid())
  email        String @unique
  name         String
  passwordHash String
  createdAt    DateTime @default(now())
  applications Application[]
}

model Job {
  id          String @id @default(cuid())
  title       String
  company     String
  description String
  location    String?
  salary      Int?
  createdAt   DateTime @default(now())
  applications Application[]
}

model Application {
  id     String @id @default(cuid())
  userId String
  jobId  String
  status String @default("applied")
  user   User   @relation(fields: [userId], references: [id])
  job    Job    @relation(fields: [jobId], references: [id])
}
`,
  },
  {
    path: "README.md",
    language: "markdown",
    status: "clean",
    content: `# Job Portal API

A backend for a job-listing + application platform. Built with Express, Prisma, PostgreSQL.

## Stack
- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- JWT auth (access + refresh)
- Zod validation

## Run
\`\`\`bash
cp .env.example .env
bun install
bun run db:push
bun run dev
\`\`\`

## Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- GET  /api/jobs
- GET  /api/jobs/:id
- POST /api/jobs

## Known TODOs
- Pagination + search on GET /api/jobs
- Auth guard on POST /api/jobs (currently open)
- Rate limiting on auth routes
`,
  },
];

seed()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await db.$disconnect();
    process.exit(1);
  });
