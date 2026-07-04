"use client";

/**
 * GradBridge custom animated vector art library.
 * Hand-built SVG illustrations + animated icons (no external image deps).
 * All animations are CSS-driven (see globals.css @keyframes gb-*) so they
 * run without JS and stay performant. Reduced-motion safe via the
 * `prefers-reduced-motion` media query in globals.css.
 *
 * Brand: Designed and Developed by Rhasan — https://rhasan-dev-bd-com.vercel.app/
 */
import { useId } from "react";
import { cn } from "@/lib/utils";

/* ============================================================
 * 1. Animated logo mark — unique GradBridge brand logo
 *    Graduation cap + bridge beam + code brackets + pulse ring
 * ============================================================ */

export function LogoMark({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  const gradId = useId();
  const glowId = useId();
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={cn("size-8", className)}
      aria-label="GradBridge logo"
    >
      <defs>
        <linearGradient id={`${gradId}-main`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={`${gradId}-cap`} x1="12" y1="13" x2="36" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0.8" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Rounded square container */}
      <rect width="48" height="48" rx="12" fill={`url(#${gradId}-main)`} />
      {/* Subtle inner glow ring */}
      {animated && (
        <rect
          x="2" y="2" width="44" height="44" rx="10"
          fill="none"
          stroke="white"
          strokeWidth="0.5"
          strokeOpacity="0.15"
          className="gb-logo-pulse-ring"
        />
      )}
      {/* Graduation cap — top diamond */}
      <path
        d="M24 12L36 18L24 24L12 18L24 12Z"
        fill={`url(#${gradId}-cap)`}
      />
      {/* Cap side flaps */}
      <path
        d="M16 21V27C16 27 19.5 30 24 30C28.5 30 32 27 32 27V21"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.85"
        fill="none"
      />
      {/* Tassel line + dot */}
      <path
        d="M36 18V23"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
      <circle cx="36" cy="24.2" r="1.5" fill="white" fillOpacity="0.8" />
      {/* Bridge beam — animated dashed line under the cap */}
      {animated && (
        <path
          d="M8 35H40"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="4 3"
          strokeOpacity="0.45"
          className="gb-logo-beam"
        />
      )}
      {/* Code bracket left — morphing */}
      {animated && (
        <path
          d="M14 39l-4-3 4-3"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.5"
          fill="none"
          className="gb-logo-bracket-l"
        />
      )}
      {/* Code bracket right — morphing */}
      {animated && (
        <path
          d="M34 39l4-3-4-3"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.5"
          fill="none"
          className="gb-logo-bracket-r"
        />
      )}
      {/* Center dot — pulse */}
      {animated && (
        <circle
          cx="24" cy="36" r="1.5"
          fill="white"
          fillOpacity="0.6"
          className="gb-logo-dot"
        />
      )}
    </svg>
  );
}

/* ============================================================
 * 2. Hero flow diagram — Idea → Agent swarm → Shipped code
 *    Three animated nodes connected by flowing dashed paths.
 * ============================================================ */

export function HeroFlow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 320"
      fill="none"
      className={cn("w-full", className)}
      role="img"
      aria-label="GradBridge agent flow: from idea through specialist agents to shipped code"
    >
      <defs>
        <linearGradient id="gb-flow-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="oklch(0.74 0.13 185)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="gb-flow-node" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gb-flow-grad1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
        <linearGradient id="gb-flow-grad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="gb-flow-grad3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Connecting flow lines */}
      <path d="M110 160C160 160 180 90 230 90" stroke="url(#gb-flow-line)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M110 160C160 160 180 230 230 230" stroke="url(#gb-flow-line)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M290 90C340 90 360 130 410 160" stroke="url(#gb-flow-line)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M290 230C340 230 360 190 410 160" stroke="url(#gb-flow-line)" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Animated traveling dots along the paths */}
      <circle r="3.5" fill="#10b981" className="gb-flow-dot-1">
        <animateMotion dur="3s" repeatCount="indefinite" path="M110 160C160 160 180 90 230 90" />
      </circle>
      <circle r="3.5" fill="#14b8a6" className="gb-flow-dot-2">
        <animateMotion dur="3s" repeatCount="indefinite" path="M110 160C160 160 180 230 230 230" />
      </circle>
      <circle r="3.5" fill="#06b6d4" className="gb-flow-dot-3">
        <animateMotion dur="3s" repeatCount="indefinite" begin="1.5s" path="M290 90C340 90 360 130 410 160" />
      </circle>

      {/* Node 1: Idea (left) */}
      <FlowNode x={70} y={160} grad="gb-flow-grad1" glow="gb-flow-node" label="Idea">
        <path d="M0 -6A6 6 0 1 1 -4 4L-6 8L-2 6A6 6 0 0 0 0 -6Z" fill="white" transform="scale(0.9)" />
      </FlowNode>

      {/* Node 2a: Agent (top) */}
      <FlowNode x={260} y={90} grad="gb-flow-grad2" glow="gb-flow-node" label="Agents">
        <g transform="translate(-9,-9) scale(0.75)">
          <rect x="4" y="8" width="16" height="12" rx="3" fill="white" />
          <circle cx="9" cy="13" r="1.5" fill="#14b8a6" />
          <circle cx="15" cy="13" r="1.5" fill="#14b8a6" />
          <path d="M8 17h8" stroke="#14b8a6" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M12 4v4M6 8l1.5 2M18 8l-1.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </FlowNode>

      {/* Node 2b: Agent (bottom) */}
      <FlowNode x={260} y={230} grad="gb-flow-grad2" glow="gb-flow-node" label="RAG">
        <g transform="translate(-9,-9) scale(0.8)">
          <path d="M4 6h16M4 10h16M4 14h10M4 18h14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      </FlowNode>

      {/* Node 3: Shipped (right) */}
      <FlowNode x={450} y={160} grad="gb-flow-grad3" glow="gb-flow-node" label="Shipped">
        <g transform="translate(-9,-8) scale(0.8)">
          <path d="M6 16l4 4l8-8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="2" y="2" width="20" height="20" rx="4" stroke="white" strokeWidth="1.5" fill="none" />
        </g>
      </FlowNode>
    </svg>
  );
}

