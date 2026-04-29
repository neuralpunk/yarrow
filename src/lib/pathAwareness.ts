import type { BranchTopo, PathCollection, PathMeta } from "./types";
import type { ThemeName } from "./theme.svelte";

/**
 * Theme-aware scenario accent palettes (theme system spec §2.4 / §3.4).
 *
 * Each of the six themes ships an eight-swatch picker tuned against
 * its canvas — slate-and-leather tones on Vellum's bone background,
 * bronze-and-rust on Workshop's ink, and so on. Anything outside this
 * list is still allowed via the colour wheel; the presets are the
 * "house picks" that look right out of the box.
 *
 * Yarrow's pre-3.1 palette stays as the fallback for Linen / Graphite
 * (which inherited it before the system-wide rename) and as a generic
 * default for any unknown theme value.
 */
const PRESETS_DEFAULT = [
  "#c97a3a",
  "#c43d5b",
  "#a85cc9",
  "#5c6dc9",
  "#3a91c9",
  "#3aa890",
  "#68a83a",
  "#7a6b5c",
];

const PRESETS_BY_THEME: Record<ThemeName, string[]> = {
  vellum: ["#45627A", "#A04848", "#B89968", "#7A8C5C", "#8C5C7A", "#5C7A8C", "#8C7A5C", "#3D3D3D"],
  workshop: ["#C18F3E", "#B85C57", "#7FA77A", "#5B7E9C", "#9C7BA7", "#A78F5B", "#5BA797", "#A8A089"],
  linen: PRESETS_DEFAULT,
  graphite: PRESETS_DEFAULT,
  ashrose: ["#5C2E38", "#6F464F", "#A04848", "#8C5C7A", "#5C7A8C", "#7A6B5C", "#695F63", "#3D3D3D"],
  dracula: ["#BD93F9", "#FF79C6", "#8BE9FD", "#50FA7B", "#FFB86C", "#F1FA8C", "#FF5555", "#6272A4"],
};

export function colorPresetsForTheme(theme: ThemeName | string): string[] {
  if (theme in PRESETS_BY_THEME) {
    return PRESETS_BY_THEME[theme as ThemeName];
  }
  return PRESETS_DEFAULT;
}

/**
 * Cross-cutting path awareness: which paths a given note lives on, which notes
 * each path contains, and how to display each path consistently across the app
 * (colour hue, warmth from recency, pretty condition).
 *
 * The pieces here are pure functions / derived maps — the actual data lives in
 * AppShell state. One source of truth, everyone downstream is a consumer.
 */

export interface PathAwareness {
  currentPath: string;
  topology: BranchTopo[];
  pathMeta: Record<string, PathMeta>;
  /** For each branch: the slugs that live on its tip. Derived from
   *  `cmd_notes_on_path` called once per branch when topology changes. */
  pathNotes: Record<string, string[]>;
}

/** Inverse map: slug → list of branch names that contain this note. */
export function slugPathsMap(pathNotes: Record<string, string[]>): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const [branch, slugs] of Object.entries(pathNotes)) {
    for (const s of slugs) {
      let set = m.get(s);
      if (!set) {
        set = new Set<string>();
        m.set(s, set);
      }
      set.add(branch);
    }
  }
  return m;
}

/** Note counts per branch (useful for UI sizing). */
export function noteCountsMap(pathNotes: Record<string, string[]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(pathNotes)) out[k] = v.length;
  return out;
}

/** Deterministic pretty condition line — uses the meta text or a fallback. */
export function conditionFor(pathMeta: Record<string, PathMeta>, name: string): string {
  return (pathMeta[name]?.condition || "").trim();
}

/** Is this the repo's root branch (main/master)? */
export function isRoot(name: string): boolean {
  return name === "main" || name === "master";
}

/**
 * Color for a path. Main is always the primary plum accent. Non-main paths
 * get a hue derived deterministically from their name, mixed with the plum
 * family so everything still reads as part of one palette — no clown parade.
 *
 * Returns CSS color strings. Use warmthFor() separately if you want to fade
 * dormant paths; color is identity, warmth is state.
 *
 * The optional `overrides` map lets the UI win with a user-assigned accent
 * (set via PathsPane). Pass the hex value keyed by path name — when present
 * for `name`, it takes precedence over the derived hue.
 */
export function colorForPath(
  name: string,
  opts?: { soft?: boolean; overrides?: Record<string, string | null | undefined> },
): string {
  const override = opts?.overrides?.[name];
  if (override) {
    return opts?.soft ? softenHex(override) : override;
  }
  if (isRoot(name)) {
    // Main uses the primary accent variable so theme switches pick it up.
    return opts?.soft ? "var(--yelp)" : "var(--yel)";
  }
  // Hash → hue. 16 distinct hues biased around warm plums and sages.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  // Pick a hue shift, ±40° around plum (~310°).
  const hue = 260 + (h % 100); // 260..360 — purples/pinks/warm reds
  if (opts?.soft) return `hsl(${hue} 55% 92%)`;
  return `hsl(${hue} 48% 48%)`;
}

/** Collapse a PathCollection[] into `{ name: color }` for the overrides map. */
export function buildPathColorMap(
  collections: PathCollection[] | undefined | null,
): Record<string, string> {
  const m: Record<string, string> = {};
  for (const c of collections ?? []) {
    if (c.color && typeof c.color === "string") m[c.name] = c.color;
  }
  return m;
}

/** Lighten a hex color by mixing it with the page background, so a stored
 *  accent can still be used for soft chip fills without swamping the UI. */
function softenHex(hex: string): string {
  const match = /^#([0-9a-fA-F]{3,8})$/.exec(hex);
  if (!match) return hex;
  return `color-mix(in srgb, ${hex} 22%, var(--bg))`;
}

export interface PathConsequence {
  /** Notes present here but missing on the other path. */
  lost: string[];
  /** Notes present on the other path but missing here. */
  gained: string[];
  /** Notes shared between the two. */
  shared: string[];
}

/** Cheap "what would change if I stepped from A to B?" summary, using only
 *  slug-presence. (Content divergence is a separate concern handled by
 *  PathDiff.) */
export function consequenceBetween(
  pathNotes: Record<string, string[]>,
  from: string,
  to: string,
): PathConsequence {
  const a = new Set(pathNotes[from] || []);
  const b = new Set(pathNotes[to] || []);
  const lost: string[] = [];
  const gained: string[] = [];
  const shared: string[] = [];
  for (const s of a) {
    if (b.has(s)) shared.push(s);
    else lost.push(s);
  }
  for (const s of b) {
    if (!a.has(s)) gained.push(s);
  }
  return { lost, gained, shared };
}
