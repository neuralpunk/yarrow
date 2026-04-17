import { useMemo, useState } from "react";
import type { BranchTopo } from "../../lib/types";
import { relativeTime } from "../../lib/format";
import {
  NewDirectionIcon,
  ChevronRightIcon,
  HelpIcon,
} from "../../lib/icons";

interface Node {
  topo: BranchTopo;
  depth: number;
  parent: Node | null;
  children: Node[];
  rowIndex: number;
  subtreeEnd: number;
  isLastChild: boolean;
}

interface Props {
  topology: BranchTopo[];
  currentPath: string;
  onSwitch: (name: string) => void;
  onDelete: (name: string) => void;
  onMerge: (name: string) => void;
  onNewPath: () => void;
}

const COL_W = 16;
const ROW_H = 30;

export default function PathGraph({
  topology,
  currentPath,
  onSwitch,
  onDelete,
  onMerge,
  onNewPath,
}: Props) {
  const [menu, setMenu] = useState<string | null>(null);
  const [abandonedOpen, setAbandonedOpen] = useState(false);

  const { liveRows, staleRows } = useMemo(() => {
    const now = Date.now() / 1000;
    const STALE = 60 * 86400;
    const live = topology.filter(
      (t) => t.is_current || (t.tip_time && now - t.tip_time < STALE) || !t.tip_time,
    );
    const stale = topology.filter(
      (t) => !t.is_current && t.tip_time && now - t.tip_time >= STALE,
    );

    const map = new Map<string, Node>();
    for (const t of live) {
      map.set(t.name, {
        topo: t,
        depth: 0,
        parent: null,
        children: [],
        rowIndex: 0,
        subtreeEnd: 0,
        isLastChild: false,
      });
    }
    const roots: Node[] = [];
    for (const t of live) {
      const n = map.get(t.name)!;
      if (t.forked_from) {
        const parent = map.get(t.forked_from.parent_branch);
        if (parent) {
          n.parent = parent;
          parent.children.push(n);
        } else {
          roots.push(n);
        }
      } else {
        roots.push(n);
      }
    }
    const setDepth = (n: Node, d: number) => {
      n.depth = d;
      n.children.sort((a, b) => (b.topo.tip_time || 0) - (a.topo.tip_time || 0));
      n.children.forEach((c, i) => {
        c.isLastChild = i === n.children.length - 1;
        setDepth(c, d + 1);
      });
    };
    // Prefer "main" / "master" as root if present, else tip_time desc.
    roots.sort((a, b) => {
      const aRoot = a.topo.name === "main" || a.topo.name === "master" ? -1 : 0;
      const bRoot = b.topo.name === "main" || b.topo.name === "master" ? -1 : 0;
      if (aRoot !== bRoot) return aRoot - bRoot;
      return (b.topo.tip_time || 0) - (a.topo.tip_time || 0);
    });
    roots.forEach((r, i) => {
      r.isLastChild = i === roots.length - 1;
    });
    roots.forEach((r) => setDepth(r, 0));

    const flat: Node[] = [];
    const walk = (n: Node) => {
      n.rowIndex = flat.length;
      flat.push(n);
      for (const c of n.children) walk(c);
      n.subtreeEnd = flat.length - 1;
    };
    for (const r of roots) walk(r);

    return { liveRows: flat, staleRows: stale };
  }, [topology]);

  // For each column, which rows have a branch "alive" (subtree in progress)
  const liveColSet = useMemo(() => {
    // For each row r and col c, we want: is there any branch B at col c with
    // B.rowIndex <= r <= B.subtreeEnd AND r > B.rowIndex (strictly below start)?
    const map: Record<string, boolean> = {};
    for (const n of liveRows) {
      for (let r = n.rowIndex + 1; r <= n.subtreeEnd; r++) {
        map[`${r}-${n.depth}`] = true;
      }
    }
    return map;
  }, [liveRows]);

  const maxDepth = liveRows.reduce((m, n) => Math.max(m, n.depth), 0);

  return (
    <div className="pt-4 pb-2">
      <div className="flex items-center justify-between px-4 mb-1">
        <div className="text-2xs uppercase tracking-wider text-t3 font-semibold">
          Your Paths
        </div>
        <span
          className="y-tip text-t3 inline-flex"
          data-tip="Each path is a different direction you've explored"
        >
          <HelpIcon />
        </span>
      </div>
      <div className="relative">
        {liveRows.map((n) => {
          const isCurrent = n.topo.name === currentPath;
          const connectorsWidth = (maxDepth + 1) * COL_W;
          return (
            <div
              key={n.topo.name}
              className="relative flex items-center group"
              style={{ height: ROW_H }}
            >
              <svg
                width={connectorsWidth}
                height={ROW_H}
                className="absolute left-1 pointer-events-none"
              >
                {/* Continuation lines for ancestor columns */}
                {Array.from({ length: n.depth }).map((_, c) => {
                  const alive = liveColSet[`${n.rowIndex}-${c}`];
                  if (!alive) return null;
                  return (
                    <line
                      key={`cont-${c}`}
                      x1={c * COL_W + COL_W / 2}
                      x2={c * COL_W + COL_W / 2}
                      y1={0}
                      y2={ROW_H}
                      stroke="var(--bd2)"
                      strokeWidth={1.2}
                    />
                  );
                })}
                {/* Fork connector: vertical from parent row top down to this row's midpoint, then horizontal to this col */}
                {n.parent && (
                  <>
                    <line
                      x1={(n.depth - 1) * COL_W + COL_W / 2}
                      x2={(n.depth - 1) * COL_W + COL_W / 2}
                      y1={0}
                      y2={ROW_H / 2}
                      stroke="var(--bd2)"
                      strokeWidth={1.2}
                    />
                    <path
                      d={`M ${(n.depth - 1) * COL_W + COL_W / 2} ${ROW_H / 2}
                          Q ${(n.depth - 1) * COL_W + COL_W / 2 + 4} ${ROW_H / 2}
                            ${(n.depth - 1) * COL_W + COL_W + 2} ${ROW_H / 2}
                          L ${n.depth * COL_W + COL_W / 2} ${ROW_H / 2}`}
                      stroke="var(--bd2)"
                      strokeWidth={1.2}
                      fill="none"
                    />
                    {/* If we are not the last child, continue the parent column below this row */}
                    {!n.isLastChild && (
                      <line
                        x1={(n.depth - 1) * COL_W + COL_W / 2}
                        x2={(n.depth - 1) * COL_W + COL_W / 2}
                        y1={ROW_H / 2}
                        y2={ROW_H}
                        stroke="var(--bd2)"
                        strokeWidth={1.2}
                      />
                    )}
                  </>
                )}
                {/* Branch's own column continues below this row if it has children */}
                {n.children.length > 0 && (
                  <line
                    x1={n.depth * COL_W + COL_W / 2}
                    x2={n.depth * COL_W + COL_W / 2}
                    y1={ROW_H / 2}
                    y2={ROW_H}
                    stroke="var(--bd2)"
                    strokeWidth={1.2}
                  />
                )}
                {/* Dot */}
                <circle
                  cx={n.depth * COL_W + COL_W / 2}
                  cy={ROW_H / 2}
                  r={isCurrent ? 5 : 3.2}
                  fill={isCurrent ? "var(--yel)" : "var(--bg)"}
                  stroke={isCurrent ? "var(--yeld)" : "var(--bd2)"}
                  strokeWidth={1.5}
                />
              </svg>
              <button
                onClick={() => !isCurrent && onSwitch(n.topo.name)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu(menu === n.topo.name ? null : n.topo.name);
                }}
                className={`w-full pr-2 py-1 text-left flex items-center group-hover:bg-s2 rounded ${
                  isCurrent ? "text-char" : "text-ch2"
                }`}
                style={{ paddingLeft: connectorsWidth + 8 }}
              >
                <span
                  className={`text-sm truncate ${
                    isCurrent ? "font-medium" : ""
                  }`}
                >
                  {n.topo.name}
                </span>
                <span className="ml-2 text-2xs text-t3">
                  {relativeTime(n.topo.tip_time)}
                </span>
              </button>
              {menu === n.topo.name && !isCurrent && (
                <div
                  className="absolute left-full top-0 ml-1 z-10 w-56 bg-bg border border-bd2 rounded-md shadow-lg text-xs py-1"
                  onMouseLeave={() => setMenu(null)}
                >
                  <button
                    className="w-full px-3 py-1.5 text-left hover:bg-s2"
                    onClick={() => { setMenu(null); onSwitch(n.topo.name); }}
                  >
                    Switch to this path
                  </button>
                  <button
                    className="w-full px-3 py-1.5 text-left hover:bg-s2"
                    onClick={() => { setMenu(null); onMerge(n.topo.name); }}
                    title="Fold this path's changes back into your current path"
                  >
                    Bring together with current path
                  </button>
                  <button
                    className="w-full px-3 py-1.5 text-left hover:bg-s2 text-danger"
                    onClick={() => { setMenu(null); onDelete(n.topo.name); }}
                  >
                    Abandon this path
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {staleRows.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setAbandonedOpen((x) => !x)}
            className="w-full text-left px-4 py-1.5 text-2xs uppercase tracking-wider text-t3 hover:text-t2 flex items-center gap-1"
          >
            <span
              className="inline-flex items-center transition-transform"
              style={{ transform: abandonedOpen ? "rotate(90deg)" : "none" }}
            >
              <ChevronRightIcon />
            </span>
            <span>Paths not taken ({staleRows.length})</span>
          </button>
          {abandonedOpen && (
            <ul className="px-4">
              {staleRows.map((p) => (
                <li key={p.name}>
                  <button
                    onClick={() => onSwitch(p.name)}
                    className="w-full text-left px-1 py-1 rounded text-xs text-t3 hover:bg-s2 italic"
                  >
                    {p.name}{" "}
                    <span className="text-t3/70">
                      · {relativeTime(p.tip_time)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="px-3 mt-3">
        <button
          onClick={onNewPath}
          title="Branch this note's path — explore a different angle without losing what you have now"
          className="w-full inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs border border-dashed border-bd2 text-t2 hover:bg-s2 hover:text-char hover:border-yel transition"
        >
          <NewDirectionIcon />
          <span>Explore a new direction…</span>
        </button>
      </div>
    </div>
  );
}
