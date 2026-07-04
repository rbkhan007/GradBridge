"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useGradBridge } from "@/lib/store";
import type { UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LogoMark, GradientMesh } from "./art";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EXPERIENCE_LEVELS = [
  "Student",
  "Entry-level / Fresh Graduate",
  "Junior (1-2 yrs)",
  "Mid-level",
];

const EMPTY_PROFILE: UserProfile = {
  id: "me",
  name: "",
  university: "",
  major: "",
  graduationYear: new Date().getFullYear(),
  targetRole: "",
  experienceLevel: "Entry-level / Fresh Graduate",
  skills: [],
  goals: [],
};

export function MemoryView() {
  const { profile, setProfile } = useGradBridge();
  const [form, setForm] = useState<UserProfile>(() => profile ?? EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load profile from the API (refreshes even if the store already has one).
  // All setState calls live inside the async run() body.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const r = await fetch("/api/memory");
        const d = (await r.json()) as { profile: UserProfile };
        if (cancelled) return;
        setForm(d.profile ?? EMPTY_PROFILE);
        setProfile(d.profile ?? null);
        setLoaded(true);
      } catch {
        if (cancelled) return;
        toast.error("Failed to load profile");
        setLoaded(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [setProfile]);

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Save failed (${res.status})`);
      }
      const data = (await res.json()) as { profile: UserProfile };
      setForm(data.profile);
      setProfile(data.profile);
      toast.success("Profile saved", {
        description: "GradBridge will personalize responses using this memory.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Save failed", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gb-scroll h-full overflow-y-auto">
      <div className="relative mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <GradientMesh className="absolute inset-x-0 top-0 -z-10 h-[28rem] opacity-20" />
        <header className="mb-5">
          <div className="flex items-center gap-2">
            <LogoMark className="size-10" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Your <span className="gb-text-gradient-anim">Profile</span>
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            GradBridge personalizes every response using this persistent memory.
            Keep it current — the agents read it before each turn.
          </p>
        </header>

        {!loaded ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading profile…
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-4"
          >
            <Card className="gb-glass-strong gb-border-anim gap-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  Identity
                </CardTitle>
                <CardDescription>
                  Who you are and where you are in your journey.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Name">
                    <Input
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      placeholder="e.g. Alex Chen"
                    />
                  </Field>
                  <Field label="University">
                    <Input
                      value={form.university}
                      onChange={(e) => update("university", e.target.value)}
                      placeholder="e.g. Tsinghua University"
                    />
                  </Field>
                  <Field label="Major">
                    <Input
                      value={form.major}
                      onChange={(e) => update("major", e.target.value)}
                      placeholder="e.g. Software Engineering"
                    />
                  </Field>
                  <Field label="Graduation year">
                    <Input
                      type="number"
                      value={form.graduationYear}
                      min={1980}
                      max={2100}
                      onChange={(e) =>
                        update("graduationYear", Number(e.target.value) || new Date().getFullYear())
                      }
                    />
                  </Field>
                  <Field label="Target role">
                    <Input
                      value={form.targetRole}
                      onChange={(e) => update("targetRole", e.target.value)}
                      placeholder="e.g. Backend Engineer"
                    />
                  </Field>
                  <Field label="Experience level">
                    <Select
                      value={form.experienceLevel}
                      onValueChange={(v) => update("experienceLevel", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPERIENCE_LEVELS.map((lvl) => (
                          <SelectItem key={lvl} value={lvl}>
                            {lvl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </CardContent>
            </Card>

            <Card className="gb-glass-strong mt-4 gap-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Skills</CardTitle>
                <CardDescription>
                  Press Enter to add a skill. These shape code-review &amp; roadmap advice.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SkillsEditor
                  skills={form.skills}
                  onChange={(skills) => update("skills", skills)}
                />
              </CardContent>
            </Card>

            <Card className="gb-glass-strong mt-4 gap-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Goals</CardTitle>
                <CardDescription>
                  What you are working toward. The career mentor references these directly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GoalsEditor
                  goals={form.goals}
                  onChange={(goals) => update("goals", goals)}
                />
              </CardContent>
            </Card>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="gb-glow-cta gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SkillsEditor({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (skills.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...skills, v]);
    setDraft("");
  };

  const remove = (s: string) => {
    onChange(skills.filter((x) => x !== s));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. TypeScript, React, PostgreSQL"
        />
        <Button
          type="button"
          size="icon"
          onClick={add}
          aria-label="Add skill"
          className="focus-visible:shadow-[0_0_0_1px_var(--ring),0_0_24px_-4px_var(--gb-glow)]"
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {skills.length === 0 ? (
        <p className="text-xs text-muted-foreground">No skills added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <Badge
              key={s}
              variant="secondary"
              className="gap-1 bg-emerald-500/10 py-1 text-emerald-400"
            >
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                className="focus-visible:shadow-[0_0_0_1px_var(--ring),0_0_24px_-4px_var(--gb-glow)] ml-0.5 rounded-sm hover:bg-emerald-500/20"
                aria-label={`Remove ${s}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalsEditor({
  goals,
  onChange,
}: {
  goals: string[];
  onChange: (goals: string[]) => void;
}) {
  const updateAt = (i: number, value: string) => {
    onChange(goals.map((g, idx) => (idx === i ? value : g)));
  };
  const removeAt = (i: number) => {
    onChange(goals.filter((_, idx) => idx !== i));
  };
  const add = () => {
    onChange([...goals, ""]);
  };

  return (
    <div className="flex flex-col gap-2">
      {goals.length === 0 && (
        <p className="text-xs text-muted-foreground">No goals yet. Add your first one.</p>
      )}
      {goals.map((g, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={cn("font-mono text-xs text-muted-foreground")}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <Input
            value={g}
            onChange={(e) => updateAt(i, e.target.value)}
                    placeholder="e.g. Land a backend role"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => removeAt(i)}
            aria-label="Remove goal"
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-fit gap-1.5"
      >
        <Plus className="size-3.5" />
        Add goal
      </Button>
    </div>
  );
}
