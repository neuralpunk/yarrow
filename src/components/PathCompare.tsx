import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/tauri";
import type { PathComparison, PathDiffStatus } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Available path names to choose from. */
  paths: string[];
  /** Optional pre-selected pair (e.g. current path on the left). */
  initialLeft?: string;
  initialRight?: string;
}

const STATUS_LABEL: Record<PathDiffStatus, string> = {
  added: "Added",
  removed: "Removed",
  modified: "Changed",
  same: "Same",
};
const STATUS_TONE: Record<PathDiffStatus, string> = {
  added: "text-green-700 dark:text-green-400",
  removed: "text-red-700 dark:text-red-400",
  modified: "text-amber-700 dark:text-amber-400",
  same: "text-t3",
};

export default function PathCompare({ open, onClose, paths, initialLeft, initialRight }: Props) {
  const [left, setLeft] = useState<string>(initialLeft ?? paths[0] ?? "main");
  const [right, setRight] = useState<string>(
    initialRight ?? (paths.find((p) => p !== (initialLeft ?? paths[0]))) ?? paths[1] ?? paths[0] ?? "main"
  );
  const [comparison, setComparison] = useState<PathComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideUnchanged, setHideUnchanged] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (!left || !right) { setComparison(null); return; }
    setLoading(true);
    setError(null);
    api.comparePaths(left, right)
      .then(setComparison)
      .catch((e) => { setError(String(e)); setComparison(null); })
      .finally(() => setLoading(false));
  }, [left, right, open]);

  const visible = useMemo(() => {
    if (!comparison) return [];
    return hideUnchanged
      ? comparison.entries.filter((e) => e.status !== "same")
      : comparison.entries;
  }, [comparison, hideUnchanged]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-[85vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-bd flex items-center gap-3">
          <div>
            <div className="font-serif text-xl text-char">Compare paths</div>
            <div className="text-2xs text-t3 mt-0.5">
              See which notes differ between two directions of thought.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <select
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              className="bg-s1 border border-bd rounded px-2 py-1 text-char"
            >
              {paths.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="text-t3">↔</span>
            <select
              value={right}
              onChange={(e) => setRight(e.target.value)}
              className="bg-s1 border border-bd rounded px-2 py-1 text-char"
            >
              {paths.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <label className="ml-3 flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={hideUnchanged} onChange={(e) => setHideUnchanged(e.target.checked)} />
              <span className="text-t2">Hide identical</span>
            </label>
          </div>
        </div>

        {comparison && (
          <div className="px-5 py-2 text-2xs text-t3 font-mono border-b border-bd flex gap-4">
            <span><span className="text-green-700 dark:text-green-400">+{comparison.summary.added}</span> only on {right}</span>
            <span><span className="text-red-700 dark:text-red-400">−{comparison.summary.removed}</span> only on {left}</span>
            <span><span className="text-amber-700 dark:text-amber-400">~{comparison.summary.modified}</span> changed</span>
            <span className="text-t3">={comparison.summary.same} same</span>
          </div>
        )}

        {error && (
          <div className="px-5 py-2 text-xs text-danger bg-danger/10 border-b border-bd">{error}</div>
        )}

        <div className="grid grid-cols-[1fr_1fr] gap-px bg-bd flex-1 overflow-hidden">
          <div className="bg-bg overflow-y-auto">
            <div className="sticky top-0 bg-bg/95 backdrop-blur px-3 py-1.5 text-2xs text-t3 font-mono uppercase tracking-wider border-b border-bd">
              {left}
            </div>
            {loading ? (
              <div className="p-6 text-center text-t3 italic font-serif text-sm">Comparing…</div>
            ) : visible.length === 0 ? (
              <div className="p-6 text-center text-t3 italic font-serif text-sm">
                {comparison ? "These paths are identical." : "Pick two paths to compare."}
              </div>
            ) : (
              <ul>
                {visible.map((e) => (
                  <li key={e.slug} className="border-b border-bd/60 px-3 py-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-2xs font-mono uppercase tracking-wider ${STATUS_TONE[e.status]}`}>
                        {STATUS_LABEL[e.status]}
                      </span>
                      <span className="text-xs text-char truncate">{e.slug}</span>
                      <span className="text-2xs text-t3 ml-auto">{e.left_lines}L</span>
                    </div>
                    <pre className="text-2xs text-t2 font-mono whitespace-pre-wrap leading-snug max-h-32 overflow-hidden">
                      {e.left_excerpt ?? <span className="italic text-t3">— not present —</span>}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-bg overflow-y-auto">
            <div className="sticky top-0 bg-bg/95 backdrop-blur px-3 py-1.5 text-2xs text-t3 font-mono uppercase tracking-wider border-b border-bd">
              {right}
            </div>
            {loading ? null : (
              <ul>
                {visible.map((e) => (
                  <li key={e.slug} className="border-b border-bd/60 px-3 py-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-2xs font-mono uppercase tracking-wider ${STATUS_TONE[e.status]}`}>
                        {STATUS_LABEL[e.status]}
                      </span>
                      <span className="text-xs text-char truncate">{e.slug}</span>
                      <span className="text-2xs text-t3 ml-auto">{e.right_lines}L</span>
                    </div>
                    <pre className="text-2xs text-t2 font-mono whitespace-pre-wrap leading-snug max-h-32 overflow-hidden">
                      {e.right_excerpt ?? <span className="italic text-t3">— not present —</span>}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-bd flex justify-end">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
