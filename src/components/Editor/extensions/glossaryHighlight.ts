import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  hoverTooltip,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate, Tooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { GlossaryEntry } from "../../../lib/types";

// 3.2 — Inline Glossary decoration + hover tooltip.
//
// Given the workspace's glossary entries (authored in Settings →
// Glossary and persisted to `.yarrow/glossary.json`), this extension:
//   • underlines every occurrence of each term inside the visible
//     viewport, with a `cm-yarrow-glossary` mark decoration;
//   • shows a hover tooltip with the definition when the mouse rests
//     over an underlined term.
//
// Matching is case-insensitive, word-boundary aware (so "shore" doesn't
// match "ashore" or "shoreline"), and prefers the longest term first —
// the backend sorts by character length descending so "data structure"
// wins over "data" when both could match. Markdown-fence-aware
// suppression is intentionally out of scope: glossary terms inside code
// spans still underline, because users frequently want to refer to
// defined terms from inside example blocks.

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a single ORed regex from the entry terms, longest first. The
 *  `\\b…\\b` boundaries make sure "shore" doesn't hit "ashore". We use
 *  case-insensitive matching at the regex level rather than lowercasing
 *  the document, so the term in the editor keeps its original case. */
function buildRegex(entries: GlossaryEntry[]): RegExp | null {
  if (entries.length === 0) return null;
  // Backend hands these to us longest-first; defensively re-sort in case
  // a caller passes an unsorted list.
  const sorted = [...entries].sort(
    (a, b) => b.term.length - a.term.length || a.term.localeCompare(b.term),
  );
  const parts = sorted
    .map((e) => e.term.trim())
    .filter((t) => t.length > 0)
    .map(escapeRegex);
  if (parts.length === 0) return null;
  return new RegExp(`\\b(?:${parts.join("|")})\\b`, "gi");
}

/** Build a lowercase term → entry index for fast lookup at hover time
 *  and tooltip rendering. */
function buildIndex(entries: GlossaryEntry[]): Map<string, GlossaryEntry> {
  const m = new Map<string, GlossaryEntry>();
  for (const e of entries) {
    m.set(e.term.trim().toLowerCase(), e);
  }
  return m;
}

/** Hover tooltip provider — fires whenever the user pauses over a
 *  position inside the editor. We look back/forward from `pos` to find
 *  the word boundary and check if the surrounding word is a known term.
 *  If so, return a tooltip; otherwise null so CodeMirror falls through
 *  to whatever other providers are registered (blame, etc.). */
function buildHoverTooltip(
  index: Map<string, GlossaryEntry>,
): (view: EditorView, pos: number, side: -1 | 1) => Tooltip | null {
  return (view, pos): Tooltip | null => {
    if (index.size === 0) return null;
    const doc = view.state.doc;
    const line = doc.lineAt(pos);
    const offset = pos - line.from;
    const text = line.text;
    // Find word boundaries. "Word" here = letters / digits / hyphens —
    // looser than CM's default since glossary terms can be multi-word
    // ("data structure"). We extend the boundary outward and check
    // longest-first up to a sensible cap.
    let start = offset;
    while (start > 0 && !/\s/.test(text[start - 1])) start--;
    let end = offset;
    while (end < text.length && !/\s/.test(text[end])) end++;
    // Examine windows up to the line's bounds, longest first. Cap at
    // 80 chars to bound work; glossary terms longer than that are
    // pathological.
    const maxLen = Math.min(80, text.length);
    for (let len = maxLen; len >= 1; len--) {
      for (let s = Math.max(0, start - len + 1); s <= Math.min(end, text.length - len); s++) {
        const candidate = text.slice(s, s + len);
        const key = candidate.trim().toLowerCase();
        if (!key) continue;
        if (key.length !== candidate.length) continue;
        const entry = index.get(key);
        if (entry) {
          const absS = line.from + s;
          const absE = absS + len;
          if (pos < absS || pos > absE) continue;
          const before = s > 0 ? text[s - 1] : " ";
          const after = s + len < text.length ? text[s + len] : " ";
          if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) {
            continue;
          }
          return {
            pos: absS,
            end: absE,
            above: true,
            create() {
              const root = document.createElement("div");
              root.className = "cm-yarrow-glossary-tip";
              const term = document.createElement("div");
              term.className = "cm-yarrow-glossary-tip__term";
              term.textContent = entry.term;
              const def = document.createElement("div");
              def.className = "cm-yarrow-glossary-tip__def";
              def.textContent = entry.definition;
              root.appendChild(term);
              root.appendChild(def);
              return { dom: root };
            },
          };
        }
      }
    }
    return null;
  };
}

/** Build the highlight decoration plugin for a given entry set. */
function highlightPlugin(entries: GlossaryEntry[]): Extension {
  const regex = buildRegex(entries);
  if (!regex) return [];
  const matcher = new MatchDecorator({
    regexp: regex,
    decoration: () => Decoration.mark({ class: "cm-yarrow-glossary" }),
  });
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = matcher.createDeco(view);
      }
      update(update: ViewUpdate) {
        this.decorations = matcher.updateDeco(update, this.decorations);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/** Top-level extension factory. The host should keep a Compartment
 *  around this so the entry list can be swapped without remounting the
 *  whole editor — see `NoteEditor.svelte` for the wiring. */
export function glossaryHighlight(entries: GlossaryEntry[]): Extension {
  if (entries.length === 0) return [];
  const index = buildIndex(entries);
  return [
    highlightPlugin(entries),
    hoverTooltip(buildHoverTooltip(index), {
      hideOn: (_tr, _tooltip) => false,
    }),
  ];
}
