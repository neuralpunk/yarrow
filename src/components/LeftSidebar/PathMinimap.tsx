import { memo, useMemo } from "react";
import type { PathCollection, PathCollectionsView } from "../../lib/types";
import { HelpIcon, NewDirectionIcon } from "../../lib/icons";
import { buildPathColorMap, colorForPath } from "../../lib/pathAwareness";
import { useT } from "../../lib/i18n";
import { SK } from "../../lib/platform";

interface Props {
  view: PathCollectionsView | null;
  onSwitch?: (name: string) => void;
  onOpen: () => void;
  onNewPath: () => void;
}

/**
 * Tiny always-visible preview of the Paths graph. Collections-based now.
 * Clicking the canvas opens the full view; the minimap is just orientation.
 */
function PathMinimapInner({ view, onOpen, onNewPath }: Props) {
  const t = useT();
  const { flat, maxDepth, rootName } = useMemo(() => {
    if (!view) return { flat: [] as any[], maxDepth: 0, rootName: "main" };
    const rootName = view.root;
    const map = new Map<string, {
      c: PathCollection;
      depth: number;
      parent: any | null;
      children: any[];
      rowIndex: number;
    }>();
    for (const c of view.collections) {
      map.set(c.name, { c, depth: 0, parent: null, children: [], rowIndex: 0 });
    }
    const rootNode = map.get(rootName);
    if (!rootNode) return { flat: [], maxDepth: 0, rootName };
    for (const n of map.values()) {
      if (n.c.name === rootName) continue;
      const parent = map.get(n.c.parent) || rootNode;
      n.parent = parent;
      parent.children.push(n);
    }
    const setDepth = (n: any, d: number) => {
      n.depth = d;
      n.children.sort((a: any, b: any) => (b.c.created_at || 0) - (a.c.created_at || 0));
      n.children.forEach((c: any) => setDepth(c, d + 1));
    };
    setDepth(rootNode, 0);
    const flat: any[] = [];
    const walk = (n: any) => {
      n.rowIndex = flat.length;
      flat.push(n);
      for (const c of n.children) walk(c);
    };
    walk(rootNode);
    const maxDepth = flat.reduce((m, n) => Math.max(m, n.depth), 0);
    return { flat, maxDepth, rootName };
  }, [view]);

  const COL = 36;
  const ROW = 22;
  const PAD_L = 18;
  const PAD_T = 10;
  const PAD_R = 14;
  const PAD_B = 8;
  const width = PAD_L + (maxDepth + 1) * COL + PAD_R;
  const height = PAD_T + Math.max(1, flat.length) * ROW + PAD_B;

  const xy = (n: any) => ({
    x: PAD_L + n.depth * COL,
    y: PAD_T + n.rowIndex * ROW + ROW / 2,
  });

  const colorOverrides = useMemo(
    () => buildPathColorMap(view?.collections),
    [view?.collections],
  );
  // The minimap treats whichever path is currently `root` as main, so an
  // unset accent falls through to the workspace primary via colorForPath.
  const colorFor = (name: string) =>
    name === rootName && !colorOverrides[name]
      ? "var(--yel)"
      : colorForPath(name, { overrides: colorOverrides });

  return (
    <div className="mt-5 pt-5 pb-2 border-t border-bd/20">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="text-2xs uppercase tracking-wider text-t3 font-semibold">
          {t("sidebar.paths.title")}
        </div>
        <span
          className="y-tip text-t3 inline-flex"
          data-tip={t("sidebar.paths.helpTip")}
          data-tip-align="right"
        >
          <HelpIcon />
        </span>
      </div>

      <button
        onClick={onOpen}
        className="mx-3 w-[calc(100%-1.5rem)] block rounded-md border border-bd/70 bg-bg-soft/50 hover:bg-s2/70 transition p-1.5 overflow-x-auto"
        title={t("sidebar.paths.openTooltip")}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {flat.map((n: any) => {
            if (!n.parent) return null;
            const p = xy(n.parent);
            const c = xy(n);
            const cx = (p.x + c.x) / 2;
            const d = `M ${p.x + 3} ${p.y} C ${cx} ${p.y}, ${cx} ${c.y}, ${c.x - 3} ${c.y}`;
            return (
              <path
                key={`e-${n.c.name}`}
                d={d}
                stroke={colorFor(n.c.name)}
                strokeWidth={1.4}
                fill="none"
                strokeLinecap="round"
                opacity={0.8}
              />
            );
          })}
          {flat.map((n: any) => {
            const { x, y } = xy(n);
            const isRoot = n.c.name === rootName;
            const color = colorFor(n.c.name);
            const unnamed = !n.c.condition && !isRoot;
            return (
              <g key={`n-${n.c.name}`}>
                <title>
                  {n.c.name}
                  {n.c.condition ? ` — "${n.c.condition}"` : ""}
                  {" · "}
                  {t(
                    n.c.members.length === 1
                      ? "sidebar.paths.nodeMembersOne"
                      : "sidebar.paths.nodeMembersMany",
                    { count: String(n.c.members.length) },
                  )}
                </title>
                <circle
                  cx={x}
                  cy={y}
                  r={isRoot ? 4.5 : 3.2}
                  fill={isRoot ? color : "var(--bg)"}
                  stroke={color}
                  strokeWidth={isRoot ? 2 : 1.3}
                />
                {unnamed && (
                  <circle cx={x + 5} cy={y - 5} r={1.5} fill="var(--t3)" />
                )}
              </g>
            );
          })}
        </svg>
      </button>

      <div className="px-3 mt-2 flex items-center gap-1.5">
        <button
          onClick={onOpen}
          className="flex-1 text-2xs text-t3 hover:text-char italic text-left px-2 py-1 rounded hover:bg-s2 transition"
        >
          {t("sidebar.paths.seeAll")}
        </button>
        <button
          onClick={onNewPath}
          title={t("sidebar.paths.newTooltip", { shortcut: SK.newDirection })}
          className="text-t2 hover:text-char w-6 h-6 flex items-center justify-center rounded hover:bg-s2 transition"
        >
          <NewDirectionIcon />
        </button>
      </div>
    </div>
  );
}

export default memo(PathMinimapInner);
