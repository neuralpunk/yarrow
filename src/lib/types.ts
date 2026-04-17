export type LinkType = "supports" | "challenges" | "came-from" | "open-question";

export interface Link {
  target: string;
  type: LinkType;
}

export interface Frontmatter {
  title: string;
  created: string;
  modified: string;
  links: Link[];
  tags: string[];
}

export interface NoteSummary {
  slug: string;
  title: string;
  modified: string;
  excerpt: string;
}

export interface Note {
  slug: string;
  frontmatter: Frontmatter;
  body: string;
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

export interface ConflictContent {
  relpath: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  working: string | null;
}

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
  };
}

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  "supports": "supports",
  "challenges": "challenges",
  "came-from": "came from",
  "open-question": "open question",
};

export const LINK_TYPE_COLORS: Record<LinkType, string> = {
  "supports": "#e8b820",
  "challenges": "#d97706",
  "came-from": "#a09c6c",
  "open-question": "#b8900e",
};
