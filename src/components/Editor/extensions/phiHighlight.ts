import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { scanForPhi, type PhiMatch } from "../../../lib/phiScan";

// PHI inline highlighter (2.1). Loaded lazily from NoteEditor only when
// the active note is private (frontmatter.private || tag includes
// "clinical"). On every doc change it re-scans the body and decorates
// matches with `cm-yarrow-phi`. After each rebuild it dispatches a
// `yarrow:phi-detected` event so the shell can render a discreet count
// in the editor footer.
//
// Re-scan policy: we only rebuild on docChanged or viewportChanged.
// Selection moves don't change PHI status; skipping them keeps the
// scanner off the cursor-tick critical path.

const SCAN_DEBOUNCE_MS = 250;

export function phiHighlight(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      timer: number | null = null;
      lastCount = -1;

      constructor(view: EditorView) {
        this.schedule(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.schedule(update.view);
        }
      }
      destroy() {
        if (this.timer != null) window.clearTimeout(this.timer);
        // Drop any "N possible PHI" UI when the editor unmounts —
        // otherwise a stale banner would linger after a note close.
        window.dispatchEvent(
          new CustomEvent("yarrow:phi-detected", { detail: { count: 0 } }),
        );
      }
      schedule(view: EditorView) {
        if (this.timer != null) window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.run(view), SCAN_DEBOUNCE_MS);
      }
      run(view: EditorView) {
        const text = view.state.doc.toString();
        const matches = scanForPhi(text);
        const builder = new RangeSetBuilder<Decoration>();
        for (const m of matches) {
          builder.add(
            m.from,
            m.to,
            Decoration.mark({
              class: "cm-yarrow-phi",
              attributes: { title: phiTitle(m) },
            }),
          );
        }
        const next = builder.finish();
        // Only force a remeasure when the decoration set actually changed.
        // The scanner runs every 250ms; on idle notes the matches stay
        // identical, but `view.update([])` was being called unconditionally
        // and triggering a full CodeMirror layout pass each time. That
        // showed up as constant low-grade jank while typing in long
        // clinical notes.
        const changed = !rangesetEqual(this.decorations, next);
        this.decorations = next;
        if (changed) view.update([]);
        if (matches.length !== this.lastCount) {
          this.lastCount = matches.length;
          window.dispatchEvent(
            new CustomEvent("yarrow:phi-detected", {
              detail: { count: matches.length, matches },
            }),
          );
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

function phiTitle(m: PhiMatch): string {
  return `Possible ${m.kind.toUpperCase()} — review before saving`;
}

// Cheap structural equality for two RangeSet<Decoration>. CodeMirror's
// RangeSet doesn't expose a public deep-equality, but the cursor walks
// both sets in lock-step and bails on the first divergence — O(n) where
// n is the larger range count, with an early exit on mismatch. The PHI
// scanner produces small range sets (typically <20 matches even on
// dense clinical notes), so this is a few microseconds at worst.
function rangesetEqual(
  a: DecorationSet,
  b: DecorationSet,
): boolean {
  if (a.size !== b.size) return false;
  const ai = a.iter();
  const bi = b.iter();
  while (ai.value && bi.value) {
    if (ai.from !== bi.from || ai.to !== bi.to) return false;
    if (ai.value.spec.class !== bi.value.spec.class) return false;
    ai.next();
    bi.next();
  }
  return !ai.value && !bi.value;
}
