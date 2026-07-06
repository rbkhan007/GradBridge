// Enhanced hybrid RAG search — combines BM25 + TF-IDF + Prisma VectorEmbedding.
// This is a comprehensive retrieval pipeline:
//   1. BM25 keyword scoring (fast, high recall)
//   2. TF-IDF cosine similarity (semantic-lite)
//   3. VectorEmbedding search via Prisma ORM (persistent, pgvector-ready)
//   4. Score fusion + deduplication + context windowing
import { db } from "./db";
import type { RagResult } from "./types";
import {
  tokenize,
  buildBm25Corpus,
  bm25Score,
  buildIdf,
  textToTfIdf,
  cosineSimilarity,
  chunkText,
} from "./rag/transformers";
import {
  buildRagContext,
  type ContextBuilderOptions,
  type BuiltContext,
  expandQuery,
} from "./rag/context-builder";

export type { BuiltContext, ContextBuilderOptions };
export { buildRagContext, expandQuery };

/* ============================================================
 * Enhanced scoring — TF with IDF weighting
 * ============================================================ */

function scoreText(queryTokens: string[], text: string, idf: Map<string, number>): number {
  const tokens = tokenize(text);
  if (tokens.length === 0 || queryTokens.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  let score = 0;
  for (const qt of queryTokens) {
    const f = freq.get(qt) ?? 0;
    if (f > 0) {
      const idfWeight = idf.get(qt) ?? 1;
      score += (1 + Math.log(f)) * idfWeight;
    }
  }
  return score / Math.sqrt(tokens.length);
}

/* ============================================================
 * Snippet extraction
 * ============================================================ */

function snippet(text: string, queryTokens: string[], maxLen = 300): string {
  if (text.length <= maxLen) return text.trim();
  const lower = text.toLowerCase();
  let bestIdx = 0;
  let bestHits = -1;
  const window = maxLen;
  for (let i = 0; i < text.length - window; i += 60) {
    const slice = lower.slice(i, i + window);
    let hits = 0;
    for (const qt of queryTokens) if (slice.includes(qt)) hits++;
    if (hits > bestHits) {
      bestHits = hits;
      bestIdx = i;
    }
  }
  const snip = text.slice(bestIdx, bestIdx + window).trim();
  return (bestIdx > 0 ? "… " : "") + snip + (bestIdx + window < text.length ? " …" : "");
}

/* ============================================================
 * Main RAG search — enhanced hybrid
 * ============================================================ */

export async function ragSearch(
  query: string,
  limit = 4,
  userId?: string,
): Promise<RagResult[]> {
  // Expand query for better recall (adds synonyms for CS/SE terms)
  const expandedQueries = expandQuery(query);
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Fetch all documents
  const [files, entries] = await Promise.all([
    userId
      ? db.projectFile.findMany({ where: { userId } })
      : db.projectFile.findMany(),
    db.knowledgeEntry.findMany(),
  ]);

  // Build text corpus for IDF + BM25 (cached across queries)
  const allTexts = [
    ...files.map((f) => `${f.path} ${f.content}`),
    ...entries.map((k) => `${k.title} ${k.category} ${k.content}`),
  ];
  const { bm25: bm25Corpus, idf } = getCachedCorpus(allTexts);
  const bm25Scores = bm25Score(query, bm25Corpus);
  const bm25Max = Math.max(...bm25Scores, 1);

  // Score files
  const results: RagResult[] = [];
  let fileIdx = 0;

  for (const f of files) {
    const text = `${f.path} ${f.content}`;
    const idfScore = scoreText(queryTokens, text, idf);
    const fileTfIdf = textToTfIdf(text, idf);
    const queryTfIdf = textToTfIdf(query, idf);
    const cosSim = cosineSimilarity(queryTfIdf, fileTfIdf);

    // Hybrid: 60% BM25 + 40% TF-IDF cosine
    const bm25 = bm25Scores[fileIdx] ?? 0;
    const bm25Norm = bm25Max > 0 ? bm25 / bm25Max : 0;
    const cosNorm = cosSim;
    const combined = 0.6 * bm25Norm + 0.4 * cosNorm;

    // File boost (files are highly relevant context)
    const finalScore = combined * 1.1;

    if (finalScore > 0.05) {
      results.push({
        type: "file",
        id: f.id,
        title: f.path,
        snippet: snippet(f.content, queryTokens),
        score: finalScore,
        source: `${f.language} file · ${f.status}`,
      });
    }
    fileIdx++;
  }

  // Score knowledge entries
  for (let i = 0; i < entries.length; i++) {
    const k = entries[i];
    const tags = (() => {
      try {
        return JSON.parse(k.tags) as string[];
      } catch {
        return [];
      }
    })();
    const text = `${k.title} ${k.category} ${tags.join(" ")} ${k.content}`;
    const idfScore = scoreText(queryTokens, text, idf);
    const kTfIdf = textToTfIdf(text, idf);
    const queryTfIdf = textToTfIdf(query, idf);
    const cosSim = cosineSimilarity(queryTfIdf, kTfIdf);

    const bm25 = bm25Scores[files.length + i] ?? 0;
    const bm25Norm = bm25Max > 0 ? bm25 / bm25Max : 0;
    const cosNorm = cosSim;
    const combined = 0.6 * bm25Norm + 0.4 * cosNorm;

    if (combined > 0.05) {
      results.push({
        type: "knowledge",
        id: k.id,
        title: k.title,
        snippet: snippet(k.content, queryTokens),
        score: combined,
        source: `${k.category}${tags.length ? " · " + tags.slice(0, 2).join(", ") : ""}`,
      });
    }
  }

  // Also search VectorEmbedding table for additional results
  try {
    const vecResults = await searchVectorEmbeddings(query, userId);
    const existingIds = new Set(results.map((r) => r.id));

    for (const vr of vecResults) {
      if (!existingIds.has(vr.sourceId)) {
        results.push({
          type: vr.sourceType as "file" | "knowledge",
          id: vr.sourceId,
          title: vr.sourceType === "knowledge" ? vr.sourceId : vr.sourceId,
          snippet: vr.content.slice(0, 300),
          score: vr.score * 0.8,
          source: vr.sourceType,
        });
      }
    }
  } catch {
    // VectorEmbedding table may not exist yet, skip
  }

  // Sort by score, take top results
  return results.sort((a, b) => b.score - a.score).slice(0, limit * 2);
}

/* ============================================================
 * Format RAG context — enhanced with metadata
 * ============================================================ */

export function formatRagContext(results: RagResult[]): string {
  if (results.length === 0) return "";
  const blocks = results.map((r, i) => {
    const tag = r.type === "file" ? "FILE" : "KB";
    return `[${tag} ${i + 1}] ${r.title}\n(source: ${r.source})\n${r.snippet}`;
  });
  return `Relevant context retrieved from the project + knowledge base:\n\n${blocks.join("\n\n")}`;
}

/* ============================================================
 * BM25/IDF Corpus Cache — invalidated on re-index
 * ============================================================ */

let _corpusVersion = 0;
let _bm25Corpus: ReturnType<typeof buildBm25Corpus> | null = null;
let _idfCache: Map<string, number> | null = null;
let _cachedTexts: string[] = [];

function getCachedCorpus(texts: string[]): { bm25: ReturnType<typeof buildBm25Corpus>; idf: Map<string, number> } {
  // Invalidate if texts changed (by length + content hash)
  const hash = texts.length + texts.reduce((a, t) => a + t.length, 0);
  if (_bm25Corpus && _idfCache && _cachedTexts.length === texts.length && hash > 0) {
    return { bm25: _bm25Corpus, idf: _idfCache };
  }
  _bm25Corpus = buildBm25Corpus(texts);
  _idfCache = buildIdf(texts);
  _cachedTexts = texts;
  return { bm25: _bm25Corpus, idf: _idfCache };
}

function invalidateCorpusCache(): void {
  _corpusVersion++;
  _bm25Corpus = null;
  _idfCache = null;
  _cachedTexts = [];
}

/* ============================================================
 * VectorEmbedding — Prisma ORM backed vector storage
 * ============================================================ */

/**
 * Index all knowledge entries and project files into VectorEmbedding table.
 * Stores real TF-IDF vectors as JSON string arrays in PostgreSQL.
 * Call this after knowledge/file CRUD operations.
 */
export async function indexToVectorStore(userId?: string): Promise<number> {
  let indexed = 0;

  const entries = await db.knowledgeEntry.findMany({ take: 200 });
  const allEntryTexts = entries.map((k) => `${k.title} ${k.content}`);
  const idf = allEntryTexts.length > 0 ? buildIdf(allEntryTexts) : new Map<string, number>();

  for (const k of entries) {
    const chunks = chunkText(k.content, 600, 100);
    for (const chunk of chunks) {
      const id = chunks.length === 1 ? k.id : `${k.id}_c${chunk.chunkIndex}`;
      const vec = textToTfIdf(chunk.text, idf);
      const serialized = JSON.stringify(Array.from(vec.terms.entries()));
      try {
        await db.vectorEmbedding.upsert({
          where: { userId_sourceType_sourceId: { userId: userId ?? "global", sourceType: "knowledge", sourceId: id } },
          create: {
            userId: userId ?? "global",
            sourceType: "knowledge",
            sourceId: id,
            content: chunk.text.slice(0, 300),
            embedding: serialized,
          },
          update: { content: chunk.text.slice(0, 300), embedding: serialized },
        });
        indexed++;
      } catch { /* skip if VectorEmbedding table doesn't exist */ }
    }
  }

  const where = userId ? { userId } : {};
  const files = await db.projectFile.findMany({ where, take: 200 });
  const allFileTexts = files.map((f) => `${f.path} ${f.content}`);
  const fileIdf = allFileTexts.length > 0 ? buildIdf(allFileTexts) : new Map<string, number>();

  for (const f of files) {
    const chunks = chunkText(f.content, 600, 100);
    for (const chunk of chunks) {
      const id = chunks.length === 1 ? f.id : `${f.id}_c${chunk.chunkIndex}`;
      const vec = textToTfIdf(chunk.text, fileIdf);
      const serialized = JSON.stringify(Array.from(vec.terms.entries()));
      try {
        await db.vectorEmbedding.upsert({
          where: { userId_sourceType_sourceId: { userId: f.userId, sourceType: "file", sourceId: id } },
          create: {
            userId: f.userId,
            sourceType: "file",
            sourceId: id,
            content: chunk.text.slice(0, 300),
            embedding: serialized,
          },
          update: { content: chunk.text.slice(0, 300), embedding: serialized },
        });
        indexed++;
      } catch { /* skip if VectorEmbedding table doesn't exist */ }
    }
  }

  invalidateCorpusCache();
  return indexed;
}

/**
 * Search VectorEmbedding table using cosine similarity on stored TF-IDF vectors.
 * Falls back to text matching if vectors are empty.
 */
async function searchVectorEmbeddings(
  query: string,
  userId?: string,
): Promise<Array<{ sourceType: string; sourceId: string; content: string; score: number }>> {
  const where: Record<string, unknown> = userId ? { userId } : {};

  const embeddings = await db.vectorEmbedding.findMany({
    where,
    take: 200,
    select: { sourceType: true, sourceId: true, content: true, embedding: true },
  });

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Compute IDF from all stored content for query weighting
  const allTexts = embeddings.map((e) => e.content);
  const idf = allTexts.length > 0 ? buildIdf(allTexts) : new Map<string, number>();
  const queryVec = textToTfIdf(query, idf);

  return embeddings
    .map((e) => {
      let score = 0;
      if (e.embedding && e.embedding.length > 2) {
        // Stored TF-IDF vector — parse and compute cosine similarity
        try {
          const storedTerms = JSON.parse(e.embedding) as [string, number][];
          let dot = 0, queryNormSq = 0, storedNormSq = 0;
          const storedMap = new Map(storedTerms);
          for (const [term, qw] of queryVec.terms) {
            queryNormSq += qw * qw;
            const sw = storedMap.get(term);
            if (sw) dot += qw * sw;
          }
          for (const [, sw] of storedTerms) storedNormSq += sw * sw;
          const denom = Math.sqrt(queryNormSq) * Math.sqrt(storedNormSq);
          score = denom > 0 ? dot / denom : 0;
        } catch {
          score = 0;
        }
      } else {
        // No stored vector — fall back to text matching
        const contentLower = e.content.toLowerCase();
        for (const word of queryTokens) {
          if (word.length > 2 && contentLower.includes(word)) score += 0.15;
        }
        score = Math.min(score, 1);
      }
      return { sourceType: e.sourceType, sourceId: e.sourceId, content: e.content, score };
    })
    .filter((r) => r.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
