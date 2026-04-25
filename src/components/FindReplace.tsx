import { useEffect, useRef, useState } from "react";
import { api } from "../lib/tauri";
import type { FindReplaceHit } from "../lib/types";
import { useT } from "../lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional path-scope: pass the slugs in the active path. `null` = workspace. */
  currentPathSlugs?: string[] | null;
  currentPathName?: string;
  /** Re-fetch notes after a successful apply. Receives the apply summary
   *  so the caller can show its own in-app confirmation modal. */
  onChanged: (report: { changed: number; total: number }) => void;
  /** Preselect a needle from the editor (e.g. current selection). */
  initialPattern?: string;
}

type Scope = "workspace" | "path";

export default function FindReplace({
  open, onClose, currentPathSlugs, currentPathName, onChanged, initialPattern,
}: Props) {
  const [pattern, setPattern] = useState(initialPattern ?? "");
  const [replacement, setReplacement] = useState("");
  const [caseInsensitive, setCaseInsensitive] = useState(true);
  const [scope, setScope] = useState<Scope>("workspace");
  const [hits, setHits] = useState<FindReplaceHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  useEffect(() => {
    if (open) {
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounce preview while typing.
  useEffect(() => {
    if (!open) return;
    if (!pattern) { setHits(null); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const slugs = scope === "path" ? (currentPathSlugs ?? []) : null;
        const r = await api.findReplacePreview(pattern, false, caseInsensitive, slugs);
        setHits(r);
      } catch (e) {
        setError(String(e));
        setHits(null);
      } finally {
        setLoading(false);
      }
    // 300ms debounce — long enough that fast typing doesn't fire a
    // preview per character (each preview walks every note in scope),
    // short enough that the user sees results before they've forgotten
    // the query. Backend-side caps (size_limit / dfa_size_limit / max
    // pattern length) guard against pathological patterns even if the
    // preview does fire on an in-progress regex.
    }, 300);
    return () => clearTimeout(t);
  }, [pattern, caseInsensitive, scope, open, currentPathSlugs]);

  if (!open) return null;

  const totalMatches = (hits ?? []).reduce((a, h) => a + h.matches, 0);

  const [confirming, setConfirming] = useState(false);

  const apply = async () => {
    if (!hits || hits.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const slugs = scope === "path" ? (currentPathSlugs ?? []) : null;
      const report = await api.findReplaceApply(pattern, replacement, false, caseInsensitive, slugs);
      setConfirming(false);
      onClose();
      // Hand the report back so the parent shows its own native confirmation
      // modal — no browser alert().
      onChanged({ changed: report.notes_changed, total: report.total_replacements });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[85vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-bd">
          <div className="font-serif text-xl text-char">{t("modals.find.title")}</div>
          <div className="text-2xs text-t3 mt-0.5">
            {t("modals.find.subtitle")}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3 border-b border-bd">
          <div>
            <label className="text-2xs text-t3 uppercase tracking-wider font-mono">{t("modals.find.findLabel")}</label>
            <input
              ref={inputRef}
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={t("modals.find.findPlaceholder")}
              className="mt-1 w-full px-3 py-2 bg-s1 border border-bd rounded text-sm text-char outline-none focus:border-yel"
            />
          </div>
          <div>
            <label className="text-2xs text-t3 uppercase tracking-wider font-mono">{t("modals.find.replaceLabel")}</label>
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder={t("modals.find.replacePlaceholder")}
              className="mt-1 w-full px-3 py-2 bg-s1 border border-bd rounded text-sm text-char outline-none focus:border-yel"
            />
          </div>
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={caseInsensitive} onChange={(e) => setCaseInsensitive(e.target.checked)} />
              <span className="text-t2">{t("modals.find.caseInsensitive")}</span>
            </label>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-t3">{t("modals.find.scopeLabel")}</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
                className="bg-s1 border border-bd rounded px-2 py-1 text-xs text-char"
              >
                <option value="workspace">{t("modals.find.scopeWorkspace")}</option>
                {currentPathSlugs && (
                  <option value="path">{t("modals.find.scopePath", { name: currentPathName ?? t("modals.find.scopePathFallback") })}</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-5 py-2 text-xs text-danger bg-danger/10 border-b border-bd">{error}</div>
        )}

        <div className="overflow-y-auto flex-1 px-5 py-3 text-xs">
          {!pattern ? (
            <div className="text-t3 italic font-serif text-center py-8">{t("modals.find.enterTerm")}</div>
          ) : loading ? (
            <div className="text-t3 italic text-center py-8">{t("modals.find.searching")}</div>
          ) : !hits || hits.length === 0 ? (
            <div className="text-t3 italic text-center py-8">{t("modals.find.noMatches")}</div>
          ) : (
            <ul className="space-y-3">
              {hits.map((h) => (
                <li key={h.slug} className="border border-bd rounded p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-sm text-char truncate">{h.title}</div>
                    <div className="text-2xs text-t3 font-mono shrink-0">
                      {h.matches === 1 ? t("modals.find.matchSingular", { count: String(h.matches) }) : t("modals.find.matchPlural", { count: String(h.matches) })}
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-0.5 font-mono text-2xs text-t2">
                    {h.samples.map(([n, line], i) => (
                      <div key={i} className="truncate">
                        <span className="text-t3 mr-2">{n}</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd flex items-center gap-2">
          <div className="text-2xs text-t3 flex-1">
            {hits && hits.length > 0 && (() => {
              const matches = totalMatches;
              const notes = hits.length;
              if (matches === 1 && notes === 1) return t("modals.find.totalSummaryOne", { matches: String(matches), notes: String(notes) });
              if (matches !== 1 && notes !== 1) return t("modals.find.totalSummaryMany", { matches: String(matches), notes: String(notes) });
              if (matches !== 1 && notes === 1) return t("modals.find.totalSummaryMixed", { matches: String(matches), notes: String(notes) });
              return t("modals.find.totalSummaryMatchesOne", { matches: String(matches), notes: String(notes) });
            })()}
          </div>
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char"
          >
            {t("modals.find.cancel")}
          </button>
          <button
            disabled={!hits || hits.length === 0 || busy}
            onClick={() => setConfirming(true)}
            className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yeld disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("modals.find.replaceAll")}
          </button>
        </div>

        {confirming && hits && (
          <div
            className="absolute inset-0 z-10 bg-char/40 flex items-center justify-center p-6 rounded-xl"
            onClick={() => !busy && setConfirming(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-bg border border-bd2 rounded-lg shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4">
                <div className="font-serif text-lg text-char">{t("modals.find.confirmTitle")}</div>
                <div className="text-xs text-t2 mt-2 leading-relaxed">
                  {(() => {
                    const matches = totalMatches;
                    const notes = hits.length;
                    if (matches === 1 && notes === 1) return t("modals.find.confirmBodyOne", { matches: String(matches), notes: String(notes) });
                    if (matches !== 1 && notes !== 1) return t("modals.find.confirmBodyMany", { matches: String(matches), notes: String(notes) });
                    if (matches === 1 && notes !== 1) return t("modals.find.confirmBodyMixedA", { matches: String(matches), notes: String(notes) });
                    return t("modals.find.confirmBodyMixedB", { matches: String(matches), notes: String(notes) });
                  })()}
                </div>
              </div>
              <div className="px-5 py-3 border-t border-bd flex justify-end gap-2">
                <button
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                  className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char disabled:opacity-50"
                >
                  {t("modals.find.cancel")}
                </button>
                <button
                  disabled={busy}
                  onClick={apply}
                  className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yeld disabled:opacity-50"
                >
                  {busy ? t("modals.find.replacing") : t("modals.find.replaceAll")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