function FlowNode({
  x, y, grad, glow, label, children,
}: {
  x: number; y: number; grad: string; glow: string; label: string; children?: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r="42" fill={`url(#${glow})`} className="gb-node-glow" />
      <circle r="28" fill="none" stroke="var(--primary)" strokeWidth="1" strokeDasharray="2 4" opacity="0.4" className="gb-node-ring" />
      <circle r="22" fill={`url(#${grad})`} />
      <circle r="22" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="1" />
      {children}
      <text y="48" textAnchor="middle" className="gb-flow-label" fill="var(--foreground)" fontSize="11" fontWeight="600" opacity="0.65">{label}</text>
    </g>
  );
}

/* ============================================================
 * 3. Animated agent orb — used in the swarm showcase + loading states
 * ============================================================ */

export function AgentOrb({
  className,
  accent = "from-emerald-500 to-teal-500",
  children,
}: {
  className?: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className={cn("absolute inset-0 rounded-full bg-gradient-to-br opacity-20 blur-md", accent)} aria-hidden />
      <span className={cn("absolute inset-0 rounded-full bg-gradient-to-br opacity-10", accent, "gb-orb-pulse")} aria-hidden />
      <div className={cn("relative flex items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg", accent)}>
        {children}
      </div>
    </div>
  );
}

/* ============================================================
 * 4. Decorative gradient mesh — animated background blobs
 * ============================================================ */

export function GradientMesh({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="gb-mesh-blob gb-mesh-blob-1" />
      <div className="gb-mesh-blob gb-mesh-blob-2" />
      <div className="gb-mesh-blob gb-mesh-blob-3" />
    </div>
  );
}

/* ============================================================
 * 5. Animated terminal window — for the hero / "how it works"
 * ============================================================ */

