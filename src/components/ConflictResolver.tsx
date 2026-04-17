import { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { ConflictContent } from "../lib/types";
import Modal from "./Modal";

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
        <div className="text-t2">Loading conflict…</div>
      </div>
    );
  }

  const displayName = cur.replace(/^notes\//, "").replace(/\.md$/, "");

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col animate-fadeIn">
      <div className="px-6 py-4 border-b border-bd flex items-center">
        <div>
          <div className="font-serif text-2xl text-char">
            Your thinking diverged here
          </div>
          <div className="text-sm text-t2 mt-1">
            You wrote different things about <span className="font-medium text-char">{displayName}</span> on
            {" "}<span className="px-1.5 py-0.5 bg-yelp text-yeld rounded-sm text-xs">{currentPath}</span>
            {" "}and{" "}<span className="px-1.5 py-0.5 bg-s3 text-ch2 rounded-sm text-xs">{otherPath}</span>.
            Which version feels right now? Or combine them.
          </div>
        </div>
        <div className="ml-auto text-xs text-t3">
          {idx + 1} of {relpaths.length}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <Pane
          title={`On ${currentPath}`}
          subtitle="your current version"
          content={conflict.ours ?? "(this path has no version)"}
          accentClass="border-yel/60"
          onAccept={() => setCombined(conflict.ours ?? "")}
          acceptLabel="Use this one"
        />
        <Pane
          title={`On ${otherPath}`}
          subtitle="version being brought in"
          content={conflict.theirs ?? "(this path has no version)"}
          accentClass="border-ch2/60"
          onAccept={() => setCombined(conflict.theirs ?? "")}
          acceptLabel="Use this one"
        />
        <div className="flex-1 min-w-0 flex flex-col border-l border-bd bg-s1/60">
          <div className="px-4 py-2 border-b border-bd">
            <div className="text-2xs uppercase tracking-wider text-t3">Combined version</div>
            <div className="text-xs text-t2">This is what will be saved — edit freely.</div>
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
          Stop and go back
        </button>
        <div className="ml-auto flex gap-2">
          <button
            disabled={busy}
            onClick={accept}
            className="px-4 py-1.5 text-sm bg-yel text-char rounded hover:bg-yel2 disabled:opacity-50"
          >
            {idx === relpaths.length - 1 ? "Save — bring together" : "Save this one & continue"}
          </button>
        </div>
      </div>

      <Modal
        open={confirmAbort}
        onClose={() => setConfirmAbort(false)}
        title="Stop bringing these paths together?"
      >
        <p className="text-sm text-t2 mb-4 leading-relaxed">
          Your in-progress changes for this merge will be rolled back. The
          original contents on each path stay exactly as they were.
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setConfirmAbort(false)}
          >
            keep merging
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onClick={confirmAbortNow}
          >
            yes, stop
          </button>
        </div>
      </Modal>
    </div>
  );
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
