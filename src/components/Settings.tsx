import { useEffect, useState } from "react";
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
} from "../lib/editorPrefs";
import {
  EXTRAS,
  useExtraCodeHighlight,
  useExtraImagePreview,
  useExtraMath,
  useExtraRadialMenu,
  useExtraSpell,
  type ExtraKey,
} from "../lib/extraPrefs";
import { useUiFont, UI_FONTS, type UiFontId, useUiScale, UI_SCALES, type UiScaleId } from "../lib/uiPrefs";
import { SunIcon, MoonIcon, AutoThemeIcon } from "../lib/icons";
import { SK } from "../lib/platform";
import { APP_VERSION } from "../lib/version";
import Modal from "./Modal";
import { useGuidance } from "../lib/guidanceStore";

type Tab =
  | "appearance"
  | "writing"
  | "guidance"
  | "sync"
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
}: Props) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-char/30 backdrop-blur-[3px] animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-[760px] max-w-[94vw] h-[520px] max-h-[90vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden flex animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <aside className="w-[180px] shrink-0 bg-s1 border-r border-bd py-3 flex flex-col">
          <div className="px-3 pb-3 border-b border-bd">
            <div className="font-serif text-xl text-char px-1">Settings</div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="mt-2 w-full px-2.5 py-1.5 bg-bg border border-bd rounded-md text-char text-xs placeholder:text-t3 focus:outline-none focus:border-yel"
            />
            <div className="text-2xs text-t3 mt-1.5 px-1">esc to close</div>
          </div>
          <nav className="flex-1 pt-2">
            {(["appearance", "writing", "guidance", "templates", "sync", "security", "workspace", "shortcuts", "about"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setQuery(""); }}
                className={`w-full text-left px-4 py-2 text-sm transition ${
                  !query && tab === t
                    ? "bg-s3 text-char border-l-2 border-yel pl-[14px]"
                    : "text-t2 hover:bg-s2 hover:text-char"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex-1 min-w-0 overflow-y-auto p-6">
          {query.trim() ? (
            <SearchResults
              query={query.trim()}
              onPick={(t) => { setTab(t); setQuery(""); }}
            />
          ) : (
            <>
              {tab === "appearance" && <AppearancePane />}
              {tab === "writing" && config && (
                <WritingPane config={config} onConfigChange={onConfigChange} />
              )}
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
                />
              )}
              {tab === "templates" && <TemplatesPane />}
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

const TAB_LABELS: Record<Tab, string> = {
  appearance: "Appearance",
  writing: "Writing",
  guidance: "Guidance",
  templates: "Templates",
  sync: "Sync",
  security: "Security",
  workspace: "Workspace",
  shortcuts: "Shortcuts",
  about: "About",
};

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
// fallback for people who don't know the exact label Yarrow uses.
interface SettingEntry {
  tab: Tab;
  label: string;
  sublabel?: string;
  keywords?: string[];
}

const SETTINGS_INDEX: SettingEntry[] = [
  { tab: "appearance", label: "Theme", sublabel: "light · dark · auto", keywords: ["color", "mode", "dark", "light"] },
  { tab: "appearance", label: "Interface size", sublabel: "compact · cozy · roomy", keywords: ["scale", "zoom", "chrome"] },
  { tab: "appearance", label: "Interface font", sublabel: "Inter · serif options", keywords: ["font", "typography", "ui", "inter", "georgia", "serif", "merriweather"] },

  { tab: "writing", label: "Save every change after", sublabel: "autosave debounce", keywords: ["autosave", "save", "delay"] },
  { tab: "writing", label: "Ask what I was thinking on close", keywords: ["thinking", "commit", "message"] },
  { tab: "writing", label: "Fade notes unvisited for", keywords: ["decay", "stale", "dim", "unvisited"] },
  { tab: "writing", label: "Editor font size", keywords: ["size", "font", "zoom"] },
  { tab: "writing", label: "Open workspaces in focus mode", keywords: ["focus", "default"] },
  { tab: "writing", label: "Show raw markdown syntax", keywords: ["markdown", "source", "raw"] },
  { tab: "writing", label: "Editor font", keywords: ["font", "serif", "sans", "lora", "source serif"] },

  { tab: "guidance", label: "Guided mode", sublabel: "hand-holding for complex features", keywords: ["guide", "tour", "tutorial", "help", "teach", "walkthrough", "onboarding"] },
  { tab: "guidance", label: "Reset guidance", sublabel: "see all the teaching modals again", keywords: ["reset", "forget", "tour", "show again"] },

  { tab: "templates", label: "Templates", sublabel: "reusable note scaffolds", keywords: ["template", "scaffold"] },

  { tab: "sync", label: "Repository URL", keywords: ["git", "remote", "github", "gitea", "backup"] },
  { tab: "sync", label: "Access token", keywords: ["password", "pat", "github"] },
  { tab: "sync", label: "Yarrow Sync", sublabel: "coming soon", keywords: ["cloud", "encrypted"] },

  { tab: "security", label: "Local encryption", sublabel: "password + recovery phrase", keywords: ["encrypt", "password", "security", "argon"] },
  { tab: "security", label: "Idle auto-lock", keywords: ["timeout", "lock", "idle"] },
  { tab: "security", label: "Change password", keywords: ["password", "rewrap"] },
  { tab: "security", label: "Recovery phrase", keywords: ["seed", "mnemonic", "backup"] },
  { tab: "security", label: "Turn off encryption", keywords: ["disable", "plaintext"] },

  { tab: "workspace", label: "Name", sublabel: "shown in the sidebar", keywords: ["rename", "title"] },
  { tab: "workspace", label: "Folder", sublabel: "where your notes live", keywords: ["path", "location", "directory"] },
  { tab: "workspace", label: "Export as a static site", keywords: ["html", "publish", "share"] },
  { tab: "workspace", label: "Trim checkpoint history", sublabel: "forget old snapshots", keywords: ["prune", "delete", "history", "old"] },
  { tab: "workspace", label: "Close this workspace", keywords: ["exit", "switch"] },

  { tab: "shortcuts", label: "Keyboard shortcuts", keywords: ["hotkey", "keybinding", "shortcut"] },

  { tab: "about", label: "About Yarrow", sublabel: "version, links", keywords: ["version", "build"] },
];

function searchSettings(q: string): SettingEntry[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return SETTINGS_INDEX.filter((entry) => {
    const haystack = [
      entry.label,
      entry.sublabel ?? "",
      TAB_LABELS[entry.tab],
      ...(entry.keywords ?? []),
    ].join(" ").toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

function SearchResults({
  query,
  onPick,
}: {
  query: string;
  onPick: (t: Tab) => void;
}) {
  const results = searchSettings(query);
  if (results.length === 0) {
    return (
      <div className="text-sm text-t3 italic">
        Nothing matches "{query}". Try a word like <span className="text-char">"font"</span>, <span className="text-char">"sync"</span>, or <span className="text-char">"password"</span>.
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
        {results.length} result{results.length === 1 ? "" : "s"} for "{query}"
      </div>
      <div className="space-y-5">
        {Array.from(byTab.entries()).map(([t, rows]) => (
          <div key={t}>
            <div className="text-xs text-t3 font-mono uppercase tracking-wider mb-1.5">
              {TAB_LABELS[t]}
            </div>
            <ul className="border border-bd rounded-md overflow-hidden divide-y divide-bd/60">
              {rows.map((r) => (
                <li key={`${r.tab}/${r.label}`}>
                  <button
                    onClick={() => onPick(r.tab)}
                    className="w-full text-left px-3 py-2.5 hover:bg-s2 transition flex items-baseline gap-3"
                  >
                    <span className="text-sm text-char flex-1">{r.label}</span>
                    {r.sublabel && (
                      <span className="text-2xs text-t3 truncate max-w-[200px]">{r.sublabel}</span>
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
  }
}

// Tiny preview swatch for each palette — samples the editorial tokens.
function ThemePreview({ mode }: { mode: ThemeMode }) {
  const swatches = (() => {
    switch (mode) {
      case "light":     return ["#F7F5F0", "#E8E4DA", "#7A4E6E"];
      case "dark":      return ["#1B1D1C", "#262A28", "#B07FA0"];
      case "auto":      return ["#F7F5F0", "#1B1D1C", "#7A4E6E"];
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

function AppearancePane() {
  const { mode, setMode } = useTheme();
  return (
    <Section
      title="Appearance"
      hint="How Yarrow looks on your screen. Your choice is saved on this machine."
    >
      <div>
        <div className="text-sm text-char mb-1">Theme</div>
        <div className="text-2xs text-t2 mb-3">
          Auto follows your system light/dark preference.
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

      <UiScaleRow />
      <UiFontPicker />
    </Section>
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
      title="Writing"
      hint="How Yarrow behaves while you're writing notes."
    >
      <Row
        label="Save every change after"
        hint="How long Yarrow waits after you stop typing before saving silently."
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
            {(local.autocheckpoint_debounce_ms / 1000).toFixed(1)}s
          </span>
        </div>
      </Row>

      <Row
        label="Ask what I was thinking on close"
        hint="A non-modal prompt when you close a note — optional."
      >
        <Toggle
          value={local.ask_thinking_on_close}
          onChange={(v) => save({ ...local, ask_thinking_on_close: v })}
        />
      </Row>

      <Row
        label="Fade notes unvisited for"
        hint="Notes untouched longer than this appear dimmed — a gentle nudge, not deletion."
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
            {local.decay_days}d
          </span>
        </div>
      </Row>

      <Row
        label="Editor font size"
        hint="Applies to the note body you type in. Takes effect immediately."
      >
        <select
          value={local.editor_font_size}
          onChange={(e) =>
            save({ ...local, editor_font_size: Number(e.target.value) })
          }
          className="px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs"
        >
          <option value={13}>Small (13)</option>
          <option value={14}>Snug (14)</option>
          <option value={15}>Comfortable (15)</option>
          <option value={16}>Standard (16)</option>
          <option value={17}>Roomy (17)</option>
          <option value={19}>Large (19)</option>
          <option value={22}>Extra large (22)</option>
          <option value={26}>Huge (26)</option>
        </select>
      </Row>

      <Row label="Open workspaces in focus mode">
        <Toggle
          value={local.focus_mode_default}
          onChange={(v) => save({ ...local, focus_mode_default: v })}
        />
      </Row>

      <Row
        label="Fast search indexing"
        hint="Keeps a local SQLite/FTS5 cache for instant search. Your notes stay canonical — the cache is rederivable and safe to delete."
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

      <EditorFontRow />


      <div className="text-2xs text-t3 mt-2">
        {saving ? "saving…" : "changes save automatically"}
      </div>
    </Section>
    <ExtrasSection />
    </>
  );
}

function TypewriterModeRow() {
  const [on, setOn] = useTypewriterMode();
  return (
    <Row
      label="Typewriter mode"
      hint="The active line stays at the vertical middle of the editor — the page scrolls underneath. Reduces neck strain on long sessions."
    >
      <Toggle value={on} onChange={setOn} />
    </Row>
  );
}

function EditorialReadingRow() {
  const [on, setOn] = useEditorialReading();
  return (
    <Row
      label="Editorial reading"
      hint="Reading mode uses drop caps, pull quotes, and generous leading — so finished notes read like a magazine spread. Use > pull: to mark a pull-quote."
    >
      <Toggle value={on} onChange={setOn} />
    </Row>
  );
}

function PathTintedCaretRow() {
  const [on, setOn] = usePathTintedCaret();
  return (
    <Row
      label="Path-tinted caret"
      hint="The caret takes the colour of the path you're writing on, so you always know which draft you're editing. Turn off for high-contrast defaults."
    >
      <Toggle value={on} onChange={setOn} />
    </Row>
  );
}

function ExtrasSection() {
  return (
    <Section
      title="Writing extras"
      hint="Opt-in features that lazy-load their code only when enabled — the editor stays lean by default and picks these up the moment you flip them on."
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
  const lookup: Record<ExtraKey, [boolean, (v: boolean) => void]> = {
    codeHighlight: code,
    math,
    spell,
    imagePreview: image,
    radialMenu: radial,
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
  const [raw, setRaw] = useShowRawMarkdown();
  return (
    <Row
      label="Show raw markdown syntax"
      hint="Show ## headings, **bold**, and [[ ]] around links while you write. When off, tokens collapse on lines you're not editing."
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
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");
  const onClear = async () => {
    setState("working");
    setMsg("");
    try {
      await api.clearSearchIndex();
      setState("done");
      setMsg("Cache cleared — next search will rebuild it.");
      window.setTimeout(() => { setState("idle"); setMsg(""); }, 3000);
    } catch (e) {
      setState("error");
      setMsg(String(e));
    }
  };
  return (
    <Row
      label="Clear search cache"
      hint="Removes .yarrow/index.db. Your notes aren't touched — the cache rebuilds on the next search if indexing is still on."
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
          {state === "working" ? "Clearing…" : "Clear"}
        </button>
      </div>
    </Row>
  );
}

function EditorFontRow() {
  const [current, setFont] = useEditorFont();
  const serifs = EDITOR_FONTS.filter((f) => f.kind === "serif");
  const sanses = EDITOR_FONTS.filter((f) => f.kind === "sans");
  return (
    <div className="py-3 border-b border-bd">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm text-char">Editor font</div>
        <div className="text-2xs text-t3 font-mono">Applies to the note body only</div>
      </div>
      <div className="text-2xs text-t3 mb-3 leading-relaxed">
        Pick a typeface for long-form writing. Chrome, tags, and metadata keep their own faces.
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FontGroup title="Serif" active={current.id} onPick={setFont} options={serifs} />
        <FontGroup title="Sans-serif" active={current.id} onPick={setFont} options={sanses} />
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

// ─────────────── guidance ───────────────

function GuidancePane() {
  const { enabled, setEnabled, reset } = useGuidance();
  return (
    <>
      <Section
        title="Guided mode"
        hint="Yarrow has a handful of concepts that aren't obvious from looking at them — paths, checkpoints, wikilinks, comparison, syncs. Guided mode walks you through each one every time you use it, and keeps a quiet reminder visible when you're on a try path."
      >
        <Row
          label={enabled ? "Guided mode is on" : "Guided mode is off"}
          hint={
            enabled
              ? "Teaching modals fire every time you do a non-obvious thing — creating a path, inserting a wikilink, returning to main, and so on. The ribbon above the editor is always visible when you're on a non-main path. If one specific modal starts to annoy you, each one has its own 'Stop showing this one' opt-out."
              : "You're on your own. No teaching modals, no ribbons. Tooltips still appear on hover, and destructive actions still ask to confirm."
          }
        >
          <Toggle value={enabled} onChange={setEnabled} />
        </Row>
      </Section>

      <Section
        title="Per-modal opt-outs"
        hint="If you've silenced an individual modal via its 'Stop showing this one' button, this resets those choices. Guided mode itself stays on."
      >
        <Row label="Show every modal again" hint="clears all per-key opt-outs; every teaching moment fires again">
          <button
            onClick={() => reset()}
            className="px-3 py-1.5 text-sm rounded-md border border-bd hover:bg-s2 text-ch2 transition"
          >
            Reset opt-outs
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
      setMsg("saved — try syncing from the toolbar");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Sync"
      hint="Back up your workspace to a git remote you own. Your notes stay on your machine — this just keeps a copy in sync."
    >
      <div>
        <label className="text-xs text-t2 block mb-1">Kind</label>
        <div className="flex gap-2">
          {["github", "gitea", "custom"].map((t) => (
            <button
              key={t}
              onClick={() => setRemoteType(t)}
              className={`px-3 py-1.5 text-xs rounded border transition ${
                remoteType === t
                  ? "border-yel bg-yelp text-yeld"
                  : "border-bd text-t2 hover:bg-s2 hover:text-char"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-t2 block mb-1">Repository URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/you/your-notes.git"
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
        />
      </div>

      <div>
        <label className="text-xs text-t2 block mb-1">
          Access token <span className="text-t3">(optional — HTTPS private repos)</span>
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_… / gitea token"
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs"
        />
        <p className="text-2xs text-t3 mt-1">
          Stored on this machine only — never pushed to the remote.
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={save}
          disabled={!url.trim() || saving}
          className="btn-yel px-3 py-1.5 text-sm rounded-md"
        >
          {saving ? "saving…" : "Save"}
        </button>
        {config.sync.remote_url && (
          <button
            onClick={onSyncNow}
            className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
          >
            Sync now
          </button>
        )}
        {msg && <span className="ml-auto text-2xs text-t2">{msg}</span>}
      </div>

      <div className="mt-8 pt-5 border-t border-bd">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-serif text-base text-char">Yarrow Sync</span>
          <span className="text-2xs px-1.5 py-px bg-s3 text-t2 rounded-full">coming soon</span>
        </div>
        <p className="text-xs text-t2 leading-relaxed mb-2">
          A zero-setup option for when you just want your notes on another
          device. End-to-end encrypted; we never see your workspace. No billing
          or account yet — we'll surface a signup here when it's ready.
        </p>
        <button
          disabled
          className="px-3 py-1.5 text-sm bg-s2 text-t3 rounded-md cursor-not-allowed"
        >
          Join the waitlist (soon)
        </button>
      </div>
    </Section>
  );
}

// ─────────────── templates ───────────────

function TemplatesPane() {
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
      setMsg("saved");
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

  const selectedLabel = items?.find((t) => t.name === selected)?.label ?? selected;

  return (
    <Section
      title="Templates"
      hint="Reusable scaffolds for recurring note shapes. Files live in .yarrow/templates/ as plain .md — edit them here or in any external editor."
    >
      <div className="flex gap-4 h-[360px]">
        <aside className="w-[200px] shrink-0 border border-bd rounded-md overflow-hidden flex flex-col">
          <ul className="flex-1 overflow-y-auto">
            {items?.map((t) => (
              <li key={t.name}>
                <button
                  onClick={() => setSelected(t.name)}
                  className={`w-full text-left px-3 py-2 text-sm transition ${
                    selected === t.name
                      ? "bg-yelp text-char border-l-2 border-yel pl-[10px]"
                      : "text-t2 hover:bg-s2 hover:text-char"
                  }`}
                >
                  <div className="truncate">{t.label}</div>
                  <div className="text-2xs text-t3 font-mono truncate">
                    {t.name}{t.is_daily ? " · daily" : ""}
                  </div>
                </button>
              </li>
            ))}
            {items && items.length === 0 && (
              <li className="px-3 py-3 text-xs text-t3 italic">No templates yet.</li>
            )}
          </ul>
          <div className="border-t border-bd px-2 py-2 flex gap-1">
            <button
              onClick={() => { setNewLabel(""); setNewOpen(true); }}
              className="flex-1 px-2 py-1 text-xs bg-s2 text-ch2 rounded hover:bg-s3"
            >
              + new
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              disabled={!selected}
              className="px-2 py-1 text-xs text-danger hover:bg-s2 rounded disabled:opacity-40"
            >
              delete
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
                  Placeholders: <code>{"{{date}}"}</code> · <code>{"{{date_human}}"}</code> · <code>{"{{weekday}}"}</code> · <code>{"{{time}}"}</code> · <code>{"{{title}}"}</code> · <code>{"{{cursor}}"}</code>
                </div>
                <button
                  onClick={save}
                  disabled={!dirty}
                  className="ml-auto btn-yel px-3 py-1.5 text-xs rounded-md disabled:opacity-40"
                >
                  Save
                </button>
                {msg && <span className="text-2xs text-t2">{msg}</span>}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-t3 text-sm italic">
              Pick a template to edit, or create a new one.
            </div>
          )}
        </div>
      </div>

      <Modal
        open={newOpen}
        onClose={() => { setNewOpen(false); setNewLabel(""); }}
        title="New template"
      >
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          A short name is enough — the scaffold is editable right after. The
          filename is derived from what you type.
        </p>
        <input
          autoFocus
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmNew(); }}
          placeholder="e.g. 1:1 notes"
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => { setNewOpen(false); setNewLabel(""); }}
          >
            cancel
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={confirmNew}
            disabled={!newLabel.trim()}
          >
            create template
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete template "${selectedLabel}"?`}
      >
        <p className="text-sm text-t2 mb-4 leading-relaxed">
          The file is removed from <span className="font-mono text-char">.yarrow/templates/</span>.
          Notes already created from it aren't affected.
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setDeleteOpen(false)}
          >
            keep it
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onClick={confirmRemove}
          >
            yes, delete
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
      title="Security"
      hint="Optional protections for notes you'd rather not leave in plain text. Off by default."
    >
      <div className="p-4 bg-s1 border border-bd rounded-md">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-serif text-base text-char">Local encryption</span>
          {status?.enabled ? (
            status?.unlocked ? (
              <span className="text-2xs px-1.5 py-px bg-yelp text-yeld rounded-full">unlocked</span>
            ) : (
              <span className="text-2xs px-1.5 py-px bg-s3 text-t2 rounded-full">enabled · locked</span>
            )
          ) : (
            <span className="text-2xs px-1.5 py-px bg-s3 text-t2 rounded-full">off</span>
          )}
        </div>
        <p className="text-xs text-t2 leading-relaxed">
          Per-note, opt-in encryption with ChaCha20-Poly1305 and an Argon2id
          password. Frontmatter (title, tags, links) stays plaintext so the
          graph and tag filter keep working; only the body is sealed. A 12-word
          recovery phrase gets you back in if you forget the password.
        </p>
        {!status?.enabled && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setEnableOpen(true)}
              className="btn-yel px-3 py-1.5 text-sm rounded-md"
            >
              Enable encryption…
            </button>
          </div>
        )}
        {status?.enabled && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <Row
                label="Idle auto-lock"
                hint="Session locks if you're idle this long. 0 = never."
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
                      ? "never"
                      : `${Math.round(config.preferences.encryption_idle_timeout_secs / 60)}m`}
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
                  Unlock…
                </button>
              )}
              {status.unlocked && (
                <button
                  onClick={async () => { await api.lockEncryption(); bump(); }}
                  className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
                >
                  Lock now
                </button>
              )}
              <button
                onClick={() => setChangePwOpen(true)}
                className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
              >
                Change password…
              </button>
              <button
                onClick={() => setRegenOpen(true)}
                className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
              >
                New recovery phrase…
              </button>
              <button
                onClick={() => setDisableOpen(true)}
                className="ml-auto px-3 py-1.5 text-sm text-danger hover:bg-s2 rounded-md"
              >
                Turn off encryption…
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
            detail: "Encryption is on. Notes are still readable — open a note and pick the 🔒 toolbar menu → Encrypt this note.",
          }));
        }}
      />
    </Section>
  );
}

function EnableEncryptionModal({
  open, onClose, onEnabled,
}: { open: boolean; onClose: () => void; onEnabled: (phrase: string) => void; }) {
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
    if (pw1 !== pw2) { setErr("passwords don't match"); return; }
    if (pw1.length < 8) { setErr("password must be at least 8 characters"); return; }
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
    <Modal open={open} onClose={onClose} title="Enable encryption" width="w-[480px]">
      {step === "confirm" ? (
        <>
          <p className="text-sm text-t2 leading-relaxed mb-3">
            Turning this on lets you encrypt individual notes. Frontmatter
            (title, tags, links) stays plaintext so the graph, tag filter and
            backlinks keep working for encrypted notes.
          </p>
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
            <div className="font-medium mb-1">While a note is encrypted:</div>
            <ul className="list-disc pl-5 space-y-0.5 text-t2">
              <li>Body diffs in history slider are ciphertext noise.</li>
              <li>Full-text search matches titles and tags only.</li>
              <li>Opening the .md in another editor shows ciphertext.</li>
              <li>Static-site export skips the note entirely.</li>
              <li>Lose both the password and the recovery phrase and the note is gone.</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-1.5 text-sm text-t2 hover:text-char" onClick={onClose}>
              not now
            </button>
            <button
              className="btn-yel px-3 py-1.5 text-sm rounded-md"
              onClick={() => setStep("password")}
            >
              I understand, continue
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-t2 mb-3 leading-relaxed">
            Pick a workspace password. You'll type it whenever your session
            locks (or, optionally, never if you turn idle-lock off).
          </p>
          <label className="text-xs text-t2 block mb-1">Password</label>
          <input
            type="password" autoFocus
            value={pw1} onChange={(e) => setPw1(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
          />
          <label className="text-xs text-t2 block mb-1">Confirm password</label>
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
              cancel
            </button>
            <button
              className="btn-yel px-3 py-1.5 text-sm rounded-md"
              onClick={submit}
              disabled={busy || !pw1 || !pw2}
            >
              {busy ? "setting up…" : "enable encryption"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function RecoveryPhraseModal({ phrase, onClose }: { phrase: string | null; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setConfirmed(false); }, [phrase]);
  if (!phrase) return null;
  const words = phrase.split(/\s+/).filter(Boolean);
  return (
    <Modal open={true} onClose={() => { if (confirmed) onClose(); }} title="Your recovery phrase" width="w-[520px]">
      <p className="text-xs text-t2 mb-3 leading-relaxed">
        Write these 12 words down somewhere safe — <span className="text-char font-medium">
          this is the only time you'll see them.
        </span> They reset your password if you forget it, and they let anyone
        else decrypt your notes, so keep them offline.
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
          Copy to clipboard
        </button>
        <span className="text-2xs text-t3">clear it before storing anywhere online</span>
      </div>
      <label className="flex items-center gap-2 text-xs text-t2 cursor-pointer select-none mb-4">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="accent-yel"
        />
        I've written this down somewhere safe
      </label>
      <div className="flex justify-end">
        <button
          onClick={onClose}
          disabled={!confirmed}
          className="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-40"
        >
          done
        </button>
      </div>
    </Modal>
  );
}

function DisableEncryptionModal({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
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
    <Modal open={open} onClose={onClose} title="Turn off encryption" width="w-[440px]">
      <p className="text-sm text-t2 mb-3 leading-relaxed">
        Every encrypted note in this workspace will be rewritten as plaintext
        and checkpointed. The security settings file is removed.
      </p>
      <label className="text-xs text-t2 block mb-1">Password (to confirm)</label>
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
          keep it on
        </button>
        <button
          className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
          onClick={submit}
          disabled={busy || !pw}
        >
          {busy ? "decrypting all…" : "turn it off"}
        </button>
      </div>
    </Modal>
  );
}

function ChangePasswordModal({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [oldPw, setOldPw] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setOldPw(""); setPw1(""); setPw2(""); setBusy(false); setErr(null); } }, [open]);

  const submit = async () => {
    if (pw1 !== pw2) { setErr("new passwords don't match"); return; }
    if (pw1.length < 8) { setErr("password must be at least 8 characters"); return; }
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
    <Modal open={open} onClose={onClose} title="Change encryption password">
      <input
        type="password" autoFocus placeholder="current password"
        value={oldPw} onChange={(e) => setOldPw(e.target.value)}
        className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-2"
      />
      <input
        type="password" placeholder="new password"
        value={pw1} onChange={(e) => setPw1(e.target.value)}
        className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-2"
      />
      <input
        type="password" placeholder="confirm new password"
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
          cancel
        </button>
        <button
          className="btn-yel px-3 py-1.5 text-sm rounded-md"
          onClick={submit}
          disabled={busy || !oldPw || !pw1 || !pw2}
        >
          {busy ? "saving…" : "change password"}
        </button>
      </div>
    </Modal>
  );
}

function RegenerateRecoveryModal({
  open, onClose, onPhrase,
}: { open: boolean; onClose: () => void; onPhrase: (phrase: string) => void }) {
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
    <Modal open={open} onClose={onClose} title="New recovery phrase">
      <p className="text-xs text-t2 leading-relaxed mb-3">
        Generates a fresh 12-word phrase and invalidates the old one. Your
        password stays the same.
      </p>
      <input
        type="password" autoFocus placeholder="current password"
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
          cancel
        </button>
        <button
          className="btn-yel px-3 py-1.5 text-sm rounded-md"
          onClick={submit}
          disabled={busy || !pw}
        >
          {busy ? "working…" : "generate new phrase"}
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
}: {
  workspacePath: string;
  config: WorkspaceConfig;
  onConfigChange: (cfg: WorkspaceConfig) => void;
  onCloseWorkspace: () => void;
}) {
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
      title="Workspace"
      hint="The folder your notes live in."
    >
      <Row label="Name" hint="Shown in the top-left of the sidebar.">
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
        label="Mode"
        hint="Branch path mapping turns this workspace into a connected map. Basic notes is just plain note-taking."
      >
        <div className="inline-flex rounded-md border border-bd overflow-hidden text-xs">
          <button
            onClick={() => setMode("mapped")}
            className={`px-3 py-1.5 ${mode === "mapped" ? "bg-yel text-on-yel font-medium" : "bg-bg text-t2 hover:bg-s2"}`}
          >
            Branch path mapping
          </button>
          <button
            onClick={() => setMode("basic")}
            className={`px-3 py-1.5 border-l border-bd ${mode === "basic" ? "bg-yel text-on-yel font-medium" : "bg-bg text-t2 hover:bg-s2"}`}
          >
            Basic notes
          </button>
        </div>
      </Row>

      {mode === "mapped" && (
        <Row
          label="Starting note"
          hint="The anchor for decisions going forward — where your map begins."
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-t2 max-w-[220px] truncate">
              {mainNoteTitle ?? <span className="text-danger">Not set</span>}
            </span>
            <button
              onClick={() => setPickerOpen(true)}
              className="px-2.5 py-1 text-xs bg-s2 text-char rounded-md hover:bg-s3"
            >
              Change…
            </button>
          </div>
        </Row>
      )}

      <MainNotePrompt
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfigChange={onConfigChange}
      />

      <Row label="Folder" hint="Where your notes are saved as .md files.">
        <span className="text-xs font-mono text-t2 break-all max-w-[340px] text-right">
          {workspacePath}
        </span>
      </Row>

      <Row label="Created">
        <span className="text-xs text-t2">
          {new Date(config.workspace.created).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </Row>

      <div className="pt-5 border-t border-bd mt-4">
        <div className="text-sm text-char mb-1">Export as a static site</div>
        <p className="text-2xs text-t2 mb-2 leading-relaxed">
          Save your workspace as a self-contained HTML folder you can share
          or host anywhere. Attachments and the connection graph come along.
        </p>
        <ExportButton />
      </div>

      <div className="pt-5 border-t border-bd mt-4">
        <div className="text-sm text-char mb-1">Trim checkpoint history</div>
        <p className="text-2xs text-t2 mb-3 leading-relaxed">
          Your current notes are never touched. These forget older snapshots
          so the history slider stops crowding up. Each is a one-way rewrite —
          if you sync to a remote, you'll need to force-push after.
        </p>
        <TrimHistoryButtons />
      </div>

      <div className="pt-5 border-t border-bd mt-4">
        <div className="text-sm text-char mb-1">Clear all derived caches</div>
        <p className="text-2xs text-t2 mb-3 leading-relaxed">
          Wipes <span className="font-mono">.yarrow/index.json</span> (graph) and
          <span className="font-mono"> .yarrow/index.db</span> (search). Your notes
          stay exactly as they are — both caches rebuild on demand.
        </p>
        <ClearAllCacheButton />
      </div>

      <div className="pt-5 border-t border-bd mt-4">
        <button
          onClick={onCloseWorkspace}
          className="px-3 py-1.5 text-sm bg-s2 text-ch2 rounded-md hover:bg-s3"
        >
          Close this workspace
        </button>
        <p className="text-2xs text-t3 mt-2">
          Nothing is deleted — you can reopen this folder any time.
        </p>
      </div>
    </Section>
  );
}

const AGE_OPTIONS = [30, 60, 90, 180] as const;
type AgeDays = typeof AGE_OPTIONS[number];

function TrimHistoryButtons() {
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
    try {
      const report =
        target.kind === "age"
          ? await api.pruneHistoryOlderThan(target.days)
          : await api.pruneEmptyCheckpoints();
      const label =
        target.kind === "age" ? `older than ${target.days} days` : "with no content";
      if (report.removed === 0) {
        setMsg(`Nothing to trim — no checkpoints ${label}.`);
      } else {
        setMsg(
          `Forgot ${report.removed} checkpoint${report.removed === 1 ? "" : "s"} ${label}. ${report.kept} kept.`,
        );
      }
    } catch (e) {
      setMsg(`Couldn't trim: ${String(e)}`);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const confirmDays = confirm?.kind === "age" ? confirm.days : 180;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setPickerDays(180); setPicker(true); }}
          disabled={busy}
          className="px-3 py-1.5 text-sm text-danger border border-danger/40 bg-danger/5 rounded-md hover:bg-danger/10 disabled:opacity-50"
        >
          Forget old checkpoints…
        </button>
        <button
          onClick={() => setConfirm({ kind: "empty" })}
          disabled={busy}
          className="px-3 py-1.5 text-sm text-danger border border-danger/40 bg-danger/5 rounded-md hover:bg-danger/10 disabled:opacity-50"
        >
          Forget empty checkpoints
        </button>
      </div>
      {msg && (
        <p className="text-2xs text-t2 mt-2 leading-snug">{msg}</p>
      )}

      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title="Forget checkpoints older than…"
      >
        <p className="text-sm text-t2 mb-3 leading-relaxed">
          Pick how far back to keep your history. Anything older will be dropped
          on every path — current notes stay exactly as they are.
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
              <div className="font-medium">{d} days</div>
              <div className="text-2xs text-t3 mt-0.5">
                keep ~{d >= 180 ? "half a year" : d >= 90 ? "a quarter" : d >= 60 ? "two months" : "a month"}
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setPicker(false)}
          >
            cancel
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onClick={() => { setPicker(false); setConfirm({ kind: "age", days: pickerDays }); }}
          >
            continue
          </button>
        </div>
      </Modal>

      <Modal
        open={confirm?.kind === "age"}
        onClose={() => !busy && setConfirm(null)}
        title={`Forget checkpoints older than ${confirmDays} days?`}
      >
        <p className="text-sm text-t2 mb-3 leading-relaxed">
          Every saved snapshot older than {confirmDays} days will be dropped on every
          path. Your current notes stay exactly as they are — only the old
          history slider entries disappear.
        </p>
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
          <div className="font-medium mb-1">This can't be undone:</div>
          <ul className="list-disc pl-5 space-y-0.5 text-t2">
            <li>Old "what were you thinking?" notes are erased.</li>
            <li>Blame-hover provenance before the cutoff is lost.</li>
            <li>If you sync to a remote, your next sync needs a force-push.</li>
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConfirm(null)}
            disabled={busy}
          >
            keep everything
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
            onClick={() => confirm?.kind === "age" && run(confirm)}
            disabled={busy}
          >
            {busy ? "trimming…" : "yes, forget them"}
          </button>
        </div>
      </Modal>

      <Modal
        open={confirm?.kind === "empty"}
        onClose={() => !busy && setConfirm(null)}
        title="Forget empty checkpoints?"
      >
        <p className="text-sm text-t2 mb-3 leading-relaxed">
          Drops every saved snapshot where all your notes were still empty —
          mostly "new note" moments before you started writing. Snapshots with
          any real content are kept.
        </p>
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
          <div className="font-medium mb-1">This can't be undone:</div>
          <ul className="list-disc pl-5 space-y-0.5 text-t2">
            <li>You can no longer scrub back to a note's blank-scaffold moment.</li>
            <li>If you sync to a remote, your next sync needs a force-push.</li>
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConfirm(null)}
            disabled={busy}
          >
            keep everything
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
            onClick={() => run({ kind: "empty" })}
            disabled={busy}
          >
            {busy ? "trimming…" : "yes, forget them"}
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
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.clearAllCache();
      setMsg("All derived caches cleared. Both will rebuild on demand.");
      setConfirm(false);
      window.setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setMsg(`Couldn't clear caches: ${String(e)}`);
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
        Clear all cache
      </button>
      {msg && <p className="text-2xs text-t2 mt-2 leading-snug">{msg}</p>}

      <Modal
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title="Clear all derived caches?"
      >
        <p className="text-sm text-t2 mb-3 leading-relaxed">
          Deletes the graph index and the search database. Your notes and git
          history are untouched. Both caches are rebuilt automatically — but
          the next search on a large vault may pause briefly while FTS5
          re-indexes every note.
        </p>
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-char leading-relaxed mb-4">
          <div className="font-medium mb-1">Does clear:</div>
          <ul className="list-disc pl-5 space-y-0.5 text-t2">
            <li><span className="font-mono">.yarrow/index.json</span> — link graph</li>
            <li><span className="font-mono">.yarrow/index.db</span> + WAL — search cache</li>
          </ul>
          <div className="font-medium mb-1 mt-2">Doesn't touch:</div>
          <ul className="list-disc pl-5 space-y-0.5 text-t2">
            <li>Your <span className="font-mono">.md</span> note files.</li>
            <li>Git checkpoint history.</li>
            <li>Workspace settings, templates, or attachments.</li>
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConfirm(false)}
            disabled={busy}
          >
            cancel
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90 disabled:opacity-60"
            onClick={run}
            disabled={busy}
          >
            {busy ? "clearing…" : "yes, clear everything"}
          </button>
        </div>
      </Modal>
    </>
  );
}

