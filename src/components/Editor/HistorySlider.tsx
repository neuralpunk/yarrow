import { useEffect, useMemo, useState } from "react";
import type { HistoryEntry } from "../../lib/types";
import { friendlyDate, relativeTime } from "../../lib/format";

interface Props {
  history: HistoryEntry[];
  preview: string | null;
  currentBody: string;
  noteTitle: string;
  onHover: (oid: string) => void;
  onRestore: (oid: string) => void;
  onClose: () => void;
}

/**
 * Groups checkpoints into human-friendly buckets so the list reads like a
 * journal ("today", "yesterday", "earlier this week") instead of a wall of
 * timestamps.
 */
function bucketOf(unixSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  const d = new Date(unixSeconds * 1000);
  const today = new Date();
  const sameDay =
    d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (diff < 86400 * 7) return "Earlier this week";
  if (diff < 86400 * 30) return "This month";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function HistorySlider({
  history,
  preview,
  currentBody,
  noteTitle,
  onHover,
  onRestore,
  onClose,
}: Props) {
  const [idx, setIdx] = useState<number>(history.length > 0 ? 0 : -1);
  const [confirming, setConfirming] = useState(false);
  const [showDiffOnly, setShowDiffOnly] = useState(false);

  useEffect(() => {
    if (idx >= 0 && history[idx]) onHover(history[idx].oid);
  }, [idx, history, onHover]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirming) { setConfirming(false); return; }
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setIdx((i) => Math.min(history.length - 1, i + 1));
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter" && idx >= 0 && !confirming) {
        e.preventDefault();
        setConfirming(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history.length, onClose, idx, confirming]);

  const selected = idx >= 0 ? history[idx] : null;
  const isLatest = idx === 0;

  const diff = useMemo(() => {
    if (!preview) return { added: 0, removed: 0 };
    const a = new Set(
      currentBody.split("\n").map((l) => l.trim()).filter(Boolean),
    );
    const b = new Set(
      preview.split("\n").map((l) => l.trim()).filter(Boolean),
    );
    let added = 0;
    let removed = 0;
    for (const l of a) if (!b.has(l)) added++;
    for (const l of b) if (!a.has(l)) removed++;
    return { added, removed };
  }, [preview, currentBody]);

  const diffLines = useMemo(() => {
    if (!preview) return [] as Array<{ text: string; kind: "same" | "gone" | "new" }>;
    const aLines = currentBody.split("\n");
    const bLines = preview.split("\n");
    const aSet = new Set(aLines.map((l) => l.trim()));
    const bSet = new Set(bLines.map((l) => l.trim()));
    const out: Array<{ text: string; kind: "same" | "gone" | "new" }> = [];
    for (const l of bLines) {
      if (aSet.has(l.trim())) out.push({ text: l, kind: "same" });
      else out.push({ text: l, kind: "gone" });
    }
    for (const l of aLines) {
      if (!bSet.has(l.trim())) out.push({ text: l, kind: "new" });
    }
    return out;
  }, [preview, currentBody]);

  // Buckets for the left timeline column.
  const bucketed = useMemo(() => {
    const groups: Array<{ label: string; entries: Array<{ e: HistoryEntry; i: number }> }> = [];
    let current: typeof groups[number] | null = null;
    history.forEach((e, i) => {
      const label = bucketOf(e.timestamp);
      if (!current || current.label !== label) {
        current = { label, entries: [] };
        groups.push(current);
      }
      current.entries.push({ e, i });
    });
    return groups;
  }, [history]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-char/30 backdrop-blur-[3px] animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-[820px] max-w-[94vw] h-[560px] max-h-[90vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-bd bg-s1 flex items-center gap-3">
          <div className="min-w-0">
            <div className="font-serif text-lg text-char truncate">{noteTitle}</div>
            <div className="text-2xs text-t3">
              {history.length} checkpoint{history.length === 1 ? "" : "s"} on this path · ↑/↓ to scrub · esc to close
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-2xs text-t2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDiffOnly}
                onChange={(e) => setShowDiffOnly(e.target.checked)}
                className="accent-yel"
              />
              show differences only
            </label>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-s2 text-t2 hover:text-char"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Timeline list */}
          <aside className="w-[260px] shrink-0 border-r border-bd bg-s1/40 overflow-y-auto">
            {bucketed.map((group) => (
              <div key={group.label} className="py-2">
                <div className="px-4 py-1 text-2xs uppercase tracking-wider text-t3 font-semibold">
                  {group.label}
                </div>
                <ul>
                  {group.entries.map(({ e, i }) => {
                    const isSel = i === idx;
                    return (
                      <li key={e.oid}>
                        <button
                          onClick={() => setIdx(i)}
                          onMouseEnter={() => setIdx(i)}
                          className={`w-full text-left px-4 py-2 flex items-start gap-2.5 text-xs transition border-l-2 ${
                            isSel
                              ? "bg-s2 text-char border-yel"
                              : "text-t2 border-transparent hover:bg-s2 hover:text-char"
                          }`}
                        >
                          <span
                            className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                              isSel ? "bg-yel" : i === 0 ? "bg-accent2" : "bg-bd2"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">
                                {i === 0 ? "Now" : relativeTime(e.timestamp)}
                              </span>
                              {i === 0 && (
                                <span className="text-2xs px-1 py-px bg-yelp text-yeld rounded">
                                  latest
                                </span>
                              )}
                            </div>
                            <div className="text-2xs text-t3 font-mono mt-0.5">
                              {friendlyDate(e.timestamp)}
                            </div>
                            {e.thinking_note && (
                              <div className="text-2xs text-yeld italic mt-1 line-clamp-2">
                                “{e.thinking_note}”
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </aside>

          {/* Preview + diff badge */}
          <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="px-5 py-2 border-b border-bd bg-s1/60 flex items-center gap-3">
              {selected ? (
                <>
                  <span className="text-2xs uppercase tracking-wider text-t3 font-semibold">
                    Previewing
                  </span>
                  <span className="text-xs text-char">
                    {friendlyDate(selected.timestamp)}
                  </span>
                  <span className="text-2xs text-t3">
                    ({relativeTime(selected.timestamp)})
                  </span>
                  <span className="ml-auto flex items-center gap-2 text-2xs font-mono">
                    {diff.added > 0 && (
                      <span className="text-yeld" title="Lines that exist now but didn't then">
                        +{diff.added} since
                      </span>
                    )}
                    {diff.removed > 0 && (
                      <span className="text-danger" title="Lines that existed then but not now">
                        −{diff.removed} gone
                      </span>
                    )}
                    {diff.added === 0 && diff.removed === 0 && (
                      <span className="text-t3">identical to now</span>
                    )}
                  </span>
                </>
              ) : (
                <span className="text-xs text-t3 italic">
                  Pick a checkpoint from the timeline
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-bg">
              {preview != null ? (
                showDiffOnly ? (
                  <div className="font-sans text-sm leading-relaxed space-y-0.5">
                    {diffLines.filter((l) => l.kind !== "same").length === 0 && (
                      <div className="text-t3 italic text-sm">
                        No differences from the current version.
                      </div>
                    )}
                    {diffLines
                      .filter((l) => l.kind !== "same")
                      .map((l, i) => (
                        <div
                          key={i}
                          className={
                            l.kind === "gone"
                              ? "pl-2 border-l-2 border-danger text-t2 line-through decoration-danger/60"
                              : "pl-2 border-l-2 border-yel text-char"
                          }
                        >
                          <span className="text-2xs text-t3 font-mono mr-1.5">
                            {l.kind === "gone" ? "−" : "+"}
                          </span>
                          {l.text || <span className="text-t3">·</span>}
                        </div>
                      ))}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-char leading-relaxed">
                    {preview || <span className="text-t3 italic">(empty)</span>}
                  </pre>
                )
              ) : (
                <div className="text-t3 italic text-sm">—</div>
              )}
            </div>
            {selected?.thinking_note && (
              <div className="px-5 py-2.5 border-t border-bd bg-yelp/40 text-xs text-yeld italic">
                what you were thinking: “{selected.thinking_note}”
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-bd bg-s1 px-5 py-3 flex items-center gap-3">
          <div className="text-2xs text-t3 font-mono">
            {selected
              ? isLatest
                ? "This is the current version."
                : `Going back ${relativeTime(selected.timestamp)}`
              : "No checkpoint selected"}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-t2 hover:text-char"
            >
              cancel
            </button>
            <button
              disabled={!selected || isLatest}
              onClick={() => setConfirming(true)}
              className="btn-yel px-4 py-1.5 text-sm rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
              title={isLatest ? "Already the current version" : "Restore this version"}
            >
              Restore this version
            </button>
          </div>
        </div>

        {confirming && selected && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-bg/85"
            onClick={() => setConfirming(false)}
          >
            <div
              className="max-w-sm w-full mx-4 bg-bg border border-bd2 rounded-xl shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-serif text-xl text-char mb-2">
                Go back to this version?
              </div>
              <p className="text-sm text-t2 mb-1 leading-relaxed">
                Your current note will be replaced with the version from{" "}
                <span className="text-char font-medium">
                  {friendlyDate(selected.timestamp)}
                </span>
                .
              </p>
              <p className="text-xs text-t3 mb-4 leading-relaxed">
                Nothing is lost — the current version stays in history, and you
                can always scrub forward to it again.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-1.5 text-sm text-t2 hover:text-char"
                  onClick={() => setConfirming(false)}
                >
                  cancel
                </button>
                <button
                  className="btn-yel px-4 py-1.5 text-sm rounded-md"
                  onClick={() => {
                    setConfirming(false);
                    onRestore(selected.oid);
                  }}
                  autoFocus
                >
                  yes, restore
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
