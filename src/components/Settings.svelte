<script module lang="ts">
  // Tabs are exported so a parent can pin an `initialTab`. Keep the
  // ordering aligned with the React file so call sites don't drift.
  export type Tab =
    | "mode"
    | "appearance"
    | "accessibility"
    | "writing"
    | "gestures"
    | "guidance"
    | "sync"
    | "storage"
    | "templates"
    | "security"
    | "workspace"
    | "shortcuts"
    | "help"
    | "about";

  // Pane-level "scope" — where a setting is persisted. Same three-way
  // taxonomy as the React file: device-local, workspace-scoped, account
  // (Yarrow server), or "mixed" for panes whose rows split.
  export type SettingScope = "device" | "workspace" | "account" | "mixed";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { api } from "../lib/tauri";
  import type {
    NoteSummary,
    TemplateInfo,
    WorkspaceConfig,
    LargeBlobEntry,
    ReclaimSpaceOutcome,
    ConflictResolution,
  } from "../lib/types";
  import MainNotePrompt from "./MainNotePrompt.svelte";
  import Modal from "./Modal.svelte";
  import {
    theme,
    LIGHT_THEMES,
    DARK_THEMES,
    type ThemeMode,
  } from "../lib/theme.svelte";
  import {
    showRawMarkdown,
    editorFont,
    EDITOR_FONTS,
    typewriterMode,
    editorialReading,
    pathTintedCaret,
    type EditorFontChoice,
    type EditorFontId,
  } from "../lib/editorPrefs.svelte";
  import {
    EXTRAS,
    extraCodeHighlight,
    extraImagePreview,
    extraRadialMenu,
    extraSpell,
    type ExtraKey,
  } from "../lib/extraPrefs.svelte";
  import {
    BINDABLE_ACTIONS,
    getDefaultBinding,
    resetGestureBindings,
    gestureStore,
    type GestureSlot,
  } from "../lib/gesturePrefs.svelte";
  import type { CenterActionId } from "./Editor/center/actions";
  import {
    uiFont,
    UI_FONTS,
    type UiFontId,
    uiScale,
    UI_SCALES,
    type UiScaleId,
  } from "../lib/uiPrefs.svelte";
  import {
    personality,
    PERSONALITIES,
    type PersonalityId,
  } from "../lib/personalityPrefs.svelte";
  import { paperWarmth } from "../lib/paperPrefs.svelte";
  import {
    language,
    LANGUAGE_ORDER,
    type LanguageCode,
  } from "../lib/language.svelte";
  import { tr, type StringKey } from "../lib/i18n/index.svelte";
  import {
    SunIcon,
    MoonIcon,
    AutoThemeIcon,
  } from "../lib/iconsSvelte";
  import { IS_MAC, tildify, namedShortcutsStore } from "../lib/platform.svelte";
  import {
    MAC_FUDGE_PRESETS,
    macFudgePreset,
    type MacFudgePresetId,
  } from "../lib/macViewportFudge.svelte";
  import { APP_VERSION } from "../lib/version";
  import { guidance } from "../lib/guidanceStore.svelte";
  import { mode as modeStore } from "../lib/mode.svelte";
  import { MODES, MODE_BULLET_COUNT, type ModeId, type PersonaId } from "../lib/modes";
  import {
    TEXT_SCALES,
    type TextScale,
    CONTRAST_LEVELS,
    type ContrastLevel,
    MOTION_OVERRIDES,
    type MotionOverride,
    SPELLCHECK_TONES,
    type SpellcheckTone,
    FOCUS_RING_STYLES,
    type FocusRingStyle,
    a11yTextScale,
    a11yContrast,
    reduceTransparency,
    largerCursor,
    dyslexiaFont,
    reduceMotionOverride,
    disableAutoplay,
    largeHitTargets,
    stickyKeysAware,
    readingGuide,
    spellcheckTone,
    verboseAnnouncements,
    focusRingStyle,
    colorBlindSafe,
    COLOR_BLIND_TYPES,
    type ColorBlindType,
    colorBlindType,
    diffPatterns,
    graphTableAlt,
    applyA11yPersona,
    a11yPersonaSettingCount,
    resetAccessibilityPrefs,
  } from "../lib/accessibilityPrefs.svelte";

  interface Props {
    open: boolean;
    initialTab?: Tab;
    onClose: () => void;
    workspacePath: string;
    config: WorkspaceConfig | null;
    onConfigChange: (cfg: WorkspaceConfig) => void;
    onSyncNow: () => void;
    onCloseWorkspace: () => void;
    /** Open the import-from-other-app modal. Threaded through so the
     *  Settings → Workspace pane has its own import entry point — the
     *  command palette is fine for keyboard-first users, but new users
     *  hunt in Settings first. */
    onImport?: () => void;
  }

  let {
    open,
    initialTab,
    onClose,
    workspacePath,
    config,
    onConfigChange,
    onSyncNow,
    onCloseWorkspace,
    onImport,
  }: Props = $props();

  let t = $derived(tr());
  // svelte-ignore state_referenced_locally
  let tab = $state<Tab>(initialTab ?? "appearance");
  let query = $state("");

  $effect(() => {
    if (open) {
      tab = initialTab ?? "appearance";
      query = "";
    }
  });

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Cross-pane jump events — used by GesturesPane's "Open Accessibility"
  // link when the radial menu is disabled. Lets a pane request tab
  // navigation without prop-drilling through to NavTabs.
  $effect(() => {
    if (!open) return;
    const onJump = (e: Event) => {
      const detail = (e as CustomEvent<Tab>).detail;
      if (detail) tab = detail;
    };
    window.addEventListener("yarrow:settings-jump-tab", onJump as EventListener);
    return () =>
      window.removeEventListener(
        "yarrow:settings-jump-tab",
        onJump as EventListener,
      );
  });

  let tabLabels = $derived<Record<Tab, string>>({
    mode: t("settings.tabs.mode"),
    appearance: t("settings.tabs.appearance"),
    accessibility: t("settings.tabs.accessibility"),
    writing: t("settings.tabs.writing"),
    gestures: t("settings.tabs.gestures"),
    guidance: t("settings.tabs.guidance"),
    templates: t("settings.tabs.templates"),
    sync: t("settings.tabs.sync"),
    storage: t("settings.tabs.storage"),
    security: t("settings.tabs.security"),
    workspace: t("settings.tabs.workspace"),
    shortcuts: t("settings.tabs.shortcuts"),
    help: t("settings.tabs.help"),
    about: t("settings.tabs.about"),
  });

  function setTab(next: Tab) {
    tab = next;
    query = "";
  }

  // ─────────── settings index for search ───────────
  interface SettingEntry {
    tab: Tab;
    labelKey: StringKey;
    sublabelKey?: StringKey;
    keywords?: string[];
  }

  const SETTINGS_INDEX: SettingEntry[] = [
    { tab: "mode", labelKey: "settings.search.mode.label", sublabelKey: "settings.search.mode.sublabel", keywords: ["mode", "persona", "writer", "researcher", "developer", "basic", "path", "skin", "preset"] },

    { tab: "appearance", labelKey: "settings.search.appearance.theme.label", sublabelKey: "settings.search.appearance.theme.sublabel", keywords: ["color", "mode", "dark", "light", "ashrose", "rose", "dracula", "purple"] },
    { tab: "appearance", labelKey: "settings.search.appearance.size.label", sublabelKey: "settings.search.appearance.size.sublabel", keywords: ["scale", "zoom", "chrome"] },
    { tab: "appearance", labelKey: "settings.search.appearance.font.label", sublabelKey: "settings.search.appearance.font.sublabel", keywords: ["font", "typography", "ui", "inter", "georgia", "serif", "merriweather"] },

    { tab: "accessibility", labelKey: "settings.search.accessibility.label", sublabelKey: "settings.search.accessibility.sublabel", keywords: ["a11y", "vision", "low vision", "dyslexia", "motion", "motor", "cognitive", "color blind", "contrast", "text size", "screen reader", "focus ring-3"] },
    { tab: "accessibility", labelKey: "settings.search.accessibility.contrast.label", keywords: ["contrast", "wcag", "aaa"] },
    { tab: "accessibility", labelKey: "settings.search.accessibility.dyslexia.label", keywords: ["dyslexia", "atkinson"] },
    { tab: "accessibility", labelKey: "settings.search.accessibility.motion.label", keywords: ["motion", "animation", "vestibular"] },

    { tab: "writing", labelKey: "settings.search.writing.autosave.label", sublabelKey: "settings.search.writing.autosave.sublabel", keywords: ["autosave", "save", "delay"] },
    { tab: "writing", labelKey: "settings.search.writing.askThinking.label", keywords: ["thinking", "commit", "message"] },
    { tab: "writing", labelKey: "settings.search.writing.fadeNotes.label", keywords: ["decay", "stale", "dim", "unvisited"] },
    { tab: "writing", labelKey: "settings.search.writing.editorFontSize.label", keywords: ["size", "font", "zoom"] },
    { tab: "writing", labelKey: "settings.search.writing.focusDefault.label", keywords: ["focus", "default"] },
    { tab: "writing", labelKey: "settings.search.writing.rawMarkdown.label", keywords: ["markdown", "source", "raw"] },
    { tab: "writing", labelKey: "settings.search.writing.editorFont.label", keywords: ["font", "serif", "sans", "lora", "source serif"] },

    { tab: "guidance", labelKey: "settings.search.guidance.guidedMode.label", sublabelKey: "settings.search.guidance.guidedMode.sublabel", keywords: ["guide", "tour", "tutorial", "help", "teach", "walkthrough", "onboarding"] },
    { tab: "guidance", labelKey: "settings.search.guidance.reset.label", sublabelKey: "settings.search.guidance.reset.sublabel", keywords: ["reset", "forget", "tour", "show again"] },

    { tab: "templates", labelKey: "settings.search.templates.label", sublabelKey: "settings.search.templates.sublabel", keywords: ["template", "scaffold"] },

    { tab: "sync", labelKey: "settings.search.sync.repo.label", keywords: ["git", "remote", "github", "gitea", "backup"] },
    { tab: "sync", labelKey: "settings.search.sync.token.label", keywords: ["password", "pat", "github"] },
    { tab: "sync", labelKey: "settings.search.sync.server.label", sublabelKey: "settings.search.sync.server.sublabel", keywords: ["yarrow", "server", "connect", "cloud", "sync", "account", "sign in", "login"] },
    { tab: "sync", labelKey: "settings.search.sync.disconnect.label", keywords: ["revoke", "unlink", "sign out", "logout"] },

    { tab: "security", labelKey: "settings.search.security.localEnc.label", sublabelKey: "settings.search.security.localEnc.sublabel", keywords: ["encrypt", "password", "security", "argon"] },
    { tab: "security", labelKey: "settings.search.security.idleLock.label", keywords: ["timeout", "lock", "idle"] },
    { tab: "security", labelKey: "settings.search.security.changePw.label", keywords: ["password", "rewrap"] },
    { tab: "security", labelKey: "settings.search.security.recovery.label", keywords: ["seed", "mnemonic", "backup"] },
    { tab: "security", labelKey: "settings.search.security.turnOff.label", keywords: ["disable", "plaintext"] },

    { tab: "workspace", labelKey: "settings.search.workspace.name.label", sublabelKey: "settings.search.workspace.name.sublabel", keywords: ["rename", "title"] },
    { tab: "workspace", labelKey: "settings.search.workspace.folder.label", sublabelKey: "settings.search.workspace.folder.sublabel", keywords: ["path", "location", "directory"] },
    { tab: "workspace", labelKey: "settings.search.workspace.export.label", keywords: ["html", "publish", "share"] },
    { tab: "workspace", labelKey: "settings.search.workspace.trim.label", sublabelKey: "settings.search.workspace.trim.sublabel", keywords: ["prune", "delete", "history", "old"] },
    { tab: "workspace", labelKey: "settings.search.workspace.close.label", keywords: ["exit", "switch"] },

    { tab: "shortcuts", labelKey: "settings.search.shortcuts.label", keywords: ["hotkey", "keybinding", "shortcut"] },

    { tab: "about", labelKey: "settings.search.about.label", sublabelKey: "settings.search.about.sublabel", keywords: ["version", "build"] },
  ];

  let serverConnected = $derived(!!config?.sync?.server?.workspace_id);
  let groups = $derived<{ labelKey: StringKey; tabs: Tab[] }[]>([
    {
      labelKey: "settings.nav.group.experience",
      tabs: [
        "mode",
        "appearance",
        "accessibility",
        "writing",
        "gestures",
        "guidance",
        "shortcuts",
      ],
    },
    {
      labelKey: "settings.nav.group.content",
      tabs: ["templates", "workspace"],
    },
    {
      labelKey: "settings.nav.group.system",
      tabs: [
        "sync",
        ...(serverConnected ? (["storage"] as Tab[]) : []),
        "security",
      ],
    },
    {
      labelKey: "settings.nav.group.about",
      tabs: ["help", "about"],
    },
  ]);

  // ─────────── search results ───────────
  let searchResults = $derived.by(() => {
    const q = query.trim();
    if (!q) return null;
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return SETTINGS_INDEX.filter((entry) => {
      const label = t(entry.labelKey);
      const sublabel = entry.sublabelKey ? t(entry.sublabelKey) : "";
      const haystack = [
        label,
        sublabel,
        tabLabels[entry.tab],
        ...(entry.keywords ?? []),
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  });

  let searchByTab = $derived.by(() => {
    if (!searchResults) return null;
    const m = new Map<Tab, SettingEntry[]>();
    for (const r of searchResults) {
      if (!m.has(r.tab)) m.set(r.tab, []);
      m.get(r.tab)!.push(r);
    }
    return Array.from(m.entries());
  });

  function pickSearchTab(next: Tab) {
    tab = next;
    query = "";
  }

  // ─────────── Mode pane state ───────────
  let activeMode = $derived(modeStore.id);
  let isBasic = $derived(activeMode === "basic");
  let isPathBased = $derived(!isBasic);
  let currentPersona: PersonaId | null = $derived(
    isBasic ? null : MODES[activeMode].persona,
  );

  function modeLabelFor(id: ModeId): string {
    return t(`settings.mode.option.${id}.label` as StringKey);
  }
  function modeDescFor(id: ModeId): string {
    return t(`settings.mode.option.${id}.desc` as StringKey);
  }
  function modeBulletsFor(id: ModeId): string[] {
    return Array.from({ length: MODE_BULLET_COUNT }, (_, i) =>
      t(`settings.mode.option.${id}.bullet${i + 1}` as StringKey),
    );
  }
  const PERSONA_IDS: readonly (PersonaId | null)[] = [
    null,
    "writer",
    "researcher",
    "developer",
    "clinician",
    "cooking",
  ];
  function personaToModeId(p: PersonaId | null): ModeId {
    return p === null ? "path" : p;
  }
  function onPickModeRoot(id: "basic" | "path") {
    if (id === "basic") {
      modeStore.set("basic");
      return;
    }
    if (isBasic) modeStore.set("path");
  }
  function modeSwatchClass(id: ModeId): string {
    switch (id) {
      case "basic":      return "bg-t2 text-bg";
      case "path":       return "bg-yelp text-yeld";
      case "writer":     return "bg-rose-500 text-bg";
      case "researcher": return "bg-emerald-600 text-bg";
      case "developer":  return "bg-sky-700 text-bg";
      case "clinician":  return "bg-teal-700 text-bg";
      case "cooking":    return "bg-orange-600 text-bg";
    }
  }

  function isMacCopy(): boolean {
    return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }

  function humanBytesStorage(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "?";
    if (n < 1024) return `${n} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let v = n / 1024;
    for (const u of units) {
      if (v < 1024) return `${v.toFixed(v < 10 ? 1 : 0)} ${u}`;
      v /= 1024;
    }
    return `${v.toFixed(1)} PB`;
  }

  function themeSwatches(m: ThemeMode): string[] {
    switch (m) {
      case "vellum":   return ["#EFEDE7", "#E5E2D9", "#45627A"];
      case "linen":    return ["#F6F1E6", "#EAE2CE", "#B38230"];
      case "ashrose":  return ["#F1DDE2", "#C6ABAF", "#5C2E38"];
      case "workshop": return ["#14202E", "#243449", "#C18F3E"];
      case "graphite": return ["#161819", "#1D1F20", "#C08BA8"];
      case "dracula":  return ["#282A36", "#44475A", "#BD93F9"];
      case "auto":     return ["#EFEDE7", "#14202E", "#45627A"];
      case "light":    return ["#EFEDE7", "#E5E2D9", "#45627A"];
      case "dark":     return ["#14202E", "#243449", "#C18F3E"];
    }
  }

  function scopeLabelKey(scope: SettingScope): StringKey {
    if (scope === "device") return "settings.scope.device";
    if (scope === "workspace") return "settings.scope.workspace";
    if (scope === "account") return "settings.scope.account";
    return "settings.scope.mixed";
  }
  function scopeTitleKey(scope: SettingScope): StringKey {
    if (scope === "device") return "settings.scope.device.title";
    if (scope === "workspace") return "settings.scope.workspace.title";
    if (scope === "account") return "settings.scope.account.title";
    return "settings.scope.mixed.title";
  }

  // ─────────── Writing pane state ───────────
  // svelte-ignore state_referenced_locally
  let writingLocal = $state(config?.preferences ?? null);
  let writingSaving = $state(false);
  $effect(() => {
    writingLocal = config?.preferences ?? null;
  });
  async function writingSave(next: NonNullable<typeof writingLocal>) {
    writingLocal = next;
    writingSaving = true;
    try {
      const cfg = await api.updatePreferences(next);
      onConfigChange(cfg);
    } finally {
      writingSaving = false;
    }
  }

  // Clear search-index row state
  let clearSearchState = $state<"idle" | "working" | "done" | "error">("idle");
  let clearSearchMsg = $state<string>("");
  async function onClearSearchIndex() {
    clearSearchState = "working";
    clearSearchMsg = "";
    try {
      await api.clearSearchIndex();
      clearSearchState = "done";
      clearSearchMsg = t("settings.writing.clearSearch.done");
      window.setTimeout(() => {
        clearSearchState = "idle";
        clearSearchMsg = "";
      }, 3000);
    } catch (e) {
      clearSearchState = "error";
      clearSearchMsg = String(e);
    }
  }

  // ─────────── Sync pane state ───────────
  // svelte-ignore state_referenced_locally
  let syncUrl = $state(config?.sync.remote_url ?? "");
  // svelte-ignore state_referenced_locally
  let syncRemoteType = $state(config?.sync.remote_type ?? "custom");
  // svelte-ignore state_referenced_locally
  let syncToken = $state(config?.sync.token ?? "");
  let syncSaving = $state(false);
  let syncMsgTop = $state<string | null>(null);

  $effect(() => {
    syncUrl = config?.sync.remote_url ?? "";
    syncRemoteType = config?.sync.remote_type ?? "custom";
    syncToken = config?.sync.token ?? "";
  });

  async function saveSyncRemote() {
    if (!config) return;
    syncSaving = true;
    syncMsgTop = null;
    try {
      const cfg = await api.setRemote(syncUrl.trim(), syncRemoteType, syncToken.trim() || undefined);
      onConfigChange(cfg);
      syncMsgTop = t("settings.sync.saved");
    } catch (e) {
      syncMsgTop = String(e);
    } finally {
      syncSaving = false;
    }
  }

  // ─────────── Trash retention ───────────
  // svelte-ignore state_referenced_locally
  let trashRetentionValue = $state<number>(config?.preferences?.trash_retention_days ?? 30);
  let trashRetentionSaving = $state(false);
  $effect(() => {
    trashRetentionValue = config?.preferences?.trash_retention_days ?? 30;
  });
  async function saveTrashRetention(next: number) {
    if (!config) return;
    trashRetentionValue = next;
    trashRetentionSaving = true;
    try {
      const cfg = await api.updatePreferences({
        ...config.preferences,
        trash_retention_days: next,
      });
      onConfigChange(cfg);
    } finally {
      trashRetentionSaving = false;
    }
  }

  // ─────────── Auto-sync ───────────
  // svelte-ignore state_referenced_locally
  let autoSyncValue = $state<number>(config?.preferences?.autosync_minutes ?? 0);
  let autoSyncSaving = $state(false);
  $effect(() => {
    autoSyncValue = config?.preferences?.autosync_minutes ?? 0;
  });
  async function saveAutoSync(next: number) {
    if (!config) return;
    autoSyncValue = next;
    autoSyncSaving = true;
    try {
      const cfg = await api.updatePreferences({ ...config.preferences, autosync_minutes: next });
      onConfigChange(cfg);
    } finally {
      autoSyncSaving = false;
    }
  }

  // ─────────── Yarrow server connect ───────────
  let serverEditing = $state(false);
  // server connect form state
  let serverMethod = $state<"password" | "token">("password");
  let serverFormUrl = $state("");
  let serverFormEmail = $state("");
  let serverFormPassword = $state("");
  let serverFormToken = $state("");
  // svelte-ignore state_referenced_locally
  let serverFormWorkspaceName = $state(config?.workspace.name ?? "");
  let serverFormSkipTls = $state(false);
  let serverFormBusy = $state<null | "test" | "connect">(null);
  let serverFormErr = $state<string | null>(null);
  let serverFormTestOk = $state(false);

  let serverFormUrlValid = $derived(/^https?:\/\//i.test(serverFormUrl.trim()));
  let serverFormCanConnect = $derived(
    serverFormUrlValid &&
      serverFormEmail.trim().length > 0 &&
      (serverMethod === "password"
        ? serverFormPassword.length > 0
        : serverFormToken.trim().length > 0) &&
      serverFormBusy === null,
  );

  function openServerForm() {
    serverEditing = true;
    serverMethod = "password";
    serverFormUrl = "";
    serverFormEmail = "";
    serverFormPassword = "";
    serverFormToken = "";
    serverFormWorkspaceName = config?.workspace.name ?? "";
    serverFormSkipTls = false;
    serverFormBusy = null;
    serverFormErr = null;
    serverFormTestOk = false;
  }

  async function serverConnectSubmit() {
    serverFormBusy = "connect";
    serverFormErr = null;
    try {
      const trimmedUrl = serverFormUrl.trim();
      const trimmedEmail = serverFormEmail.trim();
      const trimmedWorkspace = serverFormWorkspaceName.trim() || undefined;
      const cfg =
        serverMethod === "password"
          ? await api.serverConnectPassword(
              trimmedUrl,
              trimmedEmail,
              serverFormPassword,
              trimmedWorkspace,
              serverFormSkipTls,
            )
          : await api.serverConnectToken(
              trimmedUrl,
              trimmedEmail,
              serverFormToken.trim(),
              serverFormPassword.length > 0 ? serverFormPassword : undefined,
              trimmedWorkspace,
              serverFormSkipTls,
            );
      serverFormPassword = "";
      serverFormToken = "";
      onConfigChange(cfg);
      serverEditing = false;
    } catch (e) {
      serverFormErr = String(e);
    } finally {
      serverFormBusy = null;
    }
  }

  async function serverFormTest() {
    if (serverMethod !== "token") return;
    serverFormBusy = "test";
    serverFormErr = null;
    serverFormTestOk = false;
    try {
      await api.serverTestConnection(
        serverFormUrl.trim(),
        serverFormEmail.trim(),
        serverFormToken.trim(),
        serverFormSkipTls,
      );
      serverFormTestOk = true;
    } catch (e) {
      serverFormErr = String(e);
    } finally {
      serverFormBusy = null;
    }
  }

  // ─── Server connected state ───
  let serverConnectedBusy = $state<null | "disconnect" | "revoke" | "sync">(null);
  let serverConnectedErr = $state<string | null>(null);
  let serverSyncOk = $state<boolean | null>(null);
  let serverSyncMsg = $state<string | null>(null);
  let serverSyncConflicts = $state<ConflictResolution[]>([]);

  async function serverDisconnect(revoke: boolean) {
    serverConnectedBusy = revoke ? "revoke" : "disconnect";
    serverConnectedErr = null;
    try {
      const cfg = await api.serverDisconnect(revoke);
      onConfigChange(cfg);
    } catch (e) {
      serverConnectedErr = String(e);
      try { onConfigChange(await api.readConfig()); } catch { /* ignore */ }
    } finally {
      serverConnectedBusy = null;
    }
  }

  async function serverRunSync() {
    serverConnectedBusy = "sync";
    serverConnectedErr = null;
    serverSyncMsg = null;
    serverSyncOk = null;
    serverSyncConflicts = [];
    try {
      const r = await api.sync();
      serverSyncOk = r.ok;
      serverSyncMsg = r.ok
        ? t("settings.server.connected.syncedFmt", { message: r.message })
        : t("settings.server.connected.syncFailedFmt", { message: r.message });
      if (r.conflicts && r.conflicts.length > 0) {
        serverSyncConflicts = r.conflicts;
      }
      try { onConfigChange(await api.readConfig()); } catch { /* ignore */ }
      onSyncNow();
    } catch (e) {
      serverConnectedErr = String(e);
    } finally {
      serverConnectedBusy = null;
    }
  }

  // ─────────── Templates pane state ───────────
  let templatesItems = $state<TemplateInfo[] | null>(null);
  let templatesSelected = $state<string | null>(null);
  let templatesBody = $state<string>("");
  let templatesDirty = $state(false);
  let templatesMsg = $state<string | null>(null);
  let templatesNewOpen = $state(false);
  let templatesNewLabel = $state("");
  let templatesDeleteOpen = $state(false);

  async function templatesRefresh() {
    try {
      const list = await api.listTemplates();
      templatesItems = list;
      if (!templatesSelected && list.length > 0) templatesSelected = list[0].name;
    } catch (e) {
      templatesMsg = String(e);
    }
  }

  $effect(() => {
    if (open && tab === "templates") {
      templatesRefresh();
    }
  });

  $effect(() => {
    if (!templatesSelected) {
      templatesBody = "";
      templatesDirty = false;
      return;
    }
    let alive = true;
    api
      .readTemplate(templatesSelected)
      .then((raw) => {
        if (!alive) return;
        templatesBody = raw;
        templatesDirty = false;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  });

  async function templatesSave() {
    if (!templatesSelected) return;
    try {
      await api.writeTemplate(templatesSelected, templatesBody);
      templatesDirty = false;
      templatesMsg = t("settings.templates.saved");
      setTimeout(() => (templatesMsg = null), 1500);
    } catch (e) {
      templatesMsg = String(e);
    }
  }

  async function templatesConfirmNew() {
    const label = templatesNewLabel.trim();
    if (!label) return;
    const clean = label
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!clean) return;
    await api.writeTemplate(clean, `<!-- label: ${label} -->\n# {{title}}\n\n{{cursor}}\n`);
    templatesNewOpen = false;
    templatesNewLabel = "";
    await templatesRefresh();
    templatesSelected = clean;
  }

  async function templatesConfirmRemove() {
    if (!templatesSelected) return;
    await api.deleteTemplate(templatesSelected);
    templatesDeleteOpen = false;
    templatesSelected = null;
    await templatesRefresh();
  }

  let templatesSelectedLabel = $derived(
    templatesItems?.find((tpl) => tpl.name === templatesSelected)?.label ?? templatesSelected,
  );

  // ─────────── Security pane state ───────────
  let secStatus = $state<{ enabled: boolean; unlocked: boolean; idle_timeout_secs: number } | null>(null);
  let secRefreshNonce = $state(0);
  let secEnableOpen = $state(false);
  let secDisableOpen = $state(false);
  let secChangePwOpen = $state(false);
  let secRegenOpen = $state(false);
  let secRevealPhrase = $state<string | null>(null);

  $effect(() => {
    if (!open) return;
    void secRefreshNonce;
    let alive = true;
    const prevUnlocked = secStatus?.unlocked ?? null;
    api
      .encryptionStatus()
      .then((s) => {
        if (!alive) return;
        secStatus = s;
        // The backend lazily clears the master key when it sees an
        // expired session — encryptionStatus is one of the triggers,
        // so this fetch itself can flip the workspace to locked.
        // Broadcast on either an observed transition OR a first-fetch
        // that returns locked, since AppShell may still be holding
        // decrypted state from before idle expiry. The listener's own
        // transition guard prevents redundant active-note refetches
        // when AppShell already knew about the lock.
        if (!s.unlocked && prevUnlocked !== false) {
          window.dispatchEvent(new Event("yarrow:encryption-changed"));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  });

  $effect(() => {
    if (!open) return;
    const onChanged = () => (secRefreshNonce += 1);
    window.addEventListener("yarrow:encryption-changed", onChanged as EventListener);
    return () => window.removeEventListener("yarrow:encryption-changed", onChanged as EventListener);
  });

  function secBump() {
    secRefreshNonce += 1;
    window.dispatchEvent(new Event("yarrow:encryption-changed"));
  }

  async function secUpdateIdle(secs: number) {
    if (!config) return;
    const next = { ...config.preferences, encryption_idle_timeout_secs: secs };
    const cfg = await api.updatePreferences(next);
    onConfigChange(cfg);
    secBump();
  }

  // EnableEncryption modal state
  let enableEncStep = $state<"confirm" | "password">("confirm");
  let enableEncPw1 = $state("");
  let enableEncPw2 = $state("");
  let enableEncBusy = $state(false);
  let enableEncErr = $state<string | null>(null);
  $effect(() => {
    if (!secEnableOpen) return;
    enableEncStep = "confirm";
    enableEncPw1 = "";
    enableEncPw2 = "";
    enableEncBusy = false;
    enableEncErr = null;
  });
  async function enableEncSubmit() {
    if (enableEncPw1 !== enableEncPw2) {
      enableEncErr = t("settings.security.error.mismatch");
      return;
    }
    if (enableEncPw1.length < 8) {
      enableEncErr = t("settings.security.error.tooShort");
      return;
    }
    enableEncBusy = true;
    enableEncErr = null;
    try {
      const r = await api.enableEncryption(enableEncPw1);
      secEnableOpen = false;
      secRevealPhrase = r.recovery_phrase;
      secBump();
    } catch (e) {
      enableEncErr = String(e);
    } finally {
      enableEncBusy = false;
    }
  }

  // Disable encryption state
  let disableEncPw = $state("");
  let disableEncBusy = $state(false);
  let disableEncErr = $state<string | null>(null);
  $effect(() => {
    if (!secDisableOpen) return;
    disableEncPw = "";
    disableEncBusy = false;
    disableEncErr = null;
  });
  async function disableEncSubmit() {
    disableEncBusy = true;
    disableEncErr = null;
    try {
      await api.disableEncryption(disableEncPw);
      secDisableOpen = false;
      secBump();
    } catch (e) {
      disableEncErr = String(e);
    } finally {
      disableEncBusy = false;
    }
  }

  // Change password state
  let changePwOld = $state("");
  let changePwNew1 = $state("");
  let changePwNew2 = $state("");
  let changePwBusy = $state(false);
  let changePwErr = $state<string | null>(null);
  $effect(() => {
    if (!secChangePwOpen) return;
    changePwOld = "";
    changePwNew1 = "";
    changePwNew2 = "";
    changePwBusy = false;
    changePwErr = null;
  });
  async function changePwSubmit() {
    if (changePwNew1 !== changePwNew2) {
      changePwErr = t("settings.security.changePwModal.error.mismatch");
      return;
    }
    if (changePwNew1.length < 8) {
      changePwErr = t("settings.security.error.tooShort");
      return;
    }
    changePwBusy = true;
    changePwErr = null;
    try {
      await api.changeEncryptionPassword(changePwOld, changePwNew1);
      secChangePwOpen = false;
      secBump();
    } catch (e) {
      changePwErr = String(e);
    } finally {
      changePwBusy = false;
    }
  }

  // Regenerate recovery
  let regenPw = $state("");
  let regenBusy = $state(false);
  let regenErr = $state<string | null>(null);
  $effect(() => {
    if (!secRegenOpen) return;
    regenPw = "";
    regenBusy = false;
    regenErr = null;
  });
  async function regenSubmit() {
    regenBusy = true;
    regenErr = null;
    try {
      const r = await api.regenerateRecoveryPhrase(regenPw);
      secRegenOpen = false;
      secRevealPhrase = r.recovery_phrase;
      secBump();
    } catch (e) {
      regenErr = String(e);
    } finally {
      regenBusy = false;
    }
  }

  // Recovery phrase modal
  let recoveryConfirmed = $state(false);
  $effect(() => {
    void secRevealPhrase;
    recoveryConfirmed = false;
  });
  function closeRecoveryModal() {
    if (!recoveryConfirmed) return;
    secRevealPhrase = null;
    window.dispatchEvent(
      new CustomEvent<string>("yarrow:toast", {
        detail: t("settings.security.toast.afterPhrase"),
      }),
    );
  }

  // ─────────── Workspace pane state ───────────
  // svelte-ignore state_referenced_locally
  let workspaceName = $state(config?.workspace.name ?? "");
  let workspaceMainNotes = $state<NoteSummary[]>([]);
  let workspacePickerOpen = $state(false);
  $effect(() => {
    workspaceName = config?.workspace.name ?? "";
  });
  $effect(() => {
    if (!open) return;
    void config?.mapping.main_note;
    api
      .listNotes()
      .then((n) => (workspaceMainNotes = n))
      .catch(() => (workspaceMainNotes = []));
  });
  async function saveWorkspaceName() {
    if (!config) return;
    const next = workspaceName.trim();
    if (!next || next === config.workspace.name) return;
    const cfg = await api.updateWorkspaceName(next);
    onConfigChange(cfg);
  }

  let workspaceMappingMode = $derived(config?.mapping?.mode ?? "mapped");
  let workspaceMainNoteSlug = $derived(config?.mapping?.main_note ?? null);
  let workspaceMainNoteTitle = $derived(
    workspaceMainNoteSlug
      ? workspaceMainNotes.find((n) => n.slug === workspaceMainNoteSlug)?.title ?? workspaceMainNoteSlug
      : null,
  );

  // Folder path display
  let folderPathRevealed = $state(false);
  let folderPathTildified = $derived(tildify(workspacePath));
  let folderPathCanTildify = $derived(folderPathTildified !== workspacePath);

  // ─────────── Trim history ───────────
  type AgeDays = 30 | 60 | 90 | 180;
  const AGE_OPTIONS = [30, 60, 90, 180] as const;
  let trimPickerOpen = $state(false);
  let trimPickerMode = $state<"age" | "empty">("age");
  let trimPickerDays = $state<AgeDays>(180);
  let trimConfirm = $state<
    | null
    | { kind: "age"; days: AgeDays }
    | { kind: "empty" }
  >(null);
  let trimBusy = $state(false);
  let trimMsg = $state<string | null>(null);
  let trimConfirmDays = $derived(trimConfirm?.kind === "age" ? trimConfirm.days : 180);

  function keepLabelFor(d: AgeDays): string {
    if (d >= 180) return t("settings.trim.picker.keep180");
    if (d >= 90) return t("settings.trim.picker.keep90");
    if (d >= 60) return t("settings.trim.picker.keep60");
    return t("settings.trim.picker.keep30");
  }

  async function trimRun(target: { kind: "age"; days: AgeDays } | { kind: "empty" }) {
    trimBusy = true;
    trimMsg = null;
    let succeeded = false;
    try {
      const report =
        target.kind === "age"
          ? await api.pruneHistoryOlderThan(target.days)
          : await api.pruneEmptyCheckpoints();
      const label =
        target.kind === "age"
          ? t("settings.trim.label.older", { days: String(target.days) })
          : t("settings.trim.label.empty");
      if (report.removed === 0) {
        trimMsg = t("settings.trim.nothing", { label });
      } else {
        trimMsg = t(
          report.removed === 1
            ? "settings.trim.removed.singular"
            : "settings.trim.removed.plural",
          { count: String(report.removed), label, kept: String(report.kept) },
        );
      }
      succeeded = true;
    } catch (e) {
      trimMsg = t("settings.trim.failed", { error: String(e) });
    } finally {
      trimBusy = false;
      trimConfirm = null;
    }
    if (succeeded) {
      window.setTimeout(() => (trimMsg = null), 6000);
    }
  }

  // ─────────── Clear all cache ───────────
  let clearCacheConfirm = $state(false);
  let clearCacheBusy = $state(false);
  let clearCacheMsg = $state<string | null>(null);
  async function clearCacheRun() {
    clearCacheBusy = true;
    clearCacheMsg = null;
    try {
      await api.clearAllCache();
      clearCacheMsg = t("settings.clearCache.done");
      clearCacheConfirm = false;
      window.setTimeout(() => (clearCacheMsg = null), 4000);
    } catch (e) {
      clearCacheMsg = t("settings.clearCache.failed", { error: String(e) });
    } finally {
      clearCacheBusy = false;
    }
  }

  // ─────────── Export pane state ───────────
  let exportOpen = $state(false);
  let exportDest = $state<string | null>(null);
  let exportBusy = $state(false);
  let exportMsg = $state<string | null>(null);
  let exportError = $state(false);

  async function pickExportDest() {
    const picked = await openDialog({
      directory: true,
      multiple: false,
      title: t("settings.export.dialogTitle"),
    });
    if (typeof picked === "string") exportDest = picked;
  }

  async function runExport() {
    if (!exportDest) return;
    exportMsg = null;
    exportError = false;
    exportBusy = true;
    try {
      const report = await api.exportStatic(exportDest);
      const attachBit = report.attachments_exported > 0
        ? t("settings.export.attachBit", {
            count: String(report.attachments_exported),
            word: report.attachments_exported === 1
              ? t("settings.export.report.attachment")
              : t("settings.export.report.attachments"),
          })
        : "";
      const skipBit = (report.encrypted_skipped ?? 0) > 0
        ? ` · ${t("settings.export.report.skipped", { count: String(report.encrypted_skipped) })}`
        : "";
      const noteWord = report.notes_exported === 1
        ? t("settings.export.report.note")
        : t("settings.export.report.notes");
      exportMsg = t("settings.export.report.summary", {
        notes: String(report.notes_exported),
        noteWord,
        attachBit,
        skipBit,
        dest: report.dest,
      });
    } catch (e) {
      exportError = true;
      exportMsg = t("settings.export.failed", { error: String(e) });
    } finally {
      exportBusy = false;
    }
  }

  function closeExport() {
    if (exportBusy) return;
    exportOpen = false;
    window.setTimeout(() => {
      exportMsg = null;
      exportError = false;
      exportDest = null;
    }, 200);
  }

  // ─────────── Storage pane state ───────────
  let storageBlobs = $state<LargeBlobEntry[] | null>(null);
  let storageLoadErr = $state<string | null>(null);
  let storageSelected = $state<Set<string>>(new Set());
  let storageExpanded = $state<Set<string>>(new Set());
  let storageConfirmOpen = $state(false);
  let storageConfirmText = $state("");
  let storageRunning = $state(false);
  let storageResult = $state<ReclaimSpaceOutcome | null>(null);
  let storageRunErr = $state<string | null>(null);

  interface BlobGroup {
    path: string;
    displayPath: string;
    totalBytes: number;
    versions: LargeBlobEntry[];
    dangling: boolean;
  }

  async function refreshStorage() {
    storageLoadErr = null;
    try {
      const list = await api.listLargeBlobs();
      storageBlobs = list;
    } catch (e) {
      storageLoadErr = String(e);
      storageBlobs = [];
    }
  }

  $effect(() => {
    if (open && tab === "storage") {
      refreshStorage();
    }
  });

  let storageGroups = $derived.by<BlobGroup[]>(() => {
    if (!storageBlobs) return [];
    const byKey = new Map<string, BlobGroup>();
    for (const b of storageBlobs) {
      const hasPath = Boolean(b.path);
      const key = hasPath ? b.path : `<dangling:${b.oid}>`;
      const existing = byKey.get(key);
      if (existing) {
        existing.versions.push(b);
        existing.totalBytes += b.size;
      } else {
        byKey.set(key, {
          path: b.path,
          displayPath: hasPath ? b.path : t("settings.storage.dangling.path"),
          totalBytes: b.size,
          versions: [b],
          dangling: !hasPath,
        });
      }
    }
    return Array.from(byKey.values()).sort((a, b) => b.totalBytes - a.totalBytes);
  });

  function storageToggle(path: string) {
    const next = new Set(storageSelected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    storageSelected = next;
  }
  function storageToggleExpand(key: string) {
    const next = new Set(storageExpanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    storageExpanded = next;
  }

  let storageTotalSelectedBytes = $derived(
    storageGroups.filter((g) => storageSelected.has(g.path)).reduce((acc, g) => acc + g.totalBytes, 0),
  );

  function storageOpenConfirm() {
    if (storageSelected.size === 0) return;
    storageConfirmText = "";
    storageRunErr = null;
    storageResult = null;
    storageConfirmOpen = true;
  }

  async function storageRunReclaim() {
    if (storageConfirmText.trim().toLowerCase() !== "delete") return;
    storageRunning = true;
    storageRunErr = null;
    try {
      const paths = Array.from(storageSelected);
      const out = await api.reclaimSpace(paths, null);
      storageResult = out;
      storageSelected = new Set();
      await refreshStorage();
    } catch (e) {
      storageRunErr = String(e);
    } finally {
      storageRunning = false;
    }
  }

  // Align with server panel
  let alignStatus = $state<"idle" | "running" | "ok" | "error">("idle");
  let alignErr = $state<string | null>(null);
  let alignSummary = $state<string | null>(null);
  async function runAlignWithServer() {
    alignStatus = "running";
    alignErr = null;
    alignSummary = null;
    try {
      const out = await api.forceAlignWithServer(true);
      const n = out.commits_ahead;
      alignSummary =
        n === 0
          ? t("settings.align.alreadyInSync")
          : t(
              n === 1
                ? "settings.align.dropped.singular"
                : "settings.align.dropped.plural",
              { count: String(n) },
            );
      alignStatus = "ok";
      await refreshStorage();
    } catch (e) {
      alignErr = String(e);
      alignStatus = "error";
    }
  }

  // ─────────── Gestures pane state ───────────
  let gestureTapStore = gestureStore("tap");
  let gestureLongPressStore = gestureStore("longPress");
  let gestureDoubleTapStore = gestureStore("doubleTap");
  let gestureConfirmReset = $state(false);

  let groupedActions = $derived.by(() => {
    const groups: Record<string, typeof BINDABLE_ACTIONS> = {
      core: [],
      navigation: [],
      writing: [],
      system: [],
    };
    BINDABLE_ACTIONS.forEach((a) => groups[a.group].push(a));
    return groups;
  });

  let gesturesAtDefaults = $derived(
    gestureTapStore.value === getDefaultBinding("tap") &&
      gestureLongPressStore.value === getDefaultBinding("longPress") &&
      gestureDoubleTapStore.value === getDefaultBinding("doubleTap"),
  );

  function blurbForBinding(id: CenterActionId): string {
    const a = BINDABLE_ACTIONS.find((x) => x.id === id);
    return a ? t(a.i18nBlurb) : "";
  }

  // ─────────── Reset settings buttons ───────────
  let resetAllConfirmOpen = $state(false);
  let resetA11yConfirmOpen = $state(false);
  let a11yJustReset = $state(false);

  function resetA11yConfirm() {
    resetAccessibilityPrefs();
    resetA11yConfirmOpen = false;
    a11yJustReset = true;
    window.setTimeout(() => (a11yJustReset = false), 2400);
  }

  function resetAllConfirm() {
    const KEEP_FOR_ALL = (k: string) =>
      k === "yarrow.lastActiveWorkspace" ||
      k.startsWith("yarrow.lastSyncedAt") ||
      k === "yarrow.recentWorkspaces";
    try {
      const drop: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith("yarrow.")) continue;
        if (!KEEP_FOR_ALL(k)) drop.push(k);
      }
      drop.forEach((k) => localStorage.removeItem(k));
    } catch {}
    resetAllConfirmOpen = false;
    setTimeout(() => window.location.reload(), 200);
  }

  // ─────────── Settings export/import ───────────
  let prefsExportImportBusy = $state<"none" | "exporting" | "importing">("none");
  let prefsExportImportMsg = $state<string | null>(null);

  function collectPrefs(): Record<string, string> {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith("yarrow.")) continue;
      const v = localStorage.getItem(k);
      if (v == null) continue;
      out[k] = v;
    }
    return out;
  }

  async function onPrefsExport() {
    prefsExportImportBusy = "exporting";
    prefsExportImportMsg = null;
    try {
      const payload = {
        kind: "yarrow.settings.snapshot",
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        prefs: collectPrefs(),
      };
      const text = JSON.stringify(payload, null, 2);
      const dest = await saveDialog({
        title: t("settings.about.exportImport.savePromptTitle"),
        defaultPath: `yarrow-settings-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!dest) {
        prefsExportImportBusy = "none";
        return;
      }
      await api.writeTextFile(dest, text);
      prefsExportImportMsg = t("settings.about.exportImport.exportDone", {
        count: String(Object.keys(payload.prefs).length),
      });
    } catch (e) {
      prefsExportImportMsg = t("settings.about.exportImport.exportFailed", {
        error: String(e),
      });
    } finally {
      prefsExportImportBusy = "none";
    }
  }

  function onPrefsImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      prefsExportImportBusy = "importing";
      prefsExportImportMsg = null;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data?.kind !== "yarrow.settings.snapshot" || !data.prefs) {
          throw new Error(t("settings.about.exportImport.notASnapshot"));
        }
        const entries = Object.entries(data.prefs as Record<string, string>);
        for (const [k, v] of entries) {
          if (typeof v !== "string") continue;
          if (!k.startsWith("yarrow.")) continue;
          localStorage.setItem(k, v);
        }
        prefsExportImportMsg = t("settings.about.exportImport.importDone", {
          count: String(entries.length),
        });
        setTimeout(() => window.location.reload(), 700);
      } catch (e) {
        prefsExportImportMsg = t("settings.about.exportImport.importFailed", {
          error: String(e),
        });
      } finally {
        prefsExportImportBusy = "none";
      }
    };
    input.click();
  }

  // ─────────── Help pane diagnostics ───────────
  let helpPlatform = (() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/Mac/.test(ua)) return "macOS";
    if (/Windows/.test(ua)) return "Windows";
    if (/Linux/.test(ua)) return "Linux";
    return "Unknown";
  })();
  let helpDiagnostics = `Yarrow ${APP_VERSION} · ${helpPlatform}`;
  function helpSendFeedback() {
    const subject = encodeURIComponent(t("settings.help.feedback.subject"));
    const body = encodeURIComponent(
      t("settings.help.feedback.bodyTemplate", { diagnostics: helpDiagnostics }),
    );
    openUrl(`mailto:hello@yarrow.software?subject=${subject}&body=${body}`).catch(() => {});
  }
  function helpCopyDiagnostics() {
    void navigator.clipboard?.writeText(helpDiagnostics).catch(() => {});
  }
</script>

{#snippet scopeGlyph(scope: SettingScope)}
  {#if scope === "device"}
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="10" height="6.5" rx="1" />
      <line x1="1" y1="11" x2="13" y2="11" />
    </svg>
  {:else if scope === "workspace"}
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2 4.5 v6.5 a1 1 0 0 0 1 1 h8 a1 1 0 0 0 1 -1 V5 a1 1 0 0 0 -1 -1 H7 L5.5 2.5 H3 a1 1 0 0 0 -1 1 z" />
    </svg>
  {:else if scope === "account"}
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3.5 9.5 a2.5 2.5 0 0 1 0 -5 a3 3 0 0 1 5.5 -1.5 a2.5 2.5 0 0 1 1.5 6.5 z" />
    </svg>
  {:else}
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="1.5" y="3" width="7" height="5" rx="1" />
      <path d="M5.5 9 v3 a1 1 0 0 0 1 1 h6 a1 1 0 0 0 1 -1 V8 a1 1 0 0 0 -1 -1 H8.5" />
    </svg>
  {/if}
{/snippet}

{#snippet scopeChip(scope: SettingScope)}
  <span
    title={t(scopeTitleKey(scope))}
    class="inline-flex items-center gap-1 text-2xs uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full bg-s2 text-t3 border border-bd"
  >
    {@render scopeGlyph(scope)}
    {t(scopeLabelKey(scope))}
  </span>
{/snippet}

{#snippet section(title: string, hint: string | undefined, scope: SettingScope | undefined, body: Snippet)}
  <div class="mb-6">
    <div class="flex items-center gap-2 mb-0.5 flex-wrap">
      <div class="text-base text-char font-medium">{title}</div>
      {#if scope}{@render scopeChip(scope)}{/if}
    </div>
    {#if hint}
      <div class="text-xs text-t2 mb-3 leading-relaxed">{hint}</div>
    {/if}
    <div class="border border-bd rounded-lg bg-bg-soft/40 px-5 py-1.5 divide-y divide-bd/40">{@render body()}</div>
  </div>
{/snippet}

{#snippet tabIcon(tabKey: Tab)}
  {#if tabKey === "mode"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="4" height="4" rx="0.7" />
      <rect x="8" y="2" width="4" height="4" rx="0.7" />
      <rect x="2" y="8" width="4" height="4" rx="0.7" />
      <rect x="8" y="8" width="4" height="4" rx="0.7" />
    </svg>
  {:else if tabKey === "appearance"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 1.5a5.5 5.5 0 0 0 0 11c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1A1.5 1.5 0 0 1 9.5 7.5h1A2 2 0 0 0 12.5 5.5 5.5 5.5 0 0 0 7 1.5z" />
      <circle cx="4.5" cy="6" r="0.6" fill="currentColor" />
      <circle cx="6.5" cy="3.5" r="0.6" fill="currentColor" />
      <circle cx="9.5" cy="4" r="0.6" fill="currentColor" />
    </svg>
  {:else if tabKey === "accessibility"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="7" cy="3" r="1.5" />
      <path d="M3 6h8M5.5 6v3l-1 3M8.5 6v3l1 3" />
    </svg>
  {:else if tabKey === "writing"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.8 1.8l2.4 2.4L4.5 12 1.5 12.5 2 9.5l7.8-7.7z" />
      <path d="M8.5 3l2.4 2.4" />
    </svg>
  {:else if tabKey === "gestures"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 8V3.5a1 1 0 1 1 2 0V8M7 8V2.5a1 1 0 1 1 2 0V8M9 8V3.5a1 1 0 1 1 2 0V9c0 2-1.5 3.5-3.5 3.5S4 11 4 9V6.5a1 1 0 1 1 2 0V8" />
    </svg>
  {:else if tabKey === "guidance"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M9 5l-1 3-3 1 1-3z" />
    </svg>
  {:else if tabKey === "sync"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 7a4.5 4.5 0 0 1 8-2.8M11.5 7a4.5 4.5 0 0 1-8 2.8" />
      <path d="M10.5 2v2.5h-2.5M3.5 12V9.5h2.5" />
    </svg>
  {:else if tabKey === "storage"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="7" cy="3.5" rx="4.5" ry="1.5" />
      <path d="M2.5 3.5v7C2.5 11.3 4.5 12 7 12s4.5-.7 4.5-1.5v-7M2.5 7C2.5 7.83 4.5 8.5 7 8.5s4.5-.67 4.5-1.5" />
    </svg>
  {:else if tabKey === "templates"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 1.5h5l3 3v8a.5.5 0 0 1-.5.5h-7.5a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z" />
      <path d="M8 1.5v3h3M4.5 7h5M4.5 9.5h5" />
    </svg>
  {:else if tabKey === "security"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="6" width="8" height="6.5" rx="1" />
      <path d="M5 6V4.5a2 2 0 1 1 4 0V6" />
    </svg>
  {:else if tabKey === "workspace"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 4a1 1 0 0 1 1-1h3l1.5 1.5h3.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V4z" />
    </svg>
  {:else if tabKey === "shortcuts"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1.5" y="3.5" width="11" height="7" rx="1" />
      <path d="M4 6h0M6 6h0M8 6h0M10 6h0M4.5 8.5h5" />
    </svg>
  {:else if tabKey === "help"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M5.5 5.5a1.5 1.5 0 1 1 1.7 1.5c-.5.1-.7.4-.7.9V8.5" />
      <path d="M7 10.5h0" />
    </svg>
  {:else if tabKey === "about"}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 6.5v3.5M7 4.5v0" />
    </svg>
  {/if}
{/snippet}

{#snippet row(label: string, hint: string | undefined, scope: SettingScope | undefined, hintExtra: Snippet | undefined, control: Snippet)}
  <div class="flex items-start gap-8 py-2.5">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="text-[13px] text-char">{label}</div>
        {#if scope}{@render scopeChip(scope)}{/if}
      </div>
      {#if hint}
        <div class="text-2xs text-t2 mt-0.5 leading-snug">{hint}</div>
      {/if}
      {#if hintExtra}{@render hintExtra()}{/if}
    </div>
    <div class="shrink-0 self-center">{@render control()}</div>
  </div>
{/snippet}

{#snippet toggleControl(value: boolean, onChange: (v: boolean) => void)}
  <button
    type="button"
    onclick={() => onChange(!value)}
    class={`w-10 h-5 rounded-full relative transition ${value ? "bg-yel" : "bg-s3"}`}
    aria-pressed={value}
    aria-label={value ? "On" : "Off"}
  >
    <span
      class={`absolute top-0.5 w-4 h-4 rounded-full bg-bg shadow-xs transition ${value ? "left-[22px]" : "left-0.5"}`}
    ></span>
  </button>
{/snippet}

{#snippet themeIcon(m: ThemeMode)}
  {#if m === "auto"}
    <AutoThemeIcon size={13} />
  {:else if m === "light" || m === "vellum" || m === "linen"}
    <SunIcon size={13} />
  {:else if m === "dark" || m === "workshop" || m === "graphite"}
    <MoonIcon size={13} />
  {:else if m === "ashrose"}
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 4.2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" />
      <path d="M8 8.2c-1 .8-2 .8-2.5 0" />
      <path d="M8 8.2c1 .8 2 .8 2.5 0" />
      <path d="M8 4.2c-.6-.7-.6-1.7 0-2.4" />
      <path d="M8 4.2c.6-.7.6-1.7 0-2.4" />
      <path d="M8 13.5c-3-1.4-5-4-5-7" />
    </svg>
  {:else if m === "dracula"}
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2 6 L4 8 L6 6 L8 8 L10 6 L12 8 L14 6 L13 11 L9 10 L8 12 L7 10 L3 11 Z" />
      <path d="M7.4 8.6 L8 9.2 L8.6 8.6" />
    </svg>
  {/if}
{/snippet}

{#snippet themePreview(m: ThemeMode)}
  <div class="flex -space-x-1">
    {#each themeSwatches(m) as c, i (i)}
      <span class="w-3.5 h-3.5 rounded-full border border-bd" style:background={c}></span>
    {/each}
  </div>
{/snippet}

{#snippet modeIcon(id: ModeId)}
  {#if id === "basic"}
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="2" width="8" height="10" rx="1" />
      <line x1="5" y1="5" x2="9" y2="5" />
      <line x1="5" y1="7.5" x2="9" y2="7.5" />
      <line x1="5" y1="10" x2="8" y2="10" />
    </svg>
  {:else if id === "path"}
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="3" cy="3" r="1.4" />
      <circle cx="3" cy="11" r="1.4" />
      <circle cx="10.5" cy="7" r="1.4" />
      <path d="M3 4.4v5.2" />
      <path d="M3 7c2.5 0 4.5 0 6.2 0" />
    </svg>
  {:else if id === "writer"}
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="6" width="10" height="5" rx="1" />
      <path d="M3.5 6V3.5h7V6" />
      <line x1="4" y1="8.5" x2="10" y2="8.5" />
    </svg>
  {:else if id === "researcher"}
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3.5h2.5v3.5a2 2 0 0 1-2 2" />
      <path d="M8.5 3.5H11v3.5a2 2 0 0 1-2 2" />
    </svg>
  {:else if id === "developer"}
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1.5" y="3" width="11" height="8" rx="1" />
      <path d="M4 6l2 1.5L4 9" />
      <line x1="7.5" y1="9" x2="10" y2="9" />
    </svg>
  {:else if id === "clinician"}
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 1.5 L12 3v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V3z" />
    </svg>
  {:else if id === "cooking"}
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 1.5 q-0.6 0.8 0 1.6" />
      <path d="M7 1.2 q-0.6 0.9 0 1.9" />
      <path d="M9 1.5 q-0.6 0.8 0 1.6" />
      <path d="M3 5 h8" />
      <path d="M3.5 5 v3.5 a1.6 1.6 0 0 0 1.6 1.6 h3.8 a1.6 1.6 0 0 0 1.6 -1.6 V5" />
      <path d="M2 6 h1.5" />
      <path d="M10.5 6 H12" />
    </svg>
  {/if}
{/snippet}

{#snippet nonePersonaIcon()}
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
    <line x1="3.5" y1="7" x2="10.5" y2="7" />
  </svg>
{/snippet}

{#snippet modePane()}
  {#snippet body()}
    <div>
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.mode.modeSection")}
      </div>
      <div class="space-y-2">
        {#each ["basic", "path"] as const as id (id)}
          {@const selected = id === "basic" ? isBasic : isPathBased}
          <button
            type="button"
            onclick={() => onPickModeRoot(id)}
            class={`w-full text-left grid grid-cols-[36px_1fr] gap-3 items-start p-3 rounded-lg border transition ${
              selected
                ? "border-yel ring-1 ring-yel bg-yelp/30"
                : "border-bd bg-s1 hover:border-bd2"
            }`}
          >
            <div class={`w-9 h-9 rounded-lg flex items-center justify-center ${modeSwatchClass(id)}`}>
              {@render modeIcon(id)}
            </div>
            <div class="min-w-0">
              <div class="font-serif text-base text-char leading-tight">
                {modeLabelFor(id)}
              </div>
              <div class="text-2xs text-t2 leading-snug mt-0.5">
                {modeDescFor(id)}
              </div>
              <ul class="mt-2 space-y-0.5">
                {#each modeBulletsFor(id) as b, i (i)}
                  <li class="text-2xs text-t2 leading-snug pl-3 relative">
                    <span class="absolute left-0 top-[0.55em] w-1 h-1 rounded-full bg-t3"></span>
                    {b}
                  </li>
                {/each}
              </ul>
            </div>
          </button>
        {/each}
      </div>
    </div>

    {#if isPathBased}
      <div class="mt-6 pt-5 border-t border-bd">
        <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-1">
          {t("settings.mode.personaSection")}
        </div>
        <div class="text-2xs text-t2 mb-3 leading-snug">
          {t("settings.mode.personaIntro")}
        </div>
        <div class="space-y-2">
          {#each PERSONA_IDS as p (p ?? "none")}
            {@const modeId = personaToModeId(p)}
            {@const selected = currentPersona === p}
            {@const isNone = p === null}
            {@const label = isNone ? t("settings.mode.personaNone") : modeLabelFor(modeId)}
            {@const desc = isNone ? t("settings.mode.personaNoneDesc") : modeDescFor(modeId)}
            <button
              type="button"
              onclick={() => modeStore.set(modeId)}
              class={`w-full text-left grid grid-cols-[36px_1fr] gap-3 items-start p-3 rounded-lg border transition ${
                selected
                  ? "border-yel ring-1 ring-yel bg-yelp/30"
                  : "border-bd bg-s1 hover:border-bd2"
              }`}
            >
              <div
                class={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isNone ? "bg-bg border border-bd2 text-t3" : modeSwatchClass(modeId)
                }`}
              >
                {#if isNone}
                  {@render nonePersonaIcon()}
                {:else}
                  {@render modeIcon(modeId)}
                {/if}
              </div>
              <div class="min-w-0">
                <div class="font-serif text-base text-char leading-tight">{label}</div>
                <div class="text-2xs text-t2 leading-snug mt-0.5">{desc}</div>
                {#if !isNone}
                  <ul class="mt-2 space-y-0.5">
                    {#each modeBulletsFor(modeId) as b, i (i)}
                      <li class="text-2xs text-t2 leading-snug pl-3 relative">
                        <span class="absolute left-0 top-[0.55em] w-1 h-1 rounded-full bg-t3"></span>
                        {b}
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="text-2xs text-t3 mt-4 leading-snug">
      {t("settings.mode.footerNote")}
    </div>
  {/snippet}
  {@render section(t("settings.mode.title"), t("settings.mode.hint"), "device", body)}
{/snippet}

{#snippet themeCard(
  id: ThemeMode,
  selected: boolean,
  onSelect: () => void,
  nameKey: StringKey,
  descKey: StringKey,
)}
  <button
    type="button"
    onclick={onSelect}
    aria-pressed={selected}
    class={`flex flex-col items-start gap-2 px-3 py-2.5 rounded-md border text-left transition ${
      selected
        ? "border-yel bg-yelp text-yeld"
        : "border-bd bg-bg text-t2 hover:text-char hover:border-bd2"
    }`}
  >
    <div class="flex items-center gap-2 w-full">
      {@render themePreview(id)}
      <span class={`inline-flex items-center gap-1.5 text-xs font-medium ${selected ? "text-yeld" : "text-char"}`}>
        {@render themeIcon(id)}
        <span>{t(nameKey)}</span>
      </span>
    </div>
    <!-- Description text uses --yeld when selected (the design-token-
         intended pair for text on `bg-yelp`); on Workshop that's the
         paper-warm cream and on Vellum it's the deep slate, both of
         which clear AA on the selection background. text-t3 only
         applies to the unselected state where the card sits on bg-bg. -->
    <span class={`text-2xs leading-snug ${selected ? "text-yeld/85" : "text-t3"}`}>{t(descKey)}</span>
  </button>
{/snippet}

{#snippet appearancePane()}
  {#snippet body()}
    <div>
      <div class="text-sm text-char mb-1">{t("settings.appearance.theme")}</div>
      <div class="text-2xs text-t2 mb-3">{t("settings.appearance.themeHint")}</div>

      <div class="text-2xs text-t3 font-mono uppercase tracking-wider mb-2">
        {t("settings.appearance.modeLabel")}
      </div>
      <div class="grid grid-cols-3 gap-2 mb-5">
        <button
          type="button"
          onclick={() => theme.set("auto")}
          aria-pressed={theme.mode === "auto"}
          class={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-xs transition ${
            theme.mode === "auto"
              ? "border-yel bg-yelp text-char"
              : "border-bd bg-bg text-t2 hover:text-char hover:border-bd2"
          }`}
        >
          <AutoThemeIcon size={13} />
          <span>{t("settings.appearance.modeAuto")}</span>
        </button>
        <button
          type="button"
          onclick={() => theme.set("light")}
          aria-pressed={theme.mode === "light"}
          class={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-xs transition ${
            theme.mode === "light"
              ? "border-yel bg-yelp text-char"
              : "border-bd bg-bg text-t2 hover:text-char hover:border-bd2"
          }`}
        >
          <SunIcon size={13} />
          <span>{t("settings.appearance.modeLight")}</span>
        </button>
        <button
          type="button"
          onclick={() => theme.set("dark")}
          aria-pressed={theme.mode === "dark"}
          class={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-xs transition ${
            theme.mode === "dark"
              ? "border-yel bg-yelp text-char"
              : "border-bd bg-bg text-t2 hover:text-char hover:border-bd2"
          }`}
        >
          <MoonIcon size={13} />
          <span>{t("settings.appearance.modeDark")}</span>
        </button>
      </div>

      <div class="text-2xs text-t3 font-mono uppercase tracking-wider mb-2">
        {theme.mode === "auto"
          ? t("settings.appearance.lightLabelAuto")
          : t("settings.appearance.lightLabel")}
      </div>
      <div class="grid grid-cols-3 gap-2 mb-5">
        {#each LIGHT_THEMES as id (id)}
          {@render themeCard(
            id,
            theme.config.lightTheme === id,
            () => theme.setLightTheme(id),
            `settings.appearance.theme.${id}.name` as StringKey,
            `settings.appearance.theme.${id}.desc` as StringKey,
          )}
        {/each}
      </div>

      <div class="text-2xs text-t3 font-mono uppercase tracking-wider mb-2">
        {theme.mode === "auto"
          ? t("settings.appearance.darkLabelAuto")
          : t("settings.appearance.darkLabel")}
      </div>
      <div class="grid grid-cols-3 gap-2">
        {#each DARK_THEMES as id (id)}
          {@render themeCard(
            id,
            theme.config.darkTheme === id,
            () => theme.setDarkTheme(id),
            `settings.appearance.theme.${id}.name` as StringKey,
            `settings.appearance.theme.${id}.desc` as StringKey,
          )}
        {/each}
      </div>
    </div>

    {@render languageRow()}
    {@render personalityRow()}
    {@render paperAndWarmthRow()}
    {@render uiScaleRow()}
    {@render uiFontPicker()}
    {#if IS_MAC}
      {@render macBottomEdgeRow()}
    {/if}
  {/snippet}
  {@render section(t("settings.appearance.title"), t("settings.appearance.hint"), "device", body)}
{/snippet}

{#snippet languageRow()}
  <div class="pt-4 mt-2 border-t border-bd">
    <div class="flex items-baseline justify-between mb-1">
      <div class="text-sm text-char">{t("settings.appearance.language")}</div>
      <div class="text-2xs text-t3 font-mono">ui · interface</div>
    </div>
    <div class="text-2xs text-t3 mb-3 leading-relaxed">
      {t("settings.appearance.languageHint")}
    </div>
    <select
      value={language.lang}
      onchange={(e) => language.set((e.currentTarget as HTMLSelectElement).value as LanguageCode)}
      class="text-char"
    >
      {#each LANGUAGE_ORDER as l (l.id)}
        <option value={l.id}>{l.label}{l.note ? ` — ${l.note}` : ""}</option>
      {/each}
    </select>
  </div>
{/snippet}

{#snippet personalityRow()}
  {@const tiles = PERSONALITIES.filter((p) => p.id !== "custom" || personality.id === "custom")}
  <div class="pt-4 mt-2 border-t border-bd">
    <div class="flex items-baseline justify-between mb-1">
      <div class="text-sm text-char">Font personality</div>
      <div class="text-2xs text-t3 font-mono">a voice for the whole workspace</div>
    </div>
    <div class="text-2xs text-t3 mb-3 leading-relaxed">
      Each personality picks an interface font and an editor font that read
      well together. Density (Compact / Cozy / Roomy) stays where you put it
      below. Hand-tuning either font drops you into Custom.
    </div>
    <div class="grid grid-cols-2 gap-2">
      {#each tiles as p (p.id)}
        {@const active = p.id === personality.id}
        <button
          type="button"
          onclick={() => personality.set(p.id as PersonalityId)}
          class={`tile-press w-full text-left rounded-md border px-2.5 py-1.5 transition ${
            active ? "border-yel bg-yelp" : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
          }`}
        >
          <div class="text-[12.5px] text-char leading-tight">{p.label}</div>
          <div class="text-[10.5px] text-t2 mt-0.5 leading-tight">{p.description}</div>
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet paperAndWarmthRow()}
  <div class="pt-4 mt-2 border-t border-bd">
    <div class="flex items-baseline justify-between mb-1">
      <div class="text-sm text-char">Paper warmth</div>
      <div class="text-2xs text-t3 font-mono">hue</div>
    </div>
    <div class="text-2xs text-t3 mb-3 leading-relaxed">
      A slider that gently warms or cools the page. The editor's prose
      contrast is unaffected — only the surrounding paper shifts.
    </div>
    <div class="flex items-baseline justify-between mb-1">
      <div class="text-xs text-char">Warmth</div>
      <div class="text-2xs text-t3 font-mono">
        {paperWarmth.value === 0 ? "neutral" : (paperWarmth.value > 0 ? `+${paperWarmth.value} K` : `${paperWarmth.value} K`)}
      </div>
    </div>
    <input
      type="range"
      min={-300}
      max={300}
      step={20}
      value={paperWarmth.value}
      oninput={(e) => paperWarmth.set(parseInt((e.currentTarget as HTMLInputElement).value, 10))}
      class="w-full accent-yel"
    />
    <div class="flex items-center justify-between text-2xs text-t3 mt-1">
      <span>cool (6500 K)</span>
      <button
        type="button"
        onclick={() => paperWarmth.set(0)}
        class="text-t3 hover:text-char underline-offset-2 hover:underline"
      >
        reset
      </button>
      <span>warm (3200 K)</span>
    </div>
  </div>
{/snippet}

{#snippet uiScaleRow()}
  <div class="pt-4 mt-2 border-t border-bd">
    <div class="flex items-baseline justify-between mb-1">
      <div class="text-sm text-char">Interface size</div>
      <div class="text-2xs text-t3 font-mono">editor ignores this</div>
    </div>
    <div class="text-2xs text-t3 mb-3 leading-relaxed">
      Scales the sidebars, toolbar, and chrome. Your editor font size stays
      wherever you set it under Writing.
    </div>
    <div class="grid grid-cols-3 gap-2">
      {#each UI_SCALES as s (s.id)}
        {@const active = s.id === uiScale.id}
        <button
          type="button"
          onclick={() => uiScale.set(s.id as UiScaleId)}
          class={`tile-press rounded-md border px-3 py-2 text-left transition ${
            active ? "border-yel bg-yelp" : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
          }`}
        >
          <div class="flex items-end gap-1.5">
            <span class="text-sm text-char leading-none">Aa</span>
            <span class="text-char leading-none" style:font-size="{s.zoom * 16}px">Aa</span>
          </div>
          <div class="text-xs text-char mt-2 leading-tight">{s.label}</div>
          <div class="text-2xs text-t3 leading-tight">{s.sublabel}</div>
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet uiFontPicker()}
  <div class="pt-4 mt-2 border-t border-bd">
    <div class="flex items-baseline justify-between mb-1">
      <div class="text-sm text-char">Interface font</div>
      <div class="text-2xs text-t3 font-mono">Applies to all chrome, not the editor</div>
    </div>
    <div class="text-2xs text-t3 mb-3 leading-relaxed">
      The default is a clean sans. Pick a serif to make the whole app feel
      more editorial — the editor keeps its own font (set under Writing).
    </div>
    <div class="grid grid-cols-2 gap-2">
      {#each UI_FONTS as f (f.id)}
        {@const active = f.id === uiFont.id}
        <button
          type="button"
          onclick={() => uiFont.set(f.id as UiFontId)}
          class={`tile-press w-full text-left rounded-lg border p-2.5 ${
            active ? "border-yel bg-yelp" : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
          }`}
        >
          <div class="text-[15px] text-char leading-tight" style:font-family={f.stack}>{f.label}</div>
          <div class="text-xs text-t2 mt-1 leading-snug" style:font-family={f.stack}>{f.sample}</div>
          <div class="text-2xs text-t3 mt-1 uppercase tracking-wider">{f.kind}</div>
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet macBottomEdgeRow()}
  <div class="pt-4 mt-2 border-t border-bd">
    <div class="flex items-baseline justify-between mb-1">
      <div class="text-sm text-char">{t("settings.appearance.macFudge.title")}</div>
      <div class="text-2xs text-t3 font-mono">{t("settings.appearance.macFudge.aside")}</div>
    </div>
    <div class="text-2xs text-t3 mb-3 leading-relaxed">
      {t("settings.appearance.macFudge.hint")}
    </div>
    {#if macFudgePreset.active === "custom"}
      <div class="text-2xs text-t2 mb-3 italic">
        {t("settings.appearance.macFudge.custom")}
      </div>
    {/if}
    <div class="grid grid-cols-5 gap-2">
      {#each MAC_FUDGE_PRESETS as p (p.id)}
        {@const isActive = p.id === macFudgePreset.active}
        <button
          type="button"
          onclick={() => macFudgePreset.set(p.id as MacFudgePresetId)}
          aria-pressed={isActive}
          class={`tile-press rounded-md border px-2 py-2 text-left transition ${
            isActive ? "border-yel bg-yelp" : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
          }`}
        >
          <div class="text-xs text-char leading-tight">{t(p.labelKey)}</div>
          <div class="text-2xs text-t3 leading-tight mt-0.5">{t(p.sublabelKey)}</div>
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet accessibilityPane()}
  {#snippet rowToggle(value: boolean, onChange: (v: boolean) => void)}
    {@render toggleControl(value, onChange)}
  {/snippet}

  {#snippet body()}
    <div class="mb-6">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.accessibility.presets.title")}
      </div>
      <p class="text-2xs text-t2 mb-3 leading-snug">
        {t("settings.accessibility.presets.body")}
      </p>
      <div class="grid grid-cols-2 gap-2">
        {#each ["low-vision", "dyslexia-friendly", "reduced-motion", "motor-friendly"] as const as p (p)}
          <button
            type="button"
            onclick={() => applyA11yPersona(p)}
            class="text-left p-3 rounded-lg border border-bd bg-s1 hover:border-bd2 transition"
          >
            <div class="font-serif text-sm text-char leading-tight">
              {t(`settings.accessibility.presets.${p}.label` as StringKey)}
            </div>
            <div class="text-2xs text-t2 leading-snug mt-0.5">
              {t(`settings.accessibility.presets.${p}.desc` as StringKey)}
            </div>
            <div class="text-2xs text-t3 font-mono mt-1.5">
              {t("settings.accessibility.presets.changeCount", {
                count: String(a11yPersonaSettingCount(p)),
              })}
            </div>
          </button>
        {/each}
      </div>
    </div>

    <div class="pt-4 border-t border-bd">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.accessibility.vision.title")}
      </div>
      {#snippet textScaleControl()}
        <select
          value={a11yTextScale.value}
          onchange={(e) => a11yTextScale.set((e.currentTarget as HTMLSelectElement).value as TextScale)}
          class="px-2 py-1 bg-bg border border-bd rounded-md text-char text-xs"
        >
          {#each TEXT_SCALES as s (s)}
            <option value={s}>{s}%</option>
          {/each}
        </select>
      {/snippet}
      {@render row(t("settings.accessibility.vision.textScale.label"), t("settings.accessibility.vision.textScale.hint"), undefined, undefined, textScaleControl)}

      {#snippet contrastControl()}
        <select
          value={a11yContrast.value}
          onchange={(e) => a11yContrast.set((e.currentTarget as HTMLSelectElement).value as ContrastLevel)}
          class="px-2 py-1 bg-bg border border-bd rounded-md text-char text-xs"
        >
          {#each CONTRAST_LEVELS as c (c)}
            <option value={c}>{t(`settings.accessibility.vision.contrast.option.${c}` as StringKey)}</option>
          {/each}
        </select>
      {/snippet}
      {@render row(t("settings.accessibility.vision.contrast.label"), t("settings.accessibility.vision.contrast.hint"), undefined, undefined, contrastControl)}

      {#snippet rt()}{@render rowToggle(reduceTransparency.value, (v) => reduceTransparency.set(v))}{/snippet}
      {@render row(t("settings.accessibility.vision.reduceTransparency.label"), t("settings.accessibility.vision.reduceTransparency.hint"), undefined, undefined, rt)}

      {#snippet lc()}{@render rowToggle(largerCursor.value, (v) => largerCursor.set(v))}{/snippet}
      {@render row(t("settings.accessibility.vision.largerCursor.label"), t("settings.accessibility.vision.largerCursor.hint"), undefined, undefined, lc)}

      {#snippet df()}{@render rowToggle(dyslexiaFont.value, (v) => dyslexiaFont.set(v))}{/snippet}
      {@render row(t("settings.accessibility.vision.dyslexiaFont.label"), t("settings.accessibility.vision.dyslexiaFont.hint"), undefined, undefined, df)}
    </div>

    <div class="pt-5 border-t border-bd mt-5">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.accessibility.motion.title")}
      </div>
      {#snippet motionCtrl()}
        <select
          value={reduceMotionOverride.value}
          onchange={(e) => reduceMotionOverride.set((e.currentTarget as HTMLSelectElement).value as MotionOverride)}
          class="px-2 py-1 bg-bg border border-bd rounded-md text-char text-xs"
        >
          {#each MOTION_OVERRIDES as m (m)}
            <option value={m}>{t(`settings.accessibility.motion.reduceMotion.option.${m}` as StringKey)}</option>
          {/each}
        </select>
      {/snippet}
      {@render row(t("settings.accessibility.motion.reduceMotion.label"), t("settings.accessibility.motion.reduceMotion.hint"), undefined, undefined, motionCtrl)}

      {#snippet da()}{@render rowToggle(disableAutoplay.value, (v) => disableAutoplay.set(v))}{/snippet}
      {@render row(t("settings.accessibility.motion.disableAutoplay.label"), t("settings.accessibility.motion.disableAutoplay.hint"), undefined, undefined, da)}
    </div>

    <div class="pt-5 border-t border-bd mt-5">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.accessibility.motor.title")}
      </div>
      {#snippet lh()}{@render rowToggle(largeHitTargets.value, (v) => largeHitTargets.set(v))}{/snippet}
      {@render row(t("settings.accessibility.motor.largeTargets.label"), t("settings.accessibility.motor.largeTargets.hint"), undefined, undefined, lh)}

      {#snippet sk()}{@render rowToggle(stickyKeysAware.value, (v) => stickyKeysAware.set(v))}{/snippet}
      {@render row(t("settings.accessibility.motor.stickyKeys.label"), t("settings.accessibility.motor.stickyKeys.hint"), undefined, undefined, sk)}

      {#snippet rad()}{@render rowToggle(!extraRadialMenu.value, (v) => extraRadialMenu.set(!v))}{/snippet}
      {@render row(t("settings.accessibility.motor.plainContextMenu.label"), t("settings.accessibility.motor.plainContextMenu.hint"), undefined, undefined, rad)}
    </div>

    <div class="pt-5 border-t border-bd mt-5">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.accessibility.cognitive.title")}
      </div>
      {#snippet rg()}{@render rowToggle(readingGuide.value, (v) => readingGuide.set(v))}{/snippet}
      {@render row(t("settings.accessibility.cognitive.readingGuide.label"), t("settings.accessibility.cognitive.readingGuide.hint"), undefined, undefined, rg)}

      {#snippet stCtrl()}
        <select
          value={spellcheckTone.value}
          onchange={(e) => spellcheckTone.set((e.currentTarget as HTMLSelectElement).value as SpellcheckTone)}
          class="px-2 py-1 bg-bg border border-bd rounded-md text-char text-xs"
        >
          {#each SPELLCHECK_TONES as s (s)}
            <option value={s}>{t(`settings.accessibility.cognitive.spellTone.option.${s}` as StringKey)}</option>
          {/each}
        </select>
      {/snippet}
      {@render row(t("settings.accessibility.cognitive.spellTone.label"), t("settings.accessibility.cognitive.spellTone.hint"), undefined, undefined, stCtrl)}
    </div>

    <div class="pt-5 border-t border-bd mt-5">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.accessibility.reader.title")}
      </div>
      {#snippet va()}{@render rowToggle(verboseAnnouncements.value, (v) => verboseAnnouncements.set(v))}{/snippet}
      {@render row(t("settings.accessibility.reader.verbose.label"), t("settings.accessibility.reader.verbose.hint"), undefined, undefined, va)}

      {#snippet frCtrl()}
        <select
          value={focusRingStyle.value}
          onchange={(e) => focusRingStyle.set((e.currentTarget as HTMLSelectElement).value as FocusRingStyle)}
          class="px-2 py-1 bg-bg border border-bd rounded-md text-char text-xs"
        >
          {#each FOCUS_RING_STYLES as f (f)}
            <option value={f}>{t(`settings.accessibility.reader.focusRing.option.${f}` as StringKey)}</option>
          {/each}
        </select>
      {/snippet}
      {@render row(t("settings.accessibility.reader.focusRing.label"), t("settings.accessibility.reader.focusRing.hint"), undefined, undefined, frCtrl)}
    </div>

    <div class="pt-5 border-t border-bd mt-5">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.accessibility.color.title")}
      </div>
      {#snippet cbtCtrl()}
        <select
          value={colorBlindType.value}
          onchange={(e) => colorBlindType.set((e.currentTarget as HTMLSelectElement).value as ColorBlindType)}
          class="px-2 py-1 bg-bg border border-bd rounded-md text-char text-xs"
        >
          {#each COLOR_BLIND_TYPES as c (c)}
            <option value={c}>{t(`settings.accessibility.color.colorBlindType.option.${c}` as StringKey)}</option>
          {/each}
        </select>
      {/snippet}
      {@render row(t("settings.accessibility.color.colorBlindType.label"), t("settings.accessibility.color.colorBlindType.hint"), undefined, undefined, cbtCtrl)}

      {#snippet cbs()}{@render rowToggle(colorBlindSafe.value, (v) => colorBlindSafe.set(v))}{/snippet}
      {@render row(t("settings.accessibility.color.colorBlindSafe.label"), t("settings.accessibility.color.colorBlindSafe.hint"), undefined, undefined, cbs)}
    </div>

    <div class="pt-5 border-t border-bd mt-5">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.accessibility.viz.title")}
      </div>
      {#snippet animg()}{@render rowToggle(!disableAutoplay.value, (v) => disableAutoplay.set(!v))}{/snippet}
      {@render row(t("settings.accessibility.viz.animateGraph.label"), t("settings.accessibility.viz.animateGraph.hint"), undefined, undefined, animg)}

      {#snippet dp()}{@render rowToggle(diffPatterns.value, (v) => diffPatterns.set(v))}{/snippet}
      {@render row(t("settings.accessibility.viz.diffPatterns.label"), t("settings.accessibility.viz.diffPatterns.hint"), undefined, undefined, dp)}

      {#snippet gta()}{@render rowToggle(graphTableAlt.value, (v) => graphTableAlt.set(v))}{/snippet}
      {@render row(t("settings.accessibility.viz.graphTableAlt.label"), t("settings.accessibility.viz.graphTableAlt.hint"), undefined, undefined, gta)}
    </div>

    <div class="pt-5 border-t border-bd mt-5">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.accessibility.reset.title")}
      </div>
      <div class="space-y-5">
        {@render resetButton("a11y")}
        <div class="border-t border-bd pt-5">
          {@render resetButton("all")}
        </div>
      </div>
    </div>
  {/snippet}

  {@render section(t("settings.accessibility.title"), t("settings.accessibility.hint"), "device", body)}
{/snippet}

{#snippet writingPane()}
  {#if writingLocal && config}
    {@const local = writingLocal}
    {#snippet body()}
      {#snippet autosaveCtrl()}
        <div class="flex flex-col items-end gap-1.5">
          <div class="flex items-center gap-2">
            <input
              type="range"
              min={500}
              max={60000}
              step={500}
              value={Math.min(local.autocheckpoint_debounce_ms, 60000)}
              oninput={(e) =>
                writingSave({ ...local, autocheckpoint_debounce_ms: Number((e.currentTarget as HTMLInputElement).value) })}
              class="w-40 accent-yel"
            />
            <span class="w-20 text-right text-xs font-mono text-t2">
              {local.autocheckpoint_debounce_ms >= 60000
                ? t("settings.writing.autosave.minutes", {
                    value: (local.autocheckpoint_debounce_ms / 60000).toFixed(0),
                  })
                : t("settings.writing.autosave.seconds", {
                    value: (local.autocheckpoint_debounce_ms / 1000).toFixed(1),
                  })}
            </span>
          </div>
          <div class="flex items-center gap-1">
            {#each [
              { ms: 120000, label: t("settings.writing.autosave.preset2m"), title: t("settings.writing.autosave.preset2mTitle") },
              { ms: 300000, label: t("settings.writing.autosave.preset5m"), title: t("settings.writing.autosave.preset5mTitle") },
              { ms: 600000, label: t("settings.writing.autosave.preset10m"), title: t("settings.writing.autosave.preset10mTitle") },
              { ms: 900000, label: t("settings.writing.autosave.preset15m"), title: t("settings.writing.autosave.preset15mTitle") },
            ] as p (p.ms)}
              {@const active = local.autocheckpoint_debounce_ms === p.ms}
              <button
                type="button"
                onclick={() => writingSave({ ...local, autocheckpoint_debounce_ms: p.ms })}
                class={`text-2xs font-mono px-2 py-0.5 rounded border transition ${
                  active ? "bg-yelp text-yeld border-yel" : "border-bd text-t3 hover:text-char hover:border-bd2"
                }`}
                title={p.title}
              >
                {p.label}
              </button>
            {/each}
          </div>
        </div>
      {/snippet}
      {@render row(t("settings.writing.autosave.label"), t("settings.writing.autosave.hint"), undefined, undefined, autosaveCtrl)}

      {#snippet askThinkingCtrl()}{@render toggleControl(local.ask_thinking_on_close, (v) => writingSave({ ...local, ask_thinking_on_close: v }))}{/snippet}
      {@render row(t("settings.writing.askThinking.label"), t("settings.writing.askThinking.hint"), undefined, undefined, askThinkingCtrl)}

      {#snippet fadeCtrl()}
        <div class="flex items-center gap-2">
          <input
            type="range"
            min={7}
            max={365}
            value={local.decay_days}
            oninput={(e) => writingSave({ ...local, decay_days: Number((e.currentTarget as HTMLInputElement).value) })}
            class="w-40 accent-yel"
          />
          <span class="w-16 text-right text-xs font-mono text-t2">
            {t("settings.writing.fade.days", { value: String(local.decay_days) })}
          </span>
        </div>
      {/snippet}
      {@render row(t("settings.writing.fade.label"), t("settings.writing.fade.hint"), undefined, undefined, fadeCtrl)}

      {#snippet sizeCtrl()}
        <select
          value={local.editor_font_size}
          onchange={(e) => writingSave({ ...local, editor_font_size: Number((e.currentTarget as HTMLSelectElement).value) })}
          class="px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs"
        >
          <option value={13}>{t("settings.writing.editorSize.small")}</option>
          <option value={14}>{t("settings.writing.editorSize.snug")}</option>
          <option value={15}>{t("settings.writing.editorSize.comfortable")}</option>
          <option value={16}>{t("settings.writing.editorSize.standard")}</option>
          <option value={17}>{t("settings.writing.editorSize.roomy")}</option>
          <option value={19}>{t("settings.writing.editorSize.large")}</option>
          <option value={22}>{t("settings.writing.editorSize.xl")}</option>
          <option value={26}>{t("settings.writing.editorSize.huge")}</option>
        </select>
      {/snippet}
      {@render row(t("settings.writing.editorSize.label"), t("settings.writing.editorSize.hint"), undefined, undefined, sizeCtrl)}

      {#snippet focusCtrl()}{@render toggleControl(local.focus_mode_default, (v) => writingSave({ ...local, focus_mode_default: v }))}{/snippet}
      {@render row(t("settings.writing.focusDefault.label"), undefined, undefined, undefined, focusCtrl)}

      {#snippet fastSearchCtrl()}{@render toggleControl(local.search_index_enabled, (v) => writingSave({ ...local, search_index_enabled: v }))}{/snippet}
      {@render row(t("settings.writing.fastSearch.label"), t("settings.writing.fastSearch.hint"), undefined, undefined, fastSearchCtrl)}

      {#snippet clearSearchCtrl()}
        <div class="flex items-center gap-2">
          {#if clearSearchMsg}
            <span class={`text-2xs ${clearSearchState === "error" ? "text-danger" : "text-t2"}`}>{clearSearchMsg}</span>
          {/if}
          <button
            type="button"
            onclick={onClearSearchIndex}
            disabled={clearSearchState === "working"}
            class="px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs hover:bg-s2 disabled:opacity-50"
          >
            {clearSearchState === "working" ? t("settings.writing.clearSearch.working") : t("settings.writing.clearSearch.button")}
          </button>
        </div>
      {/snippet}
      {@render row(t("settings.writing.clearSearch.label"), t("settings.writing.clearSearch.hint"), undefined, undefined, clearSearchCtrl)}

      {#snippet rawCtrl()}{@render toggleControl(showRawMarkdown.value, (v) => showRawMarkdown.set(v))}{/snippet}
      {@render row(t("settings.writing.rawMarkdown.label"), t("settings.writing.rawMarkdown.hint"), undefined, undefined, rawCtrl)}

      {#snippet typewCtrl()}{@render toggleControl(typewriterMode.value, (v) => typewriterMode.set(v))}{/snippet}
      {@render row(t("settings.writing.typewriter.label"), t("settings.writing.typewriter.hint"), undefined, undefined, typewCtrl)}

      {#snippet edReadCtrl()}{@render toggleControl(editorialReading.value, (v) => editorialReading.set(v))}{/snippet}
      {@render row(t("settings.writing.editorial.label"), t("settings.writing.editorial.hint"), undefined, undefined, edReadCtrl)}

      {#snippet ptcCtrl()}{@render toggleControl(pathTintedCaret.value, (v) => pathTintedCaret.set(v))}{/snippet}
      {@render row(t("settings.writing.pathCaret.label"), t("settings.writing.pathCaret.hint"), undefined, undefined, ptcCtrl)}

      {@render editorFontRow()}

      <div class="text-2xs text-t3 mt-2">
        {writingSaving ? t("settings.writing.savingNow") : t("settings.writing.autosaveNote")}
      </div>
    {/snippet}
    {@render section(t("settings.writing.title"), t("settings.writing.hint"), "mixed", body)}
    {@render extrasSection()}
  {/if}
{/snippet}

{#snippet editorFontRow()}
  {@const serifs = EDITOR_FONTS.filter((f) => f.kind === "serif")}
  {@const sanses = EDITOR_FONTS.filter((f) => f.kind === "sans")}
  {@const monos = EDITOR_FONTS.filter((f) => f.kind === "mono")}
  <div class="py-3 border-b border-bd">
    <div class="flex items-baseline justify-between mb-1">
      <div class="text-sm text-char">{t("settings.writing.editorFont.title")}</div>
      <div class="text-2xs text-t3 font-mono">{t("settings.writing.editorFont.tag")}</div>
    </div>
    <div class="text-2xs text-t3 mb-3 leading-relaxed">
      {t("settings.writing.editorFont.hint")}
    </div>
    <div class="grid grid-cols-3 gap-2">
      {@render fontGroup(t("settings.writing.editorFont.serif"), serifs)}
      {@render fontGroup(t("settings.writing.editorFont.sans"), sanses)}
      {@render fontGroup(t("settings.writing.editorFont.mono"), monos)}
    </div>
  </div>
{/snippet}

{#snippet fontGroup(title: string, options: EditorFontChoice[])}
  <div>
    <div class="text-2xs uppercase tracking-wider text-t3 font-semibold mb-1.5">{title}</div>
    <div class="space-y-1.5">
      {#each options as f (f.id)}
        {@const isActive = f.id === editorFont.id}
        <button
          type="button"
          onclick={() => editorFont.set(f.id as EditorFontId)}
          class={`tile-press w-full text-left rounded-lg border p-2.5 ${
            isActive ? "border-yel bg-yelp" : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
          }`}
        >
          <div class="text-base text-char leading-tight" style:font-family={f.stack}>{f.label}</div>
          <div class="text-xs text-t2 mt-1 leading-snug" style:font-family={f.stack}>{f.sample}</div>
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet extrasSection()}
  {#snippet body()}
    {#each EXTRAS as x (x.key)}
      {@render extraRow(x.key, x.label, x.blurb, x.detail)}
    {/each}
  {/snippet}
  {@render section(t("settings.extras.title"), t("settings.extras.hint"), "device", body)}
{/snippet}

{#snippet resetButton(scope: "all" | "a11y")}
  {@const titleKey = (scope === "a11y" ? "settings.about.resetA11y.title" : "settings.about.reset.title") as StringKey}
  {@const bodyKey = (scope === "a11y" ? "settings.about.resetA11y.body" : "settings.about.reset.body") as StringKey}
  {@const buttonKey = (scope === "a11y" ? "settings.about.resetA11y.button" : "settings.about.reset.button") as StringKey}
  {@const triggerClass =
    scope === "all"
      ? "px-3 py-1.5 text-xs bg-danger text-bg rounded-md hover:opacity-90 font-medium"
      : "px-3 py-1.5 text-xs bg-s2 text-ch2 rounded-md hover:bg-s3"}
  <div class="text-sm text-char mb-1">{t(titleKey)}</div>
  <p class="text-2xs text-t2 mb-3 leading-relaxed">{t(bodyKey)}</p>
  <div class="flex items-center gap-2">
    <button
      type="button"
      onclick={() => {
        if (scope === "a11y") resetA11yConfirmOpen = true;
        else resetAllConfirmOpen = true;
      }}
      class={triggerClass}
    >
      {t(buttonKey)}
    </button>
    {#if a11yJustReset && scope === "a11y"}
      <span
        role="status"
        aria-live="polite"
        class="text-2xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
      >
        {t("settings.about.resetA11y.done")}
      </span>
    {/if}
  </div>
{/snippet}

{#snippet extraRow(extraKey: ExtraKey, label: string, blurb: string, detail: string)}
  {@const value =
    extraKey === "codeHighlight" ? extraCodeHighlight.value
    : extraKey === "spell" ? extraSpell.value
    : extraKey === "imagePreview" ? extraImagePreview.value
    : extraRadialMenu.value}
  {#snippet hintExtra()}
    <div class="text-2xs text-t3 italic font-serif leading-snug mt-1">{detail}</div>
  {/snippet}
  {#snippet ctrl()}
    <button
      type="button"
      onclick={() => {
        const next = !value;
        if (extraKey === "codeHighlight") extraCodeHighlight.set(next);
        else if (extraKey === "spell") extraSpell.set(next);
        else if (extraKey === "imagePreview") extraImagePreview.set(next);
        else extraRadialMenu.set(next);
      }}
      class={`w-10 h-5 rounded-full relative transition ${value ? "bg-yel" : "bg-s3"}`}
      aria-pressed={value}
      aria-label={label}
    >
      <span class={`absolute top-0.5 w-4 h-4 rounded-full bg-bg shadow-xs transition ${value ? "left-[22px]" : "left-0.5"}`}></span>
    </button>
  {/snippet}
  {@render row(label, blurb, undefined, hintExtra, ctrl)}
{/snippet}

{#snippet gesturesPane()}
  {#snippet body()}
    {@render gestureRow(
      t("settings.gestures.slot.tap.label"),
      t("settings.gestures.slot.tap.meta"),
      "tap",
      gestureTapStore.value,
      false,
    )}
    {@render gestureRow(
      t("settings.gestures.slot.longPress.label"),
      t("settings.gestures.slot.longPress.meta"),
      "longPress",
      gestureLongPressStore.value,
      true,
    )}
    {@render gestureRow(
      t("settings.gestures.slot.doubleTap.label"),
      t("settings.gestures.slot.doubleTap.meta"),
      "doubleTap",
      gestureDoubleTapStore.value,
      false,
    )}
  {/snippet}
  {#snippet structuralBody()}
    <div class="bg-s1 border border-bd rounded-md px-4 py-3 text-xs text-t2 leading-relaxed">
      <div class="flex items-start gap-3 mb-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-yeld bg-yelp px-2 py-0.5 rounded-full mt-0.5 whitespace-nowrap">{t("settings.gestures.structural.dragOut.tag")}</span>
        <span>{t("settings.gestures.structural.dragOut.desc")}</span>
      </div>
      <div class="flex items-start gap-3">
        <span class="font-mono text-2xs uppercase tracking-wider text-yeld bg-yelp px-2 py-0.5 rounded-full mt-0.5 whitespace-nowrap">{t("settings.gestures.structural.scroll.tag")}</span>
        <span>{t("settings.gestures.structural.scroll.desc")}</span>
      </div>
    </div>
  {/snippet}
  {#if !extraRadialMenu.value}
    <div class="mb-5 rounded-md border border-bd2 bg-s1 p-4">
      <div class="text-sm font-medium text-char mb-1">
        {t("settings.gestures.disabled.title")}
      </div>
      <div class="text-2xs text-t2 leading-relaxed mb-3">
        {t("settings.gestures.disabled.body")}
      </div>
      <button
        type="button"
        onclick={() => {
          window.dispatchEvent(
            new CustomEvent("yarrow:settings-jump-tab", { detail: "accessibility" }),
          );
        }}
        class="text-2xs font-medium text-yeld hover:text-char transition"
      >
        {t("settings.gestures.disabled.openA11y")}
      </button>
    </div>
  {/if}
  <div
    aria-disabled={!extraRadialMenu.value}
    class={!extraRadialMenu.value ? "opacity-55 pointer-events-none select-none" : undefined}
  >
    {@render section(t("settings.gestures.title"), t("settings.gestures.hint"), "device", body)}
    {@render section(t("settings.gestures.structural.title"), t("settings.gestures.structural.hint"), undefined, structuralBody)}

    <div class="mt-6 pt-5 border-t border-bd flex items-center justify-between gap-4">
      <p class="text-xs text-t3 leading-relaxed flex-1">
        {gesturesAtDefaults
          ? t("settings.gestures.reset.atDefaults")
          : t("settings.gestures.reset.modified")}
      </p>
      <button
        type="button"
        onclick={() => {
          if (gesturesAtDefaults) return;
          gestureConfirmReset = true;
        }}
        disabled={gesturesAtDefaults}
        class="px-3 py-1.5 text-sm border border-bd2 rounded-md text-char hover:border-yel hover:bg-yelp hover:text-yeld disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {t("settings.gestures.reset.btn")}
      </button>
    </div>

    <Modal
      open={gestureConfirmReset}
      onClose={() => (gestureConfirmReset = false)}
      title={t("settings.gestures.reset.confirmTitle")}
      width="w-[420px]"
    >
      {#snippet children()}
        <p class="text-sm text-t2 mb-4 leading-relaxed">
          {t("settings.gestures.reset.confirmBody")}
        </p>
        <div class="bg-bg-soft border border-bd rounded-md px-3 py-2.5 mb-5 text-xs space-y-1 font-mono text-t2">
          <div><span class="text-t3">tap </span>→ {BINDABLE_ACTIONS.find(a => a.id === getDefaultBinding("tap"))?.id}</div>
          <div><span class="text-t3">long-press </span>→ {BINDABLE_ACTIONS.find(a => a.id === getDefaultBinding("longPress"))?.id}</div>
          <div><span class="text-t3">double-tap </span>→ {BINDABLE_ACTIONS.find(a => a.id === getDefaultBinding("doubleTap"))?.id}</div>
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            onclick={() => (gestureConfirmReset = false)}
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
          >
            {t("settings.gestures.reset.cancel")}
          </button>
          <button
            type="button"
            onclick={() => {
              resetGestureBindings();
              gestureConfirmReset = false;
            }}
            class="btn-yel px-3 py-1.5 text-sm rounded-md"
          >
            {t("settings.gestures.reset.confirm")}
          </button>
        </div>
      {/snippet}
    </Modal>
  </div>
{/snippet}

{#snippet gestureRow(slotName: string, slotMeta: string, slot: GestureSlot, value: CenterActionId, _highlighted: boolean)}
  <div class="grid grid-cols-[180px_1fr] gap-4 items-start py-3">
    <div>
      <div class="font-serif text-base text-char">{slotName}</div>
      <div class="font-mono text-2xs uppercase tracking-wider text-t3 mt-0.5">{slotMeta}</div>
    </div>
    <div>
      <select
        value={value}
        onchange={(e) => gestureStore(slot).set((e.currentTarget as HTMLSelectElement).value as CenterActionId)}
        class="w-full bg-bg border border-bd2 rounded-md px-3 py-2 text-sm text-char focus:outline-hidden focus:border-yel hover:border-yel transition"
        aria-label={t(`settings.gestures.slot.${slot}.label` as StringKey)}
      >
        <optgroup label={t("settings.gestures.group.core")}>
          {#each groupedActions.core as a (a.id)}
            <option value={a.id}>{t(a.i18nLabel)}</option>
          {/each}
        </optgroup>
        <optgroup label={t("settings.gestures.group.navigation")}>
          {#each groupedActions.navigation as a (a.id)}
            <option value={a.id}>{t(a.i18nLabel)}</option>
          {/each}
        </optgroup>
        <optgroup label={t("settings.gestures.group.writing")}>
          {#each groupedActions.writing as a (a.id)}
            <option value={a.id}>{t(a.i18nLabel)}</option>
          {/each}
        </optgroup>
        <optgroup label={t("settings.gestures.group.system")}>
          {#each groupedActions.system as a (a.id)}
            <option value={a.id}>{t(a.i18nLabel)}</option>
          {/each}
        </optgroup>
      </select>
      {#if blurbForBinding(value)}
        <p class="text-xs text-t2 mt-1.5 leading-relaxed">{blurbForBinding(value)}</p>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet guidancePane()}
  {#snippet body1()}
    {#snippet ctrl()}{@render toggleControl(guidance.enabled, (v) => guidance.setEnabled(v))}{/snippet}
    {@render row(
      guidance.enabled ? t("settings.guidance.on") : t("settings.guidance.off"),
      guidance.enabled ? t("settings.guidance.onHint") : t("settings.guidance.offHint"),
      undefined,
      undefined,
      ctrl,
    )}
  {/snippet}
  {#snippet body2()}
    {#snippet ctrl()}
      <button
        type="button"
        onclick={() => guidance.reset()}
        class="px-3 py-1.5 text-sm rounded-md border border-bd hover:bg-s2 text-ch2 transition"
      >
        {t("settings.guidance.optouts.button")}
      </button>
    {/snippet}
    {@render row(t("settings.guidance.optouts.label"), t("settings.guidance.optouts.subhint"), undefined, undefined, ctrl)}
  {/snippet}
  {@render section(t("settings.guidance.title"), t("settings.guidance.hint"), "device", body1)}
  {@render section(t("settings.guidance.optouts.title"), t("settings.guidance.optouts.hint"), "device", body2)}
{/snippet}

{#snippet syncPane()}
  {#if config}
    {#snippet body()}
      <div>
        <label class="text-xs text-t2 block mb-1" for="sync-kind-buttons">{t("settings.sync.kind")}</label>
        <div id="sync-kind-buttons" class="flex gap-2">
          {#each ["github", "gitea", "custom"] as kind (kind)}
            <button
              type="button"
              onclick={() => (syncRemoteType = kind)}
              class={`px-3 py-1.5 text-xs rounded border transition ${
                syncRemoteType === kind ? "border-yel bg-yelp text-yeld" : "border-bd text-t2 hover:bg-s2 hover:text-char"
              }`}
            >
              {kind}
            </button>
          {/each}
        </div>
      </div>

      <div>
        <label class="text-xs text-t2 block mb-1" for="sync-url-input">{t("settings.sync.repoUrl")}</label>
        <input
          id="sync-url-input"
          bind:value={syncUrl}
          placeholder={t("settings.sync.repoUrlPlaceholder")}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
        />
      </div>

      <div>
        <label class="text-xs text-t2 block mb-1" for="sync-token-input">
          {t("settings.sync.token.label")} <span class="text-t3">{t("settings.sync.token.optional")}</span>
        </label>
        <input
          id="sync-token-input"
          type="password"
          bind:value={syncToken}
          placeholder={t("settings.sync.token.placeholder")}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
        />
        <p class="text-2xs text-t3 mt-1">{t("settings.sync.token.note")}</p>
      </div>

      <div class="flex items-center gap-2 pt-2">
        <button
          type="button"
          onclick={saveSyncRemote}
          disabled={!syncUrl.trim() || syncSaving}
          class="btn-yel px-3 py-1.5 text-sm rounded-md"
        >
          {syncSaving ? t("settings.sync.saving") : t("settings.sync.save")}
        </button>
        {#if config.sync.remote_url}
          <button
            type="button"
            onclick={onSyncNow}
            class="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
          >
            {t("settings.sync.syncNow")}
          </button>
        {/if}
        {#if syncMsgTop}
          <span class="ml-auto text-2xs text-t2">{syncMsgTop}</span>
        {/if}
      </div>

      {@render autoSyncControl()}

      <div class="mt-8 pt-5 border-t border-bd">
        {@render yarrowServerConnect()}
      </div>
    {/snippet}
    {@render section(t("settings.sync.title"), t("settings.sync.hint"), "workspace", body)}
  {/if}
{/snippet}

{#snippet autoSyncControl()}
  {@const options = [
    { label: t("settings.sync.autoSync.off"), value: 0 },
    { label: "1m", value: 1 },
    { label: "5m", value: 5 },
    { label: "15m", value: 15 },
    { label: "30m", value: 30 },
    { label: "60m", value: 60 },
  ]}
  <div class="mt-4">
    <label class="text-xs text-t2 block mb-1.5" for="autosync-buttons">{t("settings.sync.autoSync.label")}</label>
    <div id="autosync-buttons" class="flex gap-2 flex-wrap">
      {#each options as opt (opt.value)}
        <button
          type="button"
          onclick={() => saveAutoSync(opt.value)}
          disabled={autoSyncSaving}
          class={`px-3 py-1 text-xs rounded border transition ${
            autoSyncValue === opt.value ? "border-yel bg-yelp text-yeld" : "border-bd text-t2 hover:bg-s2 hover:text-char"
          } disabled:opacity-50`}
        >
          {opt.label}
        </button>
      {/each}
    </div>
    <p class="text-2xs text-t3 mt-1.5 leading-relaxed">{t("settings.sync.autoSync.note")}</p>
  </div>
{/snippet}

{#snippet trashRetentionControl()}
  {@const options = [
    { label: "7d", value: 7 },
    { label: "30d", value: 30 },
    { label: "90d", value: 90 },
    { label: "1y", value: 365 },
    { label: t("settings.workspace.trash.forever"), value: 0 },
  ]}
  <div>
    <div class="flex gap-2 flex-wrap">
      {#each options as opt (opt.value)}
        <button
          type="button"
          onclick={() => saveTrashRetention(opt.value)}
          disabled={trashRetentionSaving}
          class={`px-3 py-1 text-xs rounded border transition ${
            trashRetentionValue === opt.value ? "border-yel bg-yelp text-yeld" : "border-bd text-t2 hover:bg-s2 hover:text-char"
          } disabled:opacity-50`}
        >
          {opt.label}
        </button>
      {/each}
    </div>
    <p class="text-2xs text-t3 mt-1.5 leading-relaxed">
      {trashRetentionValue === 0
        ? t("settings.workspace.trash.foreverNote")
        : t("settings.workspace.trash.note", { days: String(trashRetentionValue) })}
    </p>
  </div>
{/snippet}

{#snippet yarrowServerConnect()}
  {@const server = config?.sync.server ?? null}
  {#if !server}
    <div class="flex items-center gap-2 mb-1.5">
      <span class="font-serif text-base text-char">{t("settings.server.title")}</span>
      <span class="text-2xs px-1.5 py-px bg-s3 text-t2 rounded-full">{t("settings.server.tagSelfOrConnect")}</span>
    </div>
    <p class="text-xs text-t2 leading-relaxed mb-3">{t("settings.server.intro")}</p>
    {#if serverEditing}
      {@render serverConnectForm()}
    {:else}
      <button
        type="button"
        onclick={openServerForm}
        class="btn-yel px-3 py-1.5 text-sm rounded-md"
      >
        {t("settings.server.connect")}
      </button>
    {/if}
  {:else}
    {@render serverConnectedView(server)}
  {/if}
{/snippet}

{#snippet serverConnectForm()}
  <div class="space-y-3 p-3 bg-s1 border border-bd rounded-md">
    <div>
      <label class="text-xs text-t2 block mb-1" for="server-url-input">{t("settings.server.url.label")}</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="server-url-input"
        bind:value={serverFormUrl}
        oninput={() => (serverFormTestOk = false)}
        placeholder={t("settings.server.url.placeholder")}
        class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
        autofocus
      />
    </div>
    <div>
      <span class="text-xs text-t2 block mb-1">{t("settings.server.method.label")}</span>
      <div class="flex gap-2">
        {#each [["password", t("settings.server.method.password")], ["token", t("settings.server.method.token")]] as const as pair (pair[0])}
          <button
            type="button"
            onclick={() => { serverMethod = pair[0]; serverFormErr = null; serverFormTestOk = false; }}
            class={`px-3 py-1.5 text-xs rounded border transition ${
              serverMethod === pair[0] ? "border-yel bg-yelp text-yeld" : "border-bd text-t2 hover:bg-s2 hover:text-char"
            }`}
          >
            {pair[1]}
          </button>
        {/each}
      </div>
    </div>
    <div>
      <label class="text-xs text-t2 block mb-1" for="server-email-input">{t("settings.server.email.label")}</label>
      <input
        id="server-email-input"
        bind:value={serverFormEmail}
        oninput={() => (serverFormTestOk = false)}
        placeholder={t("settings.server.email.placeholder")}
        autocomplete="email"
        class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char text-xs"
      />
    </div>
    {#if serverMethod === "password"}
      <div>
        <label class="text-xs text-t2 block mb-1" for="server-pw-input">{t("settings.server.password.label")}</label>
        <input
          id="server-pw-input"
          type="password"
          bind:value={serverFormPassword}
          autocomplete="current-password"
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char text-xs"
        />
        <p class="text-2xs text-t3 mt-1">{t("settings.server.password.note")}</p>
      </div>
    {:else}
      <div>
        <label class="text-xs text-t2 block mb-1" for="server-token-input">{t("settings.server.token.label")}</label>
        <input
          id="server-token-input"
          type="password"
          bind:value={serverFormToken}
          oninput={() => (serverFormTestOk = false)}
          placeholder={t("settings.server.token.placeholder")}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
        />
        <p class="text-2xs text-t3 mt-1">{t("settings.server.token.note")}</p>
      </div>
      <div>
        <label class="text-xs text-t2 block mb-1" for="server-pw2-input">
          {t("settings.server.passwordForEnc.label")} <span class="text-t3">{t("settings.server.passwordForEnc.optional")}</span>
        </label>
        <input
          id="server-pw2-input"
          type="password"
          bind:value={serverFormPassword}
          autocomplete="current-password"
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char text-xs"
        />
        <p class="text-2xs text-t3 mt-1">{t("settings.server.passwordForEnc.note")}</p>
      </div>
    {/if}
    <div>
      <label class="text-xs text-t2 block mb-1" for="server-ws-input">
        {t("settings.server.workspaceName.label")} <span class="text-t3">{t("settings.server.workspaceName.optional")}</span>
      </label>
      <input
        id="server-ws-input"
        bind:value={serverFormWorkspaceName}
        placeholder={config?.workspace.name || t("settings.server.workspaceName.placeholder")}
        class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char text-xs"
      />
      <p class="text-2xs text-t3 mt-1">{t("settings.server.workspaceName.note")}</p>
    </div>
    <label class="flex items-start gap-2 pt-1 cursor-pointer">
      <input
        type="checkbox"
        bind:checked={serverFormSkipTls}
        onchange={() => (serverFormTestOk = false)}
        class="mt-0.5 accent-yel"
      />
      <span class="text-xs text-t2 leading-relaxed">
        <span class="text-char">{t("settings.server.skipTls.label")}</span>
        <span class="block text-2xs text-t3 mt-0.5">
          {t("settings.server.skipTls.note.before")}<span class="font-mono">{t("settings.server.skipTls.note.localhost")}</span>{t("settings.server.skipTls.note.middle")}<span class="text-red-500">{t("settings.server.skipTls.note.warn")}</span>{t("settings.server.skipTls.note.after")}
        </span>
      </span>
    </label>
    <div class="flex items-center gap-2 pt-1">
      {#if serverMethod === "token"}
        <button
          type="button"
          onclick={serverFormTest}
          disabled={!serverFormUrlValid || !serverFormEmail.trim() || !serverFormToken.trim() || serverFormBusy !== null}
          class="px-3 py-1.5 text-xs bg-s2 text-ch2 rounded-md hover:bg-s3 disabled:opacity-50"
        >
          {serverFormBusy === "test" ? t("settings.server.testing") : serverFormTestOk ? t("settings.server.testOk") : t("settings.server.test")}
        </button>
      {/if}
      <button
        type="button"
        onclick={serverConnectSubmit}
        disabled={!serverFormCanConnect}
        class="btn-yel px-3 py-1.5 text-sm rounded-md"
      >
        {serverFormBusy === "connect" ? t("settings.server.connecting") : t("settings.server.connectButton")}
      </button>
      <button
        type="button"
        onclick={() => (serverEditing = false)}
        class="px-3 py-1.5 text-xs text-t2 hover:text-char"
      >
        {t("settings.server.cancel")}
      </button>
    </div>
    {#if serverFormErr}
      <div class="text-2xs text-red-500 leading-relaxed">{serverFormErr}</div>
    {/if}
  </div>
{/snippet}

{#snippet templatesPane()}
  {#snippet body()}
    <div class="flex gap-4 h-[360px]">
      <aside class="w-[200px] shrink-0 border border-bd rounded-md overflow-hidden flex flex-col">
        <ul class="flex-1 overflow-y-auto">
          {#if templatesItems}
            {#each templatesItems as tpl (tpl.name)}
              <li>
                <button
                  type="button"
                  onclick={() => (templatesSelected = tpl.name)}
                  class={`w-full text-left px-3 py-2 text-sm transition ${
                    templatesSelected === tpl.name
                      ? "bg-yelp text-char border-l-2 border-yel pl-[10px]"
                      : "text-t2 hover:bg-s2 hover:text-char"
                  }`}
                >
                  <div class="truncate">{tpl.label}</div>
                  <div class="text-2xs text-t3 font-mono truncate">
                    {tpl.name}{tpl.is_daily ? ` · ${t("settings.templates.daily")}` : ""}
                  </div>
                </button>
              </li>
            {/each}
            {#if templatesItems.length === 0}
              <li class="px-3 py-3 text-xs text-t3 italic">{t("settings.templates.empty")}</li>
            {/if}
          {/if}
        </ul>
        <div class="border-t border-bd px-2 py-2 flex gap-1">
          <button
            type="button"
            onclick={() => { templatesNewLabel = ""; templatesNewOpen = true; }}
            class="flex-1 px-2 py-1 text-xs bg-s2 text-ch2 rounded-sm hover:bg-s3"
          >
            {t("settings.templates.new")}
          </button>
          <button
            type="button"
            onclick={() => (templatesDeleteOpen = true)}
            disabled={!templatesSelected}
            class="px-2 py-1 text-xs text-danger hover:bg-s2 rounded-sm disabled:opacity-40"
          >
            {t("settings.templates.delete")}
          </button>
        </div>
      </aside>
      <div class="flex-1 flex flex-col min-w-0">
        {#if templatesSelected}
          <textarea
            bind:value={templatesBody}
            oninput={() => (templatesDirty = true)}
            class="flex-1 w-full font-mono text-xs bg-bg border border-bd rounded-md p-3 text-char resize-none"
            spellcheck="false"
          ></textarea>
          <div class="mt-2 flex items-center gap-2">
            <div class="text-2xs text-t3">
              {t("settings.templates.placeholders")} <code>{"{{date}}"}</code> · <code>{"{{date_human}}"}</code> · <code>{"{{weekday}}"}</code> · <code>{"{{time}}"}</code> · <code>{"{{title}}"}</code> · <code>{"{{cursor}}"}</code>
            </div>
            <button
              type="button"
              onclick={templatesSave}
              disabled={!templatesDirty}
              class="ml-auto btn-yel px-3 py-1.5 text-xs rounded-md disabled:opacity-40"
            >
              {t("settings.templates.save")}
            </button>
            {#if templatesMsg}
              <span class="text-2xs text-t2">{templatesMsg}</span>
            {/if}
          </div>
        {:else}
          <div class="flex-1 flex items-center justify-center text-t3 text-sm italic">
            {t("settings.templates.empty.editor")}
          </div>
        {/if}
      </div>
    </div>

    <Modal
      open={templatesNewOpen}
      onClose={() => { templatesNewOpen = false; templatesNewLabel = ""; }}
      title={t("settings.templates.newModal.title")}
    >
      {#snippet children()}
        <p class="text-xs text-t2 mb-3 leading-relaxed">{t("settings.templates.newModal.body")}</p>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          autofocus
          bind:value={templatesNewLabel}
          onkeydown={(e) => { if (e.key === "Enter") templatesConfirmNew(); }}
          placeholder={t("settings.templates.newModal.placeholder")}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onclick={() => { templatesNewOpen = false; templatesNewLabel = ""; }}
          >
            {t("settings.templates.newModal.cancel")}
          </button>
          <button
            type="button"
            class="btn-yel px-3 py-1.5 text-sm rounded-md"
            onclick={templatesConfirmNew}
            disabled={!templatesNewLabel.trim()}
          >
            {t("settings.templates.newModal.create")}
          </button>
        </div>
      {/snippet}
    </Modal>

    <Modal
      open={templatesDeleteOpen}
      onClose={() => (templatesDeleteOpen = false)}
      title={t("settings.templates.deleteModal.title", { label: templatesSelectedLabel ?? "" })}
    >
      {#snippet children()}
        <p class="text-sm text-t2 mb-4 leading-relaxed">
          {t("settings.templates.deleteModal.body.before")}
          <span class="font-mono text-char">.yarrow/templates/</span>
          {t("settings.templates.deleteModal.body.after")}
        </p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onclick={() => (templatesDeleteOpen = false)}
          >
            {t("settings.templates.deleteModal.keep")}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onclick={templatesConfirmRemove}
          >
            {t("settings.templates.deleteModal.confirm")}
          </button>
        </div>
      {/snippet}
    </Modal>
  {/snippet}
  {@render section(t("settings.templates.title"), t("settings.templates.hint"), "workspace", body)}
{/snippet}

{#snippet securityPane()}
  {#if config}
    {#snippet body()}
      <div class="p-4 bg-s1 border border-bd rounded-md">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="font-serif text-base text-char">{t("settings.security.localEnc.title")}</span>
          {#if secStatus?.enabled}
            {#if secStatus?.unlocked}
              <span class="text-2xs px-1.5 py-px bg-yelp text-yeld rounded-full">{t("settings.security.tag.unlocked")}</span>
            {:else}
              <span class="text-2xs px-1.5 py-px bg-s3 text-t2 rounded-full">{t("settings.security.tag.lockedEnabled")}</span>
            {/if}
          {:else}
            <span class="text-2xs px-1.5 py-px bg-s3 text-t2 rounded-full">{t("settings.security.tag.off")}</span>
          {/if}
        </div>
        <p class="text-xs text-t2 leading-relaxed">{t("settings.security.localEnc.body")}</p>
        {#if !secStatus?.enabled}
          <div class="mt-4 flex items-center gap-2">
            <button
              type="button"
              onclick={() => (secEnableOpen = true)}
              class="btn-yel px-3 py-1.5 text-sm rounded-md"
            >
              {t("settings.security.enable")}
            </button>
          </div>
        {:else}
          <div class="mt-4 grid grid-cols-1 gap-2">
            {#snippet idleCtrl()}
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={3600}
                  step={60}
                  value={config.preferences.encryption_idle_timeout_secs}
                  oninput={(e) => secUpdateIdle(Number((e.currentTarget as HTMLInputElement).value))}
                  class="w-40 accent-yel"
                />
                <span class="w-16 text-right text-xs font-mono text-t2">
                  {config.preferences.encryption_idle_timeout_secs === 0
                    ? t("settings.security.idle.never")
                    : t("settings.security.idle.minutes", { value: String(Math.round(config.preferences.encryption_idle_timeout_secs / 60)) })}
                </span>
              </div>
            {/snippet}
            {@render row(t("settings.security.idle.label"), t("settings.security.idle.hint"), undefined, undefined, idleCtrl)}
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            {#if !secStatus.unlocked}
              <button
                type="button"
                onclick={() => window.dispatchEvent(new CustomEvent("yarrow:request-unlock"))}
                class="btn-yel px-3 py-1.5 text-sm rounded-md"
              >
                {t("settings.security.unlock")}
              </button>
            {/if}
            {#if secStatus.unlocked}
              <button
                type="button"
                onclick={async () => { await api.lockEncryption(); secBump(); }}
                class="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
              >
                {t("settings.security.lockNow")}
              </button>
            {/if}
            <button
              type="button"
              onclick={() => (secChangePwOpen = true)}
              class="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
            >
              {t("settings.security.changePw")}
            </button>
            <button
              type="button"
              onclick={() => (secRegenOpen = true)}
              class="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
            >
              {t("settings.security.newRecovery")}
            </button>
            <button
              type="button"
              onclick={() => (secDisableOpen = true)}
              class="ml-auto px-3 py-1.5 text-sm text-danger hover:bg-s2 rounded-md"
            >
              {t("settings.security.turnOff")}
            </button>
          </div>
        {/if}
      </div>

      {@render enableEncModal()}
      {@render disableEncModal()}
      {@render changePwModal()}
      {@render regenRecoveryModal()}
      {@render recoveryPhraseModal()}
    {/snippet}
    {@render section(t("settings.security.title"), t("settings.security.hint"), "workspace", body)}
  {/if}
{/snippet}

{#snippet enableEncModal()}
  <Modal
    open={secEnableOpen}
    onClose={() => (secEnableOpen = false)}
    title={t("settings.security.enableModal.title")}
    width="w-[480px]"
  >
    {#snippet children()}
      {#if enableEncStep === "confirm"}
        <p class="text-sm text-t2 leading-relaxed mb-3">
          {t("settings.security.enableModal.intro")}
        </p>
        <div class="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
          <div class="font-medium mb-1">{t("settings.security.enableModal.warn.title")}</div>
          <ul class="list-disc pl-5 space-y-0.5 text-t2">
            <li>{t("settings.security.enableModal.warn.diffs")}</li>
            <li>{t("settings.security.enableModal.warn.search")}</li>
            <li>{t("settings.security.enableModal.warn.external")}</li>
            <li>{t("settings.security.enableModal.warn.export")}</li>
            <li>{t("settings.security.enableModal.warn.lost")}</li>
          </ul>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => (secEnableOpen = false)}>
            {t("settings.security.enableModal.notNow")}
          </button>
          <button
            type="button"
            class="btn-yel px-3 py-1.5 text-sm rounded-md"
            onclick={() => (enableEncStep = "password")}
          >
            {t("settings.security.enableModal.continue")}
          </button>
        </div>
      {:else}
        <p class="text-xs text-t2 mb-3 leading-relaxed">{t("settings.security.enableModal.passwordIntro")}</p>
        <label class="text-xs text-t2 block mb-1" for="enable-enc-pw1">{t("settings.security.enableModal.password")}</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="enable-enc-pw1"
          type="password"
          autofocus
          bind:value={enableEncPw1}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
        />
        <label class="text-xs text-t2 block mb-1" for="enable-enc-pw2">{t("settings.security.enableModal.confirmPassword")}</label>
        <input
          id="enable-enc-pw2"
          type="password"
          bind:value={enableEncPw2}
          onkeydown={(e) => { if (e.key === "Enter") enableEncSubmit(); }}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
        />
        {#if enableEncErr}
          <div class="text-xs text-danger bg-danger/10 border border-danger/30 rounded-sm px-3 py-2 mb-3">
            {enableEncErr}
          </div>
        {/if}
        <div class="flex justify-end gap-2">
          <button type="button" class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => (secEnableOpen = false)}>
            {t("settings.security.enableModal.cancel")}
          </button>
          <button
            type="button"
            class="btn-yel px-3 py-1.5 text-sm rounded-md"
            onclick={enableEncSubmit}
            disabled={enableEncBusy || !enableEncPw1 || !enableEncPw2}
          >
            {enableEncBusy ? t("settings.security.enableModal.settingUp") : t("settings.security.enableModal.enableButton")}
          </button>
        </div>
      {/if}
    {/snippet}
  </Modal>
{/snippet}

{#snippet disableEncModal()}
  <Modal
    open={secDisableOpen}
    onClose={() => (secDisableOpen = false)}
    title={t("settings.security.disableModal.title")}
    width="w-[440px]"
  >
    {#snippet children()}
      <p class="text-sm text-t2 mb-3 leading-relaxed">{t("settings.security.disableModal.body")}</p>
      <label class="text-xs text-t2 block mb-1" for="disable-enc-pw">{t("settings.security.disableModal.password.label")}</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="disable-enc-pw"
        type="password"
        autofocus
        bind:value={disableEncPw}
        onkeydown={(e) => { if (e.key === "Enter") disableEncSubmit(); }}
        class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
      />
      {#if disableEncErr}
        <div class="text-xs text-danger bg-danger/10 border border-danger/30 rounded-sm px-3 py-2 mb-3">
          {disableEncErr}
        </div>
      {/if}
      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => (secDisableOpen = false)}>
          {t("settings.security.disableModal.keep")}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
          onclick={disableEncSubmit}
          disabled={disableEncBusy || !disableEncPw}
        >
          {disableEncBusy ? t("settings.security.disableModal.decrypting") : t("settings.security.disableModal.confirm")}
        </button>
      </div>
    {/snippet}
  </Modal>
{/snippet}

{#snippet changePwModal()}
  <Modal
    open={secChangePwOpen}
    onClose={() => (secChangePwOpen = false)}
    title={t("settings.security.changePwModal.title")}
  >
    {#snippet children()}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="password"
        autofocus
        placeholder={t("settings.security.changePwModal.current")}
        bind:value={changePwOld}
        class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-2"
      />
      <input
        type="password"
        placeholder={t("settings.security.changePwModal.new")}
        bind:value={changePwNew1}
        class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-2"
      />
      <input
        type="password"
        placeholder={t("settings.security.changePwModal.confirm")}
        bind:value={changePwNew2}
        onkeydown={(e) => { if (e.key === "Enter") changePwSubmit(); }}
        class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
      />
      {#if changePwErr}
        <div class="text-xs text-danger bg-danger/10 border border-danger/30 rounded-sm px-3 py-2 mb-3">
          {changePwErr}
        </div>
      {/if}
      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => (secChangePwOpen = false)}>
          {t("settings.security.changePwModal.cancel")}
        </button>
        <button
          type="button"
          class="btn-yel px-3 py-1.5 text-sm rounded-md"
          onclick={changePwSubmit}
          disabled={changePwBusy || !changePwOld || !changePwNew1 || !changePwNew2}
        >
          {changePwBusy ? t("settings.security.changePwModal.saving") : t("settings.security.changePwModal.submit")}
        </button>
      </div>
    {/snippet}
  </Modal>
{/snippet}

{#snippet regenRecoveryModal()}
  <Modal
    open={secRegenOpen}
    onClose={() => (secRegenOpen = false)}
    title={t("settings.security.regenModal.title")}
  >
    {#snippet children()}
      <p class="text-xs text-t2 leading-relaxed mb-3">{t("settings.security.regenModal.body")}</p>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="password"
        autofocus
        placeholder={t("settings.security.regenModal.current")}
        bind:value={regenPw}
        onkeydown={(e) => { if (e.key === "Enter") regenSubmit(); }}
        class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
      />
      {#if regenErr}
        <div class="text-xs text-danger bg-danger/10 border border-danger/30 rounded-sm px-3 py-2 mb-3">{regenErr}</div>
      {/if}
      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => (secRegenOpen = false)}>
          {t("settings.security.regenModal.cancel")}
        </button>
        <button
          type="button"
          class="btn-yel px-3 py-1.5 text-sm rounded-md"
          onclick={regenSubmit}
          disabled={regenBusy || !regenPw}
        >
          {regenBusy ? t("settings.security.regenModal.working") : t("settings.security.regenModal.submit")}
        </button>
      </div>
    {/snippet}
  </Modal>
{/snippet}

{#snippet recoveryPhraseModal()}
  {#if secRevealPhrase}
    {@const words = secRevealPhrase.split(/\s+/).filter(Boolean)}
    <Modal
      open={true}
      onClose={closeRecoveryModal}
      title={t("settings.security.recoveryModal.title")}
      width="w-[520px]"
    >
      {#snippet children()}
        <p class="text-xs text-t2 mb-3 leading-relaxed">
          {t("settings.security.recoveryModal.body.before")}<span class="text-char font-medium">
            {t("settings.security.recoveryModal.body.bold")}
          </span>{t("settings.security.recoveryModal.body.after")}
        </p>
        <div class="grid grid-cols-3 gap-2 p-3 bg-s1 border border-bd rounded-md mb-3">
          {#each words as w, i (i)}
            <div class="font-mono text-sm text-char">
              <span class="text-t3 text-2xs mr-1.5">{i + 1}.</span>
              {w}
            </div>
          {/each}
        </div>
        <div class="flex items-center gap-2 mb-3">
          <button
            type="button"
            onclick={() => navigator.clipboard?.writeText(secRevealPhrase ?? "").catch(() => {})}
            class="px-3 py-1.5 text-xs bg-s2 text-ch2 rounded-sm hover:bg-s3"
          >
            {t("settings.security.recoveryModal.copy")}
          </button>
          <span class="text-2xs text-t3">{t("settings.security.recoveryModal.copyHint")}</span>
        </div>
        <label class="flex items-center gap-2 text-xs text-t2 cursor-pointer select-none mb-4">
          <input type="checkbox" bind:checked={recoveryConfirmed} class="accent-yel" />
          {t("settings.security.recoveryModal.confirm")}
        </label>
        <div class="flex justify-end">
          <button
            type="button"
            onclick={closeRecoveryModal}
            disabled={!recoveryConfirmed}
            class="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-40"
          >
            {t("settings.security.recoveryModal.done")}
          </button>
        </div>
      {/snippet}
    </Modal>
  {/if}
{/snippet}

{#snippet workspacePane()}
  {#if config}
    {#snippet body()}
      {#snippet nameCtrl()}
        <input
          bind:value={workspaceName}
          onblur={saveWorkspaceName}
          onkeydown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          class="w-56 px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-sm"
        />
      {/snippet}
      {@render row(t("settings.workspace.name.label"), t("settings.workspace.name.hint"), undefined, undefined, nameCtrl)}

      {#if workspaceMappingMode === "mapped"}
        {#snippet startCtrl()}
          <div class="flex items-center gap-2">
            <span class="text-xs text-t2 max-w-[220px] truncate">
              {#if workspaceMainNoteTitle}
                {workspaceMainNoteTitle}
              {:else}
                <span class="text-danger">{t("settings.workspace.startingNote.notSet")}</span>
              {/if}
            </span>
            <button
              type="button"
              onclick={() => (workspacePickerOpen = true)}
              class="px-2.5 py-1 text-xs bg-s2 text-char rounded-md hover:bg-s3"
            >
              {t("settings.workspace.startingNote.change")}
            </button>
          </div>
        {/snippet}
        {@render row(t("settings.workspace.startingNote.label"), t("settings.workspace.startingNote.hint"), undefined, undefined, startCtrl)}
      {/if}

      <MainNotePrompt
        open={workspacePickerOpen}
        onClose={() => (workspacePickerOpen = false)}
        onConfigChange={onConfigChange}
      />

      {#snippet folderCtrl()}
        <div class="flex flex-col items-end gap-1 max-w-[340px]">
          <span class="text-xs font-mono text-t2 break-all text-right">
            {folderPathRevealed || !folderPathCanTildify ? workspacePath : folderPathTildified}
          </span>
          {#if folderPathCanTildify}
            <button
              type="button"
              onclick={() => (folderPathRevealed = !folderPathRevealed)}
              class="text-2xs text-t3 hover:text-char underline-offset-2 hover:underline"
            >
              {folderPathRevealed
                ? t("settings.workspace.folder.hideFull")
                : t("settings.workspace.folder.showFull")}
            </button>
          {/if}
        </div>
      {/snippet}
      {@render row(t("settings.workspace.folder.label"), t("settings.workspace.folder.hint"), undefined, undefined, folderCtrl)}

      {#snippet createdCtrl()}
        <span class="text-xs text-t2">
          {new Date(config.workspace.created).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      {/snippet}
      {@render row(t("settings.workspace.created.label"), undefined, undefined, undefined, createdCtrl)}

      {#if onImport}
        <div class="pt-5 border-t border-bd mt-4">
          <div class="text-sm text-char mb-1">{t("settings.workspace.import.title")}</div>
          <p class="text-2xs text-t2 mb-3 leading-relaxed">
            {t("settings.workspace.import.body.before")}<span class="font-mono">{t("settings.workspace.import.body.bib")}</span>{t("settings.workspace.import.body.middle")}<span class="font-mono">{t("settings.workspace.import.body.bib")}</span>{t("settings.workspace.import.body.middle2")}<span class="font-mono">{t("settings.workspace.import.body.tag")}</span>{t("settings.workspace.import.body.after")}
          </p>
          <button
            type="button"
            onclick={onImport}
            class="px-3 py-1.5 text-sm bg-s2 text-char rounded-md hover:bg-s3"
          >
            {t("settings.workspace.import.button")}
          </button>
        </div>
      {/if}

      <div class="pt-5 border-t border-bd mt-4">
        <div class="text-sm text-char mb-1">{t("settings.workspace.export.title")}</div>
        <p class="text-2xs text-t2 mb-2 leading-relaxed">{t("settings.workspace.export.body")}</p>
        {@render exportButton()}
      </div>

      <div class="pt-5 border-t border-bd mt-4">
        <div class="text-sm text-char mb-1">{t("settings.workspace.trim.title")}</div>
        <p class="text-2xs text-t2 mb-3 leading-relaxed">{t("settings.workspace.trim.body")}</p>
        {@render trimHistoryButtons()}
      </div>

      <div class="pt-5 border-t border-bd mt-4">
        <div class="text-sm text-char mb-1">{t("settings.workspace.trash.title")}</div>
        <p class="text-2xs text-t2 mb-3 leading-relaxed">{t("settings.workspace.trash.body")}</p>
        {@render trashRetentionControl()}
      </div>

      <div class="pt-5 border-t border-bd mt-4">
        <div class="text-sm text-char mb-1">{t("settings.workspace.clearCache.title")}</div>
        <p class="text-2xs text-t2 mb-3 leading-relaxed">
          {t("settings.workspace.clearCache.body.before")}<span class="font-mono">{t("settings.workspace.clearCache.body.indexJson")}</span>{t("settings.workspace.clearCache.body.middle")}
          <span class="font-mono"> {t("settings.workspace.clearCache.body.indexDb")}</span>{t("settings.workspace.clearCache.body.after")}
        </p>
        {@render clearAllCacheButton()}
      </div>

      <div class="pt-5 border-t border-bd mt-4">
        <button
          type="button"
          onclick={onCloseWorkspace}
          class="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
        >
          {t("settings.workspace.close.button")}
        </button>
        <p class="text-2xs text-t3 mt-2">{t("settings.workspace.close.note")}</p>
      </div>
    {/snippet}
    {@render section(t("settings.workspace.title"), t("settings.workspace.hint"), "workspace", body)}
  {/if}
{/snippet}

{#snippet trimHistoryButtons()}
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      onclick={() => { trimPickerDays = 180; trimPickerOpen = true; }}
      disabled={trimBusy}
      class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
    >
      {t("settings.trim.unifiedBtn")}
    </button>
  </div>
  {#if trimMsg}
    <div role="status" class="text-sm text-char mt-3 px-3 py-2 bg-yelp/40 border border-yel/40 rounded-md leading-relaxed">
      {trimMsg}
    </div>
  {/if}

  <Modal
    open={trimPickerOpen}
    onClose={() => (trimPickerOpen = false)}
    title={t("settings.trim.unifiedPicker.title")}
  >
    {#snippet children()}
      <p class="text-sm text-t2 mb-3 leading-relaxed">{t("settings.trim.unifiedPicker.body")}</p>
      <div class="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onclick={() => (trimPickerMode = "age")}
          class={`px-3 py-3 text-sm rounded-md border transition text-left ${
            trimPickerMode === "age" ? "bg-yelp text-yeld border-yel/50" : "bg-bg text-ch2 border-bd hover:bg-s2 hover:border-bd2"
          }`}
        >
          <div class="font-medium">{t("settings.trim.unifiedPicker.modeAge.label")}</div>
          <div class="text-2xs text-t3 mt-0.5">{t("settings.trim.unifiedPicker.modeAge.hint")}</div>
        </button>
        <button
          type="button"
          onclick={() => (trimPickerMode = "empty")}
          class={`px-3 py-3 text-sm rounded-md border transition text-left ${
            trimPickerMode === "empty" ? "bg-yelp text-yeld border-yel/50" : "bg-bg text-ch2 border-bd hover:bg-s2 hover:border-bd2"
          }`}
        >
          <div class="font-medium">{t("settings.trim.unifiedPicker.modeEmpty.label")}</div>
          <div class="text-2xs text-t3 mt-0.5">{t("settings.trim.unifiedPicker.modeEmpty.hint")}</div>
        </button>
      </div>
      {#if trimPickerMode === "age"}
        <div class="text-2xs text-t3 mb-2 font-mono uppercase tracking-wider">
          {t("settings.trim.unifiedPicker.cutoffLabel")}
        </div>
        <div class="grid grid-cols-2 gap-2 mb-4">
          {#each AGE_OPTIONS as d (d)}
            <button
              type="button"
              onclick={() => (trimPickerDays = d)}
              class={`px-3 py-3 text-sm rounded-md border transition text-left ${
                trimPickerDays === d ? "bg-yelp text-yeld border-yel/50" : "bg-bg text-ch2 border-bd hover:bg-s2 hover:border-bd2"
              }`}
            >
              <div class="font-medium">{t("settings.trim.picker.daysFmt", { days: String(d) })}</div>
              <div class="text-2xs text-t3 mt-0.5">{keepLabelFor(d)}</div>
            </button>
          {/each}
        </div>
      {/if}
      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => (trimPickerOpen = false)}>
          {t("settings.trim.picker.cancel")}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
          onclick={() => {
            trimPickerOpen = false;
            if (trimPickerMode === "age") {
              trimConfirm = { kind: "age", days: trimPickerDays };
            } else {
              trimConfirm = { kind: "empty" };
            }
          }}
        >
          {t("settings.trim.picker.continue")}
        </button>
      </div>
    {/snippet}
  </Modal>

  <Modal
    open={trimConfirm?.kind === "age"}
    onClose={() => { if (!trimBusy) trimConfirm = null; }}
    title={t("settings.trim.confirmAge.title", { days: String(trimConfirmDays) })}
  >
    {#snippet children()}
      <p class="text-sm text-t2 mb-3 leading-relaxed">
        {t("settings.trim.confirmAge.body", { days: String(trimConfirmDays) })}
      </p>
      <div class="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
        <div class="font-medium mb-1">{t("settings.trim.confirm.warnTitle")}</div>
        <ul class="list-disc pl-5 space-y-0.5 text-t2">
          <li>{t("settings.trim.confirmAge.warn.thinking")}</li>
          <li>{t("settings.trim.confirmAge.warn.blame")}</li>
          <li>{t("settings.trim.confirm.warn.forcePush")}</li>
        </ul>
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm text-t2 hover:text-char"
          onclick={() => (trimConfirm = null)}
          disabled={trimBusy}
        >
          {t("settings.trim.keep")}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
          onclick={() => trimConfirm?.kind === "age" && trimRun(trimConfirm)}
          disabled={trimBusy}
        >
          {trimBusy ? t("settings.trim.trimming") : t("settings.trim.confirmDoit")}
        </button>
      </div>
    {/snippet}
  </Modal>

  <Modal
    open={trimConfirm?.kind === "empty"}
    onClose={() => { if (!trimBusy) trimConfirm = null; }}
    title={t("settings.trim.confirmEmpty.title")}
  >
    {#snippet children()}
      <p class="text-sm text-t2 mb-3 leading-relaxed">{t("settings.trim.confirmEmpty.body")}</p>
      <div class="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
        <div class="font-medium mb-1">{t("settings.trim.confirm.warnTitle")}</div>
        <ul class="list-disc pl-5 space-y-0.5 text-t2">
          <li>{t("settings.trim.confirmEmpty.warn.scrub")}</li>
          <li>{t("settings.trim.confirm.warn.forcePush")}</li>
        </ul>
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => (trimConfirm = null)} disabled={trimBusy}>
          {t("settings.trim.keep")}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
          onclick={() => trimRun({ kind: "empty" })}
          disabled={trimBusy}
        >
          {trimBusy ? t("settings.trim.trimming") : t("settings.trim.confirmDoit")}
        </button>
      </div>
    {/snippet}
  </Modal>
{/snippet}

{#snippet clearAllCacheButton()}
  <button
    type="button"
    onclick={() => (clearCacheConfirm = true)}
    disabled={clearCacheBusy}
    class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
  >
    {t("settings.clearCache.button")}
  </button>
  {#if clearCacheMsg}
    <p class="text-2xs text-t2 mt-2 leading-snug">{clearCacheMsg}</p>
  {/if}

  <Modal
    open={clearCacheConfirm}
    onClose={() => { if (!clearCacheBusy) clearCacheConfirm = false; }}
    title={t("settings.clearCache.modal.title")}
  >
    {#snippet children()}
      <p class="text-sm text-t2 mb-3 leading-relaxed">{t("settings.clearCache.modal.body")}</p>
      <div class="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
        <div class="font-medium mb-1">{t("settings.clearCache.modal.does")}</div>
        <ul class="list-disc pl-5 space-y-0.5 text-t2">
          <li><span class="font-mono">.yarrow/index.json</span> {t("settings.clearCache.modal.does.json")}</li>
          <li><span class="font-mono">.yarrow/index.db</span> {t("settings.clearCache.modal.does.db")}</li>
        </ul>
        <div class="font-medium mb-1 mt-2">{t("settings.clearCache.modal.doesnt")}</div>
        <ul class="list-disc pl-5 space-y-0.5 text-t2">
          <li>{t("settings.clearCache.modal.doesnt.md.before")}<span class="font-mono">.md</span>{t("settings.clearCache.modal.doesnt.md.after")}</li>
          <li>{t("settings.clearCache.modal.doesnt.git")}</li>
          <li>{t("settings.clearCache.modal.doesnt.workspace")}</li>
        </ul>
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 text-sm text-t2 hover:text-char" onclick={() => (clearCacheConfirm = false)} disabled={clearCacheBusy}>
          {t("settings.clearCache.modal.cancel")}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
          onclick={clearCacheRun}
          disabled={clearCacheBusy}
        >
          {clearCacheBusy ? t("settings.clearCache.modal.clearing") : t("settings.clearCache.modal.confirm")}
        </button>
      </div>
    {/snippet}
  </Modal>
{/snippet}

{#snippet exportButton()}
  <button
    type="button"
    onclick={() => (exportOpen = true)}
    class="btn-yel px-3 py-1.5 text-sm rounded-md"
  >
    {t("settings.export.go")}
  </button>

  <Modal
    open={exportOpen}
    onClose={closeExport}
    title={t("settings.export.modal.title")}
    width="w-[480px]"
  >
    {#snippet children()}
      <p class="text-sm text-t2 mb-4 leading-relaxed">{t("settings.export.modal.body")}</p>

      <div class="mb-4">
        <div class="text-2xs uppercase tracking-wider text-t3 mb-1.5">
          {t("settings.export.modal.dest.label")}
        </div>
        <button
          type="button"
          onclick={pickExportDest}
          disabled={exportBusy}
          class={
            exportDest
              ? "w-full text-left px-3 py-2 text-sm rounded-md border border-bd bg-bg text-char hover:border-bd2 transition truncate disabled:opacity-60"
              : "w-full text-left px-3 py-2 text-sm rounded-md border border-bd2 border-dashed bg-bg text-t2 hover:bg-s2 hover:text-char transition disabled:opacity-60"
          }
        >
          <span class="font-mono break-all">
            {exportDest || t("settings.export.modal.dest.choose")}
          </span>
        </button>
        {#if exportDest}
          <button
            type="button"
            onclick={pickExportDest}
            disabled={exportBusy}
            class="text-2xs text-t3 hover:text-char mt-1 disabled:opacity-60"
          >
            {t("settings.export.modal.dest.change")}
          </button>
        {/if}
      </div>

      {#if exportMsg}
        <div
          role="status"
          class={
            exportError
              ? "text-xs text-char mb-4 px-3 py-2 bg-danger/10 border border-danger/30 rounded-md leading-relaxed break-all"
              : "text-xs text-char mb-4 px-3 py-2 bg-yelp/40 border border-yel/40 rounded-md leading-relaxed break-all"
          }
        >
          {exportMsg}
        </div>
      {/if}

      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={closeExport}
          disabled={exportBusy}
          class="px-3 py-1.5 text-sm text-t2 hover:text-char disabled:opacity-60"
        >
          {exportMsg && !exportError ? t("settings.export.modal.close") : t("settings.export.modal.cancel")}
        </button>
        <button
          type="button"
          onclick={runExport}
          disabled={exportBusy || !exportDest}
          class="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-60"
        >
          {exportBusy
            ? t("settings.export.exporting")
            : exportMsg && !exportError
              ? t("settings.export.modal.again")
              : t("settings.export.modal.confirm")}
        </button>
      </div>
    {/snippet}
  </Modal>
{/snippet}

{#snippet storagePane()}
  {#if config?.sync.server?.workspace_id}
    <div>
      <div class="flex items-center gap-2 mb-1 flex-wrap">
        <div class="font-serif text-2xl text-char">{t("settings.storage.title")}</div>
        {@render scopeChip("account")}
      </div>
      <div class="text-sm text-t1 mb-3 leading-relaxed max-w-prose">
        <strong class="text-char">{t("settings.storage.intro.bold")}</strong>{t("settings.storage.intro.body")}
      </div>
      <div class="text-xs text-t2 mb-6 leading-relaxed max-w-prose">
        {t("settings.storage.body")}
      </div>

      {@render alignWithServerPanel()}

      {#if storageLoadErr}
        <div class="text-sm text-danger bg-danger/10 border border-danger/30 rounded-sm px-3 py-2 mb-4">
          {t("settings.storage.loadFailed", { error: storageLoadErr })}
        </div>
      {/if}

      {#if storageBlobs === null && !storageLoadErr}
        <div class="text-sm text-t2 italic">{t("settings.storage.loading")}</div>
      {/if}

      {#if storageBlobs && storageBlobs.length === 0 && !storageLoadErr}
        <div class="text-sm text-t2">{t("settings.storage.empty")}</div>
      {/if}

      {#if storageBlobs && storageBlobs.length > 0}
        <div class="border border-bd rounded-lg overflow-hidden mb-4 max-h-[360px] overflow-y-auto">
          <div class="grid grid-cols-[28px_20px_1fr_90px] gap-2 px-3 py-2 bg-bg-soft border-b border-bd text-[11px] uppercase tracking-wide text-t3 sticky top-0">
            <div></div>
            <div></div>
            <div>{t("settings.storage.col.file")}</div>
            <div class="text-right">{t("settings.storage.col.size")}</div>
          </div>
          {#each storageGroups as g (g.dangling ? `<dangling:${g.versions[0].oid}>` : g.path)}
            {@const key = g.dangling ? `<dangling:${g.versions[0].oid}>` : g.path}
            {@const checked = !g.dangling && storageSelected.has(g.path)}
            {@const isExpanded = storageExpanded.has(key)}
            {@const hasMultiple = g.versions.length > 1}
            <div class="border-b border-bd/40 last:border-b-0">
              <div class={`grid grid-cols-[28px_20px_1fr_90px] items-center gap-2 px-3 py-2 text-sm ${checked ? "bg-yelp/40" : "hover:bg-bg-soft"}`}>
                <label class="flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onchange={() => !g.dangling && storageToggle(g.path)}
                    disabled={g.dangling}
                    class="accent-yel"
                  />
                </label>
                {#if hasMultiple}
                  <button
                    type="button"
                    onclick={() => storageToggleExpand(key)}
                    aria-label={isExpanded ? t("settings.storage.collapseAria") : t("settings.storage.expandAria")}
                    title={isExpanded ? t("settings.storage.collapseTitle") : t("settings.storage.expandTitle")}
                    class="w-5 h-5 flex items-center justify-center text-t3 hover:text-char transition"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" class={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                      <path d="M 3 1 L 7 5 L 3 9 Z" />
                    </svg>
                  </button>
                {:else}
                  <span></span>
                {/if}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="truncate cursor-pointer" onclick={() => !g.dangling && storageToggle(g.path)}>
                  <span class={g.dangling ? "text-t3 italic" : ""}>{g.displayPath}</span>
                  {#if hasMultiple}
                    <span class="ml-2 text-[11px] text-t3">
                      {t("settings.storage.versionsCount", { count: String(g.versions.length) })}
                    </span>
                  {/if}
                </label>
                <div class="text-t2 tabular-nums text-right whitespace-nowrap">
                  {humanBytesStorage(g.totalBytes)}
                </div>
              </div>
              {#if isExpanded && hasMultiple}
                <div class="bg-bg-soft/60 border-t border-bd/40">
                  <div class="grid grid-cols-[28px_20px_1fr_90px] gap-2 px-3 py-1.5 text-[11px] uppercase tracking-wide text-t3">
                    <span></span>
                    <span></span>
                    <span>{t("settings.storage.version.col")}</span>
                    <span class="text-right">{t("settings.storage.col.size")}</span>
                  </div>
                  {#each g.versions as v, idx (v.oid)}
                    <div class="grid grid-cols-[28px_20px_1fr_90px] gap-2 px-3 py-1 text-[12px] text-t2">
                      <span></span>
                      <span class="text-t3 text-center">
                        {idx === g.versions.length - 1 ? "└" : "├"}
                      </span>
                      <span class="font-mono truncate" title={v.oid}>{v.oid.slice(0, 12)}</span>
                      <span class="tabular-nums text-right whitespace-nowrap">{humanBytesStorage(v.size)}</span>
                    </div>
                  {/each}
                  <div class="px-3 pb-2 pt-0.5 text-[11px] text-t3 italic">
                    {t("settings.storage.version.note")}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <div class="flex items-center justify-between">
          <div class="text-sm text-t2">
            {#if storageSelected.size > 0}
              {t(
                storageSelected.size === 1
                  ? "settings.storage.selected.singular"
                  : "settings.storage.selected.plural",
                { count: String(storageSelected.size), bytes: humanBytesStorage(storageTotalSelectedBytes) },
              )}
            {:else}
              <span class="italic">{t("settings.storage.selected.empty")}</span>
            {/if}
          </div>
          <button
            type="button"
            onclick={storageOpenConfirm}
            disabled={storageSelected.size === 0}
            class="px-4 py-2 rounded-md bg-danger text-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
          >
            {t("settings.storage.deleteSelected")}
          </button>
        </div>
      {/if}

      <Modal
        open={storageConfirmOpen}
        onClose={() => (storageConfirmOpen = false)}
        title={t("settings.storage.confirm.title")}
        width="w-[520px]"
      >
        {#snippet children()}
          <div class="space-y-3 text-sm text-t1 leading-relaxed">
            <p>
              {t("settings.storage.confirm.body.before")}<strong class="text-char">{storageSelected.size}</strong>{" "}
              {storageSelected.size === 1 ? t("settings.storage.confirm.body.fileSingular") : t("settings.storage.confirm.body.filePlural")} (
              <strong class="text-char">{humanBytesStorage(storageTotalSelectedBytes)}</strong>
              ) <strong class="text-char">{t("settings.storage.confirm.body.middle")}</strong>{t("settings.storage.confirm.body.after")}
            </p>
            <p class="text-char font-medium">{t("settings.storage.confirm.cantUndo")}</p>
            {#if storageResult}
              <div class="bg-sage-dim/40 border border-sage/20 rounded-sm px-3 py-2 text-sm text-char">
                {t("settings.storage.confirm.done", { bytes: humanBytesStorage(storageResult.bytes_freed) })}
              </div>
            {/if}
            {#if storageRunErr}
              <div class="bg-danger/10 border border-danger/30 rounded-sm px-3 py-2 text-sm text-danger">
                {storageRunErr}
              </div>
            {/if}
            {#if !storageResult}
              <label class="block">
                <span class="text-xs uppercase tracking-wide text-t3">
                  {t("settings.storage.confirm.typeToConfirm.before")}<strong class="text-char">DELETE</strong>{t("settings.storage.confirm.typeToConfirm.after")}
                </span>
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  type="text"
                  bind:value={storageConfirmText}
                  disabled={storageRunning}
                  autofocus
                  class="mt-1 w-full px-3 py-2 rounded-sm border border-bd2 bg-bg text-char focus:border-yel focus:outline-hidden font-mono"
                  placeholder={t("settings.storage.confirm.placeholder")}
                />
              </label>
            {/if}
            <div class="flex justify-end gap-2 pt-2">
              {#if storageResult}
                <button
                  type="button"
                  onclick={() => (storageConfirmOpen = false)}
                  class="px-4 py-2 rounded-md bg-yel text-on-yel hover:bg-yel2 text-sm font-medium"
                >
                  {t("settings.storage.confirm.doneButton")}
                </button>
              {:else}
                <button
                  type="button"
                  onclick={() => (storageConfirmOpen = false)}
                  disabled={storageRunning}
                  class="px-4 py-2 rounded-md border border-bd2 bg-bg hover:bg-bg-soft text-char text-sm"
                >
                  {t("settings.storage.confirm.cancel")}
                </button>
                <button
                  type="button"
                  onclick={storageRunReclaim}
                  disabled={storageRunning || storageConfirmText.trim().toLowerCase() !== "delete"}
                  class="px-4 py-2 rounded-md bg-danger text-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {storageRunning ? t("settings.storage.confirm.deleting") : t("settings.storage.confirm.confirmButton")}
                </button>
              {/if}
            </div>
          </div>
        {/snippet}
      </Modal>
    </div>
  {/if}
{/snippet}

{#snippet alignWithServerPanel()}
  <div class="mb-5 border border-bd rounded-lg p-3 bg-bg-soft">
    <div class="flex items-start justify-between gap-3">
      <div class="text-xs text-t2 leading-relaxed max-w-prose">
        <strong class="text-char">{t("settings.align.title")}</strong>{" "}
        {t("settings.align.body")}
      </div>
      <button
        type="button"
        onclick={runAlignWithServer}
        disabled={alignStatus === "running"}
        class="shrink-0 px-3 py-1.5 rounded-md bg-yel text-on-yel hover:bg-yel2 disabled:opacity-50 text-xs font-medium whitespace-nowrap"
      >
        {alignStatus === "running" ? t("settings.align.syncing") : t("settings.align.button")}
      </button>
    </div>
    {#if alignSummary && alignStatus === "ok"}
      <div class="mt-2 text-xs text-char bg-sage-dim/40 border border-sage/20 rounded-sm px-2.5 py-1.5">
        {alignSummary}
      </div>
    {/if}
    {#if alignErr && alignStatus === "error"}
      <div class="mt-2 text-xs text-danger bg-danger/10 border border-danger/30 rounded-sm px-2.5 py-1.5">
        {alignErr}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet shortcutsPane()}
  {@const sk = namedShortcutsStore.value}
  {@const groupsList = [
    {
      title: t("settings.shortcuts.group.gettingAround"),
      items: [
        { label: t("settings.shortcuts.palette"),         keys: sk.palette },
        { label: t("settings.shortcuts.quickSwitch"),     keys: sk.quickSwitch },
        { label: t("settings.shortcuts.switchWorkspace"), keys: sk.switchWorkspace },
        { label: t("settings.shortcuts.jumpToday"),       keys: sk.jumpToday },
        { label: t("settings.shortcuts.openSettings"),    keys: sk.settings },
      ],
    },
    {
      title: t("settings.shortcuts.group.writing"),
      items: [
        { label: t("settings.shortcuts.newNote"),         keys: sk.newNote },
        { label: t("settings.shortcuts.newDirection"),    keys: sk.newDirection },
        { label: t("settings.shortcuts.branchFromHere"),  keys: sk.branchFromHere },
        { label: t("settings.shortcuts.focusToggle"),     keys: sk.focusToggle },
        { label: t("settings.shortcuts.scratchpad"),      keys: sk.scratchpad },
      ],
    },
  ]}
  {@const platformLabel = isMacCopy() ? t("settings.shortcuts.platform.mac") : t("settings.shortcuts.platform.other")}
  {#snippet body()}
    {#each groupsList as g (g.title)}
      <div class="mb-5 last:mb-0">
        <div class="text-2xs uppercase tracking-wider text-t3 font-semibold mb-2">{g.title}</div>
        <ul class="divide-y divide-bd/70 border border-bd/60 rounded-md overflow-hidden">
          {#each g.items as it (it.label)}
            <li class="flex items-center justify-between gap-4 px-3.5 py-2 bg-bg">
              <span class="text-sm text-t2">{it.label}</span>
              <kbd class="font-mono text-xs text-ch2 bg-s2 border border-bd rounded-sm px-2 py-0.5 whitespace-nowrap">
                {it.keys}
              </kbd>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
    <div class="text-2xs text-t3 mt-4 leading-relaxed">
      {t("settings.shortcuts.editorHint.before")}<kbd class="font-mono text-[11px] bg-s2 border border-bd rounded-sm px-1.5">[[wikilink]]</kbd>
      {t("settings.shortcuts.editorHint.or")}<kbd class="font-mono text-[11px] bg-s2 border border-bd rounded-sm px-1.5">![[embed]]</kbd>
      {t("settings.shortcuts.editorHint.middle")}<kbd class="font-mono text-[11px] bg-s2 border border-bd rounded-sm px-1.5">??</kbd>
      {t("settings.shortcuts.editorHint.after")}
    </div>
  {/snippet}
  {@render section(t("settings.shortcuts.title"), t("settings.shortcuts.hint", { platform: platformLabel }), "device", body)}
{/snippet}

{#snippet helpPane()}
  {#snippet body()}
    <div class="pt-4 border-t border-bd">
      <div class="text-sm text-char mb-1">{t("settings.help.docs.title")}</div>
      <p class="text-2xs text-t2 mb-3 leading-relaxed">{t("settings.help.docs.body")}</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          onclick={() => openUrl("https://yarrow.software/user-guide.html").catch(() => {})}
          class="px-3 py-1.5 text-xs bg-s2 text-char rounded-md hover:bg-s3"
        >
          {t("settings.help.docs.openOnline")}
        </button>
        <button
          type="button"
          onclick={() => setTab("shortcuts")}
          class="px-3 py-1.5 text-xs bg-s2 text-char rounded-md hover:bg-s3"
        >
          {t("settings.help.docs.shortcutsCheatsheet")}
        </button>
      </div>
    </div>

    <div class="pt-5 border-t border-bd mt-5">
      <div class="text-sm text-char mb-1">{t("settings.help.whatsNew.title")}</div>
      <p class="text-2xs text-t2 mb-3 leading-relaxed">
        {t("settings.help.whatsNew.body", { version: APP_VERSION })}
      </p>
      <button
        type="button"
        onclick={() => openUrl("https://github.com/neuralpunk/yarrow/blob/main/CHANGELOG.md").catch(() => {})}
        class="px-3 py-1.5 text-xs bg-s2 text-char rounded-md hover:bg-s3"
      >
        {t("settings.help.whatsNew.viewChangelog")}
      </button>
    </div>

    <div class="pt-5 border-t border-bd mt-5">
      <div class="text-sm text-char mb-1">{t("settings.help.support.title")}</div>
      <p class="text-2xs text-t2 mb-3 leading-relaxed">{t("settings.help.support.body")}</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          onclick={helpSendFeedback}
          class="px-3 py-1.5 text-xs bg-yel text-on-yel rounded-md hover:opacity-90 font-medium"
        >
          {t("settings.help.support.sendFeedback")}
        </button>
        <button
          type="button"
          onclick={() => openUrl("https://github.com/neuralpunk/yarrow/issues").catch(() => {})}
          class="px-3 py-1.5 text-xs bg-s2 text-char rounded-md hover:bg-s3"
        >
          {t("settings.help.support.openIssue")}
        </button>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <code class="text-2xs font-mono text-t2 bg-s1 border border-bd px-2 py-1 rounded-sm">
          {helpDiagnostics}
        </code>
        <button
          type="button"
          onclick={helpCopyDiagnostics}
          class="text-2xs text-t3 hover:text-char underline-offset-2 hover:underline"
        >
          {t("settings.help.support.copyDiagnostics")}
        </button>
      </div>
    </div>
  {/snippet}
  {@render section(t("settings.help.title"), t("settings.help.hint"), "device", body)}
{/snippet}

{#snippet aboutPane()}
  {@const externalLinks: Array<{ labelKey: StringKey; href: string; domainHint: string }> = [
    {
      labelKey: "settings.about.links.docs",
      href: "https://yarrow.software/user-guide.html",
      domainHint: "yarrow.software/user-guide.html",
    },
    {
      labelKey: "settings.about.links.changelog",
      href: "https://github.com/neuralpunk/yarrow/blob/main/CHANGELOG.md",
      domainHint: "github.com/neuralpunk/yarrow",
    },
    {
      labelKey: "settings.about.links.github",
      href: "https://github.com/neuralpunk/yarrow",
      domainHint: "github.com/neuralpunk/yarrow",
    },
    {
      labelKey: "settings.about.links.website",
      href: "https://yarrow.software",
      domainHint: "yarrow.software",
    },
  ]}
  {#snippet body()}
    <p class="text-sm text-t2 leading-relaxed">{t("settings.about.body1")}</p>
    <p class="text-sm text-t2 leading-relaxed">{t("settings.about.body2")}</p>
    <div class="mt-4 pt-4 border-t border-bd">
      <div class="font-mono text-[10px] uppercase tracking-wider text-t3 mb-2">
        {t("settings.about.links.title")}
      </div>
      <ul class="space-y-1.5">
        {#each externalLinks as l (l.href)}
          <li>
            <button
              type="button"
              onclick={() => { openUrl(l.href).catch(() => {}); }}
              class="inline-flex items-center gap-1.5 text-sm text-yeld hover:text-char transition"
            >
              {t(l.labelKey)}
              <span class="text-2xs text-t3 font-mono">{l.domainHint}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M7 17L17 7" /><path d="M8 7h9v9" />
              </svg>
            </button>
          </li>
        {/each}
      </ul>
      <div class="text-2xs text-t3 font-mono mt-3">
        {t("settings.about.versionLine", { version: APP_VERSION })}
      </div>
    </div>
    <div class="mt-6 pt-4 border-t border-bd">
      {@render settingsExportImportRow()}
    </div>
    <div class="mt-4">
      {@render resetButton("all")}
    </div>
  {/snippet}
  {@render section(t("settings.about.title"), undefined, undefined, body)}
{/snippet}

{#snippet settingsExportImportRow()}
  <div>
    <div class="text-sm text-char mb-1">{t("settings.about.exportImport.title")}</div>
    <p class="text-2xs text-t2 mb-3 leading-relaxed">{t("settings.about.exportImport.body")}</p>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        onclick={onPrefsExport}
        disabled={prefsExportImportBusy !== "none"}
        class="px-3 py-1.5 text-xs bg-s2 text-char rounded-md hover:bg-s3 disabled:opacity-60"
      >
        {prefsExportImportBusy === "exporting"
          ? t("settings.about.exportImport.exporting")
          : t("settings.about.exportImport.exportBtn")}
      </button>
      <button
        type="button"
        onclick={onPrefsImport}
        disabled={prefsExportImportBusy !== "none"}
        class="px-3 py-1.5 text-xs bg-s2 text-char rounded-md hover:bg-s3 disabled:opacity-60"
      >
        {prefsExportImportBusy === "importing"
          ? t("settings.about.exportImport.importing")
          : t("settings.about.exportImport.importBtn")}
      </button>
    </div>
    {#if prefsExportImportMsg}
      <div class="text-2xs text-t2 mt-2 leading-snug">{prefsExportImportMsg}</div>
    {/if}
  </div>
{/snippet}

{#snippet serverConnectedView(server: NonNullable<WorkspaceConfig["sync"]["server"]>)}
  {@const connectedLabel = server.pat_label ?? t("settings.server.connected.tokenDefault")}
  {@const workspaceOnServerLabel = server.workspace_id
    ? t("settings.server.connected.workspaceFmt", { id: server.workspace_id.slice(0, 8) })
    : t("settings.server.connected.workspaceNone")}
  <div class="flex items-center gap-2 mb-1.5">
    <span class="font-serif text-base text-char">{t("settings.server.title")}</span>
    <span class="text-2xs px-1.5 py-px bg-yelp text-yeld rounded-full">{t("settings.server.connected")}</span>
    {#if server.insecure_skip_tls_verify}
      <span
        class="text-2xs px-1.5 py-px bg-red-500/10 text-red-500 rounded-full"
        title={t("settings.server.tlsInsecureTitle")}
      >
        {t("settings.server.tlsInsecure")}
      </span>
    {/if}
  </div>
  <div class="text-xs text-t2 leading-relaxed mb-3 space-y-0.5">
    <div>
      <span class="text-t3">{t("settings.server.connected.serverLabel")}</span>{" "}
      <span class="text-char font-mono">{server.server_url}</span>
    </div>
    <div>
      <span class="text-t3">{t("settings.server.connected.signedInAs")}</span>{" "}
      <span class="text-char">{server.email}</span>
    </div>
    <div>
      <span class="text-t3">{t("settings.server.connected.tokenLabel")}</span>{" "}
      <span class="text-char">{connectedLabel}</span>
      {#if server.pat_id}
        <span class="text-t3">{t("settings.server.connected.tokenIdSuffix", { id: server.pat_id.slice(0, 8) })}</span>
      {:else}
        <span class="text-t3">{t("settings.server.connected.tokenPasted")}</span>
      {/if}
    </div>
    <div>
      <span class="text-t3">{t("settings.server.connected.workspaceLabel")}</span>{" "}
      <span class="text-char">{workspaceOnServerLabel}</span>
    </div>
  </div>
  <div class="flex items-center gap-2 flex-wrap">
    <button
      type="button"
      onclick={serverRunSync}
      disabled={serverConnectedBusy !== null}
      class="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-50"
    >
      {serverConnectedBusy === "sync" ? t("settings.server.connected.syncing") : t("settings.server.connected.syncNow")}
    </button>
    <button
      type="button"
      onclick={() => serverDisconnect(false)}
      disabled={serverConnectedBusy !== null}
      class="px-3 py-1.5 text-xs bg-s2 text-ch2 rounded-md hover:bg-s3 disabled:opacity-50"
    >
      {serverConnectedBusy === "disconnect" ? t("settings.server.connected.disconnecting") : t("settings.server.connected.disconnect")}
    </button>
    {#if server.pat_id}
      <button
        type="button"
        onclick={() => serverDisconnect(true)}
        disabled={serverConnectedBusy !== null}
        class="px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-md disabled:opacity-50"
      >
        {serverConnectedBusy === "revoke" ? t("settings.server.connected.revoking") : t("settings.server.connected.revoke")}
      </button>
    {/if}
  </div>
  {#if serverConnectedErr}
    <div class="text-2xs text-red-500 mt-2 leading-relaxed">{serverConnectedErr}</div>
  {/if}
  {#if !config?.sync.server?.workspace_id}
    <p class="text-2xs text-t3 mt-2 leading-relaxed">
      {t("settings.server.connected.firstSyncNote.before")}
      <span class="text-char">"{server.workspace_name ?? config?.workspace.name ?? ""}"</span>
      {t("settings.server.connected.firstSyncNote.after")}
    </p>
  {/if}
  {#if serverSyncMsg}
    <div class={`text-2xs mt-2 leading-relaxed ${serverSyncOk ? "text-char" : "text-red-500"}`}>
      {serverSyncMsg}
    </div>
  {/if}
  {#if serverSyncConflicts.length > 0}
    <div class="mt-2 p-2.5 rounded-sm bg-gold/10 border border-gold/30 text-2xs leading-relaxed">
      <div class="text-char font-medium mb-1">
        {t(
          serverSyncConflicts.length === 1
            ? "settings.server.connected.conflict.title"
            : "settings.server.connected.conflict.titlePlural",
          { count: String(serverSyncConflicts.length) },
        )}
      </div>
      <div class="text-t2 mb-2">{t("settings.server.connected.conflict.body")}</div>
      <ul class="space-y-0.5 text-t2 font-mono">
        {#each serverSyncConflicts as c (c.path)}
          <li>
            <span class="text-char">{c.path}</span>
            {#if c.copy_path}
              {" "}{t("settings.server.connected.conflict.savedAs")} <span class="text-yel">{c.copy_path}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
{/snippet}

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-char/30 animate-fadeIn"
    onmousedown={onClose}
  >
    <div
      class="settings-modal-root w-[1040px] max-w-[94vw] h-[760px] max-h-[94vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden flex animate-slideUp relative font-sans"
      style:font-family="var(--ui-font-family), Inter Tight, Inter, ui-sans-serif, system-ui, sans-serif"
      onmousedown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="absolute top-3 right-3 z-10">
        <button
          type="button"
          onclick={onClose}
          aria-label={t("settings.closeAria")}
          title={t("settings.closeTitle")}
          class="w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-char hover:bg-s2 transition"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M 3 3 L 11 11 M 11 3 L 3 11" />
          </svg>
        </button>
      </div>

      <aside class="w-[240px] shrink-0 bg-s1 border-r border-bd py-3 flex flex-col">
        <div class="px-3 pb-3">
          <div class="font-serif text-xl text-char px-1.5 mb-2">{t("settings.title")}</div>
          <input
            type="text"
            bind:value={query}
            placeholder={t("settings.searchPlaceholder")}
            class="w-full px-2.5 py-1.5 bg-bg border border-bd rounded-md text-char text-xs placeholder:text-t3 focus:outline-hidden focus:border-yel"
          />
        </div>
        <nav class="flex-1 overflow-y-auto px-2 pb-3">
          {#each groups as group, idx (group.labelKey)}
            <div class={idx === 0 ? "" : "mt-3"}>
              <div class="px-2 pt-1 pb-1 text-2xs uppercase tracking-[0.08em] text-t3 font-medium">
                {t(group.labelKey)}
              </div>
              {#each group.tabs as tabKey (tabKey)}
                {@const isSelected = !query && tab === tabKey}
                <button
                  type="button"
                  onclick={() => setTab(tabKey)}
                  class={`w-full text-left rounded-md px-2 py-1.5 text-sm transition flex items-center gap-2.5 ${
                    isSelected
                      ? "bg-yelp text-yeld"
                      : "text-t2 hover:bg-s2 hover:text-char"
                  }`}
                >
                  <span class="shrink-0 w-4 h-4 flex items-center justify-center {isSelected ? '' : 'text-t3'}">
                    {@render tabIcon(tabKey)}
                  </span>
                  <span class="truncate">{tabLabels[tabKey]}</span>
                </button>
              {/each}
            </div>
          {/each}
        </nav>
      </aside>

      <section class="flex-1 min-w-0 overflow-y-auto px-10 py-9 yarrow-paint-island yarrow-gpu-scroll">
        {#if searchByTab}
          {#if searchByTab.length === 0}
            <div class="text-sm text-t3 italic">
              {t("settings.search.empty", { query })}
            </div>
          {:else}
            {@const total = searchResults!.length}
            <div class="text-2xs uppercase tracking-wider text-t3 font-semibold mb-3">
              {t(
                total === 1
                  ? "settings.search.resultsCount"
                  : "settings.search.resultsCountPlural",
                { count: String(total), query },
              )}
            </div>
            <div class="space-y-5">
              {#each searchByTab as [tabKey, rows] (tabKey)}
                <div>
                  <div class="text-xs text-t3 font-mono uppercase tracking-wider mb-1.5">
                    {tabLabels[tabKey]}
                  </div>
                  <ul class="border border-bd rounded-md overflow-hidden divide-y divide-bd/60">
                    {#each rows as r (`${r.tab}/${r.labelKey}`)}
                      <li>
                        <button
                          type="button"
                          onclick={() => pickSearchTab(r.tab)}
                          class="w-full text-left px-3 py-2.5 hover:bg-s2 transition flex items-baseline gap-3"
                        >
                          <span class="text-sm text-char flex-1">{t(r.labelKey)}</span>
                          {#if r.sublabelKey}
                            <span class="text-2xs text-t3 truncate max-w-[200px]">{t(r.sublabelKey)}</span>
                          {/if}
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          {#if tab === "mode"}{@render modePane()}{/if}
          {#if tab === "appearance"}{@render appearancePane()}{/if}
          {#if tab === "accessibility"}{@render accessibilityPane()}{/if}
          {#if tab === "writing" && config}{@render writingPane()}{/if}
          {#if tab === "gestures"}{@render gesturesPane()}{/if}
          {#if tab === "guidance"}{@render guidancePane()}{/if}
          {#if tab === "sync" && config}{@render syncPane()}{/if}
          {#if tab === "workspace" && config}{@render workspacePane()}{/if}
          {#if tab === "templates"}{@render templatesPane()}{/if}
          {#if tab === "storage" && !!config?.sync?.server?.workspace_id}{@render storagePane()}{/if}
          {#if tab === "security" && config}{@render securityPane()}{/if}
          {#if tab === "shortcuts"}{@render shortcutsPane()}{/if}
          {#if tab === "help"}{@render helpPane()}{/if}
          {#if tab === "about"}{@render aboutPane()}{/if}
        {/if}
      </section>
    </div>
  </div>

  <!-- Reset confirmation modals (top-level so they overlay tab content) -->
  <Modal
    open={resetA11yConfirmOpen}
    onClose={() => (resetA11yConfirmOpen = false)}
    title={t("settings.about.resetA11y.confirmTitle")}
    width="w-[440px]"
  >
    {#snippet children()}
      <p class="text-sm text-t2 mb-4 leading-relaxed">
        {t("settings.about.resetA11y.confirmBody")}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm text-t2 hover:text-char"
          onclick={() => (resetA11yConfirmOpen = false)}
        >
          {t("settings.about.reset.cancel")}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
          onclick={resetA11yConfirm}
        >
          {t("settings.about.resetA11y.confirmBtn")}
        </button>
      </div>
    {/snippet}
  </Modal>

  <Modal
    open={resetAllConfirmOpen}
    onClose={() => (resetAllConfirmOpen = false)}
    title={t("settings.about.reset.confirmTitle")}
    width="w-[440px]"
  >
    {#snippet children()}
      <p class="text-sm text-t2 mb-4 leading-relaxed">
        {t("settings.about.reset.confirmBody")}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm text-t2 hover:text-char"
          onclick={() => (resetAllConfirmOpen = false)}
        >
          {t("settings.about.reset.cancel")}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
          onclick={resetAllConfirm}
        >
          {t("settings.about.reset.confirmBtn")}
        </button>
      </div>
    {/snippet}
  </Modal>
{/if}

<style>
  /* Obsidian-faithful button & dropdown styling for the right pane of
     Settings. Three principles from studying their CSS:
     1. Buttons are FLAT colour fills, not gradients. The "raised" feel
        comes from a 0.5 px inset highlight at the top + a 1 px drop
        shadow underneath, never a top-to-bottom gradient.
     2. Selects use the same chrome as buttons plus a hand-rolled
        chevron via background-image (native chevron is suppressed with
        appearance: none).
     3. Border-radius is small (5–6 px), padding is compact (~4 px ×
        12 px), and the hover state lifts background colour by one
        surface step (s2 → s3) rather than brightening with a filter.

     Excluded: aria-pressed toggles (already pill-shaped), tab-role
     items (sidebar nav), .btn-yel CTA buttons (which we restyle to
     match Obsidian's accent CTA below), and rounded-full pills (chip
     filters). `:global(...)` is required because Svelte scopes styles
     and we're targeting bare html elements + utility-classed buttons. */
  :global(.settings-modal-root section button:not([aria-pressed]):not([role="tab"]):not(.btn-yel):not([class*="rounded-full"])),
  :global(.settings-modal-root section select) {
    background-color: var(--s2);
    color: var(--char);
    border: 1px solid var(--bd2);
    border-radius: 5px;
    padding: 4px 12px;
    font-size: 13px;
    line-height: 1.4;
    box-shadow:
      inset 0 0.5px 0 0 rgba(255, 255, 255, 0.07),
      0 1px 1px 0 rgba(0, 0, 0, 0.08);
    transition: background-color 100ms, box-shadow 100ms, border-color 100ms;
    cursor: pointer;
  }
  :global(.settings-modal-root section button:not([aria-pressed]):not([role="tab"]):not(.btn-yel):not([class*="rounded-full"]):hover),
  :global(.settings-modal-root section select:hover) {
    background-color: var(--s3);
    border-color: var(--bd3);
  }
  :global(.settings-modal-root section button:not([aria-pressed]):not([role="tab"]):not(.btn-yel):not([class*="rounded-full"]):active),
  :global(.settings-modal-root section select:active) {
    background-color: var(--s2);
    box-shadow: inset 0 1px 1.5px 0 rgba(0, 0, 0, 0.18);
  }
  :global(.settings-modal-root section button:not([aria-pressed]):not([role="tab"]):not(.btn-yel):not([class*="rounded-full"]):focus-visible),
  :global(.settings-modal-root section select:focus-visible) {
    outline: none;
    border-color: var(--yel);
    box-shadow:
      inset 0 0.5px 0 0 rgba(255, 255, 255, 0.07),
      0 0 0 2px color-mix(in srgb, var(--yel) 35%, transparent);
  }

  /* Selects: replace native chevron with an inline SVG so the arrow
     respects the theme. The SVG is encoded with `currentColor` and
     painted by setting fill on the select itself. Padding-right is
     bumped to leave room for the chevron. */
  :global(.settings-modal-root section select) {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 28px;
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10' fill='none' stroke='%23999' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 4l3 3 3-3'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 10px;
  }

  /* Destructive buttons (delete, reset, disable encryption, revoke
     token, etc.). Override the neutral generic styling above so red
     stays red. We target two existing patterns the codebase uses:
     `.bg-danger` (the explicit danger fill) and `.text-danger` /
     [class*="text-red"] (text-only red action like "Revoke token").
     Specificity beats the generic rule because we add the class
     selector. */
  :global(.settings-modal-root section button.bg-danger) {
    background-color: var(--danger);
    color: var(--bg);
    border: 1px solid color-mix(in srgb, var(--danger) 70%, black);
    border-radius: 5px;
    padding: 4px 14px;
    font-size: 13px;
    line-height: 1.4;
    box-shadow:
      inset 0 0.5px 0 0 rgba(255, 255, 255, 0.18),
      0 1px 1.5px 0 rgba(0, 0, 0, 0.18);
    transition: background-color 100ms, box-shadow 100ms;
    cursor: pointer;
  }
  :global(.settings-modal-root section button.bg-danger:hover) {
    background-color: color-mix(in srgb, var(--danger) 88%, white);
  }
  :global(.settings-modal-root section button.bg-danger:active) {
    box-shadow: inset 0 1px 1.5px 0 rgba(0, 0, 0, 0.22);
  }
  :global(.settings-modal-root section button.text-danger),
  :global(.settings-modal-root section button[class*="text-red"]) {
    background-color: transparent;
    color: var(--danger);
    border: 1px solid transparent;
    border-radius: 5px;
    padding: 4px 12px;
    font-size: 13px;
    line-height: 1.4;
    box-shadow: none;
    transition: background-color 100ms, border-color 100ms;
    cursor: pointer;
  }
  :global(.settings-modal-root section button.text-danger:hover),
  :global(.settings-modal-root section button[class*="text-red"]:hover) {
    background-color: color-mix(in srgb, var(--danger) 12%, transparent);
    border-color: color-mix(in srgb, var(--danger) 35%, transparent);
  }

  /* Accent CTA buttons (Obsidian's .mod-cta equivalent) — solid accent
     fill, white text, same shadow chrome so the affordance language
     matches the neutral buttons. */
  :global(.settings-modal-root section .btn-yel) {
    background-color: var(--yel);
    color: var(--on-yel);
    border: 1px solid color-mix(in srgb, var(--yel) 70%, black);
    border-radius: 5px;
    padding: 4px 14px;
    font-size: 13px;
    line-height: 1.4;
    box-shadow:
      inset 0 0.5px 0 0 rgba(255, 255, 255, 0.18),
      0 1px 1.5px 0 rgba(0, 0, 0, 0.18);
    transition: background-color 100ms, box-shadow 100ms;
    cursor: pointer;
  }
  :global(.settings-modal-root section .btn-yel:hover) {
    background-color: var(--yel2);
  }
  :global(.settings-modal-root section .btn-yel:active) {
    box-shadow: inset 0 1px 1.5px 0 rgba(0, 0, 0, 0.22);
  }
</style>
