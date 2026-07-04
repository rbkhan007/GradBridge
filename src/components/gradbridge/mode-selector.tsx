"use client";

import { useGradBridge } from "@/lib/store";
import { AGENTS, MODE_META } from "@/lib/agents";
import type { AgentMode } from "@/lib/types";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Horizontal row of 6 mode chips shown at the top of the chat view.
 * Active chip uses the default agent's accent gradient.
 */
export function ModeSelector() {
  const { mode, setMode, setAgentId } = useGradBridge();

  const handleSelect = (m: AgentMode) => {
    setMode(m);
    setAgentId(undefined); // reset override so default agent applies
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="tablist"
      aria-label="Agent mode"
    >
      {(Object.keys(MODE_META) as AgentMode[]).map((m) => {
        const meta = MODE_META[m];
        const agent = AGENTS[meta.defaultAgent];
        const active = mode === m;
        return (
          <Tooltip key={m}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelect(m)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  active
                    ? cn(
                        "border-transparent bg-gradient-to-br text-white shadow-sm",
                        agent.accent,
                      )
                    : "border-border bg-card/40 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon name={meta.icon} className="size-3.5" />
                {meta.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[16rem]">
              <p className="font-medium">{meta.label}</p>
              <p className="mt-0.5 text-primary-foreground/80">{meta.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
