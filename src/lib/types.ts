export type LinkType = "supports" | "challenges" | "came-from" | "open-question";

export interface Link {
  target: string;
  type: LinkType;
}

/** A single margin-ink annotation — see spec §"new in 2.0" / Margin Ink.
 *  `anchor` is a short excerpt of the body this note is about (for
 *  context in the gutter; not used for re-linking). `body` is the
 *  user's prose. `at` is the ISO timestamp the annotation was created.
 *  The shape is deliberately minimal so external markdown tools can
 *  round-trip the YAML without mangling it. */
export interface Annotation {
  anchor?: string;
  body: string;
  at?: string;
}

export interface Frontmatter {
  title: string;
  created: string;
  modified: string;
  links: Link[];
  tags: string[];
  pinned?: boolean;
  encrypted?: boolean;
  kdf?: string;
  salt?: string;
  nonce?: string;
  annotations?: Annotation[];
}

export interface NoteSummary {
  slug: string;
  title: string;
  modified: string;
  excerpt: string;
  pinned?: boolean;
  tags?: string[];
  encrypted?: boolean;
}

export interface Note {
  slug: string;
  frontmatter: Frontmatter;
  body: string;
  encrypted?: boolean;
  locked?: boolean;
}

export interface EncryptionStatus {
  enabled: boolean;
  unlocked: boolean;
  idle_timeout_secs: number;
}

export interface EnableEncryptionOutcome {
  recovery_phrase: string;
}

export interface PathInfo {
  name: string;
  is_current: boolean;
  last_activity: number | null;
}

export interface MergeOutcome {
  clean: boolean;
  conflicts: string[];
  merged_into: string;
}

export interface HistoryEntry {
  oid: string;
  message: string;
  timestamp: number;
  thinking_note: string | null;
}

/** A "keepsake": a user-pinned checkpoint that history pruning will
 *  never touch. Stored as a `refs/yarrow/keepsakes/<id>` git ref (so the
 *  object itself stays reachable no matter what) with a sidecar in
 *  `.yarrow/keepsakes.json` holding the human metadata. */
export interface Keepsake {
  /** Stable id used as the ref basename. Not a git oid. */
  id: string;
  /** Note this keepsake belongs to. */
  slug: string;
  /** Git commit oid being preserved. */
  oid: string;
  /** Short label chosen by the user — shown next to the checkpoint. */
  label: string;
  /** Optional longer note: why this version mattered. */
  note: string;
  /** Unix seconds when the user pinned it. */
  pinned_at: number;
}

export interface ActivityDay {
  /** Local date, `YYYY-MM-DD`. */
  date: string;
  /** Number of checkpoints authored on this date (across all paths). */
  count: number;
}

export interface ClusterSuggestion {
  /** Suggested path name (slug-like). */
  name: string;
  seed_slug: string;
  seed_title: string;
  members: string[];
  member_titles: string[];
  internal_edges: number;
}

export interface Provenance {
  timestamp: number;
  path_name: string;
  oid: string;
}

export interface SyncOutcome {
  ok: boolean;
  fetched: boolean;
  pushed: boolean;
  message: string;
}

export interface GraphNode {
  slug: string;
  title: string;
  tags?: string[];
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: LinkType;
}

export interface Graph {
  notes: GraphNode[];
  links: GraphEdge[];
  last_built: string;
  tags?: TagCount[];
}

export interface RecentWorkspace {
  path: string;
  name: string;
  last_opened: string;
}

export interface AttachmentRef {
  relpath: string;
  size: number;
  markdown: string;
  mime: string;
}

export interface AttachmentData {
  mime: string;
  base64: string;
}

export interface ExportReport {
  dest: string;
  notes_exported: number;
  attachments_exported: number;
  encrypted_skipped?: number;
}

export interface SearchHit {
  slug: string;
  title: string;
  snippet: string;
  score: number;
}

export interface BranchFork {
  parent_branch: string;
  fork_oid: string;
  fork_time: number;
}

export interface BranchTopo {
  name: string;
  tip_oid: string;
  tip_time: number;
  is_current: boolean;
  forked_from: BranchFork | null;
}

export interface PathMeta {
  condition: string;
  set_at?: number | null;
}