function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const runExport = async () => {
    setMsg(null);
    const dest = await openDialog({ directory: true, multiple: false, title: "Choose a folder for the export" });
    if (!dest || Array.isArray(dest)) return;
    setBusy(true);
    try {
      const report = await api.exportStatic(dest);
      const attachBit = report.attachments_exported > 0
        ? ` + ${report.attachments_exported} attachment${report.attachments_exported === 1 ? "" : "s"}`
        : "";
      const skipBit = (report.encrypted_skipped ?? 0) > 0
        ? ` · skipped ${report.encrypted_skipped} encrypted`
        : "";
      setMsg(`Exported ${report.notes_exported} note${report.notes_exported === 1 ? "" : "s"}${attachBit}${skipBit} → ${report.dest}`);
    } catch (e) {
      setMsg(`Export failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={runExport}
        disabled={busy}
        className="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-60"
      >
        {busy ? "exporting…" : "Choose folder & export"}
      </button>
      {msg && (
        <span className="text-2xs text-t2 flex-1 leading-snug break-all">{msg}</span>
      )}
    </div>
  );
}

// ─────────────── shortcuts ───────────────

function ShortcutsPane() {
  const groups: { title: string; items: { label: string; keys: string }[] }[] = [
    {
      title: "Getting around",
      items: [
        { label: "Command palette — search, jump, run", keys: SK.palette },
        { label: "Quick note switcher (fuzzy title)",    keys: SK.quickSwitch },
        { label: "Switch workspace",                     keys: SK.switchWorkspace },
        { label: "Jump to today's journal",              keys: SK.jumpToday },
        { label: "Open settings",                        keys: SK.settings },
      ],
    },
    {
      title: "Writing",
      items: [
        { label: "New note",                             keys: SK.newNote },
        { label: "Explore a new direction (new path)",   keys: SK.newDirection },
        { label: "Branch from the current note",          keys: SK.branchFromHere },
        { label: "Toggle focus mode (hide sidebars)",    keys: SK.focusToggle },
        { label: "Toggle scratchpad",                    keys: SK.scratchpad },
      ],
    },
  ];

  return (
    <Section
      title="Keyboard shortcuts"
      hint={`Shown in ${isMacCopy() ? "macOS" : "Windows / Linux"} style. These aren't configurable yet.`}
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
        Right-click in the editor to insert a <kbd className="font-mono text-[11px] bg-s2 border border-bd rounded px-1.5">[[wikilink]]</kbd>
        {" "}or <kbd className="font-mono text-[11px] bg-s2 border border-bd rounded px-1.5">![[embed]]</kbd>
        {" "}— pick a note from the list, toggle inline if you want to transclude it. Type <kbd className="font-mono text-[11px] bg-s2 border border-bd rounded px-1.5">??</kbd>
        {" "}at the start of a line to mark an open question.
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
  return (
    <Section title="About Yarrow">
      <p className="text-sm text-t2 leading-relaxed">
        Yarrow is a note-taking tool for non-linear thinking. Your notes are
        plain markdown files in a folder — open them in any editor, back them
        up anywhere. Yarrow only keeps track of connections and versions for
        you.
      </p>
      <p className="text-sm text-t2 leading-relaxed">
        Every save is a checkpoint. Every "new direction" is a path you can
        switch back to. Nothing you write is ever lost.
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
          version {APP_VERSION} · local-first · plain markdown
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
