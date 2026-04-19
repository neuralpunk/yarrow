import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { NoteSummary, PathCollection } from "../../lib/types";
import { isGhostPath } from "../../lib/types";
import { relativeTime } from "../../lib/format";

interface Props {
  collections: PathCollection[];
  rootName: string;
  notes: NoteSummary[];
  selectedPath: string | null;
  onSelect: (name: string | null) => void;
  onEditCondition: (name: string, current: string) => void;
  onAddFork: (parent: string) => void;
  pendingForkParent: string | null;
  onCommitPendingFork: (condition: string) => void;
  onCancelPendingFork: () => void;
  /** The path the user is actively editing in. Used as the comparison
   *  baseline so each card can show a "+N / −M" diff: how many notes
   *  you'd gain and how many you'd lose by switching to that path. */
  currentPathName?: string;
  /** Drop target: when the user drags a note from the sidebar onto a path
   *  card we add that slug to the path. Resolves once the membership change
   *  is persisted so the graph re-renders with the new count. */
  onDropNoteOnPath?: (pathName: string, slug: string) => Promise<void> | void;
}

interface Node {
  coll: PathCollection;
  depth: number;
  parent: Node | null;
  children: Node[];
  rowIndex: number;
  subtreeEnd: number;
  y: number;
  x: number;
}

const ROW_H = 120;
const COL_W = 300;
const PAD_L = 90;
const PAD_R = 320;
const PAD_T = 70;
const PAD_B = 90;
const CARD_W = 260;
/** Width reserved for each historical ghost generation, stacked left of root.
 *  Wider than COL_W so there's room for the dashed connector to breathe
 *  between the ghost anchor card and the live root. */
const GHOST_COL_W = 360;

/**
 * The Paths map. Draws a tree of path *collections* (not git branches)
 * rooted at the designated main path. Time/semantics flow left → right;
 * children branch off of their parent. Selecting a node highlights its
 * whole subtree and surfaces its members via the detail panel.
 */
/** Compute "{gained, lost}" between two path-member arrays. Used by both the
 *  card badges and the PathDetail diff panel so the maths stays in one place. */
export function pathDiffCounts(
  baseline: string[] | undefined,
  candidate: string[] | undefined,
): { gained: number; lost: number } {
  if (!baseline || !candidate) return { gained: 0, lost: 0 };
  const b = new Set(baseline);
  const c = new Set(candidate);
  let gained = 0;
  let lost = 0;
  for (const s of c) if (!b.has(s)) gained++;
  for (const s of b) if (!c.has(s)) lost++;
  return { gained, lost };
}

