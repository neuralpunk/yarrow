// Tag-style helpers.
//
// Yarrow recognises a small set of "special" tag names whose meaning
// is consistent across notes — `#clinical` marks PHI-bearing content,
// `#evergreen` marks mature thinking, `#draft` flags work-in-progress,
// and so on. Each special kind renders in a distinct colour so the
// eye can scan a list of tags and triage at a glance, instead of
// reading every label as plain text.
//
// Adding a new kind:
//   1. Add an entry to `TAG_KINDS` mapping each alias → kind.
//   2. Add a `.yarrow-tag-<kind>` rule to `index.css` (and a `.dark`
//      override if the dark-mode tone needs adjusting).
//   3. Add a `TagLegendEntry` to `TAG_LEGEND` with i18n keys so the
//      Tag Browser modal can teach users what the colour means.
//
// `isSensitiveTag` is intentionally narrow — it gates security-
// adjacent behaviour (autocomplete suppression, sync redaction) and
// must not silently grow as we add visual-only kinds. Keep it
// limited to the original four PHI-class aliases.

import type { StringKey } from "./i18n/index.svelte";

export type TagKind =
  | "sensitive"
  | "attention"
  | "mature"
  | "archived"
  | "draft"
  | "question"
  | "decision";

/** Lowercase-keyed lookup from a tag alias → its kind. Multiple
 *  aliases per kind so users can write whichever vocabulary fits
 *  their PKM habit (`#wip` vs `#in-progress`, `#evergreen` vs
 *  `#permanent`, etc.). Add new aliases as we observe real use; do
 *  NOT autoclassify on substring match — that would surprise people
 *  who have a `#evergreen-state` project tag and never wanted it
 *  treated as mature. */
const TAG_KINDS: Readonly<Record<string, TagKind>> = {
  // sensitive — locked-down PHI/private content. Also gates
  // autocomplete + sync redaction; see `isSensitiveTag`.
  clinical: "sensitive",
  private: "sensitive",
  phi: "sensitive",
  confidential: "sensitive",
  // attention — needs the user to come back and finish / verify.
  review: "attention",
  followup: "attention",
  "follow-up": "attention",
  todo: "attention",
  wip: "attention",
  "in-progress": "attention",
  // mature — settled thinking, ready to be linked from elsewhere.
  evergreen: "mature",
  permanent: "mature",
  canonical: "mature",
  // archived — kept for reference, no longer current.
  archived: "archived",
  dead: "archived",
  deprecated: "archived",
  // draft — early-stage scribble, not ready for review yet.
  draft: "draft",
  sketch: "draft",
  raw: "draft",
  seedling: "draft",
  // question — open inquiry, paired conceptually with `decision`.
  question: "question",
  q: "question",
  open: "question",
  // decision — the answer / conclusion side of `question`.
  decision: "decision",
  decided: "decision",
  resolved: "decision",
};

/** Lowercase canonical aliases per kind, in the order they appear
 *  in `TAG_KINDS`. Used by the Tag Browser legend so users see the
 *  exact tag names that trigger each colour. Kept in sync manually
 *  with `TAG_KINDS` above — a unit test could enforce parity if
 *  we add coverage later. */
export const TAG_KIND_ALIASES: Readonly<Record<TagKind, readonly string[]>> = {
  sensitive: ["clinical", "private", "phi", "confidential"],
  attention: ["review", "followup", "todo", "wip"],
  mature: ["evergreen", "permanent", "canonical"],
  archived: ["archived", "dead", "deprecated"],
  draft: ["draft", "sketch", "raw", "seedling"],
  question: ["question", "q", "open"],
  decision: ["decision", "decided", "resolved"],
};

/** Return the kind for a tag, or `null` if it's an ordinary tag.
 *  Lower-cases the input first so `#Clinical`, `#CLINICAL`, and
 *  `#clinical` all map to the same kind. */
export function tagKind(tag: string): TagKind | null {
  return TAG_KINDS[tag.toLowerCase()] ?? null;
}

/** Backwards-compatible narrow check. Used by security-adjacent
 *  paths (citeAutocomplete suppression, sync redaction) — do NOT
 *  widen this to include the visual-only kinds. */
export function isSensitiveTag(tag: string): boolean {
  return tagKind(tag) === "sensitive";
}

/** Tailwind / utility class string for a tag pill. Each special
 *  kind has its own `yarrow-tag-<kind>` class defined in
 *  `index.css`; ordinary tags use the warm-gold default. The
 *  `weight` parameter is honoured only for ordinary tags — special
 *  kinds always render at their full intent. */
export function tagPillClass(
  tag: string,
  weight: "muted" | "filled" = "filled",
): string {
  const kind = tagKind(tag);
  if (kind) return `yarrow-tag-${kind}`;
  return weight === "muted" ? "bg-yelp/60 text-yeld" : "bg-yelp text-yeld";
}

export interface TagLegendEntry {
  kind: TagKind;
  /** i18n key for the short legend title (e.g. "Sensitive"). */
  labelKey: StringKey;
  /** i18n key for the one-line explanation of when to use it. */
  descriptionKey: StringKey;
}

/** Order is editorial — most-actionable kinds first. Drives the
 *  Tag Browser modal's legend section. */
export const TAG_LEGEND: readonly TagLegendEntry[] = [
  { kind: "sensitive", labelKey: "modals.tagBrowser.kindSensitive",  descriptionKey: "modals.tagBrowser.kindSensitiveHint" },
  { kind: "attention", labelKey: "modals.tagBrowser.kindAttention",  descriptionKey: "modals.tagBrowser.kindAttentionHint" },
  { kind: "question",  labelKey: "modals.tagBrowser.kindQuestion",   descriptionKey: "modals.tagBrowser.kindQuestionHint" },
  { kind: "decision",  labelKey: "modals.tagBrowser.kindDecision",   descriptionKey: "modals.tagBrowser.kindDecisionHint" },
  { kind: "draft",     labelKey: "modals.tagBrowser.kindDraft",      descriptionKey: "modals.tagBrowser.kindDraftHint" },
  { kind: "mature",    labelKey: "modals.tagBrowser.kindMature",     descriptionKey: "modals.tagBrowser.kindMatureHint" },
  { kind: "archived",  labelKey: "modals.tagBrowser.kindArchived",   descriptionKey: "modals.tagBrowser.kindArchivedHint" },
];
