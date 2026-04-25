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
  COMPARE_VIEW_ORDER,
  DEFAULT_COMPARE_VIEW,
  type CompareDiffView,
} from "./CompareDiff";
import EmptyState from "./EmptyState";
import { useT } from "../lib/i18n";

interface Props {
  slug: string;
  mainName: string;
  pathName: string;
  /** Click anywhere with this label to leave the diff and resume editing. */
  onExit: () => void;
}

// Maps the canonical view ids onto their localized labels. Centralized
// here so callers don't repeat the lookup; CompareDiff exports the
// English defaults via COMPARE_VIEW_LABELS for the layout sizing only.
const VIEW_LABEL_KEYS: Record<CompareDiffView, "paths.cmpdiff.viewSummary" | "paths.cmpdiff.viewTrack" | "paths.cmpdiff.viewSplit" | "paths.cmpdiff.viewCards" | "paths.cmpdiff.viewMarginalia"> = {
  summary:    "paths.cmpdiff.viewSummary",
  track:      "paths.cmpdiff.viewTrack",
  split:      "paths.cmpdiff.viewSplit",
  cards:      "paths.cmpdiff.viewCards",
  marginalia: "paths.cmpdiff.viewMarginalia",
};

export default function InlineDiffPane({ slug, mainName, pathName, onExit }: Props) {
  const t = useT();
  const viewLabel = (v: CompareDiffView) => t(VIEW_LABEL_KEYS[v]);
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
            {(() => {
              const [before, after] = t("paths.inline.heading").split("{main}");
              return (
                <>
                  {before}
                  <span className="font-mono text-sm">{mainName}</span>
                  {after ?? ""}
                </>
              );
            })()}
          </div>
          <div className="text-2xs text-t2 mt-0.5 truncate">
            <span className="font-mono">{slug}</span> · {(() => {
              const [before, after] = t("paths.inline.youAreOn").split("{name}");
              return (
                <>
                  {before}
                  <span className="text-accent2 font-medium">{pathName}</span>
                  {after ?? ""}
                </>
              );
            })()}
          </div>
        </div>
        <div className="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg shrink-0">
          <span className="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
            {t("paths.inline.viewLabel")}
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
              title={t("paths.inline.viewSwitchTitle", { label: viewLabel(v) })}
            >
              {viewLabel(v)}
            </button>
          ))}
        </div>
        <button
          onClick={onExit}
          className="shrink-0 text-xs px-3 py-1.5 rounded bg-yel/90 text-on-yel hover:bg-yel font-medium"
          title={t("paths.inline.backTitle")}
        >
          {t("paths.inline.back")}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-8 text-sm text-danger">
            {(() => {
              // Render "Couldn't load the diff: <code>{error}</code>" while
              // letting the translator move "{message}" anywhere in the
              // sentence. Split on the literal marker preserved in the EN
              // template; the {message} placeholder becomes the styled
              // <code> span.
              const parts = t("paths.inline.loadError").split("{message}");
              return (
                <>
                  {parts[0]}
                  <span className="font-mono text-2xs">{error}</span>
                  {parts[1] ?? ""}
                </>
              );
            })()}
          </div>
        ) : mainBody == null || pathBody == null ? (
          <div className="p-8 text-center text-t3 italic font-serif text-sm">{t("paths.inline.loading")}</div>
        ) : hasNoDiff ? (
          <EmptyState
            kind="diff"
            hint={t("paths.inline.noDiffHint", { name: pathName })}
          />
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
