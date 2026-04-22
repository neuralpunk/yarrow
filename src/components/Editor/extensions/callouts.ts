import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";

// ────────────── Obsidian-style callouts ──────────────
// A blockquote whose first line contains `[!type]` becomes a stylized
// callout: `> [!question] Why?`. Supported types render with distinct
// border / icon / tint via CSS in `index.css`. The whole thing is just
// line-level decoration — the raw markdown stays visible and editable.
// Reading mode gets a richer treatment via a backend post-processor.

const CALLOUT_TYPES = new Set([
  "note",
  "info",
  "tip",
  "question",
  "decision",
  "warning",
  "danger",
  "quote",
]);

const TITLE_RE = /^>\s*\[!([a-zA-Z][a-zA-Z0-9-]*)\]\s*(.*)$/;
const CONTINUE_RE = /^>\s?/;

interface CalloutBlock {
  type: string;
  startLine: number;
  endLine: number;
}

/** Find every callout block in the document (first line matches
 *  `> [!type]`, subsequent blockquote lines belong to it). */
function scanCallouts(doc: {
  lines: number;
  line: (n: number) => { text: string };
}): CalloutBlock[] {
  const out: CalloutBlock[] = [];
  for (let n = 1; n <= doc.lines; n++) {
    const text = doc.line(n).text;
    const m = TITLE_RE.exec(text);
    if (!m) continue;
    const type = m[1].toLowerCase();
    if (!CALLOUT_TYPES.has(type)) continue;
    let end = n;
    for (let k = n + 1; k <= doc.lines; k++) {
      if (CONTINUE_RE.test(doc.line(k).text)) end = k;
      else break;
    }
    out.push({ type, startLine: n, endLine: end });
    n = end;
  }
  return out;
}

function calloutsPlugin(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const blocks = scanCallouts(view.state.doc);
        for (const b of blocks) {
          const first = view.state.doc.line(b.startLine);
          const last = view.state.doc.line(b.endLine);
          // Skip blocks that fall entirely outside the viewport — the
          // line iteration itself is cheap, but adding decorations
          // outside visible ranges triggers extra layout work.
          const visible = view.visibleRanges.some(
            (r) => r.from <= last.to && r.to >= first.from,
          );
          if (!visible) continue;
          for (let n = b.startLine; n <= b.endLine; n++) {
            const line = view.state.doc.line(n);
            const classes = [
              "cm-yarrow-callout",
              `cm-yarrow-callout-${b.type}`,
            ];
            if (n === b.startLine) classes.push("cm-yarrow-callout-head");
            if (n === b.endLine) classes.push("cm-yarrow-callout-tail");
            builder.add(
              line.from,
              line.from,
              Decoration.line({ attributes: { class: classes.join(" ") } }),
            );
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}

export default calloutsPlugin;
