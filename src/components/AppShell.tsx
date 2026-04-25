import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/tauri";
import { useT } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { openQuestions } from "../lib/forkDetection";
import { relativeTime, todayIso } from "../lib/format";
import { prefetchHeavyChunks } from "../lib/prefetch";
import { getCachedOrReadNote, invalidateAllNotes, invalidateNote } from "../lib/notePrefetch";
import { SearchIcon, StatusDot, ChevronDownIcon, DeleteIcon, JournalIcon, ActivityIcon } from "../lib/icons";
import { useShowRawMarkdown, useEditorFont } from "../lib/editorPrefs";
// Imported for its module-level side effect: applies the saved UI font
// and UI scale to the document before first paint, so chrome doesn't
// flash the defaults on cold start.
import "../lib/uiPrefs";
// Same pattern for Paper & Warmth (2.1) — applies saved texture and
// warmth to <html> before the first paint.
import "../lib/paperPrefs";
import { SK } from "../lib/platform";
import { workspaceAccent } from "../lib/workspaceAccent";
import RightRail, { type RailOverlay } from "./RightRail";
import FloatingDirectionCTA from "./Editor/FloatingDirectionCTA";
import RadialMenu from "./Editor/RadialMenu";
import LinearContextMenu from "./Editor/LinearContextMenu";
import {
  buildRadialInsertItems,
  buildRadialSelectionItems,
  type RadialCallbacks,
} from "./Editor/radialItems";
import { useExtraRadialMenu } from "../lib/extraPrefs";
import MainNotePrompt from "./MainNotePrompt";
import type {
  BranchTopo,
  EncryptionStatus,
  Graph,
  HistoryEntry,
  LinkType,
  Note,
  NoteSummary,
  PathInfo,
  TemplateInfo,
  WorkspaceConfig,
} from "../lib/types";
import NoteList from "./LeftSidebar/NoteList";
import JournalCalendar from "./LeftSidebar/JournalCalendar";
import Toolbar from "./Editor/Toolbar";
import LinkedNotesList from "./RightSidebar/LinkedNotesList";
import OpenQuestions from "./RightSidebar/OpenQuestions";
import Transclusions from "./RightSidebar/Transclusions";
import Modal from "./Modal";
import QuotaBlockedModal from "./QuotaBlockedModal";
import ForkMoment from "./ForkMoment";
import GuidanceHost from "./Guidance/GuidanceHost";
import PathRibbon from "./Guidance/PathRibbon";
import { useGuidance } from "../lib/guidanceStore";
import {
  forgetLeftOff,
  isHiddenLeftOff,
  readLeftOff,
  saveLeftOff,
  setHideLeftOff,
  snippetFromBody,
  type LeftOffState,
} from "../lib/leftOff";
import WhereYouLeftOffBanner from "./WhereYouLeftOffBanner";

// Heavy or rarely-used screens: lazy so they're not in the first paint.
// Each `import()` is captured as a thunk so we can call it later from
// `prewarmLazyChunks` to prime the module cache during idle time —
// first-open of any modal then bypasses the network fetch + parse +
// execute cycle and feels instant. Without prewarm, opening Command
// Palette / Settings / Trash for the first time pays a full chunk
// cost (~100-300 ms on Linux webkit2gtk) which read as "modal lag".
const importHistorySlider   = () => import("./Editor/HistorySlider");
const importConnectionGraph = () => import("./RightSidebar/ConnectionGraph");
const importScratchpad      = () => import("./Scratchpad");
const importTrash           = () => import("./Trash");
const importFindReplace     = () => import("./FindReplace");
const importPathCompare     = () => import("./PathCompare");
const importDecisionMatrix  = () => import("./DecisionMatrix");
const importObsidianImport  = () => import("./ObsidianImport");
const importSpellMenu       = () => import("./SpellMenu");
const importQuickCapture    = () => import("./QuickCapture");
const importSettings        = () => import("./Settings");
const importCommandPalette  = () => import("./CommandPalette");
const importQuickSwitcher   = () => import("./QuickSwitcher");
const importConflictResolver= () => import("./ConflictResolver");
const importPathDiff        = () => import("./PathDiff");
const importPathsPane       = () => import("./PathsPane");
const importConditionEditor = () => import("./Paths/ConditionEditor");
const importUnlockPrompt    = () => import("./UnlockPrompt");
const importWikilinkPicker  = () => import("./WikilinkPicker");
const importActivityHeatmap = () => import("./ActivityHeatmap");
const importTagGraph        = () => import("./TagGraph");
const importTableInsertModal= () => import("./TableInsertModal");
const importJournalKits     = () => import("./JournalKits");
const importCustomTemplatesModal = () => import("./CustomTemplatesModal");
const importCalloutInsertModal = () => import("./CalloutInsertModal");

const HistorySlider    = lazy(importHistorySlider);
const ConnectionGraph  = lazy(importConnectionGraph);
const Scratchpad       = lazy(importScratchpad);
const Trash            = lazy(importTrash);
const FindReplace      = lazy(importFindReplace);
const PathCompare      = lazy(importPathCompare);
const DecisionMatrix   = lazy(importDecisionMatrix);
const ObsidianImport   = lazy(importObsidianImport);
const SpellMenu        = lazy(importSpellMenu);
const QuickCapture     = lazy(importQuickCapture);
const Settings         = lazy(importSettings);
const CommandPalette   = lazy(importCommandPalette);
const QuickSwitcher    = lazy(importQuickSwitcher);
const ConflictResolver = lazy(importConflictResolver);
const PathDiff         = lazy(importPathDiff);
const PathsPane        = lazy(importPathsPane);
const ConditionEditor  = lazy(importConditionEditor);
const UnlockPrompt     = lazy(importUnlockPrompt);
const WikilinkPicker   = lazy(importWikilinkPicker);
const ActivityHeatmap  = lazy(importActivityHeatmap);
const TagGraph         = lazy(importTagGraph);
const TableInsertModal = lazy(importTableInsertModal);
// 2.1 Journal Kits picker — small modal, only shown on explicit invocation.
const JournalKits      = lazy(importJournalKits);
const CustomTemplatesModal = lazy(importCustomTemplatesModal);
const CalloutInsertModal = lazy(importCalloutInsertModal);

/** Walk every lazy chunk during the next idle window and trigger its
 *  dynamic import. Modules land in the bundler cache so first-open of
 *  any modal is just a render — the chunk fetch, parse, and execute
 *  costs already paid. We split into two passes: high-traffic modals
 *  (the ones a user is likely to hit in their first session) prefetch
 *  immediately on idle; the long tail waits for a second idle slot so
 *  we don't blow the network budget on app boot.
 *
 *  Soft-failure on every promise: a failed prefetch isn't user-visible
 *  (the `lazy()` Suspense path will retry on actual open) so we just
 *  swallow rejections rather than logging noise. */
