import { invoke } from "@tauri-apps/api/core";
import type {
  AttachmentData,
  AttachmentRef,
  BranchTopo,
  ConflictContent,
  EnableEncryptionOutcome,
  EncryptionStatus,
  ExportReport,
  Graph,
  HistoryEntry,
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
  SearchHit,
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
  openWorkspace: (path: string) =>
    invoke<WorkspaceConfig>("cmd_open_workspace", { path }),
  activeWorkspace: () => invoke<string | null>("cmd_active_workspace"),
  closeWorkspace: () => invoke<void>("cmd_close_workspace"),
  readConfig: () => invoke<WorkspaceConfig>("cmd_read_config"),
  setRemote: (url: string, remoteType: string, token?: string) =>
    invoke<WorkspaceConfig>("cmd_set_remote", { url, remoteType, token }),
  setWorkspaceMode: (mode: "mapped" | "basic") =>
    invoke<WorkspaceConfig>("cmd_set_workspace_mode", { mode }),
  setMainNote: (slug: string | null) =>
    invoke<WorkspaceConfig>("cmd_set_main_note", { slug }),

  // notes
  listNotes: () => invoke<NoteSummary[]>("cmd_list_notes"),
  readNote: (slug: string) => invoke<Note>("cmd_read_note", { slug }),

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
  notesOnPath: (pathName: string) =>
    invoke<{ slug: string; body: string }[]>("cmd_notes_on_path", { pathName }),

  saveNote: (slug: string, body: string, thinkingNote?: string) =>
    invoke<Note>("cmd_save_note", { slug, body, thinkingNote }),
  /** Combined save: returns the note plus the workspace summaries, graph,
   *  and orphans from a single backend pass. Replaces the four IPC
   *  fan-out the editor used to make after every keystroke pause. */
  saveNoteFull: (slug: string, body: string, thinkingNote?: string) =>
    invoke<SaveOutcome>("cmd_save_note_full", { slug, body, thinkingNote }),
  createNote: (title: string) => invoke<Note>("cmd_create_note", { title }),
  renameNote: (oldSlug: string, newTitle: string, rewriteWikilinks: boolean) =>
    invoke<Note>("cmd_rename_note", { oldSlug, newTitle, rewriteWikilinks }),
  setTags: (slug: string, tags: string[]) =>
    invoke<Note>("cmd_set_tags", { slug, tags }),
  /** Pre-flight: how many notes contain `[[Old Title]]` / `[[old-slug]]` so
   *  the user can decide whether to opt into the workspace-wide rewrite. */
  countWikilinkReferences: (slug: string) =>
    invoke<number>("cmd_count_wikilink_references", { slug }),
  deleteNote: (slug: string) => invoke<void>("cmd_delete_note", { slug }),
  noteAbsolutePath: (slug: string) =>
    invoke<string>("cmd_note_absolute_path", { slug }),
  setPinned: (slug: string, pinned: boolean) =>
    invoke<Note>("cmd_set_pinned", { slug, pinned }),

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

  // sync
  sync: () => invoke<SyncOutcome>("cmd_sync"),

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
  importObsidianVault: (source: string) =>
    invoke<ObsidianImportReport>("cmd_import_obsidian_vault", { source }),

  // new-workspace wizard
  defaultWorkspacesRoot: () => invoke<string>("cmd_default_workspaces_root"),
  createWorkspaceDir: (parent: string, name: string) =>
    invoke<string>("cmd_create_workspace_dir", { parent, name }),
};
