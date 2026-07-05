"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Rocket,
  Sparkles,
  Terminal,
  Check,
  type LucideIcon,
} from "lucide-react";
import { useGradBridge } from "@/lib/store";
import { AGENT_LIST, MODE_META } from "@/lib/agents";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Icon } from "./icon";
import {
  LogoMark,
  HeroFlow,
  GradientMesh,
  TerminalWindow,
  BridgeCodeArt,
  StatRing,
  FloatingChips,
  DesignerCredit,
} from "./art";
import { cn } from "@/lib/utils";

const FEATURES: { icon: string; title: string; desc: string }[] = [
  {
    icon: "ClipboardList",
    title: "Plan before you build",
    desc: "A read-only Plan agent analyzes your request, pulls RAG context, and returns a structured plan you approve before a single line changes.",
  },
  {
    icon: "Hammer",
    title: "Safe file orchestrator",
    desc: "Edit project files with a unified diff preview and explicit approval. Nothing is written until you click apply.",
  },
  {
    icon: "BookOpen",
    title: "RAG knowledge base",
    desc: "Curated roadmaps, interview prep, system design, and clean-code guides — hybrid-searched and injected into every answer.",
  },
  {
    icon: "Brain",
    title: "Persistent memory",
    desc: "Your university, target role, skills, and goals personalize every response. The agent remembers who you are becoming.",
  },
  {
    icon: "Bot",
    title: "A swarm of specialists",
    desc: "Seven sub-agents — Coder, Reviewer, Debugger, Optimizer, Mentor — each tuned for fresh graduate growth.",
  },
  {
    icon: "Lock",
    title: "Real multi-user accounts",
    desc: "Secure scrypt-hashed passwords and signed session cookies. Your conversations and plans are scoped to you.",
  },
];

const STEPS: { n: string; title: string; desc: string }[] = [
  {
    n: "01",
    title: "Create your account",
    desc: "Register in seconds. Your career memory is created automatically and personalizes every response.",
  },
  {
    n: "02",
    title: "Pick a mode & ask",
    desc: "Choose Chat, Plan, Build, Debug, Optimize, or Career. The right sub-agent routes your request with RAG context.",
  },
  {
    n: "03",
    title: "Review & ship",
    desc: "Approve diffs, follow structured plans, and learn from every answer. From graduation to shipped.",
  },
];

