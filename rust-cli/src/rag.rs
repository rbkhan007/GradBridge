//! Local RAG index for the CLI edition.
//!
//! A simpler, file-system-scoped cousin of the web app's `src/lib/rag.ts`. It
//! walks the current directory, indexes source files (`*.rs`, `*.py`, `*.ts`,
//! `*.tsx`, `*.js`, `*.jsx`, `*.md`, `*.json`), stores them in a local SQLite
//! cache, and serves a lightweight TF-style keyword search that returns
//! ranked snippets.
//!
//! The index lives at `~/.gradbridge/rag.db` (shared across invocations) and
//! is rebuilt on demand via `RagIndex::reindex()`.
//!
//! Note: this is a *local* index used by the CLI for context awareness. The
//! authoritative RAG (project files + curated knowledge base) lives in the web
//! app — the CLI sends chat requests to `/api/chat` and the web app does its
//! own RAG server-side. This local index is a bonus for the TUI's "context"
//! panel and the `gradbridge debug <path>` command.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use sqlx::Row;

/// File extensions that are indexed.
const INDEXED_EXTS: &[&str] = &[
    "rs", "py", "ts", "tsx", "js", "jsx", "md", "json", "go", "java", "c", "cpp", "h",
];

/// A single search hit.
#[derive(Debug, Clone)]
pub struct RagHit {
    pub path: String,
    pub language: String,
    pub score: f64,
    pub snippet: String,
}

/// A local SQLite-backed RAG index.
pub struct RagIndex {
    pool: SqlitePool,
}

impl RagIndex {
    /// Open (creating if needed) the RAG index at `~/.gradbridge/rag.db`.
    pub async fn open() -> Result<Self> {
        let dir = crate::config::config_dir()?;
        if !dir.exists() {
            std::fs::create_dir_all(&dir)
                .with_context(|| format!("failed to create {}", dir.display()))?;
        }
        let db_path = dir.join("rag.db");
        Self::open_at(&db_path).await
    }

    /// Open the index at an explicit path (used in tests).
    pub async fn open_at(path: &Path) -> Result<Self> {
        // Create the DB file if it doesn't exist (mode=rwc equivalent).
        let opts = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await
            .context("failed to open RAG sqlite db")?;

        // No sqlx::migrate!() — we manage the schema inline via the SCHEMA const
        // so the CLI ships with zero migration files. `raw_sql` runs all
        // statements (CREATE TABLE + CREATE INDEX) in one call.
        sqlx::raw_sql(SCHEMA).execute(&pool).await?;
        Ok(Self { pool })
    }

    /// Walk `root` and (re)index every file with a recognized extension.
    /// Returns the number of files indexed. Skips common ignore dirs
    /// (`node_modules`, `.git`, `target`, `dist`, `.next`).
    pub async fn reindex(&self, root: &Path) -> Result<usize> {
        // Clear the index first for a clean rebuild.
        sqlx::query("DELETE FROM rag_files")
            .execute(&self.pool)
            .await?;

        let mut count = 0usize;
        let files = collect_files(root);
        for file in files {
            if let Err(e) = self.index_file(&file).await {
                eprintln!("[rag] failed to index {}: {}", file.display(), e);
            } else {
                count += 1;
            }
        }
        Ok(count)
    }

