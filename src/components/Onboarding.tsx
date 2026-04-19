import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { RecentWorkspace, WorkspaceMode } from "../lib/types";
import { relativeTime } from "../lib/format";
import Logo from "./Logo";
import { XIcon } from "../lib/icons";
import { SK } from "../lib/platform";

interface Props {
  onReady: (path: string) => void;
}

type CreateStep =
  | { kind: "picking" }
  | { kind: "mode"; path: string }
  | { kind: "starting-note"; path: string; mode: WorkspaceMode };

export default function Onboarding({ onReady }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);
  const [step, setStep] = useState<CreateStep>({ kind: "picking" });
  const [startingTitle, setStartingTitle] = useState("");

  useEffect(() => {
    api.listRecentWorkspaces().then(setRecent).catch(() => setRecent([]));
  }, []);

  const pickCreate = async () => {
    setError(null);
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (!selected || Array.isArray(selected)) return;
      setStep({ kind: "mode", path: selected });
    } catch (e) {
      setError(String(e));
    }
  };

  const pickOpen = async () => {
    setError(null);
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (!selected || Array.isArray(selected)) return;
      setBusy(true);
      await api.openWorkspace(selected);
      onReady(selected);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const chooseMode = (mode: WorkspaceMode) => {
    if (step.kind !== "mode") return;
    if (mode === "basic") {
      finalizeCreate(step.path, "basic", undefined);
    } else {
      setStartingTitle("");
      setStep({ kind: "starting-note", path: step.path, mode });
    }
  };

  const finalizeCreate = async (
    path: string,
    mode: WorkspaceMode,
    title: string | undefined,
  ) => {
    setError(null);
    setBusy(true);
    try {
      await api.initWorkspace(path, undefined, mode, title?.trim() || undefined);
      onReady(path);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  const openRecent = async (path: string) => {
    setError(null);
    setBusy(true);
    try {
      await api.openWorkspace(path);
      onReady(path);
    } catch (e) {
      setError(String(e));
      await api.forgetRecentWorkspace(path).catch(() => {});
      setRecent(await api.listRecentWorkspaces());
    } finally {
      setBusy(false);
    }
  };

  const forget = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await api.forgetRecentWorkspace(path);
    setRecent(await api.listRecentWorkspaces());
  };

  if (step.kind === "mode") {
    return (
      <ModeChooser
        path={step.path}
        busy={busy}
        error={error}
        onBack={() => { setStep({ kind: "picking" }); setError(null); }}
        onPick={chooseMode}
      />
    );
  }

  if (step.kind === "starting-note") {
    return (
      <StartingNoteStep
        path={step.path}
        busy={busy}
        error={error}
        title={startingTitle}
        onTitleChange={setStartingTitle}
        onBack={() => setStep({ kind: "mode", path: step.path })}
        onConfirm={() => finalizeCreate(step.path, "mapped", startingTitle)}
      />
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-bg overflow-auto">
      <div className="max-w-lg w-full px-8 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Logo size={38} />
          <h1 className="font-serif text-5xl text-char leading-none">Yarrow</h1>
          <span className="ml-auto text-2xs text-t3 font-mono self-end pb-2">v1.0.0</span>
        </div>
        <p className="text-t2 text-base mb-8 leading-relaxed">
          Notes that branch, evolve, and connect. Nothing is ever lost — every
          direction you explore stays in an archive, not the trash.
        </p>

        {recent.length > 0 && (
          <div className="mb-6">
            <div className="text-2xs uppercase tracking-wider text-t3 font-semibold mb-2">
              Recent workspaces
            </div>
            <ul className="space-y-1.5">
              {recent.map((r) => (
                <li
                  key={r.path}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-s1 hover:bg-yelp border border-bd hover:border-yel transition ${
                    busy ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  <button
                    onClick={() => openRecent(r.path)}
                    disabled={busy}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                    aria-label={`Open ${r.name}`}
                  >
                    <Logo size={22} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-char font-medium truncate">
                        {r.name}
                      </div>
                      <div className="text-2xs text-t3 font-mono truncate">
                        {r.path}
                      </div>
                    </div>
                    <span className="text-2xs text-t3 font-mono shrink-0">
                      {relativeTime(r.last_opened)}
                    </span>
                  </button>
                  <button
                    onClick={(e) => forget(e, r.path)}
                    className="opacity-0 group-hover:opacity-100 text-t3 hover:text-danger transition shrink-0"
                    title="Remove from recents"
                    aria-label="Remove from recents"
                  >
                    <XIcon />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <button
            disabled={busy}
            onClick={pickCreate}
            className="w-full px-5 py-3 rounded-lg bg-yel text-on-yel font-medium hover:bg-yel2 transition disabled:opacity-50 text-left group"
          >
            <div className="text-sm font-serif">Start a new workspace</div>
            <div className="text-xs opacity-80 mt-0.5">
              Pick an empty folder — Yarrow keeps your notes there as plain markdown.
            </div>
          </button>

          <button
            disabled={busy}
            onClick={pickOpen}
            className="w-full px-5 py-3 rounded-lg bg-s2 text-char font-medium hover:bg-s3 transition disabled:opacity-50 text-left"
          >
            <div className="text-sm font-serif">Open a different folder</div>
            <div className="text-xs text-t2 mt-0.5">
              Locate a Yarrow workspace that isn't in your recents.
            </div>
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        {recent.length === 0 && (
          <div className="mt-10 border-t border-bd pt-6 space-y-3 text-xs text-t2 leading-relaxed">
            <div>
              <span className="text-char font-medium">Notes are just files.</span>
              {" "}They live in your chosen folder as `.md`. You can open them in any
              editor — Yarrow only tracks changes and connections for you.
            </div>
            <div>
              <span className="text-char font-medium">Every change is kept.</span>
              {" "}Save is automatic and silent. You can scrub back through any version.
            </div>
            <div>
              <span className="text-char font-medium">Explore in parallel.</span>
              {" "}When you want to try a different angle, open a new direction.
              The original stays exactly as it was.
            </div>
          </div>
        )}

        <p className="mt-8 text-2xs text-t3 font-mono">
          Tip: press {SK.palette} inside Yarrow to jump anywhere; {SK.quickSwitch} for a quick note switcher.
        </p>
      </div>
    </div>
  );
}

function ModeChooser({
  path,
  busy,
  error,
  onBack,
  onPick,
}: {
  path: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onPick: (mode: WorkspaceMode) => void;
}) {
  return (
    <div className="h-full flex items-center justify-center bg-bg overflow-auto">
      <div className="max-w-xl w-full px-8 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Logo size={30} />
          <h1 className="font-serif text-3xl text-char leading-none">How will you use this workspace?</h1>
        </div>
        <p className="text-2xs text-t3 font-mono mt-2 mb-6 truncate">{path}</p>

        <div className="space-y-2">
          <button
            disabled={busy}
            onClick={() => onPick("mapped")}
            className="w-full px-5 py-4 rounded-lg bg-yel text-on-yel font-medium hover:bg-yel2 transition disabled:opacity-50 text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-serif">Branch path mapping</span>
              <span className="text-[10px] font-mono uppercase tracking-wider bg-on-yel/20 px-1.5 py-0.5 rounded">Recommended</span>
            </div>
            <div className="text-xs opacity-85 leading-relaxed">
              Notes connect to each other. Pick a starting note, then explore parallel
              directions — your thinking becomes a map you can walk backwards.
            </div>
          </button>

          <button
            disabled={busy}
            onClick={() => onPick("basic")}
            className="w-full px-5 py-4 rounded-lg bg-s2 text-char hover:bg-s3 transition disabled:opacity-50 text-left"
          >
            <div className="text-sm font-serif mb-1">Basic notes</div>
            <div className="text-xs text-t2 leading-relaxed">
              A plain place to jot things down. No links, no map, no paths — just notes.
              Good for grocery lists, quick captures, or anything that doesn't need structure.
            </div>
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <button
          onClick={onBack}
          disabled={busy}
          className="mt-6 text-xs text-t3 hover:text-char"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

function StartingNoteStep({
  path,
  busy,
  error,
  title,
  onTitleChange,
  onBack,
  onConfirm,
}: {
  path: string;
  busy: boolean;
  error: string | null;
  title: string;
  onTitleChange: (v: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center bg-bg overflow-auto">
      <div className="max-w-xl w-full px-8 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Logo size={30} />
          <h1 className="font-serif text-3xl text-char leading-none">Where do you begin?</h1>
        </div>
        <p className="text-2xs text-t3 font-mono mt-2 mb-4 truncate">{path}</p>
        <p className="text-sm text-t2 leading-relaxed mb-5">
          Every map has a starting point. Name the first note — the one everything
          else will branch from. You can change it later in Settings.
        </p>

        <input
          autoFocus
          type="text"
          value={title}
          placeholder="e.g. Garden plan, Europe trip, Q3 goals…"
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) onConfirm();
          }}
          className="w-full px-4 py-3 rounded-lg bg-s1 border border-bd focus:border-yel focus:outline-none text-char font-serif text-lg"
        />

        <div className="mt-5 flex items-center gap-3">
          <button
            disabled={busy || !title.trim()}
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-lg bg-yel text-on-yel font-medium hover:bg-yel2 transition disabled:opacity-50"
          >
            Create workspace
          </button>
          <button
            onClick={onBack}
            disabled={busy}
            className="text-xs text-t3 hover:text-char"
          >
            ← Back
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