export function LandingView() {
  const { setRoute } = useGradBridge();
  const { setTheme } = useTheme();

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Backdrops */}
      <div className="gb-grid-bg gb-mask-fade pointer-events-none fixed inset-0 -z-20" aria-hidden />
      <GradientMesh className="fixed inset-0 -z-10 opacity-60" />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#agents" className="transition-colors hover:text-foreground">Agents</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <button
              type="button"
              onClick={() => setRoute("about")}
              className="transition-colors hover:text-foreground"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setRoute("guide")}
              className="transition-colors hover:text-foreground"
            >
              User guide
            </button>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const isDark = document.documentElement.classList.contains("dark");
                setTheme(isDark ? "light" : "dark");
              }}
              className="hidden size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
              aria-label="Toggle theme"
            >
              <ThemeIcon />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRoute("login")}
              className="gap-1.5"
            >
              Sign in
            </Button>
            <Button
              size="sm"
              onClick={() => setRoute("register")}
              className="gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
            >
              Get started
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <Sparkles className="size-3.5 text-primary" />
              OpenCode-style autonomous agent
            </span>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              From graduation
              <br className="hidden sm:block" /> to{" "}
              <span className="gb-text-gradient-anim">shipped</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg lg:mx-0">
              GradBridge is an autonomous AI agent that helps fresh Computer Science
              &amp; Software Engineering graduates plan, build, debug, optimize, and
              grow their careers — with RAG context, safe diffs, and persistent memory.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Button
                size="lg"
                onClick={() => setRoute("register")}
                className="w-full gap-2 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-primary/20 gb-glow-cta hover:opacity-90 sm:w-auto"
              >
                Start building free
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setRoute("guide")}
                className="w-full gap-2 sm:w-auto"
              >
                <Terminal className="size-4" />
                Read the guide
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free to start · no credit card · your data stays yours
            </p>
          </motion.div>

          {/* Right: animated flow diagram + floating chips */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="relative"
          >
            <div className="gb-glass relative rounded-2xl border border-border/60 p-6 shadow-2xl shadow-primary/5">
              <HeroFlow className="mx-auto max-w-md" />
            </div>
            <FloatingChips />
          </motion.div>
        </div>

        {/* Stats band */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2, ease: "easeOut" }}
          className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {[
            { k: "7", v: "Sub-agents" },
            { k: "6", v: "Agent modes" },
            { k: "100+", v: "Unique users" },
            { k: "RAG", v: "Knowledge base" },
          ].map((s) => (
            <div
              key={s.v}
              className="gb-glass rounded-xl border border-border/60 p-4 text-center transition-transform hover:-translate-y-0.5"
            >
              <div className="gb-text-gradient text-2xl font-bold sm:text-3xl">{s.k}</div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.v}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Terminal demo strip */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          className="relative"
        >
          {/* Glow behind the terminal */}
          <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent blur-2xl" aria-hidden />

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-emerald-500/5">
            {/* Window controls */}
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-rose-400/80" />
              <span className="size-2.5 rounded-full bg-amber-400/80" />
              <span className="size-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-2 font-mono text-[0.7rem] text-white/40">
                gradbridge — zsh
              </span>
            </div>

            {/* Terminal content */}
            <div className="space-y-1.5 p-5 font-mono text-xs leading-relaxed">
              <div className="flex items-start gap-2 gb-term-line" style={{ animationDelay: "0s" }}>
                <span className="shrink-0 font-semibold text-emerald-400">❯</span>
                <span className="text-white/70">gradbridge plan &quot;add OAuth2 login&quot;</span>
              </div>
              <div className="flex items-start gap-2 gb-term-line" style={{ animationDelay: "0.12s" }}>
                <span className="shrink-0 font-semibold text-emerald-400">✓</span>
                <span className="text-white/50">Plan Agent</span>
                <span className="text-white/30">·</span>
                <span className="text-emerald-400/70">5 steps</span>
                <span className="text-white/30">·</span>
                <span className="text-emerald-400/70">3 files</span>
              </div>
              <div className="flex items-start gap-2 gb-term-line" style={{ animationDelay: "0.24s" }}>
                <span className="shrink-0 font-semibold text-emerald-400">❯</span>
                <span className="text-white/70">gradbridge build --approve</span>
              </div>
              <div className="flex items-start gap-2 gb-term-line" style={{ animationDelay: "0.36s" }}>
                <span className="shrink-0 font-semibold text-emerald-400">✓</span>
                <span className="text-white/50">src/auth/login.ts</span>
                <span className="text-emerald-400/70">+18 -2</span>
                <span className="text-white/30">applied</span>
              </div>
              <div className="flex items-start gap-2 gb-term-line" style={{ animationDelay: "0.48s" }}>
                <span className="shrink-0 font-semibold text-emerald-400">✓</span>
                <span className="text-white/50">src/auth/refresh.ts</span>
                <span className="text-emerald-400/70">+24</span>
                <span className="text-white/30">applied</span>
              </div>
              <div className="flex items-start gap-2 gb-term-line" style={{ animationDelay: "0.6s" }}>
                <span className="shrink-0 font-semibold text-emerald-400">❯</span>
                <span className="text-white/70">gradbridge career &quot;backend roadmap&quot;</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-emerald-400">❯</span>
                <span className="gb-cursor inline-block h-3.5 w-2 rounded-sm bg-emerald-400" />
              </div>
            </div>
          </div>

          {/* Caption below terminal */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <BridgeCodeArt className="h-7 w-24 opacity-70" />
            <span>Real commands · real agents · real diffs</span>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Everything a fresh graduate needs to ship"
          subtitle="An opinionated agent workspace — not a generic chatbot. Built around the way juniors actually learn and ship."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <FeatureCard icon={f.icon} title={f.title} desc={f.desc} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Agents showcase */}
      <section id="agents" className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="The Swarm"
          title="Seven specialists, one agent"
          subtitle="Each sub-agent has a tuned system prompt. Activate the right one for the job — or let the mode pick for you."
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_LIST.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/50 p-4 gb-transition-hover hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-110",
                    a.accent,
                  )}
                >
                  <Icon name={a.icon} className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.role}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {a.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Modes strip */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="gb-glass-strong gb-border-anim relative overflow-hidden rounded-2xl border border-border/60 p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <h3 className="text-lg font-semibold">Six modes for every stage of your work</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Switch mode and the right agent takes over — with the right prompt.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.values(MODE_META).map((m) => (
                <span
                  key={m.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Icon name={m.icon} className="size-3.5 text-primary" />
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps from idea to shipped"
        />
        <div className="relative mt-12 grid gap-4 md:grid-cols-3">
          {/* Connecting line on desktop */}
          <div
            className="pointer-events-none absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent md:block"
            aria-hidden
          />
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="relative rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm"
            >
              <div className="gb-text-gradient text-3xl font-bold">{s.n}</div>
              <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats rings */}
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-6 rounded-2xl border border-border/60 bg-card/40 p-8 sm:grid-cols-4">
          <StatRing value="7" label="Agents" index={0} />
          <StatRing value="6" label="Modes" index={1} />
          <StatRing value="100+" label="Users" index={2} />
          <StatRing value="∞" label="Projects" index={3} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-8 text-center sm:p-16">
          <div className="gb-grid-lines gb-mask-fade pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <div className="relative">
            <Rocket className="mx-auto size-10 text-primary" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Your first ship is one sign-up away.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Join fresh graduates building real projects with an autonomous agent by their side.
            </p>
            <Button
              size="lg"
              onClick={() => setRoute("register")}
              className="mt-7 gap-2 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-primary/20 gb-glow-cta hover:opacity-90"
            >
              Create your account
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="size-5" animated={false} />
            <span>GradBridge — from graduation to shipped</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setRoute("about")} className="transition-colors hover:text-foreground">
              About
            </button>
            <button onClick={() => setRoute("guide")} className="transition-colors hover:text-foreground">
              User guide
            </button>
            <button onClick={() => setRoute("login")} className="transition-colors hover:text-foreground">
              Sign in
            </button>
            <span>Built for fresh CS graduates</span>
          </div>
        </div>
        <div className="border-t border-border/40 py-3 text-center">
          <DesignerCredit />
        </div>
      </footer>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <LogoMark className="size-8" />
      <span className="text-sm font-semibold tracking-tight">
        Grad<span className="gb-text-gradient">Bridge</span>
      </span>
    </div>
  );
}

function ThemeIcon() {
  return (
    <>
      <SunIcon className="hidden size-4 dark:block" />
      <MoonIcon className="size-4 dark:hidden" />
    </>
  );
}
function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {subtitle && (
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
      )}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="group relative h-full overflow-hidden rounded-xl border border-border/60 bg-card/50 p-5 gb-transition-hover hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-500/15 text-primary ring-1 ring-primary/20 transition-transform group-hover:scale-110">
        <Icon name={icon} className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
      <Check className="absolute right-4 top-4 size-4 text-primary/30 transition-colors group-hover:text-primary/60" />
    </div>
  );
}

export type { LucideIcon };