    /// Index a single file: read it, compute a token frequency map, store it.
    async fn index_file(&self, path: &Path) -> Result<()> {
        let rel = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string());
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("read {}", path.display()))?;
        let language = language_for(path);

        // Store the file row.
        sqlx::query(
            "INSERT OR REPLACE INTO rag_files (path, language, content, indexed_at) \
             VALUES (?, ?, ?, datetime('now'))",
        )
        .bind(rel.as_str())
        .bind(language)
        .bind(content.as_str())
        .execute(&self.pool)
        .await?;

        // Tokenize + store term frequencies.
        let tf = term_frequencies(&content);
        // Clear old tokens for this file.
        sqlx::query("DELETE FROM rag_tokens WHERE path = ?")
            .bind(rel.as_str())
            .execute(&self.pool)
            .await?;
        for (term, count) in tf {
            sqlx::query("INSERT INTO rag_tokens (path, term, count) VALUES (?, ?, ?)")
                .bind(rel.as_str())
                .bind(term.as_str())
                .bind(count as i64)
                .execute(&self.pool)
                .await?;
        }
        Ok(())
    }

    /// Keyword search: tokenize the query, sum per-file TF scores, return the
    /// top `limit` hits with a snippet around the best match.
    pub async fn search(&self, query: &str, limit: usize) -> Result<Vec<RagHit>> {
        let terms = tokenize(query);
        if terms.is_empty() {
            return Ok(Vec::new());
        }

        // Build a dynamic `WHERE term IN (?, ?, ...)` clause.
        let placeholders = std::iter::repeat("?")
            .take(terms.len())
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT path, SUM(count) AS score FROM rag_tokens \
             WHERE term IN ({}) GROUP BY path ORDER BY score DESC LIMIT ?",
            placeholders
        );

        let mut q = sqlx::query(&sql);
        for t in &terms {
            q = q.bind(t.as_str());
        }
        q = q.bind(limit as i64);

        let rows = q.fetch_all(&self.pool).await?;
        let mut hits = Vec::with_capacity(rows.len());
        for row in rows {
            let path: String = row.try_get("path")?;
            let score: i64 = row.try_get("score")?;
            // Fetch the content for snippet extraction.
            let content_row =
                sqlx::query("SELECT content, language FROM rag_files WHERE path = ?")
                    .bind(&path)
                    .fetch_optional(&self.pool)
                    .await?;
            if let Some(r) = content_row {
                let content: String = r.try_get("content")?;
                let language: String = r.try_get("language")?;
                let snippet = extract_snippet(&content, &terms, 8);
                hits.push(RagHit {
                    path,
                    language,
                    score: score as f64,
                    snippet,
                });
            }
        }
        Ok(hits)
    }

    /// List all indexed files (for the TUI's context panel).
    pub async fn list(&self) -> Result<Vec<(String, String)>> {
        let rows = sqlx::query("SELECT path, language FROM rag_files ORDER BY path ASC")
            .fetch_all(&self.pool)
            .await?;
        let mut out = Vec::new();
        for row in rows {
            out.push((row.try_get("path")?, row.try_get("language")?));
        }
        Ok(out)
    }
}

// ---------------------------------------------------------------------------
// Tokenization + scoring
// ---------------------------------------------------------------------------

/// Split a string into lowercase tokens (alphanumeric runs, length >= 2).
fn tokenize(s: &str) -> Vec<String> {
    s.split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.len() >= 2)
        .map(|t| t.to_lowercase())
        .collect()
}

/// Term-frequency map for a document.
fn term_frequencies(content: &str) -> HashMap<String, usize> {
    let mut tf: HashMap<String, usize> = HashMap::new();
    for tok in tokenize(content) {
        *tf.entry(tok).or_insert(0) += 1;
    }
    tf
}

/// Extract a snippet of `radius` lines around the first line matching any term.
fn extract_snippet(content: &str, terms: &[String], radius: usize) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let match_idx = lines
        .iter()
        .position(|l| {
            let lower = l.to_lowercase();
            terms.iter().any(|t| lower.contains(t))
        })
        .unwrap_or(0);

    let start = match_idx.saturating_sub(radius);
    let end = (match_idx + radius + 1).min(lines.len());
    let mut out = String::new();
    for (i, l) in lines[start..end].iter().enumerate() {
        if i > 0 {
            out.push('\n');
        }
        out.push_str(l);
    }
    out
}

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

/// Walk `root` recursively and return every file with a recognized extension,
/// skipping common ignore directories.
fn collect_files(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if !root.exists() {
        return out;
    }
    walk(root, &mut out);
    out
}

// ---------------------------------------------------------------------------
// Module-level convenience (used by local.rs)
// ---------------------------------------------------------------------------

/// Quick module-level search that opens the default index and searches it.
/// Used by `local.rs` which doesn't hold an `RagIndex` instance.
pub async fn search(query: &str, limit: usize) -> Result<Vec<RagHit>> {
    let index = RagIndex::open().await?;
    index.search(query, limit).await
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if IGNORE_DIRS.contains(&name) {
                    continue;
                }
            }
            walk(&path, out);
        } else if is_indexable(&path) {
            out.push(path);
        }
    }
}

const IGNORE_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    ".next",
    "target",
    "dist",
    "build",
    "out",
    ".cache",
    ".turbo",
    "coverage",
];

fn is_indexable(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| INDEXED_EXTS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn language_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("rs") => "rust",
        Some("py") => "python",
        Some("ts") | Some("tsx") => "typescript",
        Some("js") | Some("jsx") => "javascript",
        Some("go") => "go",
        Some("md") => "markdown",
        Some("json") => "json",
        Some("java") => "java",
        Some("c") | Some("h") => "c",
        Some("cpp") => "cpp",
        _ => "text",
    }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS rag_files (
    path      TEXT PRIMARY KEY,
    language  TEXT NOT NULL DEFAULT 'text',
    content   TEXT NOT NULL,
    indexed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rag_tokens (
    path   TEXT NOT NULL,
    term   TEXT NOT NULL,
    count  INTEGER NOT NULL,
    PRIMARY KEY (path, term)
);
CREATE INDEX IF NOT EXISTS idx_rag_tokens_term ON rag_tokens(term);
"#;
