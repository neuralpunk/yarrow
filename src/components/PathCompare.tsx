import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/tauri";
import type { NoteSummary, PathComparison, PathDiffStatus } from "../lib/types";
import CompareDiff, {
  COMPARE_VIEW_ORDER,
  DEFAULT_COMPARE_VIEW,
  type CompareDiffView,
} from "./CompareDiff";
import { useT } from "../lib/i18n";
import type { StringKey } from "../lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  paths: string[];
  pathConditions?: Record<string, string | null | undefined>;
  initialLeft?: string;
  initialRight?: string;
  /** All notes in the workspace — used by Notes-mode pickers. Pulled
   *  from AppShell where it's already cached so we don't refetch on
   *  every modal open. */
  notes: NoteSummary[];
  /** Pre-select this note in Notes mode (defaults to the active note
   *  when the user opens compare from the toolbar). */
  initialLeftSlug?: string;
  initialRightSlug?: string;
}

// 2.2.0 — the Compare modal now supports two scopes. "Notes" compares
// two individual notes against each other; "Paths" is the original
// behaviour (every note's status across two paths in a list).
type CompareMode = "notes" | "paths";

// View id → translation key. CompareDiff exports the canonical
// English-only `COMPARE_VIEW_LABELS` for layout sizing, but every UI
// surface goes through the localizer using these keys.
const VIEW_LABEL_KEYS: Record<CompareDiffView, StringKey> = {
  summary:    "paths.cmpdiff.viewSummary",
  track:      "paths.cmpdiff.viewTrack",
  split:      "paths.cmpdiff.viewSplit",
  cards:      "paths.cmpdiff.viewCards",
  marginalia: "paths.cmpdiff.viewMarginalia",
};

function statusLabel(t: ReturnType<typeof useT>, status: PathDiffStatus, leftName: string, rightName: string): string {
  switch (status) {
    case "added":    return t("paths.compare.statusAdded",   { name: rightName });
    case "removed":  return t("paths.compare.statusRemoved", { name: leftName });
    case "modified": return t("paths.compare.statusModified");
    case "same":     return t("paths.compare.statusSame");
  }
}

const STATUS_TONE: Record<PathDiffStatus, string> = {
  added:    "text-green-700 dark:text-green-400",
  removed:  "text-red-700 dark:text-red-400",
  modified: "text-amber-700 dark:text-amber-400",
  same:     "text-t3",
};

