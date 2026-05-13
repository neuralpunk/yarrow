// Tag config store (3.2+). Replaces the persona system: instead of
// picking one of seven preset bundles, the workspace owns a list of
// tag definitions and a separate list of which of those get pinned to
// the status bar.
//
// Design principle (v2): a tag is a pure status marker — name, color,
// and an optional template association. It carries NO behavior knobs.
// Surface decisions (which tags appear as status-bar chips) live at
// the config level, not on the tag. A few tag names are special:
// `SENSITIVE_TAGS` (sensitive / private / phi / confidential /
// clinical) cause the sidebar to render a small "sensitive" marker
// next to those notes — the notes are NOT hidden, just visibly
// flagged so they don't get mistaken for ordinary material.
//
// Persisted under `yarrow.tags` (or `yarrow.tags:<ws>`). Cross-tab
// sync rides the native `storage` event; in-tab listeners use a
// custom `yarrow:tags-changed` event.
//
// Migration from the persona system runs once per workspace, lazily,
// the first time a workspace opens with no tag config — see
// `src/lib/tagsMigration.ts`. Stored configs from earlier 3.2 builds
// (v1: per-tag `behaviors` + `pinToStatusBar`) are normalized to v2
// at parse time — `pinToStatusBar: true` rows are folded into the new
// `pinnedToStatusBar` list and the legacy fields are dropped.

import {
  workspaceScope,
  readScoped,
  wsKey,
  writeScoped,
} from "./workspaceScope.svelte";

export interface TagDef {
  /** Bare tag name without `#`. e.g. "recipe", "adr", "review". */
  name: string;
  /** Tailwind background class for the swatch, e.g. "bg-rose-500". */
  color: string;
  /** Template basename (without extension) — resolves to a file in
   *  `.yarrow/templates/<name>.md`. New notes scaffolded from the
   *  saved-view "+ New" affordance use this template. */
  template?: string;
  /** Persona-group id, e.g. "writing", "research". Pack tags get this
   *  stamped at apply time; user-created tags can pick one in Settings.
   *  Untouched by the store — purely organisational, drives the grouped
   *  rendering in `LeftSidebar/TagList.svelte`. Empty / missing means
   *  "Other". Matches a pack id in `packs.ts` to inherit that pack's
   *  label/swatch via `personaGroups.ts`. */
  group?: string;
}

export interface TagsConfig {
  version: 2;
  tags: TagDef[];
  /** Tag names whose chips should appear in the status bar, in declared
   *  order. Decoupled from TagDef so the tag itself stays pure data. */
  pinnedToStatusBar: string[];
}

const KEY = "yarrow.tags";
const EVT = "yarrow:tags-changed";

const EMPTY: TagsConfig = { version: 2, tags: [], pinnedToStatusBar: [] };

/** Tag names that flag their notes as sensitive in the sidebar. The
 *  sidebar renders a small marker icon next to any note carrying one
 *  of these tags so it's visually distinct from ordinary material —
 *  the note is NOT hidden, search/sort/folders all work as normal.
 *  Convention beats configuration: these names map to common "this
 *  is sensitive" semantics across clinical, research, and personal
 *  workflows. */
export const SENSITIVE_TAGS: readonly string[] = [
  "sensitive",
  "private",
  "phi",
  "confidential",
  "clinical",
];

const SENSITIVE_SET = new Set(SENSITIVE_TAGS);

/** True when a tag name is on the sensitive-marker list. */
export function isSensitiveTag(tag: string): boolean {
  return SENSITIVE_SET.has(tag.toLowerCase());
}

/** True when any tag in the list flags the note as sensitive. */
export function noteIsSensitive(noteTags: readonly string[] | undefined | null): boolean {
  if (!noteTags) return false;
  for (const t of noteTags) {
    if (isSensitiveTag(t)) return true;
  }
  return false;
}

