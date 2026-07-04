"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Github, Linkedin, Mail, Users } from "lucide-react";
import { useGradBridge } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { LogoMark, GradientMesh, DesignerCredit } from "./art";
import { cn } from "@/lib/utils";

interface TeamMember {
  name: string;
  id?: string;
  role: string;
  description: string;
  avatar: string;
  color: string;
  social?: {
    github?: string;
    linkedin?: string;
    email?: string;
  };
}

const TEAM: TeamMember[] = [
  {
    name: "Rakibul Hasan",
    id: "011211068",
    role: "Full Stack Developer",
    description:
      "Architect and lead developer of GradBridge. Built the entire Next.js frontend, Rust CLI, Prisma schema, authentication system, and AI agent orchestration pipeline.",
    avatar: "RH",
    color: "from-emerald-500 to-teal-500",
    social: {
      github: "https://github.com/rbkhan007",
      linkedin: "https://linkedin.com/in/rbkhan007",
      email: "rbkhan00009@gmail.com",
    },
  },
  {
    name: "Coming Soon",
    role: "Team Member",
    description: "New team member joining soon. Stay tuned for updates!",
    avatar: "?",
    color: "from-violet-500 to-purple-500",
  },
  {
    name: "Coming Soon",
    role: "Team Member",
    description: "New team member joining soon. Stay tuned for updates!",
    avatar: "?",
    color: "from-amber-500 to-orange-500",
  },
];

const VALUES = [
  {
    title: "Open Source First",
    desc: "Built in the open. Apache 2.0 licensed. Contributions welcome from day one.",
    icon: "🌐",
  },
  {
    title: "Fresh Graduate Focused",
    desc: "Every feature is designed around the real challenges CS and SE graduates face when entering the industry.",
    icon: "🎓",
  },
  {
    title: "Safety by Default",
    desc: "Nothing changes without your approval. Every diff is previewed. Every plan is reviewed. You stay in control.",
    icon: "🛡️",
  },
  {
    title: "Full-Stack Craft",
    desc: "Next.js 16, Rust CLI, PostgreSQL + pgvector, Prisma ORM, Framer Motion — built with modern tools, done right.",
    icon: "⚡",
  },
];

export function AboutView() {
  const { setRoute } = useGradBridge();

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Backdrops */}
      <div className="gb-grid-bg gb-mask-fade pointer-events-none fixed inset-0 -z-20" aria-hidden />
      <GradientMesh className="fixed inset-0 -z-10 opacity-50" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="size-8" />
            <span className="text-sm font-semibold tracking-tight">
              Grad<span className="gb-text-gradient">Bridge</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRoute("landing")}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-4 pb-12 pt-16 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Users className="size-3.5 text-primary" />
            Meet the team
          </span>
          <h1 className="mt-6 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Built by <span className="gb-text-gradient-anim">fresh graduates</span>,
            <br className="hidden sm:block" /> for fresh graduates
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            GradBridge was born from a real problem: the gap between graduation and
            landing your first role. We&apos;re building the tool we wish we had.
          </p>
        </motion.div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
            Our Team
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            The people behind GradBridge
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm gb-transition-hover hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
            >
              {/* Avatar */}
              <div
                className={cn(
                  "flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-bold text-white shadow-lg",
                  member.color,
                )}
              >
                {member.avatar}
              </div>

              {/* Info */}
              <div className="mt-4">
                <h3 className="text-lg font-semibold">{member.name}</h3>
                {member.id && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ID: {member.id}
                  </p>
                )}
                <p className="mt-1 text-sm font-medium text-primary">
                  {member.role}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {member.description}
                </p>
              </div>

              {/* Social */}
              {member.social && (
                <div className="mt-4 flex items-center gap-2">
                  {member.social.github && (
                    <a
                      href={member.social.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-8 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      aria-label={`${member.name} on GitHub`}
                    >
                      <Github className="size-4" />
                    </a>
                  )}
                  {member.social.linkedin && (
                    <a
                      href={member.social.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-8 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      aria-label={`${member.name} on LinkedIn`}
                    >
                      <Linkedin className="size-4" />
                    </a>
                  )}
                  {member.social.email && (
                    <a
                      href={`mailto:${member.social.email}`}
                      className="flex size-8 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      aria-label={`Email ${member.name}`}
                    >
                      <Mail className="size-4" />
                    </a>
                  )}
                </div>
              )}

              {/* Coming Soon badge */}
              {!member.social && (
                <div className="mt-4">
                  <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                    Coming soon
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
            Values
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            What we believe in
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {VALUES.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm"
            >
              <div className="text-2xl">{v.icon}</div>
              <h3 className="mt-3 text-base font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {v.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="gb-glass-strong gb-border-anim relative overflow-hidden rounded-2xl border border-border/60 p-8 sm:p-12">
          <div className="relative">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Why GradBridge?
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Fresh CS graduates face a unique challenge: they have the theoretical
              knowledge but struggle with the practical gap — building real projects,
              navigating codebases, preparing for interviews, and landing that first
              role. GradBridge bridges that gap with an autonomous AI agent that
              plans, builds, debugs, and guides — all with persistent memory of who
              you are and where you&apos;re headed.
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              We started this project because we lived it. Every feature in GradBridge
              is something we wished existed when we were graduating. From the
              career mode roadmap to the safe file orchestrator, everything is built
              around real workflows that matter.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => setRoute("register")}
                className="gap-2 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-primary/20 gb-glow-cta hover:opacity-90"
              >
                Join GradBridge
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setRoute("guide")}
                className="gap-2"
              >
                Read the guide
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="size-5" animated={false} />
            <span>GradBridge — from graduation to shipped</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setRoute("guide")} className="transition-colors hover:text-foreground">
              User guide
            </button>
            <button onClick={() => setRoute("login")} className="transition-colors hover:text-foreground">
              Sign in
            </button>
          </div>
        </div>
        <div className="border-t border-border/40 py-3 text-center">
          <DesignerCredit />
        </div>
      </footer>
    </div>
  );
}
