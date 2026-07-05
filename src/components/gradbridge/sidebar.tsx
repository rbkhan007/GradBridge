"use client";

import { Plus, Info } from "lucide-react";
import { useGradBridge, type View } from "@/lib/store";
import { AGENTS, MODE_META } from "@/lib/agents";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import { LogoMark, AgentOrb, DesignerCredit } from "./art";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  view: View;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { view: "chat", label: "Chat", icon: "MessageSquare" },
  { view: "agents", label: "Agents", icon: "Bot" },
  { view: "files", label: "Files", icon: "FolderTree" },
  { view: "knowledge", label: "Knowledge", icon: "BookOpen" },
  { view: "memory", label: "Memory", icon: "Brain" },
  { view: "guide", label: "User Guide", icon: "Compass" },
  { view: "cli", label: "CLI", icon: "Terminal" },
  { view: "settings", label: "Settings", icon: "Settings" },
];

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useGradBridge();
  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border bg-sidebar/40 lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile slide-over */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const {
    view,
    setView,
    setRoute,
    mode,
    agentId,
    setMode,
    clearChat,
    conversationId,
  } = useGradBridge();

  const activeAgent = agentId ? AGENTS[agentId] : AGENTS[MODE_META[mode].defaultAgent];

  const handleNav = (v: View) => {
    setView(v);
    onNavigate?.();
  };

  const handleMode = (m: keyof typeof MODE_META) => {
    setMode(m);
    setView("chat");
    onNavigate?.();
  };

  const handleNewChat = () => {
    clearChat();
    setView("chat");
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Brand header */}
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <LogoMark className="size-7" />
        <span className="text-sm font-semibold tracking-tight">
          Grad<span className="gb-text-gradient">Bridge</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3" aria-label="Primary">
        <p className="px-2 pb-1 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        {NAV.map((item) => {
          const active = view === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => handleNav(item.view)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium gb-transition-view",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity",
                  active
                    ? "gb-glow-ring opacity-100"
                    : "opacity-0 group-hover:opacity-60 group-hover:shadow-[0_0_0_1px_var(--ring),0_0_24px_-4px_var(--gb-glow)]",
                )}
                aria-hidden
              />
              <Icon
                name={item.icon}
                className={cn(
                  "size-4 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {item.label}
              {active && <span className="sr-only">(current)</span>}
            </button>
          );
        })}
      </nav>

      <div className="mx-3 border-t border-border" />

      {/* About link */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => {
            setRoute("about");
            onNavigate?.();
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground gb-transition-view hover:bg-accent/50 hover:text-foreground"
        >
          <Info className="size-4" />
          About GradBridge
        </button>
      </div>

      <div className="mx-3 border-t border-border" />

      {/* Active agent */}
      <div className="p-3">
        <p className="px-2 pb-1 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
          Active Agent
        </p>
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg border border-border bg-card/50 p-2.5",
            view === "chat" && "gb-glow-ring",
          )}
        >
          <AgentOrb accent={activeAgent.accent} className="size-8 shrink-0">
            <Icon name={activeAgent.icon} className="size-4" />
          </AgentOrb>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{activeAgent.name}</p>
            <p className="truncate text-xs text-muted-foreground">{activeAgent.role}</p>
          </div>
        </div>
      </div>

      {/* Mode quick-switcher */}
      <div className="px-3 pb-3">
        <p className="px-2 pb-1 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
          Mode
        </p>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(MODE_META) as Array<keyof typeof MODE_META>).map((m) => {
            const meta = MODE_META[m];
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleMode(m)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium gb-transition-view",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon
                  name={meta.icon}
                  className={cn("size-3.5", active && "text-primary")}
                />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-gradient-to-br from-emerald-500/10 to-teal-500/10 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:from-emerald-500/20 hover:to-teal-500/20"
        >
          <Plus className="size-4 text-primary" />
          New chat
        </button>
        <div className="mt-2 flex items-center justify-between px-1 text-[0.65rem] text-muted-foreground">
          <span>GradBridge</span>
          <span className={cn("truncate", conversationId ? "text-emerald-400" : "")}>
            {conversationId ? "session active" : "no session"}
          </span>
        </div>
        <div className="mt-2 text-center">
          <DesignerCredit className="text-[0.6rem]" />
        </div>
      </div>
    </div>
  );
}
