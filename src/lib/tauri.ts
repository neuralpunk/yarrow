// Thin typed façade over the transport layer. This file is the
// pre-refactor `tauri.ts` API surface preserved verbatim — all
// consumers still import `{ api }` from "../lib/tauri". Only the
// underlying transport changed: `invoke()` now goes through the
// pluggable `Transport` in `./transport/`, not `@tauri-apps/api`
// directly. No file outside `src/lib/transport/` should reference
// Tauri's `invoke`.
import { getTransport } from "./transport";
const invoke = <T>(command: string, args?: Record<string, unknown>) =>
  getTransport().invoke<T>(command, args);
import type {
  ActivityDay,
  Annotation,
  ClusterSuggestion,
  AttachmentData,
  AttachmentRef,
  BranchTopo,
  ConflictContent,
  Draft,
  EnableEncryptionOutcome,
  EncryptionStatus,
  ExportReport,
  Graph,
  HistoryEntry,
  Keepsake,
  LinkType,
  MergeOutcome,
  Note,
  NoteSummary,
  PathCollection,
  PathCollectionsView,
  PathInfo,
  PathMeta,
  Provenance,
  RecentWorkspace,
  WelcomeStats,
  SearchHit,
  DiscardOutcome,
  LargeBlobEntry,
  ReclaimSpaceOutcome,
  SyncOutcome,
  TemplateInfo,
  TrashEntry,
  FindReplaceHit,
  FindReplaceReport,
  PathComparison,
  ObsidianImportReport,
  SaveOutcome,
  WorkspaceConfig,
} from "./types";

