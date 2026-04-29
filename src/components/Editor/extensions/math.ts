import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import type katexType from "katex";

// ────────────── inline / block math (KaTeX) ──────────────
// Inline `$x$` and block `$$x$$` render as KaTeX widgets when the cursor
// is not inside the delimited range. The active range stays raw so
// editing the LaTeX source is straightforward. Code-fence regions are
// excluded so prose about math doesn't accidentally render.
//
// The KaTeX module is the weight driver here (~500 KB). Importing this
// file inside a dynamic import boundary (see NoteEditor's mount effect)
// keeps KaTeX out of the initial bundle — it's only fetched when the
// "Math" extra is on.

class MathInlineWidget extends WidgetType {
  constructor(readonly tex: string, readonly katex: typeof katexType) {
    super();
  }
  eq(other: MathInlineWidget) {
    return other.tex === this.tex;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-yarrow-math-inline";
    try {
      this.katex.render(this.tex, span, { throwOnError: false, displayMode: false });
    } catch {
      span.textContent = `$${this.tex}$`;
      span.classList.add("cm-yarrow-math-error");
    }
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

class MathBlockWidget extends WidgetType {
  constructor(readonly tex: string, readonly katex: typeof katexType) {
    super();
  }
  eq(other: MathBlockWidget) {
    return other.tex === this.tex;
  }
  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-yarrow-math-block";
    div.contentEditable = "false";
    try {
      this.katex.render(this.tex, div, { throwOnError: false, displayMode: true });
    } catch {
      div.textContent = `$$${this.tex}$$`;
      div.classList.add("cm-yarrow-math-error");
    }
    return div;
  }
  ignoreEvent() {
    return false;
  }
}

function mathPlugin(katex: typeof katexType): Extension {
  const INLINE_RE = /(?<!\$)\$([^\s$][^$\n]*?[^\s$]|[^\s$])\$(?!\$)/g;
  let loggedFirstBuild = false;
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.build(update.view);
        }
      }
      logFirstBuildOnce(matches: number) {
        if (loggedFirstBuild) return;
        loggedFirstBuild = true;
        console.info(
          `[yarrow] math plugin first build — found ${matches} delimited range(s)`,
        );
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;
        const sel = view.state.selection.main;
        let matchCount = 0;
        // Build a fence mask line-by-line so we skip math-looking text
        // inside code fences.
        const fenceMask = new Uint8Array(doc.lines + 1);
        let inFence = false;
        for (let n = 1; n <= doc.lines; n++) {
          const text = doc.line(n).text;
          if (/^\s*```/.test(text)) {
            fenceMask[n] = 1;
            inFence = !inFence;
          } else {
            fenceMask[n] = inFence ? 1 : 0;
          }
        }

        // ── block math: $$...$$ across lines ──
        // Scan the whole document so multi-line blocks render even if
        // only the closing line is in the viewport.
        const text = doc.toString();
        const blocks: Array<[number, number, string]> = [];
        let i = 0;
        while (i < text.length) {
          const open = text.indexOf("$$", i);
          if (open === -1) break;
          const startLine = doc.lineAt(open).number;
          if (fenceMask[startLine] === 1) {
            i = open + 2;
            continue;
          }
          const close = text.indexOf("$$", open + 2);
          if (close === -1) break;
          const endLine = doc.lineAt(close).number;
          if (fenceMask[endLine] === 1) {
            i = close + 2;
            continue;
          }
          const tex = text.slice(open + 2, close);
          blocks.push([open, close + 2, tex]);
          i = close + 2;
        }
        for (const [from, to, tex] of blocks) {
          const inside = sel.from <= to && sel.to >= from;
          if (inside) continue;
          builder.add(
            from,
            to,
            Decoration.replace({
              widget: new MathBlockWidget(tex, katex),
              block: true,
            }),
          );
          matchCount++;
        }

        // ── inline math: $...$ on a single line ──
        const blockRanges = blocks.map(([f, t]) => [f, t] as [number, number]);
        const inBlock = (pos: number) => blockRanges.some(([f, t]) => pos >= f && pos < t);

        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = doc.lineAt(pos);
            if (fenceMask[line.number] === 0 && !inBlock(line.from)) {
              INLINE_RE.lastIndex = 0;
              let m: RegExpExecArray | null;
              while ((m = INLINE_RE.exec(line.text)) !== null) {
                const start = line.from + m.index;
                const end = start + m[0].length;
                if (sel.from <= end && sel.to >= start) continue;
                builder.add(
                  start,
                  end,
                  Decoration.replace({
                    widget: new MathInlineWidget(m[1], katex),
                  }),
                );
                matchCount++;
              }
            }
            pos = line.to + 1;
          }
        }
        this.logFirstBuildOnce(matchCount);
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/** Async factory: pulls in KaTeX on demand, then returns a configured
 *  math plugin ready to drop into the editor's extensions array.
 *
 *  The KaTeX ESM build exposes both a `default` export (the katex
 *  object) and named exports (`render`, `renderToString`). Depending on
 *  how Vite's interop wraps the dynamic import, `.default` can end up
 *  double-wrapped or missing, so we normalize: prefer default, fall back
 *  to the module namespace itself if `.render` lives there directly.
 */
export async function loadMathExtension(): Promise<Extension> {
  const mod: any = await import("katex");
  const katex = pickKatex(mod);
  if (!katex || typeof katex.render !== "function") {
    throw new Error(
      `katex import resolved to an unexpected shape — keys: ${Object.keys(mod).join(",")}`,
    );
  }
  return mathPlugin(katex as unknown as typeof katexType);
}

function pickKatex(mod: any): any {
  if (mod && typeof mod.render === "function") return mod;
  if (mod && mod.default && typeof mod.default.render === "function") return mod.default;
  if (
    mod &&
    mod.default &&
    mod.default.default &&
    typeof mod.default.default.render === "function"
  ) {
    return mod.default.default;
  }
  return null;
}
