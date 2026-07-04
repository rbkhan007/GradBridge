// Finetune module — tracks RAG feedback for continuous improvement.
// Records which results were returned, which were useful, and exports
// training data for model finetuning or prompt optimization.
//
// RULE: All queries scope by user_id for multi-tenancy isolation.
// RULE: Training data export respects user boundaries.
import { db } from "../db";

/* ============================================================
 * Types
 * ============================================================ */

export interface TrainingPair {
  query: string;
  positiveContext: string;
  negativeContext: string;
  response: string;
}

/* ============================================================
 * Feedback recording
 * ============================================================ */

/**
 * Record RAG feedback for a query.
 * Called after the user interacts with a response.
 *
 * RULE: userId is always required — never record feedback without user scope.
 */
export async function recordFeedback(opts: {
  userId: string;
  query: string;
  resultIds: string[];
  helpfulResultIds: string[];
  feedback: "helpful" | "not_helpful" | "partial";
  responseSnippet: string;
  agentMode: string;
  agentId: string;
}): Promise<void> {
  try {
    await db.ragFeedback.create({
      data: {
        userId: opts.userId,
        query: opts.query,
        resultsJson: JSON.stringify(opts.resultIds),
        helpfulResultIds: JSON.stringify(opts.helpfulResultIds),
        feedback: opts.feedback,
        responseSnippet: opts.responseSnippet.slice(0, 2000),
        agentMode: opts.agentMode,
        agentId: opts.agentId,
      },
    });
  } catch (err) {
    console.warn("[finetune] Failed to record feedback:", err);
  }
}

/**
 * Implicit feedback: record that the user continued a conversation
 * after seeing RAG results. This implies the results were at least
 * partially relevant.
 */
export async function recordImplicitFeedback(opts: {
  userId: string;
  query: string;
  resultIds: string[];
  agentMode: string;
  agentId: string;
}): Promise<void> {
  try {
    if (opts.resultIds.length === 0) return;

    await db.ragFeedback.create({
      data: {
        userId: opts.userId,
        query: opts.query,
        resultsJson: JSON.stringify(opts.resultIds),
        helpfulResultIds: JSON.stringify(opts.resultIds),
        feedback: "partial",
        responseSnippet: "",
        agentMode: opts.agentMode,
        agentId: opts.agentId,
      },
    });
  } catch (err) {
    console.warn("[finetune] Failed to record implicit feedback:", err);
  }
}

/* ============================================================
 * Feedback analysis — learn from accumulated feedback
 * ============================================================ */

export interface QueryStats {
  query: string;
  count: number;
  helpfulCount: number;
  notHelpfulCount: number;
  partialCount: number;
}

/**
 * Get the most frequent queries and their feedback distribution.
 * RULE: Scoped to a specific user.
 */
export async function getQueryStats(
  userId: string,
  limit = 50,
): Promise<QueryStats[]> {
  const feedbacks = await db.ragFeedback.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const statsMap = new Map<string, QueryStats>();

  for (const fb of feedbacks) {
    const existing = statsMap.get(fb.query);
    if (existing) {
      existing.count++;
      if (fb.feedback === "helpful") existing.helpfulCount++;
      else if (fb.feedback === "not_helpful") existing.notHelpfulCount++;
      else existing.partialCount++;
    } else {
      statsMap.set(fb.query, {
        query: fb.query,
        count: 1,
        helpfulCount: fb.feedback === "helpful" ? 1 : 0,
        notHelpfulCount: fb.feedback === "not_helpful" ? 1 : 0,
        partialCount: fb.feedback === "partial" ? 1 : 0,
      });
    }
  }

  return Array.from(statsMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get the most commonly helpful result IDs for a user.
 * Returns result IDs ranked by how often they were marked helpful.
 *
 * RULE: Scoped to a specific user — never cross-user.
 */
export async function getHelpfulResults(
  userId: string,
  queryPattern?: string,
  limit = 20,
): Promise<{ resultId: string; helpfulCount: number }[]> {
  const where: Record<string, unknown> = { userId };
  if (queryPattern) {
    where.query = { contains: queryPattern };
  }

  const feedbacks = await db.ragFeedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const resultCounts = new Map<string, number>();

  for (const fb of feedbacks) {
    try {
      const helpfulIds = JSON.parse(fb.helpfulResultIds) as string[];
      for (const id of helpfulIds) {
        resultCounts.set(id, (resultCounts.get(id) ?? 0) + 1);
      }
    } catch {
      // skip
    }
  }

  return Array.from(resultCounts.entries())
    .map(([resultId, helpfulCount]) => ({ resultId, helpfulCount }))
    .sort((a, b) => b.helpfulCount - a.helpfulCount)
    .slice(0, limit);
}

/* ============================================================
 * Training data export — for model finetuning
 * ============================================================ */

/**
 * Export feedback as JSONL training pairs.
 * Format: { "query": "...", "positive": "...", "negative": "...", "response": "..." }
 *
 * RULE: Only export data for the specified user.
 */
export async function exportTrainingData(
  userId: string,
  limit = 500,
): Promise<TrainingPair[]> {
  const feedbacks = await db.ragFeedback.findMany({
    where: {
      userId,
      feedback: { in: ["helpful", "not_helpful"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const pairs: TrainingPair[] = [];

  for (const fb of feedbacks) {
    try {
      const resultIds = JSON.parse(fb.resultsJson) as string[];
      const helpfulIds = JSON.parse(fb.helpfulResultIds) as string[];

      // RULE: Query user-scoped embeddings only
      const results = await db.vectorEmbedding.findMany({
        where: {
          userId,
          sourceId: { in: resultIds },
        },
      });

      const positiveContext = results
        .filter((r) => helpfulIds.includes(r.sourceId))
        .map((r) => r.content.slice(0, 500))
        .join("\n\n");

      const negativeContext = results
        .filter((r) => !helpfulIds.includes(r.sourceId))
        .map((r) => r.content.slice(0, 500))
        .join("\n\n");

      if (positiveContext || negativeContext) {
        pairs.push({
          query: fb.query,
          positiveContext: positiveContext || "(none)",
          negativeContext: negativeContext || "(none)",
          response: fb.responseSnippet,
        });
      }
    } catch {
      // skip malformed entries
    }
  }

  return pairs;
}

/**
 * Export as JSONL string (for fine-tuning tools like OpenAI, etc.).
 */
export async function exportTrainingJsonl(
  userId: string,
  limit = 500,
): Promise<string> {
  const pairs = await exportTrainingData(userId, limit);
  return pairs.map((p) => JSON.stringify(p)).join("\n");
}

/* ============================================================
 * Cleanup — prune old feedback entries
 * ============================================================ */

/** Delete feedback entries older than N days. */
export async function pruneOldFeedback(daysToKeep = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  const result = await db.ragFeedback.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
}
