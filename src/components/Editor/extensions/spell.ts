import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { isCorrect, loadSpell, suggest as spellSuggest } from "../../../lib/spell";

// ────────────── spell check ──────────────
// Underlines misspellings on visible lines. Skips code fences,
// wikilinks, URLs, and the active line so token edits aren't churned
// with squiggles. The English dictionary loads asynchronously; until
// ready the plugin produces no decorations.
//
// The ~800 KB dictionary + nspell runtime live inside `../../../lib/spell`
// — this module imports from there, which means pulling in *this* module
// (via NoteEditor's dynamic import) is what triggers the dictionary
// fetch. Keeping the import here is the whole point of the split.

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
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        if (!ready) return builder.finish();
        const doc = view.state.doc;
        const sel = view.state.selection.main;
        const activeLine = doc.lineAt(sel.head).number;
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
