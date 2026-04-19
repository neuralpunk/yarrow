import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { ObsidianImportReport } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Refresh notes after a successful import. */
  onChanged: () => void;
}

export default function ObsidianImport({ open, onClose, onChanged }: Props) {
  const [source, setSource] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ObsidianImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const pickFolder = async () => {
    setError(null);
    try {
      const sel = await openDialog({ directory: true, multiple: false });
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
      const r = await api.importObsidianVault(source);
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
      className="fixed inset-0 z-50 bg-char/30 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-bd">
          <div className="font-serif text-xl text-char">Import an Obsidian vault</div>
          <div className="text-2xs text-t3 mt-0.5 leading-relaxed">
            Pick the folder that contains your <code>.md</code> files. Yarrow copies them
            into this workspace, keeps your <code>[[wikilinks]]</code> and <code>#tags</code>,
            and records one checkpoint so you can roll back if anything looks wrong.
            <br />Hidden folders like <code>.obsidian/</code> and <code>.trash/</code> are skipped.
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <button
            onClick={pickFolder}
            disabled={running}
            className="w-full px-3 py-2 bg-s2 hover:bg-s3 text-char text-sm rounded border border-bd disabled:opacity-50"
          >
            {source ? "Pick a different folder…" : "Choose your vault folder…"}
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
                Imported <strong>{report.imported}</strong> note{report.imported === 1 ? "" : "s"}.
                {report.skipped > 0 && (
                  <> Skipped <strong>{report.skipped}</strong>.</>
                )}
              </div>
              {report.renamed.length > 0 && (
                <details className="text-2xs text-t2">
                  <summary className="cursor-pointer text-t3">
                    {report.renamed.length} renamed to avoid collisions
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
            {report ? "Done" : "Cancel"}
          </button>
          {!report && (
            <button
              disabled={!source || running}
              onClick={run}
              className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yeld disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? "Importing…" : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
