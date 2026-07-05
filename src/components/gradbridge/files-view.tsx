"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Check,
  GitBranch,
  GitCommitHorizontal,
  Hammer,
  Loader2,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useGradBridge } from "@/lib/store";
import type { DiffResponse, ProjectFile } from "@/lib/types";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const STATUS_COLORS: Record<ProjectFile["status"], string> = {
  clean: "bg-emerald-400",
  modified: "bg-amber-400",
  added: "bg-cyan-400",
  untracked: "bg-muted-foreground",
};

const STATUS_LABELS: Record<ProjectFile["status"], string> = {
  clean: "clean",
  modified: "modified",
  added: "added",
  untracked: "untracked",
};

/** Map a stored language to a Prism language that refractor definitely knows. */
function hlLanguage(lang: string): string {
  const l = lang.toLowerCase();
  if (l === "prisma") return "typescript";
  if (l === "sh" || l === "shell") return "bash";
  if (l === "yml") return "yaml";
  return l || "text";
}

function fileIconName(file: ProjectFile): string {
  if (file.language === "json") return "FileJson";
  if (file.language === "markdown" || file.path.endsWith(".md")) return "FileText";
  return "FileCode2";
}

export function FilesView() {
  const { files, activeFilePath, setActiveFilePath, setFiles } = useGradBridge();
  const [query, setQuery] = useState("");
  const [commitOpen, setCommitOpen] = useState(false);
  const isMobile = useIsMobile();

  const refreshFiles = useCallback(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data: { files: ProjectFile[] }) => {
        if (data.files) setFiles(data.files);
      })
      .catch(() => toast.error("Failed to refresh files"));
  }, [setFiles]);

  const modifiedCount = files.filter(
    (f) => f.status === "modified" || f.status === "added",
  ).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, query]);

  // Group by top-level folder.
  const grouped = useMemo(() => {
    const map = new Map<string, ProjectFile[]>();
    for (const f of filtered) {
      const folder = f.path.includes("/") ? f.path.split("/")[0] : "root";
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // Derive the effective active file: stored path if it matches, else the first file.
  const activeFile =
    files.find((f) => f.path === activeFilePath) ?? files[0] ?? null;

  const tree = (
    <FileTree
      grouped={grouped}
      activeFilePath={activeFile?.path ?? null}
      onSelect={setActiveFilePath}
      query={query}
      setQuery={setQuery}
      modifiedCount={modifiedCount}
      onCommit={() => setCommitOpen(true)}
    />
  );

  const viewer = <FileViewer file={activeFile} />;

  if (isMobile) {
    return (
      <div className="gb-scroll flex h-full flex-col overflow-y-auto">
        <div className="border-b border-border">{tree}</div>
        <div className="min-h-[60vh] flex-1">{viewer}</div>
        <CommitDialog
          open={commitOpen}
          onOpenChange={setCommitOpen}
          modifiedCount={modifiedCount}
          onCommitted={refreshFiles}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={28} minSize={20} maxSize={45}>
          {tree}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={72}>{viewer}</ResizablePanel>
      </ResizablePanelGroup>
      <CommitDialog
        open={commitOpen}
        onOpenChange={setCommitOpen}
        modifiedCount={modifiedCount}
        onCommitted={refreshFiles}
      />
    </div>
  );
}

function FileTree({
  grouped,
  activeFilePath,
  onSelect,
  query,
  setQuery,
  modifiedCount,
  onCommit,
}: {
  grouped: Array<[string, ProjectFile[]]>;
  activeFilePath: string | null;
  onSelect: (path: string) => void;
  query: string;
  setQuery: (v: string) => void;
  modifiedCount: number;
  onCommit: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar/30">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files by path…"
            className="h-9 pl-8"
          />
        </div>
      </div>
      <div className="gb-scroll flex-1 overflow-y-auto p-2">
        {grouped.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No files match.
          </p>
        ) : (
          grouped.map(([folder, items]) => (
            <div key={folder} className="mb-2">
              <p className="px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                {folder}/
              </p>
              <div className="flex flex-col gap-0.5">
                {items.map((f) => {
                  const name = f.path.includes("/")
                    ? f.path.split("/").slice(1).join("/")
                    : f.path;
                  const active = f.path === activeFilePath;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onSelect(f.path)}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm gb-transition-view",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                      )}
                    >
                      <Icon
                        name={fileIconName(f)}
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">
                        {name}
                      </span>
                      <span
                        className={cn("size-2 shrink-0 rounded-full", STATUS_COLORS[f.status])}
                        title={STATUS_LABELS[f.status]}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      {/* Git status bar */}
      <div className="border-t border-border p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="size-3.5" />
            <span>
              {modifiedCount > 0
                ? `${modifiedCount} modified`
                : "working tree clean"}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant={modifiedCount > 0 ? "default" : "outline"}
            disabled={modifiedCount === 0}
            onClick={onCommit}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <GitCommitHorizontal className="size-3.5" />
            Commit
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileViewer({ file }: { file: ProjectFile | null }) {
  const [diffOpen, setDiffOpen] = useState(false);

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a file from the tree.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate font-mono text-xs text-foreground">{file.path}</span>
          <Badge variant="secondary" className="font-mono text-[0.65rem]">
            {file.language}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 text-[0.65rem]"
          >
            <span className={cn("size-1.5 rounded-full", STATUS_COLORS[file.status])} />
            {STATUS_LABELS[file.status]}
          </Badge>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setDiffOpen(true)}
          className="gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
        >
          <Hammer className="size-3.5" />
          Edit with AI
        </Button>
      </div>
      <div className="gb-scroll min-h-0 flex-1 overflow-auto bg-[#282c34]">
        <SyntaxHighlighter
          language={hlLanguage(file.language)}
          style={oneDark}
          showLineNumbers
          customStyle={{
            margin: 0,
            background: "transparent",
            minHeight: "100%",
            fontSize: "0.78rem",
            padding: "1rem",
          }}
          codeTagProps={{ style: { fontFamily: "var(--font-geist-mono)" } }}
          wrapLongLines={false}
        >
          {file.content}
        </SyntaxHighlighter>
      </div>

      <DiffDialog
        open={diffOpen}
        onOpenChange={setDiffOpen}
        file={file}
      />
    </div>
  );
}

function DiffDialog({
  open,
  onOpenChange,
  file,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: ProjectFile;
}) {
  const { pendingDiff, setPendingDiff, setFiles } = useGradBridge();
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  // Reset local state when dialog opens for a fresh file.
  useEffect(() => {
    if (open) {
      setInstruction("");
      setPendingDiff(null);
    }
  }, [open, setPendingDiff]);

  const generate = async () => {
    const text = instruction.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/files/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: file.path, instruction: text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(body.error || body.detail || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as DiffResponse;
      setPendingDiff(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Diff generation failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!pendingDiff || applying) return;
    setApplying(true);
    try {
      const res = await fetch("/api/files/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: pendingDiff.filePath,
          content: pendingDiff.proposed,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Apply failed (${res.status})`);
      }
      const data = (await res.json()) as { file: ProjectFile };
      // Replace the file in the store.
      setFiles(
        useGradBridge
          .getState()
          .files.map((f) => (f.path === data.file.path ? data.file : f)),
      );
      toast.success("File updated", {
        description: `${data.file.path} · marked as modified`,
      });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Apply failed", { description: msg });
    } finally {
      setApplying(false);
    }
  };

  const reject = () => {
    setPendingDiff(null);
    onOpenChange(false);
  };

  const counts = useMemo(() => {
    if (!pendingDiff) return { added: 0, removed: 0 };
    const lines = pendingDiff.diff.split("\n");
    let added = 0;
    let removed = 0;
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) added++;
      else if (line.startsWith("-") && !line.startsWith("---")) removed++;
    }
    return { added, removed };
  }, [pendingDiff]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="size-4 text-primary" />
            Edit with AI
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {file.path}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Instruction
          </label>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Add JSDoc comments and extract the validation into a helper function"
            className="min-h-[80px] resize-none"
            disabled={loading || !!pendingDiff}
          />
          {!pendingDiff && (
            <Button
              type="button"
              size="sm"
              onClick={() => void generate()}
              disabled={!instruction.trim() || loading}
              className="w-fit gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Hammer className="size-3.5" />
              )}
              {loading ? "Generating…" : "Generate diff"}
            </Button>
          )}
        </div>

        {pendingDiff && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{pendingDiff.summary}</p>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <Plus className="size-3" />
                  {counts.added}
                </span>
                <span className="inline-flex items-center gap-1 text-rose-400">
                  <Minus className="size-3" />
                  {counts.removed}
                </span>
              </div>
            </div>
            <div className="gb-scroll max-h-[320px] overflow-auto rounded-md border border-border bg-[#1a1d23] p-3">
              <pre className="font-mono text-xs leading-relaxed">
                {pendingDiff.diff.split("\n").map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "px-1",
                      line.startsWith("@@") && "bg-muted/40 text-muted-foreground",
                      line.startsWith("+") &&
                        !line.startsWith("+++") &&
                        "bg-emerald-500/10 text-emerald-400",
                      line.startsWith("-") &&
                        !line.startsWith("---") &&
                        "bg-rose-500/10 text-rose-400",
                    )}
                  >
                    <span className="select-none">{line || " "}</span>
                  </div>
                ))}
              </pre>
            </div>
          </motion.div>
        )}

        <DialogFooter className="gap-2">
          {pendingDiff ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={reject}
                className="gap-1.5"
                disabled={applying}
              >
                <X className="size-3.5" />
                Reject
              </Button>
              <Button
                type="button"
                onClick={() => void approve()}
                disabled={applying}
                className="gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
              >
                {applying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {applying ? "Applying…" : "Approve & apply"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Commit dialog — snapshots modified files into a commit + resets statuses. */
function CommitDialog({
  open,
  onOpenChange,
  modifiedCount,
  onCommitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modifiedCount: number;
  onCommitted: () => void;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset the message when the dialog opens.
  useEffect(() => {
    if (open) setMessage("");
  }, [open]);

  const submit = async () => {
    if (loading || modifiedCount === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/files/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() || "Save work" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Commit failed (${res.status})`);
      }
      const data = (await res.json()) as {
        commit: { id: string; message: string; filesCount: number };
      };
      toast.success("Committed", {
        description: `${data.commit.filesCount} file${data.commit.filesCount === 1 ? "" : "s"} · ${data.commit.message}`,
      });
      onCommitted();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Commit failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommitHorizontal className="size-4 text-primary" />
            Commit changes
          </DialogTitle>
          <DialogDescription>
            Snapshot {modifiedCount} modified file{modifiedCount === 1 ? "" : "s"} into a
            commit. File statuses will reset to clean.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Commit message
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Add JWT refresh token rotation"
            className="min-h-[60px] resize-none"
            disabled={loading}
            maxLength={200}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <p className="text-[0.65rem] text-muted-foreground">
            ⌘+Enter to commit
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={loading || modifiedCount === 0}
            className="gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <GitCommitHorizontal className="size-3.5" />
            )}
            {loading ? "Committing…" : `Commit ${modifiedCount} file${modifiedCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
