import { useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { WorkspaceMode } from "../lib/types";
import { YarrowMark } from "./YarrowMark";
import { useT } from "../lib/i18n";

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

/** Each import source has a brand-name label (always verbatim) plus a
 *  pair of i18n keys for its tagline + pick-help copy. The `id` is used
 *  to pick which backend importer to run; nothing else. */
const IMPORT_SOURCES: Array<{
  id: ImportSource;
  label: string;
  taglineKey:
    | "wizard.import.obsidian.tagline"
    | "wizard.import.bear.tagline"
    | "wizard.import.logseq.tagline"
    | "wizard.import.notion.tagline";
  pickHelpKey:
    | "wizard.import.obsidian.pickHelp"
    | "wizard.import.bear.pickHelp"
    | "wizard.import.logseq.pickHelp"
    | "wizard.import.notion.pickHelp";
}> = [
  {
    id: "obsidian",
    label: "Obsidian",
    taglineKey: "wizard.import.obsidian.tagline",
    pickHelpKey: "wizard.import.obsidian.pickHelp",
  },
  {
    id: "bear",
    label: "Bear",
    taglineKey: "wizard.import.bear.tagline",
    pickHelpKey: "wizard.import.bear.pickHelp",
  },
  {
    id: "logseq",
    label: "Logseq",
    taglineKey: "wizard.import.logseq.tagline",
    pickHelpKey: "wizard.import.logseq.pickHelp",
  },
  {
    id: "notion",
    label: "Notion",
    taglineKey: "wizard.import.notion.tagline",
    pickHelpKey: "wizard.import.notion.pickHelp",
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
  const t = useT();
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
      setError(t("wizard.error.pickSourceFolder"));
      return;
    }
    setError(null);
    setStep("details");
  };

  const create = async () => {
    setError(null);
    if (!parent.trim()) { setError(t("wizard.error.pickLocation")); return; }
    if (!name.trim()) { setError(t("wizard.error.giveName")); return; }
    if (mode === "mapped" && origin.kind === "empty" && !startingTitle.trim()) {
      setError(t("wizard.error.nameStartingNote"));
      return;
    }
    setBusy(true);
    try {
      setProgress(t("wizard.progress.creatingFolder"));
      const path = await api.createWorkspaceDir(parent.trim(), name.trim());
      setProgress(t("wizard.progress.initializing"));
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
        setProgress(t("wizard.progress.importing", { source: sourceMeta.label }));
        const report = await (origin.source === "obsidian"
          ? api.importObsidianVault(origin.vaultPath)
          : origin.source === "bear"
            ? api.importBearVault(origin.vaultPath)
            : origin.source === "logseq"
              ? api.importLogseqVault(origin.vaultPath)
              : api.importNotionVault(origin.vaultPath));
        // Singular vs plural is locale-sensitive, so we ship two keys
        // and pick the right one rather than splicing English "(s)"
        // directly into translated copy.
        setProgress(
          report.imported === 1
            ? t("wizard.progress.importedOne", { source: sourceMeta.label })
            : t("wizard.progress.importedMany", {
                count: String(report.imported),
                source: sourceMeta.label,
              }),
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
      className="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
      onClick={busy ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-bd flex items-center gap-3">
          <YarrowMark size={28} />
          <div>
            <div className="font-serif text-2xl text-char leading-tight">
              {t("wizard.title")}
            </div>
            <div className="text-2xs text-t3 mt-0.5">
              {step === "shape"
                ? t("wizard.subtitle.shape")
                : t("wizard.subtitle.details")}
            </div>
          </div>
          <div className="ml-auto text-2xs text-t3 font-mono">
            {t("wizard.stepIndicator", {
              current: step === "shape" ? "1" : "2",
              total: "2",
            })}
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
              <div className="font-serif text-base text-char">
                {t("wizard.shape.blank.title")}
              </div>
              <div className="text-xs text-t2 mt-0.5">
                {t("wizard.shape.blank.body")}
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
                <div className="font-serif text-base text-char">
                  {t("wizard.shape.import.title")}
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-t3">
                  {origin.kind === "import" && origin.vaultPath
                    ? t("wizard.shape.import.statusFolderSelected", {
                        source: origin.source,
                      })
                    : t("wizard.shape.import.statusPickSource")}
                </span>
              </div>
              <div className="text-xs text-t2 mt-0.5">
                {/* The body has two inline `<code>` chunks — `[[Wikilinks]]`
                    and `#tags`. We split the translated string on its
                    `{wikilinks}` / `{tags}` placeholders and stitch the
                    code spans back in so translators don't have to ship
                    raw HTML. */}
                {splitWithMarkers(t("wizard.shape.import.body"), [
                  "{wikilinks}",
                  "{tags}",
                ]).map((part, i) => {
                  if (part === "{wikilinks}")
                    return <code key={i}>[[Wikilinks]]</code>;
                  if (part === "{tags}") return <code key={i}>#tags</code>;
                  return <span key={i}>{part}</span>;
                })}
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
                      title={t(s.taglineKey)}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {origin.kind === "import" && (
                <div className="mt-3 rounded-md bg-bg border border-bd px-3 py-2.5 space-y-2">
                  <div className="text-2xs font-serif italic text-t3 leading-relaxed">
                    {t(
                      IMPORT_SOURCES.find((s) => s.id === origin.source)!
                        .taglineKey,
                    )}
                  </div>
                  <div className="text-xs text-char leading-relaxed">
                    {t(
                      IMPORT_SOURCES.find((s) => s.id === origin.source)!
                        .pickHelpKey,
                    )}
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
                      {origin.vaultPath
                        ? t("wizard.shape.import.pickAnotherFolder")
                        : t("wizard.shape.import.pickFolder")}
                    </button>
                    {origin.vaultPath && (
                      <span className="text-2xs text-t3 italic">
                        {t("wizard.shape.import.folderSelectedHint")}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 text-2xs text-t3 leading-relaxed">
              {t("wizard.shape.alreadyMarkdown")}
            </div>

            {error && <div className="text-xs text-danger mt-2">{error}</div>}

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char"
              >
                {t("wizard.button.cancel")}
              </button>
              <button
                onClick={goToDetails}
                className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yel2"
              >
                {t("wizard.button.next")}
              </button>
            </div>
          </div>
        )}

        {step === "details" && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-2xs uppercase tracking-wider text-t3 font-mono">
                {t("wizard.details.nameLabel")}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("wizard.details.namePlaceholder")}
                className="mt-1 w-full px-3 py-2 bg-s1 border border-bd rounded text-sm text-char outline-none focus:border-yel"
              />
            </div>

            <div>
              <label className="text-2xs uppercase tracking-wider text-t3 font-mono">
                {t("wizard.details.locationLabel")}
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
                  {t("wizard.details.locationBrowse")}
                </button>
              </div>
              {previewPath && (
                <div className="text-2xs text-t3 font-mono mt-1.5 break-all">
                  {t("wizard.details.willCreate")}{" "}
                  <span className="text-char">{previewPath}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-2xs uppercase tracking-wider text-t3 font-mono">
                {t("wizard.details.modeLabel")}
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("mapped")}
                  className={`text-left rounded-lg border px-3 py-2.5 transition ${
                    mode === "mapped" ? "border-yel bg-yelp/40" : "border-bd hover:bg-s1"
                  }`}
                >
                  <div className="text-sm font-serif text-char">
                    {t("wizard.details.mode.mapped.title")}
                  </div>
                  <div className="text-2xs text-t2 mt-0.5">
                    {t("wizard.details.mode.mapped.body")}
                  </div>
                </button>
                <button
                  onClick={() => setMode("basic")}
                  className={`text-left rounded-lg border px-3 py-2.5 transition ${
                    mode === "basic" ? "border-yel bg-yelp/40" : "border-bd hover:bg-s1"
                  }`}
                >
                  <div className="text-sm font-serif text-char">
                    {t("wizard.details.mode.basic.title")}
                  </div>
                  <div className="text-2xs text-t2 mt-0.5">
                    {t("wizard.details.mode.basic.body")}
                  </div>
                </button>
              </div>
            </div>

            {mode === "mapped" && origin.kind === "empty" && (
              <div>
                <label className="text-2xs uppercase tracking-wider text-t3 font-mono">
                  {t("wizard.details.startingNoteLabel")}
                </label>
                <input
                  value={startingTitle}
                  onChange={(e) => setStartingTitle(e.target.value)}
                  placeholder={t("wizard.details.startingNotePlaceholder")}
                  className="mt-1 w-full px-3 py-2 bg-s1 border border-bd rounded text-sm font-serif text-char outline-none focus:border-yel"
                />
              </div>
            )}

            {origin.kind === "import" && (
              <div className="text-2xs text-t2 bg-yelp/30 border border-yel/30 rounded px-3 py-2">
                {/* Banner copy embeds the brand-name source and the
                    monospaced vault path — both styled inline. We split
                    on `{source}` / `{path}` markers and re-style each
                    fragment. */}
                {splitWithMarkers(t("wizard.details.importBanner"), [
                  "{source}",
                  "{path}",
                ]).map((part, i) => {
                  if (part === "{source}") {
                    return (
                      <span
                        key={i}
                        className="font-serif italic text-char"
                      >
                        {
                          IMPORT_SOURCES.find((s) => s.id === origin.source)!
                            .label
                        }
                      </span>
                    );
                  }
                  if (part === "{path}") {
                    return (
                      <span key={i} className="font-mono break-all">
                        {origin.vaultPath}
                      </span>
                    );
                  }
                  return <span key={i}>{part}</span>;
                })}
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
                {t("wizard.button.back")}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char disabled:opacity-50"
                >
                  {t("wizard.button.cancel")}
                </button>
                <button
                  onClick={create}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yel2 disabled:opacity-50"
                >
                  {busy
                    ? t("wizard.button.creating")
                    : t("wizard.button.create")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Split a template string on a list of literal markers, preserving
 *  the markers themselves in the output so callers can render each
 *  piece (text vs marker) however they like. Mirrors the helper in
 *  `Onboarding.tsx` — kept local to avoid a cross-component import
 *  for one small utility. */
function splitWithMarkers(s: string, markers: string[]): string[] {
  let parts: string[] = [s];
  for (const m of markers) {
    const next: string[] = [];
    for (const p of parts) {
      const segs = p.split(m);
      for (let i = 0; i < segs.length; i++) {
        if (i > 0) next.push(m);
        next.push(segs[i]);
      }
    }
    parts = next;
  }
  return parts.filter((p) => p !== "");
}