export default function PathCompare({
  open,
  onClose,
  paths,
  pathConditions,
  initialLeft,
  initialRight,
  notes,
  initialLeftSlug,
  initialRightSlug,
}: Props) {
  const t = useT();
  const viewLabel = (v: CompareDiffView) => t(VIEW_LABEL_KEYS[v]);
  // 2.2.0 — comparison scope. Notes is the new default (most users
  // reach for compare to diff two specific notes, not whole paths).
  // Persisted so a user who flips to Paths once stays there.
  const [mode, setMode] = useState<CompareMode>(() => {
    try {
      const raw = localStorage.getItem("yarrow.compareMode");
      if (raw === "notes" || raw === "paths") return raw;
    } catch {}
    return "notes";
  });
  useEffect(() => {
    try { localStorage.setItem("yarrow.compareMode", mode); } catch {}
  }, [mode]);

  const [left, setLeft] = useState<string>(initialLeft ?? paths[0] ?? "main");
  const [right, setRight] = useState<string>(
    initialRight ?? (paths.find((p) => p !== (initialLeft ?? paths[0]))) ?? paths[1] ?? paths[0] ?? "main"
  );
  const [comparison, setComparison] = useState<PathComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2.2.0 — Notes-mode selection + body fetch. Sorted alphabetically
  // by title for the picker; slug used as a stable id.
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const ta = (a.title || a.slug).toLowerCase();
      const tb = (b.title || b.slug).toLowerCase();
      return ta.localeCompare(tb);
    });
  }, [notes]);

  const [leftSlug, setLeftSlug] = useState<string>(() =>
    initialLeftSlug ?? sortedNotes[0]?.slug ?? ""
  );
  const [rightSlug, setRightSlug] = useState<string>(() => {
    const lead = initialLeftSlug ?? sortedNotes[0]?.slug ?? "";
    return (
      initialRightSlug
      ?? sortedNotes.find((n) => n.slug !== lead)?.slug
      ?? sortedNotes[1]?.slug
      ?? sortedNotes[0]?.slug
      ?? ""
    );
  });
  const [leftBody, setLeftBody] = useState<string>("");
  const [rightBody, setRightBody] = useState<string>("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  // What the user wants to see in the note list:
  //   "changed"     → only notes that differ on both sides (the thing
  //                   people almost always come here to see)
  //   "differences" → above + notes that exist only on one side
  //   "all"         → everything, including identical notes
  // Defaulting to "changed" declutters the modal: the 60-row scrollback
  // of "only on main" / "only on solo-version" rows now stays hidden
  // unless the user explicitly asks for them.
  type ShowKind = "changed" | "differences" | "all";
  const [showKind, setShowKind] = useState<ShowKind>(() => {
    try {
      const raw = localStorage.getItem("yarrow.compareShowKind");
      if (raw === "changed" || raw === "differences" || raw === "all") return raw;
    } catch {}
    return "changed";
  });
  useEffect(() => {
    try { localStorage.setItem("yarrow.compareShowKind", showKind); } catch {}
  }, [showKind]);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  // Which friendly diff view to render inside expanded modified notes.
  // Persisted per-browser so users who prefer Track-changes over the
  // Summary default don't have to re-pick every time the modal opens.
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
    if (!open) return;
    if (initialLeft && initialLeft !== left) setLeft(initialLeft);
    if (initialRight && initialRight !== right) setRight(initialRight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLeft, initialRight]);

  // Pre-select left = active note (when caller threaded it through) on open.
  useEffect(() => {
    if (!open) return;
    if (initialLeftSlug && initialLeftSlug !== leftSlug) {
      setLeftSlug(initialLeftSlug);
      // If right collides with the new left, pick a different right.
      if (rightSlug === initialLeftSlug) {
        const fallback = sortedNotes.find((n) => n.slug !== initialLeftSlug)?.slug ?? "";
        setRightSlug(fallback);
      }
    }
    if (initialRightSlug && initialRightSlug !== rightSlug) setRightSlug(initialRightSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLeftSlug, initialRightSlug]);

  useEffect(() => {
    if (!open || mode !== "paths") return;
    if (!left || !right) { setComparison(null); return; }
    setLoading(true);
    setError(null);
    api.comparePaths(left, right)
      .then(setComparison)
      .catch((e) => { setError(String(e)); setComparison(null); })
      .finally(() => setLoading(false));
  }, [left, right, open, mode]);

  // Notes-mode body fetch. Only fires when both slugs are set, the
  // modal is open, and we're actually in Notes mode — so flipping to
  // Paths doesn't waste a roundtrip.
  //
  // 2.2.0 round 2: cancellation flag so a fast slug-flip or
  // mode-toggle doesn't land state from a stale request — the
  // previous version would intermittently set body text from an
  // earlier pair after the user had already picked a different one,
  // and React would warn about state updates on an unmounted
  // component when the modal closed mid-request.
  useEffect(() => {
    if (!open || mode !== "notes") return;
    if (!leftSlug || !rightSlug) {
      setLeftBody("");
      setRightBody("");
      return;
    }
    if (leftSlug === rightSlug) {
      // Same selection — surface as a soft warning below; skip the
      // network calls entirely.
      setLeftBody("");
      setRightBody("");
      return;
    }
    let cancelled = false;
    setNotesLoading(true);
    setNotesError(null);
    Promise.all([api.readNote(leftSlug), api.readNote(rightSlug)])
      .then(([a, b]) => {
        if (cancelled) return;
        setLeftBody(a.body ?? "");
        setRightBody(b.body ?? "");
      })
      .catch((e) => {
        if (cancelled) return;
        setNotesError(String(e));
        setLeftBody("");
        setRightBody("");
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, mode, leftSlug, rightSlug]);

  // Entries with actual differences surface first; identical entries go
  // below (and hidden by default). Within each group, notes sort alphabetically.
  const visible = useMemo(() => {
    if (!comparison) return [];
    const entries = [...comparison.entries];
    entries.sort((a, b) => {
      const order = { modified: 0, added: 1, removed: 2, same: 3 } as const;
      const oa = order[a.status];
      const ob = order[b.status];
      if (oa !== ob) return oa - ob;
      return a.slug.localeCompare(b.slug);
    });
    return entries.filter((e) => {
      if (showKind === "all") return true;
      if (showKind === "differences") return e.status !== "same";
      // "changed" — only notes with edited content on both sides.
      return e.status === "modified";
    });
  }, [comparison, showKind]);

  // Auto-expand the first non-identical entry so the user immediately
  // sees the selected diff view without having to click. We prefer a
  // modified row (richest diff) but fall back to the first added/removed
  // one — otherwise in a comparison with no modified notes (only
  // adds/removes) the view selector looks inert.
  useEffect(() => {
    if (expandedSlug) return;
    const firstChanged =
      visible.find((e) => e.status === "modified")
      ?? visible.find((e) => e.status !== "same");
    if (firstChanged) setExpandedSlug(firstChanged.slug);
  }, [visible, expandedSlug]);

  const leftCondition = (pathConditions?.[left] ?? "").trim();
  const rightCondition = (pathConditions?.[right] ?? "").trim();
  const sameSelection = mode === "paths" ? left === right : leftSlug === rightSlug;

  const swap = () => {
    if (mode === "paths") {
      const a = left;
      setLeft(right);
      setRight(a);
      setExpandedSlug(null);
    } else {
      const a = leftSlug;
      setLeftSlug(rightSlug);
      setRightSlug(a);
    }
  };

  // Note-titles (for diff header) — fall back to slug if title is empty.
  const titleFor = (slug: string): string => {
    const n = sortedNotes.find((x) => x.slug === slug);
    return (n?.title || slug || "").trim() || slug;
  };
  const leftNoteTitle = titleFor(leftSlug);
  const rightNoteTitle = titleFor(rightSlug);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-[90vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="path-compare-title"
      >
        <div className="px-6 py-4 border-b border-bd flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div id="path-compare-title" className="font-serif text-xl text-char leading-tight">{t("paths.compare.title")}</div>
            <div className="text-2xs text-t2 mt-1 leading-snug max-w-[640px]">
              {mode === "notes"
                ? t("paths.compare.subtitleNotes")
                : t("paths.compare.subtitle")}
            </div>
          </div>
          {/* 2.2.0 — scope toggle. "Notes" is the default; "Paths" is
              the original behaviour. Persisted across sessions. */}
          <div
            role="tablist"
            aria-label={t("paths.compare.modeLabel")}
            className="shrink-0 inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg self-center"
          >
            <button
              role="tab"
              aria-selected={mode === "notes"}
              onClick={() => setMode("notes")}
              className={`px-3 py-1.5 text-xs font-sans transition ${
                mode === "notes"
                  ? "bg-yelp text-yeld font-semibold"
                  : "text-t2 hover:bg-s2 hover:text-char"
              }`}
              title={t("paths.compare.modeNotesTitle")}
            >
              {t("paths.compare.modeNotes")}
            </button>
            <button
              role="tab"
              aria-selected={mode === "paths"}
              onClick={() => setMode("paths")}
              className={`px-3 py-1.5 text-xs font-sans transition ${
                mode === "paths"
                  ? "bg-yelp text-yeld font-semibold"
                  : "text-t2 hover:bg-s2 hover:text-char"
              }`}
              title={t("paths.compare.modePathsTitle")}
            >
              {t("paths.compare.modePaths")}
            </button>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded hover:bg-s2 text-t2 hover:text-char flex items-center justify-center text-lg leading-none"
            title={t("paths.compare.closeTitle")}
          >
            ×
          </button>
        </div>

        {/* Picker row — switches between path and note pickers based on mode. */}
        <div className="px-6 py-4 border-b border-bd bg-s1/40">
          <div className="flex items-stretch gap-3">
            {mode === "paths" ? (
              <>
                <PathPicker
                  caption={t("paths.compare.leftCaption")}
                  noConditionLabel={t("paths.compare.noCondition")}
                  value={left}
                  condition={leftCondition}
                  paths={paths}
                  onChange={(v) => { setLeft(v); setExpandedSlug(null); }}
                  pathConditions={pathConditions}
                  accent="left"
                />
                <button
                  onClick={swap}
                  title={t("paths.compare.swapTitle")}
                  className="shrink-0 self-center w-9 h-9 rounded-full border border-bd hover:border-yel hover:text-yel text-t2 flex items-center justify-center transition"
                  aria-label={t("paths.compare.swapAria")}
                >
                  ↔
                </button>
                <PathPicker
                  caption={t("paths.compare.rightCaption")}
                  noConditionLabel={t("paths.compare.noCondition")}
                  value={right}
                  condition={rightCondition}
                  paths={paths}
                  onChange={(v) => { setRight(v); setExpandedSlug(null); }}
                  pathConditions={pathConditions}
                  accent="right"
                />
              </>
            ) : (
              <>
                <NotePicker
                  caption={t("paths.compare.notesLeftCaption")}
                  value={leftSlug}
                  notes={sortedNotes}
                  onChange={setLeftSlug}
                  accent="left"
                  emptyHint={t("paths.compare.notesPickPrompt")}
                />
                <button
                  onClick={swap}
                  title={t("paths.compare.swapTitle")}
                  className="shrink-0 self-center w-9 h-9 rounded-full border border-bd hover:border-yel hover:text-yel text-t2 flex items-center justify-center transition"
                  aria-label={t("paths.compare.swapAria")}
                >
                  ↔
                </button>
                <NotePicker
                  caption={t("paths.compare.notesRightCaption")}
                  value={rightSlug}
                  notes={sortedNotes}
                  onChange={setRightSlug}
                  accent="right"
                  emptyHint={t("paths.compare.notesPickPrompt")}
                />
              </>
            )}
          </div>
          {sameSelection && (
            <div className="mt-3 text-2xs text-amber-700 dark:text-amber-400">
              {mode === "notes"
                ? t("paths.compare.notesSameSelection")
                : t("paths.compare.sameSelection")}
            </div>
          )}
        </div>

        {/* Summary — paths mode shows the chip strip + show-kind filter.
            Notes mode shows just the view selector (no list to filter). */}
        {mode === "paths" && comparison && !sameSelection && (
          <div className="px-6 py-3 text-xs border-b border-bd bg-bg flex items-center gap-4 flex-wrap">
            {comparison.summary.modified > 0 && (
              <SummaryChip color="amber" icon="~">
                {comparison.summary.modified === 1
                  ? t("paths.compare.summaryModifiedOne", { count: String(comparison.summary.modified) })
                  : t("paths.compare.summaryModifiedMany", { count: String(comparison.summary.modified) })}
              </SummaryChip>
            )}
            {comparison.summary.added > 0 && (
              <SummaryChip color="green" icon="+">
                {(() => {
                  // Substitute only the count, leaving {name} as a literal
                  // marker, then split on the marker so we can render the
                  // path name as a styled <em>.
                  const tpl = t("paths.compare.summaryAdded", { count: String(comparison.summary.added) });
                  const [before, after] = tpl.split("{name}");
                  return (
                    <>
                      {before}
                      <em className="font-medium not-italic text-char">{right}</em>
                      {after ?? ""}
                    </>
                  );
                })()}
              </SummaryChip>
            )}
            {comparison.summary.removed > 0 && (
              <SummaryChip color="red" icon="−">
                {(() => {
                  const tpl = t("paths.compare.summaryRemoved", { count: String(comparison.summary.removed) });
                  const [before, after] = tpl.split("{name}");
                  return (
                    <>
                      {before}
                      <em className="font-medium not-italic text-char">{left}</em>
                      {after ?? ""}
                    </>
                  );
                })()}
              </SummaryChip>
            )}
            <SummaryChip color="gray" icon="=">
              {t("paths.compare.summarySame", { count: String(comparison.summary.same) })}
            </SummaryChip>
            <div className="ml-auto flex items-center gap-3">
              <div className="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg">
                <span className="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
                  {t("paths.compare.viewLabel")}
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
                    title={t("paths.compare.viewSwitchTitle", { label: viewLabel(v) })}
                  >
                    {viewLabel(v)}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg">
                <span className="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
                  {t("paths.compare.show")}
                </span>
                {([
                  ["changed",     t("paths.compare.showChanges"),    t("paths.compare.showChangesHelp")],
                  ["differences", t("paths.compare.showOneSided"),   t("paths.compare.showOneSidedHelp")],
                  ["all",         t("paths.compare.showIdentical"),  t("paths.compare.showIdenticalHelp")],
                ] as const).map(([k, label, help]) => (
                  <button
                    key={k}
                    onClick={() => setShowKind(k as ShowKind)}
                    title={help}
                    className={`px-2.5 py-1 text-2xs font-sans transition ${
                      showKind === k
                        ? "bg-yelp text-yeld font-semibold"
                        : "text-t2 hover:bg-s2 hover:text-char"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notes-mode summary strip — just the view selector. */}
        {mode === "notes" && !sameSelection && (
          <div className="px-6 py-3 text-xs border-b border-bd bg-bg flex items-center gap-4 flex-wrap">
            <span className="text-2xs text-t3 italic font-serif">
              {t("paths.compare.notesSummary", {
                left: leftNoteTitle,
                right: rightNoteTitle,
              })}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <div className="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg">
                <span className="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
                  {t("paths.compare.viewLabel")}
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
                    title={t("paths.compare.viewSwitchTitle", { label: viewLabel(v) })}
                  >
                    {viewLabel(v)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(error || notesError) && (
          <div className="px-6 py-3 text-xs text-danger bg-danger/10 border-b border-bd">
            <div className="font-medium mb-0.5">{t("paths.compare.errorTitle")}</div>
            <div className="text-2xs text-danger/80">{mode === "notes" ? notesError : error}</div>
          </div>
        )}

        {/* Body — paths mode shows the per-note list; notes mode renders
            a single CompareDiff for the picked pair. */}
        <div className="flex-1 overflow-y-auto bg-bg">
          {mode === "paths" ? (
            loading ? (
              <div className="p-8 text-center text-t3 italic font-serif text-sm">{t("paths.compare.loading")}</div>
            ) : visible.length === 0 ? (
              <EmptyState
                haveComparison={!!comparison}
                showKind={showKind}
                totals={comparison?.summary ?? null}
                onShowMore={() => setShowKind(showKind === "changed" ? "differences" : "all")}
              />
            ) : (
              <ul className="divide-y divide-bd/60">
                {visible.map((e) => (
                  <NoteRow
                    key={e.slug}
                    entry={e}
                    leftName={left}
                    rightName={right}
                    expanded={expandedSlug === e.slug}
                    onToggle={() => setExpandedSlug(expandedSlug === e.slug ? null : e.slug)}
                    view={view}
                  />
                ))}
              </ul>
            )
          ) : sortedNotes.length < 2 ? (
            <div className="p-10 text-center">
              <div className="font-serif text-lg text-char mb-2">
                {t("paths.compare.notesEmptyWorkspaceTitle")}
              </div>
              <div className="text-sm text-t2 max-w-md mx-auto leading-relaxed">
                {t("paths.compare.notesEmptyWorkspaceBody")}
              </div>
            </div>
          ) : sameSelection ? (
            <div className="p-10 text-center">
              <div className="font-serif text-lg text-char mb-2">
                {t("paths.compare.notesPickPromptTitle")}
              </div>
              <div className="text-sm text-t2 max-w-md mx-auto leading-relaxed">
                {t("paths.compare.notesPickPrompt")}
              </div>
            </div>
          ) : notesLoading ? (
            <div className="p-8 text-center text-t3 italic font-serif text-sm">{t("paths.compare.loading")}</div>
          ) : (
            <CompareDiff
              leftText={leftBody}
              rightText={rightBody}
              leftName={leftNoteTitle}
              rightName={rightNoteTitle}
              view={view}
            />
          )}
        </div>

        <div className="px-6 py-3 border-t border-bd flex justify-between items-center gap-3">
          <div className="text-2xs text-t3 italic font-serif">
            {t("paths.compare.footerHelp")}
          </div>
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char"
          >
            {t("paths.compare.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// 2.2.0 — picker for the Notes-mode of the Compare modal. A native
// `<select>` is fine for v1 — most workspaces have a few hundred
// notes max, and the OS picker handles type-ahead for free. A richer
// combobox can replace this later if vaults grow into the thousands.
function NotePicker({
  caption,
  value,
  notes,
  onChange,
  accent,
  emptyHint,
}: {
  caption: string;
  value: string;
  notes: NoteSummary[];
  onChange: (slug: string) => void;
  accent: "left" | "right";
  emptyHint: string;
}) {
  const selected = notes.find((n) => n.slug === value);
  return (
    <div className={`flex-1 min-w-0 rounded-lg border-2 ${accent === "left" ? "border-bd2" : "border-yel/60"} bg-bg px-4 py-3`}>
      <div className="text-2xs text-t3 uppercase tracking-wider font-sans font-semibold mb-1.5">
        {caption}
      </div>
      {notes.length === 0 ? (
        <div className="text-sm text-t3 font-serif italic">{emptyHint}</div>
      ) : (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-base text-char font-sans font-medium focus:outline-none cursor-pointer"
        >
          {!selected && <option value="" disabled>{emptyHint}</option>}
          {notes.map((n) => (
            <option key={n.slug} value={n.slug}>
              {(n.title || n.slug).trim() || n.slug}
            </option>
          ))}
        </select>
      )}
      {selected && selected.tags && selected.tags.length > 0 && (
        <div className="text-xs italic text-ch2 font-serif mt-1 leading-snug truncate">
          {selected.tags.slice(0, 4).map((tag) => `#${tag}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

function PathPicker({
  caption,
  noConditionLabel,
  value,
  condition,
  paths,
  onChange,
  pathConditions,
  accent,
}: {
  caption: string;
  noConditionLabel: string;
  value: string;
  condition: string;
  paths: string[];
  onChange: (v: string) => void;
  pathConditions?: Record<string, string | null | undefined>;
  accent: "left" | "right";
}) {
  void pathConditions; // reserved for a richer dropdown later (name + condition as one string)
  return (
    <div className={`flex-1 min-w-0 rounded-lg border-2 ${accent === "left" ? "border-bd2" : "border-yel/60"} bg-bg px-4 py-3`}>
      <div className="text-2xs text-t3 uppercase tracking-wider font-sans font-semibold mb-1.5">
        {caption}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-base text-char font-sans font-medium focus:outline-none cursor-pointer"
      >
        {paths.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {condition ? (
        <div className="text-xs italic text-ch2 font-serif mt-1 leading-snug">
          “{condition}”
        </div>
      ) : (
        <div className="text-xs text-t3 font-serif mt-1 italic opacity-60">
          {noConditionLabel}
        </div>
      )}
    </div>
  );
}

function SummaryChip({
  color,
  icon,
  children,
}: {
  color: "amber" | "green" | "red" | "gray";
  icon: string;
  children: React.ReactNode;
}) {
  const colorCls =
    color === "amber" ? "text-amber-700 dark:text-amber-400"
    : color === "green" ? "text-green-700 dark:text-green-400"
    : color === "red" ? "text-red-700 dark:text-red-400"
    : "text-t3";
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-t2">
      <span className={`font-mono ${colorCls} font-semibold`}>{icon}</span>
      <span>{children}</span>
    </span>
  );
}

function EmptyState({
  haveComparison,
  showKind,
  totals,
  onShowMore,
}: {
  haveComparison: boolean;
  showKind: "changed" | "differences" | "all";
  totals: PathComparison["summary"] | null;
  onShowMore: () => void;
}) {
  const t = useT();
  if (!haveComparison) {
    return (
      <div className="p-10 text-center">
        <div className="text-sm text-t3 italic font-serif">{t("paths.compare.pickPrompt")}</div>
      </div>
    );
  }
  // Smart empty-state messaging based on what filter is active and what
  // the comparison actually contains. The goal is to answer "why don't I
  // see anything?" without making the user read three chips to figure
  // it out.
  const adds = totals?.added ?? 0;
  const rems = totals?.removed ?? 0;
  const same = totals?.same ?? 0;
  if (showKind === "changed") {
    const haveOneSiders = adds + rems > 0;
    return (
      <div className="p-10 text-center">
        <div className="font-serif text-lg text-char mb-2">
          {t("paths.compare.emptyChangedTitle")}
        </div>
        <div className="text-sm text-t2 max-w-md mx-auto leading-relaxed mb-4">
          {haveOneSiders
            ? t("paths.compare.emptyChangedOneSiders")
            : t("paths.compare.emptyChangedIdentical")}
        </div>
        {haveOneSiders && (
          <button
            onClick={onShowMore}
            className="text-xs px-3 py-1.5 rounded bg-yelp text-yeld hover:brightness-110"
          >
            {t("paths.compare.emptyShowOneSided", { count: String(adds + rems) })}
          </button>
        )}
      </div>
    );
  }
  if (showKind === "differences") {
    return (
      <div className="p-10 text-center">
        <div className="font-serif text-lg text-char mb-2">{t("paths.compare.emptyDiffsTitle")}</div>
        <div className="text-sm text-t2 max-w-md mx-auto leading-relaxed mb-4">
          {t("paths.compare.emptyDiffsBody")}
        </div>
        {same > 0 && (
          <button
            onClick={onShowMore}
            className="text-xs px-3 py-1.5 rounded bg-s2 text-char hover:bg-s3"
          >
            {t("paths.compare.emptyShowIdentical", { count: String(same) })}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="p-10 text-center">
      <div className="font-serif text-lg text-char mb-2">{t("paths.compare.emptyAll")}</div>
    </div>
  );
}

function NoteRow({
  entry,
  leftName,
  rightName,
  expanded,
  onToggle,
  view,
}: {
  entry: PathComparison["entries"][number];
  leftName: string;
  rightName: string;
  expanded: boolean;
  onToggle: () => void;
  view: CompareDiffView;
}) {
  const t = useT();
  // Every non-identical row expands. Modified notes show a true diff;
  // added/removed notes show the whole note content rendered through the
  // selected view (so "Track changes" highlights it all green / struck
  // red, "Paragraph cards" shows one big added/removed card, etc).
  const clickable = entry.status !== "same";
  const title = clickable
    ? (expanded ? t("paths.compare.rowExpandHide") : t("paths.compare.rowExpandShow"))
    : undefined;
  return (
    <li className="bg-bg">
      <button
        onClick={clickable ? onToggle : undefined}
        title={title}
        className={`w-full text-left px-6 py-3 flex items-start gap-3 ${clickable ? "hover:bg-s1 cursor-pointer" : "cursor-default"}`}
      >
        <span className="shrink-0 mt-0.5">
          <StatusDot status={entry.status} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-serif text-char text-base truncate">{entry.slug}</span>
            <span className={`text-2xs uppercase tracking-wider font-sans font-semibold ${STATUS_TONE[entry.status]}`}>
              {statusLabel(t, entry.status, leftName, rightName)}
            </span>
            {clickable && (
              <span className="text-2xs text-t3 ml-auto font-mono">
                {expanded ? t("paths.compare.rowHide") : t("paths.compare.rowShow")}
              </span>
            )}
          </div>
          {!expanded && (
            <RowPreview entry={entry} leftName={leftName} rightName={rightName} />
          )}
        </div>
      </button>
      {expanded && clickable && (
        <CompareDiff
          leftText={entry.left_excerpt ?? ""}
          rightText={entry.right_excerpt ?? ""}
          leftName={leftName}
          rightName={rightName}
          view={view}
        />
      )}
    </li>
  );
}

function StatusDot({ status }: { status: PathDiffStatus }) {
  const color =
    status === "added" ? "bg-green-500"
    : status === "removed" ? "bg-red-500"
    : status === "modified" ? "bg-amber-500"
    : "bg-t3";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function RowPreview({
  entry,
  leftName,
  rightName,
}: {
  entry: PathComparison["entries"][number];
  leftName: string;
  rightName: string;
}) {
  const t = useT();
  if (entry.status === "same") {
    return (
      <div className="text-2xs text-t3 italic mt-1 font-serif truncate">
        {t("paths.compare.rowSamePreview")}
      </div>
    );
  }
  const side = entry.status === "added" ? rightName : leftName;
  const text = entry.status === "added" ? entry.right_excerpt : entry.left_excerpt;
  if (!text) return null;
  return (
    <div className="mt-1.5 text-2xs text-t2 truncate font-serif italic">
      {t("paths.compare.rowOnSide", { side })}<span className="text-ch2 not-italic">{text.split("\n")[0].slice(0, 120)}</span>
    </div>
  );
}

