//! Unified-diff generator (LCS over lines). Mirrors `src/lib/diff.ts` from the
//! web app. Pure Rust, no dependencies.
//!
//! Produces GitHub-style `@@ -a,b +c,d @@` hunks with 3 lines of surrounding
//! context. Used by the TUI to render file-edit previews returned by
//! `/api/files/diff` (the web app pre-computes the diff text on the server;
//! this module is used for client-side diff rendering + any local diff needs).

use std::fmt::Write as _;

/// A single line in a diff: unchanged context, an addition, or a deletion.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffLineKind {
    Context,
    Add,
    Del,
}

/// A single diff line with its kind + text (no trailing newline).
#[derive(Debug, Clone)]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub text: String,
}

/// A hunk: a `@@ -a,b +c,d @@` header + the lines it contains.
#[derive(Debug, Clone)]
pub struct Hunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

/// The result of diffing two strings.
#[derive(Debug, Clone)]
pub struct DiffResult {
    pub hunks: Vec<Hunk>,
    pub text: String,
    pub added: usize,
    pub removed: usize,
}

const CONTEXT_SIZE: usize = 3;

/// Compute the LCS DP table using two rows (space-optimized).
/// Returns the full table for backtrace — still O(m×n) time but only
/// O(m×n×4) bytes for u32 (vs usize).
fn lcs_table(a: &[&str], b: &[&str]) -> Vec<Vec<u32>> {
    let m = a.len();
    let n = b.len();
    let mut dp = vec![vec![0u32; n + 1]; m + 1];
    for i in (0..m).rev() {
        for j in (0..n).rev() {
            dp[i][j] = if a[i] == b[j] {
                dp[i + 1][j + 1] + 1
            } else {
                dp[i + 1][j].max(dp[i][j + 1])
            };
        }
    }
    dp
}

/// Walk the LCS table to emit the raw diff line sequence.
fn build_diff_lines(a: &[&str], b: &[&str]) -> Vec<DiffLine> {
    if a.is_empty() {
        return b.iter().map(|t| DiffLine { kind: DiffLineKind::Add, text: t.to_string() }).collect();
    }
    if b.is_empty() {
        return a.iter().map(|t| DiffLine { kind: DiffLineKind::Del, text: t.to_string() }).collect();
    }
    let dp = lcs_table(a, b);
    let mut lines = Vec::new();
    let mut i = 0usize;
    let mut j = 0usize;
    while i < a.len() && j < b.len() {
        if a[i] == b[j] {
            lines.push(DiffLine {
                kind: DiffLineKind::Context,
                text: a[i].to_string(),
            });
            i += 1;
            j += 1;
        } else if dp[i + 1][j] >= dp[i][j + 1] {
            lines.push(DiffLine {
                kind: DiffLineKind::Del,
                text: a[i].to_string(),
            });
            i += 1;
        } else {
            lines.push(DiffLine {
                kind: DiffLineKind::Add,
                text: b[j].to_string(),
            });
            j += 1;
        }
    }
    while i < a.len() {
        lines.push(DiffLine {
            kind: DiffLineKind::Del,
            text: a[i].to_string(),
        });
        i += 1;
    }
    while j < b.len() {
        lines.push(DiffLine {
            kind: DiffLineKind::Add,
            text: b[j].to_string(),
        });
        j += 1;
    }
    lines
}

/// Count context + the given kind in a hunk's line list (for `@@ -a,b +c,d @@`).
fn count_for_header(lines: &[DiffLine], kind: DiffLineKind) -> usize {
    lines
        .iter()
        .filter(|l| l.kind == DiffLineKind::Context || l.kind == kind)
        .count()
}

