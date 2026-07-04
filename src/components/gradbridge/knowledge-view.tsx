"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type { KnowledgeEntry } from "@/lib/types";
import { Markdown } from "./markdown";
import { cn } from "@/lib/utils";
import { GradientMesh } from "./art";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type CategoryFilter = "all" | KnowledgeEntry["category"];

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "roadmap", label: "Roadmap" },
  { value: "interview", label: "Interview" },
  { value: "best-practice", label: "Best-practice" },
  { value: "system-design", label: "System-design" },
  { value: "career", label: "Career" },
];

const CATEGORY_COLORS: Record<KnowledgeEntry["category"], string> = {
  roadmap: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  interview: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "best-practice": "bg-teal-500/15 text-teal-400 border-teal-500/30",
  "system-design": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  career: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export function KnowledgeView() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Debounced search query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch (initial + on debounced query change). setState calls live inside the
  // async run() body, never synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const url = debounced
          ? `/api/knowledge?q=${encodeURIComponent(debounced)}`
          : "/api/knowledge";
        const r = await fetch(url);
        const d = (await r.json()) as { entries: KnowledgeEntry[] };
        if (!cancelled) setEntries(d.entries ?? []);
      } catch {
        if (!cancelled) toast.error(debounced ? "Search failed" : "Failed to load knowledge base");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const filtered = useMemo(() => {
    if (category === "all") return entries;
    return entries.filter((e) => e.category === category);
  }, [entries, category]);

  return (
    <div className="gb-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="relative mb-5">
          <GradientMesh className="absolute inset-0 -z-10 opacity-20" />
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Knowledge Base
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Curated roadmaps, interview prep &amp; best practices — the RAG corpus that
            personalizes every GradBridge response.
          </p>
        </header>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roadmaps, tips, system design…"
              className="pl-8"
            />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium gb-transition-view",
                  active
                    ? "gb-glow-ring border-transparent bg-primary/15 text-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading knowledge…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No entries found. Try a different search or category.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: 0.025 * i }}
              >
                <KnowledgeCard entry={entry} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeCard({ entry }: { entry: KnowledgeEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="gb-glass group h-full gap-0 p-0 gb-transition-hover hover:-translate-y-0.5">
      <CardHeader className="gap-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-snug">{entry.title}</CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 border text-[0.6rem] capitalize",
              CATEGORY_COLORS[entry.category],
            )}
          >
            {entry.category.replace("-", " ")}
          </Badge>
        </div>
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-muted px-1.5 py-0.5 text-[0.6rem] text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="pb-3">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground gb-transition-view hover:bg-accent/50 hover:text-foreground"
            >
              <span>{open ? "Hide" : "Read"}</span>
              {open ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="gb-scroll mt-2 max-h-80 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
                <Markdown>{entry.content}</Markdown>
              </div>
              {entry.source && (
                <p className="mt-1.5 text-[0.65rem] text-muted-foreground">
                  Source: {entry.source}
                </p>
              )}
            </motion.div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