export const api = {
  /** 3.1 — theme system spec §9.1. Best-effort macOS vibrancy
   *  material switch on theme change. No-op on Linux/Windows
   *  (the command compiles to nothing in the Rust gate). */
  applyThemeVibrancy: (theme: string) =>
    invoke<void>("cmd_apply_theme_vibrancy", { theme }),
  /** 3.1 — theme system spec §9.3. Linux DE colour-scheme probe
   *  (gsettings / GTK_THEME). Returns "light" | "dark" | "unknown";
   *  used as a tiebreaker when matchMedia is indeterminate. */
  detectColorScheme: () =>
    invoke<"light" | "dark" | "unknown">("cmd_detect_color_scheme"),
  // workspace
  initWorkspace: (
    path: string,
    name?: string,
    mode?: "mapped" | "basic",
    startingNoteTitle?: string,
  ) =>
    invoke<WorkspaceConfig>("cmd_init_workspace", {
      path,
      name,
      mode,
      startingNoteTitle,
    }),
  /** 3.0 — clone an existing Yarrow workspace from a git URL into
   *  `<parent>/<name>`. The backend rejects anything that doesn't
   *  contain `.yarrow/config.toml` post-clone, so we never end up
   *  with a random repo masquerading as a workspace. */
  cloneWorkspace: (parent: string, name: string, url: string) =>
    invoke<WorkspaceConfig>("cmd_clone_workspace", { parent, name, url }),
  openWorkspace: (path: string) =>
    invoke<WorkspaceConfig>("cmd_open_workspace", { path }),
  activeWorkspace: () => invoke<string | null>("cmd_active_workspace"),
  closeWorkspace: () => invoke<void>("cmd_close_workspace"),
  readConfig: () => invoke<WorkspaceConfig>("cmd_read_config"),
  setRemote: (url: string, remoteType: string, token?: string) =>
    invoke<WorkspaceConfig>("cmd_set_remote", { url, remoteType, token }),

  // yarrow-server connect — per-workspace. The PAT returned by the
  // password flow never reaches TypeScript; the backend stores it in
  // the OS keychain and only surfaces its presence via `config.sync.server`.
  serverConnectPassword: (
    serverUrl: string,
    email: string,
    password: string,
    workspaceName?: string,
    insecureSkipTlsVerify?: boolean,
  ) =>
    invoke<WorkspaceConfig>("cmd_server_connect_password", {
      serverUrl,
      email,
      password,
      workspaceName: workspaceName ?? null,
      insecureSkipTlsVerify: insecureSkipTlsVerify ?? false,
    }),
  serverConnectToken: (
    serverUrl: string,
    email: string,
    token: string,
    // Password is E2E-only: the backend uses it once locally to
    // derive the X25519 privkey from the server's envelope, then
    // drops it. Never transmitted to the server, never persisted.
    // Pass undefined when connecting to a pre-E2E server or when
    // the user explicitly declines — sync will work for auth but
    // /unlock will fail until they reconnect with a password.
    password: string | undefined,
    workspaceName?: string,
    insecureSkipTlsVerify?: boolean,
  ) =>
    invoke<WorkspaceConfig>("cmd_server_connect_token", {
      serverUrl,
      email,
      token,
      password: password && password.length > 0 ? password : null,
      workspaceName: workspaceName ?? null,
      insecureSkipTlsVerify: insecureSkipTlsVerify ?? false,
    }),
  serverTestConnection: (
    serverUrl: string,
    email: string,
    token: string,
    insecureSkipTlsVerify?: boolean,
  ) =>
    invoke<void>("cmd_server_test_connection", {
      serverUrl,
      email,
      token,
      insecureSkipTlsVerify: insecureSkipTlsVerify ?? false,
    }),
  serverDisconnect: (revokeOnServer: boolean) =>
    invoke<WorkspaceConfig>("cmd_server_disconnect", { revokeOnServer }),

  setWorkspaceMode: (mode: "mapped" | "basic") =>
    invoke<WorkspaceConfig>("cmd_set_workspace_mode", { mode }),
  setMainNote: (slug: string | null) =>
    invoke<WorkspaceConfig>("cmd_set_main_note", { slug }),

  // notes
  listNotes: () => invoke<NoteSummary[]>("cmd_list_notes"),
  readNote: (slug: string) => invoke<Note>("cmd_read_note", { slug }),
  /** Read a note as it exists on a specific path. If that path has a
   *  per-note override saved, the override's body is returned; otherwise
   *  falls back to main's copy. Pass `null` or the workspace root to get
   *  the regular (main) content. */
  readNoteOnPath: (slug: string, pathName: string | null) =>
    invoke<Note>("cmd_read_note_on_path", { slug, pathName }),

  // daily notes
  openDaily: (dateIso: string) =>
    invoke<{ note: Note; switched_from: string | null }>("cmd_open_daily", { dateIso }),
  listDaily: (limit?: number) =>
    invoke<NoteSummary[]>("cmd_list_daily", { limit }),
  listDailyDates: () => invoke<string[]>("cmd_list_daily_dates"),
  readDailyTemplate: () => invoke<string>("cmd_read_daily_template"),
  writeDailyTemplate: (content: string) =>
    invoke<void>("cmd_write_daily_template", { content }),

  // attachments
  attachBytes: (name: string, dataBase64: string) =>
    invoke<AttachmentRef>("cmd_attach_bytes", { name, dataBase64 }),
  attachFromPath: (source: string) =>
    invoke<AttachmentRef>("cmd_attach_from_path", { source }),
  readAttachment: (relpath: string) =>
    invoke<AttachmentData>("cmd_read_attachment", { relpath }),

  // export
  exportStatic: (dest: string) =>
    invoke<ExportReport>("cmd_export_static", { dest }),
  exportPathMarkdown: (pathName: string, dest: string) =>
    invoke<ExportReport>("cmd_export_path_markdown", { pathName, dest }),
  /** Write arbitrary UTF-8 text to a user-chosen path. Used by the
   *  Settings → About export-as-JSON flow once the user picks a
   *  destination via Tauri's save dialog. */
  writeTextFile: (path: string, content: string) =>
    invoke<void>("cmd_write_text_file", { path, content }),
  notesOnPath: (pathName: string) =>
    invoke<{ slug: string; body: string }[]>("cmd_notes_on_path", { pathName }),

  saveNote: (slug: string, body: string, thinkingNote?: string) =>
    invoke<Note>("cmd_save_note", { slug, body, thinkingNote }),
  /** Disk-only quick save. Writes the .md to disk with no checkpoint and
   *  no graph rebuild. The editor fires this on a short timer so user
   *  work survives a crash even when the user-configurable git debounce
   *  is set to several minutes. */
  quicksaveNote: (slug: string, body: string) =>
    invoke<void>("cmd_quicksave_note", { slug, body }),
  /** Combined save: returns the note plus the workspace summaries, graph,
   *  and orphans from a single backend pass. Replaces the four IPC
   *  fan-out the editor used to make after every keystroke pause. */
  saveNoteFull: (slug: string, body: string, thinkingNote?: string) =>
    invoke<SaveOutcome>("cmd_save_note_full", { slug, body, thinkingNote }),
  /** Save onto a specific path. When pathName is non-null and not the root,
   *  the body is written to that path's override file and main is never
   *  touched (no graph rebuild, no checkpoint). Pass null for pathName to
   *  route to the regular save. */
  saveNoteOnPath: (slug: string, body: string, pathName: string | null, thinkingNote?: string) =>
    invoke<Note>("cmd_save_note_on_path", { slug, body, pathName, thinkingNote }),
  /** List slugs for which this path has a scratch override saved. */
  listPathOverrides: (pathName: string) =>
    invoke<string[]>("cmd_list_path_overrides", { pathName }),
  /** Clear a single override — reverts that note on this path back to main's copy. */
  clearPathOverride: (pathName: string, slug: string) =>
    invoke<void>("cmd_clear_path_override", { pathName, slug }),
  /** Promote a path to main: every override on that path is applied to main,
   *  the path's scratch content is cleared, the path collection is deleted,
   *  and the whole operation lands as a single git checkpoint. */
  promotePathToMain: (name: string, thinkingNote?: string) =>
    invoke<{ applied_slugs: string[]; path_name: string }>("cmd_promote_path_to_main", {
      name,
      thinkingNote,
    }),
  createNote: (title: string) => invoke<Note>("cmd_create_note", { title }),
  renameNote: (oldSlug: string, newTitle: string, rewriteWikilinks: boolean) =>
    invoke<Note>("cmd_rename_note", { oldSlug, newTitle, rewriteWikilinks }),
  setTags: (slug: string, tags: string[]) =>
    invoke<Note>("cmd_set_tags", { slug, tags }),
  /** Tag Bouquet (2.1): up to `limit` suggested tags picked from the
   *  note's own words, preferring stems already used as tags somewhere
   *  in the vault. Fully local. Never writes anything. */
  suggestTags: (body: string, title: string, existingTags: string[], limit?: number) =>
    invoke<string[]>("cmd_suggest_tags", { body, title, existingTags, limit }),
  /** Replace a note's margin-ink annotations. Empty bodies are dropped
   *  server-side and a silent checkpoint lands — annotations are versioned
   *  alongside the body so history scrubbing catches both. */
  setAnnotations: (slug: string, annotations: Annotation[]) =>
    invoke<Note>("cmd_set_annotations", { slug, annotations }),

  // keepsakes — pinned checkpoints protected from history pruning
  pinCheckpoint: (slug: string, oid: string, label: string, note?: string) =>
    invoke<Keepsake>("cmd_pin_checkpoint", { slug, oid, label, note }),
  listPinnedCheckpoints: () =>
    invoke<Keepsake[]>("cmd_list_pinned_checkpoints"),
  unpinCheckpoint: (id: string) =>
    invoke<void>("cmd_unpin_checkpoint", { id }),
  /** Pre-flight: how many notes contain `[[Old Title]]` / `[[old-slug]]` so
   *  the user can decide whether to opt into the workspace-wide rewrite. */
  countWikilinkReferences: (slug: string) =>
    invoke<number>("cmd_count_wikilink_references", { slug }),
  deleteNote: (slug: string) => invoke<void>("cmd_delete_note", { slug }),
  noteAbsolutePath: (slug: string) =>
    invoke<string>("cmd_note_absolute_path", { slug }),
  setPinned: (slug: string, pinned: boolean) =>
    invoke<Note>("cmd_set_pinned", { slug, pinned }),
  setNoteFolder: (slug: string, folder: string | null) =>
    invoke<Note>("cmd_set_note_folder", { slug, folder }),

  // links
  addLink: (from: string, to: string, linkType: LinkType) =>
    invoke<void>("cmd_add_link", { from, to, linkType }),
  removeLink: (from: string, to: string) =>
    invoke<void>("cmd_remove_link", { from, to }),

  // paths
  listPaths: () => invoke<PathInfo[]>("cmd_list_paths"),
  currentPath: () => invoke<string>("cmd_current_path"),
  createPath: (name: string, condition?: string, from?: string) =>
    invoke<void>("cmd_create_path", { name, condition, from }),
  listPathMeta: () => invoke<Record<string, PathMeta>>("cmd_list_path_meta"),
  setPathCondition: (branch: string, condition: string) =>
    invoke<void>("cmd_set_path_condition", { branch, condition }),
  setNoteOnPath: (branch: string, slug: string, present: boolean) =>
    invoke<void>("cmd_set_note_on_path", { branch, slug, present }),

  // paths v2 (collections of notes, not git branches)
  listPathCollections: () =>
    invoke<PathCollectionsView>("cmd_list_path_collections"),
  createPathCollection: (name: string, condition: string, parent: string, mainNote?: string) =>
    invoke<PathCollection>("cmd_create_path_collection", {
      name, condition, parent, mainNote,
    }),
  deletePathCollection: (name: string) =>
    invoke<void>("cmd_delete_path_collection", { name }),
  renamePathCollection: (oldName: string, newName: string) =>
    invoke<void>("cmd_rename_path_collection", { oldName, newName }),
  setPathCollectionCondition: (name: string, condition: string) =>
    invoke<void>("cmd_set_path_collection_condition", { name, condition }),
  setPathCollectionColor: (name: string, color: string | null) =>
    invoke<void>("cmd_set_path_collection_color", { name, color }),
  setPathCollectionAutoTag: (name: string, tag: string | null) =>
    invoke<void>("cmd_set_path_collection_auto_tag", { name, tag }),
  suggestPathClusters: () =>
    invoke<ClusterSuggestion[]>("cmd_suggest_path_clusters"),
  setPathCollectionMainNote: (name: string, slug: string | null) =>
    invoke<void>("cmd_set_path_collection_main_note", { name, slug }),
  setPathCollectionParent: (name: string, parent: string) =>
    invoke<void>("cmd_set_path_collection_parent", { name, parent }),
  addNoteToPathCollection: (name: string, slug: string) =>
    invoke<void>("cmd_add_note_to_path_collection", { name, slug }),
  removeNoteFromPathCollection: (name: string, slug: string) =>
    invoke<void>("cmd_remove_note_from_path_collection", { name, slug }),
  setPathCollectionRoot: (name: string) =>
    invoke<void>("cmd_set_path_collection_root", { name }),
  switchPath: (name: string) => invoke<void>("cmd_switch_path", { name }),
  deletePath: (name: string) => invoke<void>("cmd_delete_path", { name }),
  mergePath: (from: string) => invoke<MergeOutcome>("cmd_merge_path", { from }),

  // graph
  getGraph: () => invoke<Graph>("cmd_get_graph"),
  orphans: () => invoke<string[]>("cmd_orphans"),

  // history
  noteHistory: (slug: string) =>
    invoke<HistoryEntry[]>("cmd_note_history", { slug }),
  writingActivity: (days: number) =>
    invoke<ActivityDay[]>("cmd_writing_activity", { days }),
  noteAtCheckpoint: (slug: string, oid: string) =>
    invoke<string>("cmd_note_at_checkpoint", { slug, oid }),
  restoreNote: (slug: string, oid: string) =>
    invoke<void>("cmd_restore_note", { slug, oid }),
  paragraphProvenance: (slug: string, line: number) =>
    invoke<Provenance>("cmd_paragraph_provenance", { slug, line }),

  // history pruning
  pruneHistoryOlderThan: (days: number) =>
    invoke<{ removed: number; kept: number }>("cmd_prune_history_older_than", { days }),
  pruneEmptyCheckpoints: () =>
    invoke<{ removed: number; kept: number }>("cmd_prune_empty_checkpoints"),

  // bibliography (2.2.0)
  renderBibliography: (slug: string) =>
    invoke<string>("cmd_render_bibliography", { slug }),
  insertBibliography: (slug: string) =>
    invoke<Note>("cmd_insert_bibliography", { slug }),

  // multi-note PDF render (2.2.0)
  renderNotesHtml: (slugs: string[]) =>
    invoke<string>("cmd_render_notes_html", { slugs }),
  renderPathHtml: (pathName: string) =>
    invoke<string>("cmd_render_path_html", { pathName }),

  // recipe URL clipper (2.2.0)
  clipRecipe: (url: string) => invoke<Note>("cmd_clip_recipe", { url }),

  // smart shopping list (2.2.0)
  addRecipeToShoppingList: (slug: string) =>
    invoke<{ added: number; skipped_duplicates: number; source_title: string }>(
      "cmd_add_recipe_to_shopping_list",
      { slug },
    ),
  shoppingListSlug: () => invoke<string>("cmd_shopping_list_slug"),

  // sync
  sync: () => invoke<SyncOutcome>("cmd_sync"),
  discardUnsyncedChanges: (confirm: boolean) =>
    invoke<DiscardOutcome>("cmd_discard_unsynced_changes", { confirm }),
  forceAlignWithServer: (confirm: boolean) =>
    invoke<DiscardOutcome>("cmd_force_align_with_server", { confirm }),
  listLargeBlobs: () =>
    invoke<LargeBlobEntry[]>("cmd_list_large_blobs"),
  reclaimSpace: (paths: string[], expectedDiskBytes: number | null) =>
    invoke<ReclaimSpaceOutcome>("cmd_reclaim_space", {
      paths,
      expectedDiskBytes,
    }),

  // borrow (spec §5.3) — pull one paragraph or one whole note from a
  // source path into a destination path. The destination advances; the
  // source is untouched. Empty path string === main.
  borrowNote: (slug: string, sourcePath: string, destPath: string) =>
    invoke<Note>("cmd_borrow_note", { slug, sourcePath, destPath }),
  borrowText: (
    slug: string,
    sourcePath: string,
    destPath: string,
    sourceStart: number,
    sourceEnd: number,
    destStart: number,
    destEnd: number,
  ) =>
    invoke<Note>("cmd_borrow_text", {
      slug,
      sourcePath,
      destPath,
      sourceStart,
      sourceEnd,
      destStart,
      destEnd,
    }),

  // path archive (spec §5.5 / §6.8) — "set aside" without deleting.
  setPathArchived: (name: string, archived: boolean) =>
    invoke<void>("cmd_set_path_archived", { name, archived }),

  /** Which non-root paths have a divergent override of this note?
   *  Empty list when the note is identical across every path.
   *  Used by the editor metadata strip's path-awareness line. */
  pathsDivergingForNote: (slug: string) =>
    invoke<string[]>("cmd_paths_diverging_for_note", { slug }),

  /** Per-path divergence summary for the whole workspace — used by
   *  the path map for "5 differ from main" badges and by the
   *  decision matrix for ◐ (differs) cell indicators. `slugs` lists
   *  every note whose body diverges on that path. */
  pathDivergenceSummary: () =>
    invoke<{ name: string; differs: number; slugs: string[] }[]>(
      "cmd_path_divergence_summary",
    ),

  // drafts (Pillar 2) — alternative bodies for a single note. The user
  // sees a tab strip above the editor: [main] [draft-1] [draft-2] [+].
  // Promoting a draft replaces the canonical body and emits a normal
  // checkpoint; discarding is permanent (no trash).
  draftListForNote: (slug: string) =>
    invoke<Draft[]>("cmd_draft_list_for_note", { slug }),
  draftCreate: (slug: string, displayName: string, seedBody: string) =>
    invoke<Draft>("cmd_draft_create", {
      slug,
      displayName,
      seedBody,
    }),
  draftRead: (slug: string, draftId: string) =>
    invoke<string>("cmd_draft_read", { slug, draftId }),
  draftSave: (slug: string, draftId: string, body: string) =>
    invoke<void>("cmd_draft_save", { slug, draftId, body }),
  draftRename: (slug: string, draftId: string, displayName: string) =>
    invoke<void>("cmd_draft_rename", { slug, draftId, displayName }),
  draftDiscard: (slug: string, draftId: string) =>
    invoke<void>("cmd_draft_discard", { slug, draftId }),
  draftPromote: (slug: string, draftId: string) =>
    invoke<Note>("cmd_draft_promote", { slug, draftId }),

  // scratchpad
  readScratchpad: () => invoke<string>("cmd_read_scratchpad"),
  saveScratchpad: (content: string) =>
    invoke<void>("cmd_save_scratchpad", { content }),
  promoteScratchpad: (title: string) =>
    invoke<Note>("cmd_promote_scratchpad", { title }),
  appendScratchpad: (entry: string) =>
    invoke<void>("cmd_append_scratchpad", { entry }),

  // search
  search: (query: string, limit?: number) =>
    invoke<SearchHit[]>("cmd_search", { query, limit }),
  /** Drop the SQLite/FTS5 search cache. Next search (if indexing is
   *  still enabled) triggers a full rebuild. Safe to call anytime —
   *  the canonical notes are untouched. */
  clearSearchIndex: () => invoke<void>("cmd_clear_search_index"),
  /** 2.1 Fuzzy-rank a list of strings against a query using nucleo.
   *  Returns at most `limit` `{index, score}` pairs in score-
   *  descending order; non-matches are omitted. Empty query returns
   *  the first N candidates in input order. */
  fuzzyRank: (query: string, candidates: string[], limit?: number) =>
    invoke<{ index: number; score: number }[]>("cmd_fuzzy_rank", {
      query, candidates, limit,
    }),
  /** Force a full rebuild of the search cache. Returns the row count. */
  rebuildSearchIndex: () => invoke<number>("cmd_rebuild_search_index"),
  /** Nuke every derived cache — graph index.json and search index.db
   *  with its WAL sidecars. Notes are never touched; both caches
   *  rebuild on demand. */
  clearAllCache: () => invoke<void>("cmd_clear_all_cache"),

  // branch topology
  branchTopology: () => invoke<BranchTopo[]>("cmd_branch_topology"),

  // preferences
  updatePreferences: (prefs: WorkspaceConfig["preferences"]) =>
    invoke<WorkspaceConfig>("cmd_update_preferences", { prefs }),
  updateWorkspaceName: (name: string) =>
    invoke<WorkspaceConfig>("cmd_update_workspace_name", { name }),

  // recent workspaces
  listRecentWorkspaces: () =>
    invoke<RecentWorkspace[]>("cmd_list_recent_workspaces"),
  forgetRecentWorkspace: (path: string) =>
    invoke<void>("cmd_forget_recent_workspace", { path }),
  renameRecentWorkspace: (path: string, name: string) =>
    invoke<void>("cmd_rename_recent_workspace", { path, name }),
  // IntroPage welcome stats — computed fresh on every IntroPage mount
  // (no in-session cache, per the spec's snapshot model).
  welcomeStats: () => invoke<WelcomeStats>("cmd_welcome_stats"),

  // encryption
  encryptionStatus: () => invoke<EncryptionStatus>("cmd_encryption_status"),
  enableEncryption: (password: string) =>
    invoke<EnableEncryptionOutcome>("cmd_enable_encryption", { password }),
  unlockEncryption: (password: string) =>
    invoke<EncryptionStatus>("cmd_unlock_encryption", { password }),
  recoverEncryption: (phrase: string, newPassword: string) =>
    invoke<EncryptionStatus>("cmd_recover_encryption", { phrase, newPassword }),
  lockEncryption: () => invoke<void>("cmd_lock_encryption"),
  activityPing: () => invoke<boolean>("cmd_activity_ping"),
  changeEncryptionPassword: (oldPassword: string, newPassword: string) =>
    invoke<void>("cmd_change_encryption_password", { oldPassword, newPassword }),
  regenerateRecoveryPhrase: (password: string) =>
    invoke<EnableEncryptionOutcome>("cmd_regenerate_recovery_phrase", { password }),
  disableEncryption: (password: string) =>
    invoke<void>("cmd_disable_encryption", { password }),
  encryptNote: (slug: string) => invoke<Note>("cmd_encrypt_note", { slug }),
  decryptNote: (slug: string) => invoke<Note>("cmd_decrypt_note", { slug }),

  // templates
  listTemplates: () => invoke<TemplateInfo[]>("cmd_list_templates"),
  readTemplate: (name: string) => invoke<string>("cmd_read_template", { name }),
  writeTemplate: (name: string, content: string) =>
    invoke<void>("cmd_write_template", { name, content }),
  deleteTemplate: (name: string) => invoke<void>("cmd_delete_template", { name }),
  createFromTemplate: (template: string, title: string) =>
    invoke<Note>("cmd_create_from_template", { template, title }),

  // conflicts / merge
  mergeState: () => invoke<boolean>("cmd_merge_state"),
  listConflicts: () => invoke<string[]>("cmd_list_conflicts"),
  getConflict: (relpath: string) =>
    invoke<ConflictContent>("cmd_get_conflict", { relpath }),
  resolveConflict: (relpath: string, content: string) =>
    invoke<void>("cmd_resolve_conflict", { relpath, content }),
  finalizeMerge: (thinking?: string) =>
    invoke<void>("cmd_finalize_merge", { thinking }),
  abortMerge: () => invoke<void>("cmd_abort_merge"),

  // smart paste
  fetchUrlTitle: (url: string) => invoke<string>("cmd_fetch_url_title", { url }),

  // trash
  listTrash: () => invoke<TrashEntry[]>("cmd_list_trash"),
  restoreFromTrash: (slug: string) => invoke<string>("cmd_restore_from_trash", { slug }),
  purgeFromTrash: (slug: string) => invoke<void>("cmd_purge_from_trash", { slug }),
  emptyTrash: () => invoke<void>("cmd_empty_trash"),

  // print / pdf
  renderNoteHtml: (slug: string) => invoke<string>("cmd_render_note_html", { slug }),
  renderNoteBodyHtml: (slug: string) => invoke<string>("cmd_render_note_body_html", { slug }),
  renderMarkdownHtml: (body: string) => invoke<string>("cmd_render_markdown_html", { body }),

  // find & replace
  findReplacePreview: (
    pattern: string,
    regexMode: boolean,
    caseInsensitive: boolean,
    scopeSlugs: string[] | null,
  ) => invoke<FindReplaceHit[]>("cmd_find_replace_preview", {
    pattern, regexMode, caseInsensitive, scopeSlugs,
  }),
  findReplaceApply: (
    pattern: string,
    replacement: string,
    regexMode: boolean,
    caseInsensitive: boolean,
    scopeSlugs: string[] | null,
  ) => invoke<FindReplaceReport>("cmd_find_replace_apply", {
    pattern, replacement, regexMode, caseInsensitive, scopeSlugs,
  }),

  // dictionary
  readDictionary: () => invoke<string[]>("cmd_read_dictionary"),
  writeDictionary: (words: string[]) => invoke<void>("cmd_write_dictionary", { words }),

  // windows
  openNewWindow: () => invoke<void>("cmd_open_new_window"),

  // path comparison
  comparePaths: (left: string, right: string) =>
    invoke<PathComparison>("cmd_compare_paths", { left, right }),

  // obsidian import
  initSampleWorkspace: (path: string, name?: string | null) =>
    invoke<WorkspaceConfig>("cmd_init_sample_workspace", { path, name: name ?? null }),
  importObsidianVault: (source: string) =>
    invoke<ObsidianImportReport>("cmd_import_obsidian_vault", { source }),
  importBearVault: (source: string) =>
    invoke<ObsidianImportReport>("cmd_import_bear_vault", { source }),
  importLogseqVault: (source: string) =>
    invoke<ObsidianImportReport>("cmd_import_logseq_vault", { source }),
  importNotionVault: (source: string) =>
    invoke<ObsidianImportReport>("cmd_import_notion_vault", { source }),
  importBibtex: (source: string) =>
    invoke<ObsidianImportReport>("cmd_import_bibtex", { source }),

  // new-workspace wizard
  defaultWorkspacesRoot: () => invoke<string>("cmd_default_workspaces_root"),
  createWorkspaceDir: (parent: string, name: string) =>
    invoke<string>("cmd_create_workspace_dir", { parent, name }),

  // 3.0 visual polish: Linux desktop-environment introspection.
  // Returns "gnome" | "kde" | "xfce" | "cinnamon" | "mate" | "unity"
  // | "lxqt" | "lxde" | "unknown" | "" (empty for non-Linux). The
  // bootstrap in main.tsx surfaces this as a `data-de="<de>"`
  // attribute on <html> so CSS can opt in to platform-conditional
  // chrome (e.g. GNOME-style header treatment, KDE Breeze borders).
  desktopEnv: () => invoke<string>("cmd_desktop_env"),
};
