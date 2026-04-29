// Cooking plugin — recipe-tag filter helpers.
//
// "Recipe" notes are anything tagged `#recipe`, `#bake`, `#baking`,
// `#cook`, or `#cooking`. The seeded `recipe-card` kit (Rust side)
// already writes `tags: [recipe]` into its frontmatter, so notes
// scaffolded from that kit are picked up automatically. The other
// aliases catch hand-tagged notes.
//
// In 3.0+ the cooking surfaces (cook-mode toggle, recipe clipper,
// shopping-list integration, recipe-library pill) are owned entirely
// by this persona — there is no longer a Settings → Writing extras
// toggle that surfaces them outside Cooking mode. Switching personas
// is the only on/off switch. Existing recipe notes still render
// correctly in any mode; only the chrome is gated.

import type { NoteSummary } from "../../lib/types";

const RECIPE_TAG_NAMES = [
  "recipe",
  "bake",
  "baking",
  "cook",
  "cooking",
] as const;

const RECIPE_SET = new Set<string>(RECIPE_TAG_NAMES);

export function isRecipeTag(tag: string): boolean {
  return RECIPE_SET.has(tag.toLowerCase());
}

export function isRecipeNote(n: NoteSummary): boolean {
  if (!n.tags) return false;
  for (const t of n.tags) {
    if (isRecipeTag(t)) return true;
  }
  return false;
}

export function filterRecipes(notes: NoteSummary[]): NoteSummary[] {
  return notes
    .filter(isRecipeNote)
    .slice()
    .sort((a, b) => (a.modified < b.modified ? 1 : -1));
}

export const RECIPE_TAG_LIST = RECIPE_TAG_NAMES;
