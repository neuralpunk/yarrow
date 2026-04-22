import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/tauri";
import type { PathComparison, PathDiffStatus } from "../lib/types";
import CompareDiff, {
  COMPARE_VIEW_LABELS,
  COMPARE_VIEW_ORDER,
  DEFAULT_COMPARE_VIEW,
  type CompareDiffView,
} from "./CompareDiff";

interface Props {
  open: boolean;
  onClose: () => void;
  paths: string[];
  pathConditions?: Record<string, string | null | undefined>;
  initialLeft?: string;
  initialRight?: string;
}

function statusLabel(status: PathDiffStatus, leftName: string, rightName: string): string {
  switch (status) {
    case "added":    return `Only on ${rightName}`;
    case "removed":  return `Only on ${leftName}`;
    case "modified": return "Different versions";
    case "same":     return "Same on both";
  }
}

const STATUS_TONE: Record<PathDiffStatus, string> = {
  added:    "text-green-700 dark:text-green-400",
  removed:  "text-red-700 dark:text-red-400",
  modified: "text-amber-700 dark:text-amber-400",
  same:     "text-t3",
};

export default function PathCompare({ open, onClose, paths, pathConditions, initialLeft, initialRight }: Props) {
  const [left, setLeft] = useState<string>(initialLeft ?? paths[0] ?? "main");
  const [right, setRight] = useState<string>(
    initialRight ?? (paths.find((p) => p !== (initialLeft ?? paths[0]))) ?? paths[1] ?? paths[0] ?? "main"
  );
  const [comparison, setComparison] = useState<PathComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const sameSelection = left === right;

  const swap = () => {
    const a = left;
    setLeft(right);
    setRight(a);
    setExpandedSlug(null);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-[90vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-bd flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-serif text-xl text-char leading-tight">What's different between these two paths</div>
            <div className="text-2xs text-t2 mt-1 leading-snug max-w-[640px]">
              Pick a path on each side. By default the list shows only notes
              that were edited on both paths — the <em className="font-medium not-italic text-ch2">show</em> control
              on the right lets you widen it to include one-sided or identical
              notes too.
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded hover:bg-s2 text-t2 hover:text-char flex items-center justify-center text-lg leading-none"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Picker row */}
        <div className="px-6 py-4 border-b border-bd bg-s1/40">
          <div className="flex items-stretch gap-3">
            <PathPicker
              caption="The left side"
              value={left}
              condition={leftCondition}
              paths={paths}
              onChange={(v) => { setLeft(v); setExpandedSlug(null); }}
              pathConditions={pathConditions}
              accent="left"
            />
            <button
              onClick={swap}
              title="Swap sides"
              className="shrink-0 self-center w-9 h-9 rounded-full border border-bd hover:border-yel hover:text-yel text-t2 flex items-center justify-center transition"
              aria-label="Swap left and right"
            >
              ↔
            </button>
            <PathPicker
              caption="The right side"
              value={right}
              condition={rightCondition}
              paths={paths}
              onChange={(v) => { setRight(v); setExpandedSlug(null); }}
              pathConditions={pathConditions}
              accent="right"
            />
          </div>
          {sameSelection && (
            <div className="mt-3 text-2xs text-amber-700 dark:text-amber-400">
              Both sides are the same path — pick a different path on one side
              to see a comparison.
            </div>
          )}
        </div>

        {/* Summary */}
        {comparison && !sameSelection && (
          <div className="px-6 py-3 text-xs border-b border-bd bg-bg flex items-center gap-4 flex-wrap">
            {comparison.summary.modified > 0 && (
              <SummaryChip color="amber" icon="~">
                {comparison.summary.modified} note{comparison.summary.modified === 1 ? "" : "s"} with different content
              </SummaryChip>
            )}
            {comparison.summary.added > 0 && (
              <SummaryChip color="green" icon="+">
                {comparison.summary.added} only on <em className="font-medium not-italic text-char">{right}</em>
              </SummaryChip>
            )}
            {comparison.summary.removed > 0 && (
              <SummaryChip color="red" icon="−">
                {comparison.summary.removed} only on <em className="font-medium not-italic text-char">{left}</em>
              </SummaryChip>
            )}
            <SummaryChip color="gray" icon="=">
              {comparison.summary.same} identical
            </SummaryChip>
            <div className="ml-auto flex items-center gap-3">
              <div className="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg">
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
                    title={`Switch to the ${COMPARE_VIEW_LABELS[v]} view for modified notes`}
                  >
                    {COMPARE_VIEW_LABELS[v]}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg">
                <span className="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
                  show
                </span>
                {([
                  ["changed",     "Changes",           "Only notes with edited content on both sides"],
                  ["differences", "+ only-on-one-side","Include notes that exist on just one path"],
                  ["all",         "+ identical",       "Include notes that are the same on both paths"],
                ] as const).map(([k, label, help]) => (
                  <button
                    key={k}
                    onClick={() => setShowKind(k)}
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

        {error && (
          <div className="px-6 py-3 text-xs text-danger bg-danger/10 border-b border-bd">
            <div className="font-medium mb-0.5">Couldn't compare these paths</div>
            <div className="text-2xs text-danger/80">{error}</div>
          </div>
        )}

        {/* Body — note list */}
        <div className="flex-1 overflow-y-auto bg-bg">
          {loading ? (
            <div className="p-8 text-center text-t3 italic font-serif text-sm">Comparing…</div>
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
          )}
        </div>

        <div className="px-6 py-3 border-t border-bd flex justify-between items-center gap-3">
          <div className="text-2xs text-t3 italic font-serif">
            Content for each path is what you see when you're editing on that
            path — any scratch edits you've made there show up here.
          </div>
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

function PathPicker({
  caption,
  value,
  condition,
  paths,
  onChange,
  pathConditions,
  accent,
}: {
  caption: string;
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
          (no condition)
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
  if (!haveComparison) {
    return (
      <div className="p-10 text-center">
        <div className="text-sm text-t3 italic font-serif">Pick two paths above to compare.</div>
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
          No notes were edited on both sides.
        </div>
        <div className="text-sm text-t2 max-w-md mx-auto leading-relaxed mb-4">
          {haveOneSiders ? (
            <>Every difference between these paths is a note that exists on only one of them — nothing was rewritten on both.</>
          ) : (
            <>The two paths are identical.</>
          )}
        </div>
        {haveOneSiders && (
          <button
            onClick={onShowMore}
            className="text-xs px-3 py-1.5 rounded bg-yelp text-yeld hover:brightness-110"
          >
            Show one-sided notes ({adds + rems})
          </button>
        )}
      </div>
    );
  }
  if (showKind === "differences") {
    return (
      <div className="p-10 text-center">
        <div className="font-serif text-lg text-char mb-2">No differences to show.</div>
        <div className="text-sm text-t2 max-w-md mx-auto leading-relaxed mb-4">
          These two paths contain the same notes with the same content.
        </div>
        {same > 0 && (
          <button
            onClick={onShowMore}
            className="text-xs px-3 py-1.5 rounded bg-s2 text-char hover:bg-s3"
          >
            Show identical too ({same})
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="p-10 text-center">
      <div className="font-serif text-lg text-char mb-2">No notes to display.</div>
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
  // Every non-identical row expands. Modified notes show a true diff;
  // added/removed notes show the whole note content rendered through the
  // selected view (so "Track changes" highlights it all green / struck
  // red, "Paragraph cards" shows one big added/removed card, etc).
  const clickable = entry.status !== "same";
  const title = clickable
    ? (expanded ? "Hide the details" : "Show the full content in the selected view")
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
              {statusLabel(entry.status, leftName, rightName)}
            </span>
            {clickable && (
              <span className="text-2xs text-t3 ml-auto font-mono">
                {expanded ? "▾ hide" : "▸ show"}
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
  if (entry.status === "same") {
    return (
      <div className="text-2xs text-t3 italic mt-1 font-serif truncate">
        identical on both paths
      </div>
    );
  }
  const side = entry.status === "added" ? rightName : leftName;
  const text = entry.status === "added" ? entry.right_excerpt : entry.left_excerpt;
  if (!text) return null;
  return (
    <div className="mt-1.5 text-2xs text-t2 truncate font-serif italic">
      on {side}: <span className="text-ch2 not-italic">{text.split("\n")[0].slice(0, 120)}</span>
    </div>
  );
}

