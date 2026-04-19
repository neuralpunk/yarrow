import { memo, useEffect, useMemo, useRef, useState } from "react";
import { NewDirectionIcon, StatusDot } from "../../lib/icons";
import type { PathCollection } from "../../lib/types";
import { isGhostPath } from "../../lib/types";
import { colorForPath, isRoot } from "../../lib/pathAwareness";

interface Props {
  /** v2 path collections (source of truth for the switcher). */
  collections: PathCollection[];
  /** Name of the root collection (usually "main"). */
  rootName: string;
  /** Currently-focused collection name. */
  currentPath: string;
  checkpointCount: number;
  dirty: boolean;
  /** Monotonic nonce bumped whenever a save just completed. */
  lastSavedAt?: number;
  /** When false (basic workspace mode), the path pill + path actions are hidden. */
  mappingEnabled?: boolean;
  onSwitchPath: (name: string) => void;
  /** "+ Branch this note" — pre-seed with current note/path context. */
  onBranchFromHere: () => void;
  /** Open the full paths graph (the fullscreen Forking Road). */
  onOpenPaths: () => void;
  /** Open the connection graph (Map overlay). */
  onOpenMap: () => void;
  /** Click the condition pill to set/edit it for the current path. */
  onEditCurrentCondition: () => void;
}

/**
 * The top-of-editor chrome. A single line that answers three questions
 * at a glance: *where am I* (path name + colored dot + condition),
 * *what can I do right now* (branch this / open paths), and *is my work
 * saved* (checkpoint count + save indicator).
 *
 * Ambient, not loud — the user shouldn't have to "read" this to know
 * they're on `if-seattle`, just glance.
 */
function ToolbarInner({
  collections,
  rootName,
  currentPath,
  checkpointCount,
  dirty,
  lastSavedAt,
  mappingEnabled = true,
  onSwitchPath,
  onBranchFromHere,
  onOpenPaths,
  onOpenMap,
  onEditCurrentCondition,
}: Props) {
  const active = currentPath || rootName || "main";
  const byName = useMemo(() => {
    const m = new Map<string, PathCollection>();
    for (const c of collections) m.set(c.name, c);
    return m;
  }, [collections]);
  const activeCol = byName.get(active) ?? null;
  const condition = (activeCol?.condition || "").trim();
  const color = colorForPath(active);
  const root = active === rootName || isRoot(active);

  // "Saved just now" flash
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!lastSavedAt) return;
    setJustSaved(true);
    const t = window.setTimeout(() => setJustSaved(false), 2500);
    return () => window.clearTimeout(t);
  }, [lastSavedAt]);

  const saveLabel = dirty
    ? "editing…"
    : justSaved
      ? "saved just now"
      : "saved";
  const saveDotColor = dirty ? "var(--yel)" : justSaved ? "var(--yel)" : "var(--accent2)";

  // Switcher dropdown
  const [open, setOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!mappingEnabled) {
    return (
      <div className="toolbar h-11 flex items-center px-6 gap-2 text-xs border-b border-bd bg-bg">
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-2xs text-t3 shrink-0 whitespace-nowrap">
          <span className="font-mono">{checkpointCount} checkpoints</span>
          <span className="flex items-center gap-1.5 transition-[color] duration-500">
            <StatusDot color={saveDotColor} size={5} />
            <span className={justSaved && !dirty ? "text-yeld" : ""}>{saveLabel}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="toolbar h-11 flex items-center px-6 gap-2 text-xs border-b border-bd bg-bg">
      {/* ── Path pill (colored dot + name + condition) ── */}
      <div className="relative" ref={switcherRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full hover:bg-s2 transition group max-w-[480px]"
          title="Switch path"
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-bg"
            style={{ background: color }}
          />
          <span className="font-serif text-[15px] text-char leading-none whitespace-nowrap">
            {active}
          </span>
          {!root && (
            condition ? (
              <span
                className="font-serif italic text-[13px] text-yeld truncate max-w-[300px] leading-none"
                title={condition}
              >
                “{condition}”
              </span>
            ) : (
              <span
                className="font-serif italic text-[12px] text-t3 truncate leading-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCurrentCondition();
                }}
                role="button"
                title="What question is this path asking?"
              >
                + name this path
              </span>
            )
          )}
          {root && collections.length <= 1 && (
            <span className="text-2xs italic text-t3 leading-none">
              your only path
            </span>
          )}
          <svg
            className="text-t3 group-hover:text-char shrink-0"
            width="10" height="10" viewBox="0 0 10 10" fill="none"
          >
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {open && (
          <PathSwitcher
            collections={collections}
            rootName={rootName}
            current={active}
            onPick={(name) => { setOpen(false); onSwitchPath(name); }}
            onOpenPaths={() => { setOpen(false); onOpenPaths(); }}
          />
        )}
      </div>

      {/* ── "Back to main" quick pill (only when off-main) ── */}
      {!root && rootName && (
        <button
          onClick={() => onSwitchPath(rootName)}
          className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border border-yel/70 text-yeld hover:bg-yelp transition group"
          title={`Go back to ${rootName} — the trunk of your thinking`}
        >
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: "var(--yel)" }}
          />
          <span className="font-serif text-[12.5px] leading-none whitespace-nowrap">
            ← {rootName}
          </span>
        </button>
      )}

      {/* ── Actions ── */}
      <div className="ml-1 flex items-center gap-1.5 shrink-0">
        <button
          onClick={onBranchFromHere}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] text-t2 hover:bg-s2 hover:text-char transition"
          title="Start a path from this note (⌘⇧B)"
        >
          <NewDirectionIcon />
          <span>Branch this</span>
        </button>
        <button
          onClick={onOpenMap}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] text-t2 hover:bg-s2 hover:text-char transition"
          title="Open the connections map"
        >
          <ConnectionsMapIcon />
          <span>Connections Map</span>
        </button>
        <button
          onClick={onOpenPaths}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] text-t2 hover:bg-s2 hover:text-char transition"
          title="Open the paths graph"
        >
          <GraphIcon />
          <span>Paths</span>
        </button>
      </div>

      <div className="flex-1" />

      {/* ── Save status ── */}
      <div className="flex items-center gap-3 text-2xs text-t3 shrink-0 whitespace-nowrap">
        <span className="font-mono">{checkpointCount} checkpoints</span>
        <span className="flex items-center gap-1.5 transition-[color] duration-500">
          <StatusDot color={saveDotColor} size={5} />
          <span className={justSaved && !dirty ? "text-yeld" : ""}>{saveLabel}</span>
        </span>
      </div>
    </div>
  );
}

