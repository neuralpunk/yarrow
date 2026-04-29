import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { isCorrect, loadSpell, suggest as spellSuggest } from "../../../lib/spell";

// ────────────── spell check ──────────────
// Underlines misspellings on visible lines. Skips code fences,
// wikilinks, URLs, and the active line so token edits aren't churned
// with squiggles. The English dictionary loads asynchronously; until
// ready the plugin produces no decorations.
//
// Rebuild discipline (2.1): the v2.0 plugin rebuilt the entire decoration
// set on every selection change, even when the doc was untouched and the
// active line hadn't crossed a boundary. On a long note that's tens of
// thousands of regex executions per cursor twitch. We now keep the prior
// decorations cached across selection-only updates and only rebuild when
// (a) the doc actually changed, (b) the viewport scrolled / resized, or
// (c) the active line changed (so the previously-skipped line gets
// re-decorated and the new active line is cleared). Saves measurable
// frame time on 5k-line drafts without changing visible behaviour.

const SPELL_WORD_RE = /[A-Za-z][A-Za-z'\-]{2,}/g;
const SPELL_SKIP_RE = /\[\[[^\]]+\]\]|`[^`]+`|https?:\/\/\S+/g;

function spellPluginFactory(): Extension {
  let ready = false;
  loadSpell()
    .then(() => {
      ready = true;
    })
    .catch(() => {});
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      activeLine = -1;
      // Cached fence mask + the doc tree reference it was built against.
      // Selection moves and viewport scrolls don't touch the fences, so
      // we re-use the cached mask whenever the doc reference is stable.
      // CodeMirror's `Text` is immutable; reference equality is a sound
      // staleness check.
      cachedFenceMask: Uint8Array | null = null;
      cachedFenceDoc: unknown = null;
      constructor(view: EditorView) {
        this.activeLine = view.state.doc.lineAt(view.state.selection.main.head).number;
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        const nextActive = update.state.doc.lineAt(
          update.state.selection.main.head,
        ).number;
        const activeChanged = nextActive !== this.activeLine;
        const needs =
          update.docChanged ||
          update.viewportChanged ||
          (update.selectionSet && activeChanged);
        if (needs) {
          this.activeLine = nextActive;
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        if (!ready) return builder.finish();
        const doc = view.state.doc;
        const sel = view.state.selection.main;
        const activeLine = doc.lineAt(sel.head).number;
        let fenceMask = this.cachedFenceDoc === doc ? this.cachedFenceMask : null;
        if (!fenceMask) {
          fenceMask = new Uint8Array(doc.lines + 1);
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
          this.cachedFenceMask = fenceMask;
          this.cachedFenceDoc = doc;
        }
        const ranges: Array<[number, number]> = [];
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = doc.lineAt(pos);
            if (line.number !== activeLine && fenceMask[line.number] === 0) {
              const text = line.text;
              const skip: Array<[number, number]> = [];
              SPELL_SKIP_RE.lastIndex = 0;
              let s: RegExpExecArray | null;
              while ((s = SPELL_SKIP_RE.exec(text)) !== null) {
                skip.push([s.index, s.index + s[0].length]);
              }
              const inSkip = (i: number) =>
                skip.some(([a, b]) => i >= a && i < b);
              SPELL_WORD_RE.lastIndex = 0;
              let m: RegExpExecArray | null;
              while ((m = SPELL_WORD_RE.exec(text)) !== null) {
                if (inSkip(m.index)) continue;
                const w = m[0];
                if (/^[A-Z]{2,}$/.test(w)) continue;
                if (!isCorrect(w)) {
                  ranges.push([line.from + m.index, line.from + m.index + w.length]);
                }
              }
            }
            pos = line.to + 1;
          }
        }
        ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        for (const [a, b] of ranges) {
          builder.add(a, b, Decoration.mark({ class: "cm-yarrow-misspelled" }));
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/** Async factory: loads the dictionary + returns a configured plugin.
 *  Also exposes the `suggest` function so the right-click handler can
 *  request alternatives for a misspelled word. */
export async function loadSpellExtension(): Promise<{
  extension: Extension;
  suggest: typeof spellSuggest;
}> {
  return {
    extension: spellPluginFactory(),
    suggest: spellSuggest,
  };
}
