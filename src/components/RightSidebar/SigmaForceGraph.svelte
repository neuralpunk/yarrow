<script lang="ts">
  // WebGL force-directed graph for the dense-graph case (>50 nodes
  // with `forceAtHighN` opted in). Uses Sigma 3 + graphology +
  // graphology-layout-forceatlas2. The smaller-graph code path
  // continues to use the D3-SVG renderer in ConnectionGraph.svelte
  // because that surface owns drag-to-connect, lasso selection,
  // color-blind-safe dashed edges, and chord layout — features
  // Sigma doesn't ship out of the box. At 1000+ nodes the SVG
  // renderer falls over; this WebGL path is what those users get
  // when they explicitly opt in via the "show force graph anyway"
  // toggle on the dense-gate banner.
  //
  // Theme integration: CSS variables are read from
  // documentElement at mount and re-read on a MutationObserver
  // attribute change (dark-mode toggle, color-blind-safe class).

  import { onMount, onDestroy } from "svelte";
  import Sigma from "sigma";
  import { MultiDirectedGraph } from "graphology";
  import forceAtlas2 from "graphology-layout-forceatlas2";
  import type { Graph as YarrowGraph, LinkType } from "../../lib/types";
  import { LINK_TYPE_COLORS } from "../../lib/types";

  interface Props {
    graph: YarrowGraph | null;
    activeSlug: string | null;
    mainNoteSlug?: string | null;
    onSelect: (slug: string) => void;
    fillHeight?: boolean;
  }

  let {
    graph,
    activeSlug,
    mainNoteSlug,
    onSelect,
    fillHeight,
  }: Props = $props();

  let container = $state<HTMLDivElement | null>(null);
  let sigma: Sigma | null = null;
  let gGraph: MultiDirectedGraph | null = null;
  let hover = $state<{ slug: string; title: string; x: number; y: number } | null>(null);

  // Read a CSS variable from documentElement, falling back if unset.
  function cssVar(name: string, fallback: string): string {
    if (typeof document === "undefined") return fallback;
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  }

  interface Palette {
    activeFill: string;
    activeText: string;
    neighborFill: string;
    neighborStroke: string;
    mainColor: string;
    bg: string;
    edgeDefault: string;
  }

  function readPalette(): Palette {
    return {
      activeFill: cssVar("--yel", "#B38230"),
      activeText: cssVar("--on-yel", "#FFFFFF"),
      neighborFill: cssVar("--s2", "#E1D8C0"),
      neighborStroke: cssVar("--bd2", "rgba(28,22,14,0.17)"),
      mainColor: cssVar("--home-ring", "#B38230"),
      bg: cssVar("--bg", "#F5EFE0"),
      edgeDefault: cssVar("--yel", "#B38230"),
    };
  }

  function nodeColor(slug: string, palette: Palette): string {
    if (slug === activeSlug) return palette.activeFill;
    if (mainNoteSlug && slug === mainNoteSlug) return palette.mainColor;
    return palette.neighborFill;
  }

  function nodeSize(slug: string): number {
    if (slug === activeSlug) return 12;
    if (mainNoteSlug && slug === mainNoteSlug) return 10;
    return 7;
  }

  function edgeColor(type: LinkType): string {
    return LINK_TYPE_COLORS[type] ?? "#999";
  }

  // Build (or rebuild) the graphology graph from the Yarrow graph
  // payload. Layout positions are computed via ForceAtlas2 once on
  // build; subsequent prop changes that only touch labels or active
  // highlight skip the rebuild and just patch node attributes.
  function buildGraph(): MultiDirectedGraph {
    const g = new MultiDirectedGraph();
    if (!graph) return g;
    const palette = readPalette();
    for (const n of graph.notes) {
      g.addNode(n.slug, {
        // Random initial scatter — ForceAtlas2 needs non-degenerate
        // positions to start; otherwise all nodes pile at (0,0) and
        // the simulation can't separate them.
        x: Math.random(),
        y: Math.random(),
        label: n.title || n.slug,
        size: nodeSize(n.slug),
        color: nodeColor(n.slug, palette),
      });
    }
    for (let i = 0; i < graph.links.length; i++) {
      const l = graph.links[i];
      if (!g.hasNode(l.from) || !g.hasNode(l.to)) continue;
      try {
        g.addEdgeWithKey(`e${i}`, l.from, l.to, {
          color: edgeColor(l.type),
          type: "line",
          size: 1,
        });
      } catch { /* dup edge — graphology rejects, skip */ }
    }
    // Run ForceAtlas2 synchronously for a moderate iteration count.
    // Far cheaper than D3's per-frame ticks because it's a pure
    // numeric loop with no DOM. 200 iters is enough for graphs up
    // to ~5k nodes to settle visibly.
    if (g.order > 0) {
      forceAtlas2.assign(g, {
        iterations: 200,
        settings: {
          gravity: 1,
          scalingRatio: 10,
          slowDown: 8,
          barnesHutOptimize: g.order > 200,
        },
      });
    }
    return g;
  }

  function syncHighlight() {
    if (!gGraph) return;
    const palette = readPalette();
    gGraph.forEachNode((slug) => {
      gGraph!.setNodeAttribute(slug, "color", nodeColor(slug, palette));
      gGraph!.setNodeAttribute(slug, "size", nodeSize(slug));
    });
    sigma?.refresh();
  }

  onMount(() => {
    if (!container) return;
    gGraph = buildGraph();
    sigma = new Sigma(gGraph, container, {
      renderEdgeLabels: false,
      labelColor: { color: cssVar("--char", "#1C1812") },
      labelSize: 12,
      labelWeight: "500",
      labelFont: "'Source Serif 4', ui-serif, Georgia, serif",
      defaultEdgeColor: cssVar("--bd", "rgba(28,22,14,0.16)"),
    });
    sigma.on("clickNode", ({ node }) => onSelect(node));
    sigma.on("enterNode", ({ node, event }) => {
      const title = (gGraph!.getNodeAttribute(node, "label") as string) || node;
      hover = { slug: node, title, x: event.x, y: event.y };
    });
    sigma.on("leaveNode", () => { hover = null; });
    sigma.on("clickStage", () => { hover = null; });
  });

  // Rebuild when the structural input changes. Reference-identity
  // check on `graph` is the cheap heuristic; AppShell reassigns the
  // whole object on every refresh, so any structural change comes
  // through this path.
  let lastGraphRef: YarrowGraph | null = null;
  $effect(() => {
    if (!sigma || !container) return;
    if (graph === lastGraphRef) return;
    lastGraphRef = graph;
    if (gGraph) gGraph.clear();
    const next = buildGraph();
    sigma.setGraph(next);
    gGraph = next;
    sigma.refresh();
  });

  // Patch highlight without rebuilding when only the active note
  // changes.
  $effect(() => {
    void activeSlug;
    syncHighlight();
  });

  // Re-read CSS variables on theme / a11y class change.
  $effect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const refresh = () => syncHighlight();
    const mo = new MutationObserver(refresh);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  });

  onDestroy(() => {
    sigma?.kill();
    sigma = null;
    gGraph?.clear();
    gGraph = null;
  });
</script>

<div
  bind:this={container}
  class="relative w-full"
  style:height={fillHeight ? "100%" : "300px"}
>
  {#if hover}
    <div
      class="absolute pointer-events-none px-2 py-1 rounded-sm bg-bg/95 border border-bd text-2xs font-serif text-char shadow-sm max-w-[220px]"
      style:left="{hover.x + 12}px"
      style:top="{hover.y + 12}px"
    >
      <div class="truncate">{hover.title}</div>
    </div>
  {/if}
</div>
