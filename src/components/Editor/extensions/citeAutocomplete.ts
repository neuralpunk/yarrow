import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import {
  CompletionContext,
  startCompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import type { NoteSummary } from "../../../lib/types";

// ────────────── @cite autocomplete (research kits) ──────────────
// Typing `@` followed by letters/digits opens a picker scoped to
// paper-tagged notes (with a graceful fall-through to all notes when
// nothing's tagged yet). Picking an item inserts a plain `[[Title]]`
// wikilink so the existing graph + reciprocal-link machinery picks it
// up unchanged — `@` is just a faster on-ramp, not a different syntax.
//
// Trigger pipeline (revised after a v2.1 user report that the picker
// wasn't appearing on `@bow`):
//
//   1. A `ViewPlugin` watches every doc change. If the change inserted
//      a single `@` at the cursor and that `@` isn't part of an email
//      / package name (preceding char isn't a word char), it calls
//      `startCompletion(view)`. ViewPlugin runs *after* the state has
//      updated, so `head` and `view.state` are guaranteed current.
//
//   2. `EditorView.inputHandler` is kept as a belt-and-suspenders
//      fallback for any edge case where `docChanged` doesn't surface
//      the @ keystroke through `iterChanges` reliably (rare, but seen
//      with some IME stacks).
//
//   3. CodeMirror's `activateOnTyping: true` (configured in
//      NoteEditor) opens completion on the next word character the
//      user types after `@`, which keeps the picker alive as the
//      query grows.
//
// Each layer is independently sufficient. Together they make the
// picker robust to the quirks of any one path failing.

function isPaperCard(n: NoteSummary): boolean {
  if (!n.tags) return false;
  return n.tags.some((t) => t.toLowerCase() === "paper");
}

// M10. Off-limits = anything that should never reach the network or
// surface in a "browse my vault" picker. `private` (the air-gap flag)
// and `encrypted` were always covered; the `clinical` tag is the
// other side of the air-gap rule (`notes::is_private` treats
// `clinical`-tagged notes as private even when the explicit flag is
// off — see `notes.rs`). Without this check the picker would happily
// list a clinical note's title to anyone who hits `@` in a public
// note in the same workspace.
function isOffLimits(n: NoteSummary): boolean {
  if (n.private || n.encrypted) return true;
  return !!n.tags?.some((t) => t.toLowerCase() === "clinical");
}

// M5. Memoize the option list per `notes` array reference. Without
// this, every keystroke in the @ trigger range filters the entire
// vault and allocates a fresh `Completion[]` — on a 500-note workspace
// the typing latency for `@bow` was visibly choppy. The notes array
// is rebuilt by the host (AppShell) whenever any note changes, so
// `notes === lastNotes` is a perfectly safe cache key.
let cachedNotes: NoteSummary[] | null = null;
let cachedOptions: Completion[] = [];

function buildOptions(notes: NoteSummary[]): Completion[] {
  if (cachedNotes === notes) return cachedOptions;
  const pool = notes.filter((n) => !isOffLimits(n));
  cachedOptions = pool.map((n) => {
    const title = n.title || n.slug;
    const paperCard = isPaperCard(n);
    return {
      label: title,
      detail: paperCard ? "paper" : (n.slug !== title ? n.slug : undefined),
      type: paperCard ? "function" : "text",
      // Bias paper-tagged notes above untagged ones. CodeMirror adds
      // this on top of the fuzzy-match score; 99 keeps paper-cards on
      // top even when an untagged note has a slightly tighter title
      // match against the query.
      boost: paperCard ? 99 : 0,
      apply: (view, _completion, from, to) => {
        // `from` lands one past the @ (we return `before.from + 1` below).
        // Back up one to include the @ in the replacement so the inserted
        // wikilink fully replaces the `@bow`-style trigger fragment.
        const insert = `[[${title}]]`;
        const realFrom = from - 1;
        view.dispatch({
          changes: { from: realFrom, to, insert },
          selection: { anchor: realFrom + insert.length },
          scrollIntoView: true,
          userEvent: "input.complete",
        });
      },
    };
  });
  cachedNotes = notes;
  return cachedOptions;
}

export function citeSource(getNotes: () => NoteSummary[]): CompletionSource {
  return (ctx: CompletionContext) => {
    const before = ctx.matchBefore(/@[A-Za-z0-9_\-]*/);
    if (!before || !before.text.startsWith("@")) return null;

    if (before.from > 0) {
      const prev = ctx.state.sliceDoc(before.from - 1, before.from);
      if (/[A-Za-z0-9_]/.test(prev)) return null;
    }

    const options = buildOptions(getNotes());
    if (options.length === 0) return null;

    return {
      // Position `from` AFTER the @. This is the critical fix for the
      // v2.1 bug where the picker never appeared: with `from` AT the @,
      // CodeMirror's fuzzy matcher tried to match `@bow` against titles
      // like "Bowlby 1969 — Attachment and Loss". The `@` had nothing to
      // map to in the title, so the matcher rejected every option and
      // the popup was empty (which renders as no popup at all).
      // Skipping the @ in the matched range makes the matcher compare
      // just `bow` against "Bowlby 1969…" — which is exactly the
      // matching shape we want, and is what produces a visible popup.
      from: before.from + 1,
      options,
      validFor: /^[A-Za-z0-9_\-]*$/,
    };
  };
}

// ─── trigger #1: post-update watcher (primary) ────────────────────────

/** Fires startCompletion the moment a single `@` lands at the cursor.
 *  Runs in the docChanged path so view.state is fully consistent — no
 *  setTimeout dance to hope CodeMirror has settled. */
export const citeAutoTrigger: Extension = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (!update.docChanged) return;
      const sel = update.state.selection.main;
      if (!sel.empty) return;
      const head = sel.head;
      if (head <= 0) return;

      // Was `@` the inserted text in this transaction, ending at the
      // cursor's current position?
      let triggered = false;
      update.changes.iterChanges((_fA, _tA, _fB, tB, inserted) => {
        if (triggered) return;
        if (tB !== head) return;
        if (inserted.toString() === "@") triggered = true;
      });
      if (!triggered) return;

      // Anti-trigger: skip on `name@example.com` / `npm install @vue`.
      if (head >= 2) {
        const prev = update.state.sliceDoc(head - 2, head - 1);
        if (/[A-Za-z0-9_]/.test(prev)) return;
      }

      // Defer one tick so any other update listeners (decorations,
      // measurement) settle before completion opens.
      setTimeout(() => startCompletion(update.view), 0);
    }
  },
);

// ─── trigger #2: input-handler fallback ───────────────────────────────

/** Belt-and-suspenders trigger. Some IME pipelines route the `@`
 *  keystroke through inputHandler but never produce a `docChanged`
 *  iterChanges entry the watcher can see (the insertion is treated
 *  as "composition" instead of a regular change). This handler
 *  catches that case. */
export const citeInputHandler: Extension = EditorView.inputHandler.of(
  (view, from, _to, text) => {
    if (text !== "@") return false;
    if (from > 0) {
      const prev = view.state.sliceDoc(from - 1, from);
      if (/[A-Za-z0-9_]/.test(prev)) return false;
    }
    setTimeout(() => startCompletion(view), 0);
    return false;
  },
);
