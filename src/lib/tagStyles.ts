// Tag-style helpers (2.1).
//
// Tags that mark a note as PHI-bearing or otherwise "don't sync me /
// don't preview me" need to read visually distinct from the everyday
// gold tag — otherwise a `#clinical` and a `#cooking` look identical
// and the user has to read each one to gauge sensitivity.
//
// `isSensitiveTag` is the single source of truth for "this tag should
// render in the rose palette." Keep the list small and obvious; the
// purpose is to flag user-authored privacy intent, not to police
// arbitrary tag names.

const SENSITIVE_TAGS = new Set(["clinical", "private", "phi", "confidential"]);

export function isSensitiveTag(tag: string): boolean {
  return SENSITIVE_TAGS.has(tag.toLowerCase());
}

/** Tailwind class string for a tag pill. Sensitive tags switch to the
 *  rose palette; everything else uses the default warm-gold pill. */
export function tagPillClass(tag: string, weight: "muted" | "filled" = "filled"): string {
  if (isSensitiveTag(tag)) {
    return "yarrow-tag-sensitive";
  }
  return weight === "muted" ? "bg-yelp/60 text-yeld" : "bg-yelp text-yeld";
}