function ForkingRoadInner({
  collections,
  rootName,
  notes,
  selectedPath,
  onSelect,
  onEditCondition,
  onAddFork,
  pendingForkParent,
  onCommitPendingFork,
  onCancelPendingFork,
  currentPathName,
  onDropNoteOnPath,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Window-relative anchor for the hover preview popover. We capture the
  // hovered card's bounding rect so the popover can sit just to its right
  // (or left, near the right edge of the screen) — visible even though
  // PathsPane is fullscreen and the sidebar's note list is hidden behind.
  const [hoverAnchor, setHoverAnchor] = useState<DOMRect | null>(null);

  // Members of the user's currently-active path — the baseline every other
  // path is diffed against. Memoized once per render so card-level badges
  // don't re-walk the collection list.
  const baselineMembers = useMemo(() => {
    if (!currentPathName) return undefined;
    return collections.find((c) => c.name === currentPathName)?.members;
  }, [collections, currentPathName]);

  // Broadcast which path is being hovered so the note list (and anything
  // else that wants ambient feedback) can highlight the path's slugs in
  // place. While the path-detail panel is open we sit out — PathDetail
  // dispatches its own steady-state highlight for the selected path, and
  // letting hovers fight that produces a flickery list.
  useEffect(() => {
    if (selectedPath) return;
    const slugs = hovered
      ? collections.find((c) => c.name === hovered)?.members ?? null
      : null;
    window.dispatchEvent(new CustomEvent("yarrow:path-highlight", {
      detail: { slugs },
    }));
    return () => {
      window.dispatchEvent(new CustomEvent("yarrow:path-highlight", {
        detail: { slugs: null },
      }));
    };
  }, [hovered, collections, selectedPath]);

  const titleFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of notes) m.set(n.slug, n.title || n.slug);
    return m;
  }, [notes]);

  // Build the *live* tree: only non-ghost collections participate in the
  // rightward flow. Root is always the declared `rootName`. Missing parents
  // attach to the root as a safety net.
  const { flat, maxDepth, rootNode } = useMemo(() => {
    const map = new Map<string, Node>();
    const live = collections.filter((c) => !isGhostPath(c, rootName));
    for (const c of live) {
      map.set(c.name, {
        coll: c,
        depth: 0,
        parent: null,
        children: [],
        rowIndex: 0,
        subtreeEnd: 0,
        x: 0,
        y: 0,
      });
    }
    const rootNode = map.get(rootName);
    if (!rootNode) {
      return { flat: [] as Node[], maxDepth: 0, rootNode: null as Node | null };
    }
    for (const n of map.values()) {
      if (n.coll.name === rootName) continue;
      const parent = map.get(n.coll.parent) || rootNode;
      n.parent = parent;
      parent.children.push(n);
    }
    const setDepth = (n: Node, d: number) => {
      n.depth = d;
      n.children.sort((a, b) =>
        (b.coll.created_at || 0) - (a.coll.created_at || 0),
      );
      n.children.forEach((c) => setDepth(c, d + 1));
    };
    setDepth(rootNode, 0);
    const flat: Node[] = [];
    const walk = (n: Node) => {
      n.rowIndex = flat.length;
      flat.push(n);
      for (const c of n.children) walk(c);
      n.subtreeEnd = flat.length - 1;
    };
    walk(rootNode);
    const maxDepth = flat.reduce((m, n) => Math.max(m, n.depth), 0);
    return { flat, maxDepth, rootNode };
  }, [collections, rootName]);

  // Ghost eras: group ghosts by their permanent trunk (`parent`). An era's
  // anchor is the ghost whose name equals that trunk (if still around —
  // it can be missing if it was deleted). The anchor card gets the dashed
  // connector to the live root; peers stack above and below the anchor.
  const ghostGens = useMemo(() => {
    const groups = new Map<string, PathCollection[]>();
    for (const c of collections) {
      if (!isGhostPath(c, rootName)) continue;
      // Era key: the permanent trunk, unless this path *is* an era trunk
      // itself (parent == "") — then it anchors its own era under its name.
      const era = c.parent || c.name;
      const arr = groups.get(era) ?? [];
      arr.push(c);
      groups.set(era, arr);
    }
    // Order generations newest-first. Newest = highest max(created_at) within
    // the group, so the most recent era hugs the live root most closely.
    const eras = [...groups.entries()].map(([era, gens]) => {
      const sorted = gens.slice().sort((a, b) => {
        // Anchor first, then peers by creation time desc.
        if (a.name === era) return -1;
        if (b.name === era) return 1;
        return (b.created_at || 0) - (a.created_at || 0);
      });
      const mostRecent = Math.max(...sorted.map((c) => c.created_at || 0));
      return { era, collections: sorted, mostRecent };
    });
    eras.sort((a, b) => b.mostRecent - a.mostRecent);
    return eras;
  }, [collections, rootName]);

  // Live tree gets pushed right when there are ghost generations, so the
  // ghost zone always has room to the left of the root.
  const liveOffsetX = PAD_L + ghostGens.length * GHOST_COL_W;

  // The ghost peers of an era stack above/below the anchor (centered on the
  // live root's row). So we pre-shift the live tree down by the tallest
  // "peers-above-anchor" count across all eras — otherwise peers in the top
  // half of the stack drift above PAD_T and get clipped off the canvas.
  const maxPeersAbove = ghostGens.reduce((m, g) => {
    // Anchor doesn't count; peers fill alternating slots: 0 up, 1 down, 2 up…
    const peers = Math.max(0, g.collections.length - 1);
    const above = Math.ceil(peers / 2);
    return Math.max(m, above);
  }, 0);
  const liveYShift = maxPeersAbove * ROW_H;

  for (const n of flat) {
    n.x = liveOffsetX + n.depth * COL_W;
    n.y = PAD_T + liveYShift + n.rowIndex * ROW_H + ROW_H / 2;
  }

  // Ghost node positions: each era is a vertical stack at its column, the
  // anchor (if still in the ghost zone) centered on the live root row so the
  // dashed connector reads as a clean horizontal line. If the era's trunk
  // is currently live (so there's no ghost to act as anchor), the first
  // peer takes the anchor row and subsequent peers alternate above/below.
  const ghostPositions = useMemo(() => {
    const m = new Map<string, { x: number; y: number; coll: PathCollection; isAnchor: boolean; eraIndex: number }>();
    if (!rootNode) return m;
    ghostGens.forEach((g, idx) => {
      // Column index: 0 = nearest to root (most recent era), N-1 = farthest.
      const colX = liveOffsetX - (idx + 1) * GHOST_COL_W;
      const anchorY = rootNode.y;
      const anchor = g.collections.find((c) => c.name === g.era);
      if (anchor) {
        m.set(anchor.name, { x: colX, y: anchorY, coll: anchor, isAnchor: true, eraIndex: idx });
        const peers = g.collections.filter((c) => c.name !== g.era);
        peers.forEach((c, i) => {
          const offset = Math.floor(i / 2) + 1;
          const sign = i % 2 === 0 ? -1 : 1;
          const y = anchorY + sign * offset * ROW_H;
          m.set(c.name, { x: colX, y, coll: c, isAnchor: false, eraIndex: idx });
        });
      } else {
        // No anchor in the ghost zone → the trunk is currently live. Place
        // the first peer on the anchor row and stack the rest alternating.
        g.collections.forEach((c, i) => {
          let y: number;
          if (i === 0) {
            y = anchorY;
          } else {
            const offset = Math.floor((i - 1) / 2) + 1;
            const sign = (i - 1) % 2 === 0 ? -1 : 1;
            y = anchorY + sign * offset * ROW_H;
          }
          m.set(c.name, { x: colX, y, coll: c, isAnchor: false, eraIndex: idx });
        });
      }
    });
    return m;
  }, [ghostGens, rootNode, liveOffsetX]);

  // Canvas dimensions need to accommodate the tallest ghost stack.
  const ghostYRange = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of ghostPositions.values()) {
      if (p.y < min) min = p.y;
      if (p.y > max) max = p.y;
    }
    return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 };
  }, [ghostPositions]);

  const width = Math.max(PAD_L + (maxDepth + 1) * COL_W + PAD_R + (ghostGens.length * GHOST_COL_W), 800);
  const height = Math.max(
    PAD_T + PAD_B + 260,
    PAD_T + liveYShift + flat.length * ROW_H + PAD_B + (pendingForkParent ? ROW_H : 0),
    ghostYRange.max + PAD_B + 80,
  );

  const byName = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of flat) m.set(n.coll.name, n);
    return m;
  }, [flat]);

  // Selection highlighting: ancestry *and* descendants, so clicking a path
  // shows its upstream trunk AND everything that branches off it.
  const highlight = useMemo(() => {
    const s = new Set<string>();
    const name = hovered || selectedPath;
    if (!name) return s;
    const node = byName.get(name);
    if (!node) return s;
    // ancestors
    let cur: Node | null = node;
    while (cur) {
      s.add(cur.coll.name);
      cur = cur.parent;
    }
    // descendants
    const walk = (n: Node) => {
      s.add(n.coll.name);
      for (const c of n.children) walk(c);
    };
    walk(node);
    return s;
  }, [hovered, selectedPath, byName]);

  const hasActive = highlight.size > 0;

  const strokeFor = (n: Node): number => {
    const count = n.coll.members.length;
    return 2 + Math.min(8, Math.sqrt(count) * 2);
  };
  const colorFor = (n: Node): string => {
    if (n.coll.name === rootName) return "var(--yel)";
    let h = 0;
    for (let i = 0; i < n.coll.name.length; i++) h = (h * 31 + n.coll.name.charCodeAt(i)) >>> 0;
    const hue = 260 + (h % 100);
    return `hsl(${hue} 48% 48%)`;
  };

  // pan + zoom ─────────────────────────────────
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStateRef = useRef<null | { x0: number; y0: number; px: number; py: number }>(null);
  const centered = useRef(false);
  useLayoutEffect(() => {
    if (centered.current) return;
    const el = viewportRef.current;
    if (!el || !rootNode) return;
    // Land the live root ~35% across the viewport when ghosts exist (so the
    // historical zone to its left is visible too); otherwise keep the legacy
    // 60px gutter on the far left.
    const hasGhosts = ghostGens.length > 0;
    const targetX = hasGhosts
      ? el.clientWidth * 0.35 - rootNode.x
      : 60;
    const targetY = el.clientHeight / 2 - rootNode.y;
    setPan({ x: targetX, y: targetY });
    centered.current = true;
  }, [rootNode, ghostGens.length]);

  const onWheel = (e: React.WheelEvent) => {
    const el = viewportRef.current;
    if (!el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    const nextZoom = Math.max(0.4, Math.min(2.5, zoom * (1 + delta)));
    if (nextZoom === zoom) return;
    const wx = (mx - pan.x) / zoom;
    const wy = (my - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({ x: mx - wx * nextZoom, y: my - wy * nextZoom });
  };
  const onPanStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-road-interactive]")) return;
    panStateRef.current = { x0: e.clientX, y0: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).style.cursor = "grabbing";
  };
  const onPanMove = (e: React.MouseEvent) => {
    const s = panStateRef.current;
    if (!s) return;
    setPan({ x: s.px + (e.clientX - s.x0), y: s.py + (e.clientY - s.y0) });
  };
  const onPanEnd = (e: React.MouseEvent) => {
    if (panStateRef.current) {
      panStateRef.current = null;
      (e.currentTarget as HTMLElement).style.cursor = "";
    }
  };

  const resetView = () => {
    const el = viewportRef.current;
    if (!el || !rootNode) return;
    setZoom(1);
    setPan({ x: 60, y: el.clientHeight / 2 - rootNode.y });
  };

  const clickStartedAt = useRef<{ x: number; y: number } | null>(null);
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    clickStartedAt.current = { x: e.clientX, y: e.clientY };
    onPanStart(e);
  };
  const onCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-road-interactive]")) return;
    const s = clickStartedAt.current;
    if (s && (Math.abs(e.clientX - s.x) > 3 || Math.abs(e.clientY - s.y) > 3)) return;
    onSelect(null);
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onSelect(null);
      if (ev.key === "0" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        resetView();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelect, rootNode]);

  if (!rootNode) {
    return (
      <div className="w-full h-full flex items-center justify-center p-10 text-t3 italic">
        Loading paths…
      </div>
    );
  }

  const dimFor = (name: string) => (hasActive && !highlight.has(name) ? 0.22 : 1);

  return (
    <div
      ref={viewportRef}
      className="relative w-full h-full overflow-hidden bg-bg"
      style={{ cursor: "grab", touchAction: "none" }}
      onWheel={onWheel}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onPanMove}
      onMouseUp={onPanEnd}
      onMouseLeave={onPanEnd}
      onClick={onCanvasClick}
    >
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-s1/95 border border-bd rounded-md shadow-sm px-1 py-1 backdrop-blur" data-road-interactive>
        <button
          onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(2.5, z * 1.15)); }}
          className="w-7 h-7 text-t2 hover:text-char hover:bg-s2 rounded flex items-center justify-center"
        >+</button>
        <button
          onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(0.4, z / 1.15)); }}
          className="w-7 h-7 text-t2 hover:text-char hover:bg-s2 rounded flex items-center justify-center"
        >−</button>
        <div className="mx-1 text-2xs font-mono text-t3 tabular-nums w-10 text-center">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); resetView(); }}
          className="px-2 h-7 text-2xs text-t2 hover:text-char hover:bg-s2 rounded"
        >fit</button>
      </div>

      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          width,
          height,
        }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* depth gridlines — start at the live root and march right */}
          {Array.from({ length: maxDepth + 1 }).map((_, d) => (
            <line
              key={d}
              x1={liveOffsetX + d * COL_W}
              x2={liveOffsetX + d * COL_W}
              y1={PAD_T - 20}
              y2={height - PAD_B + 20}
              stroke="var(--bd)"
              strokeDasharray="2 6"
              opacity={0.35}
            />
          ))}

          {/* Ghost connectors: one dashed line per ghost, from the ghost's
              right edge to its `parent` — which is either another ghost card
              (sibling-of-an-older-era) or the live root (when the trunk is
              back in the live zone). Per-ghost arrows keep the "here's your
              lineage" cue honest even when an era's anchor is now live. */}
          {[...ghostPositions.values()].map((g) => {
            const parentName = g.coll.parent;
            const parentGhost = parentName ? ghostPositions.get(parentName) : null;
            let x2: number;
            let y2: number;
            if (parentGhost) {
              // Ghost → ghost: link to parent ghost card's right edge.
              x2 = parentGhost.x + 22 + CARD_W;
              y2 = parentGhost.y;
            } else if (!parentName || parentName === rootNode.coll.name) {
              // No parent on record, or parent is the live root → link to
              // the live root's left edge.
              x2 = rootNode.x - 14;
              y2 = rootNode.y;
            } else {
              // Parent is named but missing (deleted at some point). Fall
              // back to the live root so the ghost isn't visually orphaned.
              x2 = rootNode.x - 14;
              y2 = rootNode.y;
            }
            const x1 = g.x + 22 + CARD_W;
            const y1 = g.y;
            const cx = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
            return (
              <path
                key={`ghost-conn-${g.coll.name}`}
                d={d}
                stroke="var(--t3)"
                strokeWidth={2}
                strokeDasharray="4 5"
                fill="none"
                opacity={0.45}
              />
            );
          })}

          {/* ghost cards: faded, dashed, sitting to the left of the live root */}
          {[...ghostPositions.values()].map((g) => {
            const isSelected = selectedPath === g.coll.name;
            return (
              <g
                key={`ghost-${g.coll.name}`}
                data-road-interactive
                onMouseEnter={() => setHovered(g.coll.name)}
                onMouseLeave={() => setHovered((h) => (h === g.coll.name ? null : h))}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(g.coll.name === selectedPath ? null : g.coll.name);
                }}
                style={{ cursor: "pointer", opacity: hovered === g.coll.name || isSelected ? 0.95 : 0.55 }}
              >
                <circle
                  cx={g.x}
                  cy={g.y}
                  r={g.isAnchor ? 8 : 6}
                  fill="var(--bg)"
                  stroke="var(--t3)"
                  strokeWidth={1.6}
                  strokeDasharray="3 3"
                />
                <GhostCard
                  name={g.coll.name}
                  condition={g.coll.condition}
                  isAnchor={g.isAnchor}
                  isSelected={isSelected}
                  memberCount={g.coll.members.length}
                  createdAt={g.coll.created_at}
                  x={g.x + 22}
                  y={g.y - 40}
                  width={CARD_W}
                />
              </g>
            );
          })}

          {/* Root anchor stub — sits immediately left of the live root.
              Only shown when there are no ghost generations: otherwise the
              dashed "past-flows-into-present" connectors already play that
              role, and a second MAIN label in the same space just crowds. */}
          {ghostGens.length === 0 && (
            <g opacity={dimFor(rootNode.coll.name)}>
              <line
                x1={rootNode.x - 48}
                y1={rootNode.y}
                x2={rootNode.x - 14}
                y2={rootNode.y}
                stroke={colorFor(rootNode)}
                strokeWidth={strokeFor(rootNode)}
                strokeLinecap="round"
              />
              <circle cx={rootNode.x - 48} cy={rootNode.y} r={11} fill="var(--yel)" />
              <text
                x={rootNode.x - 48}
                y={rootNode.y - 22}
                textAnchor="middle"
                style={{ fontSize: 10, fill: "var(--yeld)", letterSpacing: "0.2em" }}
                className="mono"
              >
                MAIN
              </text>
            </g>
          )}

          {/* fork curves */}
          {flat.map((n) => {
            if (!n.parent) return null;
            const p = n.parent;
            const stroke = colorFor(n);
            const sw = strokeFor(n);
            const x1 = p.x + 14;
            const y1 = p.y;
            const x2 = n.x - 14;
            const y2 = n.y;
            const cx = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
            return (
              <g key={`edge-${n.coll.name}`} opacity={dimFor(n.coll.name)}>
                <path
                  d={d}
                  stroke={stroke}
                  strokeWidth={sw}
                  fill="none"
                  strokeLinecap="round"
                />
                {!n.coll.condition && (
                  <Signpost
                    condition={n.coll.condition}
                    x={cx}
                    y={(y1 + y2) / 2 - 8}
                    onClick={() => onEditCondition(n.coll.name, n.coll.condition)}
                    emphasize={highlight.has(n.coll.name)}
                  />
                )}
              </g>
            );
          })}

          {/* nodes */}
          {flat.map((n) => {
            const isRoot = n.coll.name === rootName;
            const isSelected = selectedPath === n.coll.name;
            const color = colorFor(n);
            const bx = n.x + 22 + CARD_W + 18;
            const mainNoteTitle =
              n.coll.main_note ? (titleFor.get(n.coll.main_note) || n.coll.main_note) : null;

            return (
              <g
                key={`node-${n.coll.name}`}
                opacity={dimFor(n.coll.name)}
                data-road-interactive
                style={{ transition: "opacity 140ms" }}
              >
                <g
                  onMouseEnter={(e) => {
                    setHovered(n.coll.name);
                    // Capture the card group's bounding rect for the hover
                    // popover — `getBoundingClientRect` works on SVG nodes.
                    const r = (e.currentTarget as SVGGElement).getBoundingClientRect();
                    setHoverAnchor(r);
                  }}
                  onMouseLeave={() => {
                    setHovered((h) => (h === n.coll.name ? null : h));
                    setHoverAnchor(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(n.coll.name === selectedPath ? null : n.coll.name);
                  }}
                  onDragOver={(e) => {
                    if (!onDropNoteOnPath) return;
                    if (!e.dataTransfer.types.includes("application/x-yarrow-note")) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    if (dropTarget !== n.coll.name) setDropTarget(n.coll.name);
                  }}
                  onDragLeave={() => {
                    if (dropTarget === n.coll.name) setDropTarget(null);
                  }}
                  onDrop={(e) => {
                    if (!onDropNoteOnPath) return;
                    const slug = e.dataTransfer.getData("application/x-yarrow-note");
                    setDropTarget(null);
                    if (!slug) return;
                    e.preventDefault();
                    void onDropNoteOnPath(n.coll.name, slug);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={isRoot || isSelected ? 10 : 7}
                    fill={isRoot ? "var(--yel)" : "var(--bg)"}
                    stroke={color}
                    strokeWidth={isRoot || isSelected ? 3 : 2}
                  />
                  {isRoot && (
                    <circle cx={n.x} cy={n.y} r={16} fill="none" stroke="var(--yel)" strokeOpacity={0.28} strokeWidth={2} />
                  )}
                  <DestinationCard
                    name={n.coll.name}
                    condition={n.coll.condition}
                    mainNoteTitle={mainNoteTitle}
                    isRoot={isRoot}
                    isSelected={isSelected}
                    isCurrent={n.coll.name === currentPathName}
                    isDropTarget={dropTarget === n.coll.name}
                    memberCount={n.coll.members.length}
                    diffFromCurrent={
                      currentPathName && n.coll.name !== currentPathName
                        ? pathDiffCounts(baselineMembers, n.coll.members)
                        : undefined
                    }
                    createdAt={n.coll.created_at}
                    x={n.x + 22}
                    y={n.y - 40}
                    width={CARD_W}
                  />
                </g>

                {!pendingForkParent && (
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddFork(n.coll.name);
                    }}
                    style={{ cursor: "pointer" }}
                    data-road-interactive
                  >
                    <circle cx={bx} cy={n.y} r={14} fill="var(--yel)" />
                    <text
                      x={bx}
                      y={n.y + 5}
                      textAnchor="middle"
                      style={{ fontSize: 18, fill: "var(--on-yel)", pointerEvents: "none" }}
                    >+</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* pending fork stub */}
          {pendingForkParent && byName.get(pendingForkParent) && (
            <PendingForkStub
              parent={byName.get(pendingForkParent)!}
              depth={byName.get(pendingForkParent)!.depth + 1}
              totalRows={flat.length}
              yShift={liveYShift}
              onCommit={onCommitPendingFork}
              onCancel={onCancelPendingFork}
            />
          )}
        </svg>
      </div>

      {hovered && hoverAnchor && !selectedPath && (() => {
        // Suppress the hover popover entirely while the path-detail panel
        // is open. The detail panel already owns the "what's in this path"
        // story; layering a transient popover on top of it just adds noise
        // and can occlude the panel's content.
        const coll = collections.find((c) => c.name === hovered);
        if (!coll) return null;
        const baseline = baselineMembers
          ? new Set(baselineMembers)
          : null;
        const candidate = new Set(coll.members);
        const gained = baseline
          ? coll.members.filter((s) => !baseline.has(s))
          : [];
        const lost = baselineMembers
          ? baselineMembers.filter((s) => !candidate.has(s))
          : [];
        const W = 280;
        // Default: place to the right of the card. If that would overflow,
        // fall back to placing on the left.
        const right = hoverAnchor.right + 12 + W <= window.innerWidth;
        const left = right
          ? hoverAnchor.right + 12
          : Math.max(8, hoverAnchor.left - W - 12);
        const top = Math.max(
          8,
          Math.min(
            window.innerHeight - 8 - 280,
            hoverAnchor.top + hoverAnchor.height / 2 - 100,
          ),
        );
        const isCurrent = hovered === currentPathName;
        return (
          <div
            // pointer-events-none so the popover never steals the hover
            // away from its anchor card; it's purely informational.
            className="fixed z-50 pointer-events-none w-[280px] bg-bg border border-bd2 rounded-lg shadow-2xl p-3 animate-fadeIn"
            style={{ left, top }}
          >
            <div className="text-2xs font-mono uppercase tracking-wider text-t3 mb-1">
              {isCurrent ? "current path" : "path preview"}
            </div>
            <div className="font-serif text-base text-char truncate" title={coll.name}>
              {coll.name}
            </div>
            {coll.condition && (
              <div className="text-2xs text-yeld italic mt-0.5 truncate" title={coll.condition}>
                "{coll.condition}"
              </div>
            )}
            <div className="text-2xs text-t3 mt-1">
              {coll.members.length} note{coll.members.length === 1 ? "" : "s"}
            </div>

            {!isCurrent && currentPathName && (gained.length > 0 || lost.length > 0) && (
              <div className="mt-2 pt-2 border-t border-bd flex items-center gap-3 text-2xs font-mono">
                {gained.length > 0 && <span className="text-yeld">+{gained.length} gained</span>}
                {lost.length > 0 && <span className="text-danger">−{lost.length} lost</span>}
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-bd">
              <div className="text-2xs font-mono uppercase tracking-wider text-t3 mb-1">
                In this path
              </div>
              <ul className="text-xs text-char space-y-0.5 max-h-40 overflow-hidden">
                {coll.members.slice(0, 7).map((slug) => (
                  <li key={slug} className="truncate">
                    {coll.main_note === slug && <span className="text-yeld mr-1">★</span>}
                    {titleFor.get(slug) ?? slug}
                  </li>
                ))}
                {coll.members.length > 7 && (
                  <li className="text-2xs italic text-t3">
                    … and {coll.members.length - 7} more
                  </li>
                )}
              </ul>
            </div>
            <div className="mt-2 text-2xs italic text-t3">click for full detail</div>
          </div>
        );
      })()}
    </div>
  );
}

function Signpost({
  condition,
  x,
  y,
  onClick,
  emphasize,
}: {
  condition: string;
  x: number;
  y: number;
  onClick: () => void;
  emphasize: boolean;
}) {
  const label = condition || "+ name this fork";
  const maxChars = 38;
  const display = label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label;
  const textW = Math.max(80, display.length * 6.2 + 20);
  const named = !!condition;
  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ cursor: "pointer" }}
      data-road-interactive
    >
      <rect
        x={x - textW / 2}
        y={y - 12}
        width={textW}
        height={22}
        rx={11}
        fill="var(--bg-soft)"
        stroke={named ? "var(--yel)" : "var(--bd2)"}
        strokeWidth={emphasize ? 1.6 : 1}
        strokeDasharray={named ? undefined : "3 3"}
      />
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        className="serif"
        fontStyle={named ? "italic" : "normal"}
        style={{
          fontSize: 12,
          fill: named ? "var(--yeld)" : "var(--t3)",
          pointerEvents: "none",
        }}
      >
        {display}
      </text>
    </g>
  );
}

function DestinationCard({
  name,
  condition,
  mainNoteTitle,
  isRoot,
  isSelected,
  isCurrent,
  isDropTarget,
  memberCount,
  diffFromCurrent,
  createdAt,
  x,
  y,
  width,
}: {
  name: string;
  condition: string;
  mainNoteTitle: string | null;
  isRoot: boolean;
  isSelected: boolean;
  isCurrent: boolean;
  isDropTarget?: boolean;
  memberCount: number;
  /** "+gained −lost" relative to the user's current path. Omitted for the
   *  current path itself (the diff would always be zero) and when there's
   *  no active path context. */
  diffFromCurrent?: { gained: number; lost: number };
  createdAt: number;
  x: number;
  y: number;
  width: number;
}) {
  const h = 84;
  const stroke = isDropTarget
    ? "var(--yel)"
    : isRoot
      ? "var(--yel)"
      : isSelected
        ? "var(--yel2)"
        : "var(--bd)";
  const sw = isDropTarget ? 2.5 : isRoot ? 2 : isSelected ? 1.6 : 1;
  const bg = isDropTarget
    ? "var(--yelp)"
    : isSelected ? "var(--yelp)" : "var(--bg-soft)";
  return (
    <g>
      <rect x={x} y={y} width={width} height={h} rx={8} fill={bg} stroke={stroke} strokeWidth={sw} />
      <text x={x + 14} y={y + 22} className="serif" style={{ fontSize: 15, fill: "var(--char)", fontWeight: isRoot ? 600 : 500 }}>
        {name}
      </text>
      {condition && (
        <text x={x + 14} y={y + 40} className="serif" style={{ fontSize: 11, fill: "var(--yeld)", fontStyle: "italic" }}>
          {condition.length > 36 ? condition.slice(0, 35) + "…" : condition}
        </text>
      )}
      {mainNoteTitle && (
        <text x={x + 14} y={y + 58} className="mono" style={{ fontSize: 10, fill: "var(--t2)" }}>
          ★ {mainNoteTitle.length > 32 ? mainNoteTitle.slice(0, 31) + "…" : mainNoteTitle}
        </text>
      )}
      <text x={x + 14} y={y + h - 10} className="mono" style={{ fontSize: 10, fill: "var(--t3)" }}>
        {memberCount} note{memberCount === 1 ? "" : "s"} · created {relativeTime(createdAt)}
      </text>
      {isRoot && (
        <text
          x={x + width - 14}
          y={y + 22}
          textAnchor="end"
          className="mono"
          style={{ fontSize: 9, fill: "var(--yeld)", letterSpacing: "0.18em" }}
        >
          MAIN
        </text>
      )}
      {isCurrent && (
        <text
          x={x + width - 14}
          y={y + h - 10}
          textAnchor="end"
          className="mono"
          style={{ fontSize: 9, fill: "var(--yeld)", letterSpacing: "0.18em" }}
        >
          YOU ARE HERE
        </text>
      )}
      {diffFromCurrent && !isCurrent && (diffFromCurrent.gained > 0 || diffFromCurrent.lost > 0) && (
        <g>
          <title>
            {`If you switch to "${name}" from your current path: ` +
              `${diffFromCurrent.gained} note${diffFromCurrent.gained === 1 ? "" : "s"} added, ` +
              `${diffFromCurrent.lost} removed.`}
          </title>
          <rect
            x={x + width - 78}
            y={y + h - 22}
            width={64}
            height={16}
            rx={8}
            fill="var(--bg)"
            stroke="var(--bd)"
          />
          {diffFromCurrent.gained > 0 && (
            <text
              x={x + width - 70}
              y={y + h - 10}
              className="mono"
              style={{ fontSize: 10, fill: "var(--yeld)", fontWeight: 600 }}
            >
              +{diffFromCurrent.gained}
            </text>
          )}
          {diffFromCurrent.lost > 0 && (
            <text
              x={x + width - 18}
              y={y + h - 10}
              textAnchor="end"
              className="mono"
              style={{ fontSize: 10, fill: "var(--danger)", fontWeight: 600 }}
            >
              −{diffFromCurrent.lost}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

function PendingForkStub({
  parent,
  depth,
  totalRows,
  yShift,
  onCommit,
  onCancel,
}: {
  parent: Node;
  depth: number;
  totalRows: number;
  yShift: number;
  onCommit: (condition: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, []);
  // Anchor relative to the parent so ghosts on the left don't skew the stub.
  const stubX = parent.x + COL_W;
  const stubY = PAD_T + yShift + totalRows * ROW_H + ROW_H / 2;
  void depth; // depth arg retained for caller compatibility; position derives from parent
  const x1 = parent.x + 14;
  const y1 = parent.y;
  const x2 = stubX - 14;
  const y2 = stubY;
  const cx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  return (
    <g className="animate-fadeIn" data-road-interactive>
      <path d={d} stroke="var(--yel)" strokeWidth={3} strokeDasharray="4 4" fill="none" strokeLinecap="round" opacity={0.75} />
      <circle cx={stubX} cy={stubY} r={8} fill="var(--bg)" stroke="var(--yel)" strokeWidth={2.2} />
      <foreignObject x={stubX + 16} y={stubY - 28} width={380} height={64}>
        <div
          // @ts-expect-error — xmlns for HTML inside SVG
          xmlns="http://www.w3.org/1999/xhtml"
          className="flex flex-col gap-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onCommit(value); }
              else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            }}
            placeholder="If the Seattle job comes through…"
            className="w-full px-3 py-1.5 bg-bg border border-yel rounded-md text-char text-sm font-serif italic placeholder:not-italic placeholder:text-t3/70 shadow-md outline-none"
          />
          <div className="text-2xs text-t3 italic pl-1">
            Enter to branch off <span className="text-t2">{parent.coll.name}</span>, Esc to cancel.
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

function GhostCard({
  name,
  condition,
  isAnchor,
  isSelected,
  memberCount,
  createdAt,
  x,
  y,
  width,
}: {
  name: string;
  condition: string;
  isAnchor: boolean;
  isSelected: boolean;
  memberCount: number;
  createdAt: number;
  x: number;
  y: number;
  width: number;
}) {
  const h = 78;
  const stroke = isSelected ? "var(--yel2)" : "var(--t3)";
  const sw = isSelected ? 1.6 : 1;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={h}
        rx={8}
        fill="var(--bg)"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray="4 3"
      />
      <text
        x={x + 14}
        y={y + 22}
        className="serif"
        style={{ fontSize: 14, fill: "var(--t2)", fontWeight: isAnchor ? 600 : 500 }}
      >
        {name}
      </text>
      {condition && (
        <text
          x={x + 14}
          y={y + 40}
          className="serif"
          style={{ fontSize: 11, fill: "var(--t3)", fontStyle: "italic" }}
        >
          “{condition.length > 34 ? condition.slice(0, 33) + "…" : condition}”
        </text>
      )}
      <text x={x + 14} y={y + h - 10} className="mono" style={{ fontSize: 9, fill: "var(--t3)", letterSpacing: "0.12em" }}>
        {memberCount} note{memberCount === 1 ? "" : "s"} · ghost · {relativeTime(createdAt)}
      </text>
      {isAnchor && (
        <text
          x={x + width - 14}
          y={y + 22}
          textAnchor="end"
          className="mono"
          style={{ fontSize: 9, fill: "var(--t3)", letterSpacing: "0.18em" }}
        >
          WAS MAIN
        </text>
      )}
    </g>
  );
}

export default memo(ForkingRoadInner);
