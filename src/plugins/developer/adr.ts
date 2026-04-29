// Developer plugin — ADR (Architecture Decision Record) helpers.
//
// `#decision` is the canonical tag for ADR-style notes — case-
// insensitive matching, lowercase storage. The Decision Log modal
// surfaces every note that carries it. New ADRs scaffold with the
// classic "Context · Decision · Consequences" layout and a status
// field that the user flips between proposed / accepted /
// superseded as their thinking firms up.

import type { NoteSummary } from "../../lib/types";

const DECISION_TAG_NAMES = ["decision", "decided", "resolved"] as const;
const DECISION_SET = new Set<string>(DECISION_TAG_NAMES);

/** True if the tag identifies a decision-style note. Case-
 *  insensitive: the special-tag system already maps these three
 *  aliases to the `decision` kind, so we mirror that vocabulary. */
export function isDecisionTag(tag: string): boolean {
  return DECISION_SET.has(tag.toLowerCase());
}

/** True if any of the note's tags identify it as a decision. */
export function isDecisionNote(n: NoteSummary): boolean {
  if (!n.tags) return false;
  for (const t of n.tags) {
    if (isDecisionTag(t)) return true;
  }
  return false;
}

/** Filter the workspace's notes to decisions, sorted newest-first. */
export function filterDecisions(notes: NoteSummary[]): NoteSummary[] {
  return notes
    .filter(isDecisionNote)
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

/** Title for a freshly scaffolded ADR. The date prefix gives the
 *  slug a useful sort order and a human-readable context without
 *  forcing the user to pick a number on the spot. They can rename
 *  later once the decision firms up. */
export function newAdrTitle(): string {
  return `ADR – ${isoDate()}`;
}

/** Markdown body seeded into a new ADR. The `**Status:**` line
 *  starts at `proposed`; the user flips it as the decision moves.
 *  Each section opens with a `??` marker so the Researcher /
 *  Developer "open questions" surface picks them up automatically
 *  while the ADR is still in draft. */
export function newAdrBody(): string {
  return [
    "**Status:** proposed",
    "",
    "## Context",
    "",
    "?? what forces are we responding to?",
    "",
    "## Decision",
    "",
    "?? what are we doing about it?",
    "",
    "## Alternatives considered",
    "",
    "- ",
    "",
    "## Consequences",
    "",
    "?? what becomes easier? what becomes harder?",
    "",
  ].join("\n");
}
