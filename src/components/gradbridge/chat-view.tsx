"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useGradBridge } from "@/lib/store";
import { AGENTS, MODE_META } from "@/lib/agents";
import type { AgentId, AgentMode, ChatMessage } from "@/lib/types";
import { Icon } from "./icon";
import { ModeSelector } from "./mode-selector";
import { MessageBubble } from "./message-bubble";
import { GradientMesh, BridgeCodeArt } from "./art";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Example {
  label: string;
  prompt: string;
  mode: AgentMode;
}

const EXAMPLES: Example[] = [
  {
    label: "Plan",
    prompt: "Plan: Implement OAuth2 login for the app",
    mode: "plan",
  },
  {
    label: "Debug",
    prompt: "Debug: I'm getting a 401 on /api/jobs after login — help me find the root cause",
    mode: "debug",
  },
  {
    label: "Career",
    prompt: "Career: Give me a backend engineer roadmap for fresh graduates",
    mode: "career",
  },
  {
    label: "Optimize",
    prompt: "Optimize: this SQL query is slow on a 1M-row table",
    mode: "optimize",
  },
  {
    label: "Build",
    prompt: "Build: add cursor-based pagination to /api/jobs",
    mode: "build",
  },
  {
    label: "Review",
    prompt: "Review: audit my auth route for security issues",
    mode: "chat",
  },
];

export function ChatView() {
  const {
    messages,
    isThinking,
    mode,
    agentId,
    conversationId,
    activeFilePath,
    lastRag,
    addMessage,
    setMessages,
    setThinking,
    setLastRag,
    setConversation,
    setMode,
    setAgentId,
    setView,
  } = useGradBridge();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeAgent = agentId ? AGENTS[agentId] : AGENTS[MODE_META[mode].defaultAgent];
  const streamCancelledRef = useRef(false);

  // Auto-scroll to bottom on new messages / thinking state.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, isThinking]);

  // Cancel any active stream on unmount.
  useEffect(() => {
    return () => {
      streamCancelledRef.current = true;
    };
  }, []);

  const send = useCallback(async (raw: string, overrideMode?: AgentMode, overrideAgentId?: AgentId) => {
    const text = raw.trim();
    if (!text || isThinking) return;

    const effectiveMode = overrideMode ?? mode;
    const effectiveAgentId = overrideAgentId !== undefined ? overrideAgentId : agentId;

    const tempId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userMsg: ChatMessage = {
      id: tempId,
      role: "user",
      content: text,
      agentMode: effectiveMode,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput("");
    setThinking(true);

    // Create a placeholder assistant message that we'll stream into.
    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      agentMode: effectiveMode,
      agentId: effectiveAgentId ?? undefined,
      createdAt: new Date().toISOString(),
    });

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          mode: effectiveMode,
          agentId: effectiveAgentId,
          conversationId,
          context: { activeFilePath: activeFilePath ?? undefined },
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Stream failed (${res.status})`);
      }

      // Parse SSE stream.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedContent = "";

      while (true) {
        if (streamCancelledRef.current) {
          reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const eventBlock = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of eventBlock.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const evt = JSON.parse(data) as {
                type: "meta" | "delta" | "done" | "error";
                content?: string;
                conversationId?: string;
                ragResults?: ChatViewRagResult[];
                agentId?: string;
                agentName?: string;
                messageId?: string;
                provider?: string;
                error?: string;
              };
              if (evt.type === "meta") {
                if (evt.conversationId) setConversation(evt.conversationId);
                if (evt.ragResults) setLastRag(evt.ragResults);
              } else if (evt.type === "delta" && evt.content) {
                streamedContent += evt.content;
                // Update the streaming assistant message in place.
                const current = useGradBridge.getState().messages;
                setMessages(
                  current.map((m) =>
                    m.id === assistantId ? { ...m, content: streamedContent } : m,
                  ),
                );
              } else if (evt.type === "error") {
                throw new Error(evt.error ?? "Stream error");
              }
              // "done" — message already persisted server-side; the content is complete.
            } catch {
              // skip unparseable
            }
          }
        }
      }
    } catch (err) {
      // Remove the optimistic user message + empty assistant placeholder.
      const current = useGradBridge.getState().messages;
      setMessages(
        current.filter((m) => m.id !== tempId && m.id !== assistantId),
      );
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Agent failed", { description: msg });
    } finally {
      streamCancelledRef.current = false;
      setThinking(false);
    }
  }, [isThinking, mode, agentId, conversationId, activeFilePath, addMessage, setInput, setThinking, setMessages, setConversation, setLastRag]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const handleExample = (ex: Example) => {
    setMode(ex.mode);
    setAgentId(undefined);
    void send(ex.prompt, ex.mode, undefined);
  };

  const canSend = input.trim().length > 0 && !isThinking;

  return (
    <div className="flex h-full flex-col">
      {/* Top: mode selector + RAG strip */}
      <div className="border-b border-border px-4 py-3">
        <ModeSelector />
        <RagStrip />
      </div>

      {/* Middle: messages */}
      <div
        ref={scrollRef}
        className="gb-scroll flex-1 overflow-y-auto px-4 py-5"
      >
        {messages.length === 0 ? (
          <EmptyState onPick={handleExample} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isThinking && <ThinkingIndicator />}
          </div>
        )}
      </div>

      {/* Bottom: input */}
      <div className="border-t border-border bg-background/60 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${activeAgent.name} in ${MODE_META[mode].label} mode…`}
              disabled={isThinking}
              className="min-h-[52px] max-h-[200px] resize-none pr-12"
              rows={1}
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void send(input)}
              disabled={!canSend}
              className="absolute bottom-2 right-2 size-8 rounded-md bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[0.65rem] text-muted-foreground">
            Enter to send · Shift+Enter for newline · responses use your profile + project RAG
          </p>
        </div>
      </div>
    </div>
  );
}

