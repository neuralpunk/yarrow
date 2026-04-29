// Researcher plugin — source-tag helpers + scaffolds for new
// source notes. Keeping pure data transforms in a sibling file so
// the React surfaces in `Rail.tsx` / `SourcesModal.tsx` stay short
// and easy to reason about.
//
// "Source" tags are the recognised vocabulary the Researcher
// surface keys off — case-insensitive matching, lowercase storage.
// A user who tags a note `#source`, `#paper`, `#cite`, `#reference`,
// or `#bibliography` lights it up in the Sources modal and the
// rail count badge.

import type { NoteSummary } from "../../lib/types";

export const SOURCE_TAG_NAMES = [
  "source",
  "paper",
  "cite",
  "reference",
  "bibliography",
] as const;

const SOURCE_SET = new Set<string>(SOURCE_TAG_NAMES);

/** True if the tag is one of the recognised source kinds. Case-
 *  insensitive: `#Source`, `#SOURCE`, and `#source` all match. */
export function isSourceTag(tag: string): boolean {
  return SOURCE_SET.has(tag.toLowerCase());
}

/** True if any of the note's tags identify it as a source. */
export function isSourceNote(n: NoteSummary): boolean {
  if (!n.tags) return false;
  for (const t of n.tags) {
    if (isSourceTag(t)) return true;
  }
  return false;
}

/** Return only the source-flavoured notes from a list, sorted by
 *  most-recently-modified first. The caller usually passes the
 *  workspace's full `notes` summary. */
export function filterSources(notes: NoteSummary[]): NoteSummary[] {
  return notes
    .filter(isSourceNote)
    .slice()
    .sort((a, b) => (a.modified < b.modified ? 1 : -1));
}

function isoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Title for a freshly scaffolded source note. The user can rename
 *  immediately — this is just so the file lands on disk with a
 *  meaningful slug instead of "untitled-1". */
export function newSourceTitle(): string {
  return `Source – ${isoDate()}`;
}

/** Markdown body seeded into a new source note. Layout mirrors the
 *  way researchers usually capture a source: bibliographic header,
 *  a single quote block, a notes section, and a `cites` connection
 *  hint at the bottom so users discover the typed-link vocabulary. */
export function newSourceBody(): string {
  return [
    "**URL:**",
    "",
    "**Author:**",
    "",
    "**Year:**",
    "",
    "## Quote",
    "",
    "> ",
    "",
    "## Notes",
    "",
    "?? what does this support or contradict in our current work?",
    "",
  ].join("\n");
}