function safeParse(raw: string | null): TagsConfig {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tags)) {
      return EMPTY;
    }
    const fromVersion = typeof parsed.version === "number" ? parsed.version : 1;

    const tags: TagDef[] = [];
    const pinnedFromV1: string[] = [];
    for (const raw of parsed.tags) {
      if (!raw || typeof raw !== "object") continue;
      const t = raw as Record<string, unknown>;
      if (typeof t.name !== "string" || typeof t.color !== "string") continue;
      const def: TagDef = { name: t.name, color: t.color };
      if (typeof t.template === "string" && t.template.length > 0) {
        def.template = t.template;
      }
      if (typeof t.group === "string" && t.group.length > 0) {
        def.group = t.group;
      }
      tags.push(def);
      if (fromVersion < 2 && t.pinToStatusBar === true) {
        pinnedFromV1.push(t.name);
      }
    }

    let pinnedToStatusBar: string[];
    if (fromVersion >= 2 && Array.isArray(parsed.pinnedToStatusBar)) {
      const known = new Set(tags.map((t) => t.name));
      pinnedToStatusBar = parsed.pinnedToStatusBar.filter(
        (x: unknown): x is string => typeof x === "string" && known.has(x),
      );
    } else {
      pinnedToStatusBar = pinnedFromV1;
    }

    return { version: 2, tags, pinnedToStatusBar };
  } catch { /* fall through */ }
  return EMPTY;
}

function readStored(): TagsConfig {
  return safeParse(readScoped(KEY));
}

class TagsStore {
  config = $state<TagsConfig>(readStored());

