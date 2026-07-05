"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  LogOut,
  Menu,
  Moon,
  Sun,
  User as UserIcon,
  Brain,
  ChevronDown,
  Info,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { useGradBridge } from "@/lib/store";
import { AGENTS, MODE_META } from "@/lib/agents";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import { LogoMark } from "./art";

/**
 * Sticky top bar (authenticated dashboard). Shows the GradBridge brand, a live
 * status pill of the active mode + agent, the LLM provider chip, theme toggle,
 * and a user menu (profile, guide, sign out).
 */
export function TopBar() {
  const { mode, agentId, authUser, setSidebarOpen, setRoute, setView, setAuthUser, clearChat } =
    useGradBridge();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeAgent = agentId ? AGENTS[agentId] : AGENTS[MODE_META[mode].defaultAgent];
  const modeMeta = MODE_META[mode];

  const initials = (authUser?.name || "GB")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "GB";

  // Close the user menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    clearChat();
    setAuthUser(null);
    setRoute("landing");
    try {
      await authClient.signOut();
    } catch {
      // Local state cleared; server cookie will expire eventually.
    }
    toast.success("Signed out", { description: "See you soon!" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-4">
      {/* Mobile: hamburger to open sidebar */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground gb-transition-view hover:bg-accent hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Brand */}
      <button
        type="button"
        onClick={() => setView("chat")}
        className="flex items-center gap-2"
      >
        <LogoMark className="size-8" />
        <div className="flex flex-col leading-none sm:flex-row sm:items-center sm:gap-2">
          <span className="text-sm font-semibold tracking-tight">
            Grad<span className="gb-text-gradient">Bridge</span>
          </span>
          <span className="hidden text-[0.65rem] text-muted-foreground sm:inline">
            Autonomous Agent
          </span>
        </div>
      </button>

      <div className="flex-1" />

      {/* Live status pill (mode + agent) */}
      <div className="hidden items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs md:flex">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon name={modeMeta.icon} className="size-3.5 text-primary" />
          {modeMeta.label}
        </span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1.5 font-medium">
          <span
            className={cn(
              "gb-glow-ring flex size-4 items-center justify-center rounded-full bg-gradient-to-br text-white",
              activeAgent.accent,
            )}
          >
            <Icon name={activeAgent.icon} className="size-2.5" />
          </span>
          {activeAgent.name}
        </span>
      </div>

      {/* LLM provider chip */}
      <div className="hidden items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1.5 text-xs font-medium sm:flex">
        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_var(--gb-glow)]" />
        AI
      </div>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => {
          setTheme(theme === "dark" ? "light" : "dark");
        }}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground gb-transition-view hover:bg-accent hover:text-foreground"
        aria-label="Toggle theme"
      >
        <Sun className="hidden size-4 dark:block" />
        <Moon className="size-4 dark:hidden" />
      </button>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-2 gb-transition-view hover:bg-accent/60"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-semibold text-white">
            {initials}
          </div>
          <span className="hidden max-w-[7rem] truncate text-xs font-medium sm:inline">
            {authUser?.name || "User"}
          </span>
          <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", menuOpen && "rotate-180")} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-11 z-50 w-60 origin-top-right overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-xl"
          >
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{authUser?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{authUser?.email}</p>
              </div>
            </div>
            <div className="my-1 h-px bg-border" />
            <MenuItem
              icon={<Brain className="size-4" />}
              label="Your memory"
              onClick={() => {
                setMenuOpen(false);
                setView("memory");
              }}
            />
            <MenuItem
              icon={<UserIcon className="size-4" />}
              label="User guide"
              onClick={() => {
                setMenuOpen(false);
                setView("guide");
              }}
            />
            <MenuItem
              icon={<Info className="size-4" />}
              label="About"
              onClick={() => {
                setMenuOpen(false);
                setRoute("about");
              }}
            />
            <MenuItem
              icon={<Settings className="size-4" />}
              label="Settings"
              onClick={() => {
                setMenuOpen(false);
                setView("settings");
              }}
            />
            <div className="my-1 h-px bg-border" />
            <MenuItem
              icon={<LogOut className="size-4" />}
              label="Sign out"
              onClick={handleSignOut}
              danger
            />
          </div>
        )}
      </div>
    </header>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium gb-transition-view",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
