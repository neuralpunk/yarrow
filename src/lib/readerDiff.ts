// Ley Lines · reader-mode diff synthesizer.
//
// Given main's body and the path's body, produce a markdown string that
// — once rendered by the backend's pulldown-cmark pipeline — carries
// inline `<del>`/`<ins>` tokens on modified lines and a stable class
// sentinel on added/removed blocks. The reader runs the post-processor
// below on the resulting HTML to add `.ley-changed` to each containing
// block element and pull sentinel-only paragraphs into annotated
// placeholders for deletions.
//
// Strategy (keeps pulldown-cmark happy):
//   * Modified line: substitute the line with its token-level diff
//     written as raw inline HTML (`<del>old</del><ins>new</ins>`).
//     pulldown-cmark passes raw inline HTML through.
//   * Added line: wrap the line text in `<ins class="ley-ins-line">…`
//     — the containing block gets `.ley-changed` post-render.
//   * Removed line: synthesise a placeholder line
//     `<del class="ley-del-line">main's deleted line</del>` at the
//     position where it *would* have appeared on the path side. Reads
//     as a ghostly strike-through line inside the prose.

import { lineDiffChanges, tokenDiff } from "./lineDiff";

export function synthesizeDiffMarkdown(
  mainBody: string,
  pathBody: string,
): { markdown: string; hasChanges: boolean } {
  const changes = lineDiffChanges(mainBody, pathBody);
  if (changes.size === 0) return { markdown: pathBody, hasChanges: false };

  const out: string[] = [];
  const pathLines = pathBody.split("\n");
  for (let i = 0; i < pathLines.length; i++) {
    const ch = changes.get(i);
    if (!ch) {
      out.push(pathLines[i]);
      continue;
    }
    if (ch.kind === "mod") {
      out.push(renderModLine(ch.leftText ?? "", ch.rightText ?? ""));
    } else if (ch.kind === "add") {
      // Keep list markers / block markers intact by wrapping only the
      // trailing text content — but for v1, wrap the whole line. The
      // CSS on `.ley-ins-line` keeps block markers readable.
      out.push(`<ins class="ley-ins-line">${escapeHtml(pathLines[i])}</ins>`);
    } else {
      // Pure deletion anchored at the current path position. Render the
      // deleted line as a strike-through annotation so the reader can
      // see *what used to be here*. We still emit the path's original
      // line below (if any) — deletions are injected, not substituted.
      out.push(`<del class="ley-del-line">${escapeHtml(ch.leftText ?? "")}</del>`);
      if (i < pathLines.length) out.push(pathLines[i]);
    }
  }
  // Trailing pure-deletions: the map keys beyond pathLines.length.
  for (const [lineNo, ch] of changes) {
    if (ch.kind !== "del") continue;
    if (lineNo < pathLines.length) continue;
    out.push(`<del class="ley-del-line">${escapeHtml(ch.leftText ?? "")}</del>`);
  }
  return { markdown: out.join("\n"), hasChanges: true };
}

function renderModLine(mainLine: string, pathLine: string): string {
  const { ops, shrapnel } = tokenDiff(mainLine, pathLine);
  if (shrapnel) {
    return (
      `<del class="ley-del">${escapeHtml(mainLine)}</del>` +
      ` <ins class="ley-ins">${escapeHtml(pathLine)}</ins>`
    );
  }
  const parts: string[] = [];
  for (const op of ops) {
    const t = escapeHtml(op.text);
    if (op.kind === "eq") parts.push(t);
    else if (op.kind === "del") parts.push(`<del class="ley-del">${t}</del>`);
    else parts.push(`<ins class="ley-ins">${t}</ins>`);
  }
  return parts.join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Walks the rendered HTML, finds any block-level ancestor containing
 *  a `<del>` or `<ins>` with a ley-* class, and tags it with
 *  `.ley-changed` so CSS can paint the left change-bar. */
export function decorateChangedBlocks(root: HTMLElement) {
  const marks = root.querySelectorAll<HTMLElement>(
    ".ley-del, .ley-ins, .ley-del-line, .ley-ins-line",
  );
  const BLOCKS = new Set([
    "P", "LI", "H1", "H2", "H3", "H4", "H5", "H6",
    "BLOCKQUOTE", "TD", "TH",
  ]);
  for (const el of marks) {
    let cur: HTMLElement | null = el;
    while (cur && cur !== root && !BLOCKS.has(cur.tagName)) {
      cur = cur.parentElement;
    }
    if (cur && cur !== root) cur.classList.add("ley-changed");
  }
}