type ChatViewRagResult = {
  type: "file" | "knowledge";
  id: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
};

function RagStrip() {
  const { lastRag, setView, setActiveFilePath } = useGradBridge();
  if (lastRag.length === 0) {
    return (
      <p className="mt-2 text-[0.65rem] text-muted-foreground">
        No RAG context yet — the agent will pull relevant files &amp; knowledge on your first message.
      </p>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[0.65rem] text-muted-foreground">Context:</span>
      {lastRag.slice(0, 6).map((r) => {
        const isFile = r.type === "file";
        return (
          <button
            key={`${r.type}-${r.id}`}
            type="button"
            onClick={() => {
              if (isFile) {
                setActiveFilePath(r.source);
                setView("files");
              } else {
                setView("knowledge");
              }
            }}
            className="gb-glass gb-glow-ring inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            title={r.snippet}
          >
            <Icon name={isFile ? "FileText" : "BookOpen"} className="size-2.5 text-primary" />
            <span className="max-w-[14rem] truncate">{r.title}</span>
            <span className="text-emerald-400">{r.score.toFixed(2)}</span>
          </button>
        );
      })}
    </div>
  );
}

function ThinkingIndicator() {
  const { mode, agentId } = useGradBridge();
  const agent = agentId ? AGENTS[agentId] : AGENTS[MODE_META[mode].defaultAgent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-3"
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm",
          agent.accent,
        )}
      >
        <Icon name={agent.icon} className="size-4" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card/40 px-4 py-2.5">
        <span className="flex gap-1">
          <span className="gb-thinking-dot size-1.5 rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
          <span className="gb-thinking-dot size-1.5 rounded-full bg-primary" style={{ animationDelay: "200ms" }} />
          <span className="gb-thinking-dot size-1.5 rounded-full bg-primary" style={{ animationDelay: "400ms" }} />
        </span>
        <span className="text-xs text-muted-foreground">
          {agent.name} is thinking…
        </span>
      </div>
    </motion.div>
  );
}

function EmptyState({ onPick }: { onPick: (ex: Example) => void }) {
  return (
    <div className="relative mx-auto flex h-full max-w-3xl flex-col items-center justify-center py-10 text-center">
      <GradientMesh className="absolute inset-0 -z-10 opacity-30" />
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
          <Sparkles className="size-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What will you <span className="gb-text-gradient-anim">build</span> today?
        </h1>
        <BridgeCodeArt className="mx-auto mt-3 h-8 w-28 opacity-60" />
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          GradBridge plans, builds, debugs, and optimizes — then mentors your career.
          Pick a starting point or write your own prompt.
        </p>
      </motion.div>

      <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {EXAMPLES.map((ex, i) => {
          const meta = MODE_META[ex.mode];
          const agent = AGENTS[meta.defaultAgent];
          return (
            <motion.button
              key={ex.label}
              type="button"
              onClick={() => onPick(ex)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: 0.03 * i }}
              whileHover={{ y: -2, scale: 1.01 }}
              className="gb-border-anim group flex items-start gap-3 rounded-lg border border-border bg-card/40 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm",
                  agent.accent,
                )}
              >
                <Icon name={meta.icon} className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {ex.label}
                </p>
                <p className="mt-0.5 text-sm text-foreground">{ex.prompt}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
