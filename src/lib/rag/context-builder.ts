// Context builder — manages RAG context injection into LLM prompts.
// Handles token budgeting, deduplication, relevance thresholds,
// and smart snippet extraction.
import type { RagResult } from "../types";

/* ============================================================
 * Types
 * ============================================================ */

export interface ContextBuilderOptions {
  /** Maximum tokens for the entire RAG context block. Default: 3000. */
  maxTokens?: number;
  /** Minimum relevance score (0-1) to include a result. Default: 0.1. */
  minScore?: number;
  /** Maximum number of results to include. Default: 8. */
  maxResults?: number;
  /** Maximum snippet length per result (chars). Default: 300. */
  maxSnippetLen?: number;
  /** Deduplication threshold (cosine similarity). Results above this are considered duplicates. Default: 0.8. */
  dedupThreshold?: number;
  /** Whether to group results by source type. Default: true. */
  groupByType?: boolean;
}

export interface BuiltContext {
  /** The formatted context string to inject into the prompt. */
  text: string;
  /** How many results were included. */
  resultCount: number;
  /** How many were filtered out. */
  filteredCount: number;
  /** How many were deduplicated. */
  dedupedCount: number;
  /** Estimated token count of the output. */
  estimatedTokens: number;
  /** Results that were included, in order. */
  results: RagResult[];
}

/* ============================================================
 * Token estimation
 * ============================================================ */

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

/* ============================================================
 * Deduplication — simple overlap-based
 * ============================================================ */

function textOverlap(a: string, b: string): number {
  const aWords = new Set(a.toLowerCase().split(/\s+/));
  const bWords = new Set(b.toLowerCase().split(/\s+/));
  if (aWords.size === 0 || bWords.size === 0) return 0;
  let overlap = 0;
  for (const w of aWords) {
    if (bWords.has(w)) overlap++;
  }
  return overlap / Math.max(aWords.size, bWords.size);
}

function deduplicateResults(results: RagResult[], threshold: number): RagResult[] {
  const kept: RagResult[] = [];
  for (const r of results) {
    const isDuplicate = kept.some((k) => textOverlap(r.snippet, k.snippet) > threshold);
    if (!isDuplicate) kept.push(r);
  }
  return kept;
}

/* ============================================================
 * Snippet extraction — smart windowing around query terms
 * ============================================================ */

