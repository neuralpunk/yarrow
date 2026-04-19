import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/tauri";
import { useTheme } from "../lib/theme";
import { openQuestions } from "../lib/forkDetection";
import { todayIso } from "../lib/format";
import { prefetchHeavyChunks } from "../lib/prefetch";
import { getCachedOrReadNote, invalidateAllNotes, invalidateNote } from "../lib/notePrefetch";
import { SearchIcon, StatusDot, ScratchpadIcon, ChevronDownIcon } from "../lib/icons";
import { useShowRawMarkdown, useEditorFont } from "../lib/editorPrefs";
// Imported for its module-level side effect: applies the saved UI font
// and UI scale to the document before first paint, so chrome doesn't
// flash the defaults on cold start.
import "../lib/uiPrefs";
import { SK } from "../lib/platform";
import { workspaceAccent } from "../lib/workspaceAccent";
import RightRail, { type RailOverlay } from "./RightRail";
import FloatingDirectionCTA from "./Editor/FloatingDirectionCTA";
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
import JournalList from "./LeftSidebar/JournalList";
import PathMinimap from "./LeftSidebar/PathMinimap";
import TagList from "./LeftSidebar/TagList";
import Toolbar from "./Editor/Toolbar";
import LinkedNotesList from "./RightSidebar/LinkedNotesList";
import OpenQuestions from "./RightSidebar/OpenQuestions";
import Transclusions from "./RightSidebar/Transclusions";
import Modal from "./Modal";
import ForkMoment from "./ForkMoment";

// Heavy or rarely-used screens: lazy so they're not in the first paint.
const HistorySlider    = lazy(() => import("./Editor/HistorySlider"));
const ConnectionGraph  = lazy(() => import("./RightSidebar/ConnectionGraph"));
const Scratchpad       = lazy(() => import("./Scratchpad"));
const QuickCapture     = lazy(() => import("./QuickCapture"));
const Settings         = lazy(() => import("./Settings"));
const CommandPalette   = lazy(() => import("./CommandPalette"));
const QuickSwitcher    = lazy(() => import("./QuickSwitcher"));
const ConflictResolver = lazy(() => import("./ConflictResolver"));
const PathDiff         = lazy(() => import("./PathDiff"));
const PathsPane        = lazy(() => import("./PathsPane"));
const ConditionEditor  = lazy(() => import("./Paths/ConditionEditor"));
const UnlockPrompt     = lazy(() => import("./UnlockPrompt"));
const WorkspaceSwitcher = lazy(() => import("./WorkspaceSwitcher"));
// The editor ships its own CodeMirror chunk. Keeping it lazy + idle-warmed
// shaves the CM parse cost out of first paint without hurting time-to-edit.
const NoteEditor       = lazy(() => import("./Editor/NoteEditor"));

/**
 * Tiny Suspense wrapper for lazy-loaded modals. Each overlay gets its own
 * boundary so that suspending the Settings import (for example) doesn't
 * collapse the whole app shell to a fallback.
 */
