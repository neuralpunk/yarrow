import { useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../lib/tauri";
import type { NoteSummary, TemplateInfo, WorkspaceConfig } from "../lib/types";
import MainNotePrompt from "./MainNotePrompt";
import { useTheme, ThemeMode, THEME_ORDER, THEME_LABELS } from "../lib/theme";
import {
  useShowRawMarkdown,
  useEditorFont,
  EDITOR_FONTS,
  useTypewriterMode,
  useEditorialReading,
  usePathTintedCaret,
  useCookMode,
} from "../lib/editorPrefs";
import {
  EXTRAS,
  useExtraCodeHighlight,
  useExtraImagePreview,
  useExtraMath,
  useExtraRadialMenu,
  useExtraCooking,
  useExtraSpell,
  type ExtraKey,
} from "../lib/extraPrefs";
import {
  BINDABLE_ACTIONS,
  getDefaultBinding,
  resetGestureBindings,
  useGestureBinding,
  type GestureSlot,
} from "../lib/gesturePrefs";
import type { CenterActionId } from "./Editor/center/actions";
import { useUiFont, UI_FONTS, type UiFontId, useUiScale, UI_SCALES, type UiScaleId } from "../lib/uiPrefs";
import { usePersonality, PERSONALITIES, type PersonalityId } from "../lib/personalityPrefs";
import { usePaperTexture, PAPER_TEXTURES, type PaperTextureId, usePaperWarmth } from "../lib/paperPrefs";
import { useLanguage, LANGUAGE_ORDER, type LanguageCode } from "../lib/language";
import { useT } from "../lib/i18n";
import { SunIcon, MoonIcon, AutoThemeIcon } from "../lib/icons";
import { SK } from "../lib/platform";
import { APP_VERSION } from "../lib/version";
import Modal from "./Modal";
import { useGuidance } from "../lib/guidanceStore";

type Tab =
  | "appearance"
  | "writing"
  | "gestures"
  | "guidance"
  | "sync"
  | "storage"
  | "templates"
  | "security"
  | "workspace"
  | "shortcuts"
  | "about";

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

export default function Settings({
  open,
  initialTab,
  onClose,
  workspacePath,
  config,
  onConfigChange,
  onSyncNow,
  onCloseWorkspace,
  onImport,
}: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(initialTab ?? "appearance");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) {
      setTab(initialTab ?? "appearance");
      setQuery("");
    }
  }, [open, initialTab]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tabLabels: Record<Tab, string> = {
    appearance: t("settings.tabs.appearance"),
    writing: t("settings.tabs.writing"),
    gestures: t("settings.tabs.gestures"),
    guidance: t("settings.tabs.guidance"),
    templates: t("settings.tabs.templates"),
    sync: t("settings.tabs.sync"),
    storage: t("settings.tabs.storage"),
    security: t("settings.tabs.security"),
    workspace: t("settings.tabs.workspace"),
    shortcuts: t("settings.tabs.shortcuts"),
    about: t("settings.tabs.about"),
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-char/30 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-[860px] max-w-[94vw] h-[600px] max-h-[92vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden flex animate-slideUp relative"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("settings.closeAria")}
          title={t("settings.closeTitle")}
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-char hover:bg-s2 transition"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M 3 3 L 11 11 M 11 3 L 3 11" />
          </svg>
        </button>
        <aside className="w-[180px] shrink-0 bg-s1 border-r border-bd py-3 flex flex-col">
          <div className="px-3 pb-3 border-b border-bd">
            <div className="font-serif text-xl text-char px-1">{t("settings.title")}</div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("settings.searchPlaceholder")}
              className="mt-2 w-full px-2.5 py-1.5 bg-bg border border-bd rounded-md text-char text-xs placeholder:text-t3 focus:outline-none focus:border-yel"
            />
            <div className="text-2xs text-t3 mt-1.5 px-1">{t("settings.escToClose")}</div>
          </div>
          <nav className="flex-1 pt-2">
            <NavTabs tab={tab} query={query} setTab={setTab} setQuery={setQuery} tabLabels={tabLabels} config={config} />
          </nav>
        </aside>

        <section className="flex-1 min-w-0 overflow-y-auto p-6 yarrow-paint-island yarrow-gpu-scroll">
          {query.trim() ? (
            <SearchResults
              query={query.trim()}
              tabLabels={tabLabels}
              onPick={(tabKey) => { setTab(tabKey); setQuery(""); }}
            />
          ) : (
            <>
              {tab === "appearance" && <AppearancePane />}
              {tab === "writing" && config && (
                <WritingPane config={config} onConfigChange={onConfigChange} />
              )}
              {tab === "gestures" && <GesturesPane />}
              {tab === "guidance" && <GuidancePane />}
              {tab === "sync" && config && (
                <SyncPane
                  config={config}
                  onConfigChange={onConfigChange}
                  onSyncNow={onSyncNow}
                />
              )}
              {tab === "workspace" && config && (
                <WorkspacePane
                  workspacePath={workspacePath}
                  config={config}
                  onConfigChange={onConfigChange}
                  onCloseWorkspace={onCloseWorkspace}
                  onImport={onImport}
                />
              )}
              {tab === "templates" && <TemplatesPane />}
              {tab === "storage" && !!config?.sync?.server?.workspace_id && <StoragePane />}
              {tab === "security" && config && (
                <SecurityPane config={config} onConfigChange={onConfigChange} />
              )}
              {tab === "shortcuts" && <ShortcutsPane />}
              {tab === "about" && <AboutPane />}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// Nav strip — pulls the radial-menu extra so the Gestures tab only
// surfaces when the radial is actually enabled, and the workspace's
// sync server config so the Storage tab is hidden when the user
// hasn't connected to a Yarrow Sync server yet (storage tooling is
// only meaningful in that context — local-only workspaces have
// nothing to clean up server-side).
function NavTabs({
  tab,
  query,
  setTab,
  setQuery,
  tabLabels,
  config,
}: {
  tab: Tab;
  query: string;
  setTab: (t: Tab) => void;
  setQuery: (q: string) => void;
  tabLabels: Record<Tab, string>;
  config: WorkspaceConfig | null;
}) {
  const [radialOn] = useExtraRadialMenu();
  const serverConnected = !!config?.sync?.server?.workspace_id;
  const tabOrder: Tab[] = [
    "appearance",
    "writing",
    ...(radialOn ? (["gestures"] as Tab[]) : []),
    "guidance",
    "templates",
    "sync",
    ...(serverConnected ? (["storage"] as Tab[]) : []),
    "security",
    "workspace",
    "shortcuts",
    "about",
  ];
  return (
    <>
      {tabOrder.map((tabKey) => (
        <button
          key={tabKey}
          onClick={() => { setTab(tabKey); setQuery(""); }}
          className={`w-full text-left px-4 py-2 text-sm transition ${
            !query && tab === tabKey
              ? "bg-s3 text-char border-l-2 border-yel pl-[14px]"
              : "text-t2 hover:bg-s2 hover:text-char"
          }`}
        >
          {tabLabels[tabKey]}
        </button>
      ))}
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="font-serif text-xl text-char mb-1">{title}</div>
      {hint && <div className="text-xs text-t2 mb-4 leading-relaxed">{hint}</div>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-6 py-2 border-b border-bd/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-char">{label}</div>
        {hint && <div className="text-2xs text-t2 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─────────────── search ───────────────

// Static index of searchable settings rows. Keywords are intentionally
// loose — we only need "does any one of these match a typed word" as a
// fallback for people who don't know the exact label Yarrow uses. The
// label and sublabel are translation keys resolved by SearchResults.
type SettingsKey =
  Parameters<ReturnType<typeof useT>>[0];

interface SettingEntry {
  tab: Tab;
  labelKey: SettingsKey;
  sublabelKey?: SettingsKey;
  keywords?: string[];
}

const SETTINGS_INDEX: SettingEntry[] = [
  { tab: "appearance", labelKey: "settings.search.appearance.theme.label", sublabelKey: "settings.search.appearance.theme.sublabel", keywords: ["color", "mode", "dark", "light", "ashrose", "rose"] },
  { tab: "appearance", labelKey: "settings.search.appearance.size.label", sublabelKey: "settings.search.appearance.size.sublabel", keywords: ["scale", "zoom", "chrome"] },
  { tab: "appearance", labelKey: "settings.search.appearance.font.label", sublabelKey: "settings.search.appearance.font.sublabel", keywords: ["font", "typography", "ui", "inter", "georgia", "serif", "merriweather"] },

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

function SearchResults({
  query,
  tabLabels,
  onPick,
}: {
  query: string;
  tabLabels: Record<Tab, string>;
  onPick: (t: Tab) => void;
}) {
  const t = useT();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = SETTINGS_INDEX.filter((entry) => {
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

  if (results.length === 0) {
    return (
      <div className="text-sm text-t3 italic">
        {t("settings.search.empty", { query })}
      </div>
    );
  }
  // Group by tab so results stay legible even with many matches.
  const byTab = new Map<Tab, SettingEntry[]>();
  for (const r of results) {
    if (!byTab.has(r.tab)) byTab.set(r.tab, []);
    byTab.get(r.tab)!.push(r);
  }
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-t3 font-semibold mb-3">
        {t(
          results.length === 1
            ? "settings.search.resultsCount"
            : "settings.search.resultsCountPlural",
          { count: String(results.length), query },
        )}
      </div>
      <div className="space-y-5">
        {Array.from(byTab.entries()).map(([tabKey, rows]) => (
          <div key={tabKey}>
            <div className="text-xs text-t3 font-mono uppercase tracking-wider mb-1.5">
              {tabLabels[tabKey]}
            </div>
            <ul className="border border-bd rounded-md overflow-hidden divide-y divide-bd/60">
              {rows.map((r) => (
                <li key={`${r.tab}/${r.labelKey}`}>
                  <button
                    onClick={() => onPick(r.tab)}
                    className="w-full text-left px-3 py-2.5 hover:bg-s2 transition flex items-baseline gap-3"
                  >
                    <span className="text-sm text-char flex-1">{t(r.labelKey)}</span>
                    {r.sublabelKey && (
                      <span className="text-2xs text-t3 truncate max-w-[200px]">{t(r.sublabelKey)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────── appearance ───────────────

function themeIcon(m: ThemeMode) {
  switch (m) {
    case "light":     return <SunIcon size={13} />;
    case "dark":      return <MoonIcon size={13} />;
    case "auto":      return <AutoThemeIcon size={13} />;
    case "ashrose":   return <AshroseIcon size={13} />;
  }
}

// Tiny preview swatch for each palette. 2.1 revised:
//   Light   — Linen & Gold     (F6F1E6 · EAE2CE · B38230)
//   Dark    — Cool Charcoal    (161819 · 1D1F20 · C08BA8)
//   Ashrose — Dusty rose paper (F1DDE2 · C6ABAF · 5C2E38)
function ThemePreview({ mode }: { mode: ThemeMode }) {
  const swatches = (() => {
    switch (mode) {
      case "light":     return ["#F6F1E6", "#EAE2CE", "#B38230"];
      case "dark":      return ["#161819", "#1D1F20", "#C08BA8"];
      case "auto":      return ["#F6F1E6", "#161819", "#B38230"];
      case "ashrose":   return ["#F1DDE2", "#C6ABAF", "#5C2E38"];
    }
  })();
  return (
    <div className="flex -space-x-1">
      {swatches.map((c, i) => (
        <span
          key={i}
          className="w-3.5 h-3.5 rounded-full border border-bd"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

// Ashrose icon — a small rose silhouette, drawn with the same stroke
// language as the Sun / Moon / Auto icons. Hand-rolled rather than
// pulled from `lib/icons` to keep the icon library uncluttered.
function AshroseIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 4.2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" />
      <path d="M8 8.2c-1 .8-2 .8-2.5 0" />
      <path d="M8 8.2c1 .8 2 .8 2.5 0" />
      <path d="M8 4.2c-.6-.7-.6-1.7 0-2.4" />
      <path d="M8 4.2c.6-.7.6-1.7 0-2.4" />
      <path d="M8 13.5c-3-1.4-5-4-5-7" />
    </svg>
  );
}

function AppearancePane() {
  const { mode, setMode } = useTheme();
  const t = useT();
  return (
    <Section
      title={t("settings.appearance.title")}
      hint={t("settings.appearance.hint")}
    >
      <div>
        <div className="text-sm text-char mb-1">{t("settings.appearance.theme")}</div>
        <div className="text-2xs text-t2 mb-3">
          {t("settings.appearance.themeHint")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEME_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition ${
                mode === m
                  ? "border-yel bg-yelp text-char"
                  : "border-bd bg-bg text-t2 hover:text-char hover:border-bd2"
              }`}
            >
              <ThemePreview mode={m} />
              <span className="inline-flex items-center gap-1.5 text-xs">
                {themeIcon(m)}
                <span>{THEME_LABELS[m]}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <LanguageRow />
      <PersonalityRow />
      <PaperAndWarmthRow />
      <UiScaleRow />
      <UiFontPicker />
    </Section>
  );
}

/// 2.1 i18n. Reads the global UI-language preference and offers each
/// shipped locale as a tile. Endonyms display so a speaker can find
/// their language without first reading English; the optional `note`
/// disambiguates regional variants (e.g. "Latinoamericano" for the
/// Spanish bundle).
function LanguageRow() {
  const { lang, setLang } = useLanguage();
  const t = useT();
  return (
    <div className="pt-4 mt-2 border-t border-bd">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm text-char">{t("settings.appearance.language")}</div>
        <div className="text-2xs text-t3 font-mono">ui · interface</div>
      </div>
      <div className="text-2xs text-t3 mb-3 leading-relaxed">
        {t("settings.appearance.languageHint")}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {LANGUAGE_ORDER.map((l) => {
          const active = l.id === lang;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id as LanguageCode)}
              className={`tile-press w-full text-left rounded-lg border p-2.5 transition ${
                active
                  ? "border-yel bg-yelp"
                  : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
              }`}
              aria-pressed={active}
            >
              <div className="text-[15px] text-char leading-tight">{l.label}</div>
              {l.note && (
                <div className="text-xs text-t2 mt-1 leading-snug">{l.note}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PersonalityRow() {
  const [current, setPersonality] = usePersonality();
  // Show `custom` only when active — it's not something to aspire to.
  const tiles = PERSONALITIES.filter((p) => p.id !== "custom" || current.id === "custom");
  return (
    <div className="pt-4 mt-2 border-t border-bd">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm text-char">Font personality</div>
        <div className="text-2xs text-t3 font-mono">a voice for the whole workspace</div>
      </div>
      <div className="text-2xs text-t3 mb-3 leading-relaxed">
        Each personality picks an interface font, an editor font, and a density
        that read well together. Hand-tuning any of them drops you into Custom.
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((p) => {
          const active = p.id === current.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPersonality(p.id as PersonalityId)}
              className={`tile-press w-full text-left rounded-lg border p-2.5 transition ${
                active
                  ? "border-yel bg-yelp"
                  : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
              }`}
            >
              <div className="text-[15px] text-char leading-tight">{p.label}</div>
              <div className="text-xs text-t2 mt-1 leading-snug">{p.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PaperAndWarmthRow() {
  const [texture, setTexture] = usePaperTexture();
  const [warmth, setWarmth] = usePaperWarmth();
  return (
    <div className="pt-4 mt-2 border-t border-bd">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm text-char">Paper &amp; warmth</div>
        <div className="text-2xs text-t3 font-mono">surface texture · hue</div>
      </div>
      <div className="text-2xs text-t3 mb-3 leading-relaxed">
        Six subtle paper textures, and a slider that gently warms or cools the
        page. The editor's prose contrast is unaffected — only the surrounding
        paper shifts.
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {PAPER_TEXTURES.map((t) => {
          const active = t.id === texture.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTexture(t.id as PaperTextureId)}
              className={`tile-press relative rounded-md border px-3 py-3 text-left transition overflow-hidden ${
                active ? "border-yel" : "border-bd hover:border-bd2"
              }`}
              style={{
                // Preview the texture on the tile itself so the visual
                // pattern is the label. Cream renders flat paper only.
                backgroundColor: t.id === "dusk" ? "#2A2520" : "var(--bg)",
                backgroundImage: t.css === "none" ? "none" : t.css,
                backgroundSize: t.id === "ledger" ? "100% 11px" : "8px 8px",
                color: t.id === "dusk" ? "#F0E6CF" : undefined,
              }}
            >
              <div className={`text-xs leading-tight ${active ? "text-char" : "text-char"}`}
                   style={t.id === "dusk" ? { color: "#F0E6CF" } : undefined}>
                {t.label}
              </div>
              <div className={`text-2xs mt-1 leading-tight ${t.id === "dusk" ? "" : "text-t3"}`}
                   style={t.id === "dusk" ? { color: "#c7bd9f" } : undefined}>
                {t.description}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-xs text-char">Warmth</div>
        <div className="text-2xs text-t3 font-mono">
          {warmth === 0 ? "neutral" : (warmth > 0 ? `+${warmth} K` : `${warmth} K`)}
        </div>
      </div>
      <input
        type="range"
        min={-300}
        max={300}
        step={20}
        value={warmth}
        onChange={(e) => setWarmth(parseInt(e.target.value, 10))}
        className="w-full accent-yel"
      />
      <div className="flex items-center justify-between text-2xs text-t3 mt-1">
        <span>cool (6500 K)</span>
        <button
          type="button"
          onClick={() => setWarmth(0)}
          className="text-t3 hover:text-char underline-offset-2 hover:underline"
        >
          reset
        </button>
        <span>warm (3200 K)</span>
      </div>
    </div>
  );
}

function UiScaleRow() {
  const [current, setScale] = useUiScale();
  return (
    <div className="pt-4 mt-2 border-t border-bd">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm text-char">Interface size</div>
        <div className="text-2xs text-t3 font-mono">editor ignores this</div>
      </div>
      <div className="text-2xs text-t3 mb-3 leading-relaxed">
        Scales the sidebars, toolbar, and chrome. Your editor font size stays
        wherever you set it under Writing.
      </div>
      <div className="grid grid-cols-3 gap-2">
        {UI_SCALES.map((s) => {
          const active = s.id === current.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setScale(s.id as UiScaleId)}
              className={`tile-press rounded-md border px-3 py-2 text-left transition ${
                active
                  ? "border-yel bg-yelp"
                  : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
              }`}
            >
              <div className="flex items-end gap-1.5">
                <span className="text-sm text-char leading-none">Aa</span>
                <span
                  className="text-char leading-none"
                  style={{ fontSize: `${s.zoom * 16}px` }}
                >
                  Aa
                </span>
              </div>
              <div className="text-xs text-char mt-2 leading-tight">{s.label}</div>
              <div className="text-2xs text-t3 leading-tight">{s.sublabel}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UiFontPicker() {
  const [current, setFont] = useUiFont();
  return (
    <div className="pt-4 mt-2 border-t border-bd">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm text-char">Interface font</div>
        <div className="text-2xs text-t3 font-mono">Applies to all chrome, not the editor</div>
      </div>
      <div className="text-2xs text-t3 mb-3 leading-relaxed">
        The default is a clean sans. Pick a serif to make the whole app feel
        more editorial — the editor keeps its own font (set under Writing).
      </div>
      <div className="grid grid-cols-2 gap-2">
        {UI_FONTS.map((f) => {
          const active = f.id === current.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFont(f.id as UiFontId)}
              className={`tile-press w-full text-left rounded-lg border p-2.5 ${
                active
                  ? "border-yel bg-yelp"
                  : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
              }`}
            >
              <div
                className="text-[15px] text-char leading-tight"
                style={{ fontFamily: f.stack }}
              >
                {f.label}
              </div>
              <div
                className="text-xs text-t2 mt-1 leading-snug"
                style={{ fontFamily: f.stack }}
              >
                {f.sample}
              </div>
              <div className="text-2xs text-t3 mt-1 uppercase tracking-wider">
                {f.kind}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────── writing ───────────────

function WritingPane({
  config,
  onConfigChange,
}: {
  config: WorkspaceConfig;
  onConfigChange: (cfg: WorkspaceConfig) => void;
}) {
  const t = useT();
  const [local, setLocal] = useState(config.preferences);
  const [saving, setSaving] = useState(false);
  useEffect(() => setLocal(config.preferences), [config]);

  const save = async (next: typeof local) => {
    setLocal(next);
    setSaving(true);
    try {
      const cfg = await api.updatePreferences(next);
      onConfigChange(cfg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Section
      title={t("settings.writing.title")}
      hint={t("settings.writing.hint")}
    >
      <Row
        label={t("settings.writing.autosave.label")}
        hint={t("settings.writing.autosave.hint")}
      >
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={500}
            max={8000}
            step={500}
            value={local.autocheckpoint_debounce_ms}
            onChange={(e) =>
              save({ ...local, autocheckpoint_debounce_ms: Number(e.target.value) })
            }
            className="w-40 accent-yel"
          />
          <span className="w-16 text-right text-xs font-mono text-t2">
            {t("settings.writing.autosave.seconds", {
              value: (local.autocheckpoint_debounce_ms / 1000).toFixed(1),
            })}
          </span>
        </div>
      </Row>

      <Row
        label={t("settings.writing.askThinking.label")}
        hint={t("settings.writing.askThinking.hint")}
      >
        <Toggle
          value={local.ask_thinking_on_close}
          onChange={(v) => save({ ...local, ask_thinking_on_close: v })}
        />
      </Row>

      <Row
        label={t("settings.writing.fade.label")}
        hint={t("settings.writing.fade.hint")}
      >
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={7}
            max={365}
            value={local.decay_days}
            onChange={(e) =>
              save({ ...local, decay_days: Number(e.target.value) })
            }
            className="w-40 accent-yel"
          />
          <span className="w-16 text-right text-xs font-mono text-t2">
            {t("settings.writing.fade.days", { value: String(local.decay_days) })}
          </span>
        </div>
      </Row>

      <Row
        label={t("settings.writing.editorSize.label")}
        hint={t("settings.writing.editorSize.hint")}
      >
        <select
          value={local.editor_font_size}
          onChange={(e) =>
            save({ ...local, editor_font_size: Number(e.target.value) })
          }
          className="px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs"
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
      </Row>

      <Row label={t("settings.writing.focusDefault.label")}>
        <Toggle
          value={local.focus_mode_default}
          onChange={(v) => save({ ...local, focus_mode_default: v })}
        />
      </Row>

      <Row
        label={t("settings.writing.fastSearch.label")}
        hint={t("settings.writing.fastSearch.hint")}
      >
        <Toggle
          value={local.search_index_enabled}
          onChange={(v) => save({ ...local, search_index_enabled: v })}
        />
      </Row>
      <ClearSearchIndexRow />

      <ShowRawMarkdownRow />

      <TypewriterModeRow />

      <EditorialReadingRow />

      <PathTintedCaretRow />

      {/* Cook mode is gated on the Cooking additions extra — when
          off, the row hides too so the Writing pane stays trim. */}
      <CookModeRowGated />

      <EditorFontRow />


      <div className="text-2xs text-t3 mt-2">
        {saving ? t("settings.writing.savingNow") : t("settings.writing.autosaveNote")}
      </div>
    </Section>
    <ExtrasSection />
    </>
  );
}

function TypewriterModeRow() {
  const t = useT();
  const [on, setOn] = useTypewriterMode();
  return (
    <Row
      label={t("settings.writing.typewriter.label")}
      hint={t("settings.writing.typewriter.hint")}
    >
      <Toggle value={on} onChange={setOn} />
    </Row>
  );
}

function EditorialReadingRow() {
  const t = useT();
  const [on, setOn] = useEditorialReading();
  return (
    <Row
      label={t("settings.writing.editorial.label")}
      hint={t("settings.writing.editorial.hint")}
    >
      <Toggle value={on} onChange={setOn} />
    </Row>
  );
}

function PathTintedCaretRow() {
  const t = useT();
  const [on, setOn] = usePathTintedCaret();
  return (
    <Row
      label={t("settings.writing.pathCaret.label")}
      hint={t("settings.writing.pathCaret.hint")}
    >
      <Toggle value={on} onChange={setOn} />
    </Row>
  );
}

// 2.2.0 round 2 — Cook mode now has a Settings home so users can flip
// it without learning the command-palette path. Gated on the Cooking
// additions extra so non-bakers don't see it.
function CookModeRowGated() {
  const [cookingOn] = useExtraCooking();
  if (!cookingOn) return null;
  return <CookModeRow />;
}

function CookModeRow() {
  const t = useT();
  const [on, setOn] = useCookMode();
  return (
    <Row
      label={t("settings.writing.cookMode.label")}
      hint={t("settings.writing.cookMode.hint")}
    >
      <Toggle value={on} onChange={setOn} />
    </Row>
  );
}

function ExtrasSection() {
  const t = useT();
  return (
    <Section
      title={t("settings.extras.title")}
      hint={t("settings.extras.hint")}
    >
      {EXTRAS.map((x) => (
        <ExtraRow key={x.key} extraKey={x.key} label={x.label} blurb={x.blurb} detail={x.detail} />
      ))}
    </Section>
  );
}

function ExtraRow({
  extraKey,
  label,
  blurb,
  detail,
}: {
  extraKey: ExtraKey;
  label: string;
  blurb: string;
  detail: string;
}) {
  // Each hook is bound to a specific key so TS knows the tuple shape;
  // we pick the right one via a Record so every ExtraKey is required —
  // TypeScript warns if a new key is added without a handler here (the
  // earlier if/else chain silently fell through to the last branch,
  // which once caused toggling slash commands to flip image preview).
  const code = useExtraCodeHighlight();
  const math = useExtraMath();
  const spell = useExtraSpell();
  const image = useExtraImagePreview();
  const radial = useExtraRadialMenu();
  const cooking = useExtraCooking();
  const lookup: Record<ExtraKey, [boolean, (v: boolean) => void]> = {
    codeHighlight: code,
    math,
    spell,
    imagePreview: image,
    radialMenu: radial,
    cooking,
  };
  const [value, setValue] = lookup[extraKey];
  return (
    <Row label={label} hint={blurb}>
      <div className="flex flex-col items-end gap-1">
        <Toggle value={value} onChange={setValue} />
        <div className="text-2xs text-t3 italic font-serif max-w-[280px] text-right leading-snug">
          {detail}
        </div>
      </div>
    </Row>
  );
}

function ShowRawMarkdownRow() {
  const t = useT();
  const [raw, setRaw] = useShowRawMarkdown();
  return (
    <Row
      label={t("settings.writing.rawMarkdown.label")}
      hint={t("settings.writing.rawMarkdown.hint")}
    >
      <Toggle value={raw} onChange={setRaw} />
    </Row>
  );
}

/** Paired button for the "Fast search indexing" toggle: drops the cache
 *  file and lets it rebuild on the next search. Confirms briefly after a
 *  successful clear so the user knows the click registered — the UI is
 *  otherwise silent because the cache is invisible by design. */
function ClearSearchIndexRow() {
  const t = useT();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");
  const onClear = async () => {
    setState("working");
    setMsg("");
    try {
      await api.clearSearchIndex();
      setState("done");
      setMsg(t("settings.writing.clearSearch.done"));
      window.setTimeout(() => { setState("idle"); setMsg(""); }, 3000);
    } catch (e) {
      setState("error");
      setMsg(String(e));
    }
  };
  return (
    <Row
      label={t("settings.writing.clearSearch.label")}
      hint={t("settings.writing.clearSearch.hint")}
    >
      <div className="flex items-center gap-2">
        {msg && (
          <span className={`text-2xs ${state === "error" ? "text-danger" : "text-t2"}`}>{msg}</span>
        )}
        <button
          onClick={onClear}
          disabled={state === "working"}
          className="px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs hover:bg-s2 disabled:opacity-50"
        >
          {state === "working" ? t("settings.writing.clearSearch.working") : t("settings.writing.clearSearch.button")}
        </button>
      </div>
    </Row>
  );
}

function EditorFontRow() {
  const t = useT();
  const [current, setFont] = useEditorFont();
  const serifs = EDITOR_FONTS.filter((f) => f.kind === "serif");
  const sanses = EDITOR_FONTS.filter((f) => f.kind === "sans");
  return (
    <div className="py-3 border-b border-bd">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm text-char">{t("settings.writing.editorFont.title")}</div>
        <div className="text-2xs text-t3 font-mono">{t("settings.writing.editorFont.tag")}</div>
      </div>
      <div className="text-2xs text-t3 mb-3 leading-relaxed">
        {t("settings.writing.editorFont.hint")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FontGroup title={t("settings.writing.editorFont.serif")} active={current.id} onPick={setFont} options={serifs} />
        <FontGroup title={t("settings.writing.editorFont.sans")} active={current.id} onPick={setFont} options={sanses} />
      </div>
    </div>
  );
}

function FontGroup({
  title,
  options,
  active,
  onPick,
}: {
  title: string;
  options: typeof EDITOR_FONTS;
  active: string;
  onPick: (id: typeof EDITOR_FONTS[number]["id"]) => void;
}) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-t3 font-semibold mb-1.5">
        {title}
      </div>
      <div className="space-y-1.5">
        {options.map((f) => {
          const isActive = f.id === active;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onPick(f.id)}
              className={`tile-press w-full text-left rounded-lg border p-2.5 ${
                isActive
                  ? "border-yel bg-yelp"
                  : "border-bd bg-bg hover:bg-s2/60 hover:border-bd2"
              }`}
            >
              <div
                className="text-base text-char leading-tight"
                style={{ fontFamily: f.stack }}
              >
                {f.label}
              </div>
              <div
                className="text-xs text-t2 mt-1 leading-snug"
                style={{ fontFamily: f.stack }}
              >
                {f.sample}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────── gestures ───────────────
//
// Three configurable slots on the radial centre (tap, long-press,
// double-tap), each bound to one named action. Plus a reset-to-
// defaults button that puts everything back to: tap → palette,
// long-press → quick hand, double-tap → focus mode.
//
// This pane is gated on the radial-menu extra at the nav level (see
// NavTabs above) — when the radial is off, the tab simply doesn't
// surface, so we don't need a "you must enable…" empty state here.

function GesturesPane() {
  const t = useT();
  const [tapBinding, setTapBinding] = useGestureBinding("tap");
  const [longPressBinding, setLongPressBinding] = useGestureBinding("longPress");
  const [doubleTapBinding, setDoubleTapBinding] = useGestureBinding("doubleTap");
  const [confirmReset, setConfirmReset] = useState(false);

  // Group actions for the dropdown's optgroups so a 12-entry list reads
  // as a small browseable map rather than a wall.
  const groupedActions = useMemo(() => {
    const groups: Record<string, typeof BINDABLE_ACTIONS> = {
      core: [],
      navigation: [],
      writing: [],
      system: [],
    };
    BINDABLE_ACTIONS.forEach((a) => groups[a.group].push(a));
    return groups;
  }, []);

  const isAtDefaults =
    tapBinding === getDefaultBinding("tap") &&
    longPressBinding === getDefaultBinding("longPress") &&
    doubleTapBinding === getDefaultBinding("doubleTap");

  const renderSelect = (
    slot: GestureSlot,
    value: CenterActionId,
    onChange: (v: CenterActionId) => void,
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CenterActionId)}
      className="w-full bg-bg border border-bd2 rounded-md px-3 py-2 text-sm text-char focus:outline-none focus:border-yel hover:border-yel transition"
      aria-label={t(`settings.gestures.slot.${slot}.label`)}
    >
      <optgroup label={t("settings.gestures.group.core")}>
        {groupedActions.core.map((a) => (
          <option key={a.id} value={a.id}>{t(a.i18nLabel)}</option>
        ))}
      </optgroup>
      <optgroup label={t("settings.gestures.group.navigation")}>
        {groupedActions.navigation.map((a) => (
          <option key={a.id} value={a.id}>{t(a.i18nLabel)}</option>
        ))}
      </optgroup>
      <optgroup label={t("settings.gestures.group.writing")}>
        {groupedActions.writing.map((a) => (
          <option key={a.id} value={a.id}>{t(a.i18nLabel)}</option>
        ))}
      </optgroup>
      <optgroup label={t("settings.gestures.group.system")}>
        {groupedActions.system.map((a) => (
          <option key={a.id} value={a.id}>{t(a.i18nLabel)}</option>
        ))}
      </optgroup>
    </select>
  );

  const blurbForBinding = (id: CenterActionId): string => {
    const a = BINDABLE_ACTIONS.find((x) => x.id === id);
    return a ? t(a.i18nBlurb) : "";
  };

  return (
    <>
      <Section
        title={t("settings.gestures.title")}
        hint={t("settings.gestures.hint")}
      >
        <GestureRow
          slotName={t("settings.gestures.slot.tap.label")}
          slotMeta={t("settings.gestures.slot.tap.meta")}
          select={renderSelect("tap", tapBinding, setTapBinding)}
          blurb={blurbForBinding(tapBinding)}
        />
        <GestureRow
          slotName={t("settings.gestures.slot.longPress.label")}
          slotMeta={t("settings.gestures.slot.longPress.meta")}
          select={renderSelect("longPress", longPressBinding, setLongPressBinding)}
          blurb={blurbForBinding(longPressBinding)}
          highlighted
        />
        <GestureRow
          slotName={t("settings.gestures.slot.doubleTap.label")}
          slotMeta={t("settings.gestures.slot.doubleTap.meta")}
          select={renderSelect("doubleTap", doubleTapBinding, setDoubleTapBinding)}
          blurb={blurbForBinding(doubleTapBinding)}
        />
      </Section>

      <Section title={t("settings.gestures.structural.title")} hint={t("settings.gestures.structural.hint")}>
        <div className="bg-s1 border border-bd rounded-md px-4 py-3 text-xs text-t2 leading-relaxed">
          <div className="flex items-start gap-3 mb-2">
            <span className="font-mono text-2xs uppercase tracking-wider text-yeld bg-yelp px-2 py-0.5 rounded-full mt-0.5 whitespace-nowrap">{t("settings.gestures.structural.dragOut.tag")}</span>
            <span>{t("settings.gestures.structural.dragOut.desc")}</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-2xs uppercase tracking-wider text-yeld bg-yelp px-2 py-0.5 rounded-full mt-0.5 whitespace-nowrap">{t("settings.gestures.structural.scroll.tag")}</span>
            <span>{t("settings.gestures.structural.scroll.desc")}</span>
          </div>
        </div>
      </Section>

      <div className="mt-6 pt-5 border-t border-bd flex items-center justify-between gap-4">
        <p className="text-xs text-t3 leading-relaxed flex-1">
          {isAtDefaults
            ? t("settings.gestures.reset.atDefaults")
            : t("settings.gestures.reset.modified")}
        </p>
        <button
          type="button"
          onClick={() => {
            if (isAtDefaults) return;
            setConfirmReset(true);
          }}
          disabled={isAtDefaults}
          className="px-3 py-1.5 text-sm border border-bd2 rounded-md text-char hover:border-yel hover:bg-yelp hover:text-yeld disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {t("settings.gestures.reset.btn")}
        </button>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t("settings.gestures.reset.confirmTitle")}
        width="w-[420px]"
      >
        <p className="text-sm text-t2 mb-4 leading-relaxed">
          {t("settings.gestures.reset.confirmBody")}
        </p>
        <div className="bg-bg-soft border border-bd rounded-md px-3 py-2.5 mb-5 text-xs space-y-1 font-mono text-t2">
          <div><span className="text-t3">tap </span>→ {BINDABLE_ACTIONS.find(a => a.id === getDefaultBinding("tap"))?.id}</div>
          <div><span className="text-t3">long-press </span>→ {BINDABLE_ACTIONS.find(a => a.id === getDefaultBinding("longPress"))?.id}</div>
          <div><span className="text-t3">double-tap </span>→ {BINDABLE_ACTIONS.find(a => a.id === getDefaultBinding("doubleTap"))?.id}</div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
          >
            {t("settings.gestures.reset.cancel")}
          </button>
          <button
            type="button"
            onClick={() => {
              resetGestureBindings();
              setConfirmReset(false);
            }}
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
          >
            {t("settings.gestures.reset.confirm")}
          </button>
        </div>
      </Modal>
    </>
  );
}

function GestureRow({
  slotName,
  slotMeta,
  select,
  blurb,
  highlighted,
}: {
  slotName: string;
  slotMeta: string;
  select: React.ReactNode;
  blurb: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[180px_1fr] gap-4 items-start py-3 ${highlighted ? "" : ""}`}>
      <div>
        <div className="font-serif text-base text-char">{slotName}</div>
        <div className="font-mono text-2xs uppercase tracking-wider text-t3 mt-0.5">{slotMeta}</div>
      </div>
      <div>
        {select}
        {blurb && <p className="text-xs text-t2 mt-1.5 leading-relaxed">{blurb}</p>}
      </div>
    </div>
  );
}

// ─────────────── guidance ───────────────

function GuidancePane() {
  const t = useT();
  const { enabled, setEnabled, reset } = useGuidance();
  return (
    <>
      <Section
        title={t("settings.guidance.title")}
        hint={t("settings.guidance.hint")}
      >
        <Row
          label={enabled ? t("settings.guidance.on") : t("settings.guidance.off")}
          hint={
            enabled
              ? t("settings.guidance.onHint")
              : t("settings.guidance.offHint")
          }
        >
          <Toggle value={enabled} onChange={setEnabled} />
        </Row>
      </Section>

      <Section
        title={t("settings.guidance.optouts.title")}
        hint={t("settings.guidance.optouts.hint")}
      >
        <Row label={t("settings.guidance.optouts.label")} hint={t("settings.guidance.optouts.subhint")}>
          <button
            onClick={() => reset()}
            className="px-3 py-1.5 text-sm rounded-md border border-bd hover:bg-s2 text-ch2 transition"
          >
            {t("settings.guidance.optouts.button")}
          </button>
        </Row>
      </Section>
    </>
  );
}

// ─────────────── sync ───────────────

function SyncPane({
  config,
  onConfigChange,
  onSyncNow,
}: {
  config: WorkspaceConfig;
  onConfigChange: (cfg: WorkspaceConfig) => void;
  onSyncNow: () => void;
}) {
  const t = useT();
  const [url, setUrl] = useState(config.sync.remote_url ?? "");
  const [remoteType, setRemoteType] = useState(config.sync.remote_type ?? "custom");
  const [token, setToken] = useState(config.sync.token ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setUrl(config.sync.remote_url ?? "");
    setRemoteType(config.sync.remote_type ?? "custom");
    setToken(config.sync.token ?? "");
  }, [config]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const cfg = await api.setRemote(url.trim(), remoteType, token.trim() || undefined);
      onConfigChange(cfg);
      setMsg(t("settings.sync.saved"));
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title={t("settings.sync.title")}
      hint={t("settings.sync.hint")}
    >
      <div>
        <label className="text-xs text-t2 block mb-1">{t("settings.sync.kind")}</label>
        <div className="flex gap-2">
          {["github", "gitea", "custom"].map((kind) => (
            <button
              key={kind}
              onClick={() => setRemoteType(kind)}
              className={`px-3 py-1.5 text-xs rounded border transition ${
                remoteType === kind
                  ? "border-yel bg-yelp text-yeld"
                  : "border-bd text-t2 hover:bg-s2 hover:text-char"
              }`}
            >
              {kind}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-t2 block mb-1">{t("settings.sync.repoUrl")}</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("settings.sync.repoUrlPlaceholder")}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
        />
      </div>

      <div>
        <label className="text-xs text-t2 block mb-1">
          {t("settings.sync.token.label")} <span className="text-t3">{t("settings.sync.token.optional")}</span>
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={t("settings.sync.token.placeholder")}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
        />
        <p className="text-2xs text-t3 mt-1">
          {t("settings.sync.token.note")}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={save}
          disabled={!url.trim() || saving}
          className="btn-yel px-3 py-1.5 text-sm rounded-md"
        >
          {saving ? t("settings.sync.saving") : t("settings.sync.save")}
        </button>
        {config.sync.remote_url && (
          <button
            onClick={onSyncNow}
            className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
          >
            {t("settings.sync.syncNow")}
          </button>
        )}
        {msg && <span className="ml-auto text-2xs text-t2">{msg}</span>}
      </div>

      <AutoSyncControl config={config} onConfigChange={onConfigChange} />

      <div className="mt-8 pt-5 border-t border-bd">
        <YarrowServerConnect
          config={config}
          onConfigChange={onConfigChange}
          onSyncNow={onSyncNow}
        />
      </div>
    </Section>
  );
}

function AutoSyncControl({
  config,
  onConfigChange,
}: {
  config: WorkspaceConfig;
  onConfigChange: (cfg: WorkspaceConfig) => void;
}) {
  const t = useT();
  const current = config.preferences?.autosync_minutes ?? 0;
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(current), [current]);

  const save = async (next: number) => {
    setSaving(true);
    try {
      const cfg = await api.updatePreferences({ ...config.preferences, autosync_minutes: next });
      onConfigChange(cfg);
    } finally {
      setSaving(false);
    }
  };

  const options = [
    { label: t("settings.sync.autoSync.off"), value: 0 },
    { label: "1m", value: 1 },
    { label: "5m", value: 5 },
    { label: "15m", value: 15 },
    { label: "30m", value: 30 },
    { label: "60m", value: 60 },
  ];

  return (
    <div className="mt-4">
      <label className="text-xs text-t2 block mb-1.5">{t("settings.sync.autoSync.label")}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setValue(opt.value); void save(opt.value); }}
            disabled={saving}
            className={`px-3 py-1 text-xs rounded border transition ${
              value === opt.value
                ? "border-yel bg-yelp text-yeld"
                : "border-bd text-t2 hover:bg-s2 hover:text-char"
            } disabled:opacity-50`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-2xs text-t3 mt-1.5 leading-relaxed">
        {t("settings.sync.autoSync.note")}
      </p>
    </div>
  );
}

// ─────────────── yarrow-server connect ───────────────

/** Settings → Sync → Yarrow server section. Wraps the three states:
 *  not connected, filling out the connect form, and connected.
 *
 *  This is the same integration whether the user is pointing at a
 *  self-hosted yarrow-server or the hosted Yarrow Connect tier — the
 *  desktop can't tell the two apart and shouldn't try to. All the
 *  copy below uses plain "Yarrow server". */
function YarrowServerConnect({
  config,
  onConfigChange,
  onSyncNow,
}: {
  config: WorkspaceConfig;
  onConfigChange: (cfg: WorkspaceConfig) => void;
  onSyncNow: () => void;
}) {
  const t = useT();
  const server = config.sync.server ?? null;
  const [editing, setEditing] = useState(false);

  if (!server) {
    return (
      <>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-serif text-base text-char">{t("settings.server.title")}</span>
          <span className="text-2xs px-1.5 py-px bg-s3 text-t2 rounded-full">
            {t("settings.server.tagSelfOrConnect")}
          </span>
        </div>
        <p className="text-xs text-t2 leading-relaxed mb-3">
          {t("settings.server.intro")}
        </p>
        {editing ? (
          <YarrowServerConnectForm
            onCancel={() => setEditing(false)}
            onConnected={(cfg) => { onConfigChange(cfg); setEditing(false); }}
            initialWorkspaceName={config.workspace.name}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
          >
            {t("settings.server.connect")}
          </button>
        )}
      </>
    );
  }

  return (
    <YarrowServerConnected
      config={config}
      server={server}
      onConfigChange={onConfigChange}
      onSyncNow={onSyncNow}
    />
  );
}

function YarrowServerConnectForm({
  onCancel,
  onConnected,
  initialWorkspaceName,
}: {
  onCancel: () => void;
  onConnected: (cfg: WorkspaceConfig) => void;
  initialWorkspaceName: string;
}) {
  const t = useT();
  const [method, setMethod] = useState<"password" | "token">("password");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [skipTls, setSkipTls] = useState(false);
  const [busy, setBusy] = useState<null | "test" | "connect">(null);
  const [err, setErr] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);

  const urlLooksValid = /^https?:\/\//i.test(url.trim());
  const canConnect =
    urlLooksValid &&
    email.trim().length > 0 &&
    (method === "password" ? password.length > 0 : token.trim().length > 0) &&
    busy === null;

  const connect = async () => {
    setBusy("connect");
    setErr(null);
    try {
      const trimmedUrl = url.trim();
      const trimmedEmail = email.trim();
      const trimmedWorkspace = workspaceName.trim() || undefined;
      const cfg =
        method === "password"
          ? await api.serverConnectPassword(trimmedUrl, trimmedEmail, password, trimmedWorkspace, skipTls)
          : await api.serverConnectToken(
              trimmedUrl,
              trimmedEmail,
              token.trim(),
              // Token path optionally carries the password so the
              // backend can derive the E2E privkey locally. Matches
              // what the password path does; without it, sync's
              // /unlock step fails on an E2E server.
              password.length > 0 ? password : undefined,
              trimmedWorkspace,
              skipTls,
            );
      // Clear the password from component state immediately; Rust side
      // has already discarded its copy.
      setPassword("");
      setToken("");
      onConnected(cfg);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (method !== "token") return;
    setBusy("test");
    setErr(null);
    setTestOk(false);
    try {
      await api.serverTestConnection(url.trim(), email.trim(), token.trim(), skipTls);
      setTestOk(true);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 p-3 bg-s1 border border-bd rounded-md">
      <div>
        <label className="text-xs text-t2 block mb-1">{t("settings.server.url.label")}</label>
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setTestOk(false); }}
          placeholder={t("settings.server.url.placeholder")}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-t2 block mb-1">{t("settings.server.method.label")}</label>
        <div className="flex gap-2">
          {([
            ["password", t("settings.server.method.password")],
            ["token", t("settings.server.method.token")],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMethod(m); setErr(null); setTestOk(false); }}
              className={`px-3 py-1.5 text-xs rounded border transition ${
                method === m
                  ? "border-yel bg-yelp text-yeld"
                  : "border-bd text-t2 hover:bg-s2 hover:text-char"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-t2 block mb-1">{t("settings.server.email.label")}</label>
        <input
          value={email}
          onChange={(e) => { setEmail(e.target.value); setTestOk(false); }}
          placeholder={t("settings.server.email.placeholder")}
          autoComplete="email"
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char text-xs"
        />
      </div>
      {method === "password" ? (
        <div>
          <label className="text-xs text-t2 block mb-1">{t("settings.server.password.label")}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char text-xs"
          />
          <p className="text-2xs text-t3 mt-1">
            {t("settings.server.password.note")}
          </p>
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs text-t2 block mb-1">{t("settings.server.token.label")}</label>
            <input
              type="password"
              value={token}
              onChange={(e) => { setToken(e.target.value); setTestOk(false); }}
              placeholder={t("settings.server.token.placeholder")}
              className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
            />
            <p className="text-2xs text-t3 mt-1">
              {t("settings.server.token.note")}
            </p>
          </div>
          <div>
            <label className="text-xs text-t2 block mb-1">
              {t("settings.server.passwordForEnc.label")} <span className="text-t3">{t("settings.server.passwordForEnc.optional")}</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char text-xs"
            />
            <p className="text-2xs text-t3 mt-1">
              {t("settings.server.passwordForEnc.note")}
            </p>
          </div>
        </>
      )}
      <div>
        <label className="text-xs text-t2 block mb-1">
          {t("settings.server.workspaceName.label")} <span className="text-t3">{t("settings.server.workspaceName.optional")}</span>
        </label>
        <input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder={initialWorkspaceName || t("settings.server.workspaceName.placeholder")}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char text-xs"
        />
        <p className="text-2xs text-t3 mt-1">
          {t("settings.server.workspaceName.note")}
        </p>
      </div>
      <label className="flex items-start gap-2 pt-1 cursor-pointer">
        <input
          type="checkbox"
          checked={skipTls}
          onChange={(e) => { setSkipTls(e.target.checked); setTestOk(false); }}
          className="mt-0.5 accent-yel"
        />
        <span className="text-xs text-t2 leading-relaxed">
          <span className="text-char">{t("settings.server.skipTls.label")}</span>
          <span className="block text-2xs text-t3 mt-0.5">
            {t("settings.server.skipTls.note.before")}<span className="font-mono">{t("settings.server.skipTls.note.localhost")}</span>{t("settings.server.skipTls.note.middle")}<span className="text-red-500">{t("settings.server.skipTls.note.warn")}</span>{t("settings.server.skipTls.note.after")}
          </span>
        </span>
      </label>
      <div className="flex items-center gap-2 pt-1">
        {method === "token" && (
          <button
            onClick={test}
            disabled={!urlLooksValid || !email.trim() || !token.trim() || busy !== null}
            className="px-3 py-1.5 text-xs bg-s2 text-ch2 rounded-md hover:bg-s3 disabled:opacity-50"
          >
            {busy === "test" ? t("settings.server.testing") : testOk ? t("settings.server.testOk") : t("settings.server.test")}
          </button>
        )}
        <button
          onClick={connect}
          disabled={!canConnect}
          className="btn-yel px-3 py-1.5 text-sm rounded-md"
        >
          {busy === "connect" ? t("settings.server.connecting") : t("settings.server.connectButton")}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-t2 hover:text-char"
        >
          {t("settings.server.cancel")}
        </button>
      </div>
      {err && (
        <div className="text-2xs text-red-500 leading-relaxed">{err}</div>
      )}
    </div>
  );
}

function YarrowServerConnected({
  config,
  server,
  onConfigChange,
  onSyncNow,
}: {
  config: WorkspaceConfig;
  server: NonNullable<WorkspaceConfig["sync"]["server"]>;
  onConfigChange: (cfg: WorkspaceConfig) => void;
  onSyncNow: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<null | "disconnect" | "revoke" | "sync">(null);
  const [err, setErr] = useState<string | null>(null);
  // syncOk tracks success vs failure separately from the message, so the
  // localized prefix doesn't have to be parsed back to colour the string.
  const [syncOk, setSyncOk] = useState<boolean | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncConflicts, setSyncConflicts] = useState<WorkspaceConfig extends unknown ? Array<{ path: string; action: string; copy_path?: string }> : never>(
    [] as Array<{ path: string; action: string; copy_path?: string }>,
  );

  const disconnect = async (revoke: boolean) => {
    setBusy(revoke ? "revoke" : "disconnect");
    setErr(null);
    try {
      const cfg = await api.serverDisconnect(revoke);
      onConfigChange(cfg);
    } catch (e) {
      setErr(String(e));
      // Even on revoke errors the backend has already cleared local
      // state — re-pull the config so the UI reflects reality.
      try { onConfigChange(await api.readConfig()); } catch { /* ignore */ }
    } finally {
      setBusy(null);
    }
  };

  const runSync = async () => {
    setBusy("sync");
    setErr(null);
    setSyncMsg(null);
    setSyncOk(null);
    setSyncConflicts([]);
    try {
      const r = await api.sync();
      setSyncOk(r.ok);
      setSyncMsg(
        r.ok
          ? t("settings.server.connected.syncedFmt", { message: r.message })
          : t("settings.server.connected.syncFailedFmt", { message: r.message }),
      );
      if (r.conflicts && r.conflicts.length > 0) {
        setSyncConflicts(r.conflicts);
      }
      // refresh config so any newly-persisted workspace_id is visible
      try { onConfigChange(await api.readConfig()); } catch { /* ignore */ }
      // still invoke the shared handler so the app-wide status pill updates
      onSyncNow();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  const connectedLabel = server.pat_label ?? t("settings.server.connected.tokenDefault");
  const workspaceOnServerLabel = server.workspace_id
    ? t("settings.server.connected.workspaceFmt", { id: server.workspace_id.slice(0, 8) })
    : t("settings.server.connected.workspaceNone");

  return (
    <>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-serif text-base text-char">{t("settings.server.title")}</span>
        <span className="text-2xs px-1.5 py-px bg-yelp text-yeld rounded-full">
          {t("settings.server.connected")}
        </span>
        {server.insecure_skip_tls_verify && (
          <span
            className="text-2xs px-1.5 py-px bg-red-500/10 text-red-500 rounded-full"
            title={t("settings.server.tlsInsecureTitle")}
          >
            {t("settings.server.tlsInsecure")}
          </span>
        )}
      </div>
      <div className="text-xs text-t2 leading-relaxed mb-3 space-y-0.5">
        <div>
          <span className="text-t3">{t("settings.server.connected.serverLabel")}</span>{" "}
          <span className="text-char font-mono">{server.server_url}</span>
        </div>
        <div>
          <span className="text-t3">{t("settings.server.connected.signedInAs")}</span>{" "}
          <span className="text-char">{server.email}</span>
        </div>
        <div>
          <span className="text-t3">{t("settings.server.connected.tokenLabel")}</span>{" "}
          <span className="text-char">{connectedLabel}</span>
          {server.pat_id ? (
            <span className="text-t3">{t("settings.server.connected.tokenIdSuffix", { id: server.pat_id.slice(0, 8) })}</span>
          ) : (
            <span className="text-t3">{t("settings.server.connected.tokenPasted")}</span>
          )}
        </div>
        <div>
          <span className="text-t3">{t("settings.server.connected.workspaceLabel")}</span>{" "}
          <span className="text-char">{workspaceOnServerLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={runSync}
          disabled={busy !== null}
          className="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-50"
        >
          {busy === "sync" ? t("settings.server.connected.syncing") : t("settings.server.connected.syncNow")}
        </button>
        <button
          onClick={() => disconnect(false)}
          disabled={busy !== null}
          className="px-3 py-1.5 text-xs bg-s2 text-ch2 rounded-md hover:bg-s3 disabled:opacity-50"
        >
          {busy === "disconnect" ? t("settings.server.connected.disconnecting") : t("settings.server.connected.disconnect")}
        </button>
        {server.pat_id && (
          <button
            onClick={() => disconnect(true)}
            disabled={busy !== null}
            className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-md disabled:opacity-50"
          >
            {busy === "revoke" ? t("settings.server.connected.revoking") : t("settings.server.connected.revoke")}
          </button>
        )}
      </div>
      {err && (
        <div className="text-2xs text-red-500 mt-2 leading-relaxed">{err}</div>
      )}
      {!config.sync.server?.workspace_id && (
        <p className="text-2xs text-t3 mt-2 leading-relaxed">
          {t("settings.server.connected.firstSyncNote.before")}
          <span className="text-char">"{server.workspace_name ?? config.workspace.name}"</span>
          {t("settings.server.connected.firstSyncNote.after")}
        </p>
      )}
      {syncMsg && (
        <div
          className={`text-2xs mt-2 leading-relaxed ${
            syncOk ? "text-char" : "text-red-500"
          }`}
        >
          {syncMsg}
        </div>
      )}
      {syncConflicts.length > 0 && (
        <div className="mt-2 p-2.5 rounded bg-gold/10 border border-gold/30 text-2xs leading-relaxed">
          <div className="text-char font-medium mb-1">
            {t(
              syncConflicts.length === 1
                ? "settings.server.connected.conflict.title"
                : "settings.server.connected.conflict.titlePlural",
              { count: String(syncConflicts.length) },
            )}
          </div>
          <div className="text-t2 mb-2">
            {t("settings.server.connected.conflict.body")}
          </div>
          <ul className="space-y-0.5 text-t2 font-mono">
            {syncConflicts.map((c) => (
              <li key={c.path}>
                <span className="text-char">{c.path}</span>
                {c.copy_path && (
                  <>
                    {" "}
                    {t("settings.server.connected.conflict.savedAs")} <span className="text-yel">{c.copy_path}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// ─────────────── templates ───────────────

function TemplatesPane() {
  const t = useT();
  const [items, setItems] = useState<TemplateInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [body, setBody] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refresh = async () => {
    try {
      const list = await api.listTemplates();
      setItems(list);
      if (!selected && list.length > 0) setSelected(list[0].name);
    } catch (e) {
      setMsg(String(e));
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    if (!selected) { setBody(""); setDirty(false); return; }
    let alive = true;
    api.readTemplate(selected).then((raw) => {
      if (!alive) return;
      setBody(raw);
      setDirty(false);
    }).catch(() => {});
    return () => { alive = false; };
  }, [selected]);

  const save = async () => {
    if (!selected) return;
    try {
      await api.writeTemplate(selected, body);
      setDirty(false);
      setMsg(t("settings.templates.saved"));
      setTimeout(() => setMsg(null), 1500);
    } catch (e) {
      setMsg(String(e));
    }
  };

  const confirmNew = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const clean = label.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!clean) return;
    await api.writeTemplate(clean, `<!-- label: ${label} -->\n# {{title}}\n\n{{cursor}}\n`);
    setNewOpen(false);
    setNewLabel("");
    await refresh();
    setSelected(clean);
  };

  const confirmRemove = async () => {
    if (!selected) return;
    await api.deleteTemplate(selected);
    setDeleteOpen(false);
    setSelected(null);
    await refresh();
  };

  const selectedLabel = items?.find((tpl) => tpl.name === selected)?.label ?? selected;

  return (
    <Section
      title={t("settings.templates.title")}
      hint={t("settings.templates.hint")}
    >
      <div className="flex gap-4 h-[360px]">
        <aside className="w-[200px] shrink-0 border border-bd rounded-md overflow-hidden flex flex-col">
          <ul className="flex-1 overflow-y-auto">
            {items?.map((tpl) => (
              <li key={tpl.name}>
                <button
                  onClick={() => setSelected(tpl.name)}
                  className={`w-full text-left px-3 py-2 text-sm transition ${
                    selected === tpl.name
                      ? "bg-yelp text-char border-l-2 border-yel pl-[10px]"
                      : "text-t2 hover:bg-s2 hover:text-char"
                  }`}
                >
                  <div className="truncate">{tpl.label}</div>
                  <div className="text-2xs text-t3 font-mono truncate">
                    {tpl.name}{tpl.is_daily ? ` · ${t("settings.templates.daily")}` : ""}
                  </div>
                </button>
              </li>
            ))}
            {items && items.length === 0 && (
              <li className="px-3 py-3 text-xs text-t3 italic">{t("settings.templates.empty")}</li>
            )}
          </ul>
          <div className="border-t border-bd px-2 py-2 flex gap-1">
            <button
              onClick={() => { setNewLabel(""); setNewOpen(true); }}
              className="flex-1 px-2 py-1 text-xs bg-s2 text-ch2 rounded hover:bg-s3"
            >
              {t("settings.templates.new")}
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              disabled={!selected}
              className="px-2 py-1 text-xs text-danger hover:bg-s2 rounded disabled:opacity-40"
            >
              {t("settings.templates.delete")}
            </button>
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setDirty(true); }}
                className="flex-1 w-full font-mono text-xs bg-bg border border-bd rounded-md p-3 text-char resize-none"
                spellCheck={false}
              />
              <div className="mt-2 flex items-center gap-2">
                <div className="text-2xs text-t3">
                  {t("settings.templates.placeholders")} <code>{"{{date}}"}</code> · <code>{"{{date_human}}"}</code> · <code>{"{{weekday}}"}</code> · <code>{"{{time}}"}</code> · <code>{"{{title}}"}</code> · <code>{"{{cursor}}"}</code>
                </div>
                <button
                  onClick={save}
                  disabled={!dirty}
                  className="ml-auto btn-yel px-3 py-1.5 text-xs rounded-md disabled:opacity-40"
                >
                  {t("settings.templates.save")}
                </button>
                {msg && <span className="text-2xs text-t2">{msg}</span>}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-t3 text-sm italic">
              {t("settings.templates.empty.editor")}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={newOpen}
        onClose={() => { setNewOpen(false); setNewLabel(""); }}
        title={t("settings.templates.newModal.title")}
      >
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          {t("settings.templates.newModal.body")}
        </p>
        <input
          autoFocus
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmNew(); }}
          placeholder={t("settings.templates.newModal.placeholder")}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => { setNewOpen(false); setNewLabel(""); }}
          >
            {t("settings.templates.newModal.cancel")}
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={confirmNew}
            disabled={!newLabel.trim()}
          >
            {t("settings.templates.newModal.create")}
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("settings.templates.deleteModal.title", { label: selectedLabel ?? "" })}
      >
        <p className="text-sm text-t2 mb-4 leading-relaxed">
          {t("settings.templates.deleteModal.body.before")}
          <span className="font-mono text-char">.yarrow/templates/</span>
          {t("settings.templates.deleteModal.body.after")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setDeleteOpen(false)}
          >
            {t("settings.templates.deleteModal.keep")}
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onClick={confirmRemove}
          >
            {t("settings.templates.deleteModal.confirm")}
          </button>
        </div>
      </Modal>
    </Section>
  );
}

// ─────────────── security ───────────────

function SecurityPane({
  config,
  onConfigChange,
}: {
  config: WorkspaceConfig;
  onConfigChange: (cfg: WorkspaceConfig) => void;
}) {
  const t = useT();
  const [status, setStatus] = useState<{ enabled: boolean; unlocked: boolean; idle_timeout_secs: number } | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [revealPhrase, setRevealPhrase] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.encryptionStatus().then((s) => { if (alive) setStatus(s); }).catch(() => {});
    return () => { alive = false; };
  }, [refreshNonce]);

  // When encryption state changes anywhere (in this pane, the toolbar, the
  // palette, idle lockout), pull a fresh status so the pane's Lock/Unlock
  // buttons reflect reality without requiring the user to tab away.
  useEffect(() => {
    const onChanged = () => setRefreshNonce((x) => x + 1);
    window.addEventListener("yarrow:encryption-changed", onChanged as EventListener);
    return () => window.removeEventListener("yarrow:encryption-changed", onChanged as EventListener);
  }, []);

  // Fire the change event + refresh local status. Used after every button
  // action inside the pane so the toolbar's lock indicator updates too.
  const bump = () => {
    setRefreshNonce((x) => x + 1);
    window.dispatchEvent(new Event("yarrow:encryption-changed"));
  };

  const updateIdle = async (secs: number) => {
    const next = { ...config.preferences, encryption_idle_timeout_secs: secs };
    const cfg = await api.updatePreferences(next);
    onConfigChange(cfg);
    bump();
  };

  return (
    <Section
      title={t("settings.security.title")}
      hint={t("settings.security.hint")}
    >
      <div className="p-4 bg-s1 border border-bd rounded-md">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-serif text-base text-char">{t("settings.security.localEnc.title")}</span>
          {status?.enabled ? (
            status?.unlocked ? (
              <span className="text-2xs px-1.5 py-px bg-yelp text-yeld rounded-full">{t("settings.security.tag.unlocked")}</span>
            ) : (
              <span className="text-2xs px-1.5 py-px bg-s3 text-t2 rounded-full">{t("settings.security.tag.lockedEnabled")}</span>
            )
          ) : (
            <span className="text-2xs px-1.5 py-px bg-s3 text-t2 rounded-full">{t("settings.security.tag.off")}</span>
          )}
        </div>
        <p className="text-xs text-t2 leading-relaxed">
          {t("settings.security.localEnc.body")}
        </p>
        {!status?.enabled && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setEnableOpen(true)}
              className="btn-yel px-3 py-1.5 text-sm rounded-md"
            >
              {t("settings.security.enable")}
            </button>
          </div>
        )}
        {status?.enabled && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <Row
                label={t("settings.security.idle.label")}
                hint={t("settings.security.idle.hint")}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={3600}
                    step={60}
                    value={config.preferences.encryption_idle_timeout_secs}
                    onChange={(e) => updateIdle(Number(e.target.value))}
                    className="w-40 accent-yel"
                  />
                  <span className="w-16 text-right text-xs font-mono text-t2">
                    {config.preferences.encryption_idle_timeout_secs === 0
                      ? t("settings.security.idle.never")
                      : t("settings.security.idle.minutes", { value: String(Math.round(config.preferences.encryption_idle_timeout_secs / 60)) })}
                  </span>
                </div>
              </Row>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!status.unlocked && (
                <button
                  onClick={async () => {
                    try {
                      // Reuse the main unlock flow — palette-level Unlock
                      // dispatcher lives in AppShell; here just hint the user.
                      window.dispatchEvent(new CustomEvent("yarrow:request-unlock"));
                    } catch {}
                  }}
                  className="btn-yel px-3 py-1.5 text-sm rounded-md"
                >
                  {t("settings.security.unlock")}
                </button>
              )}
              {status.unlocked && (
                <button
                  onClick={async () => { await api.lockEncryption(); bump(); }}
                  className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
                >
                  {t("settings.security.lockNow")}
                </button>
              )}
              <button
                onClick={() => setChangePwOpen(true)}
                className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
              >
                {t("settings.security.changePw")}
              </button>
              <button
                onClick={() => setRegenOpen(true)}
                className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
              >
                {t("settings.security.newRecovery")}
              </button>
              <button
                onClick={() => setDisableOpen(true)}
                className="ml-auto px-3 py-1.5 text-sm text-danger hover:bg-s2 rounded-md"
              >
                {t("settings.security.turnOff")}
              </button>
            </div>
          </>
        )}
      </div>

      <EnableEncryptionModal
        open={enableOpen}
        onClose={() => setEnableOpen(false)}
        onEnabled={(phrase) => { setEnableOpen(false); setRevealPhrase(phrase); bump(); }}
      />
      <DisableEncryptionModal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        onDone={() => { setDisableOpen(false); bump(); }}
      />
      <ChangePasswordModal
        open={changePwOpen}
        onClose={() => setChangePwOpen(false)}
        onDone={() => { setChangePwOpen(false); bump(); }}
      />
      <RegenerateRecoveryModal
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        onPhrase={(phrase) => { setRegenOpen(false); setRevealPhrase(phrase); bump(); }}
      />
      <RecoveryPhraseModal
        phrase={revealPhrase}
        onClose={() => {
          setRevealPhrase(null);
          // Make the enable-vs-encrypt distinction obvious. Most users enable
          // encryption and then forget the per-note step — the toast nudges
          // them toward the next action.
          window.dispatchEvent(new CustomEvent<string>("yarrow:toast", {
            detail: t("settings.security.toast.afterPhrase"),
          }));
        }}
      />
    </Section>
  );
}

function EnableEncryptionModal({
  open, onClose, onEnabled,
}: { open: boolean; onClose: () => void; onEnabled: (phrase: string) => void; }) {
  const t = useT();
  const [step, setStep] = useState<"confirm" | "password">("confirm");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("confirm"); setPw1(""); setPw2(""); setBusy(false); setErr(null);
  }, [open]);

  const submit = async () => {
    if (pw1 !== pw2) { setErr(t("settings.security.error.mismatch")); return; }
    if (pw1.length < 8) { setErr(t("settings.security.error.tooShort")); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api.enableEncryption(pw1);
      onEnabled(r.recovery_phrase);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("settings.security.enableModal.title")} width="w-[480px]">
      {step === "confirm" ? (
        <>
          <p className="text-sm text-t2 leading-relaxed mb-3">
            {t("settings.security.enableModal.intro")}
          </p>
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
            <div className="font-medium mb-1">{t("settings.security.enableModal.warn.title")}</div>
            <ul className="list-disc pl-5 space-y-0.5 text-t2">
              <li>{t("settings.security.enableModal.warn.diffs")}</li>
              <li>{t("settings.security.enableModal.warn.search")}</li>
              <li>{t("settings.security.enableModal.warn.external")}</li>
              <li>{t("settings.security.enableModal.warn.export")}</li>
              <li>{t("settings.security.enableModal.warn.lost")}</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-1.5 text-sm text-t2 hover:text-char" onClick={onClose}>
              {t("settings.security.enableModal.notNow")}
            </button>
            <button
              className="btn-yel px-3 py-1.5 text-sm rounded-md"
              onClick={() => setStep("password")}
            >
              {t("settings.security.enableModal.continue")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-t2 mb-3 leading-relaxed">
            {t("settings.security.enableModal.passwordIntro")}
          </p>
          <label className="text-xs text-t2 block mb-1">{t("settings.security.enableModal.password")}</label>
          <input
            type="password" autoFocus
            value={pw1} onChange={(e) => setPw1(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
          />
          <label className="text-xs text-t2 block mb-1">{t("settings.security.enableModal.confirmPassword")}</label>
          <input
            type="password"
            value={pw2} onChange={(e) => setPw2(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
          />
          {err && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-3">
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="px-3 py-1.5 text-sm text-t2 hover:text-char" onClick={onClose}>
              {t("settings.security.enableModal.cancel")}
            </button>
            <button
              className="btn-yel px-3 py-1.5 text-sm rounded-md"
              onClick={submit}
              disabled={busy || !pw1 || !pw2}
            >
              {busy ? t("settings.security.enableModal.settingUp") : t("settings.security.enableModal.enableButton")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function RecoveryPhraseModal({ phrase, onClose }: { phrase: string | null; onClose: () => void }) {
  const t = useT();
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setConfirmed(false); }, [phrase]);
  if (!phrase) return null;
  const words = phrase.split(/\s+/).filter(Boolean);
  return (
    <Modal open={true} onClose={() => { if (confirmed) onClose(); }} title={t("settings.security.recoveryModal.title")} width="w-[520px]">
      <p className="text-xs text-t2 mb-3 leading-relaxed">
        {t("settings.security.recoveryModal.body.before")}<span className="text-char font-medium">
          {t("settings.security.recoveryModal.body.bold")}
        </span>{t("settings.security.recoveryModal.body.after")}
      </p>
      <div className="grid grid-cols-3 gap-2 p-3 bg-s1 border border-bd rounded-md mb-3">
        {words.map((w, i) => (
          <div key={i} className="font-mono text-sm text-char">
            <span className="text-t3 text-2xs mr-1.5">{i + 1}.</span>
            {w}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(phrase).catch(() => {});
          }}
          className="px-3 py-1.5 text-xs bg-s2 text-ch2 rounded hover:bg-s3"
        >
          {t("settings.security.recoveryModal.copy")}
        </button>
        <span className="text-2xs text-t3">{t("settings.security.recoveryModal.copyHint")}</span>
      </div>
      <label className="flex items-center gap-2 text-xs text-t2 cursor-pointer select-none mb-4">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="accent-yel"
        />
        {t("settings.security.recoveryModal.confirm")}
      </label>
      <div className="flex justify-end">
        <button
          onClick={onClose}
          disabled={!confirmed}
          className="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-40"
        >
          {t("settings.security.recoveryModal.done")}
        </button>
      </div>
    </Modal>
  );
}

function DisableEncryptionModal({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setPw(""); setBusy(false); setErr(null); } }, [open]);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await api.disableEncryption(pw);
      onDone();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("settings.security.disableModal.title")} width="w-[440px]">
      <p className="text-sm text-t2 mb-3 leading-relaxed">
        {t("settings.security.disableModal.body")}
      </p>
      <label className="text-xs text-t2 block mb-1">{t("settings.security.disableModal.password.label")}</label>
      <input
        type="password" autoFocus
        value={pw} onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
      />
      {err && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-3">
          {err}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button className="px-3 py-1.5 text-sm text-t2 hover:text-char" onClick={onClose}>
          {t("settings.security.disableModal.keep")}
        </button>
        <button
          className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
          onClick={submit}
          disabled={busy || !pw}
        >
          {busy ? t("settings.security.disableModal.decrypting") : t("settings.security.disableModal.confirm")}
        </button>
      </div>
    </Modal>
  );
}

function ChangePasswordModal({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [oldPw, setOldPw] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setOldPw(""); setPw1(""); setPw2(""); setBusy(false); setErr(null); } }, [open]);

  const submit = async () => {
    if (pw1 !== pw2) { setErr(t("settings.security.changePwModal.error.mismatch")); return; }
    if (pw1.length < 8) { setErr(t("settings.security.error.tooShort")); return; }
    setBusy(true); setErr(null);
    try {
      await api.changeEncryptionPassword(oldPw, pw1);
      onDone();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("settings.security.changePwModal.title")}>
      <input
        type="password" autoFocus placeholder={t("settings.security.changePwModal.current")}
        value={oldPw} onChange={(e) => setOldPw(e.target.value)}
        className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-2"
      />
      <input
        type="password" placeholder={t("settings.security.changePwModal.new")}
        value={pw1} onChange={(e) => setPw1(e.target.value)}
        className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-2"
      />
      <input
        type="password" placeholder={t("settings.security.changePwModal.confirm")}
        value={pw2} onChange={(e) => setPw2(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
      />
      {err && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-3">
          {err}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button className="px-3 py-1.5 text-sm text-t2 hover:text-char" onClick={onClose}>
          {t("settings.security.changePwModal.cancel")}
        </button>
        <button
          className="btn-yel px-3 py-1.5 text-sm rounded-md"
          onClick={submit}
          disabled={busy || !oldPw || !pw1 || !pw2}
        >
          {busy ? t("settings.security.changePwModal.saving") : t("settings.security.changePwModal.submit")}
        </button>
      </div>
    </Modal>
  );
}

function RegenerateRecoveryModal({
  open, onClose, onPhrase,
}: { open: boolean; onClose: () => void; onPhrase: (phrase: string) => void }) {
  const t = useT();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setPw(""); setBusy(false); setErr(null); } }, [open]);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api.regenerateRecoveryPhrase(pw);
      onPhrase(r.recovery_phrase);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("settings.security.regenModal.title")}>
      <p className="text-xs text-t2 leading-relaxed mb-3">
        {t("settings.security.regenModal.body")}
      </p>
      <input
        type="password" autoFocus placeholder={t("settings.security.regenModal.current")}
        value={pw} onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
      />
      {err && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-3">
          {err}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button className="px-3 py-1.5 text-sm text-t2 hover:text-char" onClick={onClose}>
          {t("settings.security.regenModal.cancel")}
        </button>
        <button
          className="btn-yel px-3 py-1.5 text-sm rounded-md"
          onClick={submit}
          disabled={busy || !pw}
        >
          {busy ? t("settings.security.regenModal.working") : t("settings.security.regenModal.submit")}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────── workspace ───────────────

function WorkspacePane({
  workspacePath,
  config,
  onConfigChange,
  onCloseWorkspace,
  onImport,
}: {
  workspacePath: string;
  config: WorkspaceConfig;
  onConfigChange: (cfg: WorkspaceConfig) => void;
  onCloseWorkspace: () => void;
  onImport?: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(config.workspace.name);
  const [mainNotes, setMainNotes] = useState<NoteSummary[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => setName(config.workspace.name), [config]);
  useEffect(() => {
    api.listNotes().then(setMainNotes).catch(() => setMainNotes([]));
  }, [config.mapping.main_note]);

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === config.workspace.name) return;
    const cfg = await api.updateWorkspaceName(next);
    onConfigChange(cfg);
  };

  const mode = config.mapping?.mode ?? "mapped";
  const mainNoteSlug = config.mapping?.main_note ?? null;
  const mainNoteTitle = mainNoteSlug
    ? (mainNotes.find((n) => n.slug === mainNoteSlug)?.title ?? mainNoteSlug)
    : null;

  const setMode = async (next: "mapped" | "basic") => {
    if (next === mode) return;
    const cfg = await api.setWorkspaceMode(next);
    onConfigChange(cfg);
    if (next === "mapped" && !cfg.mapping.main_note) {
      setPickerOpen(true);
    }
  };

  return (
    <Section
      title={t("settings.workspace.title")}
      hint={t("settings.workspace.hint")}
    >
      <Row label={t("settings.workspace.name.label")} hint={t("settings.workspace.name.hint")}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          className="w-56 px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-sm"
        />
      </Row>

      <Row
        label={t("settings.workspace.mode.label")}
        hint={t("settings.workspace.mode.hint")}
      >
        <div className="inline-flex rounded-md border border-bd overflow-hidden text-xs">
          <button
            onClick={() => setMode("mapped")}
            className={`px-3 py-1.5 ${mode === "mapped" ? "bg-yel text-on-yel font-medium" : "bg-bg text-t2 hover:bg-s2"}`}
          >
            {t("settings.workspace.mode.mapped")}
          </button>
          <button
            onClick={() => setMode("basic")}
            className={`px-3 py-1.5 border-l border-bd ${mode === "basic" ? "bg-yel text-on-yel font-medium" : "bg-bg text-t2 hover:bg-s2"}`}
          >
            {t("settings.workspace.mode.basic")}
          </button>
        </div>
      </Row>

      {mode === "mapped" && (
        <Row
          label={t("settings.workspace.startingNote.label")}
          hint={t("settings.workspace.startingNote.hint")}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-t2 max-w-[220px] truncate">
              {mainNoteTitle ?? <span className="text-danger">{t("settings.workspace.startingNote.notSet")}</span>}
            </span>
            <button
              onClick={() => setPickerOpen(true)}
              className="px-2.5 py-1 text-xs bg-s2 text-char rounded-md hover:bg-s3"
            >
              {t("settings.workspace.startingNote.change")}
            </button>
          </div>
        </Row>
      )}

      <MainNotePrompt
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfigChange={onConfigChange}
      />

      <Row label={t("settings.workspace.folder.label")} hint={t("settings.workspace.folder.hint")}>
        <span className="text-xs font-mono text-t2 break-all max-w-[340px] text-right">
          {workspacePath}
        </span>
      </Row>

      <Row label={t("settings.workspace.created.label")}>
        <span className="text-xs text-t2">
          {new Date(config.workspace.created).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </Row>

      {onImport && (
        <div className="pt-5 border-t border-bd mt-4">
          <div className="text-sm text-char mb-1">{t("settings.workspace.import.title")}</div>
          <p className="text-2xs text-t2 mb-3 leading-relaxed">
            {t("settings.workspace.import.body.before")}<span className="font-mono">{t("settings.workspace.import.body.bib")}</span>{t("settings.workspace.import.body.middle")}<span className="font-mono">{t("settings.workspace.import.body.bib")}</span>{t("settings.workspace.import.body.middle2")}<span className="font-mono">{t("settings.workspace.import.body.tag")}</span>{t("settings.workspace.import.body.after")}
          </p>
          <button
            onClick={onImport}
            className="px-3 py-1.5 text-sm bg-s2 text-char rounded-md hover:bg-s3"
          >
            {t("settings.workspace.import.button")}
          </button>
        </div>
      )}

      <div className="pt-5 border-t border-bd mt-4">
        <div className="text-sm text-char mb-1">{t("settings.workspace.export.title")}</div>
        <p className="text-2xs text-t2 mb-2 leading-relaxed">
          {t("settings.workspace.export.body")}
        </p>
        <ExportButton />
      </div>

      <div className="pt-5 border-t border-bd mt-4">
        <div className="text-sm text-char mb-1">{t("settings.workspace.trim.title")}</div>
        <p className="text-2xs text-t2 mb-3 leading-relaxed">
          {t("settings.workspace.trim.body")}
        </p>
        <TrimHistoryButtons />
      </div>

      <div className="pt-5 border-t border-bd mt-4">
        <div className="text-sm text-char mb-1">{t("settings.workspace.clearCache.title")}</div>
        <p className="text-2xs text-t2 mb-3 leading-relaxed">
          {t("settings.workspace.clearCache.body.before")}<span className="font-mono">{t("settings.workspace.clearCache.body.indexJson")}</span>{t("settings.workspace.clearCache.body.middle")}
          <span className="font-mono"> {t("settings.workspace.clearCache.body.indexDb")}</span>{t("settings.workspace.clearCache.body.after")}
        </p>
        <ClearAllCacheButton />
      </div>

      <div className="pt-5 border-t border-bd mt-4">
        <button
          onClick={onCloseWorkspace}
          className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
        >
          {t("settings.workspace.close.button")}
        </button>
        <p className="text-2xs text-t3 mt-2">
          {t("settings.workspace.close.note")}
        </p>
      </div>
    </Section>
  );
}

const AGE_OPTIONS = [30, 60, 90, 180] as const;
type AgeDays = typeof AGE_OPTIONS[number];

function TrimHistoryButtons() {
  const t = useT();
  // Two-phase flow for age-based trimming: a picker modal where the user
  // chooses the cutoff, then an age-specific confirm modal so they can
  // still bail out after they see the warning. `empty` keeps its own
  // single-step confirm, no cutoff needed.
  const [picker, setPicker] = useState(false);
  const [pickerDays, setPickerDays] = useState<AgeDays>(180);
  const [confirm, setConfirm] = useState<
    | null
    | { kind: "age"; days: AgeDays }
    | { kind: "empty" }
  >(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (target: { kind: "age"; days: AgeDays } | { kind: "empty" }) => {
    setBusy(true);
    setMsg(null);
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
        setMsg(t("settings.trim.nothing", { label }));
      } else {
        setMsg(
          t(
            report.removed === 1
              ? "settings.trim.removed.singular"
              : "settings.trim.removed.plural",
            { count: String(report.removed), label, kept: String(report.kept) },
          ),
        );
      }
      succeeded = true;
    } catch (e) {
      setMsg(t("settings.trim.failed", { error: String(e) }));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
    // Auto-dismiss success messages so the section returns to a clean state.
    // Errors persist until the user clicks again so they have time to read.
    if (succeeded) {
      window.setTimeout(() => setMsg(null), 6000);
    }
  };

  const confirmDays = confirm?.kind === "age" ? confirm.days : 180;

  const keepLabelFor = (d: AgeDays) =>
    d >= 180
      ? t("settings.trim.picker.keep180")
      : d >= 90
        ? t("settings.trim.picker.keep90")
        : d >= 60
          ? t("settings.trim.picker.keep60")
          : t("settings.trim.picker.keep30");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setPickerDays(180); setPicker(true); }}
          disabled={busy}
          className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
        >
          {t("settings.trim.olderBtn")}
        </button>
        <button
          onClick={() => setConfirm({ kind: "empty" })}
          disabled={busy}
          className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
        >
          {t("settings.trim.emptyBtn")}
        </button>
      </div>
      {msg && (
        <div
          role="status"
          className="text-sm text-char mt-3 px-3 py-2 bg-yelp/40 border border-yel/40 rounded-md leading-relaxed"
        >
          {msg}
        </div>
      )}

      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title={t("settings.trim.picker.title")}
      >
        <p className="text-sm text-t2 mb-3 leading-relaxed">
          {t("settings.trim.picker.body")}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {AGE_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setPickerDays(d)}
              className={`px-3 py-3 text-sm rounded-md border transition text-left ${
                pickerDays === d
                  ? "bg-yelp text-yeld border-yel/50"
                  : "bg-bg text-ch2 border-bd hover:bg-s2 hover:border-bd2"
              }`}
            >
              <div className="font-medium">{t("settings.trim.picker.daysFmt", { days: String(d) })}</div>
              <div className="text-2xs text-t3 mt-0.5">
                {keepLabelFor(d)}
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setPicker(false)}
          >
            {t("settings.trim.picker.cancel")}
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onClick={() => { setPicker(false); setConfirm({ kind: "age", days: pickerDays }); }}
          >
            {t("settings.trim.picker.continue")}
          </button>
        </div>
      </Modal>

      <Modal
        open={confirm?.kind === "age"}
        onClose={() => !busy && setConfirm(null)}
        title={t("settings.trim.confirmAge.title", { days: String(confirmDays) })}
      >
        <p className="text-sm text-t2 mb-3 leading-relaxed">
          {t("settings.trim.confirmAge.body", { days: String(confirmDays) })}
        </p>
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
          <div className="font-medium mb-1">{t("settings.trim.confirm.warnTitle")}</div>
          <ul className="list-disc pl-5 space-y-0.5 text-t2">
            <li>{t("settings.trim.confirmAge.warn.thinking")}</li>
            <li>{t("settings.trim.confirmAge.warn.blame")}</li>
            <li>{t("settings.trim.confirm.warn.forcePush")}</li>
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConfirm(null)}
            disabled={busy}
          >
            {t("settings.trim.keep")}
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
            onClick={() => confirm?.kind === "age" && run(confirm)}
            disabled={busy}
          >
            {busy ? t("settings.trim.trimming") : t("settings.trim.confirmDoit")}
          </button>
        </div>
      </Modal>

      <Modal
        open={confirm?.kind === "empty"}
        onClose={() => !busy && setConfirm(null)}
        title={t("settings.trim.confirmEmpty.title")}
      >
        <p className="text-sm text-t2 mb-3 leading-relaxed">
          {t("settings.trim.confirmEmpty.body")}
        </p>
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
          <div className="font-medium mb-1">{t("settings.trim.confirm.warnTitle")}</div>
          <ul className="list-disc pl-5 space-y-0.5 text-t2">
            <li>{t("settings.trim.confirmEmpty.warn.scrub")}</li>
            <li>{t("settings.trim.confirm.warn.forcePush")}</li>
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConfirm(null)}
            disabled={busy}
          >
            {t("settings.trim.keep")}
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
            onClick={() => run({ kind: "empty" })}
            disabled={busy}
          >
            {busy ? t("settings.trim.trimming") : t("settings.trim.confirmDoit")}
          </button>
        </div>
      </Modal>
    </>
  );
}

/** Big red "nuke every cache" button. Confirms before it fires, because
 *  while the action is safe (nothing permanent is lost), the first
 *  search after a clear pays a rebuild cost that can surprise the user
 *  on a 1000-note vault. */
function ClearAllCacheButton() {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.clearAllCache();
      setMsg(t("settings.clearCache.done"));
      setConfirm(false);
      window.setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setMsg(t("settings.clearCache.failed", { error: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setConfirm(true)}
        disabled={busy}
        className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
      >
        {t("settings.clearCache.button")}
      </button>
      {msg && <p className="text-2xs text-t2 mt-2 leading-snug">{msg}</p>}

      <Modal
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title={t("settings.clearCache.modal.title")}
      >
        <p className="text-sm text-t2 mb-3 leading-relaxed">
          {t("settings.clearCache.modal.body")}
        </p>
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
          <div className="font-medium mb-1">{t("settings.clearCache.modal.does")}</div>
          <ul className="list-disc pl-5 space-y-0.5 text-t2">
            <li><span className="font-mono">.yarrow/index.json</span> {t("settings.clearCache.modal.does.json")}</li>
            <li><span className="font-mono">.yarrow/index.db</span> {t("settings.clearCache.modal.does.db")}</li>
          </ul>
          <div className="font-medium mb-1 mt-2">{t("settings.clearCache.modal.doesnt")}</div>
          <ul className="list-disc pl-5 space-y-0.5 text-t2">
            <li>{t("settings.clearCache.modal.doesnt.md.before")}<span className="font-mono">.md</span>{t("settings.clearCache.modal.doesnt.md.after")}</li>
            <li>{t("settings.clearCache.modal.doesnt.git")}</li>
            <li>{t("settings.clearCache.modal.doesnt.workspace")}</li>
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConfirm(false)}
            disabled={busy}
          >
            {t("settings.clearCache.modal.cancel")}
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
            onClick={run}
            disabled={busy}
          >
            {busy ? t("settings.clearCache.modal.clearing") : t("settings.clearCache.modal.confirm")}
          </button>
        </div>
      </Modal>
    </>
  );
}

function ExportButton() {
  const t = useT();
  // 2.2.0: replaced the bare directory-picker flow with a modal so the
  // user gets a chance to confirm what they're about to do (and where it's
  // landing) before any I/O happens. The native folder picker is still
  // used for the destination — it's just now reached through the modal.
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const pickDest = async () => {
    const picked = await openDialog({
      directory: true,
      multiple: false,
      title: t("settings.export.dialogTitle"),
    });
    if (typeof picked === "string") setDest(picked);
  };

  const runExport = async () => {
    if (!dest) return;
    setMsg(null);
    setError(false);
    setBusy(true);
    try {
      const report = await api.exportStatic(dest);
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
      setMsg(t("settings.export.report.summary", {
        notes: String(report.notes_exported),
        noteWord,
        attachBit,
        skipBit,
        dest: report.dest,
      }));
    } catch (e) {
      setError(true);
      setMsg(t("settings.export.failed", { error: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    // Defer state cleanup until the modal has finished its unmount so the
    // user doesn't see content rearrange itself on the way out.
    window.setTimeout(() => {
      setMsg(null);
      setError(false);
      setDest(null);
    }, 200);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-yel px-3 py-1.5 text-sm rounded-md"
      >
        {t("settings.export.go")}
      </button>

      <Modal
        open={open}
        onClose={close}
        title={t("settings.export.modal.title")}
        width="w-[480px]"
      >
        <p className="text-sm text-t2 mb-4 leading-relaxed">
          {t("settings.export.modal.body")}
        </p>

        <div className="mb-4">
          <div className="text-2xs uppercase tracking-wider text-t3 mb-1.5">
            {t("settings.export.modal.dest.label")}
          </div>
          <button
            type="button"
            onClick={pickDest}
            disabled={busy}
            className={
              dest
                ? "w-full text-left px-3 py-2 text-sm rounded-md border border-bd bg-bg text-char hover:border-bd2 transition truncate disabled:opacity-60"
                : "w-full text-left px-3 py-2 text-sm rounded-md border border-bd2 border-dashed bg-bg text-t2 hover:bg-s2 hover:text-char transition disabled:opacity-60"
            }
          >
            <span className="font-mono break-all">
              {dest || t("settings.export.modal.dest.choose")}
            </span>
          </button>
          {dest && (
            <button
              type="button"
              onClick={pickDest}
              disabled={busy}
              className="text-2xs text-t3 hover:text-char mt-1 disabled:opacity-60"
            >
              {t("settings.export.modal.dest.change")}
            </button>
          )}
        </div>

        {msg && (
          <div
            role="status"
            className={
              error
                ? "text-xs text-char mb-4 px-3 py-2 bg-danger/10 border border-danger/30 rounded-md leading-relaxed break-all"
                : "text-xs text-char mb-4 px-3 py-2 bg-yelp/40 border border-yel/40 rounded-md leading-relaxed break-all"
            }
          >
            {msg}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={close}
            disabled={busy}
            className="px-3 py-1.5 text-sm text-t2 hover:text-char disabled:opacity-60"
          >
            {msg && !error
              ? t("settings.export.modal.close")
              : t("settings.export.modal.cancel")}
          </button>
          <button
            onClick={runExport}
            disabled={busy || !dest}
            className="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-60"
          >
            {busy
              ? t("settings.export.exporting")
              : msg && !error
                ? t("settings.export.modal.again")
                : t("settings.export.modal.confirm")}
          </button>
        </div>
      </Modal>
    </>
  );
}

// ─────────────── storage ───────────────
//
// Stage-3: "Manage Storage" / reclaim-space UI. Lists the biggest files
// in the workspace's entire git history (including deleted-but-still-
// stored blobs) and lets the user permanently purge selected files
// server-side. Irreversible: the modal requires typing "delete" and
// the operation rewrites history + forces every other device to
// re-clone on next sync.

interface BlobGroup {
  path: string;
  /** Display path — matches `path` unless the group is dangling (no
   *  path), in which case we substitute a human-readable label. */
  displayPath: string;
  totalBytes: number;
  versions: import("../lib/types").LargeBlobEntry[];
  /** True for blobs with no known path (dangling objects). The
   *  checkbox is disabled for these — filter-repo operates on paths,
   *  and we have nothing to pass. Shown anyway so operators know the
   *  bytes exist (a future gc sweep will collect them). */
  dangling: boolean;
}

function StoragePane() {
  const t = useT();
  const [blobs, setBlobs] = useState<import("../lib/types").LargeBlobEntry[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<
    import("../lib/types").ReclaimSpaceOutcome | null
  >(null);
  const [runErr, setRunErr] = useState<string | null>(null);

  const refresh = async () => {
    setLoadErr(null);
    try {
      const list = await api.listLargeBlobs();
      setBlobs(list);
    } catch (e) {
      setLoadErr(String(e));
      setBlobs([]);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  // Collapse repeated history versions of the same path into one row
  // with a hide-by-default expander. filter-repo works on paths, so
  // selecting at the group level is the operation that actually
  // matches — per-version checkboxes would imply a finer purge than
  // the tool supports.
  const groups: BlobGroup[] = useMemo(() => {
    if (!blobs) return [];
    const byKey = new Map<string, BlobGroup>();
    for (const b of blobs) {
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
    return Array.from(byKey.values()).sort(
      (a, b) => b.totalBytes - a.totalBytes,
    );
  }, [blobs, t]);

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalSelectedBytes = groups
    .filter((g) => selected.has(g.path))
    .reduce((acc, g) => acc + g.totalBytes, 0);

  const openConfirm = () => {
    if (selected.size === 0) return;
    setConfirmText("");
    setRunErr(null);
    setResult(null);
    setConfirmOpen(true);
  };

  const runReclaim = async () => {
    if (confirmText.trim().toLowerCase() !== "delete") return;
    setRunning(true);
    setRunErr(null);
    try {
      const paths = Array.from(selected);
      const out = await api.reclaimSpace(paths, null);
      setResult(out);
      setSelected(new Set());
      await refresh();
    } catch (e) {
      setRunErr(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="font-serif text-2xl text-char mb-1">{t("settings.storage.title")}</div>
      <div className="text-sm text-t1 mb-3 leading-relaxed max-w-prose">
        <strong className="text-char">{t("settings.storage.intro.bold")}</strong>{t("settings.storage.intro.body")}
      </div>
      <div className="text-xs text-t2 mb-6 leading-relaxed max-w-prose">
        {t("settings.storage.body")}
      </div>

      <AlignWithServerPanel onRefresh={refresh} />

      {loadErr && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-4">
          {t("settings.storage.loadFailed", { error: loadErr })}
        </div>
      )}

      {blobs === null && !loadErr && (
        <div className="text-sm text-t2 italic">{t("settings.storage.loading")}</div>
      )}

      {blobs && blobs.length === 0 && !loadErr && (
        <div className="text-sm text-t2">
          {t("settings.storage.empty")}
        </div>
      )}

      {blobs && blobs.length > 0 && (
        <>
          <div className="border border-bd rounded-lg overflow-hidden mb-4 max-h-[360px] overflow-y-auto">
            <div className="grid grid-cols-[28px_20px_1fr_90px] gap-2 px-3 py-2 bg-bg-soft border-b border-bd text-[11px] uppercase tracking-wide text-t3 sticky top-0">
              <div />
              <div />
              <div>{t("settings.storage.col.file")}</div>
              <div className="text-right">{t("settings.storage.col.size")}</div>
            </div>
            {groups.map((g) => {
              const key = g.dangling ? `<dangling:${g.versions[0].oid}>` : g.path;
              const checked = !g.dangling && selected.has(g.path);
              const isExpanded = expanded.has(key);
              const hasMultiple = g.versions.length > 1;
              return (
                <div key={key} className="border-b border-bd/40 last:border-b-0">
                  <div
                    className={`grid grid-cols-[28px_20px_1fr_90px] items-center gap-2 px-3 py-2 text-sm ${
                      checked ? "bg-yelp/40" : "hover:bg-bg-soft"
                    }`}
                  >
                    <label className="flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => !g.dangling && toggle(g.path)}
                        disabled={g.dangling}
                        className="accent-yel"
                      />
                    </label>
                    {hasMultiple ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(key)}
                        aria-label={isExpanded ? t("settings.storage.collapseAria") : t("settings.storage.expandAria")}
                        title={isExpanded ? t("settings.storage.collapseTitle") : t("settings.storage.expandTitle")}
                        className="w-5 h-5 flex items-center justify-center text-t3 hover:text-char transition"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="currentColor"
                          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          <path d="M 3 1 L 7 5 L 3 9 Z" />
                        </svg>
                      </button>
                    ) : (
                      <span />
                    )}
                    <label className="truncate cursor-pointer" onClick={() => !g.dangling && toggle(g.path)}>
                      <span className={g.dangling ? "text-t3 italic" : ""}>
                        {g.displayPath}
                      </span>
                      {hasMultiple && (
                        <span className="ml-2 text-[11px] text-t3">
                          {t("settings.storage.versionsCount", { count: String(g.versions.length) })}
                        </span>
                      )}
                    </label>
                    <div className="text-t2 tabular-nums text-right whitespace-nowrap">
                      {humanBytesStorage(g.totalBytes)}
                    </div>
                  </div>
                  {isExpanded && hasMultiple && (
                    <div className="bg-bg-soft/60 border-t border-bd/40">
                      <div className="grid grid-cols-[28px_20px_1fr_90px] gap-2 px-3 py-1.5 text-[11px] uppercase tracking-wide text-t3">
                        <span />
                        <span />
                        <span>{t("settings.storage.version.col")}</span>
                        <span className="text-right">{t("settings.storage.col.size")}</span>
                      </div>
                      {g.versions.map((v, idx) => (
                        <div
                          key={v.oid}
                          className="grid grid-cols-[28px_20px_1fr_90px] gap-2 px-3 py-1 text-[12px] text-t2"
                        >
                          <span />
                          <span className="text-t3 text-center">
                            {idx === g.versions.length - 1 ? "└" : "├"}
                          </span>
                          <span className="font-mono truncate" title={v.oid}>
                            {v.oid.slice(0, 12)}
                          </span>
                          <span className="tabular-nums text-right whitespace-nowrap">
                            {humanBytesStorage(v.size)}
                          </span>
                        </div>
                      ))}
                      <div className="px-3 pb-2 pt-0.5 text-[11px] text-t3 italic">
                        {t("settings.storage.version.note")}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-t2">
              {selected.size > 0 ? (
                t(
                  selected.size === 1
                    ? "settings.storage.selected.singular"
                    : "settings.storage.selected.plural",
                  { count: String(selected.size), bytes: humanBytesStorage(totalSelectedBytes) },
                )
              ) : (
                <span className="italic">{t("settings.storage.selected.empty")}</span>
              )}
            </div>
            <button
              type="button"
              onClick={openConfirm}
              disabled={selected.size === 0}
              className="px-4 py-2 rounded-md bg-danger text-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              {t("settings.storage.deleteSelected")}
            </button>
          </div>
        </>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("settings.storage.confirm.title")}
        width="w-[520px]"
      >
        <div className="space-y-3 text-sm text-t1 leading-relaxed">
          <p>
            {t("settings.storage.confirm.body.before")}<strong className="text-char">{selected.size}</strong>{" "}
            {selected.size === 1 ? t("settings.storage.confirm.body.fileSingular") : t("settings.storage.confirm.body.filePlural")} (
            <strong className="text-char">
              {humanBytesStorage(totalSelectedBytes)}
            </strong>
            ) <strong className="text-char">{t("settings.storage.confirm.body.middle")}</strong>{t("settings.storage.confirm.body.after")}
          </p>
          <p className="text-char font-medium">{t("settings.storage.confirm.cantUndo")}</p>
          {result && (
            <div className="bg-sage-dim/40 border border-sage/20 rounded px-3 py-2 text-sm text-char">
              {t("settings.storage.confirm.done", { bytes: humanBytesStorage(result.bytes_freed) })}
            </div>
          )}
          {runErr && (
            <div className="bg-danger/10 border border-danger/30 rounded px-3 py-2 text-sm text-danger">
              {runErr}
            </div>
          )}
          {!result && (
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-t3">
                {t("settings.storage.confirm.typeToConfirm.before")}<strong className="text-char">DELETE</strong>{t("settings.storage.confirm.typeToConfirm.after")}
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={running}
                autoFocus
                className="mt-1 w-full px-3 py-2 rounded border border-bd2 bg-bg text-char focus:border-yel focus:outline-none font-mono"
                placeholder={t("settings.storage.confirm.placeholder")}
              />
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            {result ? (
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-md bg-yel text-on-yel hover:bg-yel2 text-sm font-medium"
              >
                {t("settings.storage.confirm.doneButton")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={running}
                  className="px-4 py-2 rounded-md border border-bd2 bg-bg hover:bg-bg-soft text-char text-sm"
                >
                  {t("settings.storage.confirm.cancel")}
                </button>
                <button
                  type="button"
                  onClick={runReclaim}
                  disabled={
                    running || confirmText.trim().toLowerCase() !== "delete"
                  }
                  className="px-4 py-2 rounded-md bg-danger text-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {running
                    ? t("settings.storage.confirm.deleting")
                    : t("settings.storage.confirm.confirmButton")}
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Inline recovery panel for the "server freed space but this device is
 * still stuck" scenario. Common after a reclaim-space run on a
 * different device, or after this device's `workspace.purged`
 * WebSocket handler failed (app was closed, network drop mid-receive,
 * etc.). Runs the server-fetch + hard-reset chain that `cmd_sync`
 * deliberately avoids — we *don't* want to push stale local commits
 * back to the server after a purge.
 */
function AlignWithServerPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const t = useT();
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const run = async () => {
    setStatus("running");
    setErrMsg(null);
    setSummary(null);
    try {
      const out = await api.forceAlignWithServer(true);
      const n = out.commits_ahead;
      setSummary(
        n === 0
          ? t("settings.align.alreadyInSync")
          : t(
              n === 1
                ? "settings.align.dropped.singular"
                : "settings.align.dropped.plural",
              { count: String(n) },
            ),
      );
      setStatus("ok");
      await onRefresh();
    } catch (e) {
      setErrMsg(String(e));
      setStatus("error");
    }
  };

  return (
    <div className="mb-5 border border-bd rounded-lg p-3 bg-bg-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-t2 leading-relaxed max-w-prose">
          <strong className="text-char">{t("settings.align.title")}</strong>{" "}
          {t("settings.align.body")}
        </div>
        <button
          type="button"
          onClick={run}
          disabled={status === "running"}
          className="shrink-0 px-3 py-1.5 rounded-md bg-yel text-on-yel hover:bg-yel2 disabled:opacity-50 text-xs font-medium whitespace-nowrap"
        >
          {status === "running" ? t("settings.align.syncing") : t("settings.align.button")}
        </button>
      </div>
      {summary && status === "ok" && (
        <div className="mt-2 text-xs text-char bg-sage-dim/40 border border-sage/20 rounded px-2.5 py-1.5">
          {summary}
        </div>
      )}
      {errMsg && status === "error" && (
        <div className="mt-2 text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2.5 py-1.5">
          {errMsg}
        </div>
      )}
    </div>
  );
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

// ─────────────── shortcuts ───────────────

function ShortcutsPane() {
  const t = useT();
  const groups: { title: string; items: { label: string; keys: string }[] }[] = [
    {
      title: t("settings.shortcuts.group.gettingAround"),
      items: [
        { label: t("settings.shortcuts.palette"),         keys: SK.palette },
        { label: t("settings.shortcuts.quickSwitch"),     keys: SK.quickSwitch },
        { label: t("settings.shortcuts.switchWorkspace"), keys: SK.switchWorkspace },
        { label: t("settings.shortcuts.jumpToday"),       keys: SK.jumpToday },
        { label: t("settings.shortcuts.openSettings"),    keys: SK.settings },
      ],
    },
    {
      title: t("settings.shortcuts.group.writing"),
      items: [
        { label: t("settings.shortcuts.newNote"),         keys: SK.newNote },
        { label: t("settings.shortcuts.newDirection"),    keys: SK.newDirection },
        { label: t("settings.shortcuts.branchFromHere"),  keys: SK.branchFromHere },
        { label: t("settings.shortcuts.focusToggle"),     keys: SK.focusToggle },
        { label: t("settings.shortcuts.scratchpad"),      keys: SK.scratchpad },
      ],
    },
  ];

  const platformLabel = isMacCopy()
    ? t("settings.shortcuts.platform.mac")
    : t("settings.shortcuts.platform.other");

  return (
    <Section
      title={t("settings.shortcuts.title")}
      hint={t("settings.shortcuts.hint", { platform: platformLabel })}
    >
      {groups.map((g) => (
        <div key={g.title} className="mb-5 last:mb-0">
          <div className="text-2xs uppercase tracking-wider text-t3 font-semibold mb-2">
            {g.title}
          </div>
          <ul className="divide-y divide-bd/70 border border-bd/60 rounded-md overflow-hidden">
            {g.items.map((it) => (
              <li
                key={it.label}
                className="flex items-center justify-between gap-4 px-3.5 py-2 bg-bg"
              >
                <span className="text-sm text-t2">{it.label}</span>
                <kbd className="font-mono text-xs text-ch2 bg-s2 border border-bd rounded px-2 py-0.5 whitespace-nowrap">
                  {it.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="text-2xs text-t3 mt-4 leading-relaxed">
        {t("settings.shortcuts.editorHint.before")}<kbd className="font-mono text-[11px] bg-s2 border border-bd rounded px-1.5">[[wikilink]]</kbd>
        {t("settings.shortcuts.editorHint.or")}<kbd className="font-mono text-[11px] bg-s2 border border-bd rounded px-1.5">![[embed]]</kbd>
        {t("settings.shortcuts.editorHint.middle")}<kbd className="font-mono text-[11px] bg-s2 border border-bd rounded px-1.5">??</kbd>
        {t("settings.shortcuts.editorHint.after")}
      </div>
    </Section>
  );
}

function isMacCopy(): boolean {
  // Purely for the copy in the hint — the shortcut strings themselves are
  // already rendered platform-appropriately by SK.
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

// ─────────────── about ───────────────

function AboutPane() {
  const t = useT();
  return (
    <Section title={t("settings.about.title")}>
      <p className="text-sm text-t2 leading-relaxed">
        {t("settings.about.body1")}
      </p>
      <p className="text-sm text-t2 leading-relaxed">
        {t("settings.about.body2")}
      </p>
      <div className="mt-4 pt-4 border-t border-bd">
        <button
          type="button"
          onClick={() => { openUrl("https://yarrow.software").catch(() => {}); }}
          className="inline-flex items-center gap-1.5 text-sm text-yeld hover:text-char transition"
        >
          yarrow.software
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M7 17L17 7"/><path d="M8 7h9v9"/>
          </svg>
        </button>
        <div className="text-2xs text-t3 font-mono mt-2">
          {t("settings.about.versionLine", { version: APP_VERSION })}
        </div>
      </div>
    </Section>
  );
}

// ─────────────── toggle primitive ───────────────

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full relative transition ${
        value ? "bg-yel" : "bg-s3"
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-bg shadow-sm transition ${
          value ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
