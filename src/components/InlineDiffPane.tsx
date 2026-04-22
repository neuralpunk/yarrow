// Inline diff view for a single note — shows "main vs this path" right in
// the editor surface, without opening the compare modal. Read-only.
//
// Mounted by AppShell in place of the editor when `inlineDiff` is toggled
// on and we're on a non-root path. Shares the five friendly diff views
// with PathCompare via the CompareDiff module so users learn the vocabulary
// in one place.

import { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import CompareDiff, {
  COMPARE_VIEW_LABELS,
  COMPARE_VIEW_ORDER,
  DEFAULT_COMPARE_VIEW,
  type CompareDiffView,
} from "./CompareDiff";

interface Props {
  slug: string;
  mainName: string;
  pathName: string;
  /** Click anywhere with this label to leave the diff and resume editing. */
  onExit: () => void;
}

export default function InlineDiffPane({ slug, mainName, pathName, onExit }: Props) {
  const [mainBody, setMainBody] = useState<string | null>(null);
  const [pathBody, setPathBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shares the localStorage key with PathCompare so a user who picked
  // "Track changes" over in the modal sees the same view here without
  // re-selecting — the vocabulary stays consistent across both surfaces.
  const [view, setView] = useState<CompareDiffView>(() => {
    try {
      const raw = localStorage.getItem("yarrow.compareDiffView");
      if (raw && (COMPARE_VIEW_ORDER as string[]).includes(raw)) {
        return raw as CompareDiffView;
      }
    } catch {}
    return DEFAULT_COMPARE_VIEW;
  });
  useEffect(() => {
    try { localStorage.setItem("yarrow.compareDiffView", view); } catch {}
  }, [view]);

  useEffect(() => {
    let alive = true;
    setError(null);
    Promise.all([api.readNote(slug), api.readNoteOnPath(slug, pathName)])
      .then(([mn, pn]) => {
        if (!alive) return;
        setMainBody(mn.body);
        setPathBody(pn.body);
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [slug, pathName]);

  const hasNoDiff =
    mainBody != null && pathBody != null && mainBody === pathBody;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg">
      <div className="px-5 py-3 border-b border-bd flex items-center gap-3 bg-s1/40 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-base text-char leading-tight">
            How this note differs from <span className="font-mono text-sm">{mainName}</span>
          </div>
          <div className="text-2xs text-t2 mt-0.5 truncate">
            <span className="font-mono">{slug}</span> · you're on <span className="text-accent2 font-medium">{pathName}</span>
          </div>
        </div>
        <div className="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg shrink-0">
          <span className="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
            view
          </span>
          {COMPARE_VIEW_ORDER.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-2xs font-sans transition ${
                view === v
                  ? "bg-yelp text-yeld font-semibold"
                  : "text-t2 hover:bg-s2 hover:text-char"
              }`}
              title={`Switch to the ${COMPARE_VIEW_LABELS[v]} view`}
            >
              {COMPARE_VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <button
          onClick={onExit}
          className="shrink-0 text-xs px-3 py-1.5 rounded bg-yel/90 text-on-yel hover:bg-yel font-medium"
          title="Stop diffing and go back to editing this note"
        >
          Back to editing
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-8 text-sm text-danger">
            Couldn't load the diff: <span className="font-mono text-2xs">{error}</span>
          </div>
        ) : mainBody == null || pathBody == null ? (
          <div className="p-8 text-center text-t3 italic font-serif text-sm">Loading…</div>
        ) : hasNoDiff ? (
          <div className="p-10 text-center">
            <div className="font-serif text-lg text-char mb-2">No changes on this path — yet.</div>
            <div className="text-sm text-t2 max-w-md mx-auto leading-relaxed">
              You haven't edited this note on <span className="font-medium text-char">{pathName}</span> yet.
              Click <span className="text-yeld font-medium">Back to editing</span> and the
              first keystroke starts a path-local copy.
            </div>
          </div>
        ) : (
          <CompareDiff
            leftText={mainBody}
            rightText={pathBody}
            leftName={mainName}
            rightName={pathName}
            view={view}
          />
        )}
      </div>
    </div>
  );
}
