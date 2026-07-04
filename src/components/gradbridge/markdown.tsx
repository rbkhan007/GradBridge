"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

/**
 * Renders markdown content from the agent. Code blocks are syntax-highlighted
 * with the Prism full build (refractor — all languages bundled, no registration).
 * If a fenced code block's info string contains a file path, it is shown as a
 * small header chip above the block. Includes a copy button on each block.
 */
export function Markdown({ children }: { children: string }) {
  const components = useMemo<Components>(
    () => ({
      code(props) {
        const { className, children: codeChildren, node, ...rest } = props;
        // `node` is unused but must be stripped before passing to DOM.
        void node;
        const match = /language-(\w+)/.exec(className ?? "");
        const isInline =
          !className && typeof codeChildren === "string" && !codeChildren.includes("\n");

        if (isInline || !match) {
          return (
            <code className={className} {...rest}>
              {codeChildren}
            </code>
          );
        }

        const lang = match[1];
        const raw = String(codeChildren).replace(/\n$/, "");
        return (
          <CodeBlock language={lang} value={raw} infoString={className ?? ""} />
        );
      },
      // Force links to open safely.
      a({ children, href, ...rest }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            {...rest}
          >
            {children}
          </a>
        );
      },
    }),
    [],
  );

  return (
    <div className="gb-prose">
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}

function CodeBlock({
  language,
  value,
  infoString,
}: {
  language: string;
  value: string;
  infoString: string;
}) {
  const [copied, setCopied] = useState(false);

  // The info string looks like "language-ts src/auth/login.ts".
  // Extract any token that looks like a path (contains / or a dot in the middle).
  const filePath = useMemo(() => {
    const tokens = infoString.replace(/^language-/, "").split(/\s+/).slice(1);
    return tokens.find((t) => t.includes("/") || /\.[a-z0-9]+$/i.test(t)) ?? null;
  }, [infoString]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; ignore silently
    }
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border bg-[#282c34]">
      <div className="flex items-center justify-between border-b border-border/60 bg-background/40 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{language || "text"}</span>
          {filePath && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">
              {filePath}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="size-3 text-emerald-400" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          background: "transparent",
          fontSize: "0.8rem",
          padding: "0.875rem 1rem",
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-geist-mono)" } }}
        wrapLongLines={false}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
