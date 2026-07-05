"use client";

import { AuthView } from "@neondatabase/auth-ui";
import { useGradBridge } from "@/lib/store";
import { GradientMesh, FloatingChips, DesignerCredit, LogoMark } from "./art";

type Mode = "login" | "register";

export function AuthViewPage({ initialMode }: { initialMode: Mode }) {
  const { setRoute } = useGradBridge();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="gb-grid-bg gb-mask-fade pointer-events-none fixed inset-0 -z-20" aria-hidden />
      <GradientMesh className="fixed inset-0 -z-10 opacity-50" />
      <FloatingChips className="opacity-40" />

      <button
        type="button"
        onClick={() => setRoute("landing")}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:left-6 sm:top-6"
      >
        Back
      </button>

      <div className="gb-glass-strong gb-border-anim relative w-full max-w-md rounded-2xl border border-border/60 p-6 shadow-2xl shadow-primary/5 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <h1 className="mt-4 text-xl font-bold tracking-tight">
            {initialMode === "register" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {initialMode === "register"
              ? "Start shipping with an autonomous agent by your side."
              : "Sign in to your GradBridge workspace."}
          </p>
        </div>

        <div className="mt-6">
          <AuthView
            path={initialMode === "register" ? "sign-up" : "sign-in"}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 py-3 text-center">
        <DesignerCredit />
      </div>
    </div>
  );
}
