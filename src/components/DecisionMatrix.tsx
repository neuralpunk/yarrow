import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/tauri";
import type { NoteSummary, PathCollection, PathCollectionsView } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  notes: NoteSummary[];
  /** Caller-supplied path collection view, so the matrix sees the same
   *  membership the rest of the workspace does. We reload after open in
   *  case the user just edited a path. */
  initialCollections?: PathCollection[];
  /** Optional baseline path the matrix highlights as "current" so the
   *  reader can compare other paths against it visually. */
  currentPathName?: string;
  /** Open a note from a row click. */
  onOpenNote: (slug: string) => void;
}

const STAR_KEY = (workspaceTag: string) => `yarrow.matrixStarred:${workspaceTag}`;

/** Decision matrix: a table you read row-by-row to see which paths satisfy a
 *  set of "must-have" notes. Stars persist per-workspace in localStorage —
 *  intentionally not synced across machines, since the marks are a personal
 *  decision-aid rather than shared metadata. */
export default function DecisionMatrix({
  open, onClose, notes, initialCollections, currentPathName, onOpenNote,
}: Props) {
  const [collections, setCollections] = useState<PathCollection[]>(initialCollections ?? []);
  const [filter, setFilter] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  // Keep localStorage scoped per-vault so two open workspaces don't trample
  // each other's starred sets. We piggyback on the count of notes plus a
  // sample slug as a fingerprint when no explicit workspace key is around.
  const storageKey = useMemo(
    () => STAR_KEY(notes[0]?.slug || "default"),
    [notes],
  );

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(storageKey);
      setStarred(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setStarred(new Set()); }
    api.listPathCollections().then((v: PathCollectionsView) => setCollections(v.collections)).catch(() => {});
  }, [open, storageKey]);

  const persist = (next: Set<string>) => {
    setStarred(next);
    try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
  };
  const toggleStar = (slug: string) => {
    const next = new Set(starred);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    persist(next);
  };

  // Pre-compute path-membership sets so cell lookup stays O(1).
  const memberSets = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of collections) m.set(c.name, new Set(c.members));
    return m;
  }, [collections]);

  // Tag inventory powers the tag-filter chip row; we sort by frequency so
  // the most common tags are easy to reach.
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) for (const t of (n.tags ?? [])) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  // Column-sort: when set, rows are ordered by membership in that path
  // (in-path first, then out-of-path), starred-tied to the top within each
  // group. Click the same header to flip direction; click a third time to
  // clear back to the default starred-then-alphabetical sort.
  const [sortBy, setSortBy] = useState<{ path: string; dir: "in-first" | "out-first" } | null>(null);

  const cycleColumnSort = (path: string) => {
    setSortBy((cur) => {
      if (!cur || cur.path !== path) return { path, dir: "in-first" };
      if (cur.dir === "in-first") return { path, dir: "out-first" };
      return null;
    });
  };

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return notes
      .filter((n) => !showOnlyStarred || starred.has(n.slug))
      .filter((n) => !tagFilter || (n.tags ?? []).includes(tagFilter))
      .filter((n) => !needle ||
        (n.title || n.slug).toLowerCase().includes(needle) ||
        n.slug.toLowerCase().includes(needle))
      .sort((a, b) => {
        // Starred rows always bubble to the top — they're must-haves and
        // belong above the noise regardless of secondary sort.
        const sa = starred.has(a.slug) ? 0 : 1;
        const sb = starred.has(b.slug) ? 0 : 1;
        if (sa !== sb) return sa - sb;

        if (sortBy) {
          const set = memberSets.get(sortBy.path);
          const ina = set?.has(a.slug) ? 0 : 1;
          const inb = set?.has(b.slug) ? 0 : 1;
          if (ina !== inb) {
            return sortBy.dir === "in-first" ? ina - inb : inb - ina;
          }
        }
        return (a.title || a.slug).localeCompare(b.title || b.slug);
      });
  }, [notes, filter, tagFilter, showOnlyStarred, starred, sortBy, memberSets]);

  // Per-path scorecard counted across only the rows currently visible —
  // updates live as the user filters. "All starred satisfied?" is the
  // headline number for must-have decisions.
  const scoreForPath = (path: string) => {
    const set = memberSets.get(path);
    if (!set) return { hits: 0, mustHits: 0, totalMust: 0 };
    let hits = 0;
    let mustHits = 0;
    let totalMust = 0;
    for (const r of rows) {
      const inPath = set.has(r.slug);
      if (inPath) hits++;
      if (starred.has(r.slug)) {
        totalMust++;
        if (inPath) mustHits++;
      }
    }
    return { hits, mustHits, totalMust };
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-7xl h-[88vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-bd flex items-baseline gap-3">
          <div>
            <div className="font-serif text-xl text-char">Decision matrix</div>
            <div className="text-2xs text-t3 mt-0.5">
              Star the notes you can't live without, then read each path's column to see who satisfies the most.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter notes…"
              className="px-2.5 py-1 bg-s1 border border-bd rounded text-char w-44 outline-none focus:border-yel"
            />
            <label className="flex items-center gap-1.5 cursor-pointer text-t2">
              <input type="checkbox" checked={showOnlyStarred} onChange={(e) => setShowOnlyStarred(e.target.checked)} />
              <span>Only ★ rows</span>
            </label>
          </div>
        </div>

        {tagCounts.length > 0 && (
          <div className="px-5 py-2 border-b border-bd flex items-center gap-1.5 flex-wrap text-2xs">
            <span className="text-t3 font-mono mr-1">tags:</span>
            <button
              onClick={() => setTagFilter(null)}
              className={`px-2 py-0.5 rounded-full ${tagFilter === null ? "bg-yel text-on-yel" : "bg-s2 text-t2 hover:bg-s3"}`}
            >
              all
            </button>
            {tagCounts.slice(0, 12).map(([t, n]) => (
              <button
                key={t}
                onClick={() => setTagFilter((cur) => cur === t ? null : t)}
                className={`px-2 py-0.5 rounded-full ${tagFilter === t ? "bg-yel text-on-yel" : "bg-s2 text-t2 hover:bg-s3"}`}
              >
                #{t} <span className="text-t3">{n}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-bg z-10">
              <tr>
                <th className="text-left px-3 py-2 border-b border-bd font-serif font-normal text-yeld text-xs sticky left-0 bg-yelp z-10 min-w-[260px]">
                  Note
                </th>
                {collections.map((c) => {
                  const { hits, mustHits, totalMust } = scoreForPath(c.name);
                  const isCurrent = c.name === currentPathName;
                  const sortActive = sortBy?.path === c.name;
                  const arrow = sortActive
                    ? (sortBy!.dir === "in-first" ? "▼" : "▲")
                    : "⇅";
                  return (
                    <th
                      key={c.name}
                      className={`text-center px-2 py-2 border-b border-bd font-serif font-normal align-top min-w-[110px] ${
                        isCurrent ? "bg-yelp/40" : ""
                      }`}
                    >
                      <button
                        onClick={() => cycleColumnSort(c.name)}
                        className="w-full flex flex-col items-center gap-0.5 group"
                        title="Click to sort rows by membership in this path · click again to flip · click again to clear"
                      >
                        <div className="flex items-center gap-1 text-char text-sm truncate max-w-full">
                          <span className="truncate" title={c.name}>{c.name}</span>
                          <span className={`text-[10px] font-mono ${sortActive ? "text-yeld" : "text-t3 opacity-0 group-hover:opacity-100"}`}>
                            {arrow}
                          </span>
                        </div>
                        <div className="text-2xs text-t3 font-mono">
                          {hits}/{rows.length}
                        </div>
                        {totalMust > 0 && (
                          <div className={`text-2xs font-mono ${mustHits === totalMust ? "text-yeld" : "text-danger"}`}>
                            ★ {mustHits}/{totalMust}
                          </div>
                        )}
                        {isCurrent && (
                          <div className="text-2xs text-yeld font-mono uppercase tracking-wider">
                            you
                          </div>
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={1 + collections.length} className="text-center text-t3 italic py-10">
                    No notes match.
                  </td>
                </tr>
              ) : rows.map((n) => {
                const isStar = starred.has(n.slug);
                return (
                  <tr key={n.slug} className="hover:bg-s1/60">
                    <td className="px-3 py-1.5 border-b border-bd/40 sticky left-0 bg-yelp">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => toggleStar(n.slug)}
                          className={`shrink-0 text-base leading-none ${isStar ? "text-yeld" : "text-t3 hover:text-yel"}`}
                          title={isStar ? "Unstar (no longer must-have)" : "Mark as must-have"}
                        >
                          {isStar ? "★" : "☆"}
                        </button>
                        <button
                          onClick={() => onOpenNote(n.slug)}
                          className="text-left text-yeld hover:text-char truncate flex-1 font-serif font-medium"
                          title={n.title || n.slug}
                        >
                          {n.title || n.slug}
                        </button>
                        {(n.tags ?? []).length > 0 && (
                          <div className="flex gap-1 shrink-0">
                            {(n.tags ?? []).slice(0, 2).map((t) => (
                              <span key={t} className="text-[10px] text-yeld/70 font-mono">#{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    {collections.map((c) => {
                      const inPath = memberSets.get(c.name)?.has(n.slug) ?? false;
                      const isCurrent = c.name === currentPathName;
                      return (
                        <td
                          key={c.name}
                          className={`text-center border-b border-bd/40 px-2 py-1.5 ${
                            isCurrent ? "bg-yelp/20" : ""
                          }`}
                        >
                          <CellMark inPath={inPath} isStar={isStar} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-bd flex justify-between items-center text-2xs text-t3">
          <div>
            ✓ note is on the path · ✗ a starred note is missing · ★ marks a must-have row
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

/** Cell glyph for a single (note × path) intersection. SVG strokes scale
 *  cleanly and keep the marks legible at every UI size — text glyphs
 *  varied a lot across font fallbacks. */
function CellMark({ inPath, isStar }: { inPath: boolean; isStar: boolean }) {
  if (inPath) {
    // Star rows show a chunkier check in the accent colour; non-star
    // rows still show a check, just thinner and quieter.
    const color = isStar ? "var(--yeld)" : "var(--t2)";
    const stroke = isStar ? 3 : 2.2;
    return (
      <svg
        width="20" height="20" viewBox="0 0 20 20"
        fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeLinejoin="round"
        aria-label="present"
        style={{ display: "inline-block", verticalAlign: "middle" }}
      >
        <path d="M4 10.5 L8.5 15 L16 6" />
      </svg>
    );
  }
  if (isStar) {
    // Missing must-have — a heavy red ✗ that catches the eye.
    return (
      <svg
        width="20" height="20" viewBox="0 0 20 20"
        fill="none" stroke="var(--danger)" strokeWidth={3}
        strokeLinecap="round"
        aria-label="missing must-have"
        style={{ display: "inline-block", verticalAlign: "middle" }}
      >
        <path d="M5 5 L15 15 M15 5 L5 15" />
      </svg>
    );
  }
  // Quiet dot for "this note isn't on this path, and isn't starred."
  return (
    <span
      aria-label="not on this path"
      className="inline-block w-1.5 h-1.5 rounded-full bg-bd2 align-middle"
    />
  );
}
