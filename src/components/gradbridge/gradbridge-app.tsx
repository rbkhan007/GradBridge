"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, Heart, Rocket } from "lucide-react";
import { useGradBridge } from "@/lib/store";
import type { AuthUser, ProjectFile, UserProfile } from "@/lib/types";
import { TopBar } from "./topbar";
import { Sidebar } from "./sidebar";
import { ChatView } from "./chat-view";
import { AgentsView } from "./agents-view";
import { FilesView } from "./files-view";
import { KnowledgeView } from "./knowledge-view";
import { MemoryView } from "./memory-view";
import { GuideView } from "./guide-view";
import { SettingsView } from "./settings-view";
import { LandingView } from "./landing-view";
import { AuthView } from "./auth-view";
import { AboutView } from "./about-view";
import { DesignerCredit } from "./art";

export function GradBridgeApp() {
  const {
    authReady,
    authUser,
    route,
    view,
    setAuthUser,
    setAuthReady,
    setRoute,
    setView,
    setFiles,
    setProfile,
    clearChat,
  } = useGradBridge();

  // Bootstrap: resolve the session from the httpOnly cookie on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { user: AuthUser };
          setAuthUser(data.user);
          setRoute("app");
        } else {
          setAuthUser(null);
          setRoute("landing");
        }
      } catch {
        if (cancelled) return;
        setAuthUser(null);
        setRoute("landing");
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setAuthUser, setAuthReady, setRoute]);

  // When authenticated, load the dashboard data (files + profile) in parallel.
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/files").then((r) => r.json()) as Promise<{ files: ProjectFile[] }>,
      fetch("/api/memory").then((r) => r.json()) as Promise<{ profile: UserProfile }>,
    ])
      .then(([filesRes, memoryRes]) => {
        if (cancelled) return;
        if (filesRes.files) setFiles(filesRes.files);
        if (memoryRes.profile) setProfile(memoryRes.profile);
      })
      .catch(() => {
        // Non-fatal — views degrade gracefully with empty store.
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, setFiles, setProfile]);

  // --- Splash while resolving the session ---
  if (!authReady) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="gb-grid-bg pointer-events-none fixed inset-0 -z-10" aria-hidden />
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="relative">
            <span className="gb-thinking-dot size-2.5 rounded-full bg-primary" />
            <span
              className="gb-thinking-dot absolute left-4 top-0 size-2.5 rounded-full bg-primary"
              style={{ animationDelay: "200ms" }}
            />
            <span
              className="gb-thinking-dot absolute left-8 top-0 size-2.5 rounded-full bg-primary"
              style={{ animationDelay: "400ms" }}
            />
          </div>
          <span className="text-xs tracking-wide">Loading GradBridge…</span>
        </div>
      </div>
    );
  }

  // --- Not authenticated: public routes (landing / login / register / guide) ---
  if (!authUser) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={route}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {route === "login" && <AuthView initialMode="login" />}
          {route === "register" && <AuthView initialMode="register" />}
          {route === "guide" && <GuideView isPublic />}
          {route === "about" && <AboutView />}
          {(route === "landing" || route === "app") && <LandingView />}
        </motion.div>
      </AnimatePresence>
    );
  }

  // --- Authenticated: the dashboard shell ---
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Dotted-grid backdrop */}
      <div className="gb-grid-bg pointer-events-none fixed inset-0 -z-10" aria-hidden />

      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="h-full"
            >
              {view === "chat" && <ChatView />}
              {view === "agents" && <AgentsView />}
              {view === "files" && <FilesView />}
              {view === "knowledge" && <KnowledgeView />}
              {view === "memory" && <MemoryView />}
              {view === "guide" && <GuideView />}
              {view === "settings" && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  const { setView } = useGradBridge();
  return (
    <footer className="mt-auto border-t border-border bg-background/60 px-4 py-2.5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-1.5">
          <GraduationCap className="size-3.5 text-primary" />
          <span>
            GradBridge — from graduation to shipped{" "}
            <Rocket className="inline size-3 text-primary" />
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setView("guide")}
            className="transition-colors hover:text-foreground"
          >
            User guide
          </button>
          <span className="text-muted-foreground/50">·</span>
          <span>Built for fresh CS graduates</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="flex items-center gap-1">
            made with <Heart className="inline size-3 text-rose-400" /> for fresh CS graduates
          </span>
        </div>
      </div>
      <div className="mt-1.5 border-t border-border/40 pt-1.5 text-center">
        <DesignerCredit />
      </div>
    </footer>
  );
}
