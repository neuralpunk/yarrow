import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import { useTheme } from "../lib/theme";
import { openQuestions } from "../lib/forkDetection";
import { todayIso } from "../lib/format";
import { HelpIcon, SearchIcon, StatusDot, ScratchpadIcon } from "../lib/icons";
import Logo from "./Logo";
import QuickSwitcher from "./QuickSwitcher";
import type {
  BranchTopo,
  Graph,
  HistoryEntry,
  LinkType,
  Note,
  NoteSummary,
  PathInfo,
  WorkspaceConfig,
} from "../lib/types";
import NoteList from "./LeftSidebar/NoteList";
import JournalList from "./LeftSidebar/JournalList";
import PathGraph from "./LeftSidebar/PathGraph";
import NoteEditor from "./Editor/NoteEditor";
import Toolbar from "./Editor/Toolbar";
import HistorySlider from "./Editor/HistorySlider";
import ConnectionGraph from "./RightSidebar/ConnectionGraph";
import LinkedNotesList from "./RightSidebar/LinkedNotesList";
import OpenQuestions from "./RightSidebar/OpenQuestions";
import Transclusions from "./RightSidebar/Transclusions";
import Scratchpad from "./Scratchpad";
import QuickCapture from "./QuickCapture";
import Settings from "./Settings";
import Modal from "./Modal";
import CommandPalette from "./CommandPalette";
import ForkMoment from "./ForkMoment";
import ConflictResolver from "./ConflictResolver";
import PathDiff from "./PathDiff";

type SyncStatus = "synced" | "pending" | "syncing" | "error" | "no-remote";

interface Props {
  workspacePath: string;
  onClose: () => void;
}

