import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import {
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionSource,
} from "@codemirror/autocomplete";

// ──────────────  Slash commands  ──────────────
//
// Modeled on Obsidian's `/` panel: type "/" at the start of a line or
// after whitespace, get a filterable list of insertions and actions.
//
// Two flavors of command:
//   - "insert" commands replace the typed `/<query>` with markdown text
//     (heading, callout, table, wikilink scaffold, …). Stay in-editor.
//   - "action" commands remove the typed `/<query>` and dispatch an
//     id to the host (`onAction`). The host (AppShell) decides what
//     happens: open a modal, toggle a mode, run a palette command.

export interface SlashCommand {
  /** Stable id; used by `action` and as a debug tag. */
  id: string;
  /** Display label. Shown in the panel. */
  label: string;
  /** Short detail shown right of the label in dim text. */
  detail?: string;
  /** Optional shortcut hint (e.g. "⌘K"); shown right-aligned. */
  shortcut?: string;
  /** If set, the slash range is replaced with this string. Mutually
   *  exclusive with `action`. */
  insert?: string;
  /** Cursor offset from the start of `insert` after replacement. Defaults
   *  to the end of `insert`. */
  cursorOffset?: number;
  /** If set, the slash range is removed and this id is dispatched to the
   *  host via `onAction`. Mutually exclusive with `insert`. */
  action?: string;
}

export interface SlashContext {
  /** Dispatched when an action-flavored slash command is picked. */
  onAction: (id: string) => void;
}

const BUILTIN_COMMANDS: SlashCommand[] = [
  // ── Headings ──
  { id: "h1", label: "Heading 1", detail: "# ", insert: "# " },
  { id: "h2", label: "Heading 2", detail: "## ", insert: "## " },
  { id: "h3", label: "Heading 3", detail: "### ", insert: "### " },

  // ── Block elements ──
  { id: "quote", label: "Quote block", detail: "> ", insert: "> " },
  { id: "callout", label: "Callout", detail: "> [!note]", insert: "> [!note]\n> ", cursorOffset: 13 },
  { id: "list", label: "Bulleted list", detail: "- ", insert: "- " },
  { id: "numbered", label: "Numbered list", detail: "1. ", insert: "1. " },
  { id: "checkbox", label: "Checkbox", detail: "- [ ] ", insert: "- [ ] " },
  { id: "hr", label: "Horizontal rule", detail: "---", insert: "---\n" },
  { id: "code", label: "Code block", detail: "```", insert: "```\n\n```\n", cursorOffset: 4 },
  { id: "math", label: "Math block", detail: "$$", insert: "$$\n\n$$\n", cursorOffset: 3 },
  { id: "table", label: "Table", detail: "2-column", insert: "| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n", cursorOffset: 49 },

  // ── Linking ──
  { id: "link", label: "Add internal link", detail: "[[…]]", insert: "[[" },
  { id: "embed", label: "Add embed", detail: "![[…]]", insert: "![[" },
  { id: "tag", label: "Add tag", detail: "#…", insert: "#" },
  { id: "question", label: "Open question", detail: "?? marker", insert: "?? " },

  // ── App-level (action) ──
  { id: "palette", label: "Command palette…", shortcut: "⌘K", action: "palette" },
  { id: "scratchpad", label: "Open scratchpad", action: "scratchpad" },
  { id: "focus", label: "Toggle focus mode", action: "focus" },
  { id: "history", label: "Open history slider", action: "history" },
];

/** Score a command against the user's query. Higher = better match.
 *  Mirrors the wikilink scorer's shape so the ranking feels consistent. */
function scoreCommand(cmd: SlashCommand, q: string): number {
  if (!q) return 1;
  const label = cmd.label.toLowerCase();
  const detail = (cmd.detail ?? "").toLowerCase();
  const id = cmd.id.toLowerCase();
  if (label === q) return 1000;
  if (label.startsWith(q)) return 800 - label.length;
  if (id === q) return 700;
  if (id.startsWith(q)) return 500;
  // Word-boundary in label: " q" / ":q" / "-q"
  const wb = new RegExp(`(^|[\\s:\\-_/])${q.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}`).exec(label);
  if (wb) return 600 - (wb.index ?? 0);
  if (label.includes(q)) return 400 - label.indexOf(q);
  if (detail.includes(q)) return 200;
  if (id.includes(q)) return 100;
  return -Infinity;
}

