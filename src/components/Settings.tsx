import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../lib/tauri";
import type { WorkspaceConfig } from "../lib/types";
import { useTheme, ThemeMode, THEME_ORDER, THEME_LABELS } from "../lib/theme";
import { SunIcon, MoonIcon, AutoThemeIcon, SparkIcon } from "../lib/icons";
import { SK } from "../lib/platform";

type Tab = "appearance" | "writing" | "sync" | "workspace" | "shortcuts" | "about";

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
  useEffect(() => {
    if (open) setTab(initialTab ?? "appearance");
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
          <div className="px-4 pb-3 border-b border-bd">
            <div className="font-serif text-xl text-char">Settings</div>
            <div className="text-2xs text-t3">esc to close</div>
          </div>
          <nav className="flex-1 pt-2">
            {(["appearance", "writing", "sync", "workspace", "shortcuts", "about"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`w-full text-left px-4 py-2 text-sm transition ${
                  tab === t
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
          {tab === "appearance" && <AppearancePane />}
          {tab === "writing" && config && (
            <WritingPane config={config} onConfigChange={onConfigChange} />
          )}
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
          {tab === "shortcuts" && <ShortcutsPane />}
          {tab === "about" && <AboutPane />}
        </section>
      </div>
    </div>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  appearance: "Appearance",
  writing: "Writing",
  sync: "Sync",
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

// ─────────────── appearance ───────────────

function themeIcon(m: ThemeMode) {
  switch (m) {
    case "light":     return <SunIcon size={13} />;
    case "dark":      return <MoonIcon size={13} />;
    case "auto":      return <AutoThemeIcon size={13} />;
    case "blueberry": return <SparkIcon size={13} />;
  }
}

// Tiny preview swatch for each palette. Samples the live palette for the
// default warm themes; uses literal Blueberry hexes for that palette so the
// preview is recognisable at a glance regardless of current theme.
function ThemePreview({ mode }: { mode: ThemeMode }) {
  const swatches = (() => {
    switch (mode) {
      case "light":     return ["#fdfcf3", "#f3eccc", "#e8b820"];
      case "dark":      return ["#141209", "#282316", "#f5c930"];
      case "auto":      return ["#fdfcf3", "#141209", "#e8b820"];
      case "blueberry": return ["#182833", "#1F4762", "#FFC619"];
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
          Auto follows your system light/dark preference. Blueberry is a
          deep-navy palette with warm amber accents.
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
    </Section>
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

      <div className="text-2xs text-t3 mt-2">
        {saving ? "saving…" : "changes save automatically"}
      </div>
    </Section>
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
    </Section>
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
  useEffect(() => setName(config.workspace.name), [config]);

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === config.workspace.name) return;
    const cfg = await api.updateWorkspaceName(next);
    onConfigChange(cfg);
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
      setMsg(`Exported ${report.notes_exported} note${report.notes_exported === 1 ? "" : "s"}${attachBit} → ${report.dest}`);
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
        { label: "Jump to today's journal",              keys: SK.jumpToday },
        { label: "Open settings",                        keys: SK.settings },
      ],
    },
    {
      title: "Writing",
      items: [
        { label: "New note",                             keys: SK.newNote },
        { label: "Explore a new direction (new path)",   keys: SK.newDirection },
        { label: "Toggle focus mode (hide sidebars)",    keys: SK.focusToggle },
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
        Inside the editor, type <kbd className="font-mono text-[11px] bg-s2 border border-bd rounded px-1.5">[[</kbd>
        {" "}to bring up the wikilink autocomplete. Type <kbd className="font-mono text-[11px] bg-s2 border border-bd rounded px-1.5">??</kbd>
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
          version 0.2 · local-first · plain markdown
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
