// Persona → tag-config silent migration. Runs once per workspace at
// AppShell mount time. If the workspace already has a tag config, no-op.
// If it doesn't, read whichever persona id was active for this
// workspace (workspace-scoped storage), look up the matching starter
// pack, and apply it.
//
// The mapping is deliberately one-to-one with the v3.0 personas so a
// returning user wakes up to roughly the same tags they'd have built
// up under the persona system. After migration the tag config belongs
// to the user — they can edit, remove, or add freely. There is no
// "current persona" anymore.
//
// This module also handles importing the pack's bundled markdown
// templates via `cmd_write_template`. Templates already present (same
// name) are left alone so a returning user's edits are preserved.

import { tags } from "./tags.svelte";
import { packById, STARTER_PACKS, type StarterPack } from "./packs";
import { wsKey } from "./workspaceScope.svelte";
import { api } from "./tauri";

const PERSONA_KEY = "yarrow.persona";
const LEGACY_MODE_KEY = "yarrow.mode";
const MIGRATION_DONE_KEY = "yarrow.tags.migrated";

/** Persona id (or legacy mode id) → starter pack id. Personas without
 *  a matching pack (basic, default) seed an empty config: the user is
 *  starting from a blank slate, which is the right behavior for those. */
const PERSONA_TO_PACK: Record<string, string | null> = {
  basic: null,
  default: null,
  path: null,           // legacy alias for default
  writer: "writing",
  researcher: "research",
  developer: "engineering",
  clinician: "clinical",
  cooking: "recipes",
};

/** Read a workspace-scoped (or global fallback) value from
 *  localStorage. Mirrors `readScoped()` in workspaceScope.svelte but
 *  inlined here so we don't import a Svelte rune file. */
function readScopedRaw(base: string): string | null {
  try {
    const scoped = localStorage.getItem(wsKey(base));
    if (scoped !== null) return scoped;
    return localStorage.getItem(base);
  } catch {
    return null;
  }
}

function migrationDone(): boolean {
  return readScopedRaw(MIGRATION_DONE_KEY) === "1";
}

function markMigrated(): void {
  try {
    localStorage.setItem(wsKey(MIGRATION_DONE_KEY), "1");
  } catch { /* ignore */ }
}

/** Run the migration if needed. Idempotent: if the workspace already
 *  has tag config, or has been migrated before, this does nothing. */
export async function migratePersonaToTags(): Promise<{
  migrated: boolean;
  pack: StarterPack | null;
}> {
  if (migrationDone()) return { migrated: false, pack: null };
  if (!tags.isEmpty) {
    // User already has tags — likely set up via the new system or by
    // a previous run. Mark migrated and bail.
    markMigrated();
    return { migrated: false, pack: null };
  }

  const personaId = readScopedRaw(PERSONA_KEY)
    ?? readScopedRaw(LEGACY_MODE_KEY)
    ?? "default";

  const packId = PERSONA_TO_PACK[personaId] ?? null;
  if (!packId) {
    markMigrated();
    return { migrated: true, pack: null };
  }

  const pack = packById(packId);
  if (!pack) {
    markMigrated();
    return { migrated: true, pack: null };
  }

  await applyPack(pack);
  markMigrated();
  return { migrated: true, pack };
}

/** Apply a starter pack to the active workspace: merge its tags into
 *  the tag config (existing tag names win), seed any of the pack's
 *  `defaultPins` into the workspace pinned-list (only for tag names
 *  not already pinned), and write its templates via the backend
 *  (existing templates win). Safe to call any time. */
export async function applyPack(pack: StarterPack): Promise<void> {
  const existingNames = new Set(tags.config.tags.map((t) => t.name));
  // Stamp `group: pack.id` on each pack-contributed tag so the sidebar
  // tag list can render it under the pack's persona-group header.
  // Existing user tags keep whatever group they already had.
  const mergedTags = [
    ...tags.config.tags,
    ...pack.tags
      .filter((t) => !existingNames.has(t.name))
      .map((t) => ({ ...t, group: t.group ?? pack.id })),
  ];

  const knownAfter = new Set(mergedTags.map((t) => t.name));
  const currentPins = new Set(tags.config.pinnedToStatusBar);
  const pinAdditions = pack.defaultPins.filter(
    (n) => knownAfter.has(n) && !currentPins.has(n),
  );
  const mergedPins = [...tags.config.pinnedToStatusBar, ...pinAdditions];

  tags.setAll({
    version: 2,
    tags: mergedTags,
    pinnedToStatusBar: mergedPins,
  });

  // Write templates that don't exist yet. `cmd_write_template`
  // overwrites unconditionally, so probe first to preserve any
  // user-edited templates from a prior workspace setup.
  let existingTemplates: ReadonlySet<string>;
  try {
    const list = await api.listTemplates();
    existingTemplates = new Set(list.map((t) => t.name));
  } catch {
    existingTemplates = new Set();
  }
  for (const [name, body] of Object.entries(pack.templates)) {
    if (existingTemplates.has(name)) continue;
    try {
      await api.writeTemplate(name, body);
    } catch {
      // Best-effort: if a template fails to write we keep going.
    }
  }
}

/** Idempotent backfill: for any tag in the current config whose name
 *  matches a starter-pack tag and has no `group` set, stamp the pack
 *  id as its group. Workspaces that migrated under an earlier 3.2
 *  build (before tags carried a group field) get their pack-seeded
 *  tags picked up by the sidebar's grouped tag list without
 *  re-running the persona migration. Safe to call on every mount —
 *  no-ops when every known tag already has a group. */
export function backfillPackGroups(): void {
  if (tags.config.tags.length === 0) return;
  const packGroupByTagName = new Map<string, string>();
  for (const pack of STARTER_PACKS) {
    for (const t of pack.tags) {
      if (!packGroupByTagName.has(t.name)) {
        packGroupByTagName.set(t.name, pack.id);
      }
    }
  }
  let mutated = false;
  const next = tags.config.tags.map((def) => {
    if (def.group) return def;
    const inferred = packGroupByTagName.get(def.name);
    if (!inferred) return def;
    mutated = true;
    return { ...def, group: inferred };
  });
  if (!mutated) return;
  tags.setAll({
    version: 2,
    tags: next,
    pinnedToStatusBar: tags.config.pinnedToStatusBar,
  });
}
