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
// 3.1 Inline Wikilink Picker — each candidate now carries a richer
// `detail` (slug · last-edited · tag count) so the user can pick by
// recency without leaving the keyboard. When no existing note matches
// the query, a "Create *query*" fallback row scaffolds the missing
// note via the `yarrow:wikilink-create` event.
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
  const opened = OPENED_AT.get(slug);
  if (opened) {
    const ageDays = (Date.now() - opened) / DAY_MS;
    if (ageDays < 0.04) return 25;
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

/** Build the meta string shown in the completion's `detail` slot.
 *  Mono / muted by the existing autocomplete CSS. */
function shortRelTime(iso: string | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const age = Date.now() - t;
  if (age < 60_000) return "just now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}h`;
  const days = Math.floor(age / 86_400_000);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function buildDetail(n: NoteSummary, title: string): string {
  const bits: string[] = [];
  if (n.slug.toLowerCase() !== title.toLowerCase()) bits.push(n.slug);
  const rel = shortRelTime(n.modified);
  if (rel) bits.push(rel);
  if (n.tags && n.tags.length > 0) {
    bits.push(n.tags.length === 1 ? `#${n.tags[0]}` : `${n.tags.length} tags`);
  }
  return bits.join(" · ");
}

/** Completion source. Takes a getter so the source stays current even
 *  when notes are created/renamed without the editor remounting. */
export function wikilinkSource(getNotes: () => NoteSummary[]): CompletionSource {
  return (ctx: CompletionContext) => {
    const before = ctx.matchBefore(/\[\[[^\]\n]*/);
    if (!before || !before.text.startsWith("[[")) return null;
    const queryRaw = before.text.slice(2);
    const query = queryRaw.toLowerCase();
    const pool = getNotes();

    const ranked = pool
      .map((n) => ({ n, score: scoreCandidate(n, query) }))
      .filter((x) => x.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const options: Completion[] = ranked.map(({ n }) => {
      const title = n.title || n.slug;
      const detail = buildDetail(n, title);
      return {
        label: title,
        detail: detail || undefined,
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

    // "Create new note" fallback. Surfaces when the trimmed query has
    // at least one char and doesn't match an existing title/slug
    // exactly. Picking it inserts the `[[Title]]` AND dispatches
    // `yarrow:wikilink-create` so the host can open the new-note dialog
    // pre-populated.
    const trimmed = queryRaw.trim();
    const hasExactMatch =
      trimmed.length > 0 &&
      pool.some(
        (n) =>
          (n.title || n.slug).toLowerCase() === trimmed.toLowerCase() ||
          n.slug.toLowerCase() === trimmed.toLowerCase(),
      );
    if (trimmed.length > 0 && !hasExactMatch) {
      options.push({
        label: `Create "${trimmed}"`,
        detail: "new note",
        type: "text",
        boost: -1,
        apply: (view, _completion, from, to) => {
          const docLen = view.state.doc.length;
          const ahead2 = to + 2 <= docLen ? view.state.sliceDoc(to, to + 2) : "";
          const ahead1 = to + 1 <= docLen ? view.state.sliceDoc(to, to + 1) : "";
          let replaceTo = to;
          if (ahead2 === "]]") replaceTo = to + 2;
          else if (ahead1 === "]") replaceTo = to + 1;
          const insert = `[[${trimmed}]]`;
          view.dispatch({
            changes: { from, to: replaceTo, insert },
            selection: { anchor: from + insert.length },
            scrollIntoView: true,
            userEvent: "input.complete",
          });
          window.dispatchEvent(
            new CustomEvent("yarrow:wikilink-create", {
              detail: { title: trimmed },
            }),
          );
        },
      });
    }

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
