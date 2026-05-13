// Persona-group metadata. A "group" is the optional `group` field on
// TagDef, used by `LeftSidebar/TagList.svelte` to render tags in
// collapsible folder-like sections. Group ids come from two places:
//
//   1. Starter packs in `packs.ts` — when a pack is applied, every
//      tag it contributes gets `group: pack.id` stamped (see
//      `tagsMigration.ts::applyPack`). So a vault that started from
//      the Writing pack has its drafts/scenes/fragments grouped
//      under "writing".
//
//   2. User-defined — anything the user types in the Settings → Tags
//      group input. Treated as an opaque string; unknown ids render
//      with the fallback swatch and a capitalised version of the id
//      as their label.
//
// The known-group registry mirrors the five starter packs. New packs
// should add a corresponding entry here so their group renders with
// a meaningful swatch and a localised label.

import type { StringKey } from "./i18n/index.svelte";

/** Sentinel id for tags with no group. Never persisted on a TagDef —
 *  used only as a key inside `LeftSidebar/TagList.svelte` to bucket
 *  ungrouped tags into the "Other" section. */
export const OTHER_GROUP = "__other__" as const;

export interface PersonaGroupMeta {
  /** i18n key for the group label, looked up via `tr()`. */
  labelKey: StringKey;
  /** Tailwind background class for the swatch dot in the group header. */
  swatch: string;
  /** Display order — known groups sort by this; unknown groups sort
   *  after known ones, alphabetised. "Other" always sorts last. */
  order: number;
}

export const KNOWN_GROUPS: Readonly<Record<string, PersonaGroupMeta>> = {
  writing:     { labelKey: "sidebar.tags.group.writing",     swatch: "bg-rose-500",    order: 1 },
  research:    { labelKey: "sidebar.tags.group.research",    swatch: "bg-sky-600",     order: 2 },
  engineering: { labelKey: "sidebar.tags.group.engineering", swatch: "bg-violet-500",  order: 3 },
  clinical:    { labelKey: "sidebar.tags.group.clinical",    swatch: "bg-emerald-600", order: 4 },
  recipes:     { labelKey: "sidebar.tags.group.recipes",     swatch: "bg-orange-600",  order: 5 },
};

/** Tailwind swatch class for a group id. Unknown ids fall back to a
 *  neutral slate; the OTHER bucket renders unfilled grey. */
export function groupSwatchClass(group: string | undefined | null): string {
  if (!group || group === OTHER_GROUP) return "bg-bd2";
  return KNOWN_GROUPS[group]?.swatch ?? "bg-slate-500";
}

/** True when the group id is a known starter-pack group. */
export function isKnownGroup(group: string): boolean {
  return Object.prototype.hasOwnProperty.call(KNOWN_GROUPS, group);
}

/** Sort key for a group id. Known groups sort first by declared
 *  order; unknown groups sort after, alphabetised by id; OTHER is
 *  always last. Returns a tuple-comparable pair. */
export function groupSortKey(group: string): readonly [number, string] {
  if (group === OTHER_GROUP) return [99, ""];
  const known = KNOWN_GROUPS[group];
  if (known) return [known.order, group];
  return [50, group];
}

/** Capitalise an unknown group id for display when no i18n entry
 *  exists. Single word — packs / user-typed ids are short. */
export function fallbackGroupLabel(group: string): string {
  if (!group) return "";
  return group.charAt(0).toUpperCase() + group.slice(1);
}
