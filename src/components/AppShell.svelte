<script lang="ts">
  // Side-effect imports (UI prefs / paper textures applied to <html>
  // before first paint). Kept first so the saved choices land before
  // any chrome paints.
  import "../lib/uiPrefs.svelte";
  import "../lib/paperPrefs.svelte";

  import { onMount } from "svelte";
  import { api } from "../lib/tauri";
  import { tr } from "../lib/i18n/index.svelte";
  import { theme } from "../lib/theme.svelte";
  import { mode } from "../lib/mode.svelte";
  import { verboseAnnouncements } from "../lib/accessibilityPrefs.svelte";
  import {
    showRawMarkdown,
    editorFont,
    livePreview,
    cookMode,
  } from "../lib/editorPrefs.svelte";
  import { extraRadialMenu } from "../lib/extraPrefs.svelte";
  import { guidance } from "../lib/guidanceStore.svelte";
  import { recordWords } from "../plugins/writer/streak.svelte";
  import { newSourceBody, newSourceTitle } from "../plugins/researcher/sources";
  import {
    filterDecisions,
    newAdrBody,
    newAdrTitle,
  } from "../plugins/developer/adr";
  import { filterFollowUps } from "../plugins/clinician/clinical";
  import { filterRecipes } from "../plugins/cooking/cooking";
  import { openQuestions } from "../lib/forkDetection";
  import { relativeTime, todayIso } from "../lib/format";
  import { prefetchHeavyChunks } from "../lib/prefetch";
  import {
    getCachedOrReadNote,
    invalidateAllNotes,
    invalidateNote,
  } from "../lib/notePrefetch";
  import {
    SearchIcon,
    ChevronDownIcon,
    DeleteIcon,
    JournalIcon,
    ActivityIcon,
  } from "../lib/iconsSvelte";
  import StatusDot from "./StatusDot.svelte";
  import { SK } from "../lib/platform.svelte";
  import { workspaceAccent } from "../lib/workspaceAccent";
  import { MODE_DOT_CLASS, type ModeId } from "../lib/modes";
  import {
    forgetLeftOff,
    isHiddenLeftOff,
    readLeftOff,
    saveLeftOff,
    setHideLeftOff,
    snippetFromBody,
    type LeftOffState,
  } from "../lib/leftOff";
  import type {
    BranchTopo,
    Draft,
    EncryptionStatus,
    Graph,
    HistoryEntry,
    Keepsake,
    LinkType,
    Note,
    NoteSummary,
    PathCollectionsView,
    PathInfo,
    PathMeta,
    QuotaBlockInfo,
    TemplateInfo,
    WorkspaceConfig,
  } from "../lib/types";

  // Plugin imports — every persona ships Rail + StatusBar + modals.
  import WriterRail from "../plugins/writer/Rail.svelte";
  import WriterStatusBarWidget from "../plugins/writer/StatusBarWidget.svelte";
  import StreakModal from "../plugins/writer/StreakModal.svelte";
  import ResearcherRail from "../plugins/researcher/Rail.svelte";
  import ResearcherStatusBarWidget from "../plugins/researcher/StatusBarWidget.svelte";
  import ResearcherQuestionsModal from "../plugins/researcher/QuestionsModal.svelte";
  import SourcesModal from "../plugins/researcher/SourcesModal.svelte";
  import DeveloperRail from "../plugins/developer/Rail.svelte";
  import DeveloperStatusBarWidget from "../plugins/developer/StatusBarWidget.svelte";
  import DecisionLogModal from "../plugins/developer/DecisionLogModal.svelte";
  import ClinicianRail from "../plugins/clinician/Rail.svelte";
  import ClinicianStatusBarWidget from "../plugins/clinician/StatusBarWidget.svelte";
  import SensitiveModal from "../plugins/clinician/SensitiveModal.svelte";
  import FollowUpsModal from "../plugins/clinician/FollowUpsModal.svelte";
  import SessionKitModal from "../plugins/clinician/SessionKitModal.svelte";
  import CookingRail from "../plugins/cooking/Rail.svelte";
  import CookingStatusBarWidget from "../plugins/cooking/StatusBarWidget.svelte";
  import RecipesModal from "../plugins/cooking/RecipesModal.svelte";

  // First-class Svelte components.
  import Modal from "./Modal.svelte";
  import RightRail, { type RailOverlay } from "./RightRail.svelte";
  import TabBar from "./TabBar.svelte";
  import ModePickerOnboarding from "./ModePickerOnboarding.svelte";
  import RadialMenu from "./Editor/RadialMenu.svelte";
  import LinearContextMenu from "./Editor/LinearContextMenu.svelte";
  import {
    buildRadialInsertItems,
    buildRadialSelectionItems,
    buildLinearInsertItems,
    buildLinearSelectionItems,
    type RadialCallbacks,
  } from "./Editor/radialItems";
  import MainNotePrompt from "./MainNotePrompt.svelte";
  import NoteList from "./LeftSidebar/NoteList.svelte";
  import JournalCalendar from "./LeftSidebar/JournalCalendar.svelte";
  import Toolbar from "./Editor/Toolbar.svelte";
  import LinkedNotesList from "./RightSidebar/LinkedNotesList.svelte";
  import OpenQuestionsList from "./RightSidebar/OpenQuestions.svelte";
  import Outline from "./RightSidebar/Outline.svelte";
  import Transclusions from "./RightSidebar/Transclusions.svelte";
  import TimerPills from "./TimerPills.svelte";
  import RecipeClipperModal from "./RecipeClipperModal.svelte";
  import QuotaBlockedModal from "./QuotaBlockedModal.svelte";
  import ForkMoment from "./ForkMoment.svelte";
  import GuidanceHost from "./Guidance/GuidanceHost.svelte";
  import PathRibbon from "./Guidance/PathRibbon.svelte";
  import WhereYouLeftOffBanner from "./WhereYouLeftOffBanner.svelte";

  // Lazy-style modals. Vite handles the chunk split; the import
  // statements stay regular `import` and Svelte's `{#if}` controls
  // when the component is mounted.
  import HistorySlider from "./Editor/HistorySlider.svelte";
  import ConnectionGraph from "./RightSidebar/ConnectionGraph.svelte";
  import Scratchpad from "./Scratchpad.svelte";
  import Trash from "./Trash.svelte";
  import FindReplace from "./FindReplace.svelte";
  import PathCompare from "./PathCompare.svelte";
  import DecisionMatrix from "./DecisionMatrix.svelte";
  import ObsidianImport from "./ObsidianImport.svelte";
  import SpellMenu from "./SpellMenu.svelte";
  import QuickCapture from "./QuickCapture.svelte";
  import Settings from "./Settings.svelte";
  import CommandPalette from "./CommandPalette.svelte";
  import QuickSwitcher from "./QuickSwitcher.svelte";
  import ConflictResolver from "./ConflictResolver.svelte";
  import PathDiff from "./PathDiff.svelte";
  import PathsPane from "./PathsPane.svelte";
  import ConditionEditor from "./Paths/ConditionEditor.svelte";
  import UnlockPrompt from "./UnlockPrompt.svelte";
  import WikilinkPicker from "./WikilinkPicker.svelte";
  import ActivityHeatmap from "./ActivityHeatmap.svelte";
  import TagGraph from "./TagGraph.svelte";
  import TableInsertModal from "./TableInsertModal.svelte";
  import JournalKits from "./JournalKits.svelte";
  import CustomTemplatesModal from "./CustomTemplatesModal.svelte";
  import CalloutInsertModal from "./CalloutInsertModal.svelte";
  import TagBrowserModal from "./TagBrowserModal.svelte";
  import WorkspaceSwitcher from "./WorkspaceSwitcher.svelte";
  import NoteEditor from "./Editor/NoteEditor.svelte";
  import NoteReader from "./Editor/NoteReader.svelte";
  import OnboardingHints from "./OnboardingHints.svelte";
  import InlineDiffPane from "./InlineDiffPane.svelte";
  import QuickHandModal from "./Editor/center/QuickHandModal.svelte";
  import ConstellationModal from "./Editor/center/ConstellationModal.svelte";
  import InsertsModal from "./Editor/center/InsertsModal.svelte";
  import FormatModal from "./Editor/center/FormatModal.svelte";
  import TimerPickerModal from "./Editor/center/TimerPickerModal.svelte";

  type SyncStatus = "synced" | "pending" | "syncing" | "error" | "no-remote";
  type SettingsTab =
    | "mode"
    | "appearance"
    | "accessibility"
    | "writing"
    | "gestures"
    | "guidance"
    | "templates"
    | "sync"
    | "storage"
    | "security"
    | "workspace"
    | "shortcuts"
    | "help"
    | "about";

  /** A workspace has a "remote" in the sync sense if it's either wired
   *  up to a generic git remote or connected to a Yarrow server. */
  function hasRemote(
    cfg: { sync: { remote_url?: string; server?: unknown } } | null,
  ): boolean {
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

  let { workspacePath, onClose, onSwitchWorkspace }: Props = $props();

  let t = $derived(tr());

  // 3.0 — active mode/persona is exposed via the singleton store.
  let modeId = $derived(mode.id);
  let modeConfig = $derived(mode.config);

  // First-launch mode picker.
  let modePickerOpen = $state(false);
  onMount(() => {
    try {
      const shown = localStorage.getItem("yarrow.mode-picker.shown");
      const explicit = localStorage.getItem("yarrow.mode");
      if (shown || explicit) return;
    } catch { return; }
    const id = window.setTimeout(() => { modePickerOpen = true; }, 600);
    return () => window.clearTimeout(id);
  });
  function handleModePick(m: ModeId) {
    mode.set(m);
    try { localStorage.setItem("yarrow.mode-picker.shown", "true"); } catch { /* ignore */ }
    modePickerOpen = false;
  }
  function handleModeSkip() {
    try { localStorage.setItem("yarrow.mode-picker.shown", "true"); } catch { /* ignore */ }
    modePickerOpen = false;
  }

  // 3.0 — Developer-mode first-entry defaults: dracula + JetBrains Mono.
  $effect(() => {
    if (modeId !== "developer") return;
    const FLAG = `yarrow.developer.defaultsApplied:${workspacePath}`;
    try {
      if (localStorage.getItem(FLAG) === "true") return;
      theme.set("dracula");
      editorFont.set("jetbrains-mono");
      localStorage.setItem(FLAG, "true");
    } catch {
      theme.set("dracula");
      editorFont.set("jetbrains-mono");
    }
  });

  // 3.0 plugin modal opens.
  let streakModalOpen = $state(false);
  let lastWordCountRef: { slug: string; path: string; words: number } | null = null;
  let researcherQuestionsOpen = $state(false);
  let sourcesOpen = $state(false);
  let decisionLogOpen = $state(false);
  let sensitiveOpen = $state(false);
  let followUpsOpen = $state(false);
  let sessionKitOpen = $state(false);
  let recipesOpen = $state(false);

  // Editor prefs, exposed reactively for derived flags below.
  let showRawValue = $derived(showRawMarkdown.value);
  let livePreviewValue = $derived(livePreview.value);
  let cookModeValue = $derived(cookMode.value);
  let radialMenuOn = $derived(extraRadialMenu.value);
  let verboseAnnouncementsOn = $derived(verboseAnnouncements.value);

  // 2.2.0 Still Point press-and-hold modals.
  let quickHandOpen = $state(false);
  let constellationModalOpen = $state(false);
  let insertsModalOpen = $state(false);
  let formatModalOpen = $state<{ selection: string } | null>(null);
  let recipeClipperOpen = $state(false);
  let timerPickerOpen = $state(false);

  // Workspace + note state.
  let config = $state<WorkspaceConfig | null>(null);
  let mainNotePromptOpen = $state(false);
  let notes = $state<NoteSummary[]>([]);
  let paths = $state<PathInfo[]>([]);
  // Topology kept around even though unused as a render input — set on
  // refresh / sync; future surface (path tree visualisation v3) will
  // read it. The trivial reference below silences the unused-variable
  // check without a runtime cost.
  let topology = $state<BranchTopo[]>([]);
  $effect(() => { void topology; });
  let collectionsView = $state<PathCollectionsView | null>(null);
  let currentPath = $state<string>("");
  let graph = $state<Graph | null>(null);
  let orphanSet = $state<Set<string>>(new Set());
  let activeSlug = $state<string | null>(null);
  let activeNote = $state<Note | null>(null);

  // Tabs (3.1.0). Source of truth for what's open in each tab is
  // tabs[i].slug; activeSlug remains the primary read signal so the
  // ~20 sites that already write to it keep working unchanged. A
  // sync $effect mirrors activeSlug into the active tab's slug.
  // Opening a note replaces the active tab's content. Right-click →
  // "Open in new tab" creates a new tab via openInNewTab(slug).
  // Tabs persist per workspace via localStorage so reopening the app
  // restores the previous session's tab layout.
  type Tab = { slug: string | null };
  let tabsStorageKey = $derived(`yarrow.tabs:${workspacePath}`);
  function loadPersistedTabs(): { tabs: Tab[]; index: number } {
    try {
      const raw = localStorage.getItem(tabsStorageKey);
      if (!raw) return { tabs: [{ slug: null }], index: 0 };
      const parsed = JSON.parse(raw) as { tabs?: { slug: string | null }[]; index?: number };
      const t = Array.isArray(parsed?.tabs) && parsed.tabs.length > 0
        ? parsed.tabs.map((x) => ({ slug: typeof x?.slug === "string" ? x.slug : null }))
        : [{ slug: null }];
      const i = Number.isInteger(parsed?.index) && parsed.index! >= 0 && parsed.index! < t.length
        ? parsed.index!
        : 0;
      return { tabs: t, index: i };
    } catch {
      return { tabs: [{ slug: null }], index: 0 };
    }
  }
  // svelte-ignore state_referenced_locally
  let tabs = $state<Tab[]>(loadPersistedTabs().tabs);
  // svelte-ignore state_referenced_locally
  let activeTabIndex = $state(loadPersistedTabs().index);
  $effect(() => {
    const slug = activeSlug;
    const cur = tabs[activeTabIndex];
    if (cur && cur.slug !== slug) cur.slug = slug;
  });
  // Persist tabs whenever they change. Only write the slug — title is
  // recomputed at restore time from the current notes list.
  $effect(() => {
    void tabs;
    void activeTabIndex;
    try {
      localStorage.setItem(
        tabsStorageKey,
        JSON.stringify({
          tabs: tabs.map((t) => ({ slug: t.slug })),
          index: activeTabIndex,
        }),
      );
    } catch { /* quota / private mode — non-fatal */ }
  });
  // After notes load, drop tabs whose persisted slug no longer exists.
  // Keeps the tab bar honest after notes are deleted between sessions.
  let prunedOnce = false;
  $effect(() => {
    if (prunedOnce) return;
    if (notes.length === 0) return;
    const slugs = new Set(notes.map((n) => n.slug));
    const next = tabs.filter((t) => t.slug == null || slugs.has(t.slug));
    if (next.length === 0) {
      tabs = [{ slug: null }];
      activeTabIndex = 0;
    } else if (next.length !== tabs.length) {
      const prevActiveSlug = tabs[activeTabIndex]?.slug ?? null;
      tabs = next;
      const newIndex = next.findIndex((t) => t.slug === prevActiveSlug);
      activeTabIndex = newIndex >= 0 ? newIndex : Math.min(activeTabIndex, next.length - 1);
    }
    // After the first persisted tab adopts a real slug, mirror it into
    // activeSlug so the editor mounts the right note on cold start.
    const restoredSlug = tabs[activeTabIndex]?.slug ?? null;
    if (restoredSlug && activeSlug !== restoredSlug) activeSlug = restoredSlug;
    prunedOnce = true;
  });
  function openInNewTab(slug: string) {
    tabs = [...tabs, { slug }];
    activeTabIndex = tabs.length - 1;
    activeSlug = slug;
  }
  function switchTab(index: number) {
    if (index < 0 || index >= tabs.length || index === activeTabIndex) return;
    activeTabIndex = index;
    activeSlug = tabs[index].slug;
  }
  function closeTab(index: number) {
    if (tabs.length <= 1) return;
    const wasActive = index === activeTabIndex;
    tabs = tabs.filter((_, i) => i !== index);
    if (wasActive) {
      const next = Math.min(activeTabIndex, tabs.length - 1);
      activeTabIndex = next;
      activeSlug = tabs[next].slug;
    } else if (activeTabIndex > index) {
      activeTabIndex--;
    }
  }
  function newBlankTab() {
    tabs = [...tabs, { slug: null }];
    activeTabIndex = tabs.length - 1;
    activeSlug = null;
  }
  let tabsView = $derived(
    tabs.map((tab) => {
      const note = tab.slug ? notes.find((n) => n.slug === tab.slug) : null;
      return { slug: tab.slug, title: note?.title || tab.slug || "" };
    }),
  );
  let activeDrafts = $state<Draft[]>([]);
  let draftsReloadNonce = $state(0);
  let divergingPaths = $state<string[]>([]);
  let noteReloadNonce = $state(0);
  // svelte-ignore state_referenced_locally
  let leftOff = $state<LeftOffState | null>(
    isHiddenLeftOff(workspacePath) ? null : readLeftOff(workspacePath),
  );
  let currentBody = $state<string>("");
  let focusMode = $state(false);
  let workspaceSwitcherOpen = $state(false);
  let workspaceChipRef = $state<HTMLButtonElement | null>(null);
  let selectionWords = $state(0);
  let selectionChars = $state(0);
  let scratchpadOpen = $state(false);
  let trashOpen = $state(false);
  let trashCount = $state(0);
  let findReplaceOpen = $state(false);
  let obsidianImportOpen = $state(false);
  let pathCompareOpen = $state(false);
  let decisionMatrixOpen = $state(false);
  let journalCalendar = $state<{ open: boolean; anchor: DOMRect | null }>({
    open: false,
    anchor: null,
  });
  let renamePrompt = $state<
    { slug: string; nextTitle: string; refs: number } | null
  >(null);
  let titleRevertNonce = $state(0);
  function cancelRename() {
    renamePrompt = null;
    titleRevertNonce++;
  }
  let findReplaceResult = $state<{ changed: number; total: number } | null>(
    null,
  );
  let quotaBlock = $state<QuotaBlockInfo | null>(null);
  let quotaModalOpen = $state(false);
  let spellMenu = $state<{
    word: string;
    suggestions: string[];
    from: number;
    to: number;
    x: number;
    y: number;
  } | null>(null);
  // svelte-ignore state_referenced_locally
  let scratchpadWidth = $state<number>(
    (() => {
      const raw =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("yarrow.scratchpadWidth")
          : null;
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n >= 280 && n <= 640 ? n : 360;
    })(),
  );
  function saveScratchpadWidth(w: number) {
    scratchpadWidth = w;
    try { localStorage.setItem("yarrow.scratchpadWidth", String(w)); } catch { /* quota */ }
  }
  // svelte-ignore state_referenced_locally
  let leftSidebarWidth = $state<number>(
    (() => {
      const raw =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("yarrow.leftSidebarWidth")
          : null;
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n >= 200 && n <= 480 ? n : 268;
    })(),
  );
  function saveLeftSidebarWidth(w: number) {
    leftSidebarWidth = w;
    try { localStorage.setItem("yarrow.leftSidebarWidth", String(w)); } catch { /* quota */ }
  }
  let leftResizingRef: { startX: number; startW: number } | null = null;
  function onLeftResizeStart(e: MouseEvent) {
    leftResizingRef = { startX: e.clientX, startW: leftSidebarWidth };
    const onMove = (ev: MouseEvent) => {
      const r = leftResizingRef;
      if (!r) return;
      const dx = ev.clientX - r.startX;
      const next = Math.max(200, Math.min(480, r.startW + dx));
      saveLeftSidebarWidth(next);
    };
    const onUp = () => {
      leftResizingRef = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  let quickCaptureOpen = $state(false);
  let historyOpen = $state(false);
  let history = $state<HistoryEntry[]>([]);
  let historyPreview = $state<string | null>(null);
  let keepsakes = $state<Keepsake[]>([]);
  let restoreNonce = $state(0);
  let syncStatus = $state<SyncStatus>("pending");
  let syncMessage = $state<string>("");
  let verboseAnnouncement = $state<string>("");
  function announce(msg: string) {
    if (!verboseAnnouncementsOn) return;
    verboseAnnouncement = "";
    window.setTimeout(() => { verboseAnnouncement = msg; }, 30);
  }
  // svelte-ignore state_referenced_locally
  let lastSyncedAt = $state<number | null>(
    (() => {
      if (!workspacePath) return null;
      try {
        const raw = localStorage.getItem(`yarrow.lastSyncedAt:${workspacePath}`);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) && n > 0 ? n : null;
      } catch {
        return null;
      }
    })(),
  );
  let remotePresent = $derived(hasRemote(config));
  $effect(() => {
    const cur = syncStatus;
    if (remotePresent && cur === "no-remote") syncStatus = "pending";
    else if (!remotePresent && cur !== "no-remote") syncStatus = "no-remote";
  });
  let dirty = $state(false);
  let jumpSignal = $state<{ line: number; nonce: number } | undefined>(undefined);

  let paletteOpen = $state(false);
  let switcherOpen = $state(false);
  let newPathOpen = $state(false);
  let newPathName = $state("");
  let newPathCondition = $state("");
  let newPathFrom = $state<string>("");
  let connectOpen = $state(false);
  let connectTarget = $state("");
  let connectType = $state<LinkType>("supports");
  let settingsOpen = $state<{ open: boolean; tab?: SettingsTab }>({
    open: false,
  });
  let confirmState = $state<{
    title: string;
    body: string;
    onConfirm: () => void;
  } | null>(null);
  let forkMoment = $state<string | null>(null);
  let inlineDiffOpen = $state(false);
  let toast = $state<
    | string
    | {
        text: string;
        action?: { label: string; run: () => void };
        ttlMs?: number;
        tone?: "info" | "success" | "soft";
      }
    | null
  >(null);
  let tagFilter = $state<string | null>(null);
  let templates = $state<TemplateInfo[]>([]);
  let customTemplatesCount = $derived(
    templates.filter((tpl) => tpl.is_bundled === false).length,
  );
  let encryption = $state<EncryptionStatus>({
    enabled: false,
    unlocked: false,
    idle_timeout_secs: 900,
  });
  let unlockOpen = $state(false);
  let unlockReason = $state<string | undefined>(undefined);
  let templatePickerOpen = $state(false);
  let kitsPickerOpen = $state(false);
  let customTemplatesOpen = $state(false);
  let tagBrowserOpen = $state(false);
  let pendingTemplate = $state<string | null>(null);
  let templateTitle = $state("");
  let asyncEpoch = 0;
  let navStackRef: string[] = [];
  let isPoppingRef = false;
  let navStackVer = $state(0);
  function selectSlug(slug: string | null) {
    asyncEpoch++;
    const prev = activeSlug;
    if (!isPoppingRef && prev && slug && prev !== slug) {
      navStackRef.push(prev);
      if (navStackRef.length > 32) navStackRef.shift();
      navStackVer++;
    }
    isPoppingRef = false;
    activeSlug = slug;
    if (slug) {
      void import("./Editor/extensions/wikilinkAutocomplete").then((m) =>
        m.markOpenedSlug(slug),
      );
    }
  }
  function goBack() {
    if (navStackRef.length === 0) return;
    const prev = navStackRef.pop()!;
    navStackVer++;
    isPoppingRef = true;
    asyncEpoch++;
    activeSlug = prev;
    void import("./Editor/extensions/wikilinkAutocomplete").then((m) =>
      m.markOpenedSlug(prev),
    );
  }
  let newNoteOpen = $state(false);
  let newNoteTitle = $state("");
  let newNoteTemplate = $state<string | null>(null);
  let conflictSession = $state<{
    relpaths: string[];
    currentPath: string;
    otherPath: string;
  } | null>(null);
  let railOverlay = $state<RailOverlay | null>(null);
  let checkpointCount = $state<number>(0);
  let lastSavedAt = $state<number>(0);
  let editorCtxMenu = $state<
    { text: string; x: number; y: number } | null
  >(null);
  let cookingOn = $derived(modeConfig.persona === "cooking");
  let wikilinkPickerOpen = $state(false);
  let activityOpen = $state(false);
  let tagGraphOpen = $state(false);
  let tableInsertOpen = $state(false);
  let calloutInsertOpen = $state(false);
  let scratchpadReloadNonce = $state(0);
  let editConditionFor = $state<string | null>(null);
  let mapFilter = $state<{ collectionName: string } | null>(null);
  let compareSession = $state<string | null>(null);
  let mainBody = $state<string | null>(null);

  // Mapping mode flag — read off config.mapping each render.
  let mappingEnabledRef = true;
  $effect(() => {
    mappingEnabledRef = (config?.mapping?.mode ?? "mapped") === "mapped";
  });

  const EMPTY_GRAPH: Graph = {
    notes: [],
    links: [],
    last_built: "",
    tags: [],
  };
  function fetchGraph(): Promise<Graph> {
    if (!mappingEnabledRef) return Promise.resolve(EMPTY_GRAPH);
    return api.getGraph();
  }
  function fetchOrphans(): Promise<string[]> {
    if (!mappingEnabledRef) return Promise.resolve([]);
    return api.orphans();
  }
  function fetchTopology(): Promise<BranchTopo[]> {
    if (!mappingEnabledRef) return Promise.resolve([]);
    return api.branchTopology();
  }
  function fetchPaths(): Promise<PathInfo[]> {
    if (!mappingEnabledRef) return Promise.resolve([]);
    return api.listPaths();
  }
  function fetchPathCollections() {
    if (!mappingEnabledRef) {
      return Promise.resolve({
        root: "main",
        collections: [],
      } as PathCollectionsView);
    }
    return api.listPathCollections();
  }

  // ───────── REFRESH HANDLERS ─────────

  async function refreshAll() {
    const cfg = await api.readConfig();
    const isMapped = (cfg?.mapping?.mode ?? "mapped") === "mapped";

    const corePromises = Promise.all([
      api.listNotes(),
      api.listTemplates().catch(() => [] as TemplateInfo[]),
      api
        .encryptionStatus()
        .catch(() => ({
          enabled: false,
          unlocked: false,
          idle_timeout_secs: 900,
        })),
      api.listTrash().catch(() => [] as Note[]),
    ]);
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

    const [coreResults, mappingResults] = await Promise.all([
      corePromises,
      mappingPromises,
    ]);
    const [list, tpls, encStatus, trash] = coreResults;

    config = cfg;
    templates = tpls;
    trashCount = trash.length;
    encryption = encStatus;
    notes = list;
    syncStatus = hasRemote(cfg) ? "pending" : "no-remote";
    focusMode = cfg.preferences.focus_mode_default;

    if (mappingResults) {
      const [pathList, cur, g, topo, orphansList, merging] = mappingResults;
      paths = pathList;
      currentPath = cur;
      graph = g;
      topology = topo;
      orphanSet = new Set(orphansList);
      if (merging) {
        const relpaths = await api.listConflicts();
        if (relpaths.length > 0) {
          conflictSession = {
            relpaths,
            currentPath: cur,
            otherPath: "incoming",
          };
        }
      }
    } else {
      paths = [];
      currentPath = "main";
      graph = EMPTY_GRAPH;
      topology = [];
      orphanSet = new Set();
    }
  }

  async function refreshPathAwareness() {
    try {
      const v = await fetchPathCollections();
      collectionsView = v;
    } catch (e) {
      console.warn("path awareness refresh failed", e);
    }
  }

  $effect(() => {
    void workspacePath;
    void refreshAll();
  });
  $effect(() => {
    void workspacePath;
    void refreshPathAwareness();
  });

  // Keep currentPath aligned with v2 collections.
  $effect(() => {
    if (!collectionsView) return;
    const names = new Set(collectionsView.collections.map((c) => c.name));
    if (!currentPath || !names.has(currentPath)) {
      currentPath = collectionsView.root;
    }
  });

  // Drop inline-diff toggle on slug/path change.
  $effect(() => {
    void activeSlug;
    void currentPath;
    inlineDiffOpen = false;
  });

  // Detect "returned to main" transition.
  let prevPathRef = "";
  $effect(() => {
    const prev = prevPathRef;
    const cur = currentPath;
    prevPathRef = cur;
    if (!prev || !cur || prev === cur) return;
    const root = collectionsView?.root ?? "main";
    const isMain = (p: string) => p === root || p === "main" || p === "master";
    if (!isMain(prev) && isMain(cur)) {
      guidance.trigger("path.returnedToMain", {
        onPrimary: () => { pathCompareOpen = true; },
      });
    }
  });

  // Flatten collections for legacy consumers.
  let pathNotes = $derived.by(() => {
    const out: Record<string, string[]> = {};
    if (!collectionsView) return out;
    for (const c of collectionsView.collections) out[c.name] = [...c.members];
    return out;
  });

  let pathColorOverrides = $derived.by(() => {
    const out: Record<string, string> = {};
    for (const c of collectionsView?.collections ?? []) {
      if (c.color) out[c.name] = c.color;
    }
    return out;
  });

  let pathMetaMap = $derived.by(() => {
    const out: Record<string, PathMeta> = {};
    if (!collectionsView) return out;
    for (const c of collectionsView.collections) {
      out[c.name] = { condition: c.condition, set_at: c.created_at || null };
    }
    return out;
  });

  // Seed "branch from" picker when dialog opens.
  $effect(() => {
    if (!newPathOpen) return;
    if (newPathFrom) return;
    const rootName = collectionsView?.root || "main";
    newPathFrom = rootName;
  });

  $effect(() => {
    if (config === null) return;
    const isMapped = (config.mapping?.mode ?? "mapped") === "mapped";
    prefetchHeavyChunks(isMapped);
  });

  $effect(() => {
    const px = config?.preferences.editor_font_size ?? 16;
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${px}px`,
    );
  });

  // Restore last active slug — only on initial workspace mount. Once
  // the user has navigated (or explicitly opened a blank tab), null
  // means "blank by intent" and we must not stomp on it.
  let didInitialRestore = false;
  $effect(() => {
    if (didInitialRestore) return;
    if (activeSlug == null && notes.length > 0) {
      const key = `yarrow.lastActive:${workspacePath}`;
      let pick: string | null = null;
      try { pick = localStorage.getItem(key); } catch { /* ignore */ }
      const lastActiveExists = pick && notes.some((n) => n.slug === pick);
      const mainNote = config?.mapping?.main_note ?? null;
      const mainNoteExists = mainNote && notes.some((n) => n.slug === mainNote);
      activeSlug = lastActiveExists
        ? pick
        : mainNoteExists
          ? mainNote
          : notes[0].slug;
      didInitialRestore = true;
    } else if (activeSlug != null) {
      didInitialRestore = true;
    }
  });

  $effect(() => {
    if (!activeSlug) return;
    try {
      localStorage.setItem(`yarrow.lastActive:${workspacePath}`, activeSlug);
    } catch { /* ignore */ }
  });

  // Lightweight prefetch of history length. Re-runs on every save
  // (lastSavedAt updates) so the toolbar's "N checkpoints" pill stays
  // current — previously it only refreshed when activeSlug changed,
  // so users had to navigate away and back to see new checkpoints.
  $effect(() => {
    if (!activeSlug) {
      checkpointCount = 0;
      return;
    }
    const slug = activeSlug;
    let alive = true;
    void currentPath;
    void restoreNonce;
    void lastSavedAt;
    api.noteHistory(slug)
      .then((h) => { if (alive) checkpointCount = h.length; })
      .catch(() => { if (alive) checkpointCount = 0; });
    return () => { alive = false; };
  });

  $effect(() => {
    if (!activeSlug) {
      mainBody = null;
      return;
    }
    const modeMapped = (config?.mapping?.mode ?? "mapped") === "mapped";
    if (!modeMapped) {
      mainBody = null;
      return;
    }
    const rootName = collectionsView?.root ?? "main";
    const onMain =
      !currentPath ||
      currentPath === rootName ||
      currentPath === "main" ||
      currentPath === "master";
    if (onMain) {
      mainBody = null;
      return;
    }
    let alive = true;
    getCachedOrReadNote(activeSlug)
      .then((n) => { if (alive) mainBody = n.body; })
      .catch(() => { if (alive) mainBody = null; });
    return () => { alive = false; };
  });

  $effect(() => {
    if (!activeSlug) {
      activeNote = null;
      return;
    }
    let alive = true;
    void noteReloadNonce;
    void encryption.unlocked;
    const rootName = collectionsView?.root ?? "main";
    const onMain =
      !currentPath ||
      currentPath === rootName ||
      currentPath === "main" ||
      currentPath === "master";
    const promise = onMain
      ? getCachedOrReadNote(activeSlug)
      : api.readNoteOnPath(activeSlug, currentPath);
    promise
      .then((n) => {
        if (!alive) return;
        activeNote = n;
        currentBody = n.body;
      })
      .catch(() => {
        if (!alive) return;
        activeNote = null;
      });
    return () => { alive = false; };
  });

  $effect(() => {
    if (!activeSlug) {
      activeDrafts = [];
      return;
    }
    let alive = true;
    void draftsReloadNonce;
    api
      .draftListForNote(activeSlug)
      .then((list) => { if (alive) activeDrafts = list; })
      .catch(() => { if (alive) activeDrafts = []; });
    return () => { alive = false; };
  });

  $effect(() => {
    if (!activeSlug) {
      divergingPaths = [];
      return;
    }
    let alive = true;
    void noteReloadNonce;
    api
      .pathsDivergingForNote(activeSlug)
      .then((list) => { if (alive) divergingPaths = list; })
      .catch(() => { if (alive) divergingPaths = []; });
    return () => { alive = false; };
  });

  $effect(() => {
    void workspacePath;
    let cancelled = false;
    void (async () => {
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
  });

  // ───────── ENCRYPTION ─────────

  async function refreshEncryption(): Promise<EncryptionStatus> {
    try {
      const s = await api.encryptionStatus();
      encryption = s;
      return s;
    } catch {
      return encryption;
    }
  }

  async function broadcastEncryptionChanged() {
    await refreshEncryption();
    window.dispatchEvent(new Event("yarrow:encryption-changed"));
  }

  function requestUnlock(reason?: string) {
    unlockReason = reason;
    unlockOpen = true;
  }

  async function handleLockEncryption() {
    try { await api.lockEncryption(); } catch { /* best effort */ }
    await broadcastEncryptionChanged();
    if (activeSlug && activeNote?.encrypted) {
      try {
        const n = await api.readNote(activeSlug);
        activeNote = n;
        currentBody = n.body;
      } catch { /* ignore */ }
    }
    toast = { text: t("appshell.toast.encryptedSession"), tone: "soft" };
  }

  async function onUnlocked() {
    unlockOpen = false;
    invalidateAllNotes();
    await broadcastEncryptionChanged();
    if (activeSlug) {
      try {
        const n = await api.readNote(activeSlug);
        activeNote = n;
        currentBody = n.body;
      } catch { /* ignore */ }
    }
  }

  async function handleEncryptNoteBySlug(slug: string) {
    if (!encryption.enabled) {
      toast = { text: t("appshell.toast.enableEncryptionFirst"), tone: "soft" };
      settingsOpen = { open: true, tab: "security" };
      return;
    }
    if (!encryption.unlocked) {
      requestUnlock(t("appshell.toast.unlockToEncrypt"));
      return;
    }
    try {
      const n = await api.encryptNote(slug);
      if (activeSlug === slug) {
        activeNote = n;
        currentBody = n.body;
      }
      invalidateAllNotes();
      notes = await api.listNotes();
      toast = t("appshell.toast.encrypted", { title: n.frontmatter.title || slug });
    } catch (e) {
      toast = t("appshell.toast.encryptError", { error: String(e) });
    }
  }

  async function handleDecryptNoteBySlug(slug: string) {
    if (!encryption.unlocked) {
      requestUnlock(t("appshell.toast.unlockToDecrypt"));
      return;
    }
    try {
      const n = await api.decryptNote(slug);
      if (activeSlug === slug) {
        activeNote = n;
        currentBody = n.body;
      }
      notes = await api.listNotes();
      toast = {
        text: t("appshell.toast.decrypted", { title: n.frontmatter.title || slug }),
        tone: "success",
      };
    } catch (e) {
      toast = t("appshell.toast.decryptError", { error: String(e) });
    }
  }

  function handleEncryptActiveNote() {
    if (!activeSlug) return;
    handleEncryptNoteBySlug(activeSlug);
  }

  function handleDecryptActiveNote() {
    if (!activeSlug) return;
    handleDecryptNoteBySlug(activeSlug);
  }

  // ───────── PRINT ─────────

  function printHtml(html: string) {
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
      setTimeout(() => {
        try { iframe.remove(); } catch { /* ignore */ }
      }, delay);
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
    setTimeout(() => cleanup(0), 30000);
    iframe.srcdoc = html;
  }

  async function printActiveNote(slug: string) {
    try {
      const html = await api.renderNoteHtml(slug);
      printHtml(html);
    } catch (e) {
      toast = t("appshell.toast.printError", { error: String(e) });
    }
  }

  async function printActivePath(pathName: string) {
    try {
      const html = await api.renderPathHtml(pathName);
      printHtml(html);
    } catch (e) {
      toast = t("appshell.toast.printError", { error: String(e) });
    }
  }

  // ───────── NOTE CRUD + PATH HANDLERS ─────────

  function handleCreateNote(prefilledTitle?: string) {
    const safeTitle = typeof prefilledTitle === "string" ? prefilledTitle : "";
    newNoteTitle = safeTitle;
    newNoteTemplate = null;
    newNoteOpen = true;
  }

  async function handleCreateSource() {
    try {
      const note = await api.createNote(newSourceTitle());
      await api.saveNote(note.slug, newSourceBody());
      await api.setTags(note.slug, ["source"]);
      invalidateNote(note.slug);
      notes = await api.listNotes();
      try { graph = await fetchGraph(); } catch { /* ignore */ }
      activeSlug = note.slug;
    } catch (e) {
      toast = {
        text: t("appshell.toast.createFromKitError", { error: String(e) }),
        tone: "soft",
      };
    }
  }

  async function handleCreateAdr() {
    try {
      const note = await api.createNote(newAdrTitle());
      await api.saveNote(note.slug, newAdrBody());
      await api.setTags(note.slug, ["decision"]);
      invalidateNote(note.slug);
      notes = await api.listNotes();
      try { graph = await fetchGraph(); } catch { /* ignore */ }
      activeSlug = note.slug;
    } catch (e) {
      toast = {
        text: t("appshell.toast.createFromKitError", { error: String(e) }),
        tone: "soft",
      };
    }
  }

  async function handlePickSessionKit(template: string, title: string) {
    try {
      const note = await api.createFromTemplate(template, title);
      invalidateNote(note.slug);
      notes = await api.listNotes();
      try { graph = await fetchGraph(); } catch { /* ignore */ }
      activeSlug = note.slug;
    } catch (e) {
      toast = {
        text: t("appshell.toast.createFromKitError", { error: String(e) }),
        tone: "soft",
      };
    }
  }

  async function handleAddToShoppingList() {
    if (!activeSlug) return;
    try {
      const out = await api.addRecipeToShoppingList(activeSlug);
      if (out.added === 0 && out.skipped_duplicates === 0) {
        toast = { text: t("appshell.toast.shoppingListEmpty"), tone: "soft" };
      } else {
        const dupes =
          out.skipped_duplicates > 0
            ? t("appshell.toast.shoppingListDupes", {
                skipped: String(out.skipped_duplicates),
              })
            : "";
        toast = {
          text: t("appshell.toast.shoppingListAdded", {
            added: String(out.added),
            source: out.source_title,
            dupes,
          }),
          tone: "success",
        };
        try { notes = await api.listNotes(); } catch { /* ignore */ }
      }
    } catch (e) {
      toast = String(e);
    }
  }

  async function handleOpenDaily(dateIso?: string) {
    const iso = dateIso ?? todayIso();
    const myEpoch = ++asyncEpoch;
    try {
      const { note, switched_from } = await api.openDaily(iso);
      if (myEpoch !== asyncEpoch) return;
      if (switched_from) {
        const [cur, pathList, topo, g, list] = await Promise.all([
          api.currentPath(),
          fetchPaths(),
          fetchTopology(),
          fetchGraph(),
          api.listNotes(),
        ]);
        if (myEpoch !== asyncEpoch) return;
        currentPath = cur;
        paths = pathList;
        topology = topo;
        graph = g;
        notes = list;
        toast = {
          text: t("appshell.toast.journalSwitched", { from: switched_from }),
          tone: "soft",
        };
      }
      activeSlug = note.slug;
      activeNote = note;
      currentBody = note.body;
    } catch (e) {
      if (myEpoch === asyncEpoch) console.error("open daily failed", e);
    }
  }

  // queue topology refresh — debounced.
  let topologyRefreshTimer: number | null = null;
  function queueTopologyRefresh() {
    if (topologyRefreshTimer)
      window.clearTimeout(topologyRefreshTimer);
    topologyRefreshTimer = window.setTimeout(async () => {
      try { topology = await fetchTopology(); } catch { /* ignore */ }
    }, 1500);
  }

  async function handleSave(
    slug: string,
    body: string,
    thinking?: string,
    path?: string,
  ) {
    if (!slug) return;
    try {
      const cleaned = body.replace(/\[\[([^\]]+)\]\]/g, "$1");
      const w = cleaned.trim().match(/\S+/g)?.length ?? 0;
      const key = path ?? currentPath ?? "";
      const ref = lastWordCountRef;
      if (!ref || ref.slug !== slug || ref.path !== key) {
        lastWordCountRef = { slug, path: key, words: w };
      } else {
        const delta = w - ref.words;
        if (delta > 0) recordWords(delta);
        lastWordCountRef = { slug, path: key, words: w };
      }
    } catch { /* ignore */ }
    const rootName = collectionsView?.root ?? "main";
    const pathIsMain = (p: string) =>
      !p || p === rootName || p === "main" || p === "master";
    const effectivePath = path ?? currentPath;
    const onMain = pathIsMain(effectivePath);
    const stillOnSavePath =
      effectivePath === currentPath ||
      (pathIsMain(effectivePath) && pathIsMain(currentPath));
    try {
      if (!onMain) {
        const note = await api.saveNoteOnPath(
          slug,
          body,
          effectivePath,
          thinking,
        );
        if (slug === activeSlug && stillOnSavePath) {
          activeNote = note;
          currentBody = note.body;
          dirty = false;
        }
        lastSavedAt = Date.now();
        announce(t("appshell.announce.saved"));
        return;
      }
      const out = await api.saveNoteFull(slug, body, thinking);
      invalidateNote(slug);
      if (slug === activeSlug && stillOnSavePath) {
        activeNote = out.note;
        currentBody = out.note.body;
        dirty = false;
      }
      if (!out.changed) return;
      announce(t("appshell.announce.checkpointSaved"));
      syncStatus = syncStatus === "no-remote" ? "no-remote" : "pending";
      notes = out.notes;
      graph = out.graph;
      orphanSet = new Set(out.orphans);
      lastSavedAt = Date.now();
      queueTopologyRefresh();
    } catch (e) {
      console.error("save failed", e);
    }
  }

  async function performRename(
    slug: string,
    nextTitle: string,
    rewriteWikilinks: boolean,
  ) {
    try {
      const n = await api.renameNote(slug, nextTitle, rewriteWikilinks);
      const list = await api.listNotes();
      notes = list;
      if (activeSlug === slug) activeSlug = n.slug;
      graph = await fetchGraph();
      if (rewriteWikilinks) invalidateAllNotes();
    } catch (e) {
      toast = t("appshell.toast.renameError", { error: String(e) });
      titleRevertNonce++;
    }
  }

  async function handleRenameNote(slug: string, nextTitle: string) {
    let refs = 0;
    try { refs = await api.countWikilinkReferences(slug); } catch { /* ignore */ }
    if (refs === 0) {
      await performRename(slug, nextTitle, false);
      return;
    }
    renamePrompt = { slug, nextTitle, refs };
  }

  async function handleTogglePin(slug: string, pinned: boolean) {
    await api.setPinned(slug, pinned);
    const list = await api.listNotes();
    notes = list;
  }

  async function handleMoveToFolder(slug: string, folder: string | null) {
    try {
      await api.setNoteFolder(slug, folder);
      const list = await api.listNotes();
      notes = list;
      const label = folder
        ? t("appshell.toast.movedToFolder", { folder })
        : t("appshell.toast.movedOutOfFolder");
      toast = { text: label, tone: "success" };
    } catch (e) {
      toast = {
        text: t("appshell.toast.moveError", { error: String(e) }),
        tone: "soft",
      };
    }
  }

  async function handleDeleteNote(slug: string) {
    let snapshot: {
      title: string;
      body: string;
      tags: string[];
      pinned: boolean;
    } | null = null;
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
      confirmState = {
        title: t("appshell.deleteLocked.title"),
        body: t("appshell.deleteLocked.body"),
        onConfirm: async () => {
          await api.deleteNote(slug);
          const list = await api.listNotes();
          notes = list;
          if (activeSlug === slug) activeSlug = list[0]?.slug ?? null;
          graph = await fetchGraph();
          orphanSet = new Set(await fetchOrphans());
          confirmState = null;
        },
      };
      return;
    }

    await api.deleteNote(slug);
    const list = await api.listNotes();
    notes = list;
    if (activeSlug === slug) activeSlug = list[0]?.slug ?? null;
    graph = await fetchGraph();
    orphanSet = new Set(await fetchOrphans());
    let trashedStorageSlug: string | null = null;
    try {
      const trash = await api.listTrash();
      trashCount = trash.length;
      trashedStorageSlug = trash[0]?.slug ?? null;
    } catch { /* ignore */ }

    toast = {
      text: t("appshell.toast.deleted", { title: snapshot.title }),
      ttlMs: 10000,
      action: {
        label: t("appshell.toast.undoLabel"),
        run: async () => {
          try {
            if (trashedStorageSlug) {
              const restoredSlug = await api.restoreFromTrash(trashedStorageSlug);
              const next = await api.listNotes();
              notes = next;
              graph = await fetchGraph();
              orphanSet = new Set(await fetchOrphans());
              activeSlug = restoredSlug;
              try { trashCount = (await api.listTrash()).length; } catch { /* ignore */ }
              return;
            }
            const fresh = await api.createNote(snapshot!.title);
            await api.saveNote(fresh.slug, snapshot!.body);
            if (snapshot!.tags.length > 0) {
              try { await api.setTags(fresh.slug, snapshot!.tags); } catch { /* ignore */ }
            }
            if (snapshot!.pinned) {
              try { await api.setPinned(fresh.slug, true); } catch { /* ignore */ }
            }
            const next = await api.listNotes();
            notes = next;
            graph = await fetchGraph();
            orphanSet = new Set(await fetchOrphans());
            activeSlug = fresh.slug;
            try { trashCount = (await api.listTrash()).length; } catch { /* ignore */ }
          } catch (e) {
            toast = t("appshell.toast.undoError", { error: String(e) });
          }
        },
      },
    };
  }

  async function handleRevealNote(slug: string) {
    try {
      const abs = await api.noteAbsolutePath(slug);
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(abs);
    } catch (e) {
      toast = t("appshell.toast.revealError", { error: String(e) });
    }
  }

  async function handleSendSelectionToScratchpad(text: string) {
    try {
      await api.appendScratchpad(text);
      scratchpadReloadNonce++;
      if (!scratchpadOpen) scratchpadOpen = true;
      toast = {
        text: t("appshell.toast.sentToScratchpad", {
          count: String(text.trim().match(/\S+/g)?.length ?? 0),
        }),
        tone: "success",
      };
    } catch (e) {
      toast = t("appshell.toast.scratchpadError", { error: String(e) });
    }
  }

  async function handleCopyNoteAsMarkdown(slug: string) {
    try {
      const n = await api.readNote(slug);
      if (n.locked) {
        toast = { text: t("appshell.toast.unlockToCopy"), tone: "soft" };
        return;
      }
      const title = n.frontmatter.title?.trim() || n.slug;
      const md = `# ${title}\n\n${n.body}`.trimEnd() + "\n";
      await navigator.clipboard.writeText(md);
      toast = {
        text: t("appshell.toast.copiedAsMarkdown", { title }),
        tone: "success",
      };
    } catch (e) {
      toast = t("appshell.toast.copyError", { error: String(e) });
    }
  }

  function handleDeleteMany(slugs: string[]) {
    if (slugs.length === 0) return;
    confirmState = {
      title:
        slugs.length === 1
          ? t("appshell.deleteMany.titleSingle", { count: String(slugs.length) })
          : t("appshell.deleteMany.titlePlural", { count: String(slugs.length) }),
      body: t("appshell.deleteMany.body"),
      onConfirm: async () => {
        for (const s of slugs) {
          try { await api.deleteNote(s); } catch (e) { console.error("delete failed", s, e); }
        }
        const list = await api.listNotes();
        notes = list;
        if (activeSlug && slugs.includes(activeSlug)) {
          activeSlug = list[0]?.slug ?? null;
        }
        graph = await fetchGraph();
        orphanSet = new Set(await fetchOrphans());
        confirmState = null;
      },
    };
  }

  function clearTagFilter() {
    tagFilter = null;
  }

  // ───────── PATH HANDLERS ─────────

  async function handleCreatePath() {
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
    const parent = rootName;
    const seedSlug = activeSlug || undefined;
    newPathOpen = false;
    newPathName = "";
    newPathCondition = "";
    newPathFrom = "";
    try {
      await api.createPathCollection(name, cond, parent, seedSlug);
      await refreshPathAwareness();
      currentPath = name;
      forkMoment = name;
      announce(t("appshell.announce.pathCreated", { name }));
      setTimeout(() => {
        guidance.trigger("path.create", {
          onPrimary: () => {},
          onSecondary: () => { currentPath = rootName; },
        });
      }, 1400);
    } catch (e) {
      console.error("create path failed", e);
    }
  }

  async function handleSwitchPath(name: string) {
    const cols = collectionsView?.collections ?? [];
    const col = cols.find((c) => c.name === name);
    const rootName = collectionsView?.root ?? "main";
    const onMain =
      !name || name === rootName || name === "main" || name === "master";
    const alreadyOnMember =
      activeSlug && col ? col.members.includes(activeSlug) : false;
    const targetSlug =
      col && !alreadyOnMember
        ? col.main_note || col.members[0] || activeSlug
        : activeSlug;
    if (!targetSlug) {
      currentPath = name;
      return;
    }
    try {
      const note = onMain
        ? await api.readNote(targetSlug)
        : await api.readNoteOnPath(targetSlug, name);
      if (targetSlug !== activeSlug) {
        asyncEpoch++;
        activeSlug = targetSlug;
      }
      activeNote = note;
      currentBody = note.body;
      currentPath = name;
      announce(t("appshell.announce.pathSwitched", { name: name || rootName }));
    } catch (e) {
      console.error("switch path prefetch failed", e);
      currentPath = name;
      if (targetSlug !== activeSlug) selectSlug(targetSlug);
    }
  }

  async function handleAddConnection() {
    if (!activeSlug || !connectTarget) return;
    await api.addLink(activeSlug, connectTarget, connectType);
    connectOpen = false;
    connectTarget = "";
    const [note, g, orphansList] = await Promise.all([
      api.readNote(activeSlug),
      fetchGraph(),
      fetchOrphans(),
    ]);
    activeNote = note;
    currentBody = note.body;
    graph = g;
    orphanSet = new Set(orphansList);
  }

  async function handleGraphAddLink(
    from: string,
    to: string,
    type: LinkType,
  ) {
    try {
      await api.addLink(from, to, type);
      const [g, orphansList] = await Promise.all([fetchGraph(), fetchOrphans()]);
      graph = g;
      orphanSet = new Set(orphansList);
      if (from === activeSlug) {
        const note = await api.readNote(activeSlug);
        activeNote = note;
        currentBody = note.body;
      }
    } catch (e) {
      console.error("graph add link failed", e);
    }
  }

  async function handleGraphBulkTag(slugs: string[], tag: string) {
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
      notes = list;
      graph = g;
    } catch (e) {
      console.error("bulk tag failed", e);
    }
  }

  async function handleGraphBulkAddToPath(slugs: string[], pathName: string) {
    if (!pathName || slugs.length === 0) return;
    try {
      for (const slug of slugs) {
        await api.addNoteToPathCollection(pathName, slug);
      }
      collectionsView = await fetchPathCollections();
    } catch (e) {
      console.error("bulk add-to-path failed", e);
    }
  }

  async function handleRemoveConnection(to: string) {
    if (!activeSlug) return;
    await api.removeLink(activeSlug, to);
    const [note, g, orphansList] = await Promise.all([
      api.readNote(activeSlug),
      fetchGraph(),
      fetchOrphans(),
    ]);
    activeNote = note;
    currentBody = note.body;
    graph = g;
    orphanSet = new Set(orphansList);
  }

  async function handleSync() {
    if (!hasRemote(config)) {
      settingsOpen = { open: true, tab: "sync" };
      return;
    }
    syncStatus = "syncing";
    announce(t("appshell.announce.syncStarted"));
    try {
      const r = await api.sync();
      syncStatus = r.ok ? "synced" : "error";
      syncMessage = r.message;
      announce(
        r.ok
          ? t("appshell.announce.syncFinished")
          : t("appshell.announce.syncFailed", { message: r.message }),
      );
      if (r.ok) {
        const now = Date.now();
        lastSyncedAt = now;
        try {
          if (workspacePath) {
            localStorage.setItem(
              `yarrow.lastSyncedAt:${workspacePath}`,
              String(now),
            );
          }
        } catch { /* quota */ }
      } else if (r.quota_blocked) {
        quotaBlock = r.quota_blocked;
        quotaModalOpen = true;
      } else {
        toast = {
          text: t("appshell.toast.syncIssue", { message: r.message }),
          tone: "soft",
        };
      }
      if (r.ok) {
        quotaBlock = null;
        quotaModalOpen = false;
      }
      const cc = r.conflicts ?? [];
      if (cc.length > 0) {
        const n = cc.length;
        toast = {
          text: t(
            n === 1
              ? "appshell.toast.syncConflictsSingle"
              : "appshell.toast.syncConflictsPlural",
            { count: String(n) },
          ),
          tone: "soft",
          ttlMs: 8000,
        };
      }
      if (r.files_changed && r.files_changed.length) {
        for (const p of r.files_changed) {
          if (p.startsWith("notes/") && p.endsWith(".md")) {
            invalidateNote(p.slice("notes/".length, -".md".length));
          }
        }
        if (activeSlug && r.files_changed.includes(`notes/${activeSlug}.md`)) {
          noteReloadNonce++;
        }
      }
    } catch (e) {
      syncStatus = "error";
      syncMessage = String(e);
    }
  }

  async function openHistory() {
    if (!activeSlug) return;
    const [h, ks] = await Promise.all([
      api.noteHistory(activeSlug),
      api.listPinnedCheckpoints().catch(() => [] as Keepsake[]),
    ]);
    history = h;
    keepsakes = ks.filter((k) => k.slug === activeSlug);
    historyPreview = null;
    historyOpen = true;
  }

  async function pinHistoryCheckpoint(
    oid: string,
    label: string,
    note?: string,
  ) {
    if (!activeSlug) return;
    try {
      await api.pinCheckpoint(activeSlug, oid, label, note);
      const all = await api.listPinnedCheckpoints();
      keepsakes = all.filter((k) => k.slug === activeSlug);
      toast = { text: t("appshell.toast.kept", { label }), tone: "success" };
      announce(t("appshell.announce.checkpointPinned"));
    } catch (e) {
      toast = t("appshell.toast.pinError", { error: String(e) });
    }
  }

  async function unpinHistoryCheckpoint(id: string) {
    try {
      await api.unpinCheckpoint(id);
      const all = await api.listPinnedCheckpoints();
      keepsakes = activeSlug
        ? all.filter((k) => k.slug === activeSlug)
        : all;
      toast = { text: t("appshell.toast.unpinned"), tone: "soft" };
      announce(t("appshell.announce.checkpointUnpinned"));
    } catch (e) {
      toast = t("appshell.toast.unpinError", { error: String(e) });
    }
  }

  async function previewAtCheckpoint(oid: string) {
    if (!activeSlug) return;
    const raw = await api.noteAtCheckpoint(activeSlug, oid);
    historyPreview = raw;
  }

  async function restoreAtCheckpoint(oid: string) {
    if (!activeSlug) return;
    await api.restoreNote(activeSlug, oid);
    const n = await api.readNote(activeSlug);
    activeNote = n;
    currentBody = n.body;
    restoreNonce++;
    historyOpen = false;
    notes = await api.listNotes();
    toast = { text: t("appshell.toast.restored"), tone: "success" };
    announce(t("appshell.announce.checkpointRestored"));
  }

  async function closeWorkspace() {
    await api.closeWorkspace();
    onClose();
  }

  async function onConflictsResolved() {
    conflictSession = null;
    await refreshAll();
    if (activeSlug) {
      try {
        const n = await api.readNote(activeSlug);
        activeNote = n;
        currentBody = n.body;
      } catch { /* ignore */ }
    }
    toast = t("appshell.toast.conflictResolved");
  }

  async function onConflictAbort() {
    conflictSession = null;
    await refreshAll();
  }

  async function handlePromotePath() {
    if (!currentPath) return;
    const rootName = collectionsView?.root ?? "main";
    if (
      currentPath === rootName ||
      currentPath === "main" ||
      currentPath === "master"
    ) {
      return;
    }
    const promotedName = currentPath;
    try {
      const overrides = await api
        .listPathOverrides(promotedName)
        .catch(() => [] as string[]);
      const count = overrides.length;
      confirmState = {
        title: t("appshell.promote.title", { path: promotedName }),
        body:
          count === 0
            ? t("appshell.promote.bodyEmpty")
            : count === 1
              ? t("appshell.promote.bodyEditsSingle", { count: String(count) })
              : t("appshell.promote.bodyEditsPlural", { count: String(count) }),
        onConfirm: async () => {
          confirmState = null;
          try {
            await api.promotePathToMain(promotedName);
            await refreshPathAwareness();
            invalidateAllNotes();
            notes = await api.listNotes();
            try { graph = await fetchGraph(); } catch { /* ignore */ }
            try { orphanSet = new Set(await fetchOrphans()); } catch { /* ignore */ }
            currentPath = rootName;
            inlineDiffOpen = false;
            if (activeSlug) {
              try {
                const refreshed = await api.readNote(activeSlug);
                activeNote = refreshed;
                currentBody = refreshed.body;
              } catch { /* ignore */ }
            }
            guidance.trigger("path.promoted");
          } catch (e) {
            toast = t("appshell.toast.promoteError", { error: String(e) });
          }
        },
      };
    } catch (e) {
      console.error("promote failed", e);
    }
  }

  async function handleThrowAwayPath() {
    if (!currentPath) return;
    const rootName = collectionsView?.root ?? "main";
    if (
      currentPath === rootName ||
      currentPath === "main" ||
      currentPath === "master"
    ) {
      return;
    }
    const discarded = currentPath;
    const overrides = await api
      .listPathOverrides(discarded)
      .catch(() => [] as string[]);
    const count = overrides.length;
    confirmState = {
      title: t("appshell.throwAway.title", { path: discarded }),
      body:
        count === 0
          ? t("appshell.throwAway.bodyEmpty")
          : count === 1
            ? t("appshell.throwAway.bodyEditsSingle", { count: String(count) })
            : t("appshell.throwAway.bodyEditsPlural", { count: String(count) }),
      onConfirm: async () => {
        confirmState = null;
        try {
          await api.deletePathCollection(discarded);
          await refreshPathAwareness();
          currentPath = rootName;
          inlineDiffOpen = false;
        } catch (e) {
          toast = t("appshell.toast.discardError", { error: String(e) });
        }
      },
    };
  }

  // ───────── TEMPLATE / NEW NOTE ─────────

  function handleCreateFromTemplate(templateName: string) {
    pendingTemplate = templateName;
    templateTitle = "";
  }

  async function confirmCreateFromTemplate() {
    const title = templateTitle.trim();
    if (!title || !pendingTemplate) return;
    try {
      const n = await api.createFromTemplate(pendingTemplate, title);
      pendingTemplate = null;
      templateTitle = "";
      const list = await api.listNotes();
      notes = list;
      activeSlug = n.slug;
      graph = await fetchGraph();
      orphanSet = new Set(await fetchOrphans());
    } catch (e) {
      console.error("create from template failed", e);
      toast = t("appshell.toast.createFromTemplateError", { error: String(e) });
    }
  }

  async function confirmCreateNote() {
    const title = newNoteTitle.trim();
    if (!title) return;
    const tpl = newNoteTemplate;
    newNoteOpen = false;
    newNoteTitle = "";
    newNoteTemplate = null;
    const n = tpl
      ? await api.createFromTemplate(tpl, title)
      : await api.createNote(title);
    const list = await api.listNotes();
    notes = list;
    activeSlug = n.slug;
    graph = await fetchGraph();
    orphanSet = new Set(await fetchOrphans());
  }

  async function handleAddToDictionary(word: string) {
    try {
      const { addUserWord, snapshotUserWords } = await import("../lib/spell");
      addUserWord(word);
      const existing = await api.readDictionary().catch(() => [] as string[]);
      const merged = Array.from(
        new Set([...existing, ...snapshotUserWords(), word]),
      );
      await api.writeDictionary(merged);
    } catch (e) {
      console.error("add to dictionary failed", e);
    }
  }

  // ───────── DERIVED ─────────

  let noteLinks = $derived(activeNote?.frontmatter.links ?? []);

  let titleMap = $derived.by(() => {
    const m: Record<string, string> = {};
    for (const n of notes) m[n.slug] = n.title;
    return m;
  });

  let snippetMap = $derived.by(() => {
    const m: Record<string, string> = {};
    for (const n of notes) m[n.slug] = n.excerpt;
    return m;
  });

  let neighbors = $derived.by(() => {
    const m: Record<string, Set<string>> = {};
    if (graph) {
      for (const e of graph.links) {
        (m[e.from] ??= new Set()).add(e.to);
        (m[e.to] ??= new Set()).add(e.from);
      }
    }
    return m;
  });

  let questions = $derived(openQuestions(currentBody));

  let noteWordCount = $derived.by(() => {
    if (!activeNote || !currentBody) return 0;
    const cleaned = currentBody.replace(/\[\[([^\]]+)\]\]/g, "$1");
    return cleaned.trim().match(/\S+/g)?.length ?? 0;
  });

  let pathCount = $derived(paths.length);

  let filteredNotes = $derived.by(() => {
    const tf = tagFilter;
    if (!tf) return notes;
    return notes.filter((n) => (n.tags ?? []).includes(tf));
  });

  let tagCounts = $derived(graph?.tags ?? []);

  let privateNoteCount = $derived(
    notes.filter(
      (n) => n.private || (n.tags?.includes("clinical") ?? false),
    ).length,
  );

  let mappingEnabled = $derived(
    (config?.mapping?.mode ?? "mapped") === "mapped",
  );
  let mainNoteSet = $derived(!!config?.mapping?.main_note);
  let needsMainNote = $derived(mappingEnabled && !mainNoteSet);
  let pathChromeVisible = $derived(mappingEnabled && modeConfig.pathFeatures);

  function tbBranchFromHere() {
    if (needsMainNote) {
      mainNotePromptOpen = true;
      return;
    }
    newPathOpen = true;
  }
  function tbOpenPaths() {
    if (needsMainNote) {
      mainNotePromptOpen = true;
      return;
    }
    railOverlay = "paths";
  }
  function tbOpenMap() {
    if (needsMainNote) {
      mainNotePromptOpen = true;
      return;
    }
    mapFilter = null;
    railOverlay = "map";
  }
  function tbEditCurrentCondition() {
    editConditionFor = currentPath;
  }
  let stableCollections = $derived(collectionsView?.collections ?? []);
  let stableRootName = $derived(collectionsView?.root ?? "main");

  let isOffLimitsForBookmark = (n: Note | null): boolean => {
    if (!n) return false;
    if (n.encrypted || n.locked) return true;
    if (n.frontmatter.private) return true;
    const tags = n.frontmatter.tags ?? [];
    return tags.some((tg) => tg.toLowerCase() === "clinical");
  };

  let showLeftOffBanner = $derived.by(() => {
    if (!leftOff) return false;
    if (notes.length === 0) return false;
    const target = notes.find((n) => n.slug === leftOff!.slug);
    if (target && (target.encrypted || target.private)) return false;
    return true;
  });

  let dailyDate = $derived(
    activeSlug?.startsWith("daily/")
      ? activeSlug.slice("daily/".length)
      : null,
  );

  let backLabel = $derived.by(() => {
    void navStackVer;
    if (navStackRef.length === 0) return null;
    const prev = navStackRef[navStackRef.length - 1];
    return notes.find((n) => n.slug === prev)?.title ?? prev;
  });

  function pathStripeColor(p: string): string {
    let h = 0;
    for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0;
    const hue = 260 + (h % 100);
    return `hsl(${hue} 48% 48%)`;
  }

  function mapNeighborCount(g: Graph | null, slug: string | null): number {
    if (!g || !slug) return 0;
    const set = new Set<string>();
    for (const l of g.links) {
      if (l.from === slug) set.add(l.to);
      else if (l.to === slug) set.add(l.from);
    }
    return set.size;
  }

  function syncStatusPresentation(s: SyncStatus): {
    color: string;
    label: string;
    pulse: boolean;
  } {
    switch (s) {
      case "synced":
        return { color: "var(--yel)", label: t("appshell.sync.synced"), pulse: false };
      case "pending":
        return {
          color: "var(--accent2)",
          label: t("appshell.sync.localChanges"),
          pulse: false,
        };
      case "syncing":
        return { color: "var(--yel)", label: t("appshell.sync.syncing"), pulse: true };
      case "error":
        return { color: "var(--danger)", label: t("appshell.sync.failed"), pulse: false };
      case "no-remote":
        return { color: "var(--t3)", label: t("appshell.sync.notAnywhere"), pulse: false };
    }
  }

  let syncPresentation = $derived(syncStatusPresentation(syncStatus));
  let syncShowAge = $derived(
    lastSyncedAt != null && syncStatus !== "syncing" && syncStatus !== "no-remote",
  );

  let newNoteTileCount = $derived(
    2 + (customTemplatesCount > 0 ? 1 : 0) + (cookingOn ? 1 : 0),
  );
  let newNoteGridClass = $derived(
    newNoteTileCount >= 4
      ? "grid-cols-4"
      : newNoteTileCount === 3
        ? "grid-cols-3"
        : "grid-cols-2",
  );

  // ───────── EVENT LISTENERS ─────────

  // Path-view ley pill → editor line jump.
  $effect(() => {
    const onJump = (ev: Event) => {
      const d = (ev as CustomEvent<{ line: number }>).detail;
      if (!d || typeof d.line !== "number") return;
      jumpSignal = { line: d.line, nonce: Date.now() };
    };
    window.addEventListener("yarrow:jump-to-line", onJump as EventListener);
    return () => window.removeEventListener("yarrow:jump-to-line", onJump as EventListener);
  });

  // Global toast bridge.
  $effect(() => {
    const onToast = (ev: Event) => {
      const d = (ev as CustomEvent<unknown>).detail;
      if (typeof d === "string") toast = d;
      else if (d && typeof d === "object") toast = d as never;
    };
    window.addEventListener("yarrow:toast", onToast as EventListener);
    return () => window.removeEventListener("yarrow:toast", onToast as EventListener);
  });

  $effect(() => {
    const onCompare = () => { pathCompareOpen = true; };
    window.addEventListener("yarrow:open-compare", onCompare as EventListener);
    return () =>
      window.removeEventListener("yarrow:open-compare", onCompare as EventListener);
  });

  // Right-click on a misspelled word.
  $effect(() => {
    const onSpell = (ev: Event) => {
      const d = (ev as CustomEvent<{
        word: string;
        suggestions: string[];
        from: number;
        to: number;
        x: number;
        y: number;
      }>).detail;
      if (!d) return;
      spellMenu = d;
    };
    window.addEventListener("yarrow:editor-spellcheck", onSpell as EventListener);
    return () =>
      window.removeEventListener("yarrow:editor-spellcheck", onSpell as EventListener);
  });

  // Encryption events. The yarrow:encryption-changed event is the
  // cross-component signal that the workspace lock state has flipped —
  // it fires from Settings (when its own status fetch sees a transition),
  // from the heartbeat below, and from explicit lock/unlock UI. Whoever
  // hears it must drop cached decrypted bodies AND re-render the active
  // note so an encrypted note that was readable on screen swaps to the
  // locked-stub UI without the user having to navigate away first.
  $effect(() => {
    const onRequestUnlock = () => requestUnlock();
    const onTostt = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      if (typeof msg === "string") toast = msg;
    };
    const onEncChanged = async () => {
      invalidateAllNotes();
      const prevUnlocked = encryption.unlocked;
      const next = await refreshEncryption();
      // Force the active-note effect to re-run by bumping the nonce.
      // Without this, the effect at the activeSlug+encryption.unlocked
      // dependency only re-runs if encryption.unlocked actually flipped
      // in this listener — but a sibling component (Settings) might have
      // already updated AppShell's encryption state via its own dispatch
      // before we got here, leaving the active-note effect un-fired.
      if (prevUnlocked && !next.unlocked) {
        noteReloadNonce += 1;
        if (activeSlug && activeNote?.encrypted) {
          try {
            const n = await api.readNote(activeSlug);
            activeNote = n;
            currentBody = n.body;
            dirty = false;
          } catch { /* ignore */ }
        }
      }
    };
    window.addEventListener("yarrow:request-unlock", onRequestUnlock as EventListener);
    window.addEventListener("yarrow:toast", onTostt as EventListener);
    window.addEventListener("yarrow:encryption-changed", onEncChanged as EventListener);
    return () => {
      window.removeEventListener("yarrow:request-unlock", onRequestUnlock as EventListener);
      window.removeEventListener("yarrow:toast", onTostt as EventListener);
      window.removeEventListener("yarrow:encryption-changed", onEncChanged as EventListener);
    };
  });

  // Periodic idle ping. The cadence is derived from the configured idle
  // timeout — capped at 15s so a 1-minute timeout doesn't sit unlocked
  // for up to 60s past expiry, and floored at 5s so we don't hammer IPC
  // for very short timeouts. When the heartbeat detects the backend has
  // re-locked, dispatching the shared event lets every listener (Settings
  // included) update in lockstep instead of through their own polling.
  $effect(() => {
    if (!encryption.enabled) return;
    const idle = encryption.idle_timeout_secs || 0;
    const cadenceMs =
      idle > 0
        ? Math.max(5_000, Math.min(15_000, Math.floor((idle * 1000) / 4)))
        : 60_000;
    const id = window.setInterval(async () => {
      try {
        const alive = await api.activityPing();
        if (!alive && encryption.unlocked) {
          // The shared event drives the cache flush + active-note refetch
          // through the listener above. We still emit the toast here so
          // the user sees a single, coherent "Locked after idle —" notice
          // tied to the heartbeat detection.
          window.dispatchEvent(new Event("yarrow:encryption-changed"));
          toast = { text: t("appshell.toast.lockedAfterIdle"), tone: "soft" };
        }
      } catch { /* ignore */ }
    }, cadenceMs);
    return () => window.clearInterval(id);
  });

  // Keyboard shortcuts.
  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "\\") { e.preventDefault(); focusMode = !focusMode; return; }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); paletteOpen = true; return; }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        switcherOpen = true;
        return;
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleCreateNote();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const mapped = (config?.mapping?.mode ?? "mapped") === "mapped";
        if (!mapped) return;
        if (!config?.mapping?.main_note) { mainNotePromptOpen = true; return; }
        newPathOpen = true;
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        const mapped = (config?.mapping?.mode ?? "mapped") === "mapped";
        if (!mapped) return;
        if (!config?.mapping?.main_note) { mainNotePromptOpen = true; return; }
        newPathOpen = true;
        return;
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        void handleOpenDaily();
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        settingsOpen = { open: true };
        return;
      }
      if (mod && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        quickCaptureOpen = true;
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        scratchpadOpen = !scratchpadOpen;
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        workspaceSwitcherOpen = !workspaceSwitcherOpen;
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        findReplaceOpen = true;
        return;
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "p") {
        if (activeSlug) {
          e.preventDefault();
          void printActiveNote(activeSlug);
          return;
        }
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "l") {
        if (encryption.enabled) {
          e.preventDefault();
          void handleLockEncryption();
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
          void handleOpenDaily(next);
          return;
        }
      }
      if (mod && !e.shiftKey && e.key === "[") {
        if (navStackRef.length > 0) {
          e.preventDefault();
          goBack();
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Toast TTL.
  $effect(() => {
    if (!toast) return;
    const ttl =
      typeof toast === "object" && toast.ttlMs
        ? toast.ttlMs
        : typeof toast === "object"
          ? 6500
          : 4200;
    const timer = setTimeout(() => { toast = null; }, ttl);
    return () => clearTimeout(timer);
  });

  // ───────── LEFT-OFF (where you left off) ─────────

  let leftOffWriteTimer: number | null = null;
  let cursorLineRef: number | undefined = undefined;
  $effect(() => {
    const onCursor = (e: Event) => {
      const d = (e as CustomEvent<{ line: number }>).detail;
      if (d && typeof d.line === "number") cursorLineRef = d.line;
    };
    window.addEventListener("yarrow:cursor-changed", onCursor as EventListener);
    return () =>
      window.removeEventListener("yarrow:cursor-changed", onCursor as EventListener);
  });
  $effect(() => {
    void activeSlug;
    cursorLineRef = undefined;
  });

  $effect(() => {
    if (!activeNote || !activeSlug) return;
    if (isHiddenLeftOff(workspacePath)) return;
    if (isOffLimitsForBookmark(activeNote)) return;
    if (leftOffWriteTimer) window.clearTimeout(leftOffWriteTimer);
    const slug = activeSlug;
    const title = activeNote.frontmatter.title || activeNote.slug;
    const path = currentPath;
    const body = currentBody || activeNote.body;
    leftOffWriteTimer = window.setTimeout(() => {
      const cursorLine = cursorLineRef;
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
      if (leftOffWriteTimer) window.clearTimeout(leftOffWriteTimer);
    };
  });

  // Flush on unmount.
  onMount(() => {
    return () => {
      if (!activeNote || !activeSlug) return;
      if (isHiddenLeftOff(workspacePath)) return;
      if (isOffLimitsForBookmark(activeNote)) return;
      const cursorLine = cursorLineRef;
      saveLeftOff(workspacePath, {
        slug: activeSlug,
        title: activeNote.frontmatter.title || activeNote.slug,
        path: currentPath,
        snippet: snippetFromBody(currentBody || activeNote.body, cursorLine),
        cursorLine,
        at: Date.now(),
      });
    };
  });

  // Stale-state sweep for leftOff.
  $effect(() => {
    if (!leftOff || notes.length === 0) return;
    const target = notes.find((n) => n.slug === leftOff!.slug);
    if (target && (target.encrypted || target.private)) {
      forgetLeftOff(workspacePath);
      leftOff = null;
    }
  });

  // Editor selection size events.
  $effect(() => {
    const onSel = (e: Event) => {
      const d = (e as CustomEvent<{ words: number; chars: number }>).detail;
      selectionWords = d?.words ?? 0;
      selectionChars = d?.chars ?? 0;
    };
    window.addEventListener("yarrow:selection-changed", onSel as EventListener);
    return () =>
      window.removeEventListener("yarrow:selection-changed", onSel as EventListener);
  });

  // Editor right-click context menu.
  $effect(() => {
    const onMenu = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; x: number; y: number }>).detail;
      if (d) editorCtxMenu = d;
    };
    window.addEventListener("yarrow:editor-contextmenu", onMenu as EventListener);
    return () =>
      window.removeEventListener("yarrow:editor-contextmenu", onMenu as EventListener);
  });

  // Dismiss radial on resize / scroll.
  $effect(() => {
    if (!editorCtxMenu) return;
    const close = () => { editorCtxMenu = null; };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  });

  // Center action handler.
  $effect(() => {
    const onAction = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      switch (id) {
        case "palette": paletteOpen = true; break;
        case "quickHand": quickHandOpen = true; break;
        case "constellationModal": constellationModalOpen = true; break;
        case "constellation": railOverlay = "map"; break;
        case "focus": focusMode = !focusMode; break;
        case "scratchpad": scratchpadOpen = !scratchpadOpen; break;
        case "todayJournal": void handleOpenDaily(); break;
        case "newNote": handleCreateNote(); break;
        case "newPath": newPathOpen = true; break;
        case "outline-solid": railOverlay = "outline-solid"; break;
        case "livePreview":
          showRawMarkdown.set(true);
          livePreview.set(!livePreview.value);
          break;
        case "cookMode": cookMode.set(!cookMode.value); break;
        case "settings": settingsOpen = { open: true }; break;
      }
    };
    window.addEventListener("yarrow:center-action", onAction as EventListener);
    return () =>
      window.removeEventListener("yarrow:center-action", onAction as EventListener);
  });

  // Cook mode body class + wake-lock.
  $effect(() => {
    const body = document.body;
    if (cookModeValue) body.classList.add("yarrow-cook-mode");
    else body.classList.remove("yarrow-cook-mode");

    let lockSentinel: WakeLockSentinel | null = null;
    if (cookModeValue && "wakeLock" in navigator) {
      void navigator.wakeLock
        .request("screen")
        .then((sentinel) => { lockSentinel = sentinel; })
        .catch(() => { /* unsupported */ });
    }
    return () => {
      body.classList.remove("yarrow-cook-mode");
      if (lockSentinel) {
        try { void lockSentinel.release(); } catch { /* ignore */ }
      }
    };
  });

  // Native menu bar bridge.
  $effect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        const fn = await listen<string>("yarrow:menu-action", (e) => {
          const id = e.payload;
          if (typeof id !== "string") return;
          window.dispatchEvent(
            new CustomEvent("yarrow:center-action", { detail: { id } }),
          );
        });
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => { /* not available */ });
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  });

  // Reset selection on note switch.
  $effect(() => {
    void activeSlug;
    selectionWords = 0;
    selectionChars = 0;
  });

  // Auto-sync 30s loop + WebSocket bridge.
  $effect(() => {
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
          const prev = quotaBlock;
          quotaBlock = outcome.quota_blocked ?? null;
          if (prev === null) quotaModalOpen = true;
        }
        if (outcome?.ok) {
          quotaBlock = null;
          quotaModalOpen = false;
          const now = Date.now();
          lastSyncedAt = now;
          try {
            if (workspacePath) {
              localStorage.setItem(
                `yarrow.lastSyncedAt:${workspacePath}`,
                String(now),
              );
            }
          } catch { /* quota */ }
        }
        const cc = outcome?.conflicts ?? [];
        if (cc.length > 0) {
          const n = cc.length;
          toast = {
            text: t(
              n === 1
                ? "appshell.toast.autoSyncConflictsSingle"
                : "appshell.toast.autoSyncConflictsPlural",
              { count: String(n) },
            ),
            tone: "soft",
            ttlMs: 8000,
          };
        }
        const changed = outcome?.files_changed;
        if (changed && changed.length) {
          for (const p of changed) {
            if (p.startsWith("notes/") && p.endsWith(".md")) {
              invalidateNote(p.slice("notes/".length, -".md".length));
            }
          }
          if (activeSlug && changed.includes(`notes/${activeSlug}.md`)) {
            noteReloadNonce++;
          }
        }
      } catch (err) {
        lastError = Date.now();
        backoffMs = Math.min(backoffMs * 2, maxBackoff);
        console.warn("auto-sync failed — backing off", backoffMs / 1000, "s", err);
      }
    };

    const warmup = window.setTimeout(() => void run(), 8_000);
    const id = window.setInterval(() => void run(), 30_000);

    let unlisten: (() => void) | null = null;
    let unlistenPurged: (() => void) | null = null;
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        const fn = await listen("workspace.updated", () => {
          if (cancelled) return;
          if (Date.now() - lastError < backoffMs) return;
          void run();
        });
        if (cancelled) fn();
        else unlisten = fn;
        const purgedFn = await listen("workspace.purged", () => {
          if (cancelled) return;
          toast = {
            text: t("appshell.toast.workspacePurged"),
            tone: "soft",
            ttlMs: 6000,
          };
          void (async () => {
            try {
              await api.forceAlignWithServer(true);
              quotaBlock = null;
              quotaModalOpen = false;
              noteReloadNonce++;
              invalidateAllNotes();
            } catch (err) {
              console.warn("post-purge force-align failed:", err);
              toast = {
                text: t("appshell.toast.workspacePurgedFailed"),
                tone: "soft",
                ttlMs: 8000,
              };
            }
          })();
        });
        if (cancelled) purgedFn();
        else unlistenPurged = purgedFn;
      })
      .catch(() => { /* web build / pre-2.x tauri */ });

    return () => {
      cancelled = true;
      window.clearTimeout(warmup);
      window.clearInterval(id);
      if (unlisten) unlisten();
      if (unlistenPurged) unlistenPurged();
    };
  });

  // Periodic auto-sync via preferences.autosync_minutes.
  $effect(() => {
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
  });

  // Sync status pill clock tick.
  let syncTick = $state(0);
  $effect(() => {
    if (lastSyncedAt == null) return;
    const id = window.setInterval(() => { syncTick++; }, 15_000);
    return () => window.clearInterval(id);
  });

  // Sync popover state.
  let syncPopoverOpen = $state(false);
  let syncPopoverWrap = $state<HTMLSpanElement | null>(null);
  $effect(() => {
    if (!syncPopoverOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!syncPopoverWrap) return;
      if (!syncPopoverWrap.contains(e.target as Node)) syncPopoverOpen = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") syncPopoverOpen = false;
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  });
</script>

