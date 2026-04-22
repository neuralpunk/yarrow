import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { RecentWorkspace } from "../lib/types";
import { relativeTime } from "../lib/format";
import { YarrowMark } from "./YarrowMark";
import { XIcon } from "../lib/icons";
import { SK } from "../lib/platform";
import { APP_VERSION } from "../lib/version";
import NewWorkspaceWizard from "./NewWorkspaceWizard";

interface Props {
  onReady: (path: string) => void;
}

export default function Onboarding({ onReady }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [openGuideOpen, setOpenGuideOpen] = useState(false);

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

  // Seed a starter vault with ~8 connected notes + a second path so the
  // user sees what a populated Map / Paths view looks like on day one.
  // We ask them to pick a parent folder and name the workspace — same
  // flow as a blank workspace but the backend pre-populates notes.
  const tryASample = async () => {
    setError(null);
    try {
      const parent = await openDialog({ directory: true, multiple: false });
      if (!parent || Array.isArray(parent)) return;
      setBusy(true);
      // The backend names the subdir from the provided workspace name, so
      // we pick a sensible default here and let the backend slot it in.
      const rootName = "yarrow-sample";
      const root = await api.createWorkspaceDir(parent, rootName);
      await api.initSampleWorkspace(root, "Sample vault");
      onReady(root);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
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
          <YarrowMark size={38} />
          <h1 className="font-serif text-5xl text-char leading-none">Yarrow</h1>
          <span className="ml-auto text-2xs text-t3 font-mono self-end pb-2">v{APP_VERSION}</span>
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
                    <YarrowMark size={22} className="shrink-0" />
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
              Start blank, or import from Obsidian, Bear, Logseq, or Notion. We'll guide you through it.
            </div>
          </button>

          <button
            disabled={busy}
            onClick={() => { setError(null); setOpenGuideOpen(true); }}
            className="w-full px-5 py-3 rounded-lg bg-s2 text-char font-medium hover:bg-s3 transition disabled:opacity-50 text-left"
          >
            <div className="text-sm font-serif">Open a different folder</div>
            <div className="text-xs text-t2 mt-0.5">
              Locate a Yarrow workspace that isn't in your recents. We'll show you what to look for.
            </div>
          </button>

          {recent.length === 0 && (
            <button
              disabled={busy}
              onClick={tryASample}
              className="w-full px-5 py-3 rounded-lg bg-bg border border-bd text-t2 hover:text-char hover:bg-s1 transition disabled:opacity-50 text-left"
            >
              <div className="text-sm font-serif italic">Try a sample vault</div>
              <div className="text-xs text-t3 mt-0.5">
                Eight connected notes and a second path — see Yarrow populated
                before you start writing your own.
              </div>
            </button>
          )}
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
      <OpenFolderGuide
        open={openGuideOpen}
        busy={busy}
        onClose={() => setOpenGuideOpen(false)}
        onBrowse={async () => {
          setOpenGuideOpen(false);
          await pickOpen();
        }}
      />
      </div>
    </div>
  );
}

/**
 * Guided "open an existing workspace" modal. Explains what a Yarrow
 * workspace *is* on disk (a folder with `.yarrow/` config + `notes/`)
 * before popping the OS picker, so first-timers don't get yanked into a
 * raw filesystem dialog with no context.
 */
function OpenFolderGuide({
  open,
  busy,
  onClose,
  onBrowse,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onBrowse: () => void | Promise<void>;
}) {
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
      className="fixed inset-0 z-50 bg-char/30 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-bd">
          <div className="font-serif text-xl text-char">Open an existing Yarrow workspace</div>
          <div className="text-2xs text-t3 mt-0.5 leading-relaxed">
            A workspace is just a folder on disk — one you (or Yarrow) made before.
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="font-serif italic text-xs text-t3 mb-2">
              What you're looking for
            </div>
            <div className="bg-s1 border border-bd rounded-md px-3 py-3 font-mono text-[11px] text-t2 leading-relaxed">
              <div className="text-char">some-folder-name/</div>
              <div className="pl-4">.yarrow/<span className="text-t3 italic"> ← Yarrow's config + index (hidden)</span></div>
              <div className="pl-4">notes/<span className="text-t3 italic"> ← your .md notes live here</span></div>
              <div className="pl-4">.gitignore</div>
              <div className="pl-4 text-t3 italic">(and the usual git bookkeeping)</div>
            </div>
          </div>

          <div className="text-xs text-t2 leading-relaxed space-y-2">
            <div>
              Pick the <span className="text-char font-medium">outer folder</span> — the one
              that contains <code className="font-mono text-[11px] bg-s2 px-1 rounded">.yarrow/</code>.
              If you drill in too far (e.g. into <code className="font-mono text-[11px] bg-s2 px-1 rounded">notes/</code>),
              Yarrow won't recognize it and will offer to open it as a new workspace instead.
            </div>
            <div className="text-t3 italic">
              Your OS might hide the <code className="font-mono text-[10px]">.yarrow</code> folder
              (macOS &amp; Linux hide anything that starts with a dot). That's fine — you don't
              need to see it, just pick the folder that contains it.
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-bd flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onBrowse}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yel2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Browse for a folder…
          </button>
        </div>
      </div>
    </div>
  );
}

