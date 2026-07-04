// Build the dynamic context block injected into every agent system prompt.
// Uses the enhanced context builder for token budgeting and deduplication.
import { formatRagContext, buildRagContext, type ContextBuilderOptions } from "./rag";
import type { RagResult, UserProfile } from "./types";

export function profileBlock(profile: UserProfile | null): string {
  if (!profile) return "";
  return `## Learner Profile (use to personalize advice)
- Name: ${profile.name}
- University: ${profile.university}
- Major: ${profile.major}
- Graduating: ${profile.graduationYear}
- Target role: ${profile.targetRole}
- Experience: ${profile.experienceLevel}
- Skills: ${profile.skills.join(", ") || "none listed"}
- Goals: ${profile.goals.map((g) => `- ${g}`).join("\n") || "none listed"}`;
}

export function activeFileBlock(path: string, content: string): string {
  return `## Active file: \`${path}\`
\`\`\`
${content.slice(0, 6000)}
\`\`\``;
}

export function buildSystemPrompt(
  basePrompt: string,
  opts: {
    profile?: UserProfile | null;
    ragResults?: RagResult[];
    activeFile?: { path: string; content: string } | null;
    query?: string;
    contextOptions?: ContextBuilderOptions;
  },
): string {
  const parts = [basePrompt];
  if (opts.profile) parts.push(profileBlock(opts.profile));
  if (opts.ragResults && opts.ragResults.length > 0) {
    // Use enhanced context builder if query is provided
    if (opts.query) {
      const built = buildRagContext(opts.ragResults, opts.query, {
        maxTokens: opts.contextOptions?.maxTokens ?? 3000,
        maxResults: opts.contextOptions?.maxResults ?? 6,
        ...opts.contextOptions,
      });
      if (built.text) parts.push(built.text);
    } else {
      parts.push(formatRagContext(opts.ragResults));
    }
  }
  if (opts.activeFile) {
    parts.push(activeFileBlock(opts.activeFile.path, opts.activeFile.content));
  }
  return parts.join("\n\n---\n\n");
}
