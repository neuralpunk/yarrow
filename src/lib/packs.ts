// Starter packs (3.2+). A pack is a bundle of tag definitions plus
// the markdown templates those tags reference. Packs replace the
// previous persona system: instead of a hardcoded persona owning a
// rail/status-bar/modal slot, a pack ships data — tag colors and
// templates — that the generic tag-driven UI renders.
//
// Packs are pure data. The user can import any combination, mix
// freely, and edit / remove anything afterward. Adding a new pack is
// a new entry in this file, not a code change in AppShell.
//
// The five packs below mirror the v3.0 personas one-to-one so the
// silent migration in `tagsMigration.ts` lands users on the same set
// of tags they would have had under the persona system. After
// migration the tags belong to the user, not the pack.

import type { TagDef } from "./tags.svelte";

export interface StarterPack {
  /** Stable id used by the migration helper to map persona → pack. */
  id: string;
  /** Display name in the picker. */
  name: string;
  /** One-line description. */
  description: string;
  /** Tag definitions this pack contributes. Merged into existing tags
   *  by `name`; conflicts prefer the existing tag. */
  tags: TagDef[];
  /** Tag names from `tags` that should be pinned to the status bar
   *  when the pack is applied. The user can unpin/repin afterward. */
  defaultPins: string[];
  /** Templates this pack ships, keyed by basename (no extension).
   *  Imported via `cmd_write_template` if not already present. */
  templates: Record<string, string>;
}

// Templates are markdown bodies — Yarrow's notes::write serializer
// prepends a generated frontmatter block on save, so YAML headers
// embedded in the template body would render as raw text. Tags come
// from the `extra_tags` arg to cmd_create_from_template, not from
// frontmatter inside the template text.

const RECIPE_TEMPLATE = `# {{title}}

**Serves:** 4 · **Time:** 30 min

## Ingredients

-

## Method

1.

## Notes

-
`;

const ADR_TEMPLATE = `# {{title}}

**Status:** Proposed
**Date:** {{date}}

## Context

What problem are we solving? What constraints are in play?

## Decision

What we are going to do.

## Consequences

What follows from this — both wins and trade-offs.
`;

const SOURCE_TEMPLATE = `# {{title}}

**Author:**
**Year:**
**URL:**

## Summary

A few sentences in your own words.

## Quotes

>

## My take

What I want to remember about this.
`;

const SOAP_TEMPLATE = `# {{title}}

**Date:** {{date}}

## Subjective

## Objective

## Assessment

## Plan
`;

const INTAKE_TEMPLATE = `# {{title}}

**Date:** {{date}}

## Presenting concern

## History

## Goals
`;

export const STARTER_PACKS: StarterPack[] = [
  {
    id: "research",
    name: "Research",
    description: "Sources, open questions, review queue.",
    tags: [
      { name: "source",   color: "bg-emerald-600", template: "source" },
      { name: "question", color: "bg-amber-500" },
      { name: "review",   color: "bg-yellow-600" },
      { name: "idea",     color: "bg-sky-600" },
    ],
    defaultPins: ["source", "question", "review"],
    templates: { source: SOURCE_TEMPLATE },
  },
  {
    id: "engineering",
    name: "Engineering",
    description: "Decisions, spikes, postmortems.",
    tags: [
      { name: "adr",        color: "bg-sky-700",     template: "adr" },
      { name: "spike",      color: "bg-violet-500" },
      { name: "postmortem", color: "bg-rose-600" },
    ],
    defaultPins: ["adr"],
    templates: { adr: ADR_TEMPLATE },
  },
  {
    id: "writing",
    name: "Writing",
    description: "Drafts, ideas, journal, scenes.",
    tags: [
      { name: "draft",   color: "bg-rose-500" },
      { name: "idea",    color: "bg-sky-600" },
      { name: "journal", color: "bg-amber-600" },
      { name: "scene",   color: "bg-purple-500" },
    ],
    defaultPins: ["draft"],
    templates: {},
  },
  {
    id: "clinical",
    name: "Clinical",
    description:
      "Sessions, intakes, follow-ups. Notes tagged #sensitive get a marker in the sidebar so they stand out.",
    tags: [
      { name: "session",   color: "bg-teal-700",   template: "soap" },
      { name: "intake",    color: "bg-teal-600",   template: "intake" },
      { name: "followup",  color: "bg-yellow-600" },
      { name: "sensitive", color: "bg-rose-700" },
    ],
    defaultPins: ["session", "followup"],
    templates: { soap: SOAP_TEMPLATE, intake: INTAKE_TEMPLATE },
  },
  {
    id: "recipes",
    name: "Recipes",
    description: "A recipe library and shopping-list staging.",
    tags: [
      { name: "recipe",   color: "bg-orange-600", template: "recipe" },
      { name: "shopping", color: "bg-amber-500" },
    ],
    defaultPins: ["recipe"],
    templates: { recipe: RECIPE_TEMPLATE },
  },
];

export function packById(id: string): StarterPack | undefined {
  return STARTER_PACKS.find((p) => p.id === id);
}
