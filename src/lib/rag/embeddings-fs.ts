// EmbeddingFS — persistent vector storage on the local filesystem.
// Stores document embeddings as JSON in data/embeddings/.
// Supports incremental updates, cosine similarity search, and metadata.
import fs from "fs";
import path from "path";

/* ============================================================
 * Types
 * ============================================================ */

export interface EmbeddingRecord {
  id: string;
  sourceType: "knowledge" | "file";
  sourceId: string;
  title: string;
  snippet: string;
  vector: number[];
  metadata: {
    category?: string;
    tags?: string[];
    language?: string;
    status?: string;
    source?: string;
    chunkIndex?: number;
  };
  updatedAt: string; // ISO timestamp
}

export interface SearchResult {
  record: EmbeddingRecord;
  score: number;
}

/* ============================================================
 * EmbeddingFS — file-based vector store
 * ============================================================ */

const EMBEDDINGS_DIR = path.join(process.cwd(), "data", "embeddings");
const INDEX_FILE = path.join(EMBEDDINGS_DIR, "_index.json");

export class EmbeddingFS {
  private records: Map<string, EmbeddingRecord> = new Map();
  private loaded = false;

  /** Ensure the embeddings directory exists. */
  private ensureDir(): void {
    if (!fs.existsSync(EMBEDDINGS_DIR)) {
      fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });
    }
  }

  /** Load all embedding records from disk. */
  load(): void {
    if (this.loaded) return;
    this.ensureDir();

    // Load index (list of record IDs)
    if (fs.existsSync(INDEX_FILE)) {
      try {
        const indexData = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8")) as string[];
        for (const id of indexData) {
          const filePath = path.join(EMBEDDINGS_DIR, `${id}.json`);
          if (fs.existsSync(filePath)) {
            try {
              const record = JSON.parse(fs.readFileSync(filePath, "utf-8")) as EmbeddingRecord;
              this.records.set(id, record);
            } catch {
              // Skip corrupted records
            }
          }
        }
      } catch {
        // Index corrupted, start fresh
      }
    }
    this.loaded = true;
  }

  /** Save the index file. */
  private saveIndex(): void {
    this.ensureDir();
    const ids = Array.from(this.records.keys());
    fs.writeFileSync(INDEX_FILE, JSON.stringify(ids, null, 0), "utf-8");
  }

  /** Save a single record to disk. */
  private saveRecord(record: EmbeddingRecord): void {
    this.ensureDir();
    const filePath = path.join(EMBEDDINGS_DIR, `${record.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record), "utf-8");
  }

  /** Delete a record from disk. */
  private deleteRecordFile(id: string): void {
    const filePath = path.join(EMBEDDINGS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /* ---- Public API ---- */

  /** Upsert a record. */
  upsert(record: EmbeddingRecord): void {
    this.load();
    this.records.set(record.id, record);
    this.saveRecord(record);
    this.saveIndex();
  }

  /** Upsert multiple records in batch. */
  upsertBatch(records: EmbeddingRecord[]): void {
    this.load();
    for (const record of records) {
      this.records.set(record.id, record);
      this.saveRecord(record);
    }
    this.saveIndex();
  }

  /** Get a record by ID. */
  get(id: string): EmbeddingRecord | undefined {
    this.load();
    return this.records.get(id);
  }

  /** Check if a record exists. */
  has(id: string): boolean {
    this.load();
    return this.records.has(id);
  }

  /** Delete a record by ID. */
  delete(id: string): boolean {
    this.load();
    const existed = this.records.delete(id);
    if (existed) {
      this.deleteRecordFile(id);
      this.saveIndex();
    }
    return existed;
  }

  /** Get all records. */
  all(): EmbeddingRecord[] {
    this.load();
    return Array.from(this.records.values());
  }

  /** Get records by source type. */
  bySource(type: "knowledge" | "file"): EmbeddingRecord[] {
    this.load();
    return this.all().filter((r) => r.sourceType === type);
  }

  /** Get records by source ID. */
  bySourceId(sourceId: string): EmbeddingRecord[] {
    this.load();
    return this.all().filter((r) => r.sourceId === sourceId);
  }

  /** Count of stored records. */
  size(): number {
    this.load();
    return this.records.size;
  }

  /** Clear all records. */
  clear(): void {
    this.load();
    for (const id of this.records.keys()) {
      this.deleteRecordFile(id);
    }
    this.records.clear();
    this.saveIndex();
  }

  /**
   * Search by cosine similarity against a query vector.
   * Returns the top-k results sorted by descending score.
   */
  searchByVector(queryVector: number[], topK = 5): SearchResult[] {
    this.load();
    const results: SearchResult[] = [];

    for (const record of this.records.values()) {
      const score = cosineSimilarity(queryVector, record.vector);
      if (score > 0.05) {
        results.push({ record, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Search by text query using TF-IDF similarity on stored vectors.
   * Falls back to keyword matching if no vectors are available.
   */
  searchByText(query: string, topK = 5): SearchResult[] {
    this.load();
    const queryLower = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const results: SearchResult[] = [];

    for (const record of this.records.values()) {
      // Combine title + snippet for text matching
      const text = `${record.title} ${record.snippet}`.toLowerCase();
      let score = 0;
      for (const q of queryLower) {
        if (text.includes(q)) score += 1;
      }
      // Boost by metadata
      if (record.metadata.category) score += 0.5;
      if (record.metadata.tags?.some((t) => queryLower.includes(t.toLowerCase()))) score += 1;

      if (score > 0) {
        results.push({ record, score: score / queryLower.length });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /** Get storage stats. */
  stats(): { totalRecords: number; knowledgeCount: number; fileCount: number; dirSize: string } {
    this.load();
    const all = this.all();
    const knowledgeCount = all.filter((r) => r.sourceType === "knowledge").length;
    const fileCount = all.filter((r) => r.sourceType === "file").length;

    let dirSize = "0 B";
    if (fs.existsSync(EMBEDDINGS_DIR)) {
      const files = fs.readdirSync(EMBEDDINGS_DIR);
      let bytes = 0;
      for (const f of files) {
        const stat = fs.statSync(path.join(EMBEDDINGS_DIR, f));
        bytes += stat.size;
      }
      if (bytes > 1024 * 1024) dirSize = `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      else if (bytes > 1024) dirSize = `${(bytes / 1024).toFixed(1)} KB`;
      else dirSize = `${bytes} B`;
    }

    return { totalRecords: all.length, knowledgeCount, fileCount, dirSize };
  }
}

/* ============================================================
 * Cosine similarity between two vectors
 * ============================================================ */

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/* ============================================================
 * Singleton instance
 * ============================================================ */

let _instance: EmbeddingFS | null = null;

export function getEmbeddingFS(): EmbeddingFS {
  if (!_instance) _instance = new EmbeddingFS();
  return _instance;
}
