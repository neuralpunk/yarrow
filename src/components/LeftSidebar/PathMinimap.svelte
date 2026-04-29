<script lang="ts">
  import type { PathCollection, PathCollectionsView } from "../../lib/types";
  import { HelpIcon, NewDirectionIcon } from "../../lib/iconsSvelte";
  import { buildPathColorMap, colorForPath } from "../../lib/pathAwareness";
  import { tr } from "../../lib/i18n/index.svelte";
  import { SK } from "../../lib/platform.svelte";

  interface Props {
    view: PathCollectionsView | null;
    onSwitch?: (name: string) => void;
    onOpen: () => void;
    onNewPath: () => void;
  }

  let { view, onOpen, onNewPath }: Props = $props();
  let t = $derived(tr());

  interface MapNode {
    c: PathCollection;
    depth: number;
    parent: MapNode | null;
    children: MapNode[];
    rowIndex: number;
  }

  let layout = $derived.by(() => {
    if (!view) return { flat: [] as MapNode[], maxDepth: 0, rootName: "main" };
    const rootName = view.root;
    const map = new Map<string, MapNode>();
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
    const setDepth = (n: MapNode, d: number) => {
      n.depth = d;
      n.children.sort((a, b) => (b.c.created_at || 0) - (a.c.created_at || 0));
      n.children.forEach((c) => setDepth(c, d + 1));
    };
    setDepth(rootNode, 0);
    const flat: MapNode[] = [];
    const walk = (n: MapNode) => {
      n.rowIndex = flat.length;
      flat.push(n);
      for (const c of n.children) walk(c);
    };
    walk(rootNode);
    const maxDepth = flat.reduce((m, n) => Math.max(m, n.depth), 0);
    return { flat, maxDepth, rootName };
  });

  const COL = 36;
  const ROW = 22;
  const PAD_L = 18;
  const PAD_T = 10;
  const PAD_R = 14;
  const PAD_B = 8;

  let width = $derived(PAD_L + (layout.maxDepth + 1) * COL + PAD_R);
  let height = $derived(PAD_T + Math.max(1, layout.flat.length) * ROW + PAD_B);

  function xy(n: MapNode) {
    return {
      x: PAD_L + n.depth * COL,
      y: PAD_T + n.rowIndex * ROW + ROW / 2,
    };
  }

  let colorOverrides = $derived(buildPathColorMap(view?.collections));

  function colorFor(name: string): string {
    return name === layout.rootName && !colorOverrides[name]
      ? "var(--yel)"
      : colorForPath(name, { overrides: colorOverrides });
  }
</script>

<div class="mt-5 pt-5 pb-2 border-t border-bd/20">
  <div class="flex items-center justify-between px-4 mb-2">
    <div class="text-2xs uppercase tracking-wider text-t3 font-semibold">
      {t("sidebar.paths.title")}
    </div>
    <span
      class="y-tip text-t3 inline-flex"
      data-tip={t("sidebar.paths.helpTip")}
      data-tip-align="right"
    >
      <HelpIcon />
    </span>
  </div>

  <button
    onclick={onOpen}
    class="mx-3 w-[calc(100%-1.5rem)] block rounded-md border border-bd/70 bg-bg-soft/50 hover:bg-s2/70 transition p-1.5 overflow-x-auto"
    title={t("sidebar.paths.openTooltip")}
  >
    <svg {width} {height} viewBox="0 0 {width} {height}">
      {#each layout.flat as n (`e-${n.c.name}`)}
        {#if n.parent}
          {@const p = xy(n.parent)}
          {@const c = xy(n)}
          {@const cx = (p.x + c.x) / 2}
          {@const d = `M ${p.x + 3} ${p.y} C ${cx} ${p.y}, ${cx} ${c.y}, ${c.x - 3} ${c.y}`}
          <path
            {d}
            stroke={colorFor(n.c.name)}
            stroke-width={1.4}
            fill="none"
            stroke-linecap="round"
            opacity={0.8}
          />
        {/if}
      {/each}
      {#each layout.flat as n (`n-${n.c.name}`)}
        {@const pt = xy(n)}
        {@const isRoot = n.c.name === layout.rootName}
        {@const color = colorFor(n.c.name)}
        {@const unnamed = !n.c.condition && !isRoot}
        <g>
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
            cx={pt.x}
            cy={pt.y}
            r={isRoot ? 4.5 : 3.2}
            fill={isRoot ? color : "var(--bg)"}
            stroke={color}
            stroke-width={isRoot ? 2 : 1.3}
          />
          {#if unnamed}
            <circle cx={pt.x + 5} cy={pt.y - 5} r={1.5} fill="var(--t3)" />
          {/if}
        </g>
      {/each}
    </svg>
  </button>

  <div class="px-3 mt-2 flex items-center gap-1.5">
    <button
      onclick={onOpen}
      class="flex-1 text-2xs text-t3 hover:text-char italic text-left px-2 py-1 rounded-sm hover:bg-s2 transition"
    >
      {t("sidebar.paths.seeAll")}
    </button>
    <button
      onclick={onNewPath}
      title={t("sidebar.paths.newTooltip", { shortcut: SK.newDirection })}
      class="text-t2 hover:text-char w-6 h-6 flex items-center justify-center rounded-sm hover:bg-s2 transition"
    >
      <NewDirectionIcon />
    </button>
  </div>
</div>
