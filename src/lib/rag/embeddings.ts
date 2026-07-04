// Embedding computation providers for RAG.
// Supports TF-IDF (local, no API) and optional API-based embeddings.

import {
  buildIdf,
  textToTfIdf,
  cosineSimilarity,
  type TfIdfVector,
} from "./transformers";

/* ============================================================
 * EmbeddingProvider interface
 * ============================================================ */

export interface EmbeddingProvider {
  name: string;
  dimension: number;
  /** Embed a single text into a float vector. */
  embed(text: string): Promise<number[]>;
  /** Embed multiple texts in batch. */
  embedBatch(texts: string[]): Promise<number[][]>;
}

/* ============================================================
 * TfIdfEmbeddingProvider — local, dependency-free
 * Uses IDF-weighted term vectors with cosine similarity.
 * ============================================================ */

export class TfIdfEmbeddingProvider implements EmbeddingProvider {
  name = "tfidf-local";
  dimension = 0; // dynamic based on vocabulary
  private idf: Map<string, number> = new Map();
  private vocab: string[] = [];
  private ready = false;

  /** Build IDF from a corpus of texts. Must be called before embed(). */
  buildFromTexts(texts: string[]): void {
    this.idf = buildIdf(texts);
    this.vocab = Array.from(this.idf.keys()).sort();
    this.dimension = this.vocab.length;
    this.ready = true;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.ready) throw new Error("TfIdfEmbeddingProvider not initialized — call buildFromTexts first");
    const vec = textToTfIdf(text, this.idf);
    // Convert sparse map to dense vector aligned with vocab
    const dense = new Array(this.dimension).fill(0);
    for (let i = 0; i < this.vocab.length; i++) {
      const w = vec.terms.get(this.vocab[i]);
      if (w) dense[i] = w;
    }
    return dense;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  /** Compute cosine similarity between two raw vectors. */
  static cosSim(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /** Compute cosine similarity using the sparse representation (faster). */
  static sparseCosSim(a: TfIdfVector, b: TfIdfVector): number {
    return cosineSimilarity(a, b);
  }
}

/* ============================================================
 * ApiEmbeddingProvider — uses OpenAI-compatible embedding API
 * Falls back gracefully if the API is unavailable.
 * ============================================================ */

export class ApiEmbeddingProvider implements EmbeddingProvider {
  name = "api-embedding";
  dimension = 1536;
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor(opts: {
    baseUrl?: string;
    model?: string;
    apiKey: string;
  }) {
    this.baseUrl = opts.baseUrl ?? "https://openrouter.ai/api/v1/embeddings";
    this.model = opts.model ?? "openai/text-embedding-3-small";
    this.apiKey = opts.apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!res.ok) throw new Error(`Embedding API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0]?.embedding ?? [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`Embedding API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }
}

/* ============================================================
 * HybridEmbeddingProvider — combines local TF-IDF + API
 * Uses TF-IDF as fast local filter, API for re-ranking top-k.
 * ============================================================ */

export class HybridEmbeddingProvider implements EmbeddingProvider {
  name = "hybrid";
  dimension = 0;
  private tfidf: TfIdfEmbeddingProvider;
  private api: ApiEmbeddingProvider | null = null;

  constructor(apiKey?: string) {
    this.tfidf = new TfIdfEmbeddingProvider();
    if (apiKey) {
      this.api = new ApiEmbeddingProvider({ apiKey });
      this.dimension = this.api.dimension;
    }
  }

  /** Initialize TF-IDF from corpus. */
  buildFromTexts(texts: string[]): void {
    this.tfidf.buildFromTexts(texts);
    if (!this.api) this.dimension = this.tfidf.dimension;
  }

  async embed(text: string): Promise<number[]> {
    if (this.api) {
      try {
        return await this.api.embed(text);
      } catch {
        // Fall back to TF-IDF
      }
    }
    return this.tfidf.embed(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.api) {
      try {
        return await this.api.embedBatch(texts);
      } catch {
        // Fall back to TF-IDF
      }
    }
    return this.tfidf.embedBatch(texts);
  }

  /** Get the TF-IDF provider for local scoring. */
  getTfIdf(): TfIdfEmbeddingProvider {
    return this.tfidf;
  }
}
