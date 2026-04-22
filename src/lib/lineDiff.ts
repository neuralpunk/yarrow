// Minimal line-level diff — a classic LCS dynamic-program, returning an
// ordered sequence of operations suitable for rendering a side-by-side or
// unified diff. Sufficient for comparing note bodies that fit in a few
// dozen KB; not optimised for massive documents.
//
// We keep this ours (no dep pull) because the behavior we need is small
// and stable: lines compared as strings, no sub-line granularity, no
// similarity heuristics.

export type DiffOpKind = "eq" | "add" | "del";

export interface DiffOp {
  kind: DiffOpKind;
  /** For "eq" and "del", the line from the left side. Empty for pure "add". */
  left?: string;
  /** For "eq" and "add", the line from the right side. Empty for pure "del". */
  right?: string;
  /** Zero-indexed source line numbers for the side the line came from. */
  leftNo?: number;
  rightNo?: number;
}

export function lineDiff(leftText: string, rightText: string): DiffOp[] {
  const a = leftText.split("\n");
  const b = rightText.split("\n");
  const n = a.length;
  const m = b.length;

  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "eq", left: a[i], right: b[j], leftNo: i, rightNo: j });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", left: a[i], leftNo: i });
      i++;
    } else {
      out.push({ kind: "add", right: b[j], rightNo: j });
      j++;
    }
  }
  while (i < n) { out.push({ kind: "del", left: a[i], leftNo: i }); i++; }
  while (j < m) { out.push({ kind: "add", right: b[j], rightNo: j }); j++; }

  return out;
}

// ─── Token-level sub-line diff (Ley Lines) ────────────────────────────
//
// Splits a line into words, numbers, whitespace runs, and single-char
// punctuation so reassembly is lossless. Runs the same LCS backbone over
// tokens instead of lines. For heavily-rewritten paragraphs (survival
// ratio < 0.4), the returned ops collapse to a single del+ins pair —
// otherwise token-level shrapnel produces a mess of one-letter chips
// that carry no useful signal.

export type TokenOpKind = "eq" | "add" | "del";
export interface TokenOp {
  kind: TokenOpKind;
  text: string;
}
export interface TokenLineDiff {
  ops: TokenOp[];
  /** True when the diff was too noisy to render interleaved — callers
   *  should show `ops[0]` (del) + `ops[1]` (add) as a single swap. */
  shrapnel: boolean;
  /** `eqTokens / max(aTokens, bTokens)`, in [0,1]. */
  survivalRatio: number;
}

const TOKEN_RE = /[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:[.,]\d+)?|\s+|[^\s\w]/g;
const SHRAPNEL_THRESHOLD = 0.4;

function tokenize(s: string): string[] {
  return s.match(TOKEN_RE) ?? [];
}