function extractSnippet(
  text: string,
  query: string,
  maxLen: number,
): string {
  if (text.length <= maxLen) return text.trim();

  const queryLower = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const queryWords = queryLower.split(/\s+/).filter(Boolean);
  const textLower = text.toLowerCase();

  // Find the window with the most query word hits
  let bestScore = -1;
  let bestStart = 0;
  const windowSize = maxLen;

  for (let start = 0; start <= text.length - windowSize; start += 60) {
    const slice = textLower.slice(start, start + windowSize);
    let score = 0;
    for (const qw of queryWords) {
      if (slice.includes(qw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  // Try to start at a word boundary
  if (bestStart > 0) {
    const spaceIdx = text.indexOf(" ", bestStart + 1);
    if (spaceIdx !== -1 && spaceIdx < bestStart + 40) bestStart = spaceIdx + 1;
  }

  const end = Math.min(bestStart + windowSize, text.length);
  let snippet = text.slice(bestStart, end).trim();

  if (bestStart > 0) snippet = "… " + snippet;
  if (end < text.length) snippet += " …";

  return snippet;
}

/* ============================================================
 * Context builder — main function
 * ============================================================ */

export function buildRagContext(
  results: RagResult[],
  query: string,
  opts: ContextBuilderOptions = {},
): BuiltContext {
  const {
    maxTokens = 3000,
    minScore = 0.1,
    maxResults = 8,
    maxSnippetLen = 300,
    dedupThreshold = 0.8,
    groupByType = true,
  } = opts;

  // Step 1: Filter by minimum score
  const filtered = results.filter((r) => r.score >= minScore);
  const filteredCount = results.length - filtered.length;

  // Step 2: Sort by score (descending)
  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  // Step 3: Deduplicate
  const deduped = deduplicateResults(sorted, dedupThreshold);
  const dedupedCount = sorted.length - deduped.length;

  // Step 4: Take top-k
  const topResults = deduped.slice(0, maxResults);

  // Step 5: Build context blocks with token budget
  const blocks: string[] = [];
  let usedTokens = 0;
  const includedResults: RagResult[] = [];

  const header = "Relevant context retrieved from the project + knowledge base:";
  usedTokens += estimateTokens(header);

  // Group by type if requested
  let orderedResults = topResults;
  if (groupByType) {
    const files = topResults.filter((r) => r.type === "file");
    const knowledge = topResults.filter((r) => r.type === "knowledge");
    orderedResults = [...files, ...knowledge];
  }

  for (const r of orderedResults) {
    const tag = r.type === "file" ? "FILE" : "KB";
    const snippet = extractSnippet(r.snippet, query, maxSnippetLen);
    const block = `[${tag}] ${r.title}\n(source: ${r.source})\n${snippet}`;
    const blockTokens = estimateTokens(block);

    if (usedTokens + blockTokens > maxTokens) {
      // Try with a shorter snippet
      const shorterSnippet = extractSnippet(r.snippet, query, Math.floor(maxSnippetLen / 2));
      const shortBlock = `[${tag}] ${r.title}\n(source: ${r.source})\n${shorterSnippet}`;
      const shortTokens = estimateTokens(shortBlock);
      if (usedTokens + shortTokens <= maxTokens) {
        blocks.push(shortBlock);
        usedTokens += shortTokens;
        includedResults.push(r);
      }
      continue;
    }

    blocks.push(block);
    usedTokens += blockTokens;
    includedResults.push(r);
  }

  const text = blocks.length > 0
    ? `${header}\n\n${blocks.join("\n\n")}`
    : "";

  return {
    text,
    resultCount: includedResults.length,
    filteredCount,
    dedupedCount,
    estimatedTokens: usedTokens,
    results: includedResults,
  };
}

/* ============================================================
 * Conversation context — recent messages for continuity
 * ============================================================ */

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Build a conversation context window from recent messages.
 * Truncates to fit within a token budget.
 */
export function buildConversationContext(
  messages: ConversationMessage[],
  maxTokens = 2000,
): string {
  if (messages.length === 0) return "";

  const parts: string[] = [];
  let usedTokens = 0;

  // Walk backwards from most recent
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const prefix = msg.role === "user" ? "User" : "Assistant";
    const block = `${prefix}: ${msg.content}`;
    const tokens = estimateTokens(block);

    if (usedTokens + tokens > maxTokens) break;

    parts.unshift(block);
    usedTokens += tokens;
  }

  if (parts.length === 0) return "";

  return `Recent conversation context:\n\n${parts.join("\n\n")}`;
}

/* ============================================================
 * Query expansion — improve recall by expanding the query
 * ============================================================ */

/**
 * Expand a query with synonyms/related terms for better recall.
 * Uses simple heuristics — no external API needed.
 */
export function expandQuery(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const expanded: string[] = [query];

  // Common expansions for CS/SE terms
  const expansions: Record<string, string[]> = {
    react: ["component", "jsx", "hooks", "useState"],
    typescript: ["type", "interface", "generic", "type-safe"],
    api: ["endpoint", "route", "rest", "http"],
    database: ["db", "sql", "query", "schema", "migration"],
    test: ["testing", "jest", "vitest", "spec", "unit test"],
    deploy: ["deployment", "ci/cd", "vercel", "docker"],
    auth: ["authentication", "login", "session", "jwt", "token"],
    performance: ["optimize", "speed", "latency", "cache"],
    security: ["vulnerability", "xss", "csrf", "sanitize"],
    refactor: ["clean", "improve", "restructure", "code quality"],
    career: ["job", "resume", "interview", "portfolio", "hiring"],
    algorithm: ["complexity", "big-o", "data structure", "time complexity"],
    frontend: ["ui", "ux", "css", "html", "browser"],
    backend: ["server", "node", "express", "fastify"],
    debugging: ["error", "bug", "fix", "stack trace", "log"],
    css: ["style", "tailwind", "layout", "responsive"],
    nextjs: ["next", "ssr", "ssg", "pages", "app router"],
    nodejs: ["node", "npm", "package", "module"],
    git: ["version control", "branch", "commit", "merge", "rebase"],
    docker: ["container", "image", "dockerfile", "compose"],
    ai: ["artificial intelligence", "machine learning", "llm", "gpt"],
    llm: ["large language model", "prompt", "completion", "fine-tune"],
    rag: ["retrieval", "augmented", "generation", "knowledge base", "embedding"],
  };

  for (const word of words) {
    const syns = expansions[word];
    if (syns) {
      expanded.push(`${query} ${syns.slice(0, 2).join(" ")}`);
    }
  }

  return expanded;
}
