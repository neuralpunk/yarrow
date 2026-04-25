import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { ObsidianImportReport } from "../lib/types";
import { useT, type StringKey } from "../lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Refresh notes after a successful import. */
  onChanged: () => void;
}

type Format = "obsidian" | "bear" | "logseq" | "notion" | "bibtex";

const FORMATS: Array<{
  id: Format;
  labelKey: StringKey;
  taglineKey: StringKey;
  pickHelpKey: StringKey;
  /** Whether the picker should pick a single file (true) or a directory
   *  (false / undefined). BibTeX takes a `.bib` file; everything else
   *  is a vault directory. */
  pickFile?: boolean;
}> = [
  {
    id: "obsidian",
    labelKey: "modals.import.obsidianLabel",
    taglineKey: "modals.import.obsidianTagline",
    pickHelpKey: "modals.import.obsidianPickHelp",
  },
  {
    id: "bear",
    labelKey: "modals.import.bearLabel",
    taglineKey: "modals.import.bearTagline",
    pickHelpKey: "modals.import.bearPickHelp",
  },
  {
    id: "logseq",
    labelKey: "modals.import.logseqLabel",
    taglineKey: "modals.import.logseqTagline",
    pickHelpKey: "modals.import.logseqPickHelp",
  },
  {
    id: "notion",
    labelKey: "modals.import.notionLabel",
    taglineKey: "modals.import.notionTagline",
    pickHelpKey: "modals.import.notionPickHelp",
  },
  {
    id: "bibtex",
    labelKey: "modals.import.bibtexLabel",
    taglineKey: "modals.import.bibtexTagline",
    pickHelpKey: "modals.import.bibtexPickHelp",
    pickFile: true,
  },
];

export default function ObsidianImport({ open, onClose, onChanged }: Props) {
  const [format, setFormat] = useState<Format>("obsidian");
  const [source, setSource] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ObsidianImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    // Fresh session every time the modal opens — prior state would be
    // confusing if the user imported one vault then wanted to import
    // another.
    setFormat("obsidian");
    setSource(null);
    setRunning(false);
    setReport(null);
    setError(null);
  }, [open]);

  if (!open) return null;

  const activeMeta = FORMATS.find((f) => f.id === format)!;

  const pickFolder = async () => {
    setError(null);
    try {
      const sel = await openDialog({
        directory: !activeMeta.pickFile,
        multiple: false,
        filters: activeMeta.pickFile
          ? [{ name: "BibTeX", extensions: ["bib", "bibtex"] }]
          : undefined,
      });
      if (typeof sel === "string") setSource(sel);
    } catch (e) {
      setError(String(e));
    }
  };

  const run = async () => {
    if (!source) return;
    setRunning(true);
    setError(null);
    try {
      const r = await (format === "obsidian"
        ? api.importObsidianVault(source)
        : format === "bear"
          ? api.importBearVault(source)
          : format === "logseq"
            ? api.importLogseqVault(source)
            : format === "notion"
              ? api.importNotionVault(source)
              : api.importBibtex(source));
      setReport(r);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-bd">
          <div className="font-serif text-xl text-char">{t("modals.import.title")}</div>
          <div className="text-2xs text-t3 mt-0.5 leading-relaxed">
            {t("modals.import.subtitle")}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <div className="font-serif italic text-2xs text-t3 mb-1.5">{t("modals.import.sourceHeading")}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setFormat(f.id); setReport(null); setSource(null); setError(null); }}
                  disabled={running}
                  className={`px-2 py-1.5 text-xs rounded-md border transition ${
                    format === f.id
                      ? "bg-char text-bg border-char"
                      : "bg-s1 text-t2 border-bd hover:bg-s2 hover:text-char"
                  } disabled:opacity-40`}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
            <div className="text-2xs text-t3 italic font-serif mt-2 leading-relaxed">
              {t(activeMeta.taglineKey)}
            </div>
          </div>

          <button
            onClick={pickFolder}
            disabled={running}
            className="w-full px-3 py-2 bg-s2 hover:bg-s3 text-char text-sm rounded border border-bd disabled:opacity-50"
          >
            {source ? t("modals.import.pickAgain") : t(activeMeta.pickHelpKey)}
          </button>
          {source && (
            <div className="text-2xs text-t3 font-mono break-all px-1">{source}</div>
          )}
          {error && (
            <div className="text-xs text-danger bg-danger/10 px-3 py-2 rounded">{error}</div>
          )}
          {report && (
            <div className="text-xs text-char bg-yelp/40 border border-yel/30 px-3 py-2 rounded space-y-1">
              <div>
                {report.imported === 1
                  ? t("modals.import.importedOne", { imported: String(report.imported), source: t(activeMeta.labelKey) })
                  : t("modals.import.importedMany", { imported: String(report.imported), source: t(activeMeta.labelKey) })}
                {report.skipped > 0 && (
                  <> {t("modals.import.skipped", { skipped: String(report.skipped) })}</>
                )}
              </div>
              {report.renamed.length > 0 && (
                <details className="text-2xs text-t2">
                  <summary className="cursor-pointer text-t3">
                    {t("modals.import.renamedSummary", { count: String(report.renamed.length) })}
                  </summary>
                  <ul className="mt-1 max-h-32 overflow-y-auto font-mono space-y-0.5">
                    {report.renamed.map(([orig, slug]) => (
                      <li key={orig} className="truncate">
                        {orig} → <span className="text-char">{slug}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char"
          >
            {report ? t("modals.import.done") : t("modals.import.cancel")}
          </button>
          {!report && (
            <button
              disabled={!source || running}
              onClick={run}
              className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yeld disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? t("modals.import.importing") : t("modals.import.importFromAction", { source: t(activeMeta.labelKey) })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
