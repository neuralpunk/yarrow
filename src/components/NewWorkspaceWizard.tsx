import { useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { WorkspaceMode } from "../lib/types";
import Logo from "./Logo";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called once the workspace is fully initialized and (optionally)
   *  imported into. The shell can then open it. */
  onReady: (path: string) => void;
}

type Step = "shape" | "details";

/** What kind of starting content the user wants in the new workspace. */
type Origin =
  | { kind: "empty" }
  | { kind: "obsidian"; vaultPath: string | null };

/** Default workspace name suggestion — keep it human, not "untitled". */
const DEFAULT_NAME = "My Yarrow";

/** Multi-step in-app modal for creating a new workspace. Replaces the bare
 *  OS folder picker with a guided flow: pick what you're starting from
 *  (empty notebook or an Obsidian vault), name it, choose where it lives,
 *  pick the mode, and (for mapped workspaces) name a starting note. */
export default function NewWorkspaceWizard({ open, onClose, onReady }: Props) {
  const [step, setStep] = useState<Step>("shape");
  const [origin, setOrigin] = useState<Origin>({ kind: "empty" });
  const [name, setName] = useState(DEFAULT_NAME);
  const [parent, setParent] = useState<string>("");
  const [mode, setMode] = useState<WorkspaceMode>("mapped");
  const [startingTitle, setStartingTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Reset to a clean state every time the wizard opens, and fetch the
  // platform's default location so the location field starts populated.
  useEffect(() => {
    if (!open) return;
    setStep("shape");
    setOrigin({ kind: "empty" });
    setName(DEFAULT_NAME);
    setMode("mapped");
    setStartingTitle("");
    setBusy(false);
    setError(null);
    setProgress(null);
    api.defaultWorkspacesRoot().then(setParent).catch(() => setParent(""));
  }, [open]);

  // Live preview of where the new workspace will end up so the user can see
  // the absolute path forming as they type.
  const previewPath = useMemo(() => {
    if (!parent || !name.trim()) return "";
    const sep = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
    const trimmed = parent.replace(/[\\/]+$/, "");
    return `${trimmed}${sep}${name.trim()}`;
  }, [parent, name]);

  if (!open) return null;

  const pickParentFolder = async () => {
    setError(null);
    try {
      const sel = await openDialog({ directory: true, multiple: false });
      if (typeof sel === "string") setParent(sel);
    } catch (e) {
      setError(String(e));
    }
  };

  const pickObsidianVault = async () => {
    setError(null);
    try {
      const sel = await openDialog({ directory: true, multiple: false });
      if (typeof sel === "string") {
        setOrigin({ kind: "obsidian", vaultPath: sel });
        // Pre-fill the workspace name from the vault folder so the user
        // doesn't have to retype it.
        const leaf = sel.split(/[\\/]/).filter(Boolean).pop();
        if (leaf) setName(leaf);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const goToDetails = () => {
    if (origin.kind === "obsidian" && !origin.vaultPath) {
      setError("Pick the Obsidian vault folder to continue.");
      return;
    }
    setError(null);
    setStep("details");
  };

  const create = async () => {
    setError(null);
    if (!parent.trim()) { setError("Pick a location for the new workspace."); return; }
    if (!name.trim()) { setError("Give the workspace a name."); return; }
    if (mode === "mapped" && origin.kind === "empty" && !startingTitle.trim()) {
      setError("Name the starting note — it's the seed of your map.");
      return;
    }
    setBusy(true);
    try {
      setProgress("Creating folder…");
      const path = await api.createWorkspaceDir(parent.trim(), name.trim());
      setProgress("Initializing workspace…");
      await api.initWorkspace(
        path,
        undefined,
        mode,
        // For Obsidian imports, leave the seed note empty — the imported
        // notes themselves are the starting material; an extra "Welcome"
        // note would just be noise.
        origin.kind === "obsidian"
          ? undefined
          : (mode === "mapped" ? (startingTitle.trim() || undefined) : undefined),
      );
      if (origin.kind === "obsidian" && origin.vaultPath) {
        setProgress("Importing your Obsidian vault…");
        const report = await api.importObsidianVault(origin.vaultPath);
        setProgress(`Imported ${report.imported} note${report.imported === 1 ? "" : "s"}.`);
      }
      onReady(path);
    } catch (e) {
      setError(String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={busy ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-bd flex items-center gap-3">
          <Logo size={28} />
          <div>
            <div className="font-serif text-2xl text-char leading-tight">Create a workspace</div>
            <div className="text-2xs text-t3 mt-0.5">
              {step === "shape"
                ? "Start from scratch, or bring notes you already have."
                : "Name it, place it, and choose how it should behave."}
            </div>
          </div>
          <div className="ml-auto text-2xs text-t3 font-mono">
            Step {step === "shape" ? "1" : "2"} of 2
          </div>
        </div>

        {step === "shape" && (
          <div className="px-6 py-5 space-y-3">
            <button
              disabled={busy}
              onClick={() => setOrigin({ kind: "empty" })}
              className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                origin.kind === "empty"
                  ? "border-yel bg-yelp/40"
                  : "border-bd hover:border-bd2 hover:bg-s1"
              }`}
            >
              <div className="font-serif text-base text-char">Start with a blank notebook</div>
              <div className="text-xs text-t2 mt-0.5">
                A fresh workspace. You'll seed it with a starting note, then branch from there.
              </div>
            </button>

            <button
              disabled={busy}
              onClick={pickObsidianVault}
              className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                origin.kind === "obsidian"
                  ? "border-yel bg-yelp/40"
                  : "border-bd hover:border-bd2 hover:bg-s1"
              }`}
            >
              <div className="flex items-baseline gap-2">
                <div className="font-serif text-base text-char">Import an Obsidian vault</div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-t3">
                  {origin.kind === "obsidian" && origin.vaultPath ? "vault selected" : "click to choose folder"}
                </span>
              </div>
              <div className="text-xs text-t2 mt-0.5">
                Copy your <code>.md</code> files in. <code>[[Wikilinks]]</code> and <code>#tags</code> are preserved;
                <code> .obsidian/</code> config is skipped.
              </div>
              {origin.kind === "obsidian" && origin.vaultPath && (
                <div className="text-2xs text-t3 font-mono mt-1.5 break-all">{origin.vaultPath}</div>
              )}
            </button>

            <div className="pt-2 text-2xs text-t3 leading-relaxed">
              More importers coming in future versions. If you've got notes in another
              tool, plain markdown drops in fine — point Yarrow at the folder later.
            </div>

            {error && <div className="text-xs text-danger mt-2">{error}</div>}

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char"
              >
                Cancel
              </button>
              <button
                onClick={goToDetails}
                className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yel2"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "details" && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-2xs uppercase tracking-wider text-t3 font-mono">
                Workspace name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Garden plan, Research, Personal"
                className="mt-1 w-full px-3 py-2 bg-s1 border border-bd rounded text-sm text-char outline-none focus:border-yel"
              />
            </div>

            <div>
              <label className="text-2xs uppercase tracking-wider text-t3 font-mono">
                Where it lives
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                  className="flex-1 px-3 py-2 bg-s1 border border-bd rounded text-sm text-char font-mono outline-none focus:border-yel"
                />
                <button
                  onClick={pickParentFolder}
                  className="px-3 py-2 bg-s2 hover:bg-s3 text-char text-xs rounded border border-bd"
                >
                  Browse…
                </button>
              </div>
              {previewPath && (
                <div className="text-2xs text-t3 font-mono mt-1.5 break-all">
                  Will create: <span className="text-char">{previewPath}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-2xs uppercase tracking-wider text-t3 font-mono">
                How will you use it?
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("mapped")}
                  className={`text-left rounded-lg border px-3 py-2.5 transition ${
                    mode === "mapped" ? "border-yel bg-yelp/40" : "border-bd hover:bg-s1"
                  }`}
                >
                  <div className="text-sm font-serif text-char">Branch path mapping</div>
                  <div className="text-2xs text-t2 mt-0.5">
                    Notes connect, paths fork, your map grows.
                  </div>
                </button>
                <button
                  onClick={() => setMode("basic")}
                  className={`text-left rounded-lg border px-3 py-2.5 transition ${
                    mode === "basic" ? "border-yel bg-yelp/40" : "border-bd hover:bg-s1"
                  }`}
                >
                  <div className="text-sm font-serif text-char">Basic notes</div>
                  <div className="text-2xs text-t2 mt-0.5">
                    Plain markdown jotter. No paths, no graph.
                  </div>
                </button>
              </div>
            </div>

            {mode === "mapped" && origin.kind === "empty" && (
              <div>
                <label className="text-2xs uppercase tracking-wider text-t3 font-mono">
                  Starting note
                </label>
                <input
                  value={startingTitle}
                  onChange={(e) => setStartingTitle(e.target.value)}
                  placeholder="The first note everything else will branch from"
                  className="mt-1 w-full px-3 py-2 bg-s1 border border-bd rounded text-sm font-serif text-char outline-none focus:border-yel"
                />
              </div>
            )}

            {origin.kind === "obsidian" && (
              <div className="text-2xs text-t2 bg-yelp/30 border border-yel/30 rounded px-3 py-2">
                Importing from <span className="font-mono break-all">{origin.vaultPath}</span>.
                A single checkpoint will record the import so you can roll back if it doesn't look right.
              </div>
            )}

            {progress && !error && (
              <div className="text-xs text-t2 italic">{progress}</div>
            )}
            {error && <div className="text-xs text-danger">{error}</div>}

            <div className="pt-2 flex justify-between items-center gap-2">
              <button
                onClick={() => setStep("shape")}
                disabled={busy}
                className="text-xs text-t3 hover:text-char"
              >
                ← Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={create}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yel2 disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create workspace"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
