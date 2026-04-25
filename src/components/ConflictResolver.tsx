import { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { ConflictContent } from "../lib/types";
import Modal from "./Modal";
import { useT } from "../lib/i18n";

interface Props {
  relpaths: string[];
  currentPath: string;
  otherPath: string;
  onResolvedAll: () => void;
  onAbort: () => void;
}

export default function ConflictResolver({
  relpaths,
  currentPath,
  otherPath,
  onResolvedAll,
  onAbort,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [conflict, setConflict] = useState<ConflictContent | null>(null);
  const [combined, setCombined] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const t = useT();

  const cur = relpaths[idx];

  useEffect(() => {
    setError(null);
    if (!cur) return;
    api.getConflict(cur).then((c) => {
      setConflict(c);
      setCombined(c.working ?? c.ours ?? c.theirs ?? "");
    }).catch((e) => setError(String(e)));
  }, [cur]);

  const accept = async () => {
    if (!cur) return;
    setBusy(true);
    try {
      await api.resolveConflict(cur, combined);
      if (idx === relpaths.length - 1) {
        await api.finalizeMerge();
        onResolvedAll();
      } else {
        setIdx(idx + 1);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const abort = () => setConfirmAbort(true);

  const confirmAbortNow = async () => {
    setConfirmAbort(false);
    await api.abortMerge();
    onAbort();
  };

  if (!cur || !conflict) {
    return (
      <div className="fixed inset-0 z-50 bg-bg flex items-center justify-center">
        <div className="text-t2">{t("paths.conflict.loading")}</div>
      </div>
    );
  }

  const displayName = cur.replace(/^notes\//, "").replace(/\.md$/, "");

  // Body line "You wrote different things about {name} on {currentPath} and
  // {otherPath}…" — split on each marker so we can render each piece with
  // its own styling. Keeps translators from having to ship raw HTML.
  const bodyTpl = t("paths.conflict.body");
  const bodyParts = splitWithMarkers(bodyTpl, ["{name}", "{currentPath}", "{otherPath}"]);

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col animate-fadeIn">
      <div className="px-6 py-4 border-b border-bd flex items-center">
        <div>
          <div className="font-serif text-2xl text-char">
            {t("paths.conflict.heading")}
          </div>
          <div className="text-sm text-t2 mt-1">
            {bodyParts.map((p, i) => {
              if (p === "{name}") {
                return <span key={i} className="font-medium text-char">{displayName}</span>;
              }
              if (p === "{currentPath}") {
                return (
                  <span key={i} className="px-1.5 py-0.5 bg-yelp text-yeld rounded-sm text-xs">
                    {currentPath}
                  </span>
                );
              }
              if (p === "{otherPath}") {
                return (
                  <span key={i} className="px-1.5 py-0.5 bg-s3 text-ch2 rounded-sm text-xs">
                    {otherPath}
                  </span>
                );
              }
              return <span key={i}>{p}</span>;
            })}
          </div>
        </div>
        <div className="ml-auto text-xs text-t3">
          {t("paths.conflict.progress", { idx: String(idx + 1), total: String(relpaths.length) })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <Pane
          title={t("paths.conflict.onPath", { name: currentPath })}
          subtitle={t("paths.conflict.subtitleOurs")}
          content={conflict.ours ?? t("paths.conflict.noVersion")}
          accentClass="border-yel/60"
          onAccept={() => setCombined(conflict.ours ?? "")}
          acceptLabel={t("paths.conflict.useThis")}
        />
        <Pane
          title={t("paths.conflict.onPath", { name: otherPath })}
          subtitle={t("paths.conflict.subtitleTheirs")}
          content={conflict.theirs ?? t("paths.conflict.noVersion")}
          accentClass="border-ch2/60"
          onAccept={() => setCombined(conflict.theirs ?? "")}
          acceptLabel={t("paths.conflict.useThis")}
        />
        <div className="flex-1 min-w-0 flex flex-col border-l border-bd bg-s1/60">
          <div className="px-4 py-2 border-b border-bd">
            <div className="text-2xs uppercase tracking-wider text-t3">{t("paths.conflict.combinedHeading")}</div>
            <div className="text-xs text-t2">{t("paths.conflict.combinedHelp")}</div>
          </div>
          <textarea
            value={combined}
            onChange={(e) => setCombined(e.target.value)}
            className="flex-1 w-full p-4 bg-bg text-char outline-none resize-none font-mono text-xs leading-relaxed"
          />
        </div>
      </div>

      {error && (
        <div className="px-6 py-2 bg-danger/10 text-danger text-xs">{error}</div>
      )}

      <div className="px-6 py-3 border-t border-bd flex items-center gap-3">
        <button
          onClick={abort}
          className="text-xs text-t2 hover:text-char"
        >
          {t("paths.conflict.stop")}
        </button>
        <div className="ml-auto flex gap-2">
          <button
            disabled={busy}
            onClick={accept}
            className="px-4 py-1.5 text-sm bg-yel text-on-yel rounded hover:bg-yel2 disabled:opacity-50"
          >
            {idx === relpaths.length - 1 ? t("paths.conflict.acceptFinal") : t("paths.conflict.acceptNext")}
          </button>
        </div>
      </div>

      <Modal
        open={confirmAbort}
        onClose={() => setConfirmAbort(false)}
        title={t("paths.conflict.abortTitle")}
      >
        <p className="text-sm text-t2 mb-4 leading-relaxed">
          {t("paths.conflict.abortBody")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConfirmAbort(false)}
          >
            {t("paths.conflict.abortKeep")}
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onClick={confirmAbortNow}
          >
            {t("paths.conflict.abortConfirm")}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/// Split a template string on a list of literal markers, preserving the
/// markers in the output so callers can render each segment differently
/// (text vs styled span) without forcing raw HTML through translations.
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

function Pane({
  title,
  subtitle,
  content,
  accentClass,
  onAccept,
  acceptLabel,
}: {
  title: string;
  subtitle: string;
  content: string;
  accentClass: string;
  onAccept: () => void;
  acceptLabel: string;
}) {
  return (
    <div className={`w-1/3 min-w-0 flex flex-col border-l ${accentClass}`}>
      <div className="px-4 py-2 border-b border-bd flex items-center">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-char font-medium truncate">{title}</div>
          <div className="text-2xs text-t3">{subtitle}</div>
        </div>
        <button
          onClick={onAccept}
          className="ml-2 px-2 py-1 text-2xs bg-s2 text-ch2 rounded hover:bg-s3 whitespace-nowrap"
        >
          {acceptLabel}
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap text-ch2 bg-bg/60">
        {content}
      </pre>
    </div>
  );
}
