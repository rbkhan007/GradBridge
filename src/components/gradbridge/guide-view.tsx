"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Brain,
  ClipboardList,
  FolderTree,
  GraduationCap,
  Hammer,
  type LucideIcon,
} from "lucide-react";
import { useGradBridge } from "@/lib/store";
import { AGENT_LIST, MODE_META } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import { LogoMark, GradientMesh, BridgeCodeArt, DesignerCredit } from "./art";

export function GuideView({ isPublic }: { isPublic?: boolean }) {
  const { setRoute, setView } = useGradBridge();

  return (
    <div className="relative min-h-screen">
      <div className="gb-grid-bg pointer-events-none fixed inset-0 -z-20" aria-hidden />

      {/* Top bar */}
      <header className="gb-glass sticky top-0 z-30 border-b border-border/60">
        <div className="relative mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px gb-border-anim"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => setRoute(isPublic ? "landing" : "app")}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {isPublic ? "Back to home" : "Back to app"}
          </button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <LogoMark className="size-5" animated={false} />
            User Guide
          </div>
          {isPublic ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRoute("login")}>
                Sign in
              </Button>
              <Button
                size="sm"
                onClick={() => setRoute("register")}
                className="gb-glow-cta bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:opacity-90"
              >
                Get started
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setView("chat")}
              className="gb-glow-cta gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:opacity-90"
            >
              Open chat
            </Button>
          )}
        </div>
      </header>

      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <GradientMesh className="absolute inset-x-0 top-0 -z-10 h-96 opacity-30" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Documentation
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            GradBridge <span className="gb-text-gradient-anim">User Guide</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Everything you need to plan, build, debug, and grow with your autonomous
            agent. Built for fresh Computer Science &amp; Software Engineering graduates.
          </p>
        </motion.div>

        {/* Quickstart */}
        <Section icon={GraduationCap} title="Getting started" id="start">
          <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Create an account</strong> from the
              register page with your name, email, and password (min 8 characters).
            </li>
            <li>
              <strong className="text-foreground">Fill your memory</strong> — visit the
              Memory tab and set your university, target role, skills, and goals. Every
              response is personalized to this profile.
            </li>
            <li>
              <strong className="text-foreground">Pick a mode</strong> in the chat view
              (Chat, Plan, Build, Debug, Optimize, Career) and ask your first question.
            </li>
            <li>
              <strong className="text-foreground">Review &amp; ship</strong> — approve
              file diffs, follow structured plans, and learn from each answer.
            </li>
          </ol>
        </Section>

        {/* Modes */}
        <Section icon={ClipboardList} title="Agent modes" id="modes">
          <p className="text-sm text-muted-foreground">
            Modes route your request to the right agent with the right prompt. Switch
            mode from the chips above the chat input, or from the sidebar.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(MODE_META).map(([key, m]) => (
              <div
                key={key}
                className="rounded-lg border border-border/60 bg-card/40 p-4"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon name={m.icon} className="size-4" />
                  </div>
                  <span className="text-sm font-semibold">{m.label}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{m.description}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Sub-agents */}
        <Section icon={Bot} title="The sub-agent swarm" id="agents">
          <p className="text-sm text-muted-foreground">
            Seven specialized agents collaborate on your work. Activate one from the
            Agents tab to route the next chat through it.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {AGENT_LIST.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm",
                    a.accent,
                  )}
                >
                  <Icon name={a.icon} className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.role}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground/90">
                    {a.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Files */}
        <Section icon={FolderTree} title="File orchestrator & safe diffs" id="files">
          <p className="text-sm text-muted-foreground">
            The Files tab is a virtual workspace. Browse indexed project files, read
            them with syntax highlighting, and ask the agent to edit them.
          </p>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <Step n="1">
              Open a file and click <strong className="text-foreground">Edit with AI</strong>.
            </Step>
            <Step n="2">
              Describe the change. The Build agent proposes a new version.
            </Step>
            <Step n="3">
              Review the <strong className="text-foreground">unified diff</strong> — green
              lines added, red lines removed. Counts and a summary are shown.
            </Step>
            <Step n="4">
              <strong className="text-foreground">Approve &amp; apply</strong> writes the
              change and marks the file as modified, or <strong className="text-foreground">Reject</strong> to discard.
            </Step>
          </div>
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
            <strong>Safety:</strong> nothing is written without your explicit approval.
            The Plan agent is read-only and never edits files.
          </div>
        </Section>

        {/* Knowledge */}
        <Section icon={BookOpen} title="RAG knowledge base" id="knowledge">
          <p className="text-sm text-muted-foreground">
            The Knowledge tab is a curated corpus of roadmaps, interview prep, system
            design, resume tips, and clean-code best practices. Every chat query runs a
            hybrid search over this corpus <em>and</em> your indexed project files, then
            injects the most relevant snippets into the agent&apos;s context. You&apos;ll
            see the matched sources as chips above the chat.
          </p>
        </Section>

        {/* Memory */}
        <Section icon={Brain} title="Persistent memory" id="memory">
          <p className="text-sm text-muted-foreground">
            Your profile (university, major, graduation year, target role, experience
            level, skills, goals) is stored securely and scoped to your account. It
            personalizes every response — for example, the Career Mentor tailors roadmaps
            to your target role and experience level. Update it any time from the Memory
            tab.
          </p>
        </Section>

        {/* Security */}
        <Section icon={Hammer} title="Security & accounts" id="security">
          <ul className="ml-4 list-disc space-y-2 text-sm text-muted-foreground">
            <li>
              Passwords are hashed with <strong className="text-foreground">scrypt</strong> + a
              per-user salt — never stored in plain text.
            </li>
            <li>
              Sessions use a signed <strong className="text-foreground">httpOnly cookie</strong>{" "}
              (HMAC-SHA256), valid for 7 days.
            </li>
            <li>
              Your conversations, plans, and profile are <strong className="text-foreground">scoped to your account</strong> — no other user can see them.
            </li>
            <li>
              <strong className="text-foreground">Sign out</strong> from the user menu in
              the top bar to clear your session on this device.
            </li>
          </ul>
        </Section>

        {/* Tips */}
        <Section icon={GraduationCap} title="Tips for fresh graduates" id="tips">
          <BridgeCodeArt className="mb-4 h-6 w-20 opacity-50" />
          <ul className="ml-4 list-disc space-y-2 text-sm text-muted-foreground">
            <li>Start with <strong className="text-foreground">Plan mode</strong> for anything non-trivial — you&apos;ll get a structured plan before code is written.</li>
            <li>Use <strong className="text-foreground">Career mode</strong> for roadmaps, resume reviews, and interview prep tailored to your target role.</li>
            <li>When debugging, paste the full error + the relevant file — the Debugger agent loves context.</li>
            <li>Keep your Memory profile updated as your skills grow; the agent grows with you.</li>
            <li>Treat every diff as a learning moment: read <em>why</em> the agent changed each line.</li>
          </ul>
        </Section>

        {/* CTA */}
        <div className="gb-border-anim mt-12 rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/10 to-transparent p-6 text-center sm:p-8">
          <h2 className="text-lg font-semibold">Ready to ship?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Jump back into your workspace and put the agent to work.
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button
              onClick={() => (isPublic ? setRoute("register") : setView("chat"))}
              className="gb-glow-cta gap-2 bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:opacity-90"
            >
              {isPublic ? "Create your account" : "Open chat"}
            </Button>
            {isPublic && (
              <Button variant="outline" onClick={() => setRoute("login")}>
                Sign in
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-border/60 bg-background/60">
          <div className="mx-auto max-w-4xl px-4 py-6 text-center text-xs text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <LogoMark className="size-5" animated={false} />
              <span>GradBridge — from graduation to shipped</span>
            </div>
            <div className="mt-3">
              <DesignerCredit />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({
  icon: IconCmp,
  title,
  id,
  children,
}: {
  icon: LucideIcon;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.3 }}
      className="gb-glass group mt-10 scroll-mt-20 rounded-xl border border-border/40 p-5 gb-transition-hover hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-shadow duration-200 group-hover:shadow-[0_0_0_1px_var(--ring),0_0_24px_-4px_var(--gb-glow)]">
          <IconCmp className="size-4" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