function PathSwitcher({
  collections,
  rootName,
  current,
  onPick,
  onOpenPaths,
}: {
  collections: PathCollection[];
  rootName: string;
  current: string;
  onPick: (name: string) => void;
  onOpenPaths: () => void;
}) {
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, []);

  // Sort live paths: current first, root second (unless it's the current),
  // then by created_at desc. Ghosts get their own section below — they're
  // still switchable (PathDetail exposes promote-back from there), but
  // visually separated so the live tree reads first.
  const { liveOrdered, ghostOrdered } = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const match = (c: PathCollection) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.condition.toLowerCase().includes(q);
    const live = collections.filter((c) => !isGhostPath(c, rootName) && match(c));
    const ghost = collections.filter((c) => isGhostPath(c, rootName) && match(c));
    live.sort((a, b) => {
      if (a.name === current) return -1;
      if (b.name === current) return 1;
      const aRoot = a.name === rootName ? 1 : 0;
      const bRoot = b.name === rootName ? 1 : 0;
      if (aRoot !== bRoot) return bRoot - aRoot;
      return (b.created_at || 0) - (a.created_at || 0);
    });
    ghost.sort((a, b) => {
      // Group by permanent trunk (era); trunk anchor first, peers by
      // creation desc. A ghost's "era key" is its parent, or its own name
      // if it was itself an original root.
      const aEra = a.parent || a.name;
      const bEra = b.parent || b.name;
      if (aEra !== bEra) return bEra.localeCompare(aEra);
      const aAnchor = a.name === aEra ? -1 : 0;
      const bAnchor = b.name === bEra ? -1 : 0;
      if (aAnchor !== bAnchor) return aAnchor - bAnchor;
      return (b.created_at || 0) - (a.created_at || 0);
    });
    return { liveOrdered: live, ghostOrdered: ghost };
  }, [collections, rootName, current, filter]);

  const onCurrentRoot = current === rootName;

  return (
    <div
      className="absolute left-0 top-full mt-1 z-50 w-[380px] bg-bg border border-bd2 rounded-lg shadow-2xl py-1.5 animate-fadeIn"
    >
      <div className="px-3 pt-1.5 pb-2">
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Switch path · ${collections.length} available`}
          className="w-full px-2.5 py-1.5 bg-s1 border border-bd rounded-md text-char text-xs placeholder:text-t3 focus:outline-none focus:border-yel"
        />
      </div>
      {!onCurrentRoot && (
        <button
          onClick={() => onPick(rootName)}
          className="w-full text-left px-3.5 py-1.5 text-xs text-yeld hover:bg-yelp flex items-center gap-2 border-b border-bd"
          title="Jump back to the trunk"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-yel" />
          <span className="font-medium">← Back to {rootName}</span>
        </button>
      )}
      <ul className="max-h-[360px] overflow-y-auto">
        {liveOrdered.length === 0 && ghostOrdered.length === 0 && (
          <li className="px-3.5 py-3 text-xs text-t3 italic">
            No paths match.
          </li>
        )}
        {liveOrdered.map((c) => {
          const cond = c.condition.trim();
          const color = c.name === rootName ? "var(--yel)" : colorForPath(c.name);
          const isActive = c.name === current;
          const isRootItem = c.name === rootName;
          return (
            <li key={c.name}>
              <button
                onClick={() => onPick(c.name)}
                className={`w-full text-left px-3.5 py-2 flex items-start gap-2.5 transition ${
                  isActive ? "bg-yelp/60" : "hover:bg-s2/70"
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                  style={{ background: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-[14.5px] text-char truncate">
                      {c.name}
                    </span>
                    {isActive && (
                      <span className="text-2xs font-mono text-yeld tracking-wider">
                        YOU
                      </span>
                    )}
                    {isRootItem && !isActive && (
                      <span className="text-2xs font-mono text-t3 tracking-wider">
                        MAIN
                      </span>
                    )}
                  </div>
                  {cond ? (
                    <div className="text-2xs text-yeld italic truncate mt-0.5">
                      “{cond}”
                    </div>
                  ) : !isRootItem ? (
                    <div className="text-2xs text-t3 italic truncate mt-0.5">
                      unnamed path
                    </div>
                  ) : null}
                  <div className="text-2xs text-t3 mt-1 font-mono">
                    {c.members.length} note{c.members.length === 1 ? "" : "s"}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {ghostOrdered.length > 0 && (
          <li className="px-3.5 pt-3 pb-1 text-2xs font-mono uppercase tracking-[0.18em] text-t3 border-t border-bd mt-1">
            ghosts · past eras
          </li>
        )}
        {ghostOrdered.map((c) => {
          const cond = c.condition.trim();
          const isActive = c.name === current;
          // A ghost anchors its own era when its own name matches its era
          // key — i.e., it was an original trunk before being ghosted.
          const era = c.parent || c.name;
          const isAnchor = c.name === era;
          return (
            <li key={c.name}>
              <button
                onClick={() => onPick(c.name)}
                className={`w-full text-left px-3.5 py-2 flex items-start gap-2.5 transition opacity-75 hover:opacity-100 ${
                  isActive ? "bg-yelp/60" : "hover:bg-s2/70"
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mt-1 shrink-0 border border-dashed border-t3"
                  style={{ background: "transparent" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif italic text-[14.5px] text-t2 truncate">
                      {c.name}
                    </span>
                    {isAnchor && (
                      <span className="text-2xs font-mono text-t3 tracking-wider">
                        WAS MAIN
                      </span>
                    )}
                  </div>
                  {cond && (
                    <div className="text-2xs text-t3 italic truncate mt-0.5">
                      “{cond}”
                    </div>
                  )}
                  <div className="text-2xs text-t3 mt-1 font-mono">
                    ghost · {c.members.length} note{c.members.length === 1 ? "" : "s"}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-bd mt-1 pt-1">
        <button
          onClick={onOpenPaths}
          className="w-full text-left px-3.5 py-2 text-xs text-t2 hover:bg-s2 hover:text-char flex items-center gap-2 transition"
        >
          <GraphIcon />
          <span>Open the paths graph</span>
        </button>
      </div>
    </div>
  );
}

function GraphIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="3" cy="11" r="1.5" />
      <circle cx="11" cy="7" r="1.5" />
      <path d="M3 4.5v5M4.3 3.7l5.4 2.6M4.3 10.3l5.4-2.6" />
    </svg>
  );
}

/** Triangle of connected dots — matches the right tool-rail's Map icon so
 *  the two entry-points share a visual language. */
function ConnectionsMapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="3" r="1.6" />
      <circle cx="11" cy="3" r="1.6" />
      <circle cx="7" cy="11" r="1.6" />
      <path d="M4.2 4.1L5.8 9.7M8.2 9.7L9.8 4.1M4.6 3h4.8" />
    </svg>
  );
}

// memo so the path ribbon doesn't re-render every keystroke just because
// its parent re-rendered (e.g. on selection-change events). All the
// reference-stable props it actually depends on rarely change.
export default memo(ToolbarInner);
