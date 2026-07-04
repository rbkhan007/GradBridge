"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Key,
  Trash2,
  Check,
  Loader2,
  AlertTriangle,
  Info,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useGradBridge } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GradientMesh, LogoMark, DesignerCredit } from "./art";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [messageUsage, setMessageUsage] = useState<{ used: number; limit: number; hasKey: boolean } | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [keyRes, usageRes] = await Promise.all([
          fetch("/api/user/api-key"),
          fetch("/api/user/message-usage"),
        ]);
        if (cancelled) return;
        const keyData = await keyRes.json() as { hasKey: boolean; apiKey?: string };
        const usageData = await usageRes.json() as { used: number; limit: number; hasKey: boolean };
        if (!cancelled) {
          setHasKey(keyData.hasKey);
          setApiKey(keyData.apiKey ?? "");
          setMessageUsage(usageData);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const saveKey = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "Save failed");
      setHasKey(!!apiKey.trim());
      toast.success(apiKey.trim() ? "API key saved" : "API key removed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to save API key", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const clearChats = async () => {
    if (!confirm("Delete all conversations? This cannot be undone.")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/chat/clear", { method: "POST" });
      const data = await res.json() as { success?: boolean; deleted?: number; error?: string };
      if (!data.success) throw new Error(data.error ?? "Clear failed");
      toast.success(`Deleted ${data.deleted} conversation${data.deleted === 1 ? "" : "s"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to clear chats", { description: msg });
    } finally {
      setClearing(false);
    }
  };

  const dailyLimit = messageUsage?.limit ?? 5;
  const dailyUsed = messageUsage?.used ?? 0;
  const hasOwnKey = messageUsage?.hasKey ?? false;
  const remaining = hasOwnKey ? 999 : dailyLimit - dailyUsed;
  const remainingDisplay = hasOwnKey ? "Unlimited" : String(Math.max(0, remaining));

  return (
    <div className="gb-scroll h-full overflow-y-auto">
      <div className="relative mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <GradientMesh className="absolute inset-x-0 top-0 -z-10 h-[28rem] opacity-20" />
        <header className="mb-6">
          <div className="flex items-center gap-2">
            <LogoMark className="size-10" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Settings
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your API keys, usage limits, and data.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading settings…
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-4"
          >
            {/* API Key Section */}
            <div className="gb-glass-strong gb-border-anim relative overflow-hidden rounded-2xl border border-border/60 p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                  <Key className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">API Key</h2>
                  <p className="text-sm text-muted-foreground">
                    Add your own OpenRouter API key for unlimited usage.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="font-mono text-sm"
                  type="password"
                />
                <Button
                  type="button"
                  onClick={() => void saveKey()}
                  disabled={saving}
                  className="gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90 shrink-0"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {saving ? "Saving…" : hasKey ? "Update" : "Save"}
                </Button>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="size-3.5" />
                <span>
                  {hasOwnKey
                    ? "You have a custom API key — no daily limits."
                    : "No custom key set. You get 5 free messages per day using the shared key."}
                </span>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Get a key
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            {/* Message Usage Section */}
            <div className="gb-glass-strong gb-border-anim relative overflow-hidden rounded-2xl border border-border/60 p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
                  <MessageSquare className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Daily Usage</h2>
                  <p className="text-sm text-muted-foreground">
                    {hasOwnKey
                      ? "Unlimited — you are using your own API key."
                      : "Free tier: 5 messages per day using the shared key."}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Today</span>
                  <span className="font-medium">
                    {hasOwnKey ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 1 1-6-4Z"/></svg>
                        Unlimited
                      </span>
                    ) : (
                      <span className={cn(dailyUsed >= dailyLimit ? "text-rose-400" : "text-emerald-400")}>
                        {dailyUsed} / {dailyLimit}
                      </span>
                    )}
                  </span>
                </div>
                {!hasOwnKey && (
                  <>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          dailyUsed >= dailyLimit
                            ? "bg-rose-500"
                            : dailyUsed >= 3
                              ? "bg-amber-500"
                              : "bg-emerald-500",
                        )}
                        style={{ width: `${Math.min((dailyUsed / dailyLimit) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {remaining > 0
                        ? `${remainingDisplay} message${remaining === 1 ? "" : "s"} remaining today`
                        : "Limit reached. Add your own API key above for unlimited usage."}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-sm">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-rose-400">Danger Zone</h2>
                  <p className="text-sm text-muted-foreground">
                    Irreversible actions for your account.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border bg-card/40 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Delete all conversations</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently remove all your chat history. This cannot be undone.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => void clearChats()}
                  disabled={clearing}
                  className="gap-1.5 shrink-0"
                >
                  {clearing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  {clearing ? "Deleting…" : "Delete all"}
                </Button>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 text-center">
              <DesignerCredit />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