function prewarmLazyChunks() {
  const idle: (cb: () => void, opts?: { timeout: number }) => void =
    (window as unknown as { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback ?? ((cb) => window.setTimeout(cb, 1));

  idle(
    () => {
      void importCommandPalette().catch(() => {});
      void importQuickSwitcher().catch(() => {});
      void importSettings().catch(() => {});
      void importHistorySlider().catch(() => {});
      void importTrash().catch(() => {});
      void importFindReplace().catch(() => {});
      void importScratchpad().catch(() => {});
      void importWikilinkPicker().catch(() => {});
    },
    { timeout: 4000 },
  );
  idle(
    () => {
      void importConnectionGraph().catch(() => {});
      void importPathsPane().catch(() => {});
      void importPathCompare().catch(() => {});
      void importPathDiff().catch(() => {});
      void importConditionEditor().catch(() => {});
      void importDecisionMatrix().catch(() => {});
      void importTagGraph().catch(() => {});
      void importActivityHeatmap().catch(() => {});
      void importObsidianImport().catch(() => {});
      void importJournalKits().catch(() => {});
      void importCustomTemplatesModal().catch(() => {});
      void importCalloutInsertModal().catch(() => {});
      void importTableInsertModal().catch(() => {});
      void importQuickCapture().catch(() => {});
      void importSpellMenu().catch(() => {});
      void importUnlockPrompt().catch(() => {});
      void importConflictResolver().catch(() => {});
    },
    { timeout: 8000 },
  );
}
const WorkspaceSwitcher = lazy(() => import("./WorkspaceSwitcher"));
// The editor ships its own CodeMirror chunk. Keeping it lazy + idle-warmed
// shaves the CM parse cost out of first paint without hurting time-to-edit.
const NoteEditor       = lazy(() => import("./Editor/NoteEditor"));
const NoteReader       = lazy(() => import("./Editor/NoteReader"));
const OnboardingHints  = lazy(() => import("./OnboardingHints"));
const InlineDiffPane   = lazy(() => import("./InlineDiffPane"));

/**
 * Tiny Suspense wrapper for lazy-loaded modals. Each overlay gets its own
 * boundary so that suspending the Settings import (for example) doesn't
 * collapse the whole app shell to a fallback.
 */
function L({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

type SyncStatus = "synced" | "pending" | "syncing" | "error" | "no-remote";

/** A workspace has a "remote" in the sync sense if it's either wired
 *  up to a generic git remote or connected to a Yarrow server. The
 *  status pill and the handleSync gate must agree — otherwise you get
 *  "not synced anywhere" staring back at users who've already signed
 *  into a Yarrow server. */
function hasRemote(cfg: { sync: { remote_url?: string; server?: unknown } } | null): boolean {
  if (!cfg) return false;
  if (cfg.sync.remote_url) return true;
  if (cfg.sync.server) return true;
  return false;
}

interface Props {
  workspacePath: string;
  onClose: () => void;
  onSwitchWorkspace: (path: string) => void;
}

export default function AppShell({ workspacePath, onClose, onSwitchWorkspace }: Props) {
  useTheme(); // applies theme class to <html>
  useEditorFont(); // applies editor font-family CSS var to <html>
  const t = useT();

  // Prewarm every lazy modal chunk on idle so the user's first invocation
  // of Command Palette / Settings / Trash / etc. is just a render —
  // the chunk fetch, parse, and execute already happened in the
  // background. See `prewarmLazyChunks` for the priority split. We
  // intentionally fire only once per AppShell mount; switching
  // workspaces remounts AppShell (App.tsx keys by path) which triggers
  // this again, but webpack/Vite's module cache shortcuts the second
  // call so it's free.
  useEffect(() => {
    prewarmLazyChunks();
  }, []);
  const [showRawMarkdown, setShowRawMarkdown] = useShowRawMarkdown();

  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  const [mainNotePromptOpen, setMainNotePromptOpen] = useState(false);
  const configRef = useRef<WorkspaceConfig | null>(null);
  configRef.current = config;
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [paths, setPaths] = useState<PathInfo[]>([]);
  // Git-branch topology is no longer surfaced in the UI (Paths v2 replaced
  // it). Kept as a set-only shim for now so callers that still hand off the
  // BranchTopo[] don't have to be rewritten in one sweep.
  const [, setTopology] = useState<BranchTopo[]>([]);
  /** Paths v2: collections of notes. Loaded once per workspace, refreshed
   *  after any create/rename/delete/toggle. Source of truth for the graph,
   *  the minimap, the wikilink path chip, and the toolbar. */
  const [collectionsView, setCollectionsView] =
    useState<import("../lib/types").PathCollectionsView | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [graph, setGraph] = useState<Graph | null>(null);
  const [orphanSet, setOrphanSet] = useState<Set<string>>(new Set());
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  // Bumped whenever a sync rewrites the active note's file on disk,
  // forcing the note-load effect below to re-run and swap the editor's
  // `currentBody` for the server's version. Without this, a background
  // sync updates disk but the editor keeps displaying — and soon re-
  // saves — the pre-sync content, clobbering the server's edit.
  const [noteReloadNonce, setNoteReloadNonce] = useState(0);
  // Ref mirror of activeSlug + currentPath so the 30 s auto-sync loop
  // can check "did the pull touch the note I'm looking at right now?"
  // without restarting the interval every time the user clicks a
  // different note.
  const activeSlugRef = useRef<string | null>(null);
  useEffect(() => { activeSlugRef.current = activeSlug; }, [activeSlug]);
  // "Where you left off" — one-line bookmark captured on unmount, shown
  // on first open until the user resumes / dismisses / hides-always.
  // Picked up synchronously from localStorage so it lands with the first
  // paint. `null` for "nothing to show" (fresh install, stale bookmark,
  // or user has hidden it on this workspace).
  const [leftOff, setLeftOff] = useState<LeftOffState | null>(() =>
    isHiddenLeftOff(workspacePath) ? null : readLeftOff(workspacePath),
  );
  const [currentBody, setCurrentBody] = useState<string>("");
  const [focusMode, setFocusMode] = useState(false);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const workspaceChipRef = useRef<HTMLButtonElement>(null);
  const [selectionWords, setSelectionWords] = useState(0);
  const [selectionChars, setSelectionChars] = useState(0);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [obsidianImportOpen, setObsidianImportOpen] = useState(false);
  const [pathCompareOpen, setPathCompareOpen] = useState(false);
  const [decisionMatrixOpen, setDecisionMatrixOpen] = useState(false);
  // Opened from the editor's toolbar when the active note is a daily
  // journal — reuses the same JournalCalendar the left sidebar does, so
  // picking a day creates-or-opens that day's journal.
  // Tracks both open state and the trigger's bounding rect so the
  // calendar can render as a popover anchored below the toolbar pill
  // instead of as a centred modal. `anchor: null` → fall back to
  // centred-modal behaviour (used when the left-sidebar "calendar" link
  // opens it, where there's no single button to anchor to).
  const [journalCalendar, setJournalCalendar] = useState<{
    open: boolean;
    anchor: DOMRect | null;
  }>({ open: false, anchor: null });
  const [renamePrompt, setRenamePrompt] = useState<
    { slug: string; nextTitle: string; refs: number } | null
  >(null);
  // Bumped whenever the user dismisses the rename prompt (Cancel /
  // backdrop / Escape) so the editor can revert its local title input
  // back to the canonical frontmatter value. Without this, the field
  // stays on the edited text even though no rename happened.
  const [titleRevertNonce, setTitleRevertNonce] = useState(0);
  const cancelRename = useCallback(() => {
    setRenamePrompt(null);
    setTitleRevertNonce((n) => n + 1);
  }, []);
  const [findReplaceResult, setFindReplaceResult] = useState<
    { changed: number; total: number } | null
  >(null);
  // Pre-push quota block (stage 1 check triggered, sync aborted locally).
  // Data lives in `quotaBlock`; visibility in `quotaModalOpen` is
  // separate so a user can dismiss the modal and still see a small
  // "Over quota" pill in the status bar — without auto-sync popping
  // the modal back in their face every 30 seconds. Cleared on any
  // successful sync or after a successful discard.
  const [quotaBlock, setQuotaBlock] = useState<
    import("../lib/types").QuotaBlockInfo | null
  >(null);
  const [quotaModalOpen, setQuotaModalOpen] = useState<boolean>(false);
  const [spellMenu, setSpellMenu] = useState<{
    word: string; suggestions: string[]; from: number; to: number; x: number; y: number;
  } | null>(null);
  const [scratchpadWidth, setScratchpadWidth] = useState<number>(() => {
    // Persisted across sessions so the pane's on-screen footprint stays
    // consistent — resizing it is a per-user preference, not a per-open act.
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("yarrow.scratchpadWidth") : null;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 280 && n <= 640 ? n : 360;
  });
  const saveScratchpadWidth = useCallback((w: number) => {
    setScratchpadWidth(w);
    try { localStorage.setItem("yarrow.scratchpadWidth", String(w)); } catch {}
  }, []);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyPreview, setHistoryPreview] = useState<string | null>(null);
  // Pinned-checkpoint metadata for the currently open note. Loaded alongside
  // `history`, re-fetched after each pin / unpin so the star badge reflects
  // state. Empty when the feature hasn't been used yet.
  const [keepsakes, setKeepsakes] = useState<import("../lib/types").Keepsake[]>([]);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("pending");
  const [, setSyncMessage] = useState<string>("");
  // Unix ms of the most recent successful sync for this workspace.
  // Persisted per-workspace so the "synced 3 min ago" label survives
  // reloads. `null` means we have no record — usually a fresh open or
  // the remote has never been reached.
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => {
    if (!workspacePath) return null;
    try {
      const raw = localStorage.getItem(`yarrow.lastSyncedAt:${workspacePath}`);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  });
  // Keep the status pill honest when the user connects or disconnects
  // a remote mid-session from the Settings panel. Without this, the
  // pill stays on "not synced anywhere" after a fresh Connect flow
  // because setConfig is the only thing Settings hands back.
  const remotePresent = hasRemote(config);
  useEffect(() => {
    setSyncStatus((cur) => {
      if (remotePresent && cur === "no-remote") return "pending";
      if (!remotePresent && cur !== "no-remote") return "no-remote";
      return cur;
    });
  }, [remotePresent]);
  const [dirty, setDirty] = useState(false);
  const [jumpSignal, setJumpSignal] = useState<{ line: number; nonce: number } | undefined>();
  // Path-view ley pill → editor line jump. The path pane fires this
  // after it navigates to the target note; we translate it into the
  // same `jumpSignal` the existing jump-to-line plumbing consumes.
  useEffect(() => {
    const onJump = (ev: Event) => {
      const d = (ev as CustomEvent<{ line: number }>).detail;
      if (!d || typeof d.line !== "number") return;
      setJumpSignal({ line: d.line, nonce: Date.now() });
    };
    window.addEventListener("yarrow:jump-to-line", onJump as EventListener);
    return () => window.removeEventListener("yarrow:jump-to-line", onJump as EventListener);
  }, []);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [newPathOpen, setNewPathOpen] = useState(false);
  const [newPathName, setNewPathName] = useState("");
  const [newPathCondition, setNewPathCondition] = useState("");
  /** Which branch the new path should fork from. Default is the repo's
   *  root (main/master) so "Branch this" always creates a sibling of
   *  the trunk unless the user picks otherwise. */
  const [newPathFrom, setNewPathFrom] = useState<string>("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectTarget, setConnectTarget] = useState("");
  const [connectType, setConnectType] = useState<LinkType>("supports");
  const [settingsOpen, setSettingsOpen] = useState<
    { open: boolean; tab?: "appearance" | "writing" | "templates" | "sync" | "storage" | "security" | "workspace" | "shortcuts" | "about" }
  >({ open: false });
  const [confirmState, setConfirmState] = useState<{
    title: string;
    body: string;
    onConfirm: () => void;
  } | null>(null);
  const [forkMoment, setForkMoment] = useState<string | null>(null);
  const guidance = useGuidance();
  // Toggles the InlineDiffPane for the active note — only applies on a
  // non-root path. Auto-resets whenever the user changes path or note.
  const [inlineDiffOpen, setInlineDiffOpen] = useState(false);
  // Toasts (2.1 "Warm Toasts"): accept a tone so the renderer can paint a
  // small dot that matches the feeling of the message. Default tone is
  // "info" (neutral yellow), "success" is a soft green for milestones, and
  // "soft" is a muted plum for the gentle-sorry variant ("that didn't work,
  // nothing was lost"). Plain-string toasts still work — they render as
  // info with no action.
  const [toast, setToast] = useState<
    | string
    | {
        text: string;
        action?: { label: string; run: () => void };
        ttlMs?: number;
        tone?: "info" | "success" | "soft";
      }
    | null
  >(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  // Count of user-authored (non-bundled) templates. Drives whether the
  // new-note modal renders the "Your templates" route tile at all.
  const customTemplatesCount = templates.filter(
    (t) => t.is_bundled === false,
  ).length;
  const [encryption, setEncryption] = useState<EncryptionStatus>({
    enabled: false,
    unlocked: false,
    idle_timeout_secs: 900,
  });
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState<string | undefined>(undefined);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  // 2.1 Journal Kits picker — dedicated warm UI for the kit-flagged templates.
  const [kitsPickerOpen, setKitsPickerOpen] = useState(false);
  const [customTemplatesOpen, setCustomTemplatesOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState("");
  // Monotonically-increasing ticket for async work that writes to activeSlug.
  // Any handler that races with a newer user interaction checks this and
  // bails out rather than clobbering the user's more recent choice.
  const asyncEpoch = useRef(0);
  // User-driven slug change — bumps the epoch so in-flight async work (daily
  // open, etc.) knows to stop writing state. Internal `setActiveSlug` calls
  // from already-ticketed handlers continue to use the raw setter directly.
  const selectSlug = useCallback((slug: string | null) => {
    asyncEpoch.current++;
    setActiveSlug(slug);
    // Feed the wikilink-autocomplete recency tracker so [[ suggestions
    // bubble up notes the user has actually been reading. The Map is
    // module-scoped in the autocomplete extension; calling here keeps
    // the signal current without each navigation source remembering to.
    if (slug) {
      void import("./Editor/extensions/wikilinkAutocomplete").then(
        (m) => m.markOpenedSlug(slug),
      );
    }
  }, []);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteTemplate, setNewNoteTemplate] = useState<string | null>(null);
  const [conflictSession, setConflictSession] = useState<{
    relpaths: string[];
    currentPath: string;
    otherPath: string;
  } | null>(null);
  const [railOverlay, setRailOverlay] = useState<RailOverlay | null>(null);
  const [checkpointCount, setCheckpointCount] = useState<number>(0);
  const [lastSavedAt, setLastSavedAt] = useState<number>(0);
  const [editorCtxMenu, setEditorCtxMenu] = useState<
    { text: string; x: number; y: number } | null
  >(null);
  // Which context-menu style to show on right-click. Controlled from
  // Settings → Writing Extras; defaults on, flip off for the old
  // linear drop-down with the same items.
  const [radialMenuOn] = useExtraRadialMenu();
  const [wikilinkPickerOpen, setWikilinkPickerOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [tagGraphOpen, setTagGraphOpen] = useState(false);
  const [tableInsertOpen, setTableInsertOpen] = useState(false);
  const [calloutInsertOpen, setCalloutInsertOpen] = useState(false);
  const [scratchpadReloadNonce, setScratchpadReloadNonce] = useState(0);
  /** When non-null, renders the global ConditionEditor focused on this
   *  branch. Used by the path pill in the toolbar and the paths graph. */
  const [editConditionFor, setEditConditionFor] = useState<string | null>(null);
  /** When set, the "map" rail overlay filters the ConnectionGraph to the
   *  named path-collection's member slugs. Null = show the full vault. */
  const [mapFilter, setMapFilter] = useState<{ collectionName: string } | null>(null);

  /** Derived mode flag — read from config. Recomputed every render so any
   *  Settings flip (`mapped` ↔ `basic`) takes effect immediately. While
   *  `config` is null on first mount we default to `mapped`, which lets
   *  the very first refreshAll fetch the full payload. After config
   *  loads, every subsequent fetch through the wrappers below skips the
   *  IPC roundtrip in basic mode. */
  const mappingEnabledRef = useRef(true);
  mappingEnabledRef.current = (config?.mapping?.mode ?? "mapped") === "mapped";

  /* eslint-disable react-hooks/exhaustive-deps */
  // Mode-aware IPC wrappers — the rest of the component calls these
  // instead of `api.getGraph()` / `api.orphans()` / `api.branchTopology()`
  // / `api.listPaths()` / `api.listPathCollections()`. In basic-notes
  // mode they short-circuit to a stub Promise — no IPC, no backend
  // git/graph work, no wasted CPU. The `Ref`-driven gate avoids
  // recreating these callbacks every time the config changes (which
  // would invalidate downstream `useCallback`s that depend on them).
  const EMPTY_GRAPH: Graph = useMemo(() => ({ notes: [], links: [], last_built: "", tags: [] }), []);
  const fetchGraph = useCallback((): Promise<Graph> => {
    if (!mappingEnabledRef.current) return Promise.resolve(EMPTY_GRAPH);
    return api.getGraph();
  }, []);
  const fetchOrphans = useCallback((): Promise<string[]> => {
    if (!mappingEnabledRef.current) return Promise.resolve([]);
    return api.orphans();
  }, []);
  const fetchTopology = useCallback((): Promise<BranchTopo[]> => {
    if (!mappingEnabledRef.current) return Promise.resolve([]);
    return api.branchTopology();
  }, []);
  const fetchPaths = useCallback((): Promise<PathInfo[]> => {
    if (!mappingEnabledRef.current) return Promise.resolve([]);
    return api.listPaths();
  }, []);
  const fetchPathCollections = useCallback(() => {
    if (!mappingEnabledRef.current) {
      return Promise.resolve({ root: "main", collections: [] as never[] }) as ReturnType<typeof api.listPathCollections>;
    }
    return api.listPathCollections();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const refreshAll = useCallback(async () => {
    // Phase 1: read config first (cheap) so we know whether to pay for
    // the mapping-only fetches in phase 2. On first mount config is
    // null, so the wrappers above default to "mapped" and we get the
    // full payload — exactly what we want for the initial load of a
    // mapped workspace.
    const cfg = await api.readConfig();
    const isMapped = (cfg?.mapping?.mode ?? "mapped") === "mapped";

    // Phase 2a: always-needed core. Notes, templates, encryption — these
    // power the sidebar and editor regardless of mode.
    const corePromises = Promise.all([
      api.listNotes(),
      api.listTemplates().catch(() => []),
      api.encryptionStatus().catch(() => ({ enabled: false, unlocked: false, idle_timeout_secs: 900 })),
    ]);

    // Phase 2b: mapping-only — graph, paths, topology, orphans, merge
    // state. Skipped entirely in basic mode (no IPC, no backend work).
    const mappingPromises = isMapped
      ? Promise.all([
          api.listPaths(),
          api.currentPath(),
          api.getGraph(),
          api.branchTopology(),
          api.orphans(),
          api.mergeState(),
        ])
      : Promise.resolve(null);

    const [coreResults, mappingResults] = await Promise.all([corePromises, mappingPromises]);
    const [list, tpls, encStatus] = coreResults;

    setConfig(cfg);
    setTemplates(tpls);
    setEncryption(encStatus);
    setNotes(list);
    setSyncStatus(hasRemote(cfg) ? "pending" : "no-remote");
    setFocusMode(cfg.preferences.focus_mode_default);

    if (mappingResults) {
      const [pathList, cur, g, topo, orphansList, merging] = mappingResults;
      setPaths(pathList);
      setCurrentPath(cur);
      setGraph(g);
      setTopology(topo);
      setOrphanSet(new Set(orphansList));
      if (merging) {
        const relpaths = await api.listConflicts();
        if (relpaths.length > 0) {
          setConflictSession({
            relpaths,
            currentPath: cur,
            otherPath: "incoming",
          });
        }
      }
    } else {
      // Basic mode — set sensible empty defaults so any code that
      // happens to read these fields gets a no-op view rather than
      // stale state from a previous session.
      setPaths([]);
      setCurrentPath("main");
      setGraph(EMPTY_GRAPH);
      setTopology([]);
      setOrphanSet(new Set());
    }
    // EMPTY_GRAPH is a stable useMemo so it doesn't widen the dep set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // Load path-awareness: v2 paths are *collections*, not branches. One
  // fetch drives: the Paths graph, the left-sidebar minimap, the wikilink
  // path chip, and the toolbar. Refreshed after any membership change.
  const refreshPathAwareness = useCallback(async () => {
    try {
      const v = await fetchPathCollections();
      setCollectionsView(v);
    } catch (e) {
      console.warn("path awareness refresh failed", e);
    }
  }, [fetchPathCollections]);

  useEffect(() => { refreshPathAwareness(); }, [refreshPathAwareness]);

  // Keep `currentPath` aligned with v2 collections. If the current value isn't
  // a known collection (e.g. it was seeded from a git branch name, or the
  // collection was just deleted), fall back to the root so the toolbar
  // switcher and condition pill stay in sync and "back to main" is always
  // reachable.
  useEffect(() => {
    if (!collectionsView) return;
    const names = new Set(collectionsView.collections.map((c) => c.name));
    if (!currentPath || !names.has(currentPath)) {
      setCurrentPath(collectionsView.root);
    }
  }, [collectionsView, currentPath]);

  // Drop the inline-diff toggle whenever the active note or path changes.
  // Keeping it on would load a stale pairing (e.g. you diff'd Budget on
  // path A, then switched to note Hotels on path A — the pane would still
  // think it's Budget without this reset).
  useEffect(() => {
    setInlineDiffOpen(false);
  }, [activeSlug, currentPath]);

  // Detect the "returned to main" transition so Guided mode can offer the
  // compare modal. Fires every time the user switches from a non-main
  // path back to main — re-teaches the compare flow each time, per the
  // guided-mode philosophy.
  const prevPathRef = useRef<string>("");
  useEffect(() => {
    const prev = prevPathRef.current;
    const cur = currentPath;
    prevPathRef.current = cur;
    if (!prev || !cur || prev === cur) return;
    const root = collectionsView?.root ?? "main";
    const isMain = (p: string) => p === root || p === "main" || p === "master";
    if (!isMain(prev) && isMain(cur)) {
      guidance.trigger("path.returnedToMain", {
        onPrimary: () => setPathCompareOpen(true),
      });
    }
  }, [currentPath, collectionsView, guidance]);

  /** Flatten collections to the `pathNotes` shape the wikilink popover
   *  expected from the v1 model — keeps that component unchanged. */
  const pathNotes = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!collectionsView) return out;
    for (const c of collectionsView.collections) out[c.name] = [...c.members];
    return out;
  }, [collectionsView]);

  /** Collections → `{ path_name: user_hex_color }`. Feeds the path-tinted
   *  caret (and any other chrome that needs user-assigned accents) without
   *  leaking the collection objects into components that just need a
   *  colour. */
  const pathColorOverrides = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of collectionsView?.collections ?? []) {
      if (c.color) out[c.name] = c.color;
    }
    return out;
  }, [collectionsView]);

  /** Compatibility shim: the old PathMeta-per-branch map shape, but
   *  populated from collections so legacy consumers (toolbar legacy path
   *  pill, minimap, etc.) keep working while we migrate. */
  const pathMetaMap = useMemo(() => {
    const out: Record<string, import("../lib/types").PathMeta> = {};
    if (!collectionsView) return out;
    for (const c of collectionsView.collections) {
      out[c.name] = { condition: c.condition, set_at: c.created_at || null };
    }
    return out;
  }, [collectionsView]);

  // Seed the "branch from" picker when the dialog opens: default to the
  // path-collection root so parallel branches are the easy case.
  useEffect(() => {
    if (!newPathOpen) return;
    if (newPathFrom) return;
    const rootName = collectionsView?.root || "main";
    setNewPathFrom(rootName);
  }, [newPathOpen, newPathFrom, collectionsView]);

  // Warm heavy modal chunks during idle time so they're instant on first
  // open. Gated on the workspace mode — basic-notes workspaces never
  // reach the map / decision-matrix / paths surfaces, so warming those
  // chunks would burn parse time for nothing. We wait one tick so
  // `config` has a chance to load (it usually has by the time idle
  // fires anyway, but the explicit gate makes the basic-mode guarantee
  // hard rather than racy).
  useEffect(() => {
    if (config === null) return;
    const isMapped = (config.mapping?.mode ?? "mapped") === "mapped";
    prefetchHeavyChunks(isMapped);
  }, [config]);

  // Keep the editor font-size CSS variable in sync with the user's preference.
  useEffect(() => {
    const px = config?.preferences.editor_font_size ?? 16;
    document.documentElement.style.setProperty("--editor-font-size", `${px}px`);
  }, [config?.preferences.editor_font_size]);

  useEffect(() => {
    if (activeSlug == null && notes.length > 0) {
      // Restore the last-active slug for this workspace if we have one and it
      // still exists. Falls through to the first note otherwise.
      const key = `yarrow.lastActive:${workspacePath}`;
      let pick: string | null = null;
      try { pick = localStorage.getItem(key); } catch {}
      const exists = pick && notes.some((n) => n.slug === pick);
      setActiveSlug(exists ? pick : notes[0].slug);
    }
  }, [notes, activeSlug, workspacePath]);

  // Persist the active slug per workspace so reopening drops the user back
  // exactly where they were. Per-machine, so it lives in localStorage.
  useEffect(() => {
    if (!activeSlug) return;
    try { localStorage.setItem(`yarrow.lastActive:${workspacePath}`, activeSlug); } catch {}
  }, [activeSlug, workspacePath]);

  // Lightweight prefetch of history length so the path ribbon can show a
  // live checkpoint count without waiting for the history overlay to open.
  useEffect(() => {
    if (!activeSlug) { setCheckpointCount(0); return; }
    let alive = true;
    api.noteHistory(activeSlug)
      .then((h) => { if (alive) setCheckpointCount(h.length); })
      .catch(() => { if (alive) setCheckpointCount(0); });
    return () => { alive = false; };
  }, [activeSlug, currentPath, restoreNonce]);

  // Main's body for the active note, only when we're on a non-root path.
  // Feeds the Ley Lines diff rendering in the editor, reader, and path
  // view — null when we're on main (nothing to diff against) *or* when
  // the workspace is in Basic-notes mode (user doesn't want to see
  // path/branching machinery at all).
  const [mainBody, setMainBody] = useState<string | null>(null);
  useEffect(() => {
    if (!activeSlug) { setMainBody(null); return; }
    const modeMapped = (config?.mapping?.mode ?? "mapped") === "mapped";
    if (!modeMapped) { setMainBody(null); return; }
    const rootName = collectionsView?.root ?? "main";
    const onMain =
      !currentPath ||
      currentPath === rootName ||
      currentPath === "main" ||
      currentPath === "master";
    if (onMain) { setMainBody(null); return; }
    let alive = true;
    getCachedOrReadNote(activeSlug)
      .then((n) => { if (alive) setMainBody(n.body); })
      .catch(() => { if (alive) setMainBody(null); });
    return () => { alive = false; };
  }, [activeSlug, currentPath, collectionsView, config]);

  useEffect(() => {
    if (!activeSlug) { setActiveNote(null); return; }
    // Guard against fast slug-switches landing a stale note into state: if the
    // user clicked away before this read resolved, drop the result on the floor.
    let alive = true;
    const rootName = collectionsView?.root ?? "main";
    const onMain =
      !currentPath ||
      currentPath === rootName ||
      currentPath === "main" ||
      currentPath === "master";
    // On a non-root path, bypass the main-only cache and ask the backend
    // for the path-scoped view (override if present, else falls back to
    // main). This is what makes a note show its path-local edits while
    // you're "on" that path.
    const promise = onMain
      ? getCachedOrReadNote(activeSlug)
      : api.readNoteOnPath(activeSlug, currentPath);
    promise.then((n) => {
      if (!alive) return;
      setActiveNote(n);
      setCurrentBody(n.body);
      // Don't auto-open the unlock modal when a locked note loads — the
      // `LockedNoteHero` already has a prominent "Unlock to continue"
      // button. Auto-popping a modal on every app start (and every click
      // onto an encrypted note) is intrusive: the user should decide when
      // to unlock.
    }).catch(() => {
      if (!alive) return;
      setActiveNote(null);
    });
    return () => { alive = false; };
  }, [activeSlug, currentPath, collectionsView, encryption.unlocked, noteReloadNonce]);

  // Load the workspace's custom dictionary into the spell-checker once per
  // workspace open. Best-effort — a missing dictionary just means the
  // language pack alone is in effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ loadSpell, addUserWords }, words] = await Promise.all([
          import("../lib/spell"),
          api.readDictionary(),
        ]);
        await loadSpell();
        if (!cancelled) addUserWords(words);
      } catch (e) {
        console.warn("dictionary load failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [workspacePath]);

  // Right-click on a misspelled word → spell suggestion popover.
  useEffect(() => {
    const onSpell = (ev: Event) => {
      const d = (ev as CustomEvent<{
        word: string; suggestions: string[]; from: number; to: number; x: number; y: number;
      }>).detail;
      if (!d) return;
      setSpellMenu(d);
    };
    window.addEventListener("yarrow:editor-spellcheck", onSpell as EventListener);
    return () => window.removeEventListener("yarrow:editor-spellcheck", onSpell as EventListener);
  }, []);

  const handleAddToDictionary = useCallback(async (word: string) => {
    try {
      const { addUserWord, snapshotUserWords } = await import("../lib/spell");
      addUserWord(word);
      // Persist by writing back the merged set. Read existing first so words
      // added in another window aren't clobbered.
      const existing = await api.readDictionary().catch(() => [] as string[]);
      const merged = Array.from(new Set([...existing, ...snapshotUserWords(), word]));
      await api.writeDictionary(merged);
    } catch (e) {
      console.error("add to dictionary failed", e);
    }
  }, []);

  const printActiveNote = useCallback(async (slug: string) => {
    // Render the note to standalone HTML on the backend (uses pulldown-cmark
    // with the same options as the static-site export), then drop it into a
    // hidden iframe and trigger the iframe's print dialog. The user's OS
    // print panel exposes "Save as PDF" so we don't need a PDF library here.
    try {
      const html = await api.renderNoteHtml(slug);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      let cleanedUp = false;
      const cleanup = (delay: number) => {
        if (cleanedUp) return;
        cleanedUp = true;
        // Tear down after a short delay so the print job has a chance to
        // flush before the document is removed.
        setTimeout(() => { try { iframe.remove(); } catch {} }, delay);
      };
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("print failed", e);
        }
        cleanup(1000);
      };
      // Safety-net: if onload never fires (broken HTML, iframe denied
      // navigation, etc.) the iframe would otherwise leak in the DOM.
      // The print dialog is modal anyway, so 30 s of slack is plenty.
      setTimeout(() => cleanup(0), 30000);
      iframe.srcdoc = html;
    } catch (e) {
      setToast(t("appshell.toast.printError", { error: String(e) }));
    }
  }, [t]);

  const handleCreateNote = useCallback(() => {
    setNewNoteTitle("");
    setNewNoteTemplate(null);
    setNewNoteOpen(true);
  }, []);

  const handleOpenDaily = useCallback(
    async (dateIso?: string) => {
      const iso = dateIso ?? todayIso();
      // Claim a ticket. If the user clicks away during our awaits, a newer
      // click (or `setActiveSlug` elsewhere) bumps the epoch and we quietly
      // stop writing state for this call.
      const myEpoch = ++asyncEpoch.current;
      try {
        const { note, switched_from } = await api.openDaily(iso);
        if (myEpoch !== asyncEpoch.current) return;

        if (switched_from) {
          const [cur, pathList, topo, g, list] = await Promise.all([
            api.currentPath(),
            fetchPaths(),
            fetchTopology(),
            fetchGraph(),
            api.listNotes(),
          ]);
          if (myEpoch !== asyncEpoch.current) return;
          setCurrentPath(cur);
          setPaths(pathList);
          setTopology(topo);
          setGraph(g);
          setNotes(list);
          setToast({ text: t("appshell.toast.journalSwitched", { from: switched_from }), tone: "soft" });
        }
        setActiveSlug(note.slug);
        setActiveNote(note);
        setCurrentBody(note.body);
      } catch (e) {
        if (myEpoch === asyncEpoch.current) console.error("open daily failed", e);
      }
    },
    [t],
  );

  const refreshEncryption = useCallback(async () => {
    try {
      const s = await api.encryptionStatus();
      setEncryption(s);
      return s;
    } catch {
      return encryption;
    }
  }, [encryption]);

  // Single source of truth for "state changed somewhere — everybody resync."
  // Toolbar menu, Security pane, and the unlock modal all call this so the
  // toolbar lock icon and pane buttons always agree without waiting for a
  // click or a re-mount.
  const broadcastEncryptionChanged = useCallback(async () => {
    await refreshEncryption();
    window.dispatchEvent(new Event("yarrow:encryption-changed"));
  }, [refreshEncryption]);

  const requestUnlock = useCallback((reason?: string) => {
    setUnlockReason(reason);
    setUnlockOpen(true);
  }, []);

  const handleLockEncryption = useCallback(async () => {
    try { await api.lockEncryption(); } catch {}
    await broadcastEncryptionChanged();
    // If the active note is encrypted, re-read so its body blanks and the
    // unlock prompt reappears next time.
    if (activeSlug && activeNote?.encrypted) {
      try {
        const n = await api.readNote(activeSlug);
        setActiveNote(n);
        setCurrentBody(n.body);
      } catch {}
    }
    setToast({ text: t("appshell.toast.encryptedSession"), tone: "soft" });
  }, [activeSlug, activeNote?.encrypted, broadcastEncryptionChanged, t]);

  const onUnlocked = useCallback(async () => {
    setUnlockOpen(false);
    // A locked note was cached as `locked: true, body: ""`; once the
    // session unlocks we need to force a fresh read so the editor gets
    // the decrypted body instead of the stale locked stub.
    invalidateAllNotes();
    await broadcastEncryptionChanged();
    if (activeSlug) {
      try {
        const n = await api.readNote(activeSlug);
        setActiveNote(n);
        setCurrentBody(n.body);
      } catch {}
    }
  }, [activeSlug, broadcastEncryptionChanged]);

  const handleEncryptNoteBySlug = useCallback(async (slug: string) => {
    if (!encryption.enabled) {
      setToast({ text: t("appshell.toast.enableEncryptionFirst"), tone: "soft" });
      setSettingsOpen({ open: true, tab: "security" });
      return;
    }
    if (!encryption.unlocked) {
      requestUnlock(t("appshell.toast.unlockToEncrypt"));
      return;
    }
    try {
      const n = await api.encryptNote(slug);
      if (activeSlug === slug) {
        setActiveNote(n);
        setCurrentBody(n.body);
      }
      invalidateAllNotes();
      setNotes(await api.listNotes());
      setToast(
        t("appshell.toast.encrypted", { title: n.frontmatter.title || slug })
      );
    } catch (e) {
      setToast(t("appshell.toast.encryptError", { error: String(e) }));
    }
  }, [activeSlug, encryption.enabled, encryption.unlocked, requestUnlock, t]);

  const handleDecryptNoteBySlug = useCallback(async (slug: string) => {
    if (!encryption.unlocked) {
      requestUnlock(t("appshell.toast.unlockToDecrypt"));
      return;
    }
    try {
      const n = await api.decryptNote(slug);
      if (activeSlug === slug) {
        setActiveNote(n);
        setCurrentBody(n.body);
      }
      setNotes(await api.listNotes());
      setToast({ text: t("appshell.toast.decrypted", { title: n.frontmatter.title || slug }), tone: "success" });
    } catch (e) {
      setToast(t("appshell.toast.decryptError", { error: String(e) }));
    }
  }, [activeSlug, encryption.unlocked, requestUnlock, t]);

  const handleEncryptActiveNote = useCallback(() => {
    if (!activeSlug) return;
    handleEncryptNoteBySlug(activeSlug);
  }, [activeSlug, handleEncryptNoteBySlug]);

  const handleDecryptActiveNote = useCallback(() => {
    if (!activeSlug) return;
    handleDecryptNoteBySlug(activeSlug);
  }, [activeSlug, handleDecryptNoteBySlug]);

  useEffect(() => {
    const onRequestUnlock = () => requestUnlock();
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      if (typeof msg === "string") setToast(msg);
    };
    const onEncChanged = () => {
      // Encryption state flipped (lock/unlock/rewrap). Any cached locked
      // bodies are now stale; drop the prefetch cache so the next read
      // uses the current session key.
      invalidateAllNotes();
      refreshEncryption();
    };
    window.addEventListener("yarrow:request-unlock", onRequestUnlock as EventListener);
    window.addEventListener("yarrow:toast", onToast as EventListener);
    window.addEventListener("yarrow:encryption-changed", onEncChanged as EventListener);
    return () => {
      window.removeEventListener("yarrow:request-unlock", onRequestUnlock as EventListener);
      window.removeEventListener("yarrow:toast", onToast as EventListener);
      window.removeEventListener("yarrow:encryption-changed", onEncChanged as EventListener);
    };
  }, [requestUnlock, refreshEncryption]);

  // Periodic idle-ping: let the backend trim the session when the app is
  // open but untouched. Runs once a minute — cheap, single command.
  useEffect(() => {
    if (!encryption.enabled) return;
    const id = window.setInterval(async () => {
      try {
        const alive = await api.activityPing();
        if (!alive && encryption.unlocked) {
          await refreshEncryption();
          setToast({ text: t("appshell.toast.lockedAfterIdle"), tone: "soft" });
        }
      } catch {}
    }, 60_000);
    return () => window.clearInterval(id);
  }, [encryption.enabled, encryption.unlocked, refreshEncryption, t]);

  // Periodic auto-sync. Mirrors the web build's push-debt loop: fire
  // `cmd_sync` every 30s when the workspace has a server configured,
  // and back off exponentially on errors so a flaky network / down
  // server doesn't hammer the backend. Also listens for the
  // `workspace.updated` Tauri event our WebSocket client re-emits
  // — a remote push triggers an immediate sync (pull + push).
  //
  // The sync itself is the full fetch+push+merge cycle on desktop, so
  // this loop carries both directions: our local commits go up, and
  // anything the server gained since our last sync comes down.
  useEffect(() => {
    if (!config?.sync?.server) return;
    let cancelled = false;
    let lastError = 0;
    let backoffMs = 30_000;
    const maxBackoff = 5 * 60_000;

    const run = async () => {
      if (cancelled) return;
      try {
        const outcome = await api.sync();
        backoffMs = 30_000;
        lastError = 0;
        if (outcome?.quota_blocked) {
          // Auto-sync hit the pre-push check. Update the DATA so the
          // status-bar "Over quota" pill stays accurate, but DON'T
          // forcibly re-open the modal — the user may have dismissed
          // it on purpose and we shouldn't nag them every 30 s.
          // The modal is only force-opened if they hadn't seen this
          // issue yet (quotaBlock was previously null).
          setQuotaBlock((prev) => {
            if (prev === null) setQuotaModalOpen(true);
            return outcome.quota_blocked ?? null;
          });
        }
        if (outcome?.ok) {
          // Clean sync — the quota issue cleared itself (they cleaned
          // up on another device, or whatever). Dismiss the indicator.
          setQuotaBlock(null);
          setQuotaModalOpen(false);
          const now = Date.now();
          setLastSyncedAt(now);
          try {
            if (workspacePath) {
              localStorage.setItem(
                `yarrow.lastSyncedAt:${workspacePath}`,
                String(now),
              );
            }
          } catch {}
        }
        // Surface conflicts from auto-sync too — silent would mean the
        // user first hears about divergence by spotting the weird
        // `.conflict-*` filename in the sidebar, which is a worse story
        // than a one-line toast.
        const cc = outcome?.conflicts ?? [];
        if (cc.length > 0) {
          const n = cc.length;
          setToast({
            text: t(
              n === 1
                ? "appshell.toast.autoSyncConflictsSingle"
                : "appshell.toast.autoSyncConflictsPlural",
              { count: String(n) },
            ),
            tone: "soft",
            ttlMs: 8000,
          });
        }
        // If the pull rewrote files on disk, drop the cached body for
        // each one so the next read hits the backend instead of the
        // now-stale prefetch LRU. Then, if the active note's file is
        // in that list, bump the nonce to re-run the note-load effect
        // and swap fresh content into the editor. Doing the cache
        // invalidation BEFORE the nonce bump is load-bearing — if we
        // only bumped the nonce, the effect would re-read the same
        // stale cached entry and the editor would keep the pre-sync
        // body, leaving the server's edit invisible and primed to be
        // overwritten the moment any save triggers.
        const changed = outcome?.files_changed;
        if (changed && changed.length) {
          for (const p of changed) {
            if (p.startsWith("notes/") && p.endsWith(".md")) {
              invalidateNote(p.slice("notes/".length, -".md".length));
            }
          }
          const slug = activeSlugRef.current;
          if (slug && changed.includes(`notes/${slug}.md`)) {
            setNoteReloadNonce((n) => n + 1);
          }
        }
      } catch (err) {
        lastError = Date.now();
        backoffMs = Math.min(backoffMs * 2, maxBackoff);
        console.warn("auto-sync failed — backing off", backoffMs / 1000, "s", err);
      }
    };

    // First tick after a short warm-up so we don't race workspace load.
    const warmup = window.setTimeout(() => void run(), 8_000);
    const id = window.setInterval(() => void run(), 30_000);

    // React to server pushes delivered via the Tauri WebSocket bridge.
    // Subscribe through @tauri-apps/api/event (via our shared transport's
    // subscribe pattern) so we don't care whether the bridge was added
    // before or after this effect mounts.
    let unlisten: (() => void) | null = null;
    let unlistenPurged: (() => void) | null = null;
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        const fn = await listen("workspace.updated", () => {
          if (cancelled) return;
          // Respect the back-off so a storm of WS events can't override
          // the error cool-down.
          if (Date.now() - lastError < backoffMs) return;
          void run();
        });
        if (cancelled) fn();
        else unlisten = fn;

        // Stage-3: a server-side reclaim-space just rewrote this
        // workspace's git history. Our local branch is on a lineage
        // the server no longer knows about. A plain `api.sync()` would
        // fetch the new history AND try to push our old commits — which
        // would just re-upload the blobs the server just purged and
        // put us right back where we started. `cmd_force_align_with_server`
        // is a one-way operation: fetch server state, hard-reset
        // local onto it, discard our diverged commits. Also clears
        // the quota pill since reaching this handler means the server
        // definitely freed space.
        const purgedFn = await listen("workspace.purged", () => {
          if (cancelled) return;
          setToast({
            text: t("appshell.toast.workspacePurged"),
            tone: "soft",
            ttlMs: 6000,
          });
          void (async () => {
            try {
              await api.forceAlignWithServer(true);
              setQuotaBlock(null);
              setQuotaModalOpen(false);
              setNoteReloadNonce((n) => n + 1);
              invalidateAllNotes();
            } catch (err) {
              console.warn("post-purge force-align failed:", err);
              setToast({
                text: t("appshell.toast.workspacePurgedFailed"),
                tone: "soft",
                ttlMs: 8000,
              });
            }
          })();
        });
        if (cancelled) purgedFn();
        else unlistenPurged = purgedFn;
      })
      .catch(() => {
        /* web build or pre-2.x tauri — no listener, that's fine */
      });

    return () => {
      cancelled = true;
      window.clearTimeout(warmup);
      window.clearInterval(id);
      if (unlisten) unlisten();
      if (unlistenPurged) unlistenPurged();
    };
  }, [config?.sync?.server, t]);

  const handleCreateFromTemplate = useCallback((templateName: string) => {
    setPendingTemplate(templateName);
    setTemplateTitle("");
  }, []);

  const confirmCreateFromTemplate = useCallback(async () => {
    const title = templateTitle.trim();
    if (!title || !pendingTemplate) return;
    try {
      const n = await api.createFromTemplate(pendingTemplate, title);
      setPendingTemplate(null);
      setTemplateTitle("");
      const list = await api.listNotes();
      setNotes(list);
      setActiveSlug(n.slug);
      setGraph(await fetchGraph());
      setOrphanSet(new Set(await fetchOrphans()));
    } catch (e) {
      console.error("create from template failed", e);
      setToast(t("appshell.toast.createFromTemplateError", { error: String(e) }));
    }
  }, [pendingTemplate, templateTitle, t]);

  const confirmCreateNote = useCallback(async () => {
    const title = newNoteTitle.trim();
    if (!title) return;
    const tpl = newNoteTemplate;
    setNewNoteOpen(false);
    setNewNoteTitle("");
    setNewNoteTemplate(null);
    const n = tpl
      ? await api.createFromTemplate(tpl, title)
      : await api.createNote(title);
    const list = await api.listNotes();
    setNotes(list);
    setActiveSlug(n.slug);
    setGraph(await fetchGraph());
    setOrphanSet(new Set(await fetchOrphans()));
  }, [newNoteTitle, newNoteTemplate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "\\") { e.preventDefault(); setFocusMode((f) => !f); return; }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); return; }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setSwitcherOpen(true);
        return;
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleCreateNote();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const cfg = configRef.current;
        const mapped = (cfg?.mapping?.mode ?? "mapped") === "mapped";
        if (!mapped) return;
        if (!cfg?.mapping?.main_note) { setMainNotePromptOpen(true); return; }
        setNewPathOpen(true);
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "b") {
        // "Branch from here" — same single-field dialog.
        e.preventDefault();
        const cfg = configRef.current;
        const mapped = (cfg?.mapping?.mode ?? "mapped") === "mapped";
        if (!mapped) return;
        if (!cfg?.mapping?.main_note) { setMainNotePromptOpen(true); return; }
        setNewPathOpen(true);
        return;
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        handleOpenDaily();
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        setSettingsOpen({ open: true });
        return;
      }
      if (mod && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        setQuickCaptureOpen(true);
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setScratchpadOpen((o) => !o);
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setWorkspaceSwitcherOpen((o) => !o);
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindReplaceOpen(true);
        return;
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "p") {
        // Print / save active note as PDF. Override the browser's chrome-print
        // since we want our own print-styled rendering, not the editor UI.
        if (activeSlug) {
          e.preventDefault();
          printActiveNote(activeSlug);
          return;
        }
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "l") {
        // Only intercept if the user has encryption enabled — leave Ctrl+L
        // free for ordinary list-keystrokes otherwise.
        if (encryption.enabled) {
          e.preventDefault();
          handleLockEncryption();
          return;
        }
      }
      if (mod && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        if (activeSlug && activeSlug.startsWith("daily/")) {
          e.preventDefault();
          const iso = activeSlug.slice("daily/".length);
          const d = new Date(iso);
          d.setDate(d.getDate() + (e.key === "ArrowRight" ? 1 : -1));
          const next = d.toISOString().slice(0, 10);
          handleOpenDaily(next);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCreateNote, handleOpenDaily, activeSlug, encryption.enabled, handleLockEncryption]);

  useEffect(() => {
    if (!toast) return;
    // Actionable toasts get a longer window so the user can actually click
    // "Undo" before it fades; the default 4.2 s is plenty for plain notices.
    const ttl =
      typeof toast === "object" && toast.ttlMs
        ? toast.ttlMs
        : typeof toast === "object"
          ? 6500
          : 4200;
    const timer = setTimeout(() => setToast(null), ttl);
    return () => clearTimeout(timer);
  }, [toast]);

  // "Where you left off" persistence. Debounced: every time the active
  // note, path, or body changes, we update the bookmark after a short
  // idle. On workspace close (unmount), we flush whatever we have so
  // the next open can greet the user with it. Hidden-always respects
  // the user's pref — if they clicked "hide next time" we stop writing.
  //
  // The cursor line travels with the bookmark so the next reopen can
  // scroll-restore. NoteEditor emits `yarrow:cursor-changed` on every
  // selection move; we hold the latest value in a ref so the debounced
  // save reads the most recent line at flush time, not stale state.
  //
  // Privacy gate (2.1): notes that are encrypted or marked private
  // (clinical kits, `private: true` in frontmatter, or tag `clinical`)
  // are NEVER bookmarked — neither title, path, snippet, nor cursor
  // line ever touches localStorage. This is the same security stance
  // the rest of the app takes: PHI and sealed notes never leak into
  // surfaces that survive across sessions.
  const leftOffWriteTimer = useRef<number | null>(null);
  const cursorLineRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const onCursor = (e: Event) => {
      const d = (e as CustomEvent<{ line: number }>).detail;
      if (d && typeof d.line === "number") cursorLineRef.current = d.line;
    };
    window.addEventListener("yarrow:cursor-changed", onCursor as EventListener);
    return () => window.removeEventListener("yarrow:cursor-changed", onCursor as EventListener);
  }, []);
  // Reset the cursor cache whenever the active note flips so a stale
  // line from a previous note can't leak into the next one's bookmark
  // before NoteEditor reports the fresh position.
  useEffect(() => { cursorLineRef.current = undefined; }, [activeSlug]);

  // Single source of truth for "is this note off-limits to bookmarking?"
  // Read directly off the live `activeNote` so a frontmatter toggle (tag
  // added, `private: true` set, encryption enabled) takes effect on the
  // very next save without waiting for a list refresh.
  const isOffLimitsForBookmark = (n: Note | null): boolean => {
    if (!n) return false;
    if (n.encrypted || n.locked) return true;
    if (n.frontmatter.private) return true;
    const tags = n.frontmatter.tags ?? [];
    return tags.some((t) => t.toLowerCase() === "clinical");
  };

  useEffect(() => {
    if (!activeNote || !activeSlug) return;
    if (isHiddenLeftOff(workspacePath)) return;
    // Privacy gate — leftOff simply never runs on private or encrypted
    // notes. No save, no debounce timer, no side-effects. Cleanup of
    // any stale entry from before a tag/encryption toggle lives in the
    // sweep-on-open effect below; this branch just opts out cleanly.
    if (isOffLimitsForBookmark(activeNote)) return;
    if (leftOffWriteTimer.current) window.clearTimeout(leftOffWriteTimer.current);
    const slug = activeSlug;
    const title = activeNote.frontmatter.title || activeNote.slug;
    const path = currentPath;
    const body = currentBody || activeNote.body;
    leftOffWriteTimer.current = window.setTimeout(() => {
      const cursorLine = cursorLineRef.current;
      saveLeftOff(workspacePath, {
        slug,
        title,
        path,
        snippet: snippetFromBody(body, cursorLine),
        cursorLine,
        at: Date.now(),
      });
    }, 900);
    return () => {
      if (leftOffWriteTimer.current) window.clearTimeout(leftOffWriteTimer.current);
    };
  }, [activeSlug, activeNote, currentPath, currentBody, workspacePath]);
  // Flush on unmount — the active-change effect debounces, which would
  // lose the final state when the user closes the workspace mid-wait.
  // Same privacy gate as above: never run for protected notes.
  useEffect(() => {
    return () => {
      if (!activeNote || !activeSlug) return;
      if (isHiddenLeftOff(workspacePath)) return;
      if (isOffLimitsForBookmark(activeNote)) return;
      const cursorLine = cursorLineRef.current;
      saveLeftOff(workspacePath, {
        slug: activeSlug,
        title: activeNote.frontmatter.title || activeNote.slug,
        path: currentPath,
        snippet: snippetFromBody(currentBody || activeNote.body, cursorLine),
        cursorLine,
        at: Date.now(),
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stale-state sweep: once the notes list resolves, if the persisted
  // bookmark points at a note that's now private or encrypted, wipe
  // it. Catches the upgrade case (a 2.0 workspace's localStorage may
  // hold a snippet from a note that has since been sealed) and the
  // toggle case (a note tagged `clinical` after the last bookmark).
  useEffect(() => {
    if (!leftOff || notes.length === 0) return;
    const target = notes.find((n) => n.slug === leftOff.slug);
    if (target && (target.encrypted || target.private)) {
      forgetLeftOff(workspacePath);
      setLeftOff(null);
    }
  }, [leftOff, notes, workspacePath]);

  // Display gate. The banner shows only once we can confirm the
  // target note exists in the loaded list AND isn't private or
  // encrypted. Holding back until `notes` resolves closes the brief
  // race window between the synchronous localStorage read and the
  // async list load — a stale snippet can never paint, even for one
  // frame, before the sweep above has had a chance to wipe it.
  const showLeftOffBanner = useMemo(() => {
    if (!leftOff) return false;
    if (notes.length === 0) return false;
    const target = notes.find((n) => n.slug === leftOff.slug);
    if (target && (target.encrypted || target.private)) return false;
    return true;
  }, [leftOff, notes]);

  // Listen for editor selection changes so the status bar can show
  // "238 selected" while the user has a range highlighted. Emitted by
  // NoteEditor's update listener.
  useEffect(() => {
    const onSel = (e: Event) => {
      const d = (e as CustomEvent<{ words: number; chars: number }>).detail;
      setSelectionWords(d?.words ?? 0);
      setSelectionChars(d?.chars ?? 0);
    };
    window.addEventListener("yarrow:selection-changed", onSel as EventListener);
    return () => window.removeEventListener("yarrow:selection-changed", onSel as EventListener);
  }, []);

  // Right-click in the editor: NoteEditor fires this event with the
  // selected text (if any) + pointer position. We host the menu at shell
  // level so it can reach the scratchpad API, the wikilink picker, and
  // sidebar state. An empty `text` means the click was on an empty
  // selection — the menu still opens with just the "Insert wikilink…"
  // option.
  useEffect(() => {
    const onMenu = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; x: number; y: number }>).detail;
      if (d) setEditorCtxMenu(d);
    };
    window.addEventListener("yarrow:editor-contextmenu", onMenu as EventListener);
    return () => window.removeEventListener("yarrow:editor-contextmenu", onMenu as EventListener);
  }, []);
  // Dismiss the radial menu on window resize / editor scroll — its
  // coordinates were captured at right-click time and would otherwise
  // detach from the cursor as the layout shifts.
  useEffect(() => {
    if (!editorCtxMenu) return;
    const close = () => setEditorCtxMenu(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [editorCtxMenu]);

  // Centre-button gestures on the radial fire a `yarrow:center-action`
  // event with a stable id. The five gestures:
  //   · tap           → "palette"       → open command palette
  //   · long-press    → "constellation" → open the map rail overlay
  //   · double-click  → "focus"         → toggle focus/zen mode
  //   · drag-out      → commits a wedge directly (handled in RadialMenu)
  //   · scroll wheel  → rotates hover   (handled in RadialMenu)
  useEffect(() => {
    const onAction = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      switch (id) {
        case "palette":
          setPaletteOpen(true);
          break;
        case "constellation":
          setRailOverlay("map");
          break;
        case "focus":
          setFocusMode((f) => !f);
          break;
      }
    };
    window.addEventListener("yarrow:center-action", onAction as EventListener);
    return () =>
      window.removeEventListener("yarrow:center-action", onAction as EventListener);
  }, []);

  // Note switch resets selection — the new editor instance starts with
  // an empty selection but doesn't dispatch a change event for it.
  useEffect(() => {
    setSelectionWords(0);
    setSelectionChars(0);
  }, [activeSlug]);

  // Topology only changes on explicit path operations (create/delete/promote
  // etc.) — never on a plain content save. We refresh it on its own debounce
  // when the user is on a non-trivial path graph, so saves no longer pay
  // for the git topology walk on every keystroke pause.
  const topologyRefreshTimer = useRef<number | null>(null);
  const queueTopologyRefresh = useCallback(() => {
    if (topologyRefreshTimer.current) window.clearTimeout(topologyRefreshTimer.current);
    topologyRefreshTimer.current = window.setTimeout(async () => {
      try { setTopology(await fetchTopology()); } catch {}
    }, 1500);
  }, []);

  const handleSave = useCallback(
    async (slug: string, body: string, thinking?: string, path?: string) => {
      // Use the slug the editor was mounted on, not `activeSlug`. They can
      // diverge when a note switch fires while the debounce is pending —
      // saving against `activeSlug` in that window would write the old
      // note's body into the new note's file (the cross-note swap bug).
      if (!slug) return;
      // Use the path the editor was mounted on when provided, not
      // `currentPath`. Without this, a flush fired by a path switch (via
      // the editor's unmount cleanup) sees the *new* currentPath in
      // closure and writes the departing path's edits onto the incoming
      // path — corrupting main with what-if content or vice versa, and
      // creating a spurious checkpoint every time.
      const rootName = collectionsView?.root ?? "main";
      const pathIsMain = (p: string) =>
        !p || p === rootName || p === "main" || p === "master";
      const effectivePath = path ?? currentPath;
      const onMain = pathIsMain(effectivePath);
      // Whether *this render's* currentPath still matches the save's
      // path. Used to gate activeNote setState: if the user has already
      // switched away, we shouldn't slam the previous path's note back
      // into the visible editor.
      const stillOnSavePath =
        effectivePath === currentPath ||
        (pathIsMain(effectivePath) && pathIsMain(currentPath));
      try {
        if (!onMain) {
          // On a non-root path: write a per-path override instead of
          // touching main. No graph rebuild, no checkpoint — this is
          // scratch content scoped to the active path.
          const note = await api.saveNoteOnPath(slug, body, effectivePath, thinking);
          if (slug === activeSlug && stillOnSavePath) {
            setActiveNote(note);
            setCurrentBody(note.body);
            setDirty(false);
          }
          setLastSavedAt(Date.now());
          return;
        }
        // ONE IPC instead of four. The backend reads the notes dir once
        // and returns the saved note + summaries + graph + orphans in
        // one round-trip. Cuts post-save IPC chatter from ~5N to ~N
        // file reads on big workspaces.
        const out = await api.saveNoteFull(slug, body, thinking);
        invalidateNote(slug);
        if (slug === activeSlug && stillOnSavePath) {
          setActiveNote(out.note);
          setCurrentBody(out.note.body);
          setDirty(false);
        }
        // No-op save: backend skipped the scan; we skip the setState fan-out.
        // The graph/orphan/notes state is unchanged from before the save, so
        // re-setting them with empty arrays would needlessly thrash memo'd
        // children for no observable effect.
        if (!out.changed) return;
        setSyncStatus((s) => (s === "no-remote" ? "no-remote" : "pending"));
        setNotes(out.notes);
        setGraph(out.graph);
        setOrphanSet(new Set(out.orphans));
        setLastSavedAt(Date.now());
        // Topology can lag a bit — its only consumer is the path map and
        // a single save can never change branch topology anyway.
        queueTopologyRefresh();
      } catch (e) {
        console.error("save failed", e);
      }
    },
    [activeSlug, currentPath, collectionsView, queueTopologyRefresh],
  );

  const performRename = useCallback(
    async (slug: string, nextTitle: string, rewriteWikilinks: boolean) => {
      try {
        const n = await api.renameNote(slug, nextTitle, rewriteWikilinks);
        const list = await api.listNotes();
        setNotes(list);
        if (activeSlug === slug) setActiveSlug(n.slug);
        setGraph(await fetchGraph());
        // If we rewrote wikilinks across the workspace, every other note's
        // body may have changed too — invalidate cached reads.
        if (rewriteWikilinks) invalidateAllNotes();
      } catch (e) {
        setToast(t("appshell.toast.renameError", { error: String(e) }));
        // Rename failed — tell the editor to put the old title back so
        // the input isn't showing a name the file doesn't have.
        setTitleRevertNonce((n) => n + 1);
      }
    },
    [activeSlug, t],
  );

  const handleRenameNote = useCallback(
    async (slug: string, nextTitle: string) => {
      // Pre-flight: count wikilink references so we can ask the user before
      // mutating other notes. If there are none, skip the prompt entirely.
      let refs = 0;
      try { refs = await api.countWikilinkReferences(slug); } catch {}
      if (refs === 0) {
        await performRename(slug, nextTitle, false);
        return;
      }
      setRenamePrompt({ slug, nextTitle, refs });
    },
    [performRename],
  );

  const handleTogglePin = useCallback(async (slug: string, pinned: boolean) => {
    await api.setPinned(slug, pinned);
    const list = await api.listNotes();
    setNotes(list);
  }, []);

  // 2.1 Folders. Move a note into / out of a folder. The on-disk file
  // never leaves `notes/<slug>.md` — only the frontmatter `folder`
  // field changes. The notes list refresh picks up the new grouping.
  const handleMoveToFolder = useCallback(
    async (slug: string, folder: string | null) => {
      try {
        await api.setNoteFolder(slug, folder);
        const list = await api.listNotes();
        setNotes(list);
        const label = folder
          ? t("appshell.toast.movedToFolder", { folder })
          : t("appshell.toast.movedOutOfFolder");
        setToast({ text: label, tone: "success" });
      } catch (e) {
        setToast({ text: t("appshell.toast.moveError", { error: String(e) }), tone: "soft" });
      }
    },
    [t],
  );

  const handleDeleteNote = useCallback(
    async (slug: string) => {
      // Grab the content *before* deletion so undo can rebuild the note
      // without relying on git archaeology. If reading fails (encrypted +
      // locked, etc.), fall back to the legacy confirm dialog so the user
      // still gets a chance to bail out.
      let snapshot: { title: string; body: string; tags: string[]; pinned: boolean } | null = null;
      try {
        const n = await api.readNote(slug);
        if (n.locked) throw new Error("locked");
        snapshot = {
          title: n.frontmatter.title || slug,
          body: n.body,
          tags: n.frontmatter.tags ?? [],
          pinned: !!n.frontmatter.pinned,
        };
      } catch {
        setConfirmState({
          title: t("appshell.deleteLocked.title"),
          body: t("appshell.deleteLocked.body"),
          onConfirm: async () => {
            await api.deleteNote(slug);
            const list = await api.listNotes();
            setNotes(list);
            if (activeSlug === slug) setActiveSlug(list[0]?.slug ?? null);
            setGraph(await fetchGraph());
            setOrphanSet(new Set(await fetchOrphans()));
            setConfirmState(null);
          },
        });
        return;
      }

      await api.deleteNote(slug);
      const list = await api.listNotes();
      setNotes(list);
      if (activeSlug === slug) setActiveSlug(list[0]?.slug ?? null);
      setGraph(await fetchGraph());
      setOrphanSet(new Set(await fetchOrphans()));

      // Offer undo. The action re-creates the note with its original title
      // and body — the slug may differ from the original if the user spent
      // the undo window renaming another note into this slot, but the
      // content is never lost.
      setToast({
        text: t("appshell.toast.deleted", { title: snapshot.title }),
        action: {
          label: t("appshell.toast.undoLabel"),
          run: async () => {
            try {
              const fresh = await api.createNote(snapshot.title);
              await api.saveNote(fresh.slug, snapshot.body);
              const next = await api.listNotes();
              setNotes(next);
              setGraph(await fetchGraph());
              setOrphanSet(new Set(await fetchOrphans()));
              setActiveSlug(fresh.slug);
            } catch (e) {
              setToast(t("appshell.toast.undoError", { error: String(e) }));
            }
          },
        },
      });
    },
    [activeSlug, t],
  );

  const handleRevealNote = useCallback(async (slug: string) => {
    try {
      const abs = await api.noteAbsolutePath(slug);
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(abs);
    } catch (e) {
      setToast(t("appshell.toast.revealError", { error: String(e) }));
    }
  }, [t]);

  const handleSendSelectionToScratchpad = useCallback(async (text: string) => {
    try {
      await api.appendScratchpad(text);
      // Bump the reload nonce so an already-open scratchpad re-reads its
      // file instead of sitting on stale content.
      setScratchpadReloadNonce((n) => n + 1);
      if (!scratchpadOpen) setScratchpadOpen(true);
      setToast({ text: t("appshell.toast.sentToScratchpad", { count: String(text.trim().match(/\S+/g)?.length ?? 0) }), tone: "success" });
    } catch (e) {
      setToast(t("appshell.toast.scratchpadError", { error: String(e) }));
    }
  }, [scratchpadOpen, t]);

  const handleCopyNoteAsMarkdown = useCallback(async (slug: string) => {
    try {
      const n = await api.readNote(slug);
      if (n.locked) {
        setToast({ text: t("appshell.toast.unlockToCopy"), tone: "soft" });
        return;
      }
      // Reconstruct what a human would paste: visible title as H1, body
      // beneath. Frontmatter (tags, links, encryption metadata) is Yarrow
      // plumbing — pasting it elsewhere would just be noise.
      const title = n.frontmatter.title?.trim() || n.slug;
      const md = `# ${title}\n\n${n.body}`.trimEnd() + "\n";
      await navigator.clipboard.writeText(md);
      setToast({ text: t("appshell.toast.copiedAsMarkdown", { title }), tone: "success" });
    } catch (e) {
      setToast(t("appshell.toast.copyError", { error: String(e) }));
    }
  }, [t]);

  const handleDeleteMany = useCallback(
    (slugs: string[]) => {
      if (slugs.length === 0) return;
      setConfirmState({
        title: slugs.length === 1
          ? t("appshell.deleteMany.titleSingle", { count: String(slugs.length) })
          : t("appshell.deleteMany.titlePlural", { count: String(slugs.length) }),
        body: t("appshell.deleteMany.body"),
        onConfirm: async () => {
          for (const s of slugs) {
            try { await api.deleteNote(s); } catch (e) { console.error("delete failed", s, e); }
          }
          const list = await api.listNotes();
          setNotes(list);
          if (activeSlug && slugs.includes(activeSlug)) {
            setActiveSlug(list[0]?.slug ?? null);
          }
          setGraph(await fetchGraph());
          setOrphanSet(new Set(await fetchOrphans()));
          setConfirmState(null);
        },
      });
    },
    [activeSlug, t],
  );

  const handleCreatePath = useCallback(async () => {
    const cond = newPathCondition.trim();
    const explicitName = newPathName.trim();
    if (!cond && !explicitName) return;
    const derived =
      cond
        .toLowerCase()
        .replace(/^(if\s+|what\s+if\s+)/i, "")
        .split(/\s+/)
        .slice(0, 6)
        .join("-")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "new-path";
    const name = explicitName || derived;
    const rootName = collectionsView?.root || "main";
    // Every new path parents to the root. Keeps the workspace's tree flat so
    // "main" stays the single source of truth — the backend enforces this
    // too, but the UI mirrors it so the fork-moment animation is honest.
    const parent = rootName;
    // The active note becomes the new path's *main note* so the collection
    // has an anchor immediately and doesn't start empty.
    const seedSlug = activeSlug || undefined;
    setNewPathOpen(false);
    setNewPathName("");
    setNewPathCondition("");
    setNewPathFrom("");
    try {
      await api.createPathCollection(name, cond, parent, seedSlug);
      await refreshPathAwareness();
      // Step into the new path IMMEDIATELY, before the animation and the
      // teaching modal. This is the fix for the "edits went to main"
      // surprise — the user's next keystroke is now routed to the new
      // path, not main, regardless of whether they dismiss the guidance.
      setCurrentPath(name);
      setForkMoment(name);
      setTimeout(() => {
        guidance.trigger("path.create", {
          // Already on the path; primary is just an acknowledgement.
          onPrimary: () => {},
          // Secondary = "oops, take me back to main."
          onSecondary: () => setCurrentPath(rootName),
        });
      }, 1400);
    } catch (e) {
      console.error("create path failed", e);
    }
  }, [newPathName, newPathCondition, newPathFrom, activeSlug, collectionsView, refreshPathAwareness, guidance]);

  // v2 "path switching" is a pure UI/navigation action. Paths are collections
  // (lenses), not git branches — every note is always readable on every path,
  // so switching never has to save-and-checkout. Setting `currentPath` updates
  // the toolbar context; if the target collection has a main note and the
  // user isn't already on one of its members, we jump there.
  //
  // Pre-fetch the target note *before* flipping currentPath. Without this,
  // the NoteEditor's key (slug + currentPath) remounts immediately on the
  // setCurrentPath, but activeNote still holds the departing path's
  // content — so for a tick the editor renders the wrong body until the
  // 416-effect re-fetch lands. React 18 automatic batching collapses the
  // post-await setState calls into a single commit, so the remount sees
  // fresh content with no visual blip.
  const handleSwitchPath = useCallback(
    async (name: string) => {
      const cols = collectionsView?.collections ?? [];
      const col = cols.find((c) => c.name === name);
      const rootName = collectionsView?.root ?? "main";
      const onMain =
        !name || name === rootName || name === "main" || name === "master";
      const alreadyOnMember = activeSlug && col ? col.members.includes(activeSlug) : false;
      const targetSlug = col && !alreadyOnMember
        ? (col.main_note || col.members[0] || activeSlug)
        : activeSlug;
      if (!targetSlug) {
        setCurrentPath(name);
        return;
      }
      try {
        const note = onMain
          ? await api.readNote(targetSlug)
          : await api.readNoteOnPath(targetSlug, name);
        // Batched: one render → one key change → one remount with fresh body.
        if (targetSlug !== activeSlug) {
          asyncEpoch.current++;
          setActiveSlug(targetSlug);
        }
        setActiveNote(note);
        setCurrentBody(note.body);
        setCurrentPath(name);
      } catch (e) {
        // Fall back to the old behaviour on fetch failure so the user
        // isn't stranded: the 416 effect will retry once currentPath
        // updates.
        console.error("switch path prefetch failed", e);
        setCurrentPath(name);
        if (targetSlug !== activeSlug) selectSlug(targetSlug);
      }
    },
    // selectSlug is a stable callback (defined above); deliberate dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionsView, activeSlug],
  );

  const [compareSession, setCompareSession] = useState<string | null>(null);

  const handleAddConnection = useCallback(async () => {
    if (!activeSlug || !connectTarget) return;
    await api.addLink(activeSlug, connectTarget, connectType);
    setConnectOpen(false);
    setConnectTarget("");
    const [note, g, orphansList] = await Promise.all([
      api.readNote(activeSlug),
      fetchGraph(),
      fetchOrphans(),
    ]);
    setActiveNote(note);
    setCurrentBody(note.body);
    setGraph(g);
    setOrphanSet(new Set(orphansList));
  }, [activeSlug, connectTarget, connectType]);

  // Drag-to-connect in the graph: source → target with the chosen typed
  // link. Refreshes graph/orphan state so the new edge renders instantly.
  const handleGraphAddLink = useCallback(
    async (from: string, to: string, type: LinkType) => {
      try {
        await api.addLink(from, to, type);
        const [g, orphansList] = await Promise.all([fetchGraph(), fetchOrphans()]);
        setGraph(g);
        setOrphanSet(new Set(orphansList));
        if (from === activeSlug) {
          const note = await api.readNote(activeSlug);
          setActiveNote(note);
          setCurrentBody(note.body);
        }
      } catch (e) {
        console.error("graph add link failed", e);
      }
    },
    [activeSlug],
  );

  // Lasso bulk tag: append the given tag to every selected slug that
  // doesn't already have it. Each call is one IPC — this isn't the
  // hot path, so we keep it simple.
  const handleGraphBulkTag = useCallback(
    async (slugs: string[], tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed || slugs.length === 0) return;
      try {
        for (const slug of slugs) {
          const n = await api.readNote(slug);
          const existing = n.frontmatter.tags ?? [];
          if (existing.includes(trimmed)) continue;
          await api.setTags(slug, [...existing, trimmed]);
        }
        const [list, g] = await Promise.all([api.listNotes(), fetchGraph()]);
        setNotes(list);
        setGraph(g);
      } catch (e) {
        console.error("bulk tag failed", e);
      }
    },
    [],
  );

  // Lasso bulk add-to-path: adds each selected slug to the target path's
  // members list. Safe re-adds (`add_member` is idempotent on dup).
  const handleGraphBulkAddToPath = useCallback(
    async (slugs: string[], pathName: string) => {
      if (!pathName || slugs.length === 0) return;
      try {
        for (const slug of slugs) {
          await api.addNoteToPathCollection(pathName, slug);
        }
        setCollectionsView(await fetchPathCollections());
      } catch (e) {
        console.error("bulk add-to-path failed", e);
      }
    },
    [],
  );

  const handleRemoveConnection = useCallback(
    async (to: string) => {
      if (!activeSlug) return;
      await api.removeLink(activeSlug, to);
      const [note, g, orphansList] = await Promise.all([
        api.readNote(activeSlug),
        fetchGraph(),
        fetchOrphans(),
      ]);
      setActiveNote(note);
      setCurrentBody(note.body);
      setGraph(g);
      setOrphanSet(new Set(orphansList));
    },
    [activeSlug],
  );

  const handleSync = useCallback(async () => {
    if (!hasRemote(config)) {
      setSettingsOpen({ open: true, tab: "sync" });
      return;
    }
    setSyncStatus("syncing");
    try {
      const r = await api.sync();
      setSyncStatus(r.ok ? "synced" : "error");
      setSyncMessage(r.message);
      if (r.ok) {
        const now = Date.now();
        setLastSyncedAt(now);
        try {
          if (workspacePath) {
            localStorage.setItem(
              `yarrow.lastSyncedAt:${workspacePath}`,
              String(now),
            );
          }
        } catch {}
      } else if (r.quota_blocked) {
        // Manual sync — the user explicitly asked, so open the modal
        // AND refresh the data. If the issue was already known, this
        // just re-opens; otherwise this is the first notice.
        setQuotaBlock(r.quota_blocked);
        setQuotaModalOpen(true);
      } else {
        setToast({ text: t("appshell.toast.syncIssue", { message: r.message }), tone: "soft" });
      }
      if (r.ok) {
        // A clean sync means the quota issue (if any) is resolved.
        setQuotaBlock(null);
        setQuotaModalOpen(false);
      }
      // Surface conflict copies so the user knows their local version
      // is safe (and knows where to find it). Without this, the sibling
      // `.conflict-*` files are silent — the user sees the server's
      // version in the note and has no cue that a copy was kept.
      const cc = r.conflicts ?? [];
      if (cc.length > 0) {
        const n = cc.length;
        setToast({
          text: t(
            n === 1
              ? "appshell.toast.syncConflictsSingle"
              : "appshell.toast.syncConflictsPlural",
            { count: String(n) },
          ),
          tone: "soft",
          ttlMs: 8000,
        });
      }
      // See the auto-sync loop above for the failure mode these two
      // steps guard against. Cache invalidation is required because
      // the reload effect reads via getCachedOrReadNote, which would
      // otherwise hand back the pre-sync body and keep the editor
      // displaying content the pull has already replaced on disk.
      if (r.files_changed && r.files_changed.length) {
        for (const p of r.files_changed) {
          if (p.startsWith("notes/") && p.endsWith(".md")) {
            invalidateNote(p.slice("notes/".length, -".md".length));
          }
        }
        const slug = activeSlugRef.current;
        if (slug && r.files_changed.includes(`notes/${slug}.md`)) {
          setNoteReloadNonce((n) => n + 1);
        }
      }
    } catch (e) {
      setSyncStatus("error");
      setSyncMessage(String(e));
    }
  }, [config, t]);

  // Auto-sync on the interval configured in preferences.autosync_minutes.
  // `0` disables; any positive value ticks a periodic sync. Only fires
  // when a sync remote is configured AND the tab is visible (so a laptop
  // left open on a dashboard doesn't burn the auth-endpoint rate limiter
  // overnight). Window focus also triggers an immediate extra sync so
  // coming back from lunch doesn't leave stale state.
  useEffect(() => {
    if (!config) return;
    const minutes = config.preferences?.autosync_minutes ?? 0;
    if (minutes <= 0) return;
    if (!hasRemote(config)) return;

    const fire = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void handleSync();
    };
    const intervalMs = minutes * 60 * 1000;
    const id = window.setInterval(fire, intervalMs);
    const onFocus = () => fire();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [config, handleSync]);

  const openHistory = useCallback(async () => {
    if (!activeSlug) return;
    const [h, ks] = await Promise.all([
      api.noteHistory(activeSlug),
      api.listPinnedCheckpoints().catch(() => []),
    ]);
    setHistory(h);
    setKeepsakes(ks.filter((k) => k.slug === activeSlug));
    setHistoryPreview(null);
    setHistoryOpen(true);
  }, [activeSlug]);

  const pinHistoryCheckpoint = useCallback(
    async (oid: string, label: string, note?: string) => {
      if (!activeSlug) return;
      try {
        await api.pinCheckpoint(activeSlug, oid, label, note);
        const all = await api.listPinnedCheckpoints();
        setKeepsakes(all.filter((k) => k.slug === activeSlug));
        setToast({ text: t("appshell.toast.kept", { label }), tone: "success" });
      } catch (e) {
        setToast(t("appshell.toast.pinError", { error: String(e) }));
      }
    },
    [activeSlug, t],
  );

  const unpinHistoryCheckpoint = useCallback(
    async (id: string) => {
      try {
        await api.unpinCheckpoint(id);
        const all = await api.listPinnedCheckpoints();
        setKeepsakes((activeSlug ? all.filter((k) => k.slug === activeSlug) : all));
        setToast({ text: t("appshell.toast.unpinned"), tone: "soft" });
      } catch (e) {
        setToast(t("appshell.toast.unpinError", { error: String(e) }));
      }
    },
    [activeSlug, t],
  );

  const previewAtCheckpoint = useCallback(
    async (oid: string) => {
      if (!activeSlug) return;
      const raw = await api.noteAtCheckpoint(activeSlug, oid);
      setHistoryPreview(raw);
    },
    [activeSlug],
  );

  const restoreAtCheckpoint = useCallback(
    async (oid: string) => {
      if (!activeSlug) return;
      await api.restoreNote(activeSlug, oid);
      const n = await api.readNote(activeSlug);
      setActiveNote(n);
      setCurrentBody(n.body);
      setRestoreNonce((x) => x + 1);
      setHistoryOpen(false);
      setNotes(await api.listNotes());
      setToast({ text: t("appshell.toast.restored"), tone: "success" });
    },
    [activeSlug, t],
  );

  const closeWorkspace = useCallback(async () => {
    await api.closeWorkspace();
    onClose();
  }, [onClose]);

  const onConflictsResolved = useCallback(async () => {
    setConflictSession(null);
    await refreshAll();
    if (activeSlug) {
      try {
        const n = await api.readNote(activeSlug);
        setActiveNote(n);
        setCurrentBody(n.body);
      } catch {}
    }
  }, [activeSlug, refreshAll]);

  const onConflictAbort = useCallback(async () => {
    setConflictSession(null);
    await refreshAll();
  }, [refreshAll]);

  const noteLinks = activeNote?.frontmatter.links ?? [];

  const titleMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of notes) m[n.slug] = n.title;
    return m;
  }, [notes]);

  const snippetMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of notes) m[n.slug] = n.excerpt;
    return m;
  }, [notes]);

  const neighbors = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    if (graph) {
      for (const e of graph.links) {
        (m[e.from] ??= new Set()).add(e.to);
        (m[e.to] ??= new Set()).add(e.from);
      }
    }
    return m;
  }, [graph]);

  const questions = useMemo(() => openQuestions(currentBody), [currentBody]);

  // Word count for the active note. Strip wikilink brackets so "[[foo]]"
  // counts as one word, not two; frontmatter never appears in currentBody
  // (NoteEditor only shows the body) so no further stripping needed.
  const noteWordCount = useMemo(() => {
    if (!activeNote || !currentBody) return 0;
    const cleaned = currentBody.replace(/\[\[([^\]]+)\]\]/g, "$1");
    return cleaned.trim().match(/\S+/g)?.length ?? 0;
  }, [activeNote, currentBody]);

  const pathCount = paths.length;

  // Promote the current non-root path to main: every override becomes real,
  // the path is archived, the workspace checkpoints. Confirmation is
  // handled by the `confirmState` modal — the UI calls this after the user
  // agrees. We refresh paths, flip currentPath back to root, and surface a
  // guidance modal summarizing what happened.
  const handlePromotePath = useCallback(async () => {
    if (!currentPath) return;
    const rootName = collectionsView?.root ?? "main";
    if (currentPath === rootName || currentPath === "main" || currentPath === "master") {
      return;
    }
    const promotedName = currentPath;
    try {
      // Count overrides so the confirmation summary is accurate.
      const overrides = await api.listPathOverrides(promotedName).catch(() => [] as string[]);
      const count = overrides.length;
      setConfirmState({
        title: t("appshell.promote.title", { path: promotedName }),
        body:
          count === 0
            ? t("appshell.promote.bodyEmpty")
            : count === 1
              ? t("appshell.promote.bodyEditsSingle", { count: String(count) })
              : t("appshell.promote.bodyEditsPlural", { count: String(count) }),
        onConfirm: async () => {
          setConfirmState(null);
          try {
            await api.promotePathToMain(promotedName);
            await refreshPathAwareness();
            // Main content on disk has just changed; drop caches so the next
            // read/editor render picks up the applied bodies.
            invalidateAllNotes();
            // Reload notes/graph/orphans to reflect the new main.
            setNotes(await api.listNotes());
            try { setGraph(await fetchGraph()); } catch {}
            try { setOrphanSet(new Set(await fetchOrphans())); } catch {}
            setCurrentPath(rootName);
            setInlineDiffOpen(false);
            // Re-read the active note against main — its body may have
            // changed if it was one of the overrides.
            if (activeSlug) {
              try {
                const refreshed = await api.readNote(activeSlug);
                setActiveNote(refreshed);
                setCurrentBody(refreshed.body);
              } catch {}
            }
            guidance.trigger("path.promoted");
          } catch (e) {
            setToast(t("appshell.toast.promoteError", { error: String(e) }));
          }
        },
      });
    } catch (e) {
      console.error("promote failed", e);
    }
  }, [currentPath, collectionsView, activeSlug, refreshPathAwareness, guidance, t]);

  const handleThrowAwayPath = useCallback(async () => {
    if (!currentPath) return;
    const rootName = collectionsView?.root ?? "main";
    if (currentPath === rootName || currentPath === "main" || currentPath === "master") {
      return;
    }
    const discarded = currentPath;
    const overrides = await api.listPathOverrides(discarded).catch(() => [] as string[]);
    const count = overrides.length;
    setConfirmState({
      title: t("appshell.throwAway.title", { path: discarded }),
      body:
        count === 0
          ? t("appshell.throwAway.bodyEmpty")
          : count === 1
            ? t("appshell.throwAway.bodyEditsSingle", { count: String(count) })
            : t("appshell.throwAway.bodyEditsPlural", { count: String(count) }),
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.deletePathCollection(discarded);
          await refreshPathAwareness();
          setCurrentPath(rootName);
          setInlineDiffOpen(false);
        } catch (e) {
          setToast(t("appshell.toast.discardError", { error: String(e) }));
        }
      },
    });
  }, [currentPath, collectionsView, refreshPathAwareness, t]);

  const filteredNotes = useMemo(() => {
    if (!tagFilter) return notes;
    return notes.filter((n) => (n.tags ?? []).includes(tagFilter));
  }, [notes, tagFilter]);

  // Stable empty-fallback so memoized children don't see a fresh `[]`
  // array reference on every parent render before the graph has loaded.
  const tagCounts = useMemo(() => graph?.tags ?? [], [graph]);

  // H4. Air-gap visibility — count of notes that the sync pipeline will
  // never push (either `private: true` in frontmatter, or tagged
  // `clinical`). Drives the "N off-server" pill in the status bar.
  // Re-derived only when notes change.
  const privateNoteCount = useMemo(
    () =>
      notes.filter(
        (n) => n.private || (n.tags?.includes("clinical") ?? false),
      ).length,
    [notes],
  );

  // Memoized clear so NoteList's `memo` boundary actually holds. An inline
  // arrow recreated each render defeats it for free.
  const clearTagFilter = useCallback(() => setTagFilter(null), []);

  const mappingEnabled = (config?.mapping?.mode ?? "mapped") === "mapped";
  const mainNoteSet = !!config?.mapping?.main_note;
  const needsMainNote = mappingEnabled && !mainNoteSet;

  // Toolbar callbacks — stabilised so the memoised Toolbar doesn't have to
  // re-render on every parent tick (selection events, currentBody updates).
  const tbBranchFromHere = useCallback(() => {
    if (needsMainNote) { setMainNotePromptOpen(true); return; }
    setNewPathOpen(true);
  }, [needsMainNote]);
  const tbOpenPaths = useCallback(() => {
    if (needsMainNote) { setMainNotePromptOpen(true); return; }
    setRailOverlay("paths");
  }, [needsMainNote]);
  const tbOpenMap = useCallback(() => {
    if (needsMainNote) { setMainNotePromptOpen(true); return; }
    setMapFilter(null);
    setRailOverlay("map");
  }, [needsMainNote]);
  const tbEditCurrentCondition = useCallback(
    () => setEditConditionFor(currentPath),
    [currentPath],
  );
  const stableCollections = useMemo(
    () => collectionsView?.collections ?? [],
    [collectionsView],
  );
  const stableRootName = collectionsView?.root ?? "main";

  return (
    <div className="h-full flex flex-col bg-bg text-char">
      <div className="flex-1 flex overflow-hidden">
        {!focusMode && (
          <aside className="w-[268px] shrink-0 bg-s1 border-r border-bd flex flex-col overflow-hidden">
            <div className="relative px-3 pt-4 pb-3">
              <button
                ref={workspaceChipRef}
                onClick={() => setWorkspaceSwitcherOpen((o) => !o)}
                className={`group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border transition text-left ${
                  workspaceSwitcherOpen
                    ? "bg-yelp border-yel"
                    : "bg-bg border-bd hover:bg-s2 hover:border-bd2"
                }`}
                title={t("appshell.workspace.switchTitle", { shortcut: SK.switchWorkspace })}
                aria-label={t("appshell.workspace.switchAria")}
                aria-expanded={workspaceSwitcherOpen}
              >
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 font-serif text-sm"
                  style={workspaceAccent(workspacePath, true)}
                >
                  {(config?.workspace.name ?? "Y").charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-serif text-[15px] text-char leading-tight truncate"
                    title={config?.workspace.name ?? workspacePath}
                  >
                    {config?.workspace.name ?? t("appshell.workspace.fallbackName")}
                  </div>
                  <div className="text-2xs text-t3 leading-tight truncate">
                    {t(
                      notes.length === 1
                        ? (paths.length === 1
                            ? "appshell.workspace.notesPathsSingleSingle"
                            : "appshell.workspace.notesPathsSinglePlural")
                        : (paths.length === 1
                            ? "appshell.workspace.notesPathsPluralSingle"
                            : "appshell.workspace.notesPathsPluralPlural"),
                      {
                        notes: String(notes.length),
                        paths: String(paths.length),
                      },
                    )}
                  </div>
                </div>
                <span className={`text-t3 group-hover:text-char transition shrink-0 ${workspaceSwitcherOpen ? "rotate-180 text-yeld" : ""}`}>
                  <ChevronDownIcon />
                </span>
              </button>
              {workspaceSwitcherOpen && (
                <L>
                  <WorkspaceSwitcher
                    open={workspaceSwitcherOpen}
                    anchorRef={workspaceChipRef}
                    currentPath={workspacePath}
                    onClose={() => setWorkspaceSwitcherOpen(false)}
                    onSwitch={(p) => onSwitchWorkspace(p)}
                  />
                </L>
              )}
            </div>
            <div className="px-4 pb-3">
              <button
                onClick={() => setPaletteOpen(true)}
                className="w-full flex items-center gap-2 px-4 py-2 rounded-full bg-s2 text-t3 hover:text-char hover:bg-s3 transition text-xs"
              >
                <SearchIcon size={13} />
                <span>{t("appshell.sidebar.findAnything")}</span>
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <NoteList
                notes={filteredNotes}
                activeSlug={activeSlug}
                mainNoteSlug={config?.mapping?.main_note ?? null}
                orphans={orphanSet}
                decayDays={config?.preferences.decay_days ?? 60}
                neighbors={neighbors}
                onSelect={selectSlug}
                onCreate={handleCreateNote}
                onRename={handleRenameNote}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
                onDeleteMany={handleDeleteMany}
                tagFilter={tagFilter}
                onClearTagFilter={clearTagFilter}
                encryptionEnabled={encryption.enabled}
                encryptionUnlocked={encryption.unlocked}
                onEncryptNote={handleEncryptNoteBySlug}
                onDecryptNote={handleDecryptNoteBySlug}
                onReveal={handleRevealNote}
                onCopyAsMarkdown={handleCopyNoteAsMarkdown}
                onMoveToFolder={handleMoveToFolder}
                workspacePath={workspacePath}
                pathCount={stableCollections.filter((c) => c.name !== stableRootName).length}
              />
            </div>
            {/* Bottom utility row — Journal / Activity / Trash. Scratchpad
                was removed from the sidebar; it's already reachable from
                the right-sidebar tab. */}
            <div className="shrink-0 border-t border-bd/60 px-3 py-2 flex items-center gap-1">
              <SidebarUtilityButton
                onClick={() => handleOpenDaily()}
                title={t("appshell.sidebar.journalTitle")}
                label={t("appshell.sidebar.journalLabel")}
              >
                <JournalIcon size={13} />
              </SidebarUtilityButton>
              <SidebarUtilityButton
                onClick={() => setActivityOpen(true)}
                title={t("appshell.sidebar.activityTitle")}
                label={t("appshell.sidebar.activityLabel")}
              >
                <ActivityIcon size={13} />
              </SidebarUtilityButton>
              <SidebarUtilityButton
                onClick={() => setTrashOpen(true)}
                title={t("appshell.sidebar.trashTitle")}
                label={t("appshell.sidebar.trashLabel")}
              >
                <DeleteIcon size={13} />
              </SidebarUtilityButton>
            </div>
          </aside>
        )}

        <section
          className="flex-1 min-w-0 flex flex-col relative"
          style={
            // 3px left stripe in the path's hue when we're not on main.
            // Ambient orientation — you feel which path you're on without
            // having to check the toolbar.
            !(currentPath === "main" || currentPath === "master" || !currentPath)
              ? ({
                  boxShadow: `inset 3px 0 0 0 ${
                    // Derived client-side to match the toolbar dot exactly.
                    (() => {
                      let h = 0;
                      for (let i = 0; i < currentPath.length; i++)
                        h = (h * 31 + currentPath.charCodeAt(i)) >>> 0;
                      const hue = 260 + (h % 100);
                      return `hsl(${hue} 48% 48%)`;
                    })()
                  }`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <Toolbar
            collections={stableCollections}
            rootName={stableRootName}
            currentPath={currentPath}
            checkpointCount={checkpointCount}
            dirty={dirty}
            lastSavedAt={lastSavedAt}
            mappingEnabled={mappingEnabled}
            onSwitchPath={handleSwitchPath}
            onBranchFromHere={tbBranchFromHere}
            onOpenPaths={tbOpenPaths}
            onComparePaths={() => setPathCompareOpen(true)}
            onOpenMap={tbOpenMap}
            onEditCurrentCondition={tbEditCurrentCondition}
            focusMode={focusMode}
            onExitFocus={() => setFocusMode(false)}
            dailyDate={activeSlug?.startsWith("daily/") ? activeSlug.slice("daily/".length) : null}
            onOpenJournalCalendar={(anchor) => setJournalCalendar({ open: true, anchor })}
          />
          {mappingEnabled && (
            <PathRibbon
              pathName={currentPath}
              condition={stableCollections.find((c) => c.name === currentPath)?.condition || null}
              rootName={stableRootName}
              pathColorOverrides={pathColorOverrides}
              onSwitchPath={handleSwitchPath}
              onToggleInlineDiff={() => setInlineDiffOpen((x) => !x)}
              inlineDiffActive={inlineDiffOpen}
              onOpenCompare={() => setPathCompareOpen(true)}
              onPromote={handlePromotePath}
              onThrowAway={handleThrowAwayPath}
            />
          )}
          {showLeftOffBanner && leftOff && (
            <WhereYouLeftOffBanner
              state={leftOff}
              onResume={() => {
                // Switch to the stored path first if it still exists,
                // then jump to the slug. If the note has been deleted we
                // silently just clear the banner — no toast: the user
                // clicked "pick up here," an error there would feel rude.
                const target = notes.find((n) => n.slug === leftOff.slug);
                if (!target) {
                  setLeftOff(null);
                  forgetLeftOff(workspacePath);
                  return;
                }
                if (leftOff.path && leftOff.path !== currentPath) {
                  const exists = (collectionsView?.collections ?? []).some(
                    (c) => c.name === leftOff.path,
                  );
                  if (exists) handleSwitchPath(leftOff.path);
                }
                const slug = leftOff.slug;
                const cursorLine = leftOff.cursorLine;
                const snippet = leftOff.snippet;
                selectSlug(slug);
                // Wait for NoteEditor to mount the new note (the slug
                // change unmounts the previous editor and remounts a
                // fresh one). 200 ms is enough on every machine I've
                // tested without being noticeable as a delay; if the
                // editor isn't ready in time the user just lands at the
                // top, which is the prior behaviour.
                window.setTimeout(() => {
                  window.dispatchEvent(new CustomEvent("yarrow:scroll-to-line", {
                    detail: { slug, line: cursorLine, snippet },
                  }));
                }, 200);
                setLeftOff(null);
              }}
              onDismiss={() => setLeftOff(null)}
              onHideAlways={() => {
                setHideLeftOff(workspacePath, true);
                forgetLeftOff(workspacePath);
                setLeftOff(null);
              }}
            />
          )}
          {/* `yarrow-paper` scopes the Paper & Warmth texture to the
              writing canvas only — Settings, modals, and the command
              palette stay flat. See index.css `.yarrow-paper`. */}
          <div className="yarrow-paper flex-1 overflow-hidden flex flex-col relative yarrow-paint-island">
            {activeNote ? (
              activeNote.locked ? (
                <LockedNoteHero
                  title={activeNote.frontmatter.title || activeNote.slug}
                  onUnlock={() => requestUnlock()}
                  onUnlocked={onUnlocked}
                />
              ) : inlineDiffOpen &&
                !!currentPath &&
                currentPath !== stableRootName &&
                currentPath !== "main" &&
                currentPath !== "master" ? (
                <Suspense fallback={<EditorSkeleton />}>
                  <InlineDiffPane
                    slug={activeNote.slug}
                    mainName={stableRootName}
                    pathName={currentPath}
                    onExit={() => setInlineDiffOpen(false)}
                  />
                </Suspense>
              ) : !showRawMarkdown ? (
                // Reading mode: full markdown render via pulldown-cmark on the
                // backend, themed with `.yarrow-reading` CSS so code blocks,
                // quotes, tables and headings look like a finished document.
                <Suspense fallback={<EditorSkeleton />}>
                  <NoteReader
                    key={"r:" + activeNote.slug + "@" + currentPath}
                    note={activeNote}
                    notes={notes}
                    pathNotes={pathNotes}
                    currentPath={currentPath}
                    currentBody={currentBody}
                    mainBody={mainBody}
                    onNavigate={selectSlug}
                    onBranchFromWikilink={(slug) => {
                      const target = notes.find((n) => n.slug === slug);
                      const hint = target?.title || slug;
                      setNewPathCondition(`If ${hint.toLowerCase()}…`);
                      setNewPathOpen(true);
                    }}
                    onSwitchToWriting={() => setShowRawMarkdown(true)}
                  />
                </Suspense>
              ) : (
                <Suspense fallback={<EditorSkeleton />}>
                  <NoteEditor
                    key={activeNote.slug + "@" + currentPath + "#" + restoreNonce}
                    note={activeNote}
                    notes={notes}
                    currentPath={currentPath}
                    jumpToLine={jumpSignal}
                    mappingEnabled={mappingEnabled}
                    onSave={handleSave}
                    onTagsChange={async (slug, tags) => {
                      try {
                        const updated = await api.setTags(slug, tags);
                        invalidateNote(slug);
                        if (slug === activeSlug) setActiveNote(updated);
                        setNotes(await api.listNotes());
                        try { setGraph(await fetchGraph()); } catch {}
                      } catch (e) {
                        setToast(t("appshell.toast.tagsError", { error: String(e) }));
                      }
                    }}
                    tagSuggestions={tagCounts.map((tg) => tg.tag)}
                    pathColorOverrides={pathColorOverrides}
                    onAnnotationsChange={async (slug, annotations) => {
                      try {
                        const updated = await api.setAnnotations(slug, annotations);
                        invalidateNote(slug);
                        if (slug === activeSlug) setActiveNote(updated);
                      } catch (e) {
                        setToast(t("appshell.toast.annotationSaveError", { error: String(e) }));
                      }
                    }}
                    onTitleChange={(title) => handleRenameNote(activeNote.slug, title)}
                    titleRevertNonce={titleRevertNonce}
                    onDirtyChange={setDirty}
                    onNavigate={selectSlug}
                    onBodyChange={setCurrentBody}
                    onOpenFork={() => setNewPathOpen(true)}
                    debounceMs={config?.preferences.autocheckpoint_debounce_ms ?? 3000}
                    askThinkingOnClose={config?.preferences.ask_thinking_on_close ?? true}
                    showRawMarkdown={showRawMarkdown}
                    pathNotes={pathNotes}
                    onBranchFromWikilink={(slug) => {
                      // Seed the condition with the target note's title so
                      // the dialog lands with a hint, not an empty field.
                      const target = notes.find((n) => n.slug === slug);
                      const hint = target?.title || slug;
                      setNewPathCondition(`If ${hint.toLowerCase()}…`);
                      setNewPathOpen(true);
                    }}
                  />
                </Suspense>
              )
            ) : (
              <EmptyWorkspaceHero
                onNewNote={handleCreateNote}
                onOpenPalette={() => setPaletteOpen(true)}
              />
            )}
            {activeNote && !activeNote.locked && mappingEnabled && (
              <FloatingDirectionCTA onClick={() => {
                if (needsMainNote) { setMainNotePromptOpen(true); return; }
                setNewPathOpen(true);
              }} />
            )}
            {historyOpen && activeNote && (
              <L>
                <HistorySlider
                  history={history}
                  preview={historyPreview}
                  currentBody={currentBody}
                  noteTitle={activeNote.frontmatter.title}
                  keepsakes={keepsakes}
                  onHover={previewAtCheckpoint}
                  onRestore={restoreAtCheckpoint}
                  onPin={pinHistoryCheckpoint}
                  onUnpin={unpinHistoryCheckpoint}
                  onClose={() => { setHistoryOpen(false); setRailOverlay(null); }}
                />
              </L>
            )}
          </div>
        </section>

        {spellMenu && (
          <L>
            <SpellMenu
              {...spellMenu}
              onClose={() => setSpellMenu(null)}
              onAddToDictionary={handleAddToDictionary}
            />
          </L>
        )}

        {obsidianImportOpen && (
          <L>
            <ObsidianImport
              open={obsidianImportOpen}
              onClose={() => setObsidianImportOpen(false)}
              onChanged={async () => {
                invalidateAllNotes();
                setNotes(await api.listNotes());
                try { setGraph(await fetchGraph()); } catch {}
                try { setOrphanSet(new Set(await fetchOrphans())); } catch {}
              }}
            />
          </L>
        )}

        {renamePrompt && (
          <div
            className="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
            onClick={cancelRename}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-bd">
                <div className="font-serif text-xl text-char">{t("appshell.rename.title")}</div>
                <div className="text-2xs text-t3 mt-1 leading-relaxed">
                  {renamePrompt.refs === 1
                    ? t("appshell.rename.refsBodySingle", { count: String(renamePrompt.refs) })
                    : t("appshell.rename.refsBodyPlural", { count: String(renamePrompt.refs) })}
                </div>
              </div>
              <div className="px-5 py-4 text-xs text-t2">
                <span className="font-serif text-base text-char">{t("appshell.rename.confirmQuestion", { title: renamePrompt.nextTitle })}</span>
              </div>
              <div className="px-5 py-3 border-t border-bd flex justify-end gap-2 flex-wrap">
                <button
                  onClick={cancelRename}
                  className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char"
                >
                  {t("appshell.rename.cancel")}
                </button>
                <button
                  onClick={() => {
                    const { slug, nextTitle } = renamePrompt;
                    setRenamePrompt(null);
                    void performRename(slug, nextTitle, false);
                  }}
                  className="text-xs px-3 py-1.5 rounded bg-s2 text-char hover:bg-s3"
                >
                  {t("appshell.rename.onlyThis")}
                </button>
                <button
                  onClick={() => {
                    const { slug, nextTitle } = renamePrompt;
                    setRenamePrompt(null);
                    void performRename(slug, nextTitle, true);
                  }}
                  className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yel2"
                >
                  {t("appshell.rename.andUpdate")}
                </button>
              </div>
            </div>
          </div>
        )}

        {findReplaceResult && (
          <div
            className="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
            onClick={() => setFindReplaceResult(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-5">
                <div className="font-serif text-xl text-char">{t("appshell.findReplaceResult.title")}</div>
                <div className="text-sm text-t2 mt-2 leading-relaxed">
                  {t(
                    findReplaceResult.total === 1
                      ? (findReplaceResult.changed === 1
                          ? "appshell.findReplaceResult.bodySingle"
                          : "appshell.findReplaceResult.bodyMixed2")
                      : (findReplaceResult.changed === 1
                          ? "appshell.findReplaceResult.bodyMixed1"
                          : "appshell.findReplaceResult.bodyPlural"),
                    {
                      total: String(findReplaceResult.total),
                      changed: String(findReplaceResult.changed),
                    },
                  )}
                </div>
                <div className="text-2xs text-t3 mt-2 italic">
                  {t("appshell.findReplaceResult.checkpointHint")}
                </div>
              </div>
              <div className="px-5 py-3 border-t border-bd flex justify-end">
                <button
                  onClick={() => setFindReplaceResult(null)}
                  className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yel2"
                >
                  {t("appshell.findReplaceResult.done")}
                </button>
              </div>
            </div>
          </div>
        )}

        {decisionMatrixOpen && (
          <L>
            <DecisionMatrix
              open={decisionMatrixOpen}
              onClose={() => setDecisionMatrixOpen(false)}
              notes={notes}
              initialCollections={collectionsView?.collections}
              currentPathName={currentPath}
              onOpenNote={(slug) => { setDecisionMatrixOpen(false); selectSlug(slug); }}
            />
          </L>
        )}

        <JournalCalendar
          open={journalCalendar.open}
          anchor={journalCalendar.anchor}
          onClose={() => setJournalCalendar({ open: false, anchor: null })}
          onPick={(iso) => { setJournalCalendar({ open: false, anchor: null }); void handleOpenDaily(iso); }}
          activeDate={activeSlug?.startsWith("daily/") ? activeSlug.slice("daily/".length) : undefined}
        />

        {pathCompareOpen && (
          <L>
            <PathCompare
              open={pathCompareOpen}
              onClose={() => setPathCompareOpen(false)}
              paths={(collectionsView?.collections ?? []).map((c) => c.name)}
              pathConditions={Object.fromEntries(
                (collectionsView?.collections ?? []).map((c) => [c.name, c.condition]),
              )}
              initialLeft={currentPath && currentPath !== stableRootName ? currentPath : stableRootName}
              initialRight={
                // Prefer a non-root path on the right so the default view is
                // "main vs your latest try" — matches the scenario we guide.
                (collectionsView?.collections ?? [])
                  .map((c) => c.name)
                  .find((n) => n !== stableRootName && n !== currentPath)
              }
            />
          </L>
        )}

        {findReplaceOpen && (
          <L>
            <FindReplace
              open={findReplaceOpen}
              onClose={() => setFindReplaceOpen(false)}
              currentPathName={currentPath}
              currentPathSlugs={pathNotes[currentPath] ?? null}
              onChanged={async (report) => {
                invalidateAllNotes();
                setNotes(await api.listNotes());
                try { setGraph(await fetchGraph()); } catch {}
                if (activeSlug) {
                  try {
                    const fresh = await api.readNote(activeSlug);
                    setActiveNote(fresh);
                    setCurrentBody(fresh.body);
                  } catch {}
                }
                setFindReplaceResult(report);
              }}
            />
          </L>
        )}

        {trashOpen && (
          <L>
            <Trash
              open={trashOpen}
              onClose={() => setTrashOpen(false)}
              onChanged={async () => {
                invalidateAllNotes();
                setNotes(await api.listNotes());
                try { setGraph(await fetchGraph()); } catch {}
                try { setOrphanSet(new Set(await fetchOrphans())); } catch {}
              }}
            />
          </L>
        )}

        {scratchpadOpen && (
          <L>
            <Scratchpad
              activeNote={activeNote}
              width={scratchpadWidth}
              onWidthChange={saveScratchpadWidth}
              reloadNonce={scratchpadReloadNonce}
              onClose={() => setScratchpadOpen(false)}
              onPromoted={async (newSlug) => {
                const list = await api.listNotes();
                setNotes(list);
                setGraph(await fetchGraph());
                setOrphanSet(new Set(await fetchOrphans()));
                // Jump straight to the freshly-kept note so the user sees
                // that "Keep as note" actually produced something tangible.
                selectSlug(newSlug);
                setToast({ text: t("appshell.toast.keptAsNote"), tone: "success" });
              }}
            />
          </L>
        )}

        {!focusMode && (
          <RightRail
            activeOverlay={railOverlay}
            scratchpadOpen={scratchpadOpen}
            mappingEnabled={mappingEnabled}
            onOpen={async (k) => {
              if (k === "history") {
                if (railOverlay === "history") {
                  setHistoryOpen(false);
                  setRailOverlay(null);
                } else {
                  setRailOverlay("history");
                  await openHistory();
                }
                return;
              }
              if ((k === "map" || k === "paths" || k === "links") && needsMainNote) {
                setMainNotePromptOpen(true);
                return;
              }
              setRailOverlay(railOverlay === k ? null : k);
            }}
            onToggleScratchpad={() => setScratchpadOpen((o) => !o)}
            onOpenKits={() => setKitsPickerOpen(true)}
            onOpenSettings={() => setSettingsOpen({ open: true })}
            onSetReadingWriting={async (writing) => {
              // Flush a pending debounced edit before flipping to reading
              // mode — otherwise the rendered preview reads stale disk
              // content and the user wonders why their last paragraph
              // isn't showing up.
              if (!writing && dirty && activeSlug) {
                try {
                  await api.saveNote(activeSlug, currentBody);
                  invalidateNote(activeSlug);
                  setDirty(false);
                } catch (e) {
                  console.error("flush before reading-mode flip failed", e);
                }
              }
              setShowRawMarkdown(writing);
            }}
          />
        )}
      </div>

      {/* Right-rail overlays */}
      {railOverlay === "map" && (
        <Modal
          open
          onClose={() => { setRailOverlay(null); setMapFilter(null); }}
          width="w-[min(90vw,1100px)]"
        >
          <div className="text-center mb-3 -mt-1">
            <div className="font-serif text-[32px] text-char tracking-tight leading-none">
              {mapFilter
                ? t("appshell.map.titleFiltered", { pathName: mapFilter.collectionName })
                : t("appshell.map.title")}
            </div>
            <div className="mt-2 text-2xs text-t3 font-mono uppercase tracking-[0.2em]">
              {mapFilter ? (() => {
                const c = collectionsView?.collections.find((x) => x.name === mapFilter.collectionName);
                const n = c?.members.length ?? 0;
                return t(
                  n === 1
                    ? "appshell.map.notesInPathSingle"
                    : "appshell.map.notesInPathPlural",
                  { count: String(n) },
                );
              })() : (
                <>
                  {(activeNote?.frontmatter.title || activeSlug || t("appshell.map.thisNote"))}
                  {" · "}
                  {(() => {
                    const neighborCount = mapNeighborCount(graph, activeSlug);
                    return t(
                      neighborCount === 1
                        ? "appshell.map.neighborsSingle"
                        : "appshell.map.neighborsPlural",
                      { count: String(neighborCount) },
                    );
                  })()}
                </>
              )}
            </div>
          </div>
          <div className="h-[62vh]">
            <L>
              <ConnectionGraph
                graph={(() => {
                  if (!mapFilter || !graph) return graph;
                  const c = collectionsView?.collections.find((x) => x.name === mapFilter.collectionName);
                  if (!c) return graph;
                  const allowed = new Set(c.members);
                  return {
                    ...graph,
                    notes: graph.notes.filter((n) => allowed.has(n.slug)),
                    links: graph.links.filter((e) => allowed.has(e.from) && allowed.has(e.to)),
                  };
                })()}
                activeSlug={activeSlug}
                mainNoteSlug={config?.mapping?.main_note ?? null}
                onSelect={(slug) => { selectSlug(slug); setRailOverlay(null); setMapFilter(null); }}
                fillHeight
                onAddLink={handleGraphAddLink}
                onBulkTag={handleGraphBulkTag}
                onBulkAddToPath={handleGraphBulkAddToPath}
                pathNames={collectionsView?.collections.map((c) => c.name) ?? []}
              />
            </L>
          </div>
        </Modal>
      )}

      {railOverlay === "links" && (
        <Modal
          open
          onClose={() => setRailOverlay(null)}
          title={t("appshell.links.title")}
        >
          <div className="max-h-[60vh] overflow-y-auto -mx-4 px-4">
            <LinkedNotesList
              links={noteLinks}
              titleMap={titleMap}
              snippetMap={snippetMap}
              onNavigate={(slug) => { selectSlug(slug); setRailOverlay(null); }}
              onAdd={() => { setRailOverlay(null); setConnectOpen(true); }}
              onRemove={handleRemoveConnection}
            />
            <div className="mt-4">
              <OpenQuestions
                questions={questions}
                onJump={(line) => {
                  setJumpSignal({ line, nonce: Date.now() });
                  setRailOverlay(null);
                }}
              />
            </div>
            <div className="mt-2">
              <Transclusions
                body={currentBody}
                notes={notes}
                onNavigate={(slug) => { selectSlug(slug); setRailOverlay(null); }}
                refreshToken={restoreNonce}
              />
            </div>
          </div>
        </Modal>
      )}

      {editorCtxMenu && (() => {
        // Build callback bag — the radial items file owns labels and
        // icons; AppShell owns the state these callbacks mutate.
        const close = () => setEditorCtxMenu(null);
        const callbacks: RadialCallbacks = {
          mappingEnabled,
          openWikilinkPicker: () => {
            close();
            setWikilinkPickerOpen(true);
          },
          openTableInsert: () => {
            close();
            setTableInsertOpen(true);
          },
          openCalloutInsert: () => {
            close();
            setCalloutInsertOpen(true);
          },
          startPathFrom: (seed) => {
            // Reshape selection into an "If …" condition so the path
            // dialog isn't blank — the user can accept, edit, or clear.
            const trimmed = seed.trim().slice(0, 120);
            const lower = trimmed.toLowerCase();
            const prefilled = /^(if|what if)\b/.test(lower)
              ? trimmed
              : `If ${lower.replace(/\.$/, "")}`;
            setNewPathCondition(prefilled);
            close();
            setNewPathOpen(true);
          },
          sendSelectionToScratchpad: (text) => {
            handleSendSelectionToScratchpad(text);
            close();
          },
          insertRaw: (text, opts) => {
            window.dispatchEvent(
              new CustomEvent("yarrow:editor-insert-raw", {
                detail: { text, ...opts },
              }),
            );
            close();
          },
          annotateSelection: (anchor) => {
            close();
            if (!activeNote) return;
            // Cap the stored anchor so a huge selection doesn't bloat the
            // gutter — 160 chars comfortably fits one line of context.
            const trimmed = anchor.trim().replace(/\s+/g, " ").slice(0, 160);
            const next = [
              ...(activeNote.frontmatter.annotations ?? []),
              { anchor: trimmed, body: "", at: new Date().toISOString() },
            ];
            (async () => {
              try {
                const updated = await api.setAnnotations(activeNote.slug, next);
                invalidateNote(activeNote.slug);
                if (activeNote.slug === activeSlug) setActiveNote(updated);
              } catch (e) {
                setToast(t("appshell.toast.annotationAddError", { error: String(e) }));
              }
            })();
          },
        };
        const selection = editorCtxMenu.text.trim();
        const items = selection
          ? buildRadialSelectionItems(editorCtxMenu.text, callbacks)
          : buildRadialInsertItems(callbacks);
        const Menu = radialMenuOn ? RadialMenu : LinearContextMenu;
        return (
          <Menu
            open
            x={editorCtxMenu.x}
            y={editorCtxMenu.y}
            items={items}
            onClose={close}
          />
        );
      })()}

      <Suspense fallback={null}>
        <WikilinkPicker
          open={wikilinkPickerOpen}
          onClose={() => setWikilinkPickerOpen(false)}
          notes={notes}
          currentSlug={activeSlug ?? undefined}
          onInsert={(text) => {
            window.dispatchEvent(
              new CustomEvent("yarrow:editor-insert-raw", { detail: { text } }),
            );
            // Every wikilink insertion: re-explain reciprocal links + the
            // graph. The user can silence this one modal via its opt-out
            // button, or all guidance via Settings → Guidance.
            setTimeout(() => guidance.trigger("wikilink.inserted"), 300);
          }}
        />
      </Suspense>

      {activityOpen && (
        <Suspense fallback={null}>
          <ActivityHeatmap open={activityOpen} onClose={() => setActivityOpen(false)} />
        </Suspense>
      )}

      {tagGraphOpen && (
        <Suspense fallback={null}>
          <TagGraph
            open={tagGraphOpen}
            onClose={() => setTagGraphOpen(false)}
            graph={graph}
            onPickTag={(tag) => {
              setTagFilter(tag);
              setTagGraphOpen(false);
            }}
          />
        </Suspense>
      )}

      {tableInsertOpen && (
        <Suspense fallback={null}>
          <TableInsertModal
            open={tableInsertOpen}
            onClose={() => setTableInsertOpen(false)}
            onInsert={(markdown) => {
              window.dispatchEvent(
                new CustomEvent("yarrow:editor-insert-raw", {
                  detail: { text: markdown },
                }),
              );
            }}
          />
        </Suspense>
      )}

      {calloutInsertOpen && (
        <Suspense fallback={null}>
          <CalloutInsertModal
            open={calloutInsertOpen}
            onClose={() => setCalloutInsertOpen(false)}
            onInsert={(markdown) => {
              window.dispatchEvent(
                new CustomEvent("yarrow:editor-insert-raw", {
                  detail: { text: markdown, atLineStart: true },
                }),
              );
            }}
          />
        </Suspense>
      )}

      {toast && (() => {
        // 2.1 Warm Toasts: the outer chip takes a subtle tinted wash matching
        // the tone (still over bg-char so it reads against dark editorial
        // paper), and a small dot in the corresponding hue sits beside the
        // text. Plain-string toasts stay "info".
        const tt = typeof toast === "string" ? { text: toast } : toast;
        const tone = (typeof toast === "object" && toast.tone) || "info";
        const dotStyle =
          tone === "success"
            ? { background: "var(--accent2)", boxShadow: "0 0 0 3px rgba(91,122,94,0.22)" }
            : tone === "soft"
              ? { background: "var(--yel)", boxShadow: "0 0 0 3px rgba(122,78,110,0.22)" }
              : { background: "#E8C97A", boxShadow: "0 0 0 3px rgba(232,201,122,0.22)" };
        return (
          <div
            className="fixed bottom-10 z-40 max-w-[480px] bg-char text-bg text-xs px-3.5 py-2 rounded-md shadow-lg animate-fadeIn flex items-center gap-3"
            style={{
              // Center in the visible editor area — slide leftward so the
              // docked scratchpad never covers the toast.
              left: "50%",
              transform: `translateX(calc(-50% - ${scratchpadOpen ? scratchpadWidth / 2 : 0}px))`,
            }}
          >
            <span
              aria-hidden
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={dotStyle}
            />
            <span className="leading-snug">{tt.text}</span>
            {tt.action && (
              <button
                onClick={() => {
                  // Run the action first, then dismiss — running after
                  // dismiss creates a flash of the toast disappearing before
                  // the action result (e.g. the undone note popping back)
                  // registers.
                  tt.action!.run();
                  setToast(null);
                }}
                className="px-2 py-0.5 rounded border border-bg/40 hover:bg-bg/10 font-medium uppercase tracking-wider text-2xs"
              >
                {tt.action.label}
              </button>
            )}
            <button
              onClick={() => setToast(null)}
              className="opacity-70 hover:opacity-100 text-bg"
              aria-label={t("appshell.toast.dismiss")}
            >
              ×
            </button>
          </div>
        );
      })()}

      {/* Status bar */}
      <div className="h-7 bg-s2 border-t border-bd flex items-center px-3 text-2xs text-t2 gap-3 font-mono">
        <span>{t("appshell.status.notes", { count: String(notes.length) })}</span>
        <span className="text-t3">·</span>
        <span>{t("appshell.status.paths", { count: String(pathCount) })}</span>
        <span className="text-t3">·</span>
        <span className="truncate">
          {currentPath
            ? t("appshell.status.onPath", { path: currentPath })
            : t("appshell.status.onPathNone")}
        </span>
        {activeNote && !activeNote.locked && (
          <>
            <span className="text-t3">·</span>
            {selectionWords > 0 ? (
              <span className="text-yeld" title={t("appshell.status.selectedTitle", { count: String(selectionChars) })}>
                {t("appshell.status.selected", { count: String(selectionWords) })}
              </span>
            ) : (
              <span title={t("appshell.status.wordCountTitle", { minutes: String(Math.max(1, Math.round(noteWordCount / 220))) })}>
                {t(
                  noteWordCount === 1
                    ? "appshell.status.wordCountSingle"
                    : "appshell.status.wordCountPlural",
                  { count: noteWordCount.toLocaleString() },
                )}
              </span>
            )}
          </>
        )}
        <span className="ml-auto flex items-center gap-2 truncate">
          {quotaBlock !== null && !quotaModalOpen && (
            <button
              type="button"
              onClick={() => setQuotaModalOpen(true)}
              title={t("appshell.status.overStorageTitle")}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
              {t("appshell.status.overStorage")}
            </button>
          )}
          {/* 2.1 H4 — air-gap visibility. When a remote is configured AND
              the workspace has private notes, surface the count next to
              the sync pill so it's never a surprise that "sync" excludes
              clinical/private material. Stays silent when there's
              nothing to disclose. */}
          {remotePresent && privateNoteCount > 0 && (
            <span
              title={t(
                privateNoteCount === 1
                  ? "appshell.status.offServerSingleTitle"
                  : "appshell.status.offServerPluralTitle",
                { count: String(privateNoteCount) },
              )}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
              style={{
                color: "#c97a3a",
                borderColor: "rgba(201,122,58,0.35)",
                background: "rgba(201,122,58,0.08)",
              }}
            >
              <span style={{ fontSize: 11, lineHeight: 1 }}>⊘</span>
              {t("appshell.status.offServerCount", { count: String(privateNoteCount) })}
            </span>
          )}
          <SyncStatusPill status={syncStatus} lastSyncedAt={lastSyncedAt} />
        </span>
      </div>

      {paletteOpen && (
        <L>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            notes={notes}
            paths={(collectionsView?.collections ?? []).map((c) => ({
              name: c.name,
              is_current: c.name === currentPath,
              last_activity: c.created_at || null,
            }))}
            currentPath={currentPath}
            onSelectNote={selectSlug}
            onSwitchPath={handleSwitchPath}
            onNewNote={handleCreateNote}
            onNewDirection={() => setNewPathOpen(true)}
            onOpenScratchpad={() => setScratchpadOpen(true)}
            onToggleFocus={() => setFocusMode((f) => !f)}
            onSync={handleSync}
            onConnect={() => setConnectOpen(true)}
            onOpenHistory={openHistory}
            onJumpToday={() => handleOpenDaily()}
            tags={tagCounts}
            onFilterTag={(t) => setTagFilter(t)}
            templates={templates.map((t) => ({ name: t.name, label: t.label }))}
            onNewFromTemplate={handleCreateFromTemplate}
            onOpenTemplatePicker={() => setTemplatePickerOpen(true)}
            onOpenJournalKits={() => setKitsPickerOpen(true)}
            encryption={encryption}
            activeIsEncrypted={!!activeNote?.encrypted}
            onLockEncryption={handleLockEncryption}
            onUnlockEncryption={() => requestUnlock()}
            onEncryptActiveNote={handleEncryptActiveNote}
            onDecryptActiveNote={handleDecryptActiveNote}
            onOpenSecurity={() => setSettingsOpen({ open: true, tab: "security" })}
            onSwitchWorkspace={() => setWorkspaceSwitcherOpen(true)}
            onOpenNewWindow={() => api.openNewWindow().catch((e) => setToast(t("appshell.toast.openWindowError", { error: String(e) })))}
            onFindReplace={() => setFindReplaceOpen(true)}
            onPrintActiveNote={activeSlug ? () => printActiveNote(activeSlug) : undefined}
            onOpenTrash={() => setTrashOpen(true)}
            onImportObsidian={() => setObsidianImportOpen(true)}
            onComparePaths={() => setPathCompareOpen(true)}
            onOpenDecisionMatrix={() => setDecisionMatrixOpen(true)}
            onOpenActivity={() => setActivityOpen(true)}
            onOpenTagGraph={() => setTagGraphOpen(true)}
            onInsertTable={() => setTableInsertOpen(true)}
            mappingEnabled={mappingEnabled}
          />
        </L>
      )}

      {switcherOpen && (
        <L>
          <QuickSwitcher
            open={switcherOpen}
            onClose={() => setSwitcherOpen(false)}
            notes={notes}
            activeSlug={activeSlug}
            onSelect={selectSlug}
          />
        </L>
      )}

      {settingsOpen.open && (
        <L>
          <Settings
            open={settingsOpen.open}
            initialTab={settingsOpen.tab}
            onClose={() => setSettingsOpen({ open: false })}
            workspacePath={workspacePath}
            config={config}
            onConfigChange={setConfig}
            onSyncNow={handleSync}
            onCloseWorkspace={closeWorkspace}
            onImport={() => {
              setSettingsOpen({ open: false });
              setObsidianImportOpen(true);
            }}
          />
        </L>
      )}

      <ForkMoment
        pathName={forkMoment}
        onDone={() => setForkMoment(null)}
      />

      <QuotaBlockedModal
        open={quotaModalOpen && quotaBlock !== null}
        blockInfo={quotaBlock}
        onClose={() => setQuotaModalOpen(false)}
        onDiscarded={(out) => {
          // Discard just succeeded — immediately retry sync so the
          // user sees the green "synced" status instead of having to
          // click the sync button a second time.
          setToast({
            text: t(
              out.commits_ahead === 1
                ? "appshell.toast.discardSyncingSingle"
                : "appshell.toast.discardSyncingPlural",
              { count: String(out.commits_ahead) },
            ),
            tone: "soft",
            ttlMs: 4000,
          });
          void (async () => {
            try {
              const r = await api.sync();
              if (r.ok) {
                setSyncStatus("synced");
                setSyncMessage("synced");
                setQuotaBlock(null);
                setQuotaModalOpen(false);
              } else {
                setSyncStatus("error");
                setSyncMessage(r.message);
              }
            } catch (e) {
              setSyncStatus("error");
              setSyncMessage(String(e));
            }
          })();
        }}
        onOpenManageStorage={() => {
          setQuotaModalOpen(false);
          setSettingsOpen({ open: true, tab: "storage" });
        }}
      />

      <GuidanceHost />

      <MainNotePrompt
        open={mainNotePromptOpen}
        onClose={() => setMainNotePromptOpen(false)}
        onConfigChange={setConfig}
        onAfterSet={(slug) => selectSlug(slug)}
      />

      {editConditionFor && (
        <L>
          <ConditionEditor
            branch={editConditionFor}
            initial={pathMetaMap[editConditionFor]?.condition || ""}
            onSave={async (next) => {
              const name = editConditionFor;
              setEditConditionFor(null);
              if (!name) return;
              try {
                await api.setPathCondition(name, next);
                const topo = await fetchTopology();
                setTopology(topo);
                await refreshPathAwareness();
              } catch (e) {
                console.error("save condition failed", e);
              }
            }}
            onCancel={() => setEditConditionFor(null)}
          />
        </L>
      )}

      {railOverlay === "paths" && (
        <L>
          <PathsPane
            notes={notes}
            currentPathName={currentPath}
            onOpenDecisionMatrix={() => setDecisionMatrixOpen(true)}
            onClose={() => setRailOverlay(null)}
            onNavigate={(slug) => { selectSlug(slug); setRailOverlay(null); }}
            onSwitchToRoot={(rootName) => handleSwitchPath(rootName)}
            onLinksChanged={async () => {
              // A path-add auto-wrote a typed link. Re-pull the graph and
              // orphan index so the Map reflects it; also re-read the
              // active note in case its frontmatter just changed.
              const [g, orphansList] = await Promise.all([
                fetchGraph(),
                fetchOrphans(),
              ]);
              setGraph(g);
              setOrphanSet(new Set(orphansList));
              if (activeSlug) {
                try {
                  const n = await api.readNote(activeSlug);
                  setActiveNote(n);
                } catch { /* note may have been deleted — ignore */ }
              }
            }}
            onOpenMap={(collectionName, focusSlug) => {
              // Shows the connection graph filtered to the path's members,
              // optionally focused on a specific slug. We reuse the existing
              // "map" rail overlay — the graph already accepts a focal slug.
              if (focusSlug) selectSlug(focusSlug);
              setMapFilter({ collectionName });
              setRailOverlay("map");
            }}
            onCollectionsChanged={(v) => setCollectionsView(v)}
          />
        </L>
      )}

      {compareSession && (
        <L>
          <PathDiff
            currentPath={currentPath}
            otherPath={compareSession}
            onClose={() => setCompareSession(null)}
          />
        </L>
      )}

      {conflictSession && (
        <L>
          <ConflictResolver
            relpaths={conflictSession.relpaths}
            currentPath={conflictSession.currentPath}
            otherPath={conflictSession.otherPath}
            onResolvedAll={onConflictsResolved}
            onAbort={onConflictAbort}
          />
        </L>
      )}

      <Modal
        open={newPathOpen}
        onClose={() => {
          setNewPathOpen(false);
          setNewPathName("");
          setNewPathCondition("");
          setNewPathFrom("");
        }}
        title={t("appshell.newPath.title")}
      >
        {(() => {
          const introParts = t("appshell.newPath.intro", {
            root: "{{ROOT}}",
          }).split("{{ROOT}}");
          return (
            <p className="text-xs text-t2 mb-3 leading-relaxed">
              {introParts[0]}
              <span className="font-medium text-yeld">{collectionsView?.root || "main"}</span>
              {introParts[1] ?? ""}
            </p>
          );
        })()}

        <div className="mb-4 px-3 py-2 bg-yelp/40 border border-yel/40 rounded-md flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-yel shrink-0" />
          {(() => {
            const trunkParts = t("appshell.newPath.trunkHint", {
              root: "{{ROOT}}",
            }).split("{{ROOT}}");
            return (
              <span className="text-2xs text-t2 leading-snug">
                {trunkParts[0]}
                <span className="font-medium text-yeld">
                  {collectionsView?.root || "main"}
                </span>
                {trunkParts[1] ?? ""}
              </span>
            );
          })()}
        </div>

        <label className="block text-2xs uppercase tracking-[0.18em] font-mono text-t3 mb-1.5">
          {t("appshell.newPath.questionLabel")}
        </label>
        <textarea
          autoFocus
          value={newPathCondition}
          onChange={(e) => setNewPathCondition(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleCreatePath();
            }
          }}
          rows={2}
          placeholder={t("appshell.newPath.placeholder")}
          className="w-full px-4 py-2.5 bg-bg-soft border border-bd rounded-md text-char font-serif italic placeholder:not-italic placeholder:text-t3/70 text-[15px] resize-none leading-snug"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {[
            t("appshell.newPath.suggestion1"),
            t("appshell.newPath.suggestion2"),
            t("appshell.newPath.suggestion3"),
            t("appshell.newPath.suggestion4"),
          ].map((s) => (
            <button
              key={s}
              onClick={() => setNewPathCondition(s)}
              className="text-2xs px-2 py-0.5 bg-s2 text-t2 rounded-full hover:bg-s3 hover:text-char transition"
            >
              {s}
            </button>
          ))}
        </div>

        <details className="mt-4 group">
          <summary className="cursor-pointer text-2xs text-t3 hover:text-char select-none">
            {t("appshell.newPath.nameYourselfSummary")}
          </summary>
          <input
            value={newPathName}
            onChange={(e) => setNewPathName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreatePath(); }}
            placeholder={newPathCondition ? t("appshell.newPath.namePlaceholderAuto") : t("appshell.newPath.namePlaceholderEmpty")}
            className="mt-2 w-full px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs"
          />
        </details>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => {
              setNewPathOpen(false);
              setNewPathName("");
              setNewPathCondition("");
              setNewPathFrom("");
            }}
          >
            {t("appshell.newPath.notNow")}
          </button>
          <button
            className="btn-yel px-4 py-1.5 text-sm rounded-md"
            onClick={handleCreatePath}
            disabled={!newPathCondition.trim() && !newPathName.trim()}
          >
            {t("appshell.newPath.startExploring")}
          </button>
        </div>
        <div className="mt-3 text-2xs text-t3 text-center italic">
          {t("appshell.newPath.tipShortcut")}
        </div>
      </Modal>

      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title={t("appshell.connect.title")}
      >
        <label className="text-xs text-t2 block mb-1">{t("appshell.connect.toLabel")}</label>
        <select
          value={connectTarget}
          onChange={(e) => setConnectTarget(e.target.value)}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char mb-3"
        >
          <option value="">{t("appshell.connect.choosePlaceholder")}</option>
          {notes.filter((n) => n.slug !== activeSlug).map((n) => (
            <option key={n.slug} value={n.slug}>{n.title}</option>
          ))}
        </select>
        <label className="text-xs text-t2 block mb-1">{t("appshell.connect.asLabel")}</label>
        <select
          value={connectType}
          onChange={(e) => setConnectType(e.target.value as LinkType)}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        >
          <option value="supports">{t("appshell.connect.typeSupports")}</option>
          <option value="challenges">{t("appshell.connect.typeChallenges")}</option>
          <option value="came-from">{t("appshell.connect.typeCameFrom")}</option>
          <option value="open-question">{t("appshell.connect.typeOpenQuestion")}</option>
        </select>
        <p className="text-2xs text-t3 mt-2">
          {t("appshell.connect.reverseHint")}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConnectOpen(false)}
          >
            {t("appshell.connect.cancel")}
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={handleAddConnection}
            disabled={!connectTarget}
          >
            {t("appshell.connect.connect")}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!confirmState}
        onClose={() => setConfirmState(null)}
        title={confirmState?.title}
      >
        <p className="text-sm text-t2 mb-4">{confirmState?.body}</p>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConfirmState(null)}
          >
            {t("appshell.confirm.keepIt")}
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onClick={confirmState?.onConfirm}
          >
            {t("appshell.confirm.yesDelete")}
          </button>
        </div>
      </Modal>

      <Modal
        open={newNoteOpen}
        onClose={() => setNewNoteOpen(false)}
        width="w-[640px] max-w-[94vw]"
      >
        {/* 2.1 redesign: three big route buttons up top, then the
            title input. The kits + custom-templates pickers each live
            in their own modal — that keeps this surface a clean "what
            kind of note?" decision instead of a scrolling tile grid
            that grew unwieldy as the kit roster expanded.
            • Blank note → keep using this modal, fill in the title,
              hit create.
            • Kits → close this, open the kits picker (curated, grouped).
            • Your templates → close this, open the user-authored
              templates picker. Hidden when the user has none. */}
        <div className="flex flex-col">
          <div className="shrink-0">
            <div className="font-serif text-[28px] text-char tracking-tight leading-tight">
              {t("appshell.newNote.title")}
            </div>
            <div className="font-serif italic text-sm text-t2 mt-1">
              {t("appshell.newNote.subtitle")}
            </div>
          </div>

          <div className={`mt-5 grid ${customTemplatesCount > 0 ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
            <NewNoteRouteTile
              active={newNoteTemplate === null}
              onClick={() => setNewNoteTemplate(null)}
              title={t("appshell.newNote.tileBlankTitle")}
              sub={t("appshell.newNote.tileBlankSub")}
              glyph={<BlankGlyph />}
            />
            <NewNoteRouteTile
              active={false}
              onClick={() => {
                setNewNoteOpen(false);
                setKitsPickerOpen(true);
              }}
              title={t("appshell.newNote.tileKitsTitle")}
              sub={t("appshell.newNote.tileKitsSub")}
              glyph={<KitsRouteGlyph />}
            />
            {customTemplatesCount > 0 && (
              <NewNoteRouteTile
                active={false}
                onClick={() => {
                  setNewNoteOpen(false);
                  setCustomTemplatesOpen(true);
                }}
                title={t("appshell.newNote.tileTemplatesTitle")}
                sub={t(
                  customTemplatesCount === 1
                    ? "appshell.newNote.tileTemplatesSubSingle"
                    : "appshell.newNote.tileTemplatesSubPlural",
                  { count: String(customTemplatesCount) },
                )}
                glyph={<CustomTemplatesRouteGlyph />}
              />
            )}
          </div>

          <div className="mt-5 pt-5 border-t border-bd">
            <label className="text-2xs uppercase tracking-wider text-t3 font-semibold block mb-2">
              {t("appshell.newNote.titleLabel", { path: currentPath || "main" })}
            </label>
            <input
              autoFocus
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmCreateNote(); }}
              placeholder={t("appshell.newNote.titlePlaceholder")}
              className="w-full px-4 py-2.5 bg-bg border border-bd rounded-full text-sm text-char placeholder:text-t3 focus:outline-none focus:border-bd2 transition"
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              className="px-3 py-1.5 text-sm text-t2 hover:text-char"
              onClick={() => setNewNoteOpen(false)}
            >
              {t("appshell.newNote.cancel")}
            </button>
            <button
              className="btn-yel px-4 py-2 text-sm rounded-full"
              onClick={confirmCreateNote}
              disabled={!newNoteTitle.trim()}
            >
              {t("appshell.newNote.createBlank")}
            </button>
          </div>
        </div>
      </Modal>

      {customTemplatesOpen && (
        <L>
          <CustomTemplatesModal
            open={customTemplatesOpen}
            templates={templates}
            onClose={() => setCustomTemplatesOpen(false)}
            onPick={async (name, title) => {
              setCustomTemplatesOpen(false);
              try {
                const n = await api.createFromTemplate(name, title);
                const list = await api.listNotes();
                setNotes(list);
                setActiveSlug(n.slug);
                setGraph(await fetchGraph());
                setOrphanSet(new Set(await fetchOrphans()));
                setToast({ text: t("appshell.toast.createdTitle", { title }), tone: "success" });
              } catch (e) {
                setToast({ text: t("appshell.toast.createFromTemplateGenericError", { error: String(e) }), tone: "soft" });
              }
            }}
          />
        </L>
      )}

      <Modal
        open={!!pendingTemplate}
        onClose={() => { setPendingTemplate(null); setTemplateTitle(""); }}
        title={t("appshell.templateName.title", {
          label: templates.find((tpl) => tpl.name === pendingTemplate)?.label ?? pendingTemplate ?? "",
        })}
      >
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          {t("appshell.templateName.body")}
        </p>
        <input
          autoFocus
          value={templateTitle}
          onChange={(e) => setTemplateTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmCreateFromTemplate(); }}
          placeholder={t("appshell.templateName.placeholder")}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => { setPendingTemplate(null); setTemplateTitle(""); }}
          >
            {t("appshell.templateName.cancel")}
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={confirmCreateFromTemplate}
            disabled={!templateTitle.trim()}
          >
            {t("appshell.templateName.create")}
          </button>
        </div>
      </Modal>

      {kitsPickerOpen && (
        <L>
          <JournalKits
            open={kitsPickerOpen}
            templates={templates}
            onClose={() => setKitsPickerOpen(false)}
            onPick={async (name, title) => {
              setKitsPickerOpen(false);
              try {
                const n = await api.createFromTemplate(name, title);
                const list = await api.listNotes();
                setNotes(list);
                setActiveSlug(n.slug);
                setGraph(await fetchGraph());
                setOrphanSet(new Set(await fetchOrphans()));
                setToast({ text: t("appshell.toast.startedKit", { title }), tone: "success" });
              } catch (e) {
                setToast({ text: t("appshell.toast.createFromKitError", { error: String(e) }), tone: "soft" });
              }
            }}
          />
        </L>
      )}

      <Modal
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        title={t("appshell.templatePicker.title")}
      >
        {templates.length === 0 ? (
          <p className="text-sm text-t2">{t("appshell.templatePicker.empty")}</p>
        ) : (
          <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
            {templates.map((tpl) => (
              <li key={tpl.name}>
                <button
                  onClick={() => {
                    setTemplatePickerOpen(false);
                    handleCreateFromTemplate(tpl.name);
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-s2 flex items-center gap-2"
                >
                  <span className="text-char">{tpl.label}</span>
                  {tpl.is_daily && (
                    <span className="text-2xs px-1.5 py-px bg-yelp text-yeld rounded">{t("appshell.templatePicker.dailyBadge")}</span>
                  )}
                  <span className="ml-auto text-2xs text-t3 font-mono">{tpl.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {quickCaptureOpen && (
        <L>
          <QuickCapture
            open={quickCaptureOpen}
            onClose={() => setQuickCaptureOpen(false)}
          />
        </L>
      )}

      {unlockOpen && (
        <L>
          <UnlockPrompt
            open={unlockOpen}
            reason={unlockReason}
            onUnlocked={onUnlocked}
            onClose={() => setUnlockOpen(false)}
          />
        </L>
      )}

      <L>
        <OnboardingHints workspacePath={workspacePath} />
      </L>

    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="flex-1 overflow-hidden px-12 py-12 2xl:px-24 animate-fadeIn">
      <div className="w-full max-w-[680px] xl:max-w-[820px] 2xl:max-w-[960px] mx-auto">
        <div className="h-3 w-40 rounded bg-s2 mb-6 animate-pulse2" />
        <div className="h-10 w-3/5 rounded bg-s2 mb-8 animate-pulse2" />
        <div className="space-y-3">
          <div className="h-3 rounded bg-s2/80 animate-pulse2" />
          <div className="h-3 rounded bg-s2/80 w-11/12 animate-pulse2" />
          <div className="h-3 rounded bg-s2/80 w-5/6 animate-pulse2" />
          <div className="h-3 rounded bg-s2/80 w-2/3 animate-pulse2" />
        </div>
      </div>
    </div>
  );
}

function LockedNoteHero({
  onUnlock,
  onUnlocked,
}: {
  title: string;
  onUnlock: () => void;
  onUnlocked: () => void | Promise<void>;
}) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true); setError(null);
    try {
      await api.unlockEncryption(password);
      setPassword("");
      // Hand control back to AppShell: it invalidates the prefetch cache
      // (which still held the locked Note) and re-reads with the session
      // key so the hero gets replaced by the real editor.
      await onUnlocked();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-[420px] max-w-full bg-bg-soft border border-bd rounded-2xl px-8 py-9 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yelp text-yeld mb-5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
            <path d="M8 10.5V7a4 4 0 1 1 8 0v3.5" />
          </svg>
        </div>
        <div className="font-serif text-2xl text-char mb-2 tracking-tight">
          {t("appshell.locked.title")}
        </div>
        <p className="text-xs text-t2 mb-6 leading-relaxed font-serif italic">
          {t("appshell.locked.body").split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="flex items-center gap-2 mb-4"
        >
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("appshell.locked.passphrasePlaceholder")}
            className="flex-1 px-4 py-2 bg-bg border border-bd rounded-full text-sm text-char font-mono placeholder:text-t3 focus:outline-none focus:border-bd2 transition"
          />
          <button
            type="submit"
            disabled={!password || busy}
            className="btn-yel px-4 py-2 rounded-full text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? t("appshell.locked.unlockBusy") : t("appshell.locked.unlock")}
          </button>
        </form>

        {error && (
          <div className="text-2xs text-danger mb-3">{error}</div>
        )}

        <div className="flex items-center justify-center gap-3 text-2xs text-t3 font-mono uppercase tracking-wider">
          <span>{t("appshell.locked.localLocks")}</span>
          <span className="w-1 h-1 rounded-full bg-t3" />
          <span>{t("appshell.locked.noNetwork")}</span>
          <span className="w-1 h-1 rounded-full bg-t3" />
          <span>{t("appshell.locked.noAccounts")}</span>
        </div>

        <button
          onClick={onUnlock}
          className="mt-5 text-2xs text-t3 hover:text-t2 transition"
        >
          {t("appshell.locked.forgotPassphrase")}
        </button>
      </div>
    </div>
  );
}

function EmptyWorkspaceHero({
  onNewNote,
  onOpenPalette,
}: {
  onNewNote: () => void;
  onOpenPalette: () => void;
}) {
  const t = useT();
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="font-serif text-3xl text-char mb-3 tracking-tight">
          {t("appshell.empty.title")}
        </div>
        <p className="text-sm text-t2 mb-6 leading-relaxed">
          {t("appshell.empty.body")}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={onNewNote}
            className="btn-yel px-4 py-2 rounded-md text-sm"
          >
            {t("appshell.empty.startFirstNote")}
          </button>
          <button
            onClick={onOpenPalette}
            className="inline-flex items-center gap-2 px-4 py-2 bg-s2 text-ch2 rounded-md hover:bg-s3 text-sm transition"
          >
            <SearchIcon size={14} />
            <span>{t("appshell.empty.findNote")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncStatusPill({
  status,
  lastSyncedAt,
}: {
  status: SyncStatus;
  lastSyncedAt: number | null;
}) {
  const t = useT();
  const { color, label, pulse } = syncStatusPresentation(status, t);
  // Tick every 15 s so the "3 min ago" label keeps up with wall time
  // without us having to manage time-of-day in AppShell's render path.
  // Browser throttles setInterval in hidden tabs, so this stays cheap
  // when the user is off the window.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (lastSyncedAt == null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 15_000);
    return () => window.clearInterval(id);
  }, [lastSyncedAt]);
  const showAge =
    lastSyncedAt != null && status !== "syncing" && status !== "no-remote";
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot color={color} size={7} className={pulse ? "animate-pulse2" : ""} />
      <span>{label}</span>
      {showAge && (
        <span className="text-t3" title={new Date(lastSyncedAt).toLocaleString()}>
          {/* relativeTime takes unix *seconds* when passed a number
              (see src/lib/format.ts); lastSyncedAt is ms from Date.now(). */}
          · {relativeTime(Math.floor(lastSyncedAt / 1000))}
        </span>
      )}
    </span>
  );
}

function mapNeighborCount(graph: Graph | null, slug: string | null): number {
  if (!graph || !slug) return 0;
  const set = new Set<string>();
  for (const l of graph.links) {
    if (l.from === slug) set.add(l.to);
    else if (l.to === slug) set.add(l.from);
  }
  return set.size;
}

/** Big route tile for the new-note modal. Shown at three sizes — Blank,
 *  Kits, Your templates — and acts as a top-level navigation choice
 *  rather than a per-template selector. */
function NewNoteRouteTile({
  active,
  onClick,
  title,
  sub,
  glyph,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  glyph: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tile-press text-left flex flex-col gap-3 p-5 rounded-xl border min-h-[150px] ${
        active
          ? "border-yel bg-yelp shadow-sm"
          : "border-bd bg-bg hover:bg-yelp/30 hover:border-yel"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          active ? "bg-yel/25 text-yeld" : "bg-s2 text-yeld"
        }`}
      >
        {glyph}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-serif text-[17px] text-char leading-tight">
          {title}
        </div>
        <div className="text-2xs text-t2 mt-1.5 leading-relaxed">
          {sub}
        </div>
      </div>
    </button>
  );
}

function KitsRouteGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="12" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="12" width="7" height="7" rx="1.2" />
      <rect x="12" y="12" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function CustomTemplatesRouteGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h14" />
      <path d="M4 11h14" />
      <path d="M4 17h9" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

function BlankGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h7L17 7v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M12 3v4h5" />
    </svg>
  );
}

function syncStatusPresentation(
  s: SyncStatus,
  t: ReturnType<typeof useT>,
): {
  color: string;
  label: string;
  pulse: boolean;
} {
  switch (s) {
    case "synced":    return { color: "var(--yel)",    label: t("appshell.sync.synced"), pulse: false };
    case "pending":   return { color: "var(--accent2)", label: t("appshell.sync.localChanges"), pulse: false };
    case "syncing":   return { color: "var(--yel)",    label: t("appshell.sync.syncing"), pulse: true };
    case "error":     return { color: "var(--danger)", label: t("appshell.sync.failed"), pulse: false };
    case "no-remote": return { color: "var(--t3)",     label: t("appshell.sync.notAnywhere"), pulse: false };
  }
}

/** Compact left-sidebar footer action — small icon + label, quiet until
 *  hover. Used for Journal / Activity / Trash so they stay one click away
 *  without cluttering the note list scroll area. */
function SidebarUtilityButton({
  onClick,
  title,
  label,
  children,
}: {
  onClick: () => void;
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] text-t3 hover:text-char hover:bg-s2 transition"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