export function TerminalWindow({ className }: { className?: string }) {
  const lines = [
    { prompt: "›", text: "gradbridge plan \"add OAuth2 login\"", color: "text-primary" },
    { prompt: "✓", text: "Plan Agent · 5 steps · 3 files", color: "text-emerald-400" },
    { prompt: "›", text: "gradbridge build --approve", color: "text-primary" },
    { prompt: "✓", text: "src/auth/login.ts +18 -2  applied", color: "text-emerald-400" },
    { prompt: "✓", text: "src/auth/refresh.ts +24  applied", color: "text-emerald-400" },
    { prompt: "›", text: "gradbridge career \"backend roadmap\"", color: "text-primary" },
  ];
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-[#0d1117] shadow-2xl", className)}>
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-rose-400/80" />
        <span className="size-2.5 rounded-full bg-amber-400/80" />
        <span className="size-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 font-mono text-[0.7rem] text-white/40">gradbridge — zsh</span>
      </div>
      <div className="space-y-1 p-4 font-mono text-xs">
        {lines.map((l, i) => (
          <div key={i} className="flex items-start gap-2 gb-term-line" style={{ animationDelay: `${i * 0.12}s` }}>
            <span className={cn("shrink-0 font-semibold", l.color)}>{l.prompt}</span>
            <span className="text-white/70">{l.text}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-primary">›</span>
          <span className="gb-cursor inline-block h-3.5 w-2 bg-primary" />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 6. Animated bridge → code morph (logo accent for CTA)
 * ============================================================ */

export function BridgeCodeArt({ className }: { className?: string }) {
  const gradId = useId();
  return (
    <svg viewBox="0 0 120 60" fill="none" className={cn("w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path d="M10 40Q60 20 110 40" stroke={`url(#${gradId})`} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M25 33v7M45 28v7M75 28v7M95 33v7" stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M70 50l-8-5l8-5" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" className="gb-code-bracket gb-code-bracket-l" />
      <path d="M92 50l8-5l-8-5" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" className="gb-code-bracket gb-code-bracket-r" />
      <circle cx="81" cy="45" r="2" fill="var(--primary)" className="gb-code-dot" />
    </svg>
  );
}

/* ============================================================
 * 7. Animated stat counter ring (decorative) — colorful per-ring
 * ============================================================ */

const STAT_COLORS = [
  { from: "#10b981", to: "#14b8a6" }, // emerald → teal (Agents)
  { from: "#14b8a6", to: "#06b6d4" }, // teal → cyan (Modes)
  { from: "#f59e0b", to: "#f97316" }, // amber → orange (Users)
  { from: "#8b5cf6", to: "#a855f7" }, // violet → purple (Projects)
];

export function StatRing({
  value,
  label,
  index = 0,
  className,
}: {
  value: string;
  label: string;
  index?: number;
  className?: string;
}) {
  const gradId = useId();
  const colors = STAT_COLORS[index % STAT_COLORS.length];
  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <svg viewBox="0 0 100 100" className="size-20 -rotate-90">
        <defs>
          <linearGradient id={`${gradId}-ring`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="42"
          fill="none"
          stroke={`url(#${gradId}-ring)`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="264"
          className="gb-stat-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="gb-text-gradient text-lg font-bold">{value}</span>
      </div>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/* ============================================================
 * 8. Floating code chips — decorative background elements
 * ============================================================ */

export function FloatingChips({ className }: { className?: string }) {
  const chips = [
    { text: "const plan = await agent.plan()", x: "8%", y: "18%", delay: "0s" },
    { text: "<DiffPreview approved />", x: "72%", y: "12%", delay: "0.8s" },
    { text: "rag.search(query, { hybrid: true })", x: "12%", y: "68%", delay: "1.4s" },
    { text: "git commit -m 'ship it'", x: "68%", y: "76%", delay: "0.4s" },
  ];
  return (
    <div className={cn("pointer-events-none absolute inset-0 hidden lg:block", className)} aria-hidden>
      {chips.map((c, i) => (
        <span
          key={i}
          className="gb-float-chip gb-glass absolute rounded-lg border border-border px-2.5 py-1 font-mono text-[0.65rem] text-foreground/70 shadow-sm"
          style={{ left: c.x, top: c.y, animationDelay: c.delay }}
        >
          {c.text}
        </span>
      ))}
    </div>
  );
}

/* ============================================================
 * 9. Designer credit badge — "Designed & Developed by Rhasan"
 * ============================================================ */

export function DesignerCredit({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.65rem] text-muted-foreground", className)}>
      Designed &amp; Developed by{" "}
      <a
        href="https://rhasan-dev-bd-com.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="gb-text-gradient font-semibold transition-opacity hover:opacity-80"
      >
        Rhasan
      </a>
    </span>
  );
}

/* ============================================================
 * 10. Animated sparkle icon — shadcn.io style colorful SVG
 * ============================================================ */

export function AnimatedSparkle({ className }: { className?: string }) {
  const gradId = useId();
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <defs>
        <linearGradient id={`${gradId}-sparkle`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
        fill={`url(#${gradId}-sparkle)`}
        className="gb-sparkle-pulse"
      />
    </svg>
  );
}

/* ============================================================
 * 11. Animated shield icon — colorful SVG with checkmark
 * ============================================================ */

export function AnimatedShield({ className }: { className?: string }) {
  const gradId = useId();
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <defs>
        <linearGradient id={`${gradId}-shield`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M12 3L4 7V12C4 16.42 7.42 20.24 12 21.27C16.58 20.24 20 16.42 20 12V7L12 3Z"
        fill={`url(#${gradId}-shield)`}
        fillOpacity="0.15"
        stroke={`url(#${gradId}-shield)`}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke={`url(#${gradId}-shield)`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="gb-shield-check"
      />
    </svg>
  );
}

/* ============================================================
 * 12. Animated rocket icon — colorful launch SVG
 * ============================================================ */

export function AnimatedRocket({ className }: { className?: string }) {
  const gradId = useId();
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <defs>
        <linearGradient id={`${gradId}-rocket`} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 2 7 7 7 13C7 15 8 17 9 18L12 22L15 18C16 17 17 15 17 13C17 7 12 2 12 2Z"
        fill={`url(#${gradId}-rocket)`}
        fillOpacity="0.2"
        stroke={`url(#${gradId}-rocket)`}
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="gb-rocket-float"
      />
      <circle cx="12" cy="12" r="2" fill={`url(#${gradId}-rocket)`} />
    </svg>
  );
}

/* ============================================================
 * 13. Animated brain icon — colorful neural SVG
 * ============================================================ */

export function AnimatedBrain({ className }: { className?: string }) {
  const gradId = useId();
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <defs>
        <linearGradient id={`${gradId}-brain`} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <path
        d="M12 4C8 4 5 7 5 10.5C5 12 5.5 13.5 6.5 14.5C6 15.5 6 17 7 18C8 19 10 19 11 18.5V20H13V18.5C14 19 16 19 17 18C18 17 18 15.5 17.5 14.5C18.5 13.5 19 12 19 10.5C19 7 16 4 12 4Z"
        fill={`url(#${gradId}-brain)`}
        fillOpacity="0.15"
        stroke={`url(#${gradId}-brain)`}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 4V20" stroke={`url(#${gradId}-brain)`} strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 2" />
      <path d="M8 9C9 8 10 9 12 8" stroke={`url(#${gradId}-brain)`} strokeWidth="1.2" strokeLinecap="round" className="gb-brain-pulse" />
      <path d="M16 9C15 8 14 9 12 8" stroke={`url(#${gradId}-brain)`} strokeWidth="1.2" strokeLinecap="round" className="gb-brain-pulse" style={{ animationDelay: "0.3s" }} />
    </svg>
  );
}

/* ============================================================
 * 14. Animated code brackets — colorful dev icon
 * ============================================================ */

export function AnimatedCode({ className }: { className?: string }) {
  const gradId = useId();
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <defs>
        <linearGradient id={`${gradId}-code`} x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path d="M8 6L3 12L8 18" stroke={`url(#${gradId}-code)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="gb-code-bracket-l" />
      <path d="M16 6L21 12L16 18" stroke={`url(#${gradId}-code)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="gb-code-bracket-r" />
      <path d="M14 4L10 20" stroke={`url(#${gradId}-code)`} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  );
}