export function slashSource(ctx: SlashContext): CompletionSource {
  return (cc: CompletionContext) => {
    const before = cc.matchBefore(/\/[\w-]*/);
    if (!before) return null;

    // Confirm the `/` actually starts a slash command — i.e. it's at
    // position 0, at the start of a line, or after a whitespace
    // character. This keeps URL paths and `src/foo` from triggering.
    const slashPos = before.from;
    if (slashPos > 0) {
      const charBefore = cc.state.sliceDoc(slashPos - 1, slashPos);
      if (!/\s/.test(charBefore)) return null;
    }

    const query = before.text.slice(1).toLowerCase();
    const commands: SlashCommand[] = BUILTIN_COMMANDS;

    const ranked = commands
      .map((c) => ({ cmd: c, score: scoreCommand(c, query) }))
      .filter((x) => x.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .slice(0, 24);

    if (ranked.length === 0) return null;

    const options: Completion[] = ranked.map(({ cmd }) => {
      const detail = cmd.shortcut
        ? cmd.shortcut
        : cmd.detail
          ? cmd.detail
          : undefined;
      return {
        label: cmd.label,
        detail,
        type: cmd.action ? "function" : "text",
        apply: (view, _completion, _from, to) => {
          if (cmd.insert !== undefined) {
            const cursor = cmd.cursorOffset ?? cmd.insert.length;
            view.dispatch({
              changes: { from: slashPos, to, insert: cmd.insert },
              selection: { anchor: slashPos + cursor },
              scrollIntoView: true,
              userEvent: "input.complete",
            });
          } else {
            view.dispatch({
              changes: { from: slashPos, to, insert: "" },
              selection: { anchor: slashPos },
              userEvent: "input.complete",
            });
            if (cmd.action) ctx.onAction(cmd.action);
          }
        },
      };
    });

    return {
      // Position `from` AFTER the slash. Mirrors the fix in
      // `citeAutocomplete.ts`: with `from` AT the `/`, CodeMirror's
      // fuzzy matcher would try to match `/heading` against label
      // "Heading 1" — the `/` has nothing to map to, every option is
      // rejected, and the popup renders as empty (which displays as
      // "nothing happens"). Skipping the slash lets the matcher
      // compare just `heading` against "Heading 1".
      from: slashPos + 1,
      options,
      validFor: /^[\w-]*$/,
    };
  };
}

// ─── trigger #1: post-update watcher (primary) ────────────────────────

/** Fires startCompletion the moment a single `/` lands at the cursor.
 *  Runs in the docChanged path so view.state is fully consistent — no
 *  setTimeout-and-hope dance. Mirrors the pattern from
 *  `citeAutocomplete.ts`'s `citeAutoTrigger` because the input-handler
 *  trigger alone has historically been unreliable across IME stacks. */
export const slashAutoTrigger: Extension = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (!update.docChanged) return;
      const sel = update.state.selection.main;
      if (!sel.empty) return;
      const head = sel.head;
      if (head <= 0) return;

      // Was `/` the inserted text in this transaction, ending at the
      // cursor's current position?
      let triggered = false;
      update.changes.iterChanges((_fA, _tA, _fB, tB, inserted) => {
        if (triggered) return;
        if (tB !== head) return;
        if (inserted.toString() === "/") triggered = true;
      });
      if (!triggered) return;

      // Anti-trigger: the `/` must start a fresh slash command — i.e.
      // be at start-of-doc, start-of-line, or after whitespace. Skip
      // for URLs (`https://`), paths (`src/foo`), and division-style
      // expressions (`a/b`).
      if (head >= 2) {
        const prev = update.state.sliceDoc(head - 2, head - 1);
        if (!/\s/.test(prev)) return;
      }

      setTimeout(() => startCompletion(update.view), 0);
    }
  },
);

// ─── trigger #2: input-handler fallback ──────────────────────────────

/** CodeMirror's `activateOnTyping` only fires on word characters; "/"
 *  isn't one. The input-handler is the belt-and-suspenders fallback
 *  for IME stacks where `iterChanges` doesn't surface the keystroke
 *  reliably. Fires only when "/" is at start-of-doc / start-of-line /
 *  after whitespace, so URLs and `src/foo` paths stay quiet. */
export const slashInputHandler: Extension = EditorView.inputHandler.of(
  (view, from, _to, text) => {
    if (text !== "/") return false;
    if (from > 0) {
      const prev = view.state.sliceDoc(from - 1, from);
      if (!/\s/.test(prev)) return false;
    }
    setTimeout(() => startCompletion(view), 0);
    return false;
  },
);
