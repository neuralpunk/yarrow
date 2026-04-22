import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  CompletionContext,
  startCompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import type { NoteSummary } from "../../../lib/types";

// ────────────── Wikilink autocomplete ──────────────
// Typing `[[` anywhere opens a dropdown of note titles filtered by what
// you type after the brackets. Enter inserts `[[Full Title]]`, auto-
// closing whatever brackets `closeBrackets` left ahead of the cursor so
// you don't end up with `[[Title]]]]`. This replaces the old typeahead
// that was removed in 1.2 for WebKit/Wayland flakiness — the fix was to
// render the tooltip in `document.body` (see `tooltips(...)` in the main
// editor extensions list), not to rip the feature out.

/** Completion source. Takes a getter so the source stays current even
 *  when notes are created/renamed without the editor remounting. */
export function wikilinkSource(getNotes: () => NoteSummary[]): CompletionSource {
  return (ctx: CompletionContext) => {
    // Match `[[` followed by any non-`]` characters up to the cursor.
    const before = ctx.matchBefore(/\[\[[^\]\n]*/);
    if (!before || !before.text.startsWith("[[")) return null;
    const query = before.text.slice(2).toLowerCase();
    const pool = getNotes();
    const options: Completion[] = pool
      .filter((n) => {
        if (!query) return true;
        return (
          n.title.toLowerCase().includes(query) ||
          n.slug.toLowerCase().includes(query)
        );
      })
      .slice(0, 20)
      .map((n) => {
        const title = n.title || n.slug;
        return {
          label: title,
          detail: n.slug !== title ? n.slug : undefined,
          type: "text",
          apply: (view, _completion, from, to) => {
            // If `closeBrackets` (or an earlier edit) left a `]` or `]]`
            // right after the range, consume it so we don't end up with
            // stray closers. Otherwise append the full `]]` ourselves.
            const docLen = view.state.doc.length;
            const ahead2 = to + 2 <= docLen ? view.state.sliceDoc(to, to + 2) : "";
            const ahead1 = to + 1 <= docLen ? view.state.sliceDoc(to, to + 1) : "";
            let replaceTo = to;
            if (ahead2 === "]]") replaceTo = to + 2;
            else if (ahead1 === "]") replaceTo = to + 1;
            const insert = `[[${title}]]`;
            view.dispatch({
              changes: { from, to: replaceTo, insert },
              selection: { anchor: from + insert.length },
              scrollIntoView: true,
              userEvent: "input.complete",
            });
          },
        };
      });
    if (options.length === 0) return null;
    return {
      from: before.from,
      options,
      // Keep the popup alive while the user keeps typing inside the
      // brackets — each character narrows the filter. The regex rejects
      // a newline or `]` so the popup closes as soon as the link closes.
      validFor: /^\[\[[^\]\n]*$/,
    };
  };
}

/** Explicitly trigger completion the moment the user types the second
 *  `[`. CodeMirror's `activateOnTyping` only fires on word characters,
 *  and `[` isn't one — without this, the dropdown would only appear on
 *  Ctrl-Space. */
export const wikilinkInputHandler: Extension = EditorView.inputHandler.of(
  (view, from, _to, text) => {
    if (text !== "[") return false;
    if (from === 0) return false;
    // The prior char must also be `[` — i.e. we've just typed `[[`.
    // `closeBrackets` may insert a matching `]` after either of them,
    // but that doesn't change the character immediately before `from`.
    const prev = view.state.sliceDoc(from - 1, from);
    if (prev !== "[") return false;
    // Defer to the next tick so the `[` insertion and any
    // `closeBrackets` follow-up settle before we ask completion to open.
    setTimeout(() => startCompletion(view), 0);
    return false;
  },
);