  constructor() {
    $effect.root(() => {
      $effect(() => {
        void workspaceScope.scope;
        const next = readStored();
        if (!sameConfig(next, this.config)) this.config = next;
      });

      const onChange = (e: Event) => {
        const next = (e as CustomEvent<TagsConfig>).detail;
        if (next && !sameConfig(next, this.config)) this.config = next;
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY || e.key === wsKey(KEY)) {
          const next = readStored();
          if (!sameConfig(next, this.config)) this.config = next;
        }
      };
      window.addEventListener(EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  /** Replace the entire tag config. Triggers a window-level event so
   *  derived stores resync. */
  setAll(next: TagsConfig) {
    if (sameConfig(next, this.config)) return;
    writeScoped(KEY, JSON.stringify(next));
    this.config = next;
    window.dispatchEvent(new CustomEvent<TagsConfig>(EVT, { detail: next }));
  }

  /** Add or update a single tag definition (matched by `name`). */
  upsert(def: TagDef) {
    const idx = this.config.tags.findIndex((t) => t.name === def.name);
    const tags = idx >= 0
      ? this.config.tags.map((t, i) => i === idx ? def : t)
      : [...this.config.tags, def];
    this.setAll({
      version: 2,
      tags,
      pinnedToStatusBar: this.config.pinnedToStatusBar,
    });
  }

  /** Remove a tag definition by name. Also drops the name from the
   *  pinned-to-status-bar list. Does not touch notes carrying the tag
   *  — only removes its config entry. */
  remove(name: string) {
    const tags = this.config.tags.filter((t) => t.name !== name);
    const pinnedToStatusBar = this.config.pinnedToStatusBar.filter(
      (n) => n !== name,
    );
    this.setAll({ version: 2, tags, pinnedToStatusBar });
  }

  /** Lookup helper. */
  get(name: string): TagDef | undefined {
    return this.config.tags.find((t) => t.name === name);
  }

  /** True when no tags have been configured for the active workspace.
   *  Used by the migration helper to decide whether to seed from a
   *  starter pack. */
  get isEmpty(): boolean {
    return this.config.tags.length === 0;
  }

  /** True when this tag is currently pinned to the status bar. */
  isPinned(name: string): boolean {
    return this.config.pinnedToStatusBar.includes(name);
  }

  /** Pin a tag to the status bar (idempotent). */
  pinTo(name: string) {
    if (this.isPinned(name)) return;
    this.setAll({
      version: 2,
      tags: this.config.tags,
      pinnedToStatusBar: [...this.config.pinnedToStatusBar, name],
    });
  }

  /** Unpin a tag from the status bar (idempotent). */
  unpinFrom(name: string) {
    if (!this.isPinned(name)) return;
    this.setAll({
      version: 2,
      tags: this.config.tags,
      pinnedToStatusBar: this.config.pinnedToStatusBar.filter((n) => n !== name),
    });
  }

  /** Tag definitions pinned to the status bar, in pinned-list order.
   *  Names that no longer have a matching TagDef are dropped silently. */
  get statusBarTags(): readonly TagDef[] {
    const byName = new Map(this.config.tags.map((t) => [t.name, t]));
    const out: TagDef[] = [];
    for (const n of this.config.pinnedToStatusBar) {
      const def = byName.get(n);
      if (def) out.push(def);
    }
    return out;
  }
}

function sameConfig(a: TagsConfig, b: TagsConfig): boolean {
  if (a.tags.length !== b.tags.length) return false;
  if (a.pinnedToStatusBar.length !== b.pinnedToStatusBar.length) return false;
  for (let i = 0; i < a.tags.length; i++) {
    if (JSON.stringify(a.tags[i]) !== JSON.stringify(b.tags[i])) return false;
  }
  for (let i = 0; i < a.pinnedToStatusBar.length; i++) {
    if (a.pinnedToStatusBar[i] !== b.pinnedToStatusBar[i]) return false;
  }
  return true;
}

export const tags = new TagsStore();

/** Default label for a tag — `Recipes` for `recipe`, `Decisions` for
 *  `decision` etc. Used by the chip render and saved-view modal. */
export function defaultLabel(def: TagDef): string {
  return capitalize(pluralize(def.name));
}

/** Theme-aware soft-pill tone for a tag's status-bar chip.
 *
 *  Mirrors Yarrow's canonical "tinted pill" pattern (the wikilink pill,
 *  whose bg=`--yelp` pale-accent and text=`--yeld` dark-accent). For
 *  each tag-color family we pair a pale shade for light themes with a
 *  deep translucent shade for dark themes, so the chip always reads
 *  against `bg-s2` (the lifted status-bar surface) without floating or
 *  drowning. The literal class strings must be statically present so
 *  Tailwind 4's scanner emits the corresponding utilities. */
export interface ChipTone {
  bg: string;
  border: string;
  text: string;
  hover: string;
}

const CHIP_TONES: Record<string, ChipTone> = {
  "bg-rose-500": {
    bg:     "bg-rose-100 dark:bg-rose-950/60",
    border: "border-rose-200 dark:border-rose-800/60",
    text:   "text-rose-900 dark:text-rose-200",
    hover:  "hover:bg-rose-200 dark:hover:bg-rose-900/70",
  },
  "bg-rose-600": {
    bg:     "bg-rose-100 dark:bg-rose-950/60",
    border: "border-rose-200 dark:border-rose-800/60",
    text:   "text-rose-900 dark:text-rose-200",
    hover:  "hover:bg-rose-200 dark:hover:bg-rose-900/70",
  },
  "bg-rose-700": {
    bg:     "bg-rose-100 dark:bg-rose-950/60",
    border: "border-rose-300 dark:border-rose-800/60",
    text:   "text-rose-950 dark:text-rose-200",
    hover:  "hover:bg-rose-200 dark:hover:bg-rose-900/70",
  },
  "bg-orange-600": {
    bg:     "bg-orange-100 dark:bg-orange-950/60",
    border: "border-orange-200 dark:border-orange-800/60",
    text:   "text-orange-900 dark:text-orange-200",
    hover:  "hover:bg-orange-200 dark:hover:bg-orange-900/70",
  },
  "bg-amber-500": {
    bg:     "bg-amber-100 dark:bg-amber-950/60",
    border: "border-amber-200 dark:border-amber-800/60",
    text:   "text-amber-900 dark:text-amber-200",
    hover:  "hover:bg-amber-200 dark:hover:bg-amber-900/70",
  },
  "bg-amber-600": {
    bg:     "bg-amber-100 dark:bg-amber-950/60",
    border: "border-amber-200 dark:border-amber-800/60",
    text:   "text-amber-900 dark:text-amber-200",
    hover:  "hover:bg-amber-200 dark:hover:bg-amber-900/70",
  },
  "bg-yellow-600": {
    bg:     "bg-yellow-100 dark:bg-yellow-950/60",
    border: "border-yellow-200 dark:border-yellow-800/60",
    text:   "text-yellow-900 dark:text-yellow-200",
    hover:  "hover:bg-yellow-200 dark:hover:bg-yellow-900/70",
  },
  "bg-emerald-600": {
    bg:     "bg-emerald-100 dark:bg-emerald-950/60",
    border: "border-emerald-200 dark:border-emerald-800/60",
    text:   "text-emerald-900 dark:text-emerald-200",
    hover:  "hover:bg-emerald-200 dark:hover:bg-emerald-900/70",
  },
  "bg-teal-600": {
    bg:     "bg-teal-100 dark:bg-teal-950/60",
    border: "border-teal-200 dark:border-teal-800/60",
    text:   "text-teal-900 dark:text-teal-200",
    hover:  "hover:bg-teal-200 dark:hover:bg-teal-900/70",
  },
  "bg-teal-700": {
    bg:     "bg-teal-100 dark:bg-teal-950/60",
    border: "border-teal-300 dark:border-teal-800/60",
    text:   "text-teal-950 dark:text-teal-200",
    hover:  "hover:bg-teal-200 dark:hover:bg-teal-900/70",
  },
  "bg-sky-600": {
    bg:     "bg-sky-100 dark:bg-sky-950/60",
    border: "border-sky-200 dark:border-sky-800/60",
    text:   "text-sky-900 dark:text-sky-200",
    hover:  "hover:bg-sky-200 dark:hover:bg-sky-900/70",
  },
  "bg-sky-700": {
    bg:     "bg-sky-100 dark:bg-sky-950/60",
    border: "border-sky-300 dark:border-sky-800/60",
    text:   "text-sky-950 dark:text-sky-200",
    hover:  "hover:bg-sky-200 dark:hover:bg-sky-900/70",
  },
  "bg-violet-500": {
    bg:     "bg-violet-100 dark:bg-violet-950/60",
    border: "border-violet-200 dark:border-violet-800/60",
    text:   "text-violet-900 dark:text-violet-200",
    hover:  "hover:bg-violet-200 dark:hover:bg-violet-900/70",
  },
  "bg-purple-500": {
    bg:     "bg-purple-100 dark:bg-purple-950/60",
    border: "border-purple-200 dark:border-purple-800/60",
    text:   "text-purple-900 dark:text-purple-200",
    hover:  "hover:bg-purple-200 dark:hover:bg-purple-900/70",
  },
  "bg-slate-500": {
    bg:     "bg-slate-100 dark:bg-slate-800/60",
    border: "border-slate-200 dark:border-slate-700/60",
    text:   "text-slate-900 dark:text-slate-200",
    hover:  "hover:bg-slate-200 dark:hover:bg-slate-700/70",
  },
};

const FALLBACK_TONE: ChipTone = {
  bg: "bg-yelp",
  border: "border-bd",
  text: "text-yeld",
  hover: "hover:bg-yelp/80",
};

/** Resolve a tag swatch (`bg-emerald-600`-style class) to its
 *  theme-aware soft-pill tone. Unknown swatches fall back to the app's
 *  primary accent pair (`yelp`/`yeld`). */
export function chipTone(color: string): ChipTone {
  return CHIP_TONES[color] ?? FALLBACK_TONE;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function pluralize(s: string): string {
  if (s.endsWith("s")) return s;
  if (s.endsWith("y") && s.length > 1 && !"aeiou".includes(s.charAt(s.length - 2))) {
    return s.slice(0, -1) + "ies";
  }
  return s + "s";
}
