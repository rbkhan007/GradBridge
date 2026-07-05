"use client";

import { motion } from "framer-motion";
import { Terminal, Copy, Check, ArrowRight, Github, Cpu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const INSTALL_STEPS = [
  {
    title: "1. Prerequisites",
    content: `Ensure you have Rust installed. If not, install it from rustup.rs:

  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`,
  },
  {
    title: "2. Build the CLI",
    content: `Clone and build the GradBridge CLI:

  git clone https://github.com/rbkhan007/GradBridge.git
  cd GradBridge/rust-cli
  cargo build --release`,
  },
  {
    title: "3. Set your API URL",
    content: `Point the CLI at your GradBridge instance:

  # For the hosted version:
  export GRADBRIDGE_API_URL=https://GradBridge.beta.vercel.app

  # For local development:
  export GRADBRIDGE_API_URL=http://localhost:3000`,
  },
  {
    title: "4. Authenticate",
    content: `Log in with your GradBridge account:

  # Login (you'll be prompted for credentials):
  ./target/release/gradbridge-cli login

  # Or set your session token directly:
  export GRADBRIDGE_TOKEN=your-session-token`,
  },
  {
    title: "5. Start chatting",
    content: `Chat with your agents directly from the terminal:

  # Interactive chat session:
  ./target/release/gradbridge-cli chat

  # One-shot query:
  ./target/release/gradbridge-cli chat --message "Build a REST API with Express"

  # Stream responses in real-time:
  ./target/release/gradbridge-cli chat --stream`,
  },
];

const COMMANDS = [
  { cmd: "gradbridge-cli --help", desc: "Show available commands" },
  { cmd: "gradbridge-cli chat", desc: "Start interactive chat session" },
  { cmd: "gradbridge-cli chat --message <query>", desc: "One-shot query (non-interactive)" },
  { cmd: "gradbridge-cli chat --stream", desc: "Stream response in real-time" },
  { cmd: "gradbridge-cli chat --mode plan", desc: "Chat in Plan agent mode" },
  { cmd: "gradbridge-cli login", desc: "Authenticate with the API" },
  { cmd: "gradbridge-cli logout", desc: "Clear stored credentials" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
      className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover/code:opacity-100"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="group/code relative my-2 overflow-hidden rounded-lg border border-border bg-muted/60">
      <pre className="gb-scroll overflow-x-auto p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

export function CliView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6"
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
          <Terminal className="size-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">CLI Installation</h1>
          <p className="text-sm text-muted-foreground">
            Use GradBridge from your terminal with the Rust CLI
          </p>
        </div>
      </div>

      {/* Installation steps */}
      <section className="mb-10 space-y-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="size-4 text-primary" />
          Installation
        </h2>
        <div className="space-y-4">
          {INSTALL_STEPS.map((step, i) => (
            <div key={i} className="rounded-lg border border-border bg-card/40 p-4">
              <h3 className="mb-2 text-sm font-medium">{step.title}</h3>
              <CodeBlock code={step.content} />
            </div>
          ))}
        </div>
      </section>

      {/* Command reference */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <ArrowRight className="size-4 text-primary" />
          Command Reference
        </h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Command</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {COMMANDS.map((c, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{c.cmd}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Source link */}
      <section className="rounded-lg border border-border bg-card/40 p-5">
        <div className="flex items-start gap-3">
          <Github className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">Open Source</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              The CLI is open source under Apache 2.0. View the source, report issues,
              or contribute on GitHub.
            </p>
            <a
              href="https://github.com/rbkhan007/GradBridge/tree/main/rust-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              github.com/rbkhan007/GradBridge
              <ArrowRight className="size-3" />
            </a>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