/** v2 paths: collections of notes rather than git branches.
 *
 *  `parent` is the **permanent trunk** — the name of the path this was
 *  branched off at creation and never mutated again. Live/ghost status is
 *  derived from parent vs. the current root; see `isGhostPath`. */
export interface PathCollection {
  name: string;
  condition: string;
  /** The permanent trunk. Empty string for paths that were seeded as an
   *  original root. */
  parent: string;
  main_note?: string | null;
  members: string[];
  created_at: number;
  /** User-assigned accent color, as a CSS hex string. When absent, the UI
   *  falls back to the hue derived from the path name in `pathAwareness`. */
  color?: string | null;
  /** When set, any note tagged with this value is auto-added to this
   *  path. Manual additions are preserved; only the reconciler adds. */
  auto_membership_tag?: string | null;
  /** `true` for paths seeded as a full copy of the workspace. New notes
   *  are auto-added to these paths so the "full copy" invariant stays true. */
  full_workspace?: boolean;
}

/** A path is "live" when it is the root, or when its parent chain reaches
 *  the root by walking `parent` pointers. This lets the user build nested
 *  chains (main → trip → budget → ...) with every generation rendering
 *  as part of the current tree rather than being ghosted after the first
 *  level. Ghosts are paths whose chain doesn't reach the current root —
 *  they still exist on disk and snap back live if the root moves to one
 *  of their ancestors. Walk is O(depth) with cycle guard. */
export function isGhostPath(
  c: PathCollection,
  rootName: string,
  collections: PathCollection[],
): boolean {
  if (c.name === rootName) return false;
  const byName = new Map(collections.map((x) => [x.name, x]));
  let cur: PathCollection | undefined = c;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.name)) {
    if (cur.parent === rootName) return false;
    seen.add(cur.name);
    if (!cur.parent) return true;
    cur = byName.get(cur.parent);
  }
  return true;
}

export interface PathCollectionsView {
  root: string;
  collections: PathCollection[];
}

export interface ConflictContent {
  relpath: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  working: string | null;
}

export type WorkspaceMode = "mapped" | "basic";

export interface WorkspaceConfig {
  workspace: {
    name: string;
    created: string;
  };
  sync: {
    remote_url?: string;
    remote_type: string;
    token?: string;
  };
  preferences: {
    decay_days: number;
    autocheckpoint_debounce_ms: number;
    focus_mode_default: boolean;
    ask_thinking_on_close: boolean;
    editor_font_size: number;
    encryption_idle_timeout_secs: number;
    search_index_enabled: boolean;
  };
  mapping: {
    mode: WorkspaceMode;
    main_note?: string | null;
  };
}

export interface TemplateInfo {
  name: string;
  label: string;
  is_daily: boolean;
}

export interface TrashEntry {
  slug: string;
  title: string;
  /** ISO-8601 timestamp from the backend. */
  deleted_at: string;
}

export interface FindReplaceHit {
  slug: string;
  title: string;
  matches: number;
  /** Up to three `[lineNumber, lineText]` previews. */
  samples: Array<[number, string]>;
}

export interface FindReplaceReport {
  notes_changed: number;
  total_replacements: number;
}

export type PathDiffStatus = "added" | "removed" | "modified" | "same";

export interface PathDiffEntry {
  slug: string;
  status: PathDiffStatus;
  left_excerpt: string | null;
  right_excerpt: string | null;
  left_lines: number;
  right_lines: number;
}

export interface PathCompareSummary {
  added: number;
  removed: number;
  modified: number;
  same: number;
}

export interface PathComparison {
  left: string;
  right: string;
  entries: PathDiffEntry[];
  summary: PathCompareSummary;
}

export interface SaveOutcome {
  note: Note;
  notes: NoteSummary[];
  graph: Graph;
  orphans: string[];
  changed: boolean;
}

export interface ObsidianImportReport {
  imported: number;
  skipped: number;
  /** Tuples of `[original_relative_path, slug_assigned]` for files that
   *  collided with existing notes and were renamed. */
  renamed: Array<[string, string]>;
}

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  "supports": "supports",
  "challenges": "challenges",
  "came-from": "came from",
  "open-question": "open question",
};

export const LINK_TYPE_COLORS: Record<LinkType, string> = {
  "supports": "#5B7A5E",
  "challenges": "#A64A3C",
  "came-from": "#928C82",
  "open-question": "#7A4E6E",
};