{#snippet sidebarUtilityButton(onClick: () => void, title: string, label: string, badgeCount: number | undefined, body: import("svelte").Snippet)}
  <button
    onclick={onClick}
    {title}
    class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-sm text-[11px] text-t3 hover:text-char hover:bg-s2 transition"
  >
    {@render body()}
    <span>{label}</span>
    {#if badgeCount !== undefined && badgeCount > 0}
      <span class="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-yel text-on-yel text-[10px] font-mono leading-none">
        {badgeCount}
      </span>
    {/if}
  </button>
{/snippet}

{#snippet statusGroupIcon(kind: "workspace" | "document")}
  {#if kind === "workspace"}
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="text-t3 shrink-0">
      <path d="M2 4.5V3a.6.6 0 0 1 .6-.6h3.2L7 3.6h4.4a.6.6 0 0 1 .6.6V11a.6.6 0 0 1-.6.6H2.6A.6.6 0 0 1 2 11V4.5z" />
    </svg>
  {:else}
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="text-t3 shrink-0">
      <path d="M3.5 2h5.2L11 4.3V11.4a.6.6 0 0 1-.6.6H3.5a.6.6 0 0 1-.6-.6V2.6A.6.6 0 0 1 3.5 2z" />
      <path d="M8.4 2v2.4H11" />
      <line x1="4.5" y1="7" x2="9" y2="7" />
      <line x1="4.5" y1="9.5" x2="8" y2="9.5" />
    </svg>
  {/if}
{/snippet}

{#snippet kitsRouteGlyph()}
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.2" />
    <rect x="12" y="3" width="7" height="7" rx="1.2" />
    <rect x="3" y="12" width="7" height="7" rx="1.2" />
    <rect x="12" y="12" width="7" height="7" rx="1.2" />
  </svg>
{/snippet}

{#snippet customTemplatesRouteGlyph()}
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 5h14" />
    <path d="M4 11h14" />
    <path d="M4 17h9" />
    <circle cx="17" cy="17" r="2" />
  </svg>
{/snippet}

{#snippet blankGlyph()}
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 3h7L17 7v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M12 3v4h5" />
  </svg>
{/snippet}

{#snippet recipeUrlRouteGlyph()}
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 3h7L17 7v6" />
    <path d="M12 3v4h5" />
    <path d="M9 14a2.5 2.5 0 0 0 3.5 0l1.8-1.8a2.5 2.5 0 0 0-3.5-3.5l-0.6 0.6" />
    <path d="M13 17a2.5 2.5 0 0 0-3.5 0l-1.8 1.8a2.5 2.5 0 0 0 3.5 3.5l0.6-0.6" />
  </svg>
{/snippet}

{#snippet newNoteRouteTile(active: boolean, onClick: () => void, title: string, sub: string, glyph: import("svelte").Snippet)}
  <button
    type="button"
    onclick={onClick}
    class="tile-press text-left flex flex-col gap-3 p-5 rounded-xl border min-h-[150px] {active
      ? 'border-yel bg-yelp shadow-xs'
      : 'border-bd bg-bg hover:bg-yelp/30 hover:border-yel'}"
  >
    <div
      class="w-12 h-12 rounded-xl flex items-center justify-center {active
        ? 'bg-yel/25 text-yeld'
        : 'bg-s2 text-yeld'}"
    >
      {@render glyph()}
    </div>
    <div class="min-w-0 flex-1">
      <div class="font-serif text-[17px] text-char leading-tight">{title}</div>
      <div class="text-2xs text-t2 mt-1.5 leading-relaxed">{sub}</div>
    </div>
  </button>
{/snippet}

{#snippet personaSlot()}
  {#if modeConfig.persona === "writer"}
    <WriterRail onOpenStreak={() => { streakModalOpen = true; }} />
  {:else if modeConfig.persona === "researcher"}
    <ResearcherRail
      {notes}
      questionCount={questions.length}
      onOpenQuestions={() => { researcherQuestionsOpen = true; }}
      onOpenSources={() => { sourcesOpen = true; }}
      onCreateSource={handleCreateSource}
    />
  {:else if modeConfig.persona === "developer"}
    <DeveloperRail
      {notes}
      onOpenDecisions={() => { decisionLogOpen = true; }}
      onCreateAdr={handleCreateAdr}
    />
  {:else if modeConfig.persona === "clinician"}
    <ClinicianRail
      {notes}
      onOpenSensitive={() => { sensitiveOpen = true; }}
      onOpenFollowUps={() => { followUpsOpen = true; }}
      onOpenSessionKit={() => { sessionKitOpen = true; }}
    />
  {:else if modeConfig.persona === "cooking"}
    <CookingRail
      hasActiveNote={!!activeSlug}
      onClipRecipe={() => { recipeClipperOpen = true; }}
      onAddToShoppingList={() => { void handleAddToShoppingList(); }}
    />
  {/if}
{/snippet}

<!-- Root -->
<div class="flex-1 min-h-0 flex flex-col bg-bg text-char">
  <a
    href="#yarrow-main"
    onclick={(e) => {
      e.preventDefault();
      const el = document.getElementById("yarrow-main");
      el?.focus();
      el?.scrollIntoView({ block: "start" });
    }}
    class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-3 focus:py-1.5 focus:bg-yel focus:text-on-yel focus:rounded-md focus:font-medium focus:outline-hidden focus:ring-2 focus:ring-char/20"
  >
    {t("appshell.skipToContent")}
  </a>

  <!-- Verbose announcement region -->
  <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
    {verboseAnnouncement}
  </div>

  <TimerPills
    onJump={(slug, path) => {
      const samePath = !path || path === currentPath;
      if (samePath) {
        selectSlug(slug);
      } else {
        void handleSwitchPath(path).then(() => selectSlug(slug));
      }
    }}
  />

  <div class="flex-1 min-h-0 flex overflow-hidden">
    {#if !focusMode}
      <aside
        class="relative shrink-0 bg-s1 border-r border-bd flex flex-col overflow-hidden yarrow-vibrancy-pane"
        style:width="{leftSidebarWidth}px"
      >
        <div class="relative px-3 pt-4 pb-3">
          <button
            bind:this={workspaceChipRef}
            onclick={() => { workspaceSwitcherOpen = !workspaceSwitcherOpen; }}
            class="group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border transition text-left {workspaceSwitcherOpen
              ? 'bg-yelp border-yel'
              : 'bg-bg border-bd hover:bg-s2 hover:border-bd2'}"
            title={t("appshell.workspace.switchTitle", { shortcut: SK.switchWorkspace })}
            aria-label={t("appshell.workspace.switchAria")}
            aria-expanded={workspaceSwitcherOpen}
          >
            <span
              class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 font-serif text-sm"
              style={Object.entries(workspaceAccent(workspacePath, true))
                .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
                .join(";")}
            >
              {(config?.workspace.name ?? "Y").charAt(0).toUpperCase()}
            </span>
            <div class="flex-1 min-w-0">
              <div
                class="font-serif text-[15px] text-char leading-tight truncate"
                title={config?.workspace.name ?? workspacePath}
              >
                {config?.workspace.name ?? t("appshell.workspace.fallbackName")}
              </div>
              <div class="text-2xs text-t3 leading-tight truncate">
                {t(
                  notes.length === 1
                    ? paths.length === 1
                      ? "appshell.workspace.notesPathsSingleSingle"
                      : "appshell.workspace.notesPathsSinglePlural"
                    : paths.length === 1
                      ? "appshell.workspace.notesPathsPluralSingle"
                      : "appshell.workspace.notesPathsPluralPlural",
                  {
                    notes: String(notes.length),
                    scenarios: String(paths.length),
                  },
                )}
              </div>
            </div>
            <span class="text-t3 group-hover:text-char transition shrink-0 {workspaceSwitcherOpen ? 'rotate-180 text-yeld' : ''}">
              <ChevronDownIcon />
            </span>
          </button>
          {#if workspaceSwitcherOpen}
            <WorkspaceSwitcher
              open={workspaceSwitcherOpen}
              anchorEl={workspaceChipRef}
              currentPath={workspacePath}
              onClose={() => { workspaceSwitcherOpen = false; }}
              onSwitch={(p) => onSwitchWorkspace(p)}
            />
          {/if}
        </div>
        <div class="px-4 pb-3">
          <button
            onclick={() => { paletteOpen = true; }}
            title={t("modals.commandPalette.placeholder")}
            class="w-full flex items-center gap-2 px-4 py-2 rounded-full bg-s2 text-t3 hover:text-char hover:bg-s3 transition text-xs"
          >
            <SearchIcon size={13} />
            <span>{t("appshell.sidebar.findAnything")}</span>
          </button>
        </div>
        <div class="flex-1 min-h-0 flex flex-col">
          <NoteList
            notes={filteredNotes}
            {activeSlug}
            mainNoteSlug={config?.mapping?.main_note ?? null}
            orphans={orphanSet}
            decayDays={config?.preferences.decay_days ?? 60}
            {neighbors}
            onSelect={selectSlug}
            onOpenInNewTab={openInNewTab}
            onCreate={handleCreateNote}
            onRename={handleRenameNote}
            onDelete={handleDeleteNote}
            onTogglePin={handleTogglePin}
            onDeleteMany={handleDeleteMany}
            {tagFilter}
            onClearTagFilter={clearTagFilter}
            encryptionEnabled={encryption.enabled}
            encryptionUnlocked={encryption.unlocked}
            onEncryptNote={handleEncryptNoteBySlug}
            onDecryptNote={handleDecryptNoteBySlug}
            onReveal={handleRevealNote}
            onCopyAsMarkdown={handleCopyNoteAsMarkdown}
            onMoveToFolder={handleMoveToFolder}
            {workspacePath}
            workspaceName={config?.workspace.name}
            pathCount={stableCollections.filter((c) => c.name !== stableRootName).length}
          />
        </div>
        <div class="shrink-0 border-t border-bd/60 px-3 py-2 flex items-center gap-1">
          {#snippet journalIcon()}<JournalIcon size={13} />{/snippet}
          {#snippet activityIcon()}<ActivityIcon size={13} />{/snippet}
          {#snippet deleteIconRender()}<DeleteIcon size={13} />{/snippet}
          {@render sidebarUtilityButton(
            () => { void handleOpenDaily(); },
            t("appshell.sidebar.journalTitle"),
            t("appshell.sidebar.journalLabel"),
            undefined,
            journalIcon,
          )}
          {@render sidebarUtilityButton(
            () => { activityOpen = true; },
            t("appshell.sidebar.activityTitle"),
            t("appshell.sidebar.activityLabel"),
            undefined,
            activityIcon,
          )}
          {@render sidebarUtilityButton(
            () => { trashOpen = true; },
            trashCount > 0
              ? t("appshell.sidebar.trashTitleWithCount", { count: String(trashCount) })
              : t("appshell.sidebar.trashTitle"),
            t("appshell.sidebar.trashLabel"),
            trashCount,
            deleteIconRender,
          )}
        </div>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          onmousedown={onLeftResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label={t("appshell.sidebar.resizeAria")}
          title={t("appshell.sidebar.resizeTitle")}
          class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-yel/40 transition z-20"
        ></div>
      </aside>
    {/if}

    <section
      class="flex-1 min-w-0 flex flex-col relative"
      style:box-shadow={!(currentPath === "main" || currentPath === "master" || !currentPath)
        ? `inset 3px 0 0 0 ${pathStripeColor(currentPath)}`
        : undefined}
    >
      <Toolbar
        collections={stableCollections}
        rootName={stableRootName}
        {currentPath}
        {checkpointCount}
        {dirty}
        {lastSavedAt}
        mappingEnabled={pathChromeVisible}
        onSwitchPath={handleSwitchPath}
        onBranchFromHere={tbBranchFromHere}
        onOpenPaths={tbOpenPaths}
        onComparePaths={() => { pathCompareOpen = true; }}
        onOpenMap={tbOpenMap}
        onEditCurrentCondition={tbEditCurrentCondition}
        {focusMode}
        onExitFocus={() => { focusMode = false; }}
        {dailyDate}
        onOpenJournalCalendar={(anchor) => { journalCalendar = { open: true, anchor }; }}
        onBack={navStackVer >= 0 && navStackRef.length > 0 ? goBack : undefined}
        {backLabel}
        backShortcut={SK.navBack}
      />
      {#if mappingEnabled}
        <PathRibbon
          pathName={currentPath}
          condition={stableCollections.find((c) => c.name === currentPath)?.condition || null}
          rootName={stableRootName}
          {pathColorOverrides}
          onSwitchPath={handleSwitchPath}
          onToggleInlineDiff={() => { inlineDiffOpen = !inlineDiffOpen; }}
          inlineDiffActive={inlineDiffOpen}
          onOpenCompare={() => { pathCompareOpen = true; }}
          onPromote={handlePromotePath}
          onThrowAway={handleThrowAwayPath}
        />
      {/if}
      {#if showLeftOffBanner && leftOff}
        <WhereYouLeftOffBanner
          state={leftOff}
          onResume={() => {
            const lo = leftOff!;
            const target = notes.find((n) => n.slug === lo.slug);
            if (!target) {
              leftOff = null;
              forgetLeftOff(workspacePath);
              return;
            }
            if (lo.path && lo.path !== currentPath) {
              const exists = (collectionsView?.collections ?? []).some((c) => c.name === lo.path);
              if (exists) handleSwitchPath(lo.path);
            }
            const slug = lo.slug;
            const cursorLine = lo.cursorLine;
            const snippet = lo.snippet;
            selectSlug(slug);
            window.setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("yarrow:scroll-to-line", {
                  detail: { slug, line: cursorLine, snippet },
                }),
              );
            }, 200);
            leftOff = null;
          }}
          onDismiss={() => { leftOff = null; }}
          onHideAlways={() => {
            setHideLeftOff(workspacePath, true);
            forgetLeftOff(workspacePath);
            leftOff = null;
          }}
        />
      {/if}
      <div
        id="yarrow-main"
        tabindex="-1"
        class="yarrow-paper flex-1 overflow-hidden flex flex-col relative yarrow-paint-island focus:outline-hidden"
      >
        <TabBar
          tabs={tabsView}
          activeIndex={activeTabIndex}
          onSwitch={switchTab}
          onClose={closeTab}
          onNewTab={newBlankTab}
        />
        {#if activeNote}
          {#if activeNote.locked}
            <div class="flex-1 flex items-center justify-center px-6">
              <div class="w-[420px] max-w-full bg-bg-soft border border-bd rounded-2xl px-8 py-9 text-center shadow-xs">
                <div class="font-serif text-2xl text-char mb-2 tracking-tight">
                  {t("appshell.locked.title")}
                </div>
                <p class="text-xs text-t2 mb-6 leading-relaxed font-serif italic">
                  {t("appshell.locked.body")}
                </p>
                <button
                  onclick={() => requestUnlock()}
                  class="btn-yel px-4 py-2 rounded-full text-xs"
                >
                  {t("appshell.locked.unlock")}
                </button>
              </div>
            </div>
          {:else if inlineDiffOpen && !!currentPath && currentPath !== stableRootName && currentPath !== "main" && currentPath !== "master"}
            <InlineDiffPane
              slug={activeNote.slug}
              mainName={stableRootName}
              pathName={currentPath}
              onExit={() => { inlineDiffOpen = false; }}
            />
          {:else if !showRawValue}
            {#key "r:" + activeNote.slug + "@" + currentPath}
              <NoteReader
                note={activeNote}
                {notes}
                {pathNotes}
                {currentPath}
                {currentBody}
                {mainBody}
                onNavigate={selectSlug}
                onBranchFromWikilink={(slug) => {
                  const target = notes.find((n) => n.slug === slug);
                  const hint = target?.title || slug;
                  newPathCondition = `If ${hint.toLowerCase()}…`;
                  newPathOpen = true;
                }}
                onSwitchToWriting={() => showRawMarkdown.set(true)}
              />
            {/key}
          {:else}
            <div class={livePreviewValue ? "flex-1 min-h-0 flex" : "flex-1 min-h-0 flex flex-col"}>
              <div class={livePreviewValue ? "flex-1 min-w-0 min-h-0 flex flex-col border-r border-bd" : "flex-1 min-w-0 min-h-0 flex flex-col"}>
                {#key activeNote.slug + "@" + currentPath + "#" + restoreNonce}
                  <NoteEditor
                    note={activeNote}
                    {notes}
                    {currentPath}
                    jumpToLine={jumpSignal}
                    {mappingEnabled}
                    onSave={handleSave}
                    onTagsChange={async (slug, tags) => {
                      try {
                        const updated = await api.setTags(slug, tags);
                        invalidateNote(slug);
                        if (slug === activeSlug) activeNote = updated;
                        notes = await api.listNotes();
                        try { graph = await fetchGraph(); } catch { /* ignore */ }
                      } catch (e) {
                        toast = t("appshell.toast.tagsError", { error: String(e) });
                      }
                    }}
                    tagSuggestions={tagCounts.map((tg) => tg.tag)}
                    {pathColorOverrides}
                    onAnnotationsChange={async (slug, annotations) => {
                      try {
                        const updated = await api.setAnnotations(slug, annotations);
                        invalidateNote(slug);
                        if (slug === activeSlug) activeNote = updated;
                      } catch (e) {
                        toast = t("appshell.toast.annotationSaveError", { error: String(e) });
                      }
                    }}
                    onTitleChange={(title) => handleRenameNote(activeNote!.slug, title)}
                    {titleRevertNonce}
                    onDirtyChange={(d) => { dirty = d; }}
                    onNavigate={selectSlug}
                    onBodyChange={(b) => { currentBody = b; }}
                    onOpenFork={() => { newPathOpen = true; }}
                    debounceMs={config?.preferences.autocheckpoint_debounce_ms ?? 8000}
                    askThinkingOnClose={config?.preferences.ask_thinking_on_close ?? true}
                    showRawMarkdown={showRawValue}
                    {pathNotes}
                    onBranchFromWikilink={(slug) => {
                      const target = notes.find((n) => n.slug === slug);
                      const hint = target?.title || slug;
                      newPathCondition = `If ${hint.toLowerCase()}…`;
                      newPathOpen = true;
                    }}
                    drafts={activeDrafts}
                    onDraftsChanged={() => { draftsReloadNonce++; }}
                    onDraftPromoted={(slug) => {
                      invalidateNote(slug);
                      noteReloadNonce++;
                    }}
                    draftsEnabled={mappingEnabled}
                    {divergingPaths}
                    rootPathName={collectionsView?.root ?? "main"}
                    onBorrowed={(slug) => {
                      invalidateNote(slug);
                      noteReloadNonce++;
                    }}
                  />
                {/key}
              </div>
              {#if livePreviewValue}
                <div class="flex-1 min-w-0 overflow-y-auto bg-s1 yarrow-live-preview">
                  {#key "live:" + activeNote.slug + "@" + currentPath}
                    <NoteReader
                      note={activeNote}
                      {notes}
                      {pathNotes}
                      {currentPath}
                      {currentBody}
                      {mainBody}
                      onNavigate={selectSlug}
                      onBranchFromWikilink={(slug) => {
                        const target = notes.find((n) => n.slug === slug);
                        const hint = target?.title || slug;
                        newPathCondition = `If ${hint.toLowerCase()}…`;
                        newPathOpen = true;
                      }}
                      onSwitchToWriting={() => livePreview.set(false)}
                    />
                  {/key}
                </div>
              {/if}
            </div>
          {/if}
        {:else}
          <div class="flex-1 flex items-center justify-center">
            <div class="max-w-sm text-center">
              <div class="font-serif text-3xl text-char mb-3 tracking-tight">
                {t("appshell.empty.title")}
              </div>
              <p class="text-sm text-t2 mb-6 leading-relaxed">
                {t("appshell.empty.body")}
              </p>
              <div class="flex gap-2 justify-center">
                <button onclick={() => handleCreateNote()} class="btn-yel px-4 py-2 rounded-md text-sm">
                  {t("appshell.empty.startFirstNote")}
                </button>
                <button
                  onclick={() => { paletteOpen = true; }}
                  class="inline-flex items-center gap-2 px-4 py-2 bg-s2 text-ch2 rounded-md hover:bg-s3 text-sm transition"
                >
                  <SearchIcon size={14} />
                  <span>{t("appshell.empty.findNote")}</span>
                </button>
              </div>
            </div>
          </div>
        {/if}
        {#if historyOpen && activeNote}
          <HistorySlider
            {history}
            preview={historyPreview}
            {currentBody}
            noteTitle={activeNote.frontmatter.title}
            {keepsakes}
            onHover={previewAtCheckpoint}
            onRestore={restoreAtCheckpoint}
            onPin={pinHistoryCheckpoint}
            onUnpin={unpinHistoryCheckpoint}
            onClose={() => { historyOpen = false; railOverlay = null; }}
          />
        {/if}
      </div>
    </section>

    <ModePickerOnboarding
      open={modePickerOpen}
      onPick={handleModePick}
      onSkip={handleModeSkip}
    />

    {#if spellMenu}
      <SpellMenu
        word={spellMenu.word}
        suggestions={spellMenu.suggestions}
        from={spellMenu.from}
        to={spellMenu.to}
        x={spellMenu.x}
        y={spellMenu.y}
        onClose={() => { spellMenu = null; }}
        onAddToDictionary={handleAddToDictionary}
      />
    {/if}

    {#if obsidianImportOpen}
      <ObsidianImport
        open={obsidianImportOpen}
        onClose={() => { obsidianImportOpen = false; }}
        onChanged={async () => {
          invalidateAllNotes();
          notes = await api.listNotes();
          try { graph = await fetchGraph(); } catch { /* ignore */ }
          try { orphanSet = new Set(await fetchOrphans()); } catch { /* ignore */ }
        }}
      />
    {/if}

    {#if renamePrompt}
      <div
        class="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
        onclick={cancelRename}
        role="presentation"
      >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          class="w-full max-w-md bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
        >
          <div class="px-5 py-4 border-b border-bd">
            <div class="font-serif text-xl text-char">{t("appshell.rename.title")}</div>
            <div class="text-2xs text-t3 mt-1 leading-relaxed">
              {renamePrompt.refs === 1
                ? t("appshell.rename.refsBodySingle", { count: String(renamePrompt.refs) })
                : t("appshell.rename.refsBodyPlural", { count: String(renamePrompt.refs) })}
            </div>
          </div>
          <div class="px-5 py-4 text-xs text-t2">
            <span class="font-serif text-base text-char">{t("appshell.rename.confirmQuestion", { title: renamePrompt.nextTitle })}</span>
          </div>
          <div class="px-5 py-3 border-t border-bd flex justify-end gap-2 flex-wrap">
            <button onclick={cancelRename} class="text-xs px-3 py-1.5 rounded-sm bg-s2 text-t2 hover:bg-s3 hover:text-char">
              {t("appshell.rename.cancel")}
            </button>
            <button
              onclick={() => {
                const { slug, nextTitle } = renamePrompt!;
                renamePrompt = null;
                void performRename(slug, nextTitle, false);
              }}
              class="text-xs px-3 py-1.5 rounded-sm bg-s2 text-char hover:bg-s3"
            >
              {t("appshell.rename.onlyThis")}
            </button>
            <button
              onclick={() => {
                const { slug, nextTitle } = renamePrompt!;
                renamePrompt = null;
                void performRename(slug, nextTitle, true);
              }}
              class="text-xs px-3 py-1.5 rounded-sm bg-yel text-on-yel hover:bg-yel2"
            >
              {t("appshell.rename.andUpdate")}
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if findReplaceResult}
      <div
        class="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
        onclick={() => { findReplaceResult = null; }}
        role="presentation"
      >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          class="w-full max-w-md bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
        >
          <div class="px-5 py-5">
            <div class="font-serif text-xl text-char">{t("appshell.findReplaceResult.title")}</div>
            <div class="text-sm text-t2 mt-2 leading-relaxed">
              {t(
                findReplaceResult.total === 1
                  ? findReplaceResult.changed === 1
                    ? "appshell.findReplaceResult.bodySingle"
                    : "appshell.findReplaceResult.bodyMixed2"
                  : findReplaceResult.changed === 1
                    ? "appshell.findReplaceResult.bodyMixed1"
                    : "appshell.findReplaceResult.bodyPlural",
                {
                  total: String(findReplaceResult.total),
                  changed: String(findReplaceResult.changed),
                },
              )}
            </div>
            <div class="text-2xs text-t3 mt-2 italic">
              {t("appshell.findReplaceResult.checkpointHint")}
            </div>
          </div>
          <div class="px-5 py-3 border-t border-bd flex justify-end">
            <button
              onclick={() => { findReplaceResult = null; }}
              class="text-xs px-3 py-1.5 rounded-sm bg-yel text-on-yel hover:bg-yel2"
            >
              {t("appshell.findReplaceResult.done")}
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if decisionMatrixOpen}
      <DecisionMatrix
        open={decisionMatrixOpen}
        onClose={() => { decisionMatrixOpen = false; }}
        {notes}
        initialCollections={collectionsView?.collections}
        currentPathName={currentPath}
        onOpenNote={(slug) => { decisionMatrixOpen = false; selectSlug(slug); }}
      />
    {/if}

    <JournalCalendar
      open={journalCalendar.open}
      anchor={journalCalendar.anchor}
      onClose={() => { journalCalendar = { open: false, anchor: null }; }}
      onPick={(iso) => {
        journalCalendar = { open: false, anchor: null };
        void handleOpenDaily(iso);
      }}
      activeDate={activeSlug?.startsWith("daily/") ? activeSlug.slice("daily/".length) : undefined}
    />

    {#if pathCompareOpen}
      <PathCompare
        open={pathCompareOpen}
        onClose={() => { pathCompareOpen = false; }}
        paths={(collectionsView?.collections ?? []).map((c) => c.name)}
        pathConditions={Object.fromEntries(
          (collectionsView?.collections ?? []).map((c) => [c.name, c.condition]),
        )}
        initialLeft={currentPath && currentPath !== stableRootName ? currentPath : stableRootName}
        initialRight={(collectionsView?.collections ?? [])
          .map((c) => c.name)
          .find((n) => n !== stableRootName && n !== currentPath)}
        {notes}
        initialLeftSlug={activeSlug ?? undefined}
      />
    {/if}

    {#if findReplaceOpen}
      <FindReplace
        open={findReplaceOpen}
        onClose={() => { findReplaceOpen = false; }}
        currentPathName={currentPath}
        currentPathSlugs={pathNotes[currentPath] ?? null}
        onChanged={async (report) => {
          invalidateAllNotes();
          notes = await api.listNotes();
          try { graph = await fetchGraph(); } catch { /* ignore */ }
          if (activeSlug) {
            try {
              const fresh = await api.readNote(activeSlug);
              activeNote = fresh;
              currentBody = fresh.body;
            } catch { /* ignore */ }
          }
          findReplaceResult = report;
        }}
      />
    {/if}

    {#if trashOpen}
      <Trash
        open={trashOpen}
        onClose={async () => {
          trashOpen = false;
          try { trashCount = (await api.listTrash()).length; } catch { /* ignore */ }
        }}
        onChanged={async () => {
          invalidateAllNotes();
          notes = await api.listNotes();
          try { graph = await fetchGraph(); } catch { /* ignore */ }
          try { orphanSet = new Set(await fetchOrphans()); } catch { /* ignore */ }
          try { trashCount = (await api.listTrash()).length; } catch { /* ignore */ }
        }}
      />
    {/if}

    {#if scratchpadOpen}
      <Scratchpad
        {activeNote}
        width={scratchpadWidth}
        onWidthChange={saveScratchpadWidth}
        reloadNonce={scratchpadReloadNonce}
        onClose={() => { scratchpadOpen = false; }}
        onPromoted={async (newSlug) => {
          const list = await api.listNotes();
          notes = list;
          graph = await fetchGraph();
          orphanSet = new Set(await fetchOrphans());
          selectSlug(newSlug);
          toast = { text: t("appshell.toast.keptAsNote"), tone: "success" };
        }}
      />
    {/if}

    {#if !focusMode}
      <RightRail
        activeOverlay={railOverlay}
        {scratchpadOpen}
        {mappingEnabled}
        mode={modeConfig}
        {personaSlot}
        onOpen={async (k) => {
          if (k === "history") {
            if (railOverlay === "history") {
              historyOpen = false;
              railOverlay = null;
            } else {
              railOverlay = "history";
              await openHistory();
            }
            return;
          }
          if ((k === "map" || k === "paths" || k === "links") && needsMainNote) {
            mainNotePromptOpen = true;
            return;
          }
          railOverlay = railOverlay === k ? null : k;
        }}
        onToggleScratchpad={() => { scratchpadOpen = !scratchpadOpen; }}
        onOpenKits={() => { kitsPickerOpen = true; }}
        onOpenTagBrowser={() => { tagBrowserOpen = true; }}
        onBranchHere={activeNote && !activeNote.locked
          ? () => {
              if (needsMainNote) {
                mainNotePromptOpen = true;
                return;
              }
              newPathOpen = true;
            }
          : undefined}
        onOpenSettings={() => { settingsOpen = { open: true }; }}
        onSetReadingWriting={async (writing) => {
          if (!writing && dirty && activeSlug) {
            try {
              await api.saveNote(activeSlug, currentBody);
              invalidateNote(activeSlug);
              dirty = false;
            } catch (e) {
              console.error("flush before reading-mode flip failed", e);
            }
          }
          showRawMarkdown.set(writing);
        }}
      />
    {/if}
  </div>

  <!-- Right-rail overlays -->
  {#if railOverlay === "map"}
    <Modal
      open
      onClose={() => { railOverlay = null; mapFilter = null; }}
      width="w-[min(90vw,1100px)]"
    >
      <div class="text-center mb-3 -mt-1">
        <div class="font-serif text-[32px] text-char tracking-tight leading-none">
          {mapFilter
            ? t("appshell.map.titleFiltered", { pathName: mapFilter.collectionName })
            : t("appshell.map.title")}
        </div>
        <div class="mt-2 text-2xs text-t3 font-mono uppercase tracking-[0.2em]">
          {#if mapFilter}
            {(() => {
              const c = collectionsView?.collections.find((x) => x.name === mapFilter!.collectionName);
              const n = c?.members.length ?? 0;
              return t(
                n === 1
                  ? "appshell.map.notesInPathSingle"
                  : "appshell.map.notesInPathPlural",
                { count: String(n) },
              );
            })()}
          {:else}
            {(activeNote?.frontmatter.title || activeSlug || t("appshell.map.thisNote"))} ·
            {(() => {
              const neighborCount = mapNeighborCount(graph, activeSlug);
              return t(
                neighborCount === 1
                  ? "appshell.map.neighborsSingle"
                  : "appshell.map.neighborsPlural",
                { count: String(neighborCount) },
              );
            })()}
          {/if}
        </div>
      </div>
      <div class="h-[62vh]">
        <ConnectionGraph
          graph={(() => {
            if (!mapFilter || !graph) return graph;
            const c = collectionsView?.collections.find((x) => x.name === mapFilter!.collectionName);
            if (!c) return graph;
            const allowed = new Set(c.members);
            return {
              ...graph,
              notes: graph.notes.filter((n) => allowed.has(n.slug)),
              links: graph.links.filter((e) => allowed.has(e.from) && allowed.has(e.to)),
            };
          })()}
          {activeSlug}
          mainNoteSlug={config?.mapping?.main_note ?? null}
          onSelect={(slug) => { selectSlug(slug); railOverlay = null; mapFilter = null; }}
          fillHeight
          onAddLink={handleGraphAddLink}
          onBulkTag={handleGraphBulkTag}
          onBulkAddToPath={handleGraphBulkAddToPath}
          pathNames={collectionsView?.collections.map((c) => c.name) ?? []}
        />
      </div>
    </Modal>
  {/if}

  {#if railOverlay === "links"}
    <Modal open onClose={() => { railOverlay = null; }} title={t("appshell.links.title")}>
      <div class="max-h-[60vh] overflow-y-auto -mx-4 px-4">
        <LinkedNotesList
          links={noteLinks}
          {titleMap}
          {snippetMap}
          onNavigate={(slug) => { selectSlug(slug); railOverlay = null; }}
          onAdd={() => { railOverlay = null; connectOpen = true; }}
          onRemove={handleRemoveConnection}
        />
        <div class="mt-4">
          <OpenQuestionsList
            {questions}
            onJump={(line) => {
              jumpSignal = { line, nonce: Date.now() };
              railOverlay = null;
            }}
          />
        </div>
        <div class="mt-2">
          <Transclusions
            body={currentBody}
            {notes}
            onNavigate={(slug) => { selectSlug(slug); railOverlay = null; }}
            refreshToken={restoreNonce}
          />
        </div>
      </div>
    </Modal>
  {/if}

  {#if railOverlay === "outline-solid"}
    <Modal open onClose={() => { railOverlay = null; }} title={t("appshell.outline.title")} width="w-[460px]">
      <div class="max-h-[60vh] overflow-y-auto -mx-2 px-2">
        <Outline
          body={currentBody}
          onJump={(line) => {
            jumpSignal = { line, nonce: Date.now() };
            railOverlay = null;
          }}
        />
      </div>
    </Modal>
  {/if}

  {#if quickHandOpen}
    <QuickHandModal
      open
      onClose={() => { quickHandOpen = false; }}
      onCustomize={() => { settingsOpen = { open: true, tab: "gestures" }; }}
    />
  {/if}
  {#if constellationModalOpen}
    <ConstellationModal open onClose={() => { constellationModalOpen = false; }} />
  {/if}

  {#if editorCtxMenu}
    {@const close = () => { editorCtxMenu = null; }}
    {@const selectionText = editorCtxMenu.text}
    {@const callbacks = {
      mappingEnabled,
      openWikilinkPicker: () => { close(); wikilinkPickerOpen = true; },
      openTableInsert: () => { close(); tableInsertOpen = true; },
      openCalloutInsert: () => { close(); calloutInsertOpen = true; },
      openInsertsModal: () => { close(); insertsModalOpen = true; },
      openFormatModal: () => { close(); formatModalOpen = { selection: selectionText }; },
      sendSelectionToScratchpad: (text: string) => { void handleSendSelectionToScratchpad(text); close(); },
      insertRaw: (text: string, opts?: { caretOffset?: number; atLineStart?: boolean }) => {
        window.dispatchEvent(new CustomEvent("yarrow:editor-insert-raw", { detail: { text, ...opts } }));
        close();
      },
      wrapSelection: (opening: string, closing: string) => {
        const wrapped = opening + selectionText + closing;
        window.dispatchEvent(new CustomEvent("yarrow:editor-insert-raw", { detail: { text: wrapped } }));
        close();
      },
      annotateSelection: (anchor: string) => {
        close();
        if (!activeNote) return;
        const trimmed = anchor.trim().replace(/\s+/g, " ").slice(0, 160);
        const next = [
          ...(activeNote.frontmatter.annotations ?? []),
          { anchor: trimmed, body: "", at: new Date().toISOString() },
        ];
        const note = activeNote;
        void (async () => {
          try {
            const updated = await api.setAnnotations(note.slug, next);
            invalidateNote(note.slug);
            if (note.slug === activeSlug) activeNote = updated;
          } catch (e) {
            toast = t("appshell.toast.annotationAddError", { error: String(e) });
          }
        })();
      },
      cutSelection: () => { window.dispatchEvent(new CustomEvent("yarrow:editor-cut")); close(); },
      pasteAtCursor: () => { window.dispatchEvent(new CustomEvent("yarrow:editor-paste")); close(); },
      selectAll: () => { window.dispatchEvent(new CustomEvent("yarrow:editor-select-all")); close(); },
      copySelection: (text: string) => {
        void import("@tauri-apps/plugin-clipboard-manager")
          .then((mod) => mod.writeText(text))
          .catch(() => {
            try { navigator.clipboard?.writeText(text); } catch { /* ignore */ }
          });
        toast = { text: t("appshell.toast.copied"), tone: "soft" };
        close();
      },
      openTimerPicker: () => { close(); timerPickerOpen = true; },
      openRecipeClipper: () => { close(); recipeClipperOpen = true; },
      addToShoppingList: () => { close(); void handleAddToShoppingList(); },
      cookingEnabled: cookingOn,
    } satisfies RadialCallbacks}
    {@const selectionTrim = editorCtxMenu.text.trim()}
    {@const items = radialMenuOn
      ? selectionTrim
        ? buildRadialSelectionItems(editorCtxMenu.text, callbacks)
        : buildRadialInsertItems(callbacks)
      : selectionTrim
        ? buildLinearSelectionItems(editorCtxMenu.text, callbacks)
        : buildLinearInsertItems(callbacks)}
    {#if radialMenuOn}
      <RadialMenu open x={editorCtxMenu.x} y={editorCtxMenu.y} {items} onClose={close} />
    {:else}
      <LinearContextMenu open x={editorCtxMenu.x} y={editorCtxMenu.y} {items} onClose={close} />
    {/if}
  {/if}

  {#if insertsModalOpen}
    <InsertsModal
      open
      onClose={() => { insertsModalOpen = false; }}
      wikilinkDisabled={!mappingEnabled}
      shoppingDisabled={!activeSlug}
      cookingEnabled={cookingOn}
      onInsertWikilink={() => { wikilinkPickerOpen = true; }}
      onInsertTask={() =>
        window.dispatchEvent(
          new CustomEvent("yarrow:editor-insert-raw", {
            detail: { text: "- [ ] ", atLineStart: true },
          }),
        )}
      onInsertTable={() => { tableInsertOpen = true; }}
      onInsertCallout={() => { calloutInsertOpen = true; }}
      onInsertTimer={() => { timerPickerOpen = true; }}
      onClipRecipe={() => { recipeClipperOpen = true; }}
      onAddToShoppingList={() => { void handleAddToShoppingList(); }}
    />
  {/if}

  {#if timerPickerOpen}
    <TimerPickerModal
      open
      onClose={() => { timerPickerOpen = false; }}
      onInsert={(markdown) =>
        window.dispatchEvent(
          new CustomEvent("yarrow:editor-insert-raw", { detail: { text: markdown } }),
        )}
    />
  {/if}
  {#if formatModalOpen}
    <FormatModal
      open
      onClose={() => { formatModalOpen = null; }}
      selection={formatModalOpen.selection}
      insertRaw={(text, opts) =>
        window.dispatchEvent(
          new CustomEvent("yarrow:editor-insert-raw", { detail: { text, ...opts } }),
        )}
      wrapSelection={(opening, closing) => {
        const wrapped = opening + formatModalOpen!.selection + closing;
        window.dispatchEvent(
          new CustomEvent("yarrow:editor-insert-raw", { detail: { text: wrapped } }),
        );
      }}
    />
  {/if}

  <RecipeClipperModal
    open={recipeClipperOpen}
    onClose={() => { recipeClipperOpen = false; }}
    onClipped={async (note) => {
      invalidateNote(note.slug);
      try { notes = await api.listNotes(); } catch { /* ignore */ }
      activeNote = note;
      selectSlug(note.slug);
    }}
  />

  <WikilinkPicker
    open={wikilinkPickerOpen}
    onClose={() => { wikilinkPickerOpen = false; }}
    {notes}
    currentSlug={activeSlug ?? undefined}
    onInsert={(text) => {
      window.dispatchEvent(
        new CustomEvent("yarrow:editor-insert-raw", { detail: { text } }),
      );
      setTimeout(() => guidance.trigger("wikilink.inserted"), 300);
    }}
  />

  {#if activityOpen}
    <ActivityHeatmap open={activityOpen} onClose={() => { activityOpen = false; }} />
  {/if}

  {#if tagGraphOpen}
    <TagGraph
      open={tagGraphOpen}
      onClose={() => { tagGraphOpen = false; }}
      {graph}
      onPickTag={(tag) => {
        tagFilter = tag;
        tagGraphOpen = false;
      }}
    />
  {/if}

  {#if tableInsertOpen}
    <TableInsertModal
      open={tableInsertOpen}
      onClose={() => { tableInsertOpen = false; }}
      onInsert={(markdown) =>
        window.dispatchEvent(
          new CustomEvent("yarrow:editor-insert-raw", { detail: { text: markdown } }),
        )}
    />
  {/if}

  {#if calloutInsertOpen}
    <CalloutInsertModal
      open={calloutInsertOpen}
      onClose={() => { calloutInsertOpen = false; }}
      onInsert={(markdown) =>
        window.dispatchEvent(
          new CustomEvent("yarrow:editor-insert-raw", {
            detail: { text: markdown, atLineStart: true },
          }),
        )}
    />
  {/if}

  {#if toast}
    {@const tt = typeof toast === "string" ? { text: toast } : toast}
    {@const tone = (typeof toast === "object" && toast.tone) || "info"}
    {@const dotStyle = tone === "success"
      ? "background: var(--accent2); box-shadow: 0 0 0 3px rgba(91,122,94,0.22)"
      : tone === "soft"
        ? "background: var(--yel); box-shadow: 0 0 0 3px rgba(122,78,110,0.22)"
        : "background: #E8C97A; box-shadow: 0 0 0 3px rgba(232,201,122,0.22)"}
    <div
      class="fixed bottom-10 z-40 max-w-[480px] bg-char text-bg text-xs px-3.5 py-2 rounded-md shadow-lg animate-fadeIn flex items-center gap-3"
      style:left="50%"
      style:transform="translateX(calc(-50% - {scratchpadOpen ? scratchpadWidth / 2 : 0}px))"
    >
      <span aria-hidden="true" class="inline-block w-2 h-2 rounded-full shrink-0" style={dotStyle}></span>
      <span class="leading-snug">{tt.text}</span>
      {#if "action" in tt && tt.action}
        <button
          onclick={() => {
            const action = (tt as { action: { label: string; run: () => void } }).action;
            action.run();
            toast = null;
          }}
          class="px-2 py-0.5 rounded-sm border border-bg/40 hover:bg-bg/10 font-medium uppercase tracking-wider text-2xs"
        >
          {tt.action.label}
        </button>
      {/if}
      <button
        onclick={() => { toast = null; }}
        class="opacity-70 hover:opacity-100 text-bg"
        aria-label={t("appshell.toast.dismiss")}
      >×</button>
    </div>
  {/if}

  <!-- Status bar -->
  <div class="h-7 shrink-0 bg-s2 border-t border-bd flex items-center px-3 text-2xs text-t2 gap-5 font-mono">
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => { settingsOpen = { open: true, tab: "mode" }; }}
        title={t("appshell.status.modePillTitle", {
          mode: t(("settings.mode.option." + modeId + ".label") as never),
        })}
        aria-label={t("appshell.status.modePillTitle", {
          mode: t(("settings.mode.option." + modeId + ".label") as never),
        })}
        class="inline-flex items-center gap-1.5 px-2 py-0.5 -mx-1 rounded-full border border-bd hover:bg-s1 hover:border-bd2 transition text-t1"
      >
        <span class="w-1.5 h-1.5 rounded-full {MODE_DOT_CLASS[modeId]}"></span>
        <span class="font-mono text-[10px] tracking-wide">
          {t(("settings.mode.option." + modeId + ".label") as never)}
        </span>
      </button>
    </div>
    <div class="flex items-center gap-2 min-w-0">
      {@render statusGroupIcon("workspace")}
      <span>{t("appshell.status.notes", { count: String(notes.length) })}</span>
      <span class="text-t3">·</span>
      <span>{t("appshell.status.paths", { count: String(pathCount) })}</span>
      <span class="text-t3">·</span>
      <span class="truncate">
        {currentPath
          ? t("appshell.status.onPath", { path: currentPath })
          : t("appshell.status.onPathNone")}
      </span>
    </div>
    {#if activeNote && !activeNote.locked}
      <div class="flex items-center gap-2">
        {@render statusGroupIcon("document")}
        {#if selectionWords > 0}
          <span class="text-yeld" title={t("appshell.status.selectedTitle", { count: String(selectionChars) })}>
            {t("appshell.status.selected", { count: String(selectionWords) })}
          </span>
        {:else}
          <span title={t("appshell.status.wordCountTitle", { minutes: String(Math.max(1, Math.round(noteWordCount / 220))) })}>
            {t(
              noteWordCount === 1
                ? "appshell.status.wordCountSingle"
                : "appshell.status.wordCountPlural",
              { count: noteWordCount.toLocaleString() },
            )}
          </span>
        {/if}
      </div>
    {/if}
    {#if modeConfig.persona === "writer"}
      <div class="flex items-center gap-2">
        <WriterStatusBarWidget onOpen={() => { streakModalOpen = true; }} />
      </div>
    {/if}
    {#if modeConfig.persona === "researcher" && questions.length > 0}
      <div class="flex items-center gap-2">
        <ResearcherStatusBarWidget
          questionCount={questions.length}
          onOpen={() => { researcherQuestionsOpen = true; }}
        />
      </div>
    {/if}
    {#if modeConfig.persona === "developer" && filterDecisions(notes).length > 0}
      <div class="flex items-center gap-2">
        <DeveloperStatusBarWidget
          decisionCount={filterDecisions(notes).length}
          onOpen={() => { decisionLogOpen = true; }}
        />
      </div>
    {/if}
    {#if modeConfig.persona === "clinician" && filterFollowUps(notes).length > 0}
      <div class="flex items-center gap-2">
        <ClinicianStatusBarWidget
          followUpCount={filterFollowUps(notes).length}
          onOpen={() => { followUpsOpen = true; }}
        />
      </div>
    {/if}
    {#if modeConfig.persona === "cooking" && filterRecipes(notes).length > 0}
      <div class="flex items-center gap-2">
        <CookingStatusBarWidget
          recipeCount={filterRecipes(notes).length}
          onOpen={() => { recipesOpen = true; }}
        />
      </div>
    {/if}
    <span class="ml-auto flex items-center gap-2 truncate">
      {#if quotaBlock !== null && !quotaModalOpen}
        <button
          type="button"
          onclick={() => { quotaModalOpen = true; }}
          title={t("appshell.status.overStorageTitle")}
          class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-danger"></span>
          {t("appshell.status.overStorage")}
        </button>
      {/if}
      {#if remotePresent && privateNoteCount > 0}
        <span
          title={t(
            privateNoteCount === 1
              ? "appshell.status.offServerSingleTitle"
              : "appshell.status.offServerPluralTitle",
            { count: String(privateNoteCount) },
          )}
          class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
          style="color: #c97a3a; border-color: rgba(201,122,58,0.35); background: rgba(201,122,58,0.08)"
        >
          <span style="font-size: 11px; line-height: 1">⊘</span>
          {t("appshell.status.offServerCount", { count: String(privateNoteCount) })}
        </span>
      {/if}
      <!-- Sync status pill -->
      <span class="relative inline-flex" bind:this={syncPopoverWrap}>
        <button
          type="button"
          onclick={() => { syncPopoverOpen = !syncPopoverOpen; }}
          class="inline-flex items-center gap-1.5 px-1.5 py-0.5 -mx-0.5 rounded-full hover:bg-s1 transition"
          aria-haspopup="dialog"
          aria-expanded={syncPopoverOpen}
          aria-label={t("appshell.sync.popover.openAria", { status: syncPresentation.label })}
        >
          <StatusDot color={syncPresentation.color} size={7} class={syncPresentation.pulse ? "animate-pulse2" : ""} />
          <span>{syncPresentation.label}</span>
          {#if syncShowAge}
            {#key syncTick}
              <span class="text-t3" title={t("appshell.status.syncTimestampTitle", { datetime: new Date(lastSyncedAt!).toLocaleString() })}>
                · {t("appshell.status.syncedAgo", { time: relativeTime(Math.floor(lastSyncedAt! / 1000)) })}
              </span>
            {/key}
          {/if}
        </button>
        {#if syncPopoverOpen}
          <div
            role="dialog"
            aria-label={t("appshell.sync.popover.title")}
            class="absolute bottom-full right-0 mb-2 w-72 bg-bg border border-bd2 rounded-lg shadow-lg p-3 text-left z-30"
          >
            <div class="flex items-center gap-2 mb-1.5">
              <StatusDot color={syncPresentation.color} size={8} />
              <div class="font-serif text-sm text-char">{syncPresentation.label}</div>
            </div>
            {#if syncShowAge}
              <div class="text-2xs text-t3 mb-2">
                {t("appshell.sync.popover.lastSynced", { time: relativeTime(Math.floor(lastSyncedAt! / 1000)) })}
              </div>
            {/if}
            <div class="text-2xs text-t2 mb-3 leading-snug whitespace-pre-wrap wrap-break-word">
              {syncMessage?.trim()
                ? syncMessage
                : t(("appshell.sync.popover.body." + syncStatus) as never)}
            </div>
            <div class="flex gap-2">
              {#if syncStatus !== "no-remote"}
                <button
                  type="button"
                  onclick={() => { syncPopoverOpen = false; void handleSync(); }}
                  class="px-2.5 py-1 text-2xs bg-yel text-on-yel rounded-md font-medium hover:opacity-90"
                >
                  {t("appshell.sync.popover.retry")}
                </button>
              {/if}
              <button
                type="button"
                onclick={() => { syncPopoverOpen = false; settingsOpen = { open: true, tab: "sync" }; }}
                class="px-2.5 py-1 text-2xs bg-s2 text-char rounded-md hover:bg-s3"
              >
                {t("appshell.sync.popover.openSettings")}
              </button>
            </div>
          </div>
        {/if}
      </span>
    </span>
  </div>

  <!-- Big modals -->
  {#if paletteOpen}
    <CommandPalette
      open={paletteOpen}
      onClose={() => { paletteOpen = false; }}
      {notes}
      paths={(collectionsView?.collections ?? []).map((c) => ({
        name: c.name,
        is_current: c.name === currentPath,
        last_activity: c.created_at || null,
      }))}
      {currentPath}
      onSelectNote={selectSlug}
      onSwitchPath={handleSwitchPath}
      onNewNote={handleCreateNote}
      onNewDirection={() => { newPathOpen = true; }}
      onOpenScratchpad={() => { scratchpadOpen = true; }}
      onToggleFocus={() => { focusMode = !focusMode; }}
      onSync={handleSync}
      onConnect={() => { connectOpen = true; }}
      onOpenHistory={openHistory}
      onJumpToday={() => { void handleOpenDaily(); }}
      tags={tagCounts}
      onFilterTag={(tg) => { tagFilter = tg; }}
      templates={templates.map((tpl) => ({ name: tpl.name, label: tpl.label }))}
      onNewFromTemplate={handleCreateFromTemplate}
      onOpenTemplatePicker={() => { templatePickerOpen = true; }}
      onOpenJournalKits={() => { kitsPickerOpen = true; }}
      {encryption}
      activeIsEncrypted={!!activeNote?.encrypted}
      onLockEncryption={handleLockEncryption}
      onUnlockEncryption={() => requestUnlock()}
      onEncryptActiveNote={handleEncryptActiveNote}
      onDecryptActiveNote={handleDecryptActiveNote}
      onOpenSecurity={() => { settingsOpen = { open: true, tab: "security" }; }}
      onSwitchWorkspace={() => { workspaceSwitcherOpen = true; }}
      onOpenNewWindow={() => api.openNewWindow().catch((e) => { toast = t("appshell.toast.openWindowError", { error: String(e) }); })}
      onFindReplace={() => { findReplaceOpen = true; }}
      onPrintActiveNote={activeSlug ? () => { void printActiveNote(activeSlug!); } : undefined}
      onOpenTrash={() => { trashOpen = true; }}
      onImportObsidian={() => { obsidianImportOpen = true; }}
      onComparePaths={() => { pathCompareOpen = true; }}
      onOpenDecisionMatrix={() => { decisionMatrixOpen = true; }}
      onOpenActivity={() => { activityOpen = true; }}
      onOpenTagGraph={() => { tagGraphOpen = true; }}
      onInsertTable={() => { tableInsertOpen = true; }}
      onInsertBibliography={activeSlug
        ? async () => {
            try {
              await api.insertBibliography(activeSlug!);
              invalidateNote(activeSlug!);
              selectSlug(activeSlug);
            } catch (e) {
              toast = String(e);
            }
          }
        : undefined}
      onOpenOutline={() => { railOverlay = "outline-solid"; }}
      livePreviewOn={livePreviewValue}
      onToggleLivePreview={() => {
        if (!showRawValue) showRawMarkdown.set(true);
        livePreview.set(!livePreview.value);
      }}
      onPrintCurrentPath={currentPath ? () => { void printActivePath(currentPath); } : undefined}
      onClipRecipe={cookingOn ? () => { recipeClipperOpen = true; } : undefined}
      onAddToShoppingList={cookingOn && activeSlug ? handleAddToShoppingList : undefined}
      {mappingEnabled}
      currentMode={modeId}
      onSetMode={(id) => mode.set(id)}
      onOpenModeSettings={() => { settingsOpen = { open: true, tab: "mode" }; }}
    />
  {/if}

  {#if switcherOpen}
    <QuickSwitcher
      open={switcherOpen}
      onClose={() => { switcherOpen = false; }}
      {notes}
      {activeSlug}
      onSelect={selectSlug}
    />
  {/if}

  {#if settingsOpen.open}
    <Settings
      open={settingsOpen.open}
      initialTab={settingsOpen.tab}
      onClose={() => { settingsOpen = { open: false }; }}
      {workspacePath}
      {config}
      onConfigChange={(cfg) => { config = cfg; }}
      onSyncNow={handleSync}
      onCloseWorkspace={closeWorkspace}
      onImport={() => {
        settingsOpen = { open: false };
        obsidianImportOpen = true;
      }}
    />
  {/if}

  <ForkMoment pathName={forkMoment} onDone={() => { forkMoment = null; }} />

  <QuotaBlockedModal
    open={quotaModalOpen && quotaBlock !== null}
    blockInfo={quotaBlock}
    onClose={() => { quotaModalOpen = false; }}
    onDiscarded={(out) => {
      toast = {
        text: t(
          out.commits_ahead === 1
            ? "appshell.toast.discardSyncingSingle"
            : "appshell.toast.discardSyncingPlural",
          { count: String(out.commits_ahead) },
        ),
        tone: "soft",
        ttlMs: 4000,
      };
      void (async () => {
        try {
          const r = await api.sync();
          if (r.ok) {
            syncStatus = "synced";
            syncMessage = "synced";
            quotaBlock = null;
            quotaModalOpen = false;
          } else {
            syncStatus = "error";
            syncMessage = r.message;
          }
        } catch (e) {
          syncStatus = "error";
          syncMessage = String(e);
        }
      })();
    }}
    onOpenManageStorage={() => {
      quotaModalOpen = false;
      settingsOpen = { open: true, tab: "storage" };
    }}
  />

  <GuidanceHost />

  <MainNotePrompt
    open={mainNotePromptOpen}
    onClose={() => { mainNotePromptOpen = false; }}
    onConfigChange={(cfg) => { config = cfg; }}
    onAfterSet={(slug) => selectSlug(slug)}
  />

  {#if editConditionFor}
    <ConditionEditor
      branch={editConditionFor}
      initial={pathMetaMap[editConditionFor]?.condition || ""}
      onSave={async (next) => {
        const name = editConditionFor;
        editConditionFor = null;
        if (!name) return;
        try {
          await api.setPathCondition(name, next);
          const topo = await fetchTopology();
          topology = topo;
          await refreshPathAwareness();
        } catch (e) {
          console.error("save condition failed", e);
        }
      }}
      onCancel={() => { editConditionFor = null; }}
    />
  {/if}

  {#if railOverlay === "paths"}
    <PathsPane
      {notes}
      currentPathName={currentPath}
      onOpenDecisionMatrix={() => { decisionMatrixOpen = true; }}
      onClose={() => { railOverlay = null; }}
      onNavigate={(slug) => { selectSlug(slug); railOverlay = null; }}
      onSwitchToRoot={(rootName) => handleSwitchPath(rootName)}
      onLinksChanged={async () => {
        const [g, orphansList] = await Promise.all([fetchGraph(), fetchOrphans()]);
        graph = g;
        orphanSet = new Set(orphansList);
        if (activeSlug) {
          try {
            const n = await api.readNote(activeSlug);
            activeNote = n;
          } catch { /* ignore */ }
        }
      }}
      onOpenMap={(collectionName, focusSlug) => {
        if (focusSlug) selectSlug(focusSlug);
        mapFilter = { collectionName };
        railOverlay = "map";
      }}
      onCollectionsChanged={(v) => { collectionsView = v; }}
    />
  {/if}

  {#if compareSession}
    <PathDiff
      {currentPath}
      otherPath={compareSession}
      onClose={() => { compareSession = null; }}
    />
  {/if}

  {#if conflictSession}
    <ConflictResolver
      relpaths={conflictSession.relpaths}
      currentPath={conflictSession.currentPath}
      otherPath={conflictSession.otherPath}
      onResolvedAll={onConflictsResolved}
      onAbort={onConflictAbort}
    />
  {/if}

  <Modal
    open={newPathOpen}
    onClose={() => {
      newPathOpen = false;
      newPathName = "";
      newPathCondition = "";
      newPathFrom = "";
    }}
    title={t("appshell.newPath.title")}
  >
    <p class="text-xs text-t2 mb-3 leading-relaxed">
      {t("appshell.newPath.intro", { root: "{{ROOT}}" }).split("{{ROOT}}")[0]}
      <span class="font-medium text-yeld">{collectionsView?.root || "main"}</span>
      {t("appshell.newPath.intro", { root: "{{ROOT}}" }).split("{{ROOT}}")[1] ?? ""}
    </p>

    <div class="mb-4 px-3 py-2 bg-yelp/40 border border-yel/40 rounded-md flex items-center gap-2">
      <span class="inline-block w-2 h-2 rounded-full bg-yel shrink-0"></span>
      <span class="text-2xs text-t2 leading-snug">
        {t("appshell.newPath.trunkHint", { root: "{{ROOT}}" }).split("{{ROOT}}")[0]}
        <span class="font-medium text-yeld">{collectionsView?.root || "main"}</span>
        {t("appshell.newPath.trunkHint", { root: "{{ROOT}}" }).split("{{ROOT}}")[1] ?? ""}
      </span>
    </div>

    <label class="block text-2xs uppercase tracking-[0.18em] font-mono text-t3 mb-1.5" for="new-path-condition-input">
      {t("appshell.newPath.questionLabel")}
    </label>
    <textarea
      id="new-path-condition-input"
      bind:value={newPathCondition}
      onkeydown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          void handleCreatePath();
        }
      }}
      rows={2}
      placeholder={t("appshell.newPath.placeholder")}
      class="w-full px-4 py-2.5 bg-bg-soft border border-bd rounded-md text-char font-serif italic placeholder:not-italic placeholder:text-t3/70 text-[15px] resize-none leading-snug"
    ></textarea>
    <div class="mt-2 flex flex-wrap gap-1">
      {#each [
        t("appshell.newPath.suggestion1"),
        t("appshell.newPath.suggestion2"),
        t("appshell.newPath.suggestion3"),
        t("appshell.newPath.suggestion4"),
      ] as s (s)}
        <button
          onclick={() => { newPathCondition = s; }}
          class="text-2xs px-2 py-0.5 bg-s2 text-t2 rounded-full hover:bg-s3 hover:text-char transition"
        >{s}</button>
      {/each}
    </div>

    <details class="mt-4 group">
      <summary class="cursor-pointer text-2xs text-t3 hover:text-char select-none">
        {t("appshell.newPath.nameYourselfSummary")}
      </summary>
      <input
        bind:value={newPathName}
        onkeydown={(e) => { if (e.key === "Enter") void handleCreatePath(); }}
        placeholder={newPathCondition ? t("appshell.newPath.namePlaceholderAuto") : t("appshell.newPath.namePlaceholderEmpty")}
        class="mt-2 w-full px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs"
      />
    </details>

    <div class="mt-5 flex items-center justify-end gap-2">
      <button
        class="px-3 py-1.5 text-sm text-t2 hover:text-char"
        onclick={() => {
          newPathOpen = false;
          newPathName = "";
          newPathCondition = "";
          newPathFrom = "";
        }}
      >{t("appshell.newPath.notNow")}</button>
      <button
        class="btn-yel px-4 py-1.5 text-sm rounded-md"
        onclick={handleCreatePath}
        disabled={!newPathCondition.trim() && !newPathName.trim()}
      >{t("appshell.newPath.startExploring")}</button>
    </div>
    <div class="mt-3 text-2xs text-t3 text-center italic">
      {t("appshell.newPath.tipShortcut")}
    </div>
  </Modal>

  <Modal open={connectOpen} onClose={() => { connectOpen = false; }} title={t("appshell.connect.title")}>
    <label class="text-xs text-t2 block mb-1" for="connect-target-select">{t("appshell.connect.toLabel")}</label>
    <select
      id="connect-target-select"
      bind:value={connectTarget}
      class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char mb-3"
    >
      <option value="">{t("appshell.connect.choosePlaceholder")}</option>
      {#each notes.filter((n) => n.slug !== activeSlug) as n (n.slug)}
        <option value={n.slug}>{n.title}</option>
      {/each}
    </select>
    <label class="text-xs text-t2 block mb-1" for="connect-type-select">{t("appshell.connect.asLabel")}</label>
    <select
      id="connect-type-select"
      bind:value={connectType}
      class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
    >
      <option value="supports">{t("appshell.connect.typeSupports")}</option>
      <option value="challenges">{t("appshell.connect.typeChallenges")}</option>
      <option value="came-from">{t("appshell.connect.typeCameFrom")}</option>
      <option value="open-question">{t("appshell.connect.typeOpenQuestion")}</option>
    </select>
    <p class="text-2xs text-t3 mt-2">{t("appshell.connect.reverseHint")}</p>
    <div class="mt-4 flex justify-end gap-2">
      <button class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => { connectOpen = false; }}>
        {t("appshell.connect.cancel")}
      </button>
      <button
        class="btn-yel px-3 py-1.5 text-sm rounded-md"
        onclick={handleAddConnection}
        disabled={!connectTarget}
      >{t("appshell.connect.connect")}</button>
    </div>
  </Modal>

  <Modal
    open={!!confirmState}
    onClose={() => { confirmState = null; }}
    title={confirmState?.title}
  >
    <p class="text-sm text-t2 mb-4">{confirmState?.body}</p>
    <div class="flex justify-end gap-2">
      <button class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => { confirmState = null; }}>
        {t("appshell.confirm.keepIt")}
      </button>
      <button
        class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
        onclick={confirmState?.onConfirm}
      >{t("appshell.confirm.yesDelete")}</button>
    </div>
  </Modal>

  <Modal
    open={newNoteOpen}
    onClose={() => { newNoteOpen = false; }}
    width="w-[640px] max-w-[94vw]"
  >
    <div class="flex flex-col">
      <div class="shrink-0">
        <div class="font-serif text-[28px] text-char tracking-tight leading-tight">
          {t("appshell.newNote.title")}
        </div>
        <div class="font-serif italic text-sm text-t2 mt-1">
          {t("appshell.newNote.subtitle")}
        </div>
      </div>
      <div class="mt-5 grid {newNoteGridClass} gap-3">
        {@render newNoteRouteTile(
          newNoteTemplate === null,
          () => { newNoteTemplate = null; },
          t("appshell.newNote.tileBlankTitle"),
          t("appshell.newNote.tileBlankSub"),
          blankGlyph,
        )}
        {@render newNoteRouteTile(
          false,
          () => { newNoteOpen = false; kitsPickerOpen = true; },
          t("appshell.newNote.tileKitsTitle"),
          t("appshell.newNote.tileKitsSub"),
          kitsRouteGlyph,
        )}
        {#if customTemplatesCount > 0}
          {@render newNoteRouteTile(
            false,
            () => { newNoteOpen = false; customTemplatesOpen = true; },
            t("appshell.newNote.tileTemplatesTitle"),
            t(
              customTemplatesCount === 1
                ? "appshell.newNote.tileTemplatesSubSingle"
                : "appshell.newNote.tileTemplatesSubPlural",
              { count: String(customTemplatesCount) },
            ),
            customTemplatesRouteGlyph,
          )}
        {/if}
        {#if cookingOn}
          {@render newNoteRouteTile(
            false,
            () => { newNoteOpen = false; recipeClipperOpen = true; },
            t("appshell.newNote.tileRecipeUrlTitle"),
            t("appshell.newNote.tileRecipeUrlSub"),
            recipeUrlRouteGlyph,
          )}
        {/if}
      </div>

      <div class="mt-5 pt-5 border-t border-bd">
        <label class="text-2xs uppercase tracking-wider text-t3 font-semibold block mb-2" for="new-note-title-input">
          {t("appshell.newNote.titleLabel", { path: currentPath || "main" })}
        </label>
        <input
          id="new-note-title-input"
          bind:value={newNoteTitle}
          onkeydown={(e) => { if (e.key === "Enter") void confirmCreateNote(); }}
          placeholder={t("appshell.newNote.titlePlaceholder")}
          class="w-full px-4 py-2.5 bg-bg border border-bd rounded-full text-sm text-char placeholder:text-t3 focus:outline-hidden focus:border-bd2 transition"
        />
      </div>

      <div class="mt-5 flex items-center justify-end gap-2">
        <button class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => { newNoteOpen = false; }}>
          {t("appshell.newNote.cancel")}
        </button>
        <button
          class="btn-yel px-4 py-2 text-sm rounded-full"
          onclick={confirmCreateNote}
          disabled={!newNoteTitle.trim()}
        >{t("appshell.newNote.createBlank")}</button>
      </div>
    </div>
  </Modal>

  {#if customTemplatesOpen}
    <CustomTemplatesModal
      open={customTemplatesOpen}
      {templates}
      onClose={() => { customTemplatesOpen = false; }}
      onPick={async (name, title) => {
        customTemplatesOpen = false;
        try {
          const n = await api.createFromTemplate(name, title);
          const list = await api.listNotes();
          notes = list;
          activeSlug = n.slug;
          graph = await fetchGraph();
          orphanSet = new Set(await fetchOrphans());
          toast = { text: t("appshell.toast.createdTitle", { title }), tone: "success" };
        } catch (e) {
          toast = {
            text: t("appshell.toast.createFromTemplateGenericError", { error: String(e) }),
            tone: "soft",
          };
        }
      }}
    />
  {/if}

  <Modal
    open={!!pendingTemplate}
    onClose={() => { pendingTemplate = null; templateTitle = ""; }}
    title={t("appshell.templateName.title", {
      label: templates.find((tpl) => tpl.name === pendingTemplate)?.label ?? pendingTemplate ?? "",
    })}
  >
    <p class="text-xs text-t2 mb-3 leading-relaxed">
      {t("appshell.templateName.body")}
    </p>
    <input
      bind:value={templateTitle}
      onkeydown={(e) => { if (e.key === "Enter") void confirmCreateFromTemplate(); }}
      placeholder={t("appshell.templateName.placeholder")}
      class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
    />
    <div class="mt-4 flex justify-end gap-2">
      <button class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => { pendingTemplate = null; templateTitle = ""; }}>
        {t("appshell.templateName.cancel")}
      </button>
      <button
        class="btn-yel px-3 py-1.5 text-sm rounded-md"
        onclick={confirmCreateFromTemplate}
        disabled={!templateTitle.trim()}
      >{t("appshell.templateName.create")}</button>
    </div>
  </Modal>

  {#if kitsPickerOpen}
    <JournalKits
      open={kitsPickerOpen}
      {templates}
      onClose={() => { kitsPickerOpen = false; }}
      onPick={async (name, title) => {
        kitsPickerOpen = false;
        try {
          const n = await api.createFromTemplate(name, title);
          const list = await api.listNotes();
          notes = list;
          activeSlug = n.slug;
          graph = await fetchGraph();
          orphanSet = new Set(await fetchOrphans());
          toast = { text: t("appshell.toast.startedKit", { title }), tone: "success" };
        } catch (e) {
          toast = {
            text: t("appshell.toast.createFromKitError", { error: String(e) }),
            tone: "soft",
          };
        }
      }}
    />
  {/if}

  {#if streakModalOpen}
    <StreakModal open={streakModalOpen} onClose={() => { streakModalOpen = false; }} />
  {/if}

  {#if researcherQuestionsOpen}
    <ResearcherQuestionsModal
      open={researcherQuestionsOpen}
      onClose={() => { researcherQuestionsOpen = false; }}
      noteTitle={activeNote?.frontmatter.title || activeNote?.slug || ""}
      {questions}
      onJump={(line) => { jumpSignal = { line, nonce: Date.now() }; }}
    />
  {/if}

  {#if sourcesOpen}
    <SourcesModal
      open={sourcesOpen}
      onClose={() => { sourcesOpen = false; }}
      {notes}
      onSelect={selectSlug}
      onCreate={handleCreateSource}
    />
  {/if}

  {#if decisionLogOpen}
    <DecisionLogModal
      open={decisionLogOpen}
      onClose={() => { decisionLogOpen = false; }}
      {notes}
      onSelect={selectSlug}
      onCreate={handleCreateAdr}
    />
  {/if}

  {#if sensitiveOpen}
    <SensitiveModal
      open={sensitiveOpen}
      onClose={() => { sensitiveOpen = false; }}
      {notes}
      onSelect={selectSlug}
    />
  {/if}

  {#if followUpsOpen}
    <FollowUpsModal
      open={followUpsOpen}
      onClose={() => { followUpsOpen = false; }}
      {notes}
      onSelect={selectSlug}
    />
  {/if}

  {#if sessionKitOpen}
    <SessionKitModal
      open={sessionKitOpen}
      onClose={() => { sessionKitOpen = false; }}
      onPick={handlePickSessionKit}
    />
  {/if}

  {#if recipesOpen}
    <RecipesModal
      open={recipesOpen}
      onClose={() => { recipesOpen = false; }}
      {notes}
      onSelect={selectSlug}
      onClip={() => { recipeClipperOpen = true; }}
    />
  {/if}

  {#if tagBrowserOpen}
    <TagBrowserModal
      open={tagBrowserOpen}
      onClose={() => { tagBrowserOpen = false; }}
      {notes}
      {activeSlug}
      activeTags={activeNote?.frontmatter.tags ?? []}
      onToggleTag={async (tag) => {
        if (!activeSlug) return;
        const trimmed = tag.trim();
        if (!trimmed) return;
        try {
          const cur = activeNote?.frontmatter.tags ?? [];
          const has = cur.some((x) => x.toLowerCase() === trimmed.toLowerCase());
          const next = has
            ? cur.filter((x) => x.toLowerCase() !== trimmed.toLowerCase())
            : [...cur, trimmed];
          const updated = await api.setTags(activeSlug, next);
          invalidateNote(activeSlug);
          activeNote = updated;
          notes = await api.listNotes();
          try { graph = await fetchGraph(); } catch { /* ignore */ }
        } catch (e) {
          toast = t("appshell.toast.tagsError", { error: String(e) });
        }
      }}
    />
  {/if}

  <Modal
    open={templatePickerOpen}
    onClose={() => { templatePickerOpen = false; }}
    title={t("appshell.templatePicker.title")}
  >
    {#if templates.length === 0}
      <p class="text-sm text-t2">{t("appshell.templatePicker.empty")}</p>
    {:else}
      <ul class="space-y-1 max-h-[60vh] overflow-y-auto">
        {#each templates as tpl (tpl.name)}
          <li>
            <button
              onclick={() => {
                templatePickerOpen = false;
                handleCreateFromTemplate(tpl.name);
              }}
              class="w-full text-left px-3 py-2 rounded-md hover:bg-s2 flex items-center gap-2"
            >
              <span class="text-char">{tpl.label}</span>
              {#if tpl.is_daily}
                <span class="text-2xs px-1.5 py-px bg-yelp text-yeld rounded-sm">
                  {t("appshell.templatePicker.dailyBadge")}
                </span>
              {/if}
              <span class="ml-auto text-2xs text-t3 font-mono">{tpl.name}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </Modal>

  {#if quickCaptureOpen}
    <QuickCapture open={quickCaptureOpen} onClose={() => { quickCaptureOpen = false; }} />
  {/if}

  {#if unlockOpen}
    <UnlockPrompt
      open={unlockOpen}
      reason={unlockReason}
      {onUnlocked}
      onClose={() => { unlockOpen = false; }}
    />
  {/if}

  <OnboardingHints {workspacePath} />
</div>