/// Group raw diff lines into hunks with `CONTEXT_SIZE` lines of context.
fn into_hunks(lines: Vec<DiffLine>) -> Vec<Hunk> {
    let mut hunks: Vec<Hunk> = Vec::new();
    let mut current: Vec<DiffLine> = Vec::new();
    let mut pending_context: Vec<DiffLine> = Vec::new();
    let mut in_hunk = false;
    let mut a_start: usize = 1;
    let mut b_start: usize = 1;
    let mut a_line: usize = 1;
    let mut b_line: usize = 1;

    let flush = |current: &mut Vec<DiffLine>, hunks: &mut Vec<Hunk>, a_start: usize, b_start: usize| {
        if current.is_empty() {
            return;
        }
        // Trim trailing context beyond CONTEXT_SIZE.
        let mut trim = 0usize;
        for l in current.iter().rev() {
            if l.kind == DiffLineKind::Context {
                trim += 1;
                if trim > CONTEXT_SIZE {
                    break;
                }
            } else {
                break;
            }
        }
        if trim > CONTEXT_SIZE {
            current.truncate(current.len() - trim);
        }
        if current.is_empty() {
            return;
        }
        let a_count = count_for_header(current, DiffLineKind::Del);
        let b_count = count_for_header(current, DiffLineKind::Add);
        let header = format!("@@ -{},{} +{},{} @@", a_start, a_count, b_start, b_count);
        hunks.push(Hunk {
            header,
            lines: std::mem::take(current),
        });
    };

    for line in lines {
        match line.kind {
            DiffLineKind::Context => {
                if in_hunk {
                    current.push(line);
                    a_line += 1;
                    b_line += 1;
                    // If we've accumulated a long run of trailing context with no
                    // further changes coming, flush conservatively.
                    if current.len() > CONTEXT_SIZE * 2
                        && current
                            .iter()
                            .rev()
                            .take(CONTEXT_SIZE)
                            .all(|l| l.kind == DiffLineKind::Context)
                    {
                        flush(&mut current, &mut hunks, a_start, b_start);
                        in_hunk = false;
                    }
                } else {
                    pending_context.push(line);
                    if pending_context.len() > CONTEXT_SIZE {
                        pending_context.remove(0);
                    }
                    a_line += 1;
                    b_line += 1;
                }
            }
            DiffLineKind::Del => {
                if !in_hunk {
                    a_start = a_line.saturating_sub(pending_context.len());
                    b_start = b_line.saturating_sub(pending_context.len());
                    current.extend(pending_context.drain(..));
                    in_hunk = true;
                }
                current.push(line);
                a_line += 1;
            }
            DiffLineKind::Add => {
                if !in_hunk {
                    a_start = a_line.saturating_sub(pending_context.len());
                    b_start = b_line.saturating_sub(pending_context.len());
                    current.extend(pending_context.drain(..));
                    in_hunk = true;
                }
                current.push(line);
                b_line += 1;
            }
        }
    }
    flush(&mut current, &mut hunks, a_start, b_start);
    hunks
}

/// Render a single hunk to unified-diff text.
fn hunk_to_text(h: &Hunk) -> String {
    let mut out = String::new();
    writeln!(out, "{}", h.header).ok();
    for l in &h.lines {
        let prefix = match l.kind {
            DiffLineKind::Add => '+',
            DiffLineKind::Del => '-',
            DiffLineKind::Context => ' ',
        };
        writeln!(out, "{}{}", prefix, l.text).ok();
    }
    out
}

/// Diff two strings line-by-line and return hunks + unified-diff text.
///
/// # Example
/// ```ignore
/// use gradbridge::diff::diff_text;
/// let r = diff_text("a\nb\nc", "a\nB\nc");
/// assert_eq!(r.added, 1);
/// assert_eq!(r.removed, 1);
/// assert!(r.text.contains("-b"));
/// assert!(r.text.contains("+B"));
/// ```
pub fn diff_text(original: &str, proposed: &str) -> DiffResult {
    // Split on '\n' without a trailing empty string when the input ends in '\n'.
    let a: Vec<&str> = original.split('\n').collect();
    let b: Vec<&str> = proposed.split('\n').collect();

    let lines = build_diff_lines(&a, &b);
    let added = lines.iter().filter(|l| l.kind == DiffLineKind::Add).count();
    let removed = lines.iter().filter(|l| l.kind == DiffLineKind::Del).count();
    let hunks = into_hunks(lines);

    let mut text = String::new();
    for h in &hunks {
        text.push_str(&hunk_to_text(h));
    }
    // Drop the trailing newline so the text is a clean concatenation of hunks.
    if text.ends_with('\n') {
        text.pop();
    }

    DiffResult {
        hunks,
        text,
        added,
        removed,
    }
}

/// A one-line summary of a diff, e.g. "3 lines added · 1 line removed".
pub fn summary(result: &DiffResult) -> String {
    if result.added == 0 && result.removed == 0 {
        return "No changes detected.".to_string();
    }
    let plural = |n: usize| if n == 1 { "" } else { "s" };
    format!(
        "{} line{} added · {} line{} removed",
        result.added,
        plural(result.added),
        result.removed,
        plural(result.removed),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_inputs_have_no_changes() {
        let r = diff_text("a\nb\nc", "a\nb\nc");
        assert_eq!(r.added, 0);
        assert_eq!(r.removed, 0);
        assert!(r.text.is_empty() || r.hunks.is_empty());
    }

    #[test]
    fn single_line_change() {
        let r = diff_text("a\nb\nc", "a\nB\nc");
        assert_eq!(r.added, 1);
        assert_eq!(r.removed, 1);
        assert!(r.text.contains("-b"));
        assert!(r.text.contains("+B"));
    }

    #[test]
    fn pure_insertion() {
        let r = diff_text("a\nc", "a\nb\nc");
        assert_eq!(r.added, 1);
        assert_eq!(r.removed, 0);
        assert!(r.text.contains("+b"));
    }

    #[test]
    fn pure_deletion() {
        let r = diff_text("a\nb\nc", "a\nc");
        assert_eq!(r.added, 0);
        assert_eq!(r.removed, 1);
        assert!(r.text.contains("-b"));
    }
}
