"use client";

import { motion } from "framer-motion";
import { useGradBridge } from "@/lib/store";
import { AGENTS, MODE_META } from "@/lib/agents";
import type { ChatMessage } from "@/lib/types";
import { Icon } from "./icon";
import { Markdown } from "./markdown";
import { cn } from "@/lib/utils";

/**
 * Renders a single chat message. User messages are right-aligned plain text;
 * assistant messages are left-aligned with an agent avatar + markdown content.
 */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const { agentId, mode } = useGradBridge();

  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-border bg-primary/10 px-4 py-2.5">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  // Resolve which agent authored this assistant message.
  const agent =
    (message.agentId && AGENTS[message.agentId]) ||
    (message.agentMode && AGENTS[MODE_META[message.agentMode].defaultAgent]) ||
    AGENTS[MODE_META[mode].defaultAgent] ||
    AGENTS.coder;
  // Show "manual" badge only if this message used a non-default agent.
  const defaultAgent = message.agentMode
    ? MODE_META[message.agentMode].defaultAgent
    : MODE_META[mode].defaultAgent;
  const usedOverride = Boolean(message.agentId && message.agentId !== defaultAgent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex gap-3"
    >
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm",
          agent.accent,
        )}
      >
        <Icon name={agent.icon} className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{agent.name}</span>
          {message.agentMode && (
            <span className="rounded-full border border-border bg-card/60 px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
              {MODE_META[message.agentMode].label}
            </span>
          )}
          {usedOverride && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-primary">
              manual
            </span>
          )}
        </div>
        <div className="rounded-2xl rounded-tl-sm border border-border bg-card/40 px-4 py-2.5">
          <Markdown>{message.content}</Markdown>
        </div>
      </div>
    </motion.div>
  );
}
