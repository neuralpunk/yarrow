import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { RecentWorkspace } from "../lib/types";
import { relativeTime } from "../lib/format";
import Logo from "./Logo";
import { XIcon } from "../lib/icons";
import { SK } from "../lib/platform";
import NewWorkspaceWizard from "./NewWorkspaceWizard";

interface Props {
  onReady: (path: string) => void;
}

export default function Onboarding({ onReady }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    api.listRecentWorkspaces().then(setRecent).catch(() => setRecent([]));
  }, []);

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

  // `items-center` on a flex parent that overflows pushes the child's top
  // off the scrollable region (you can't scroll up to reach it). Wrap with
  // an outer scroll container and an inner `min-h-full` flex so the content
  // stays vertically centered when short and scrolls naturally when long.
  return (
    <div className="h-full overflow-auto bg-bg">
      <div className="min-h-full flex items-center justify-center py-10">
      <div className="max-w-lg w-full px-8">
        <div className="flex items-center gap-3 mb-1">
          <Logo size={38} />
          <h1 className="font-serif text-5xl text-char leading-none">Yarrow</h1>
          <span className="ml-auto text-2xs text-t3 font-mono self-end pb-2">v1.1.0</span>
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
            onClick={() => { setError(null); setWizardOpen(true); }}
            className="w-full px-5 py-3 rounded-lg bg-yel text-on-yel font-medium hover:bg-yel2 transition disabled:opacity-50 text-left group"
          >
            <div className="text-sm font-serif">Create a new workspace</div>
            <div className="text-xs opacity-80 mt-0.5">
              Start blank, or import an Obsidian vault. We'll guide you through it.
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

      <NewWorkspaceWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onReady={(p) => { setWizardOpen(false); onReady(p); }}
      />
      </div>
    </div>
  );
}

