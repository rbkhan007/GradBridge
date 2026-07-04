// Text transformers for the RAG pipeline.
// Provides tokenization, BM25 scoring, TF-IDF vectors, and text chunking.
// All algorithms are dependency-free — pure TypeScript implementations.

/* ============================================================
 * Tokenizer — enhanced with n-grams, code-aware splitting
 * ============================================================ */

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","if","then","else","for","to","of","in","on",
  "at","by","with","from","is","are","was","were","be","been","being","this",
  "that","these","those","it","its","as","how","what","why","when","where","do",
  "does","did","can","could","should","would","i","you","we","they","my","your",
  "me","our","use","using","used","into","about","which","who","whom","have",
  "has","had","will","shall","may","might","must","not","no","nor","so","too",
  "very","just","than","also","more","most","some","any","all","each","every",
]);

/** Split text into normalized tokens. Code-aware: preserves identifiers, paths, and camelCase. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Split camelCase and PascalCase
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Split on non-alphanumeric (keep # for issue refs, . for file paths, / for imports)
    .replace(/[^a-z0-9\s+#./_\-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Extract unigrams + bigrams from text for richer matching. */
export function ngrams(tokens: string[], n = 2): string[] {
  const grams: string[] = [...tokens];
  for (let i = 0; i < tokens.length - n + 1; i++) {
    grams.push(tokens.slice(i, i + n).join("_"));
  }
  return grams;
}

/* ============================================================
 * BM25 — Okapi BM25 scoring (industry-standard IR)
 * ============================================================ */

const BM25_K1 = 1.5;
const BM25_B = 0.75;

export interface Bm25Corpus {
  /** Document count. */
  n: number;
  /** Average document length (in tokens). */
  avgDl: number;
  /** Document lengths. */
  docLens: number[];
  /** Inverse document frequency per term. */
  idf: Map<string, number>;
  /** Tokenized documents. */
  docs: string[][];
}

/** Build a BM25 index from a list of texts. */
export function buildBm25Corpus(texts: string[]): Bm25Corpus {
  const docs = texts.map((t) => tokenize(t));
  const n = docs.length;
  const docLens = docs.map((d) => d.length);
  const avgDl = docLens.reduce((a, b) => a + b, 0) / n || 1;

  // Document frequency per term
  const df = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set<string>();
    for (const t of doc) {
      if (!seen.has(t)) {
        df.set(t, (df.get(t) ?? 0) + 1);
        seen.add(t);
      }
    }
  }

  // IDF: log((n - df + 0.5) / (df + 0.5) + 1)
  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((n - freq + 0.5) / (freq + 0.5) + 1));
  }

  return { n, avgDl, docLens, idf, docs };
}

/** Score a query against a pre-built BM25 corpus. Returns scores per document. */
export function bm25Score(query: string, corpus: Bm25Corpus): number[] {
  const queryTokens = tokenize(query);
  const scores = new Array(corpus.n).fill(0);

  for (let i = 0; i < corpus.n; i++) {
    const doc = corpus.docs[i];
    const dl = corpus.docLens[i];
    const tf = new Map<string, number>();
    for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const qt of queryTokens) {
      const f = tf.get(qt) ?? 0;
      const idfVal = corpus.idf.get(qt) ?? 0;
      const numerator = f * (BM25_K1 + 1);
      const denominator = f + BM25_K1 * (1 - BM25_B + BM25_B * (dl / corpus.avgDl));
      score += idfVal * (numerator / denominator);
    }
    scores[i] = score;
  }

  return scores;
}

/* ============================================================
 * TF-IDF — Vector space model for cosine similarity
 * ============================================================ */

export interface TfIdfVector {
  terms: Map<string, number>;
  norm: number;
}

/** Build IDF weights from a corpus of texts. */
export function buildIdf(texts: string[]): Map<string, number> {
  const n = texts.length;
  const df = new Map<string, number>();
  for (const text of texts) {
    const seen = new Set(tokenize(text));
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((n + 1) / (freq + 1)) + 1);
  }
  return idf;
}

/** Convert text into a TF-IDF sparse vector. */
export function textToTfIdf(text: string, idf: Map<string, number>): TfIdfVector {
  const tokens = tokenize(text);
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  const terms = new Map<string, number>();
  let normSq = 0;
  for (const [term, freq] of tf) {
    const weight = (1 + Math.log(freq)) * (idf.get(term) ?? 0);
    terms.set(term, weight);
    normSq += weight * weight;
  }
  return { terms, norm: Math.sqrt(normSq) || 1 };
}

/** Cosine similarity between two TF-IDF vectors. */
export function cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number {
  let dot = 0;
  for (const [term, weight] of a.terms) {
    const bw = b.terms.get(term);
    if (bw) dot += weight * bw;
  }
  return dot / (a.norm * b.norm);
}

/* ============================================================
 * Text chunking — split long text into overlapping windows
 * ============================================================ */

export interface TextChunk {
  text: string;
  startOffset: number;
  chunkIndex: number;
}

/** Split text into overlapping chunks by character offset. */
export function chunkText(
  text: string,
  maxLen = 800,
  overlap = 150,
): TextChunk[] {
  if (text.length <= maxLen) {
    return [{ text, startOffset: 0, chunkIndex: 0 }];
  }
  const chunks: TextChunk[] = [];
  let offset = 0;
  let idx = 0;
  while (offset < text.length) {
    const end = Math.min(offset + maxLen, text.length);
    chunks.push({
      text: text.slice(offset, end),
      startOffset: offset,
      chunkIndex: idx++,
    });
    if (end >= text.length) break;
    offset += maxLen - overlap;
  }
  return chunks;
}

/* ============================================================
 * Relevance scoring — combined BM25 + TF-IDF hybrid
 * ============================================================ */

export interface ScoredResult {
  bm25: number;
  tfidf: number;
  combined: number;
}

/** Hybrid score: 60% BM25 + 40% cosine similarity. */
export function hybridScore(
  bm25Raw: number,
  cosineRaw: number,
  bm25Max: number,
  cosineMax: number,
): ScoredResult {
  const bm25Norm = bm25Max > 0 ? bm25Raw / bm25Max : 0;
  const cosineNorm = cosineMax > 0 ? cosineRaw / cosineMax : 0;
  return {
    bm25: bm25Raw,
    tfidf: cosineRaw,
    combined: 0.6 * bm25Norm + 0.4 * cosineNorm,
  };
}
