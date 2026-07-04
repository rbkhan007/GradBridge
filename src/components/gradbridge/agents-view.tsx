"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, Sparkles, Zap } from "lucide-react";
import { useGradBridge } from "@/lib/store";
import { AGENT_LIST, MODE_META } from "@/lib/agents";
import type { AgentDefinition, AgentId, AgentMode } from "@/lib/types";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import { GradientMesh, AgentOrb } from "./art";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/** Maps an agent to the chat mode that best showcases it. */
const AGENT_TO_MODE: Record<AgentId, AgentMode> = {
  plan: "plan",
  build: "build",
  coder: "chat",
  reviewer: "chat",
  debugger: "debug",
  optimizer: "optimize",
  mentor: "career",
};

export function AgentsView() {
  const { setAgentId, setMode, setView } = useGradBridge();

  const activate = (agent: AgentDefinition) => {
    setAgentId(agent.id);
    setMode(AGENT_TO_MODE[agent.id]);
    setView("chat");
  };

  return (
    <div className="gb-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="relative mb-6">
          <GradientMesh className="absolute inset-0 -z-10 opacity-20" />
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Sub-Agent Swarm
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Specialized agents that collaborate on your work. Activate one to route
            the next chat through it.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AGENT_LIST.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: 0.03 * i }}
              whileHover={{ y: -3 }}
            >
              <AgentCard agent={agent} onActivate={() => activate(agent)} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  onActivate,
}: {
  agent: AgentDefinition;
  onActivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const modeMeta = MODE_META[AGENT_TO_MODE[agent.id]];

  return (
    <Card className="group gb-border-anim relative h-full gap-0 overflow-hidden p-0 transition-colors hover:border-primary/40">
      {/* Accent top strip */}
      <div className={cn("h-1 w-full bg-gradient-to-r", agent.accent)} />
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start gap-3">
          <AgentOrb accent={agent.accent} className="size-12 shrink-0">
            <Icon name={agent.icon} className="size-5" />
          </AgentOrb>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{agent.name}</CardTitle>
            <Badge variant="secondary" className="mt-1 font-mono text-[0.65rem]">
              {agent.role}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-sm leading-relaxed">
          {agent.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pb-4">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground gb-transition-view hover:bg-accent/50 hover:text-foreground"
            >
              <span>System prompt</span>
              {open ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="gb-scroll mt-2 max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-[0.7rem] leading-relaxed text-muted-foreground">
              {agent.systemPrompt}
            </pre>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center justify-between">
          <span className="text-[0.65rem] text-muted-foreground">
            routes to <span className="font-medium text-foreground">{modeMeta.label}</span> mode
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onActivate}
            className="gb-glow-cta gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm hover:opacity-90"
          >
            <Zap className="size-3.5" />
            Activate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