function L({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

type SyncStatus = "synced" | "pending" | "syncing" | "error" | "no-remote";

interface Props {
  workspacePath: string;
  onClose: () => void;
  onSwitchWorkspace: (path: string) => void;
}

export default function AppShell({ workspacePath, onClose, onSwitchWorkspace }: Props) {
  useTheme(); // applies theme class to <html>
  useEditorFont(); // applies editor font-family CSS var to <html>
  const [showRawMarkdown] = useShowRawMarkdown();

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
  const [currentBody, setCurrentBody] = useState<string>("");
  const [focusMode, setFocusMode] = useState(false);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const workspaceChipRef = useRef<HTMLButtonElement>(null);
  const [selectionWords, setSelectionWords] = useState(0);
  const [selectionChars, setSelectionChars] = useState(0);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
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
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("pending");
  const [, setSyncMessage] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [jumpSignal, setJumpSignal] = useState<{ line: number; nonce: number } | undefined>();

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
    { open: boolean; tab?: "appearance" | "writing" | "templates" | "sync" | "security" | "workspace" | "shortcuts" | "about" }
  >({ open: false });
  const [confirmState, setConfirmState] = useState<{
    title: string;
    body: string;
    onConfirm: () => void;
  } | null>(null);
  const [forkMoment, setForkMoment] = useState<string | null>(null);
  const [dailyEntries, setDailyEntries] = useState<NoteSummary[]>([]);
  const [toast, setToast] = useState<
    | string
    | { text: string; action: { label: string; run: () => void }; ttlMs?: number }
    | null
  >(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [encryption, setEncryption] = useState<EncryptionStatus>({
    enabled: false,
    unlocked: false,
    idle_timeout_secs: 900,
  });
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState<string | undefined>(undefined);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
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
  const [scratchpadReloadNonce, setScratchpadReloadNonce] = useState(0);
  /** When non-null, renders the global ConditionEditor focused on this
   *  branch. Used by the path pill in the toolbar and the paths graph. */
  const [editConditionFor, setEditConditionFor] = useState<string | null>(null);
  /** When set, the "map" rail overlay filters the ConnectionGraph to the
   *  named path-collection's member slugs. Null = show the full vault. */
  const [mapFilter, setMapFilter] = useState<{ collectionName: string } | null>(null);

  const refreshAll = useCallback(async () => {
    const [cfg, list, pathList, cur, g, topo, orphansList, merging, daily, tpls, encStatus] =
      await Promise.all([
        api.readConfig(),
        api.listNotes(),
        api.listPaths(),
        api.currentPath(),
        api.getGraph(),
        api.branchTopology(),
        api.orphans(),
        api.mergeState(),
        api.listDaily(6),
        api.listTemplates().catch(() => []),
        api.encryptionStatus().catch(() => ({ enabled: false, unlocked: false, idle_timeout_secs: 900 })),
      ]);
    setTemplates(tpls);
    setEncryption(encStatus);
    setConfig(cfg);
    setNotes(list);
    setPaths(pathList);
    setCurrentPath(cur);
    setGraph(g);
    setTopology(topo);
    setOrphanSet(new Set(orphansList));
    setDailyEntries(daily);
    setSyncStatus(cfg.sync.remote_url ? "pending" : "no-remote");
    setFocusMode(cfg.preferences.focus_mode_default);
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
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // Load path-awareness: v2 paths are *collections*, not branches. One
  // fetch drives: the Paths graph, the left-sidebar minimap, the wikilink
  // path chip, and the toolbar. Refreshed after any membership change.
  const refreshPathAwareness = useCallback(async () => {
    try {
      const v = await api.listPathCollections();
      setCollectionsView(v);
    } catch (e) {
      console.warn("path awareness refresh failed", e);
    }
  }, []);

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

  /** Flatten collections to the `pathNotes` shape the wikilink popover
   *  expected from the v1 model — keeps that component unchanged. */
  const pathNotes = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!collectionsView) return out;
    for (const c of collectionsView.collections) out[c.name] = [...c.members];
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

  // Warm heavy modal chunks during idle time so they're instant on first open.
  useEffect(() => { prefetchHeavyChunks(); }, []);

  // Keep the editor font-size CSS variable in sync with the user's preference.
  useEffect(() => {
    const px = config?.preferences.editor_font_size ?? 16;
    document.documentElement.style.setProperty("--editor-font-size", `${px}px`);
  }, [config?.preferences.editor_font_size]);

  useEffect(() => {
    if (activeSlug == null && notes.length > 0) {
      setActiveSlug(notes[0].slug);
    }
  }, [notes, activeSlug]);

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

  useEffect(() => {
    if (!activeSlug) { setActiveNote(null); return; }
    // Guard against fast slug-switches landing a stale note into state: if the
    // user clicked away before this read resolved, drop the result on the floor.
    let alive = true;
    getCachedOrReadNote(activeSlug).then((n) => {
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
  }, [activeSlug, currentPath, encryption.unlocked]);

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
          const [cur, pathList, topo, g, list, daily] = await Promise.all([
            api.currentPath(),
            api.listPaths(),
            api.branchTopology(),
            api.getGraph(),
            api.listNotes(),
            api.listDaily(6),
          ]);
          if (myEpoch !== asyncEpoch.current) return;
          setCurrentPath(cur);
          setPaths(pathList);
          setTopology(topo);
          setGraph(g);
          setNotes(list);
          setDailyEntries(daily);
          setToast(`Journal lives on main — jumped there from "${switched_from}"`);
        } else {
          const daily = await api.listDaily(6);
          if (myEpoch !== asyncEpoch.current) return;
          setDailyEntries(daily);
        }
        setActiveSlug(note.slug);
        setActiveNote(note);
        setCurrentBody(note.body);
      } catch (e) {
        if (myEpoch === asyncEpoch.current) console.error("open daily failed", e);
      }
    },
    [],
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
    setToast("Locked — encrypted notes need your password");
  }, [activeSlug, activeNote?.encrypted, broadcastEncryptionChanged]);

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
      setToast("Enable encryption first in Settings → Security");
      setSettingsOpen({ open: true, tab: "security" });
      return;
    }
    if (!encryption.unlocked) {
      requestUnlock("Unlock to encrypt this note.");
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
        `🔒 Encrypted "${n.frontmatter.title || slug}" — every past version in history was re-sealed with the same key.`
      );
    } catch (e) {
      setToast(`Couldn't encrypt: ${e}`);
    }
  }, [activeSlug, encryption.enabled, encryption.unlocked, requestUnlock]);

  const handleDecryptNoteBySlug = useCallback(async (slug: string) => {
    if (!encryption.unlocked) {
      requestUnlock("Unlock to decrypt this note.");
      return;
    }
    try {
      const n = await api.decryptNote(slug);
      if (activeSlug === slug) {
        setActiveNote(n);
        setCurrentBody(n.body);
      }
      setNotes(await api.listNotes());
      setToast(`Decrypted "${n.frontmatter.title || slug}"`);
    } catch (e) {
      setToast(`Couldn't decrypt: ${e}`);
    }
  }, [activeSlug, encryption.unlocked, requestUnlock]);

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
          setToast("Session locked after idle — unlock to continue");
        }
      } catch {}
    }, 60_000);
    return () => window.clearInterval(id);
  }, [encryption.enabled, encryption.unlocked, refreshEncryption]);

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
      setGraph(await api.getGraph());
      setOrphanSet(new Set(await api.orphans()));
    } catch (e) {
      console.error("create from template failed", e);
      setToast(`Couldn't create note from template: ${e}`);
    }
  }, [pendingTemplate, templateTitle]);

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
    setGraph(await api.getGraph());
    setOrphanSet(new Set(await api.orphans()));
  }, [newNoteTitle, newNoteTemplate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "\\") { e.preventDefault(); setFocusMode((f) => !f); return; }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); return; }
      if (mod && !e.shiftKey && (e.key.toLowerCase() === "o" || e.key.toLowerCase() === "p")) {
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
    const t = setTimeout(() => setToast(null), ttl);
    return () => clearTimeout(t);
  }, [toast]);

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

  // Right-click-with-selection in the editor: NoteEditor fires this event
  // with the selected text + pointer position. We host the menu at shell
  // level so it can reach the scratchpad API and sidebar state.
  useEffect(() => {
    const onMenu = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; x: number; y: number }>).detail;
      if (d?.text) setEditorCtxMenu(d);
    };
    window.addEventListener("yarrow:editor-contextmenu", onMenu as EventListener);
    return () => window.removeEventListener("yarrow:editor-contextmenu", onMenu as EventListener);
  }, []);
  // Dismiss the ctx menu on any click or resize; rendered below as a
  // portal-less fixed element, a quick outside-click close is enough.
  useEffect(() => {
    if (!editorCtxMenu) return;
    const close = () => setEditorCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [editorCtxMenu]);

  // Note switch resets selection — the new editor instance starts with
  // an empty selection but doesn't dispatch a change event for it.
  useEffect(() => {
    setSelectionWords(0);
    setSelectionChars(0);
  }, [activeSlug]);

  const handleSave = useCallback(
    async (body: string, thinking?: string) => {
      if (!activeSlug) return;
      try {
        const n = await api.saveNote(activeSlug, body, thinking);
        invalidateNote(activeSlug);
        setActiveNote(n);
        setCurrentBody(n.body);
        setDirty(false);
        setSyncStatus((s) => (s === "no-remote" ? "no-remote" : "pending"));
        const [list, g, topo, orphansList] = await Promise.all([
          api.listNotes(),
          api.getGraph(),
          api.branchTopology(),
          api.orphans(),
        ]);
        setNotes(list);
        setGraph(g);
        setTopology(topo);
        setOrphanSet(new Set(orphansList));
        // Nonce consumed by the toolbar to show "saved just now" for a
        // brief beat after the debounced write lands.
        setLastSavedAt(Date.now());
      } catch (e) {
        console.error("save failed", e);
      }
    },
    [activeSlug],
  );

  const handleRenameNote = useCallback(
    async (slug: string, nextTitle: string) => {
      const n = await api.renameNote(slug, nextTitle);
      const list = await api.listNotes();
      setNotes(list);
      if (activeSlug === slug) setActiveSlug(n.slug);
      setGraph(await api.getGraph());
    },
    [activeSlug],
  );

  const handleTogglePin = useCallback(async (slug: string, pinned: boolean) => {
    await api.setPinned(slug, pinned);
    const list = await api.listNotes();
    setNotes(list);
  }, []);

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
          title: "Delete this note?",
          body: "Can't show an undo for this note (it's locked). Delete anyway? Past versions remain in history.",
          onConfirm: async () => {
            await api.deleteNote(slug);
            const list = await api.listNotes();
            setNotes(list);
            if (activeSlug === slug) setActiveSlug(list[0]?.slug ?? null);
            setGraph(await api.getGraph());
            setOrphanSet(new Set(await api.orphans()));
            setConfirmState(null);
          },
        });
        return;
      }

      await api.deleteNote(slug);
      const list = await api.listNotes();
      setNotes(list);
      if (activeSlug === slug) setActiveSlug(list[0]?.slug ?? null);
      setGraph(await api.getGraph());
      setOrphanSet(new Set(await api.orphans()));

      // Offer undo. The action re-creates the note with its original title
      // and body — the slug may differ from the original if the user spent
      // the undo window renaming another note into this slot, but the
      // content is never lost.
      setToast({
        text: `Deleted "${snapshot.title}."`,
        action: {
          label: "Undo",
          run: async () => {
            try {
              const fresh = await api.createNote(snapshot.title);
              await api.saveNote(fresh.slug, snapshot.body);
              const next = await api.listNotes();
              setNotes(next);
              setGraph(await api.getGraph());
              setOrphanSet(new Set(await api.orphans()));
              setActiveSlug(fresh.slug);
            } catch (e) {
              setToast(`Couldn't undo delete: ${String(e)}`);
            }
          },
        },
      });
    },
    [activeSlug],
  );

  const handleRevealNote = useCallback(async (slug: string) => {
    try {
      const abs = await api.noteAbsolutePath(slug);
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(abs);
    } catch (e) {
      setToast(`Couldn't reveal file: ${String(e)}`);
    }
  }, []);

  const handleSendSelectionToScratchpad = useCallback(async (text: string) => {
    try {
      await api.appendScratchpad(text);
      // Bump the reload nonce so an already-open scratchpad re-reads its
      // file instead of sitting on stale content.
      setScratchpadReloadNonce((n) => n + 1);
      if (!scratchpadOpen) setScratchpadOpen(true);
      setToast(`Sent ${text.trim().match(/\S+/g)?.length ?? 0} words to scratchpad.`);
    } catch (e) {
      setToast(`Couldn't send to scratchpad: ${String(e)}`);
    }
  }, [scratchpadOpen]);

  const handleCopyNoteAsMarkdown = useCallback(async (slug: string) => {
    try {
      const n = await api.readNote(slug);
      if (n.locked) {
        setToast("Unlock the note first to copy its contents.");
        return;
      }
      // Reconstruct what a human would paste: visible title as H1, body
      // beneath. Frontmatter (tags, links, encryption metadata) is Yarrow
      // plumbing — pasting it elsewhere would just be noise.
      const title = n.frontmatter.title?.trim() || n.slug;
      const md = `# ${title}\n\n${n.body}`.trimEnd() + "\n";
      await navigator.clipboard.writeText(md);
      setToast(`Copied "${title}" as markdown.`);
    } catch (e) {
      setToast(`Couldn't copy: ${String(e)}`);
    }
  }, []);

  const handleDeleteMany = useCallback(
    (slugs: string[]) => {
      if (slugs.length === 0) return;
      setConfirmState({
        title: `Delete ${slugs.length} note${slugs.length === 1 ? "" : "s"}?`,
        body: "They disappear from the list. Past versions on this path remain in history.",
        onConfirm: async () => {
          for (const s of slugs) {
            try { await api.deleteNote(s); } catch (e) { console.error("delete failed", s, e); }
          }
          const list = await api.listNotes();
          setNotes(list);
          if (activeSlug && slugs.includes(activeSlug)) {
            setActiveSlug(list[0]?.slug ?? null);
          }
          setGraph(await api.getGraph());
          setOrphanSet(new Set(await api.orphans()));
          setConfirmState(null);
        },
      });
    },
    [activeSlug],
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
      setForkMoment(name);
    } catch (e) {
      console.error("create path failed", e);
    }
  }, [newPathName, newPathCondition, newPathFrom, activeSlug, collectionsView, refreshPathAwareness]);

  // v2 "path switching" is a pure UI/navigation action. Paths are collections
  // (lenses), not git branches — every note is always readable on every path,
  // so switching never has to save-and-checkout. Setting `currentPath` updates
  // the toolbar context; if the target collection has a main note and the
  // user isn't already on one of its members, we jump there.
  const handleSwitchPath = useCallback(
    (name: string) => {
      setCurrentPath(name);
      const cols = collectionsView?.collections ?? [];
      const col = cols.find((c) => c.name === name);
      if (!col) return;
      const alreadyOnMember = activeSlug ? col.members.includes(activeSlug) : false;
      if (alreadyOnMember) return;
      const target = col.main_note || col.members[0];
      if (target) selectSlug(target);
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
      api.getGraph(),
      api.orphans(),
    ]);
    setActiveNote(note);
    setCurrentBody(note.body);
    setGraph(g);
    setOrphanSet(new Set(orphansList));
  }, [activeSlug, connectTarget, connectType]);

  const handleRemoveConnection = useCallback(
    async (to: string) => {
      if (!activeSlug) return;
      await api.removeLink(activeSlug, to);
      const [note, g, orphansList] = await Promise.all([
        api.readNote(activeSlug),
        api.getGraph(),
        api.orphans(),
      ]);
      setActiveNote(note);
      setCurrentBody(note.body);
      setGraph(g);
      setOrphanSet(new Set(orphansList));
    },
    [activeSlug],
  );

  const handleSync = useCallback(async () => {
    if (!config?.sync.remote_url) {
      setSettingsOpen({ open: true, tab: "sync" });
      return;
    }
    setSyncStatus("syncing");
    try {
      const r = await api.sync();
      setSyncStatus(r.ok ? "synced" : "error");
      setSyncMessage(r.message);
    } catch (e) {
      setSyncStatus("error");
      setSyncMessage(String(e));
    }
  }, [config]);

  const openHistory = useCallback(async () => {
    if (!activeSlug) return;
    const h = await api.noteHistory(activeSlug);
    setHistory(h);
    setHistoryPreview(null);
    setHistoryOpen(true);
  }, [activeSlug]);

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
      setToast("Restored — the previous version stays safely in history");
    },
    [activeSlug],
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

  const filteredNotes = useMemo(() => {
    if (!tagFilter) return notes;
    return notes.filter((n) => (n.tags ?? []).includes(tagFilter));
  }, [notes, tagFilter]);

  const tagCounts = graph?.tags ?? [];

  const mappingEnabled = (config?.mapping?.mode ?? "mapped") === "mapped";
  const mainNoteSet = !!config?.mapping?.main_note;
  const needsMainNote = mappingEnabled && !mainNoteSet;

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
                title={`Switch workspace · ${SK.switchWorkspace}`}
                aria-label="Switch workspace"
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
                    {config?.workspace.name ?? "Workspace"}
                  </div>
                  <div className="text-2xs text-t3 leading-tight truncate">
                    {notes.length} note{notes.length === 1 ? "" : "s"} · {paths.length} path{paths.length === 1 ? "" : "s"}
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
                <span>Find anything</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
                onClearTagFilter={() => setTagFilter(null)}
                encryptionEnabled={encryption.enabled}
                encryptionUnlocked={encryption.unlocked}
                onEncryptNote={handleEncryptNoteBySlug}
                onDecryptNote={handleDecryptNoteBySlug}
                onReveal={handleRevealNote}
                onCopyAsMarkdown={handleCopyNoteAsMarkdown}
              />
              <TagList
                tags={tagCounts}
                activeTag={tagFilter}
                onSelect={setTagFilter}
              />
              <JournalList
                entries={dailyEntries}
                activeSlug={activeSlug}
                onOpenDaily={handleOpenDaily}
              />
              {mappingEnabled && (
                <PathMinimap
                  view={collectionsView}
                  onOpen={() => {
                    if (needsMainNote) { setMainNotePromptOpen(true); return; }
                    setRailOverlay("paths");
                  }}
                  onNewPath={() => {
                    if (needsMainNote) { setMainNotePromptOpen(true); return; }
                    setNewPathOpen(true);
                  }}
                />
              )}
              <div className="mt-3 border-t border-bd/20 mx-3" />
              <button
                onClick={() => setScratchpadOpen(true)}
                className="mt-2 mx-3 mb-3 w-[calc(100%-1.5rem)] text-left px-3 py-2 text-xs text-t2 hover:bg-s2 hover:text-char rounded transition flex items-center gap-2"
                title="A place to jot without saving"
              >
                <ScratchpadIcon />
                <span>Scratchpad</span>
              </button>
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
            collections={collectionsView?.collections ?? []}
            rootName={collectionsView?.root ?? "main"}
            currentPath={currentPath}
            checkpointCount={checkpointCount}
            dirty={dirty}
            lastSavedAt={lastSavedAt}
            mappingEnabled={mappingEnabled}
            onSwitchPath={handleSwitchPath}
            onBranchFromHere={() => {
              if (needsMainNote) { setMainNotePromptOpen(true); return; }
              setNewPathOpen(true);
            }}
            onOpenPaths={() => {
              if (needsMainNote) { setMainNotePromptOpen(true); return; }
              setRailOverlay("paths");
            }}
            onOpenMap={() => {
              if (needsMainNote) { setMainNotePromptOpen(true); return; }
              setMapFilter(null);
              setRailOverlay("map");
            }}
            onEditCurrentCondition={() => setEditConditionFor(currentPath)}
          />
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {activeNote ? (
              activeNote.locked ? (
                <LockedNoteHero
                  title={activeNote.frontmatter.title || activeNote.slug}
                  onUnlock={() => requestUnlock()}
                  onUnlocked={onUnlocked}
                />
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
                    onTitleChange={(title) => handleRenameNote(activeNote.slug, title)}
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
                  onHover={previewAtCheckpoint}
                  onRestore={restoreAtCheckpoint}
                  onClose={() => { setHistoryOpen(false); setRailOverlay(null); }}
                />
              </L>
            )}
          </div>
        </section>

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
                setGraph(await api.getGraph());
                setOrphanSet(new Set(await api.orphans()));
                // Jump straight to the freshly-kept note so the user sees
                // that "Keep as note" actually produced something tangible.
                selectSlug(newSlug);
                setToast("Kept as a note.");
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
            onOpenSettings={() => setSettingsOpen({ open: true })}
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
              {mapFilter ? `Map · ${mapFilter.collectionName}` : "Connections"}
            </div>
            <div className="mt-2 text-2xs text-t3 font-mono uppercase tracking-[0.2em]">
              {mapFilter ? (() => {
                const c = collectionsView?.collections.find((x) => x.name === mapFilter.collectionName);
                const n = c?.members.length ?? 0;
                return `${n} note${n === 1 ? "" : "s"} in this path`;
              })() : (
                <>
                  {(activeNote?.frontmatter.title || activeSlug || "this note")}
                  {" · "}
                  {mapNeighborCount(graph, activeSlug)} neighbor{mapNeighborCount(graph, activeSlug) === 1 ? "" : "s"}
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
              />
            </L>
          </div>
        </Modal>
      )}

      {railOverlay === "links" && (
        <Modal
          open
          onClose={() => setRailOverlay(null)}
          title="Links from this note"
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

      {editorCtxMenu && (
        <div
          // Clamp to viewport so a click near the right edge doesn't push
          // the menu off-screen. Width/height are small, so the simple
          // max is plenty.
          style={{
            left: Math.min(editorCtxMenu.x, window.innerWidth - 220),
            top: Math.min(editorCtxMenu.y, window.innerHeight - 120),
          }}
          className="fixed z-50 w-[210px] bg-bg border border-bd2 rounded-md shadow-xl text-xs py-1 animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2 text-char"
            onClick={() => {
              // Use the selection as the "if…" seed so the user doesn't have
              // to retype what they highlighted — very fast branch-from-idea.
              const seed = editorCtxMenu.text.trim().slice(0, 120);
              const lower = seed.toLowerCase();
              const prefilled =
                /^(if|what if)\b/.test(lower) ? seed : `If ${lower.replace(/\.$/, "")}`;
              setNewPathCondition(prefilled);
              setEditorCtxMenu(null);
              setNewPathOpen(true);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="3" cy="3" r="1.5"/>
              <circle cx="3" cy="11" r="1.5"/>
              <circle cx="11" cy="7" r="1.5"/>
              <path d="M3 4.5v5M4.3 3.7l5.4 2.6"/>
            </svg>
            <span>Start a path from this</span>
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2 text-t2"
            onClick={() => {
              handleSendSelectionToScratchpad(editorCtxMenu.text);
              setEditorCtxMenu(null);
            }}
          >
            <ScratchpadIcon size={11} />
            <span>Send to scratchpad</span>
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2 text-t2"
            onClick={() => {
              navigator.clipboard?.writeText(editorCtxMenu.text).catch(() => {});
              setEditorCtxMenu(null);
            }}
          >
            <span className="w-3 inline-block text-center">⧉</span>
            <span>Copy</span>
          </button>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-10 z-40 max-w-[460px] bg-char text-bg text-xs px-3.5 py-2 rounded-md shadow-lg animate-fadeIn flex items-center gap-3"
          style={{
            // Center in the visible editor area — slide leftward so the
            // docked scratchpad never covers the toast.
            left: "50%",
            transform: `translateX(calc(-50% - ${scratchpadOpen ? scratchpadWidth / 2 : 0}px))`,
          }}
        >
          <span>{typeof toast === "string" ? toast : toast.text}</span>
          {typeof toast === "object" && toast.action && (
            <button
              onClick={() => {
                // Run the action first, then dismiss — running after dismiss
                // creates a flash of the toast disappearing before the action
                // result (e.g. the undone note popping back) registers.
                toast.action.run();
                setToast(null);
              }}
              className="px-2 py-0.5 rounded border border-bg/40 hover:bg-bg/10 font-medium uppercase tracking-wider text-2xs"
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            className="opacity-70 hover:opacity-100 text-bg"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Status bar */}
      <div className="h-7 bg-s2 border-t border-bd flex items-center px-3 text-2xs text-t2 gap-3 font-mono">
        <span>{notes.length} notes</span>
        <span className="text-t3">·</span>
        <span>{pathCount} paths</span>
        <span className="text-t3">·</span>
        <span className="truncate">on path: {currentPath || "—"}</span>
        {activeNote && !activeNote.locked && (
          <>
            <span className="text-t3">·</span>
            {selectionWords > 0 ? (
              <span className="text-yeld" title={`${selectionChars} chars selected`}>
                {selectionWords} selected
              </span>
            ) : (
              <span title={`~${Math.max(1, Math.round(noteWordCount / 220))} min read`}>
                {noteWordCount.toLocaleString()} word{noteWordCount === 1 ? "" : "s"}
              </span>
            )}
          </>
        )}
        <span className="ml-auto flex items-center gap-2 truncate">
          <SyncStatusPill status={syncStatus} />
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
            encryption={encryption}
            activeIsEncrypted={!!activeNote?.encrypted}
            onLockEncryption={handleLockEncryption}
            onUnlockEncryption={() => requestUnlock()}
            onEncryptActiveNote={handleEncryptActiveNote}
            onDecryptActiveNote={handleDecryptActiveNote}
            onOpenSecurity={() => setSettingsOpen({ open: true, tab: "security" })}
            onSwitchWorkspace={() => setWorkspaceSwitcherOpen(true)}
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
          />
        </L>
      )}

      <ForkMoment
        pathName={forkMoment}
        onDone={() => setForkMoment(null)}
      />

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
                const topo = await api.branchTopology();
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
            onClose={() => setRailOverlay(null)}
            onNavigate={(slug) => { selectSlug(slug); setRailOverlay(null); }}
            onSwitchToRoot={(rootName) => handleSwitchPath(rootName)}
            onLinksChanged={async () => {
              // A path-add auto-wrote a typed link. Re-pull the graph and
              // orphan index so the Map reflects it; also re-read the
              // active note in case its frontmatter just changed.
              const [g, orphansList] = await Promise.all([
                api.getGraph(),
                api.orphans(),
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
        title="Start a new path"
      >
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          A path is an <span className="italic">if…</span>. Write the question
          — that's all. The version you have now stays safely on{" "}
          <span className="font-medium text-yeld">{collectionsView?.root || "main"}</span>.
        </p>

        <div className="mb-4 px-3 py-2 bg-yelp/40 border border-yel/40 rounded-md flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-yel shrink-0" />
          <span className="text-2xs text-t2 leading-snug">
            Every path branches from{" "}
            <span className="font-medium text-yeld">
              {collectionsView?.root || "main"}
            </span>
            . One trunk, many branches.
          </span>
        </div>

        <label className="block text-2xs uppercase tracking-[0.18em] font-mono text-t3 mb-1.5">
          the question this path asks
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
          placeholder="If the Seattle job comes through…"
          className="w-full px-4 py-2.5 bg-bg-soft border border-bd rounded-md text-char font-serif italic placeholder:not-italic placeholder:text-t3/70 text-[15px] resize-none leading-snug"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {[
            "If it rains on the day",
            "If the project gets denied",
            "If I quit to write",
            "If we have a kid this year",
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
            name it yourself (optional)
          </summary>
          <input
            value={newPathName}
            onChange={(e) => setNewPathName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreatePath(); }}
            placeholder={newPathCondition ? "auto: derived from your question" : "the-seattle-job"}
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
            not now
          </button>
          <button
            className="btn-yel px-4 py-1.5 text-sm rounded-md"
            onClick={handleCreatePath}
            disabled={!newPathCondition.trim() && !newPathName.trim()}
          >
            start exploring
          </button>
        </div>
        <div className="mt-3 text-2xs text-t3 text-center italic">
          tip: ⌘⇧B works from anywhere
        </div>
      </Modal>

      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title="Connect this note"
      >
        <label className="text-xs text-t2 block mb-1">to</label>
        <select
          value={connectTarget}
          onChange={(e) => setConnectTarget(e.target.value)}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char mb-3"
        >
          <option value="">— choose a note —</option>
          {notes.filter((n) => n.slug !== activeSlug).map((n) => (
            <option key={n.slug} value={n.slug}>{n.title}</option>
          ))}
        </select>
        <label className="text-xs text-t2 block mb-1">as</label>
        <select
          value={connectType}
          onChange={(e) => setConnectType(e.target.value as LinkType)}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        >
          <option value="supports">supports</option>
          <option value="challenges">challenges</option>
          <option value="came-from">came from</option>
          <option value="open-question">open question</option>
        </select>
        <p className="text-2xs text-t3 mt-2">
          A reverse link is added to the other note automatically.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConnectOpen(false)}
          >
            cancel
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={handleAddConnection}
            disabled={!connectTarget}
          >
            connect
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
            keep it
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onClick={confirmState?.onConfirm}
          >
            yes, delete
          </button>
        </div>
      </Modal>

      <Modal
        open={newNoteOpen}
        onClose={() => setNewNoteOpen(false)}
        width="w-[560px]"
      >
        <div className="mb-1">
          <div className="font-serif text-[28px] text-char tracking-tight leading-tight">
            Start from
          </div>
          <div className="font-serif italic text-sm text-t2 mt-1">
            Pick a template, or a blank page. Edit them in Settings.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-5">
          <TemplateTile
            active={newNoteTemplate === null}
            onClick={() => setNewNoteTemplate(null)}
            onDoubleClick={() => { if (newNoteTitle.trim()) confirmCreateNote(); }}
            title="Blank note"
            sub="Nothing to get in the way"
            glyph={<BlankGlyph />}
          />
          {templates.map((t) => (
            <TemplateTile
              key={t.name}
              active={newNoteTemplate === t.name}
              onClick={() => setNewNoteTemplate(t.name)}
              onDoubleClick={() => { if (newNoteTitle.trim()) confirmCreateNote(); }}
              title={t.label}
              sub={templateSubtitle(t.name)}
              glyph={<TemplateGlyph name={t.name} />}
            />
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-bd">
          <label className="text-2xs uppercase tracking-wider text-t3 font-semibold block mb-2">
            Title · lands on {currentPath || "main"}
          </label>
          <input
            autoFocus
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmCreateNote(); }}
            placeholder="e.g. notes on attention"
            className="w-full px-4 py-2.5 bg-bg border border-bd rounded-full text-sm text-char placeholder:text-t3 focus:outline-none focus:border-bd2 transition"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setNewNoteOpen(false)}
          >
            cancel
          </button>
          <button
            className="btn-yel px-4 py-2 text-sm rounded-full"
            onClick={confirmCreateNote}
            disabled={!newNoteTitle.trim()}
          >
            {newNoteTemplate ? "create from template" : "create note"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!pendingTemplate}
        onClose={() => { setPendingTemplate(null); setTemplateTitle(""); }}
        title={`New note from "${templates.find((t) => t.name === pendingTemplate)?.label ?? pendingTemplate}"`}
      >
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          Give it a title. The template's scaffolding fills in from there.
        </p>
        <input
          autoFocus
          value={templateTitle}
          onChange={(e) => setTemplateTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmCreateFromTemplate(); }}
          placeholder="e.g. project kickoff"
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => { setPendingTemplate(null); setTemplateTitle(""); }}
          >
            cancel
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={confirmCreateFromTemplate}
            disabled={!templateTitle.trim()}
          >
            create
          </button>
        </div>
      </Modal>

      <Modal
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        title="New note from template"
      >
        {templates.length === 0 ? (
          <p className="text-sm text-t2">No templates yet. Add one in Settings → Templates.</p>
        ) : (
          <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
            {templates.map((t) => (
              <li key={t.name}>
                <button
                  onClick={() => {
                    setTemplatePickerOpen(false);
                    handleCreateFromTemplate(t.name);
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-s2 flex items-center gap-2"
                >
                  <span className="text-char">{t.label}</span>
                  {t.is_daily && (
                    <span className="text-2xs px-1.5 py-px bg-yelp text-yeld rounded">daily</span>
                  )}
                  <span className="ml-auto text-2xs text-t3 font-mono">{t.name}</span>
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
          This note is locked
        </div>
        <p className="text-xs text-t2 mb-6 leading-relaxed font-serif italic">
          Encrypted locally with ChaCha20-Poly1305.
          <br />
          Enter your passphrase to read it.
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
            placeholder="passphrase"
            className="flex-1 px-4 py-2 bg-bg border border-bd rounded-full text-sm text-char font-mono placeholder:text-t3 focus:outline-none focus:border-bd2 transition"
          />
          <button
            type="submit"
            disabled={!password || busy}
            className="btn-yel px-4 py-2 rounded-full text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "…" : "unlock"}
          </button>
        </form>

        {error && (
          <div className="text-2xs text-danger mb-3">{error}</div>
        )}

        <div className="flex items-center justify-center gap-3 text-2xs text-t3 font-mono uppercase tracking-wider">
          <span>local locks</span>
          <span className="w-1 h-1 rounded-full bg-t3" />
          <span>no network</span>
          <span className="w-1 h-1 rounded-full bg-t3" />
          <span>no accounts</span>
        </div>

        <button
          onClick={onUnlock}
          className="mt-5 text-2xs text-t3 hover:text-t2 transition"
        >
          I forgot my passphrase
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
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="font-serif text-3xl text-char mb-3 tracking-tight">
          A blank page, and everything ahead of it
        </div>
        <p className="text-sm text-t2 mb-6 leading-relaxed">
          Yarrow saves every word automatically. Every time you branch, the
          original stays safe. Nothing you write here can get lost.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={onNewNote}
            className="btn-yel px-4 py-2 rounded-md text-sm"
          >
            Start your first note
          </button>
          <button
            onClick={onOpenPalette}
            className="inline-flex items-center gap-2 px-4 py-2 bg-s2 text-ch2 rounded-md hover:bg-s3 text-sm transition"
          >
            <SearchIcon size={14} />
            <span>Find a note</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncStatusPill({ status }: { status: SyncStatus }) {
  const { color, label, pulse } = syncStatusPresentation(status);
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot color={color} size={7} className={pulse ? "animate-pulse2" : ""} />
      <span>{label}</span>
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

function TemplateTile({
  active,
  onClick,
  onDoubleClick,
  title,
  sub,
  glyph,
}: {
  active: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  title: string;
  sub: string;
  glyph: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`tile-press text-left flex items-start gap-3 p-3 rounded-xl border ${
        active
          ? "border-yel bg-yelp shadow-sm"
          : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
      }`}
    >
      <div
        className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
          active ? "bg-yel/20 text-yeld" : "bg-s2 text-t3"
        }`}
      >
        {glyph}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium truncate ${active ? "text-char" : "text-char"}`}>
          {title}
        </div>
        <div className="text-2xs text-t3 mt-0.5 truncate font-mono">{sub}</div>
      </div>
    </button>
  );
}

function templateSubtitle(name: string): string {
  switch (name) {
    case "daily":    return "{{date}} · morning · notes";
    case "meeting":  return "Who · what · next";
    case "book":     return "Quotes, questions, carried forward";
    case "vacation": return "Shape, stay, eat, skip";
    case "project":  return "Problem · shape · proof";
    case "morning":  return "Three pages, no editing";
    default:         return name;
  }
}

function BlankGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 2.5h6L12.5 5.5v8a.5.5 0 0 1-.5.5h-8.5a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5z" />
    </svg>
  );
}

function TemplateGlyph({ name }: { name: string }) {
  switch (name) {
    case "daily":
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 3.5l1.2 2.6 2.8.3-2.1 1.9.6 2.8L8 9.8l-2.5 1.3.6-2.8L4 6.4l2.8-.3L8 3.5z" fill="currentColor" fillOpacity="0.35" />
        </svg>
      );
    case "meeting":
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="6" r="2" />
          <circle cx="11" cy="6" r="2" />
          <path d="M2 13c0-2 1.5-3.3 3-3.3S8 11 8 13M8 13c0-2 1.5-3.3 3-3.3S14 11 14 13" />
        </svg>
      );
    case "book":
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3h10v10H3zM8 3v10" />
          <path d="M5 6h2M5 8.5h2M10 6h1.5M10 8.5h1.5" />
        </svg>
      );
    case "vacation":
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v6" />
          <path d="M8 2a4 4 0 0 1 4 4H8z" fill="currentColor" fillOpacity="0.3" />
          <path d="M4 14c0-2 1-3 2-3 1.5 0 2 2 2 2s.5-2 2-2c1 0 2 1 2 3" />
        </svg>
      );
    case "project":
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2L14 5v6L8 14L2 11V5z" />
          <path d="M8 2v12M2 5l6 3 6-3" />
        </svg>
      );
    case "morning":
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 11h12" />
          <path d="M8 3v4" />
          <path d="M5 7L8 4l3 3" />
        </svg>
      );
    default:
      return <BlankGlyph />;
  }
}

function syncStatusPresentation(s: SyncStatus): {
  color: string;
  label: string;
  pulse: boolean;
} {
  switch (s) {
    case "synced":    return { color: "var(--yel)",    label: "synced", pulse: false };
    case "pending":   return { color: "var(--accent2)", label: "local changes", pulse: false };
    case "syncing":   return { color: "var(--yel)",    label: "syncing…", pulse: true };
    case "error":     return { color: "var(--danger)", label: "sync failed", pulse: false };
    case "no-remote": return { color: "var(--t3)",     label: "not synced anywhere", pulse: false };
  }
}
