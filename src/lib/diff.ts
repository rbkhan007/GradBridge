// Minimal unified-diff generator (LCS over lines). Zero dependencies.
// Produces GitHub-style @@ hunks with surrounding context.

export interface DiffLine {
  type: "context" | "add" | "del";
  text: string;
}

export interface DiffResult {
  hunks: { header: string; lines: DiffLine[] }[];
  text: string;
  added: number;
  removed: number;
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

function buildDiffLines(a: string[], b: string[]): DiffLine[] {
  const dp = lcs(a, b);
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: "context", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: "del", text: a[i] });
      i++;
    } else {
      lines.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < a.length) lines.push({ type: "del", text: a[i++] });
  while (j < b.length) lines.push({ type: "add", text: b[j++] });
  return lines;
}

/** Group raw diff lines into hunks with 3 lines of context. */
function intoHunks(lines: DiffLine[], contextSize = 3): DiffResult["hunks"] {
  const hunks: DiffResult["hunks"] = [];
  let current: DiffLine[] = [];
  let aStart = 0;
  let bStart = 0;
  let aLine = 1;
  let bLine = 1;
  let inHunk = false;
  let pendingContext: DiffLine[] = [];

  const flushHunk = () => {
    if (current.length === 0) return;
    // trim trailing context beyond contextSize
    let trim = 0;
    for (let k = current.length - 1; k >= 0; k--) {
      if (current[k].type === "context") {
        trim++;
        if (trim > contextSize) current.pop();
        else break;
      } else break;
    }
    hunks.push({
      header: `@@ -${aStart},${countLines(current, "del")} +${bStart},${countLines(current, "add")} @@`,
      lines: current,
    });
    current = [];
    inHunk = false;
  };

  for (const line of lines) {
    if (line.type === "context") {
      if (inHunk) {
        current.push(line);
        aLine++;
        bLine++;
        // if too much trailing context, flush
        if (
          current.length > contextSize * 2 &&
          current.slice(-contextSize).every((l) => l.type === "context")
        ) {
          // check if upcoming lines have more changes; we just flush conservatively
          flushHunk();
        }
      } else {
        pendingContext.push(line);
        if (pendingContext.length > contextSize) pendingContext.shift();
        aLine++;
        bLine++;
      }
    } else {
      if (!inHunk) {
        aStart = aLine - pendingContext.length;
        bStart = bLine - pendingContext.length;
        current = [...pendingContext];
        pendingContext = [];
        inHunk = true;
      }
      current.push(line);
      if (line.type === "del") aLine++;
      else bLine++;
    }
  }
  flushHunk();
  return hunks;
}

function countLines(lines: DiffLine[], type: "add" | "del"): number {
  const n = lines.filter((l) => l.type === type || l.type === "context").length;
  return n;
}

function hunkToText(h: DiffResult["hunks"][number]): string {
  const body = h.lines
    .map((l) => {
      const prefix = l.type === "add" ? "+" : l.type === "del" ? "-" : " ";
      return prefix + l.text;
    })
    .join("\n");
  return `${h.header}\n${body}`;
}

export function diffText(original: string, proposed: string): DiffResult {
  const a = original.split("\n");
  const b = proposed.split("\n");
  const lines = buildDiffLines(a, b);
  const hunks = intoHunks(lines);
  const text = hunks.map(hunkToText).join("\n");
  const added = lines.filter((l) => l.type === "add").length;
  const removed = lines.filter((l) => l.type === "del").length;
  return { hunks, text, added, removed };
}
