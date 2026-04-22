import { useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { WorkspaceMode } from "../lib/types";
import { YarrowMark } from "./YarrowMark";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called once the workspace is fully initialized and (optionally)
   *  imported into. The shell can then open it. */
  onReady: (path: string) => void;
}

type Step = "shape" | "details";

/** What kind of starting content the user wants in the new workspace.
 *  The four import origins all share the same "pick a folder, run a
 *  parser" shape — the only difference is which backend command fires. */
type ImportSource = "obsidian" | "bear" | "logseq" | "notion";

type Origin =
  | { kind: "empty" }
  | { kind: "import"; source: ImportSource; vaultPath: string | null };

const IMPORT_SOURCES: Array<{
  id: ImportSource;
  label: string;
  tagline: string;
  pickHelp: string;
}> = [
  {
    id: "obsidian",
    label: "Obsidian",
    tagline: "a folder of .md files, often with a hidden .obsidian/ sibling",
    pickHelp: "Pick the folder that IS your vault.",
  },
  {
    id: "bear",
    label: "Bear",
    tagline: "an exported folder of .md files — no frontmatter, tags live inline",
    pickHelp: "Pick the folder Bear's Markdown export created.",
  },
  {
    id: "logseq",
    label: "Logseq",
    tagline: "a graph folder containing pages/ and journals/ subfolders",
    pickHelp: "Pick the top-level graph folder (with pages/).",
  },
  {
    id: "notion",
    label: "Notion",
    tagline: "the extracted Markdown & CSV export — Notion IDs get stripped",
    pickHelp: "Pick the folder you extracted from Notion's export zip.",
  },
];

/** Default workspace name suggestion — keep it human, not "untitled". */
const DEFAULT_NAME = "My Yarrow";

/** Multi-step in-app modal for creating a new workspace. Replaces the bare
 *  OS folder picker with a guided flow: pick what you're starting from
 *  (empty notebook or an import from Obsidian / Bear / Logseq / Notion),
 *  name it, choose where it lives, pick the mode, and (for mapped
 *  workspaces) name a starting note. */
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

  /** Stage a source for import without opening the OS picker yet —
   *  gives the user a chance to read the source's tagline and pick-help
   *  before they're yanked into the native folder dialog. The actual
   *  OS picker fires only when they click "Browse for folder…". */
  const selectImportSource = (source: ImportSource) => {
    setError(null);
    // Preserve any previously-picked path if the user re-selects the
    // same source (avoids erasing their folder choice on accidental
    // click), but clear it when switching sources since the path is
    // source-specific.
    setOrigin((prev) => {
      if (prev.kind === "import" && prev.source === source) return prev;
      return { kind: "import", source, vaultPath: null };
    });
  };

  const pickImportFolder = async () => {
    if (origin.kind !== "import") return;
    setError(null);
    try {
      const sel = await openDialog({ directory: true, multiple: false });
      if (typeof sel === "string") {
        setOrigin({ kind: "import", source: origin.source, vaultPath: sel });
        const leaf = sel.split(/[\\/]/).filter(Boolean).pop();
        if (leaf) setName(leaf);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const goToDetails = () => {
    if (origin.kind === "import" && !origin.vaultPath) {
      setError("Pick the source folder to continue.");
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
        // When importing, leave the seed note empty — the imported
        // notes themselves are the starting material; an extra "Welcome"
        // note would just be noise.
        origin.kind === "import"
          ? undefined
          : (mode === "mapped" ? (startingTitle.trim() || undefined) : undefined),
      );
      if (origin.kind === "import" && origin.vaultPath) {
        const sourceMeta = IMPORT_SOURCES.find((s) => s.id === origin.source)!;
        setProgress(`Importing your ${sourceMeta.label} vault…`);
        const report = await (origin.source === "obsidian"
          ? api.importObsidianVault(origin.vaultPath)
          : origin.source === "bear"
            ? api.importBearVault(origin.vaultPath)
            : origin.source === "logseq"
              ? api.importLogseqVault(origin.vaultPath)
              : api.importNotionVault(origin.vaultPath));
        setProgress(
          `Imported ${report.imported} note${report.imported === 1 ? "" : "s"} from ${sourceMeta.label}.`,
        );
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
          <YarrowMark size={28} />
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

            <div
              className={`rounded-lg border px-4 py-3 transition ${
                origin.kind === "import"
                  ? "border-yel bg-yelp/40"
                  : "border-bd"
              }`}
            >
              <div className="flex items-baseline gap-2">
                <div className="font-serif text-base text-char">Import from another app</div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-t3">
                  {origin.kind === "import" && origin.vaultPath
                    ? `${origin.source} folder selected`
                    : "pick a source"}
                </span>
              </div>
              <div className="text-xs text-t2 mt-0.5">
                Copy your notes in. <code>[[Wikilinks]]</code> and <code>#tags</code>{" "}
                are preserved; per-app config folders are skipped.
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {IMPORT_SOURCES.map((s) => {
                  const active =
                    origin.kind === "import" && origin.source === s.id;
                  return (
                    <button
                      key={s.id}
                      disabled={busy}
                      onClick={() => selectImportSource(s.id)}
                      className={`px-2 py-1.5 text-xs rounded border transition ${
                        active
                          ? "bg-char text-bg border-char"
                          : "bg-bg text-t2 border-bd hover:bg-s2 hover:text-char"
                      }`}
                      title={s.tagline}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {origin.kind === "import" && (
                <div className="mt-3 rounded-md bg-bg border border-bd px-3 py-2.5 space-y-2">
                  <div className="text-2xs font-serif italic text-t3 leading-relaxed">
                    {IMPORT_SOURCES.find((s) => s.id === origin.source)!.tagline}
                  </div>
                  <div className="text-xs text-char leading-relaxed">
                    {IMPORT_SOURCES.find((s) => s.id === origin.source)!.pickHelp}
                  </div>
                  {origin.vaultPath && (
                    <div className="text-2xs text-t3 font-mono break-all bg-s1 rounded px-2 py-1">
                      {origin.vaultPath}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      onClick={pickImportFolder}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 rounded bg-char text-bg hover:bg-yeld transition disabled:opacity-50"
                    >
                      {origin.vaultPath ? "Pick a different folder…" : "Browse for folder…"}
                    </button>
                    {origin.vaultPath && (
                      <span className="text-2xs text-t3 italic">
                        folder selected — you can also re-pick
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 text-2xs text-t3 leading-relaxed">
              Already have plain markdown? It drops in fine — point Yarrow at that
              folder after creating the workspace.
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

            {origin.kind === "import" && (
              <div className="text-2xs text-t2 bg-yelp/30 border border-yel/30 rounded px-3 py-2">
                Importing from{" "}
                <span className="font-serif italic text-char">
                  {IMPORT_SOURCES.find((s) => s.id === origin.source)!.label}
                </span>
                :{" "}
                <span className="font-mono break-all">{origin.vaultPath}</span>.
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