export default function AppShell({ workspacePath, onClose }: Props) {
  useTheme(); // applies theme class to <html>

  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [paths, setPaths] = useState<PathInfo[]>([]);
  const [topology, setTopology] = useState<BranchTopo[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [graph, setGraph] = useState<Graph | null>(null);
  const [orphanSet, setOrphanSet] = useState<Set<string>>(new Set());
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [currentBody, setCurrentBody] = useState<string>("");
  const [focusMode, setFocusMode] = useState(false);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyPreview, setHistoryPreview] = useState<string | null>(null);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("pending");
  const [syncMessage, setSyncMessage] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [jumpSignal, setJumpSignal] = useState<{ line: number; nonce: number } | undefined>();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [newPathOpen, setNewPathOpen] = useState(false);
  const [newPathName, setNewPathName] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectTarget, setConnectTarget] = useState("");
  const [connectType, setConnectType] = useState<LinkType>("supports");
  const [settingsOpen, setSettingsOpen] = useState<
    { open: boolean; tab?: "appearance" | "writing" | "sync" | "workspace" | "shortcuts" | "about" }
  >({ open: false });
  const [confirmState, setConfirmState] = useState<{
    title: string;
    body: string;
    onConfirm: () => void;
  } | null>(null);
  const [forkMoment, setForkMoment] = useState<string | null>(null);
  const [dailyEntries, setDailyEntries] = useState<NoteSummary[]>([]);
  const [toast, setToast] = useState<string | null>(null);
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
  const [pendingSwitchPath, setPendingSwitchPath] = useState<string | null>(null);
  const [conflictSession, setConflictSession] = useState<{
    relpaths: string[];
    currentPath: string;
    otherPath: string;
  } | null>(null);

  const refreshAll = useCallback(async () => {
    const [cfg, list, pathList, cur, g, topo, orphansList, merging, daily] =
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
      ]);
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

  useEffect(() => {
    if (!activeSlug) { setActiveNote(null); return; }
    // Guard against fast slug-switches landing a stale note into state: if the
    // user clicked away before this read resolved, drop the result on the floor.
    let alive = true;
    api.readNote(activeSlug).then((n) => {
      if (!alive) return;
      setActiveNote(n);
      setCurrentBody(n.body);
    }).catch(() => {
      if (!alive) return;
      setActiveNote(null);
    });
    return () => { alive = false; };
  }, [activeSlug, currentPath]);

  const handleCreateNote = useCallback(() => {
    setNewNoteTitle("");
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

  const confirmCreateNote = useCallback(async () => {
    const title = newNoteTitle.trim();
    if (!title) return;
    setNewNoteOpen(false);
    setNewNoteTitle("");
    const n = await api.createNote(title);
    const list = await api.listNotes();
    setNotes(list);
    setActiveSlug(n.slug);
    setGraph(await api.getGraph());
    setOrphanSet(new Set(await api.orphans()));
  }, [newNoteTitle]);

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
  }, [handleCreateNote, handleOpenDaily, activeSlug]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = useCallback(
    async (body: string, thinking?: string) => {
      if (!activeSlug) return;
      try {
        const n = await api.saveNote(activeSlug, body, thinking);
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
    (slug: string) => {
      setConfirmState({
        title: "Delete this note?",
        body: "It disappears from the list. Past versions on this path remain in history.",
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
    },
    [activeSlug],
  );

  const handleCreatePath = useCallback(async () => {
    const name = newPathName.trim();
    if (!name) return;
    setNewPathOpen(false);
    setNewPathName("");
    await api.createPath(name);
    const [list, pathList, cur, topo] = await Promise.all([
      api.listNotes(),
      api.listPaths(),
      api.currentPath(),
      api.branchTopology(),
    ]);
    setNotes(list);
    setPaths(pathList);
    setCurrentPath(cur);
    setTopology(topo);
    setForkMoment(cur);
  }, [newPathName]);

  const performSwitchPath = useCallback(
    async (name: string) => {
      await api.switchPath(name);
      const [list, pathList, cur, g, topo] = await Promise.all([
        api.listNotes(),
        api.listPaths(),
        api.currentPath(),
        api.getGraph(),
        api.branchTopology(),
      ]);
      setNotes(list);
      setPaths(pathList);
      setCurrentPath(cur);
      setGraph(g);
      setTopology(topo);
      if (activeSlug) {
        try {
          const n = await api.readNote(activeSlug);
          setActiveNote(n);
          setCurrentBody(n.body);
        } catch {
          setActiveSlug(list[0]?.slug ?? null);
        }
      }
    },
    [activeSlug],
  );

  const handleSwitchPath = useCallback(
    async (name: string) => {
      if (dirty) {
        setPendingSwitchPath(name);
        return;
      }
      await performSwitchPath(name);
    },
    [dirty, performSwitchPath],
  );

  const handleDeletePath = useCallback((name: string) => {
    setConfirmState({
      title: `Abandon path "${name}"?`,
      body: "Its contents live on in history — you can revive the path later.",
      onConfirm: async () => {
        await api.deletePath(name);
        setPaths(await api.listPaths());
        setTopology(await api.branchTopology());
        setConfirmState(null);
      },
    });
  }, []);

  const handleExportPath = useCallback(async (name: string) => {
    try {
      const dest = await openDialog({ directory: true, multiple: false });
      if (!dest || Array.isArray(dest)) return;
      const report = await api.exportPathMarkdown(name, dest);
      setToast(
        `Exported "${name}" — ${report.notes_exported} notes to ${report.dest}`,
      );
    } catch (e) {
      setToast(`Export failed: ${e}`);
    }
  }, []);

  const [compareSession, setCompareSession] = useState<string | null>(null);

  const handleMergePath = useCallback(async (fromName: string) => {
    const result = await api.mergePath(fromName);
    if (!result.clean) {
      setConflictSession({
        relpaths: result.conflicts,
        currentPath: result.merged_into,
        otherPath: fromName,
      });
      return;
    }
    const [list, pathList, g, topo] = await Promise.all([
      api.listNotes(),
      api.listPaths(),
      api.getGraph(),
      api.branchTopology(),
    ]);
    setNotes(list);
    setPaths(pathList);
    setGraph(g);
    setTopology(topo);
    if (activeSlug) {
      try {
        const n = await api.readNote(activeSlug);
        setActiveNote(n);
        setCurrentBody(n.body);
      } catch {}
    }
  }, [activeSlug]);

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

  const pathCount = paths.length;

  return (
    <div className="h-full flex flex-col bg-bg text-char">
      <div className="flex-1 flex overflow-hidden">
        {!focusMode && (
          <aside className="w-[268px] shrink-0 bg-s1 border-r border-bd flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-bd">
              <div className="flex items-center gap-2 min-w-0">
                <Logo size={22} className="shrink-0" />
                <div
                  className="font-serif text-lg text-char truncate flex-1 min-w-0"
                  title={config?.workspace.name}
                >
                  {config?.workspace.name ?? workspacePath}
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen({ open: true, tab: "workspace" })}
                className="text-2xs text-t3 hover:text-t2 transition"
              >
                change workspace…
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <NoteList
                notes={notes}
                activeSlug={activeSlug}
                orphans={orphanSet}
                decayDays={config?.preferences.decay_days ?? 60}
                neighbors={neighbors}
                onSelect={selectSlug}
                onCreate={handleCreateNote}
                onRename={handleRenameNote}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
              />
              <JournalList
                entries={dailyEntries}
                activeSlug={activeSlug}
                onOpenDaily={handleOpenDaily}
              />
              <PathGraph
                topology={topology}
                currentPath={currentPath}
                onSwitch={handleSwitchPath}
                onDelete={handleDeletePath}
                onMerge={handleMergePath}
                onNewPath={() => setNewPathOpen(true)}
                onExport={handleExportPath}
                onCompare={(name) => setCompareSession(name)}
              />
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

        <section className="flex-1 min-w-0 flex flex-col">
          <Toolbar
            currentPath={currentPath}
            pathCount={pathCount}
            connectionCount={noteLinks.length}
            dirty={dirty}
            syncStatus={syncStatus}
            syncMessage={syncMessage}
            focusMode={focusMode}
            onNewDirection={() => setNewPathOpen(true)}
            onConnect={() => setConnectOpen(true)}
            onHistory={openHistory}
            onSync={handleSync}
            onToggleFocus={() => setFocusMode((f) => !f)}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenSettings={() => setSettingsOpen({ open: true })}
          />
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeNote ? (
              <NoteEditor
                key={activeNote.slug + "@" + currentPath + "#" + restoreNonce}
                note={activeNote}
                notes={notes}
                currentPath={currentPath}
                jumpToLine={jumpSignal}
                onSave={handleSave}
                onTitleChange={(title) => handleRenameNote(activeNote.slug, title)}
                onDirtyChange={setDirty}
                onNavigate={selectSlug}
                onBodyChange={setCurrentBody}
                onOpenFork={() => setNewPathOpen(true)}
                debounceMs={config?.preferences.autocheckpoint_debounce_ms ?? 3000}
                askThinkingOnClose={config?.preferences.ask_thinking_on_close ?? true}
              />
            ) : (
              <EmptyWorkspaceHero
                onNewNote={handleCreateNote}
                onOpenPalette={() => setPaletteOpen(true)}
              />
            )}
            {historyOpen && activeNote && (
              <HistorySlider
                history={history}
                preview={historyPreview}
                currentBody={currentBody}
                noteTitle={activeNote.frontmatter.title}
                onHover={previewAtCheckpoint}
                onRestore={restoreAtCheckpoint}
                onClose={() => setHistoryOpen(false)}
              />
            )}
          </div>
        </section>

        {!focusMode && (
          <aside className="w-[320px] shrink-0 bg-s1 border-l border-bd flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-bd">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xs uppercase tracking-wider text-t3 font-semibold">
                    Connections graph
                  </div>
                  <span
                    className="y-tip text-t3 inline-flex"
                    data-tip="How this note relates to others. Drag to reposition."
                  >
                    <HelpIcon />
                  </span>
                </div>
                <ConnectionGraph
                  graph={graph}
                  activeSlug={activeSlug}
                  onSelect={selectSlug}
                />
              </div>
              <OpenQuestions
                questions={questions}
                onJump={(line) =>
                  setJumpSignal({ line, nonce: Date.now() })
                }
              />
              <Transclusions
                body={currentBody}
                notes={notes}
                onNavigate={selectSlug}
                refreshToken={restoreNonce}
              />
              <LinkedNotesList
                links={noteLinks}
                titleMap={titleMap}
                snippetMap={snippetMap}
                onNavigate={selectSlug}
                onAdd={() => setConnectOpen(true)}
                onRemove={handleRemoveConnection}
              />
            </div>
          </aside>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 max-w-[460px] bg-char text-bg text-xs px-3.5 py-2 rounded-md shadow-lg animate-fadeIn flex items-center gap-2">
          <span>{toast}</span>
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
        <span className="ml-auto flex items-center gap-2 truncate">
          <SyncStatusPill status={syncStatus} />
        </span>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        notes={notes}
        paths={paths}
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
      />

      <QuickSwitcher
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        notes={notes}
        activeSlug={activeSlug}
        onSelect={selectSlug}
      />

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

      <ForkMoment
        pathName={forkMoment}
        onDone={() => setForkMoment(null)}
      />

      {compareSession && (
        <PathDiff
          currentPath={currentPath}
          otherPath={compareSession}
          onClose={() => setCompareSession(null)}
        />
      )}

      {conflictSession && (
        <ConflictResolver
          relpaths={conflictSession.relpaths}
          currentPath={conflictSession.currentPath}
          otherPath={conflictSession.otherPath}
          onResolvedAll={onConflictsResolved}
          onAbort={onConflictAbort}
        />
      )}

      <Modal
        open={newPathOpen}
        onClose={() => setNewPathOpen(false)}
        title="What direction are you exploring?"
      >
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          Give this direction a short name. The version you have now stays
          safely on <span className="font-medium text-char">{currentPath}</span> —
          you can always come back.
        </p>
        <input
          autoFocus
          value={newPathName}
          onChange={(e) => setNewPathName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreatePath(); }}
          placeholder="e.g. the counterargument"
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {["the counterargument", "more hopeful take", "before I read X", "darker version"].map((s) => (
            <button
              key={s}
              onClick={() => setNewPathName(s)}
              className="text-2xs px-2 py-0.5 bg-s2 text-t2 rounded-full hover:bg-s3 hover:text-char transition"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setNewPathOpen(false)}
          >
            not now
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={handleCreatePath}
            disabled={!newPathName.trim()}
          >
            start exploring
          </button>
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
        title="Name this note"
      >
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          A short name is enough — you can always rename later. It lands on
          <span className="font-medium text-char"> {currentPath || "main"}</span>.
        </p>
        <input
          autoFocus
          value={newNoteTitle}
          onChange={(e) => setNewNoteTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmCreateNote(); }}
          placeholder="e.g. notes on attention"
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setNewNoteOpen(false)}
          >
            cancel
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={confirmCreateNote}
            disabled={!newNoteTitle.trim()}
          >
            create note
          </button>
        </div>
      </Modal>

      <Modal
        open={!!pendingSwitchPath}
        onClose={() => setPendingSwitchPath(null)}
        title="Switch paths with unsaved edits?"
      >
        <p className="text-sm text-t2 mb-4 leading-relaxed">
          Your draft on <span className="font-medium text-char">{currentPath}</span> will
          be saved first — nothing is lost. Then we hop over to{" "}
          <span className="font-medium text-char">{pendingSwitchPath}</span>.
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setPendingSwitchPath(null)}
          >
            stay here
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={async () => {
              const name = pendingSwitchPath;
              setPendingSwitchPath(null);
              if (name) await performSwitchPath(name);
            }}
          >
            save & switch
          </button>
        </div>
      </Modal>

      <QuickCapture
        open={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
      />

      {scratchpadOpen && (
        <Scratchpad
          onClose={() => setScratchpadOpen(false)}
          onPromoted={async () => {
            setScratchpadOpen(false);
            const list = await api.listNotes();
            setNotes(list);
            setGraph(await api.getGraph());
            setOrphanSet(new Set(await api.orphans()));
          }}
        />
      )}
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
