import { invoke } from "@tauri-apps/api/core";
import type {
  AttachmentData,
  AttachmentRef,
  BranchTopo,
  ConflictContent,
  ExportReport,
  Graph,
  HistoryEntry,
  LinkType,
  MergeOutcome,
  Note,
  NoteSummary,
  PathInfo,
  Provenance,
  RecentWorkspace,
  SearchHit,
  SyncOutcome,
  WorkspaceConfig,
} from "./types";

export const api = {
  // workspace
  initWorkspace: (path: string, name?: string) =>
    invoke<WorkspaceConfig>("cmd_init_workspace", { path, name }),
  openWorkspace: (path: string) =>
    invoke<WorkspaceConfig>("cmd_open_workspace", { path }),
  activeWorkspace: () => invoke<string | null>("cmd_active_workspace"),
  closeWorkspace: () => invoke<void>("cmd_close_workspace"),
  readConfig: () => invoke<WorkspaceConfig>("cmd_read_config"),
  setRemote: (url: string, remoteType: string, token?: string) =>
    invoke<WorkspaceConfig>("cmd_set_remote", { url, remoteType, token }),

  // notes
  listNotes: () => invoke<NoteSummary[]>("cmd_list_notes"),
  readNote: (slug: string) => invoke<Note>("cmd_read_note", { slug }),

  // daily notes
  openDaily: (dateIso: string) =>
    invoke<{ note: Note; switched_from: string | null }>("cmd_open_daily", { dateIso }),
  listDaily: (limit?: number) =>
    invoke<NoteSummary[]>("cmd_list_daily", { limit }),

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

  saveNote: (slug: string, body: string, thinkingNote?: string) =>
    invoke<Note>("cmd_save_note", { slug, body, thinkingNote }),
  createNote: (title: string) => invoke<Note>("cmd_create_note", { title }),
  renameNote: (oldSlug: string, newTitle: string) =>
    invoke<Note>("cmd_rename_note", { oldSlug, newTitle }),
  deleteNote: (slug: string) => invoke<void>("cmd_delete_note", { slug }),

  // links
  addLink: (from: string, to: string, linkType: LinkType) =>
    invoke<void>("cmd_add_link", { from, to, linkType }),
  removeLink: (from: string, to: string) =>
    invoke<void>("cmd_remove_link", { from, to }),

  // paths
  listPaths: () => invoke<PathInfo[]>("cmd_list_paths"),
  currentPath: () => invoke<string>("cmd_current_path"),
  createPath: (name: string) => invoke<void>("cmd_create_path", { name }),
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

  // sync
  sync: () => invoke<SyncOutcome>("cmd_sync"),

  // scratchpad
  readScratchpad: () => invoke<string>("cmd_read_scratchpad"),
  saveScratchpad: (content: string) =>
    invoke<void>("cmd_save_scratchpad", { content }),
  promoteScratchpad: (title: string) =>
    invoke<Note>("cmd_promote_scratchpad", { title }),

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
};