export function tokenDiff(a: string, b: string): TokenLineDiff {
  const at = tokenize(a);
  const bt = tokenize(b);
  const n = at.length;
  const m = bt.length;

  if (n === 0 && m === 0) return { ops: [], shrapnel: false, survivalRatio: 1 };

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (at[i] === bt[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: TokenOp[] = [];
  let eqTokens = 0;
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (at[i] === bt[j]) {
      pushOp(ops, "eq", at[i]);
      eqTokens++;
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushOp(ops, "del", at[i]);
      i++;
    } else {
      pushOp(ops, "add", bt[j]);
      j++;
    }
  }
  while (i < n) { pushOp(ops, "del", at[i]); i++; }
  while (j < m) { pushOp(ops, "add", bt[j]); j++; }

  const survivalRatio = Math.max(n, m) === 0 ? 1 : eqTokens / Math.max(n, m);
  if (survivalRatio < SHRAPNEL_THRESHOLD && (a.length > 0 || b.length > 0)) {
    const collapsed: TokenOp[] = [];
    if (a.length > 0) collapsed.push({ kind: "del", text: a });
    if (b.length > 0) collapsed.push({ kind: "add", text: b });
    return { ops: collapsed, shrapnel: true, survivalRatio };
  }
  return { ops, shrapnel: false, survivalRatio };
}

// Merge adjacent same-kind ops so the renderer doesn't emit one span per
// token — `€` + `10` + `,` + `000` becomes a single `€10,000` add.
function pushOp(ops: TokenOp[], kind: TokenOpKind, text: string) {
  const last = ops[ops.length - 1];
  if (last && last.kind === kind) last.text += text;
  else ops.push({ kind, text });
}

// ─── Line-change map (for the gutter + aggregator) ────────────────────
//
// Folds the output of `lineDiff` into a per-right-line record keyed on
// the path's line number — gutter markers and path-view aggregation
// both walk this. Consecutive del+add pairs become a single `mod` so
// the gutter shows one amber dot for "this line was edited" instead of
// stacked red/green.

export type LineChangeKind = "add" | "del" | "mod";
export interface LineChange {
  kind: LineChangeKind;
  /** The main-side line; absent for a pure `add`. */
  leftText?: string;
  /** The path-side line; absent for a pure `del`. */
  rightText?: string;
  /** 0-indexed line number on the path side. For `del` with no right
   *  counterpart we use the rightNo where the deletion *appears* in
   *  reading order (i.e. the next surviving line), letting callers
   *  render a placeholder at that position. */
  rightLineNo: number;
  leftLineNo?: number;
}

export function lineDiffChanges(
  mainBody: string,
  pathBody: string,
): Map<number, LineChange> {
  const ops = lineDiff(mainBody, pathBody);
  const out = new Map<number, LineChange>();
  let nextRight = 0;
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (op.kind === "eq") {
      nextRight = (op.rightNo ?? nextRight) + 1;
      continue;
    }
    if (op.kind === "del") {
      // A `del` followed immediately by an `add` at the same slot is a
      // modification — coalesce so the gutter reads "edited" not
      // "removed then added."
      const next = ops[k + 1];
      if (next && next.kind === "add") {
        const rightNo = next.rightNo ?? nextRight;
        out.set(rightNo, {
          kind: "mod",
          leftText: op.left ?? "",
          rightText: next.right ?? "",
          rightLineNo: rightNo,
          leftLineNo: op.leftNo,
        });
        nextRight = rightNo + 1;
        k++; // consume the add
        continue;
      }
      // Pure delete — anchor to the current reading position on the right.
      out.set(nextRight, {
        kind: "del",
        leftText: op.left ?? "",
        rightLineNo: nextRight,
        leftLineNo: op.leftNo,
      });
      continue;
    }
    // pure add
    const rightNo = op.rightNo ?? nextRight;
    out.set(rightNo, {
      kind: "add",
      rightText: op.right ?? "",
      rightLineNo: rightNo,
    });
    nextRight = rightNo + 1;
  }
  return out;
}

/** Collapse runs of "eq" lines into a single marker so the rendered diff
 *  focuses on the changes without scrolling past long unchanged regions.
 *  Keeps `context` lines on each side of a change block. */
export function foldUnchanged(ops: DiffOp[], context = 2): DiffOp[] {
  const out: DiffOp[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].kind === "eq") {
      // Start of an eq run
      let end = i;
      while (end < ops.length && ops[end].kind === "eq") end++;
      const runLen = end - i;

      // Context to keep at the top of the run (if this isn't the very start).
      const keepTop = i === 0 ? 0 : Math.min(context, runLen);
      // Context to keep at the bottom (if this isn't the very end).
      const keepBottom = end === ops.length ? 0 : Math.min(context, runLen - keepTop);
      const hiddenCount = runLen - keepTop - keepBottom;

      for (let k = 0; k < keepTop; k++) out.push(ops[i + k]);
      if (hiddenCount > 0) {
        out.push({ kind: "eq", left: `@@ ${hiddenCount} unchanged line${hiddenCount === 1 ? "" : "s"} @@`, right: undefined, leftNo: undefined, rightNo: undefined });
      }
      for (let k = 0; k < keepBottom; k++) out.push(ops[end - keepBottom + k]);
      i = end;
    } else {
      out.push(ops[i]);
      i++;
    }
  }
  return out;
}
