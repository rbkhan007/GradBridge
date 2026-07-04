"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useGradBridge } from "@/lib/store";
import type { AuthUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LogoMark, GradientMesh, FloatingChips, DesignerCredit } from "./art";

type Mode = "login" | "register";

export function AuthView({ initialMode }: { initialMode: Mode }) {
  const { setRoute, setAuthUser, setView } = useGradBridge();
  const [mode, setMode] = useState<Mode>(initialMode);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRoute(m); // keep route in sync so refresh keeps you on the same screen
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Backdrops */}
      <div className="gb-grid-bg gb-mask-fade pointer-events-none fixed inset-0 -z-20" aria-hidden />
      <GradientMesh className="fixed inset-0 -z-10 opacity-50" />
      <FloatingChips className="opacity-40" />

      <button
        type="button"
        onClick={() => setRoute("landing")}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="gb-glass-strong gb-border-anim relative w-full max-w-md rounded-2xl border border-border/60 p-6 shadow-2xl shadow-primary/5 sm:p-8"
      >
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <h1 className="mt-4 text-xl font-bold tracking-tight">
            {mode === "register" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "register"
              ? "Start shipping with an autonomous agent by your side."
              : "Sign in to your GradBridge workspace."}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium gb-transition-view",
              mode === "login"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium gb-transition-view",
              mode === "register"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Register
          </button>
        </div>

        {/* Form */}
        {mode === "register" ? (
          <RegisterForm
            onSuccess={(user) => {
              setAuthUser(user);
              setView("chat");
              setRoute("app");
              toast.success(`Welcome, ${user.name}!`, {
                description: "Your GradBridge workspace is ready.",
              });
            }}
            onSwitchToLogin={() => switchMode("login")}
          />
        ) : (
          <LoginForm
            onSuccess={(user) => {
              setAuthUser(user);
              setView("chat");
              setRoute("app");
              toast.success(`Welcome back, ${user.name}!`);
            }}
            onSwitchToRegister={() => switchMode("register")}
          />
        )}
      </motion.div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 py-3 text-center">
        <DesignerCredit />
      </div>
    </div>
  );
}

function Field({
  icon,
  ...props
}: { icon: "user" | "mail" | "lock" } & React.InputHTMLAttributes<HTMLInputElement>) {
  const IconCmp =
    icon === "user" ? User : icon === "mail" ? Mail : Lock;
  return (
    <div className="relative">
      <IconCmp className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="h-11 pl-9" {...props} />
    </div>
  );
}

function LoginForm({
  onSuccess,
  onSwitchToRegister,
}: {
  onSuccess: (u: AuthUser) => void;
  onSwitchToRegister: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Login failed.");
        return;
      }
      onSuccess(data.user);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
      <Field
        icon="mail"
        type="email"
        autoComplete="email"
        placeholder="you@university.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
      />
      <div className="relative">
        <Field
          icon="lock"
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          tabIndex={-1}
          aria-label={showPw ? "Hide password" : "Show password"}
        >
          {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || !email || !password}
        className="gb-glow-cta mt-1 h-11 gap-2 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowRight className="size-4" />
        )}
        {loading ? "Signing in…" : "Sign in"}
      </Button>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        No account yet?{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Create one
        </button>
      </p>
    </form>
  );
}

function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: (u: AuthUser) => void;
  onSwitchToLogin: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwStrength = passwordStrength(password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      onSuccess(data.user);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
      <Field
        icon="user"
        type="text"
        autoComplete="name"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={loading}
        maxLength={80}
      />
      <Field
        icon="mail"
        type="email"
        autoComplete="email"
        placeholder="you@university.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
      />
      <div className="relative">
        <Field
          icon="lock"
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          minLength={8}
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          tabIndex={-1}
          aria-label={showPw ? "Hide password" : "Show password"}
        >
          {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {password.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pwStrength.color,
              )}
              style={{ width: `${pwStrength.pct}%` }}
            />
          </div>
          <span className="w-16 text-right text-[0.65rem] text-muted-foreground">
            {pwStrength.label}
          </span>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-1 text-[0.7rem] text-muted-foreground">
        <Requirement met={name.trim().length >= 1}>Full name</Requirement>
        <Requirement met={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}>
          Valid email
        </Requirement>
        <Requirement met={password.length >= 8}>Min 8 characters</Requirement>
      </ul>

      <Button
        type="submit"
        disabled={loading || !name || !email || password.length < 8}
        className="gb-glow-cta mt-1 h-11 gap-2 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UserPlus className="size-4" />
        )}
        {loading ? "Creating account…" : "Create account"}
      </Button>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Check
        className={cn(
          "size-3",
          met ? "text-emerald-500" : "text-muted-foreground/40",
        )}
      />
      <span className={met ? "text-foreground" : ""}>{children}</span>
    </li>
  );
}

function passwordStrength(pw: string): {
  pct: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { pct: 20, label: "Weak", color: "bg-rose-500" },
    { pct: 40, label: "Fair", color: "bg-amber-500" },
    { pct: 60, label: "Good", color: "bg-yellow-500" },
    { pct: 80, label: "Strong", color: "bg-emerald-500" },
    { pct: 100, label: "Excellent", color: "bg-emerald-400" },
  ];
  return map[Math.min(score, 5) - 1] ?? map[0];
}
