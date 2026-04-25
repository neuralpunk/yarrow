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
// you don't end up with `[[Title]]]]`.
//
// Ranking (2.1): the v2.0 version dumped the first 20 substring matches
// in iteration order — fine for tiny vaults, hostile in mature ones
// where the user types `[[k` and gets 50 candidates with `k` somewhere
// in them in arbitrary order. The completion is now scored:
//   • exact title match               — top of the list
//   • title startsWith query          — strong
//   • word-boundary match in title    — moderate
//   • title substring                 — base
//   • slug-equivalent of the above    — slightly lower than title
//   • recently-modified bonus         — small lift, half-life ~30 days
// The earlier the query lands inside the title, the higher the score.
// Result: typing `[[k` puts notes titled "Knowledge" / "Kafka" /
// "Kubernetes" ahead of "Architecture / Linked notes" or "Stuck on K".

// Module-level recency tracker. AppShell's `recordOpenedNote` (added in
// 2.1) calls `markOpenedSlug` on every navigate, so wikilink ranking
// can boost the user's recent reading list without each render needing
// to recompute it. Map iteration is stable (insertion order); we cap
// at the most-recently-opened 64 entries so the structure stays bounded.
const OPENED_AT = new Map<string, number>();
const OPEN_CAP = 64;

export function markOpenedSlug(slug: string): void {
  OPENED_AT.delete(slug);
  OPENED_AT.set(slug, Date.now());
  if (OPENED_AT.size > OPEN_CAP) {
    const first = OPENED_AT.keys().next().value;
    if (first !== undefined) OPENED_AT.delete(first);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function recencyBonus(slug: string, modifiedIso?: string): number {
  // Open recency dominates (the user just looked at it; high signal).
  // Falls back to modified time when we've never seen the note opened
  // in this session — that still favors notes the user actively edits.
  const opened = OPENED_AT.get(slug);
  if (opened) {
    const ageDays = (Date.now() - opened) / DAY_MS;
    if (ageDays < 0.04) return 25; // ~last hour
    if (ageDays < 1) return 18;
    if (ageDays < 7) return 10;
    return 4;
  }
  if (!modifiedIso) return 0;
  const t = Date.parse(modifiedIso);
  if (!Number.isFinite(t)) return 0;
  const ageDays = (Date.now() - t) / DAY_MS;
  if (ageDays < 1) return 8;
  if (ageDays < 7) return 5;
  if (ageDays < 30) return 2;
  if (ageDays > 365) return -2;
  return 0;
}

function scoreCandidate(n: NoteSummary, q: string): number {
  if (!q) return 50 + recencyBonus(n.slug, n.modified);

  const title = (n.title || n.slug).toLowerCase();
  const slug = n.slug.toLowerCase();
  let score = -Infinity;

  if (title === q) score = Math.max(score, 1000);
  else if (title.startsWith(q)) score = Math.max(score, 800 - title.length);
  else {
    // Word-boundary match in title: " q" or "-q" etc.
    const wb = new RegExp(`(^|[\\s\\-_/])${escapeRegex(q)}`).exec(title);
    if (wb) score = Math.max(score, 600 - (wb.index ?? 0));
    else if (title.includes(q)) {
      const idx = title.indexOf(q);
      score = Math.max(score, 400 - idx);
    }
  }
  if (slug === q) score = Math.max(score, 700);
  else if (slug.startsWith(q)) score = Math.max(score, 500 - slug.length);
  else if (slug.includes(q)) {
    const idx = slug.indexOf(q);
    score = Math.max(score, 300 - idx);
  }
  if (score === -Infinity) return -Infinity;
  return score + recencyBonus(n.slug, n.modified);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Completion source. Takes a getter so the source stays current even
 *  when notes are created/renamed without the editor remounting. */
export function wikilinkSource(getNotes: () => NoteSummary[]): CompletionSource {
  return (ctx: CompletionContext) => {
    const before = ctx.matchBefore(/\[\[[^\]\n]*/);
    if (!before || !before.text.startsWith("[[")) return null;
    const query = before.text.slice(2).toLowerCase();
    const pool = getNotes();

    const ranked = pool
      .map((n) => ({ n, score: scoreCandidate(n, query) }))
      .filter((x) => x.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const options: Completion[] = ranked.map(({ n }) => {
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
    const prev = view.state.sliceDoc(from - 1, from);
    if (prev !== "[") return false;
    setTimeout(() => startCompletion(view), 0);
    return false;
  },
);
