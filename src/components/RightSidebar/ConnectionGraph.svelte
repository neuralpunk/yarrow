<script module lang="ts">
  /// Decide whether the force-simulation should run as a static layout
  /// (synchronous ticks then stop) instead of an animated one. Static
  /// layout is honored for the OS-level prefers-reduced-motion media
  /// query when override is "auto", the user's reduce-motion override
  /// in Settings → Accessibility, and the per-pref "Disable autoplay"
  /// toggle. Note: this helper is shape-only; the live reactive read
  /// happens inside the component using `$derived` + `$effect`.

  /// Returns a CSS `var(--name, fallback)` reference. Applied via
  /// `.style("fill", ...)` / `.style("stroke", ...)` so the browser
  /// repaints the SVG when the theme flips, without rerunning the D3
  /// simulation just to pick up a recoloured palette.
  export function themeVar(name: string, fallback: string): string {
    return `var(${name}, ${fallback})`;
  }

  export function trimLabel(s: string, max: number): string {
    if (s.length <= max) return s;
    return s.slice(0, Math.max(1, max - 1)) + "…";
  }

  export function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  /**
   * Wrap a title into at most `maxLines` lines, each ≤ `maxChars`. Breaks on
   * word boundaries; falls back to a truncated single line when the word
   * doesn't fit.
   */
  export function wrapLabel(s: string, maxChars: number, maxLines: number): string[] {
    const words = s.trim().split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if (candidate.length <= maxChars) {
        cur = candidate;
      } else if (!cur) {
        cur = w;
        lines.push(cur);
        cur = "";
      } else {
        lines.push(cur);
        cur = w;
        if (lines.length === maxLines - 1 && (cur.length > maxChars || words.indexOf(w) < words.length - 1)) {
          const rest = words.slice(words.indexOf(w)).join(" ");
          lines.push(truncate(rest, maxChars));
          return lines;
        }
      }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = truncate(kept[maxLines - 1], maxChars);
      return kept;
    }
    return lines;
  }

  type HighNView = "neighborhood" | "list";

  export const INLINE_HEIGHT = 300;
  export const NODE_MARGIN = 18;
  // Above this many nodes the force/chord layouts stop being "lively"
  // and start eating frames. Force collide is O(n log n) per tick,
  // many-body is O(n²), and both fire 60×/s — the cost compounds fast.
  export const DENSE_GRAPH_THRESHOLD = 50;
  export const FORCE_AT_HIGH_N_KEY = "yarrow.connectionsGraph.forceAtHighN";
  export const HIGH_N_VIEW_KEY = "yarrow.connectionsGraph.highNView";
  export const COACH_DISMISS_KEY = "yarrow.graphCoach.dismissed";
</script>

<script lang="ts">
  import * as d3 from "d3";
  import type { Graph, LinkType } from "../../lib/types";
  import { LINK_TYPE_COLORS, LINK_TYPE_LABELS } from "../../lib/types";
  import { tr } from "../../lib/i18n/index.svelte";
  import { disableAutoplay, reduceMotionOverride } from "../../lib/accessibilityPrefs.svelte";
  import SigmaForceGraph from "./SigmaForceGraph.svelte";

  interface Props {
    graph: Graph | null;
    activeSlug: string | null;
    /** The workspace's starting note. Rendered in a distinct color so "home"
     *  is legible at a glance in every Map view. */
    mainNoteSlug?: string | null;
    onSelect: (slug: string) => void;
    /** Fill the parent container instead of using the inline fixed height. */
    fillHeight?: boolean;
    /** Drag-to-connect handler. */
    onAddLink?: (from: string, to: string, type: LinkType) => Promise<void> | void;
    onBulkTag?: (slugs: string[], tag: string) => Promise<void> | void;
    onBulkAddToPath?: (slugs: string[], pathName: string) => Promise<void> | void;
    pathNames?: string[];
  }

  let {
    graph,
    activeSlug,
    mainNoteSlug,
    onSelect,
    fillHeight,
    onAddLink,
    onBulkTag,
    onBulkAddToPath,
    pathNames,
  }: Props = $props();

  let t = $derived(tr());

  // ──────────────── reduced motion / table-alt detection ────────────────
  // Live derived value. A `$state` mirrors the matchMedia result so
  // the OS-level prefers-reduced-motion change can also flow in.
  let mediaPRM = $state<boolean>(false);
  let cbSafeFlag = $state<boolean>(false);
  let tableAltFlag = $state<boolean>(false);
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => { mediaPRM = mq.matches; };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  $effect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const refresh = () => {
      cbSafeFlag = root.classList.contains("a11y-color-blind-safe");
      tableAltFlag = root.classList.contains("a11y-graph-table-alt");
    };
    refresh();
    const mo = new MutationObserver(refresh);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  });

  let reducedMotion = $derived.by<boolean>(() => {
    if (tableAltFlag) return true;
    if (disableAutoplay.value) return true;
    if (reduceMotionOverride.value === "off") return false;
    if (reduceMotionOverride.value === "on") return true;
    return mediaPRM;
  });

  // ──────────────── top-level state ────────────────
  let expanded = $state(false);
  // svelte-ignore state_referenced_locally
  let forceAtHighN = $state<boolean>(readForceAtHighN());
  // svelte-ignore state_referenced_locally
  let highNView = $state<HighNView>(readHighNView());

  function readForceAtHighN(): boolean {
    try {
      return localStorage.getItem(FORCE_AT_HIGH_N_KEY) === "1";
    } catch {
      return false;
    }
  }
  function readHighNView(): HighNView {
    try {
      const v = localStorage.getItem(HIGH_N_VIEW_KEY);
      return v === "list" ? "list" : "neighborhood";
    } catch {
      return "neighborhood";
    }
  }
  function persistForceAtHighN(v: boolean) {
    try {
      localStorage.setItem(FORCE_AT_HIGH_N_KEY, v ? "1" : "0");
    } catch { /* quota */ }
    forceAtHighN = v;
  }
  function persistHighNView(v: HighNView) {
    try {
      localStorage.setItem(HIGH_N_VIEW_KEY, v);
    } catch { /* quota */ }
    highNView = v;
  }

  // Close on Escape while expanded.
  $effect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") expanded = false;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let totalNodes = $derived(graph?.notes.length ?? 0);
  let isEmpty = $derived(!graph || totalNodes === 0);
  let tooDense = $derived(totalNodes > DENSE_GRAPH_THRESHOLD && !forceAtHighN);
  // Sigma WebGL renderer for the dense-graph case (3.0.2): when the
  // user has opted into "show force graph anyway" past the dense
  // threshold, swap the D3 SVG view for a Sigma 3 + graphology
  // ForceAtlas2 rendering. Avoids the SVG repaint cost at scale
  // (~1000+ nodes) while preserving the small-graph experience —
  // including drag-to-connect, lasso, chord layout, and color-
  // blind-safe dashed edges, none of which Sigma ships out of the
  // box.
  let useSigma = $derived(totalNodes > DENSE_GRAPH_THRESHOLD && forceAtHighN);

  // ──────────────── shared title-by-slug across views ────────────────
  let titleBySlug = $derived.by(() => {
    const m = new Map<string, string>();
    if (graph) for (const n of graph.notes) m.set(n.slug, n.title);
    return m;
  });

  // ──────────────── grouped (StaticConnectionsView) ────────────────
  let grouped = $derived.by(() => {
    const out: Record<LinkType, { outgoing: string[]; incoming: string[] }> = {
      "supports": { outgoing: [], incoming: [] },
      "challenges": { outgoing: [], incoming: [] },
      "came-from": { outgoing: [], incoming: [] },
      "open-question": { outgoing: [], incoming: [] },
    };
    if (!graph || !activeSlug) return out;
    for (const l of graph.links) {
      if (l.from === activeSlug) out[l.type].outgoing.push(l.to);
      else if (l.to === activeSlug) out[l.type].incoming.push(l.from);
    }
    return out;
  });
  let totalForActive = $derived.by(() => {
    if (!activeSlug) return 0;
    let n = 0;
    for (const k of Object.values(grouped)) n += k.outgoing.length + k.incoming.length;
    return n;
  });

  const TYPES: LinkType[] = ["supports", "challenges", "came-from", "open-question"];

  // ──────────────── neighborhood (LocalNeighborhoodView) ────────────────
  const MAX_RING_NEIGHBORS = 24;
  let neighborhoodCenter = $derived(
    activeSlug ?? mainNoteSlug ?? graph?.notes[0]?.slug ?? null,
  );
  let neighbors = $derived.by<Array<{ slug: string; type: LinkType }>>(() => {
    if (!graph || !neighborhoodCenter) return [];
    const center = neighborhoodCenter;
    const seen = new Map<string, LinkType>();
    const priority: Record<LinkType, number> = {
      "supports": 1,
      "challenges": 2,
      "came-from": 3,
      "open-question": 4,
    };
    for (const l of graph.links) {
      let other: string | null = null;
      if (l.from === center) other = l.to;
      else if (l.to === center) other = l.from;
      if (!other || other === center) continue;
      const existing = seen.get(other);
      if (!existing || priority[l.type] < priority[existing]) {
        seen.set(other, l.type);
      }
    }
    return Array.from(seen.entries()).map(([slug, type]) => ({ slug, type }));
  });
  let neighborhoodVisible = $derived(neighbors.slice(0, MAX_RING_NEIGHBORS));
  let neighborhoodHidden = $derived(Math.max(0, neighbors.length - neighborhoodVisible.length));

  // Layout constants for the static neighborhood view.
  const NW = 600;
  const NH = 380;
  const ncx = NW / 2;
  const ncy = NH / 2;
  let nR = $derived(
    neighborhoodVisible.length <= 6 ? 110 : neighborhoodVisible.length <= 12 ? 130 : 145,
  );
  const N_CENTER_R = 32;
  const N_NODE_R = 18;

  // ──────────────── force-graph (GraphView) state ────────────────
  interface Node extends d3.SimulationNodeDatum {
    slug: string;
    title: string;
    isActive: boolean;
    isMain: boolean;
    distance: number;
    degree: number;
  }
  interface Link extends d3.SimulationLinkDatum<Node> {
    type: LinkType;
  }
  interface Hover {
    x: number;
    y: number;
    title: string;
    sub?: string;
  }

  let svgRef = $state<SVGSVGElement | null>(null);
  let containerRef = $state<HTMLDivElement | null>(null);
  let recenterFn: () => void = () => {};

  // User can toggle independently (line 1589), but expand/collapse
  // resets to the default for that mode: collapsed = nearby only, expanded = all.
  let nearbyOnly = $state(true);
  $effect(() => {
    nearbyOnly = !expanded;
  });

  let hover = $state<Hover | null>(null);
  let size = $state<{ w: number; h: number }>({ w: 0, h: 0 });
  let mode = $state<"view" | "connect">("view");

  // svelte-ignore state_referenced_locally
  let spread = $state<boolean>(readSpread());
  function readSpread(): boolean {
    try {
      return localStorage.getItem("yarrow.connectionsGraph.spread") === "1";
    } catch {
      return false;
    }
  }
  $effect(() => {
    try {
      localStorage.setItem("yarrow.connectionsGraph.spread", spread ? "1" : "0");
    } catch { /* quota */ }
  });

  // svelte-ignore state_referenced_locally
  let layoutMode = $state<"force" | "chord">(readLayoutMode());
  function readLayoutMode(): "force" | "chord" {
    try {
      const v = localStorage.getItem("yarrow.mapLayoutMode");
      return v === "chord" ? "chord" : "force";
    } catch {
      return "force";
    }
  }
  $effect(() => {
    try {
      localStorage.setItem("yarrow.mapLayoutMode", layoutMode);
    } catch { /* quota */ }
  });

  let chordFocus = $state<string | null>(null);
  $effect(() => {
    if (layoutMode !== "chord") chordFocus = null;
  });

  let highlightType = $state<LinkType | null>(null);

  let connectDrag = $state<
    | { fromSlug: string; sx: number; sy: number; tx: number; ty: number }
    | null
  >(null);
  let connectPrompt = $state<
    | { from: string; to: string; fromTitle: string; toTitle: string; x: number; y: number }
    | null
  >(null);

  let linkSelHandle: d3.Selection<SVGPathElement, Link, SVGGElement, unknown> | null = null;
  let nodeSelHandle: d3.Selection<SVGGElement, Node, SVGGElement, unknown> | null = null;

  let lassoActive = $state(false);
  let lassoLive: { x0: number; y0: number; x1: number; y1: number } | null = null;
  let lassoRectRef = $state<SVGRectElement | null>(null);
  function writeLassoRect() {
    const el = lassoRectRef;
    const live = lassoLive;
    if (!el || !live) return;
    const x = Math.min(live.x0, live.x1);
    const y = Math.min(live.y0, live.y1);
    const w = Math.abs(live.x1 - live.x0);
    const h = Math.abs(live.y1 - live.y0);
    el.setAttribute("x", String(x));
    el.setAttribute("y", String(y));
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
  }
  let selectedSlugs = $state<Set<string>>(new Set());

  // Adjacency + BFS distances from active slug. Used by the force/chord
  // graph and the toolbar stat readout.
  let adjAndDistances = $derived.by<{ adj: Record<string, Set<string>>; distances: Record<string, number> }>(() => {
    const adj: Record<string, Set<string>> = {};
    const distances: Record<string, number> = {};
    if (!graph) return { adj, distances };
    for (const e of graph.links) {
      (adj[e.from] ??= new Set()).add(e.to);
      (adj[e.to] ??= new Set()).add(e.from);
    }
    if (activeSlug) {
      const queue = [activeSlug];
      distances[activeSlug] = 0;
      while (queue.length) {
        const cur = queue.shift()!;
        const d = distances[cur];
        for (const next of adj[cur] || []) {
          if (distances[next] == null) {
            distances[next] = d + 1;
            queue.push(next);
          }
        }
      }
    }
    return { adj, distances };
  });
  let adj = $derived(adjAndDistances.adj);
  let distances = $derived(adjAndDistances.distances);
  let activeDegree = $derived(activeSlug ? (adj[activeSlug]?.size ?? 0) : 0);

  // Track container size so the expanded view fills the modal and resizes.
  $effect(() => {
    const el = containerRef;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const h = currentInlineHeight ?? rect.height;
      size = { w: rect.width, h };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  // Computed inline height passed to the GraphView container.
  let currentInlineHeight = $derived<number | null>(fillHeight ? null : INLINE_HEIGHT);

  // ──────────────── D3 simulation effect ────────────────
  // TODO(perf): the body below tears down the entire SVG with
  // `selectAll("*").remove()` on every dep change (graph reference,
  // activeSlug, layoutMode, …). For dense graphs this re-runs the
  // full D3 build on every note switch. A proper data-join refactor
  // (persistent DOM + .merge() updates + fingerprint guard) is the
  // right cleanup but is risky to retrofit without coverage; left
  // for a focused follow-up. Theme changes do not trigger this
  // effect because themeVar() reads CSS vars uncached.
  $effect(() => {
    // dependency tracking — read everything we want to retrigger on
    void graph; void activeSlug; void onSelect;
    void nearbyOnly; void adj; void distances;
    void size.w; void size.h; void expanded; void layoutMode;
    void reducedMotion; void spread;

    if (!graph) return;
    if (!svgRef || !containerRef) return;
    if (size.w === 0 || size.h === 0) return;

    const g0 = graph;
    const width = size.w;
    const heightPx = size.h;
    const cx = width / 2;
    const cy = heightPx / 2;
    const minX = NODE_MARGIN;
    const maxX = width - NODE_MARGIN;
    const minY = NODE_MARGIN;
    const maxY = heightPx - NODE_MARGIN;
    const clampX = (x: number) => Math.min(maxX, Math.max(minX, x));
    const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));

    const degree: Record<string, number> = {};
    for (const e of g0.links) {
      degree[e.from] = (degree[e.from] ?? 0) + 1;
      degree[e.to] = (degree[e.to] ?? 0) + 1;
    }

    const allNodes: Node[] = g0.notes.map((n) => ({
      slug: n.slug,
      title: n.title,
      isActive: n.slug === activeSlug,
      isMain: !!mainNoteSlug && n.slug === mainNoteSlug,
      distance: distances[n.slug] ?? Infinity,
      degree: degree[n.slug] ?? 0,
    }));

    const hasAnyLinks = g0.links.length > 0;
    const visibleNodes = nearbyOnly && activeSlug && hasAnyLinks
      ? allNodes.filter((n) => n.distance <= 2)
      : allNodes;
    const visibleSlugs = new Set(visibleNodes.map((n) => n.slug));
    const visibleLinks: Link[] = g0.links
      .filter((e) => visibleSlugs.has(e.from) && visibleSlugs.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, type: e.type }));

    const ringR1 = Math.min(width, heightPx) * 0.26;
    const ringR2 = Math.min(width, heightPx) * 0.4;
    const byDist: Record<number, Node[]> = {};
    for (const n of visibleNodes) {
      const d = Number.isFinite(n.distance) ? n.distance : 3;
      (byDist[d] ??= []).push(n);
    }
    for (const key of Object.keys(byDist)) {
      const d = Number(key);
      const group = byDist[d];
      group.sort((a, b) => b.degree - a.degree || a.slug.localeCompare(b.slug));
      const r = d === 0 ? 0 : d === 1 ? ringR1 : ringR2;
      group.forEach((n, i) => {
        if (d === 0) {
          n.x = cx;
          n.y = cy;
        } else {
          const angle = (i / group.length) * Math.PI * 2 - Math.PI / 2;
          n.x = cx + Math.cos(angle) * r;
          n.y = cy + Math.sin(angle) * r;
        }
      });
    }

    const chordR = Math.min(width, heightPx) * 0.42;
    if (layoutMode === "chord") {
      const nonActive = visibleNodes
        .filter((n) => !n.isActive)
        .slice()
        .sort((a, b) => {
          const da = Number.isFinite(a.distance) ? a.distance : 99;
          const db = Number.isFinite(b.distance) ? b.distance : 99;
          if (da !== db) return da - db;
          return b.degree - a.degree || a.slug.localeCompare(b.slug);
        });
      const total = nonActive.length;
      nonActive.forEach((n, i) => {
        const angle = (i / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * chordR;
        const y = cy + Math.sin(angle) * chordR;
        n.x = x; n.y = y; n.fx = x; n.fy = y;
      });
      const active = visibleNodes.find((n) => n.isActive);
      if (active) { active.x = cx; active.y = cy; active.fx = cx; active.fy = cy; }
    }

    const svg = d3.select(svgRef).attr("viewBox", `0 0 ${width} ${heightPx}`);
    svg.selectAll("*").remove();
    svg.on("click", () => {
      if (layoutMode === "chord") chordFocus = null;
    });

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    const g = zoomLayer.append("g");

    const linkColor = (lt: LinkType): string => {
      switch (lt) {
        case "supports":
          return themeVar("--link-supports", "#5B7A5E");
        case "challenges":
          return themeVar("--link-challenges", "#A64A3C");
        case "came-from":
          return themeVar("--link-came-from", "#978E7E");
        case "open-question":
          return themeVar("--link-open-question", "#7A4E6E");
        default:
          return themeVar("--yel", "#B38230");
      }
    };
    const linkSel = g
      .append("g")
      .attr("fill", "none")
      .selectAll<SVGPathElement, Link>("path")
      .data(visibleLinks)
      .join("path")
      .style("stroke", (d) => linkColor(d.type))
      .attr("stroke-opacity", 0.55)
      .attr("stroke-width", expanded ? 1.5 : 1.2)
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", (d) => {
        const cbSafeNow = document.documentElement.classList.contains(
          "a11y-color-blind-safe",
        );
        if (cbSafeNow) {
          switch (d.type) {
            case "supports":      return null;
            case "challenges":    return "8 3 2 3";
            case "came-from":     return "1 4";
            case "open-question": return "4 4";
          }
        }
        return d.type === "open-question" ? "4 4" : null;
      })
      .attr("pointer-events", "none");
    linkSelHandle = linkSel;

    const nodeSel = g
      .append("g")
      .selectAll<SVGGElement, Node>("g")
      .data(visibleNodes)
      .join("g")
      .attr("cursor", "pointer")
      .attr("data-slug", (d) => d.slug)
      .on("click", (e, d) => {
        if (mode === "connect") return;
        if (layoutMode === "chord") {
          e.stopPropagation();
          chordFocus = chordFocus === d.slug ? null : d.slug;
          return;
        }
        if (expanded) expanded = false;
        onSelect(d.slug);
      })
      .on("mouseenter", function (event, d) {
        const cont = containerRef;
        if (!cont) return;
        const rect = cont.getBoundingClientRect();
        const connCount = adj[d.slug]?.size ?? 0;
        const tFn = t;
        const mainTag = d.isMain ? tFn("sidebar.graph.hoverMainTag") : "";
        const hint =
          mode === "connect" ? tFn("sidebar.graph.hoverConnect")
          : layoutMode === "chord" ? tFn("sidebar.graph.hoverHighlight")
          : tFn("sidebar.graph.hoverOpen");
        const sub = tFn(
          connCount === 1
            ? "sidebar.graph.hoverConnOne"
            : "sidebar.graph.hoverConnMany",
          { count: String(connCount), hint },
        );
        hover = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          title: d.title,
          sub: `${mainTag}${sub}`,
        };
      })
      .on("mousemove", function (event) {
        const cont = containerRef;
        if (!cont) return;
        const rect = cont.getBoundingClientRect();
        const cur = hover;
        if (cur) {
          hover = { ...cur, x: event.clientX - rect.left, y: event.clientY - rect.top };
        }
      })
      .on("mouseleave", () => { hover = null; });

    const activeFill = themeVar("--yel", "#B38230");
    const activeText = themeVar("--on-yel", "#FFFFFF");
    const neighborFill = themeVar("--s2", "#E1D8C0");
    const neighborStroke = themeVar("--bd2", "rgba(28,22,14,0.17)");
    const textColor = themeVar("--char", "#1C1812");
    const mutedText = themeVar("--t2", "#6A6154");
    const mainColor = themeVar("--home-ring", "#B38230");

    const radiusFor = (d: Node) => {
      if (d.isActive) return expanded ? 52 : 38;
      if (d.isMain) return expanded ? 42 : 32;
      if (d.distance === 1) return expanded ? 38 : 28;
      return expanded ? 32 : 24;
    };

    nodeSel
      .append("circle")
      .attr("r", radiusFor)
      .style("fill", (d) => (d.isActive ? activeFill : neighborFill))
      .style("stroke", (d) => {
        if (d.isMain) return mainColor;
        if (d.isActive) return activeFill;
        return neighborStroke;
      })
      .attr("stroke-width", (d) => {
        if (d.isMain) return 3;
        if (d.isActive) return 0;
        return 1;
      })
      .attr("opacity", (d) => {
        if (d.isActive || d.isMain) return 1;
        if (d.distance === 1) return 1;
        if (d.distance === 2) return 0.9;
        return 0.8;
      });

    nodeSel
      .filter((d) => d.isMain)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", (d) => -radiusFor(d) - 6)
      .attr("font-size", 12)
      .style("fill", mainColor)
      .text("★");

    const fontSize = (d: Node) => {
      if (d.isActive) return expanded ? 15 : 13;
      if (d.distance === 1) return expanded ? 12 : 10.5;
      return expanded ? 11 : 10;
    };

    nodeSel.each(function (d) {
      const r = radiusFor(d);
      const sel = d3.select(this);
      const maxChars = Math.max(8, Math.floor(r / (d.isActive ? 3.2 : 3.5)));
      const lines = wrapLabel(d.title, maxChars, 2);
      const lineH = fontSize(d) * 1.12;
      const startY = -((lines.length - 1) * lineH) / 2;
      const text = sel
        .append("text")
        .attr("text-anchor", "middle")
        .attr("font-family", "'Source Serif 4', ui-serif, Georgia, serif")
        .attr("font-style", "italic")
        .attr("font-size", fontSize(d))
        .attr("font-weight", d.isActive ? 500 : 400)
        .style("fill", d.isActive ? activeText : textColor)
        .attr("opacity", d.isActive ? 1 : d.distance <= 1 ? 0.95 : 0.75)
        .attr("pointer-events", "none")
        .attr("dominant-baseline", "central");
      lines.forEach((line, i) => {
        text
          .append("tspan")
          .attr("x", 0)
          .attr("y", startY + i * lineH)
          .text(line);
      });
      if (!d.isActive && d.distance > 2) {
        sel
          .append("text")
          .attr("y", r + 14)
          .attr("text-anchor", "middle")
          .attr("font-family", "'Source Serif 4', ui-serif, Georgia, serif")
          .attr("font-style", "italic")
          .attr("font-size", expanded ? 10.5 : 9.5)
          .style("fill", mutedText)
          .attr("opacity", 0.7)
          .attr("pointer-events", "none")
          .text(truncate(d.title, expanded ? 22 : 16));
      }
    });

    const spreadMul = spread ? 1.8 : 1;
    const simulation = d3
      .forceSimulation<Node>(visibleNodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(visibleLinks)
          .id((d) => d.slug)
          .distance((l) => {
            const s = l.source as Node;
            const tg = l.target as Node;
            if (s.isActive || tg.isActive) return ringR1 * spreadMul;
            return (expanded ? 130 : 96) * spreadMul;
          })
          // Active↔peer links anchor a peer to its ring; peer↔peer links
          // shouldn't drag peers toward each other or they collapse into
          // a clump around any well-connected sub-cluster. Keep the
          // active anchor strong, weaken peer-to-peer pull dramatically
          // so forceRadial + forceManyBody can distribute them around
          // the ring.
          .strength((l) => {
            const s = l.source as Node;
            const tg = l.target as Node;
            return s.isActive || tg.isActive ? 0.55 : 0.08;
          }),
      )
      .force(
        "charge",
        d3.forceManyBody<Node>().strength((d) => {
          // Stronger repulsion at all rings — the previous values let
          // peers clump together when many shared the same hub.
          const base = d.isActive ? -780 : expanded ? -520 : -380;
          return base * (spread ? 1.6 : 1);
        }),
      )
      .force(
        "radial",
        hasAnyLinks
          ? d3.forceRadial<Node>((d) => {
              if (d.isActive) return 0;
              if (d.distance === 1) return ringR1 * spreadMul;
              if (d.distance === 2) return ringR2 * spreadMul;
              return (ringR2 + 40) * spreadMul;
            }, cx, cy).strength(0.7)
          : (d3.forceCenter(cx, cy).strength(0.03) as unknown as d3.Force<Node, undefined>),
      )
      .force("collide", d3.forceCollide<Node>((d) => {
        if (d.isActive) return (expanded ? 52 : 38) + 10;
        if (d.distance === 1) return (expanded ? 44 : 34) + 10;
        return (expanded ? 36 : 28) + 8;
      }));

    simulation.on("tick", () => {
      const active = visibleNodes.find((n) => n.isActive);
      if (active) {
        active.x = cx;
        active.y = cy;
        active.fx = cx;
        active.fy = cy;
      }
      for (const n of visibleNodes) {
        if (n.x != null) n.x = clampX(n.x);
        if (n.y != null) n.y = clampY(n.y);
      }
      // Cast to any so the source/target type after forceLink resolution
      // is treated as fully populated Node refs by the runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      linkSel.attr("d", (d: any) => {
        const sx = d.source.x ?? 0;
        const sy = d.source.y ?? 0;
        const tx = d.target.x ?? 0;
        const ty = d.target.y ?? 0;
        const dx = tx - sx;
        const dy = ty - sy;
        const norm = Math.sqrt(dx * dx + dy * dy) || 1;
        const srcNode = d.source as Node;
        const tgtNode = d.target as Node;
        const srcR =
          (srcNode.isActive ? (expanded ? 52 : 38) : srcNode.distance === 1 ? (expanded ? 38 : 28) : (expanded ? 32 : 24));
        const tgtR =
          (tgtNode.isActive ? (expanded ? 52 : 38) : tgtNode.distance === 1 ? (expanded ? 38 : 28) : (expanded ? 32 : 24));
        const sox = (dx / norm) * srcR;
        const soy = (dy / norm) * srcR;
        const tox = (dx / norm) * tgtR;
        const toy = (dy / norm) * tgtR;
        const x0 = sx + sox, y0 = sy + soy;
        const x1 = tx - tox, y1 = ty - toy;
        if (layoutMode === "chord") {
          const mx = (x0 + x1) / 2 + (cx - (x0 + x1) / 2) * 0.7;
          const my = (y0 + y1) / 2 + (cy - (y0 + y1) / 2) * 0.7;
          return `M${x0},${y0} Q${mx},${my} ${x1},${y1}`;
        }
        return `M${x0},${y0} L${x1},${y1}`;
      });
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    if (reducedMotion) {
      simulation.tick(300);
      simulation.stop();
    }

    const drag = d3
      .drag<SVGGElement, Node>()
      .on("start", function (event, d) {
        if (mode === "connect") {
          if (!onAddLink) return;
          d.fx = d.x;
          d.fy = d.y;
          const cont = containerRef;
          const nodeEl = this as SVGGElement;
          if (!cont) return;
          const cRect = cont.getBoundingClientRect();
          const nRect = nodeEl.getBoundingClientRect();
          const sx = nRect.left + nRect.width / 2 - cRect.left;
          const sy = nRect.top + nRect.height / 2 - cRect.top;
          const src = event.sourceEvent as MouseEvent | undefined;
          const tx = src ? src.clientX - cRect.left : sx;
          const ty = src ? src.clientY - cRect.top : sy;
          connectDrag = { fromSlug: d.slug, sx, sy, tx, ty };
          return;
        }
        if (layoutMode === "chord") return;
        if (d.isActive) return;
        if (!event.active) simulation.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        if (mode === "connect") {
          const cont = containerRef;
          if (!cont) return;
          const cRect = cont.getBoundingClientRect();
          const src = event.sourceEvent as MouseEvent | undefined;
          if (!src) return;
          const tx = src.clientX - cRect.left;
          const ty = src.clientY - cRect.top;
          const prev = connectDrag;
          if (prev) connectDrag = { ...prev, tx, ty };
          return;
        }
        if (layoutMode === "chord") return;
        if (d.isActive) return;
        d.fx = clampX(event.x);
        d.fy = clampY(event.y);
      })
      .on("end", (event, d) => {
        if (mode === "connect") {
          connectDrag = null;
          d.fx = null;
          d.fy = null;
          if (!onAddLink) return;
          const src = event.sourceEvent as MouseEvent | undefined;
          if (!src) return;
          let best: { n: Node; dist: number } | null = null;
          for (const n of visibleNodes) {
            if (n.slug === d.slug) continue;
            const dx = (n.x ?? 0) - event.x;
            const dy = (n.y ?? 0) - event.y;
            const dist = Math.hypot(dx, dy);
            if (!best || dist < best.dist) best = { n, dist };
          }
          const SNAP_RADIUS = expanded ? 60 : 46;
          if (!best || best.dist > SNAP_RADIUS) return;
          const bestN = best.n;
          const alreadyLinked = g0.links.some(
            (l) =>
              (l.from === d.slug && l.to === bestN.slug) ||
              (l.from === bestN.slug && l.to === d.slug),
          );
          if (alreadyLinked) return;
          connectPrompt = {
            from: d.slug,
            to: bestN.slug,
            fromTitle: d.title,
            toTitle: bestN.title,
            x: src.clientX,
            y: src.clientY,
          };
          return;
        }
        if (layoutMode === "chord") return;
        if (d.isActive) return;
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeSel.call(drag as any);
    nodeSelHandle = nodeSel;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e: any) => !e.shiftKey)
      .on("zoom", (e) => zoomLayer.attr("transform", e.transform.toString()));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svg.call(zoom as any);

    recenterFn = () => {
      svg
        .transition()
        .duration(reducedMotion ? 0 : 260)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call((zoom as any).transform, d3.zoomIdentity);
      for (const n of visibleNodes) {
        if (!n.isActive) { n.fx = null; n.fy = null; }
      }
      if (reducedMotion) {
        simulation.alpha(0.6);
        simulation.tick(300);
        simulation.stop();
      } else {
        simulation.alpha(0.6).restart();
      }
    };

    return () => {
      simulation.stop();
    };
  });

  // Highlight effect — recolor on legend hover or chord focus.
  $effect(() => {
    void highlightType; void chordFocus; void expanded;
    const linkSel = linkSelHandle;
    const nodeSel = nodeSelHandle;
    if (!linkSel || !nodeSel) return;
    const baseLinkWidth = expanded ? 1.5 : 1.2;
    const boostLinkWidth = expanded ? 2.5 : 2;
    if (highlightType === null && chordFocus === null) {
      linkSel
        .attr("stroke-opacity", 0.55)
        .attr("stroke-width", baseLinkWidth);
      nodeSel.attr("opacity", 1);
      return;
    }
    if (highlightType !== null) {
      const ht = highlightType;
      const touches = new Set<string>();
      linkSel.each(function (d) {
        if (d.type === ht) {
          const s = typeof d.source === "string" ? d.source : (d.source as Node).slug;
          const tg = typeof d.target === "string" ? d.target : (d.target as Node).slug;
          if (s) touches.add(s);
          if (tg) touches.add(tg);
        }
      });
      linkSel
        .attr("stroke-opacity", (d) => (d.type === ht ? 0.95 : 0.08))
        .attr("stroke-width", (d) =>
          d.type === ht ? boostLinkWidth : baseLinkWidth,
        );
      nodeSel.attr("opacity", (n) => (touches.has(n.slug) ? 1 : 0.2));
      return;
    }
    const focus = chordFocus!;
    const neighborSet = new Set<string>([focus]);
    linkSel.each(function (d) {
      const s = typeof d.source === "string" ? d.source : (d.source as Node).slug;
      const tg = typeof d.target === "string" ? d.target : (d.target as Node).slug;
      if (s === focus) neighborSet.add(tg);
      if (tg === focus) neighborSet.add(s);
    });
    linkSel
      .attr("stroke-opacity", (d) => {
        const s = typeof d.source === "string" ? d.source : (d.source as Node).slug;
        const tg = typeof d.target === "string" ? d.target : (d.target as Node).slug;
        return (s === focus || tg === focus) ? 0.95 : 0.06;
      })
      .attr("stroke-width", (d) => {
        const s = typeof d.source === "string" ? d.source : (d.source as Node).slug;
        const tg = typeof d.target === "string" ? d.target : (d.target as Node).slug;
        return (s === focus || tg === focus) ? boostLinkWidth : baseLinkWidth;
      });
    nodeSel.attr("opacity", (n) => (neighborSet.has(n.slug) ? 1 : 0.22));
  });

  // ──────────────── Coach marks ────────────────
  // svelte-ignore state_referenced_locally
  let coachDismissed = $state<boolean>(readCoachDismissed());
  function readCoachDismissed(): boolean {
    try {
      return localStorage.getItem(COACH_DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  }
  function dismissCoach() {
    try {
      localStorage.setItem(COACH_DISMISS_KEY, "true");
    } catch { /* quota */ }
    coachDismissed = true;
  }
  let totalLinksForCoach = $derived(graph?.links.length ?? 0);
  let coachVisible = $derived(!coachDismissed && totalLinksForCoach <= 3);

  // ──────────────── Connect popover ESC handler ────────────────
  $effect(() => {
    if (!connectPrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") connectPrompt = null;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ──────────────── LassoActionBar local state ────────────────
  let lassoBarMode = $state<"idle" | "tag" | "path">("idle");
  let lassoTagValue = $state("");
  $effect(() => {
    // Reset whenever the selection collapses to zero
    if (selectedSlugs.size === 0) {
      lassoBarMode = "idle";
      lassoTagValue = "";
    }
  });

  // ──────────────── Mouse/keyboard handlers for force-graph container ────────────────
  function onContainerMouseDown(e: MouseEvent) {
    if (!e.shiftKey) return;
    if ((e.target as Element).closest("g[data-slug]")) return;
    const cont = containerRef;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lassoLive = { x0: x, y0: y, x1: x, y1: y };
    lassoActive = true;
    selectedSlugs = new Set();
    requestAnimationFrame(writeLassoRect);
    e.preventDefault();
    e.stopPropagation();
  }
  function onContainerMouseMove(e: MouseEvent) {
    if (!lassoActive || !lassoLive) return;
    const cont = containerRef;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    lassoLive.x1 = e.clientX - rect.left;
    lassoLive.y1 = e.clientY - rect.top;
    writeLassoRect();
  }
  function onContainerMouseUp() {
    if (!lassoActive || !lassoLive) return;
    const cont = containerRef;
    const box = lassoLive;
    lassoActive = false;
    lassoLive = null;
    if (!cont) return;
    const containerRect = cont.getBoundingClientRect();
    const lx0 = Math.min(box.x0, box.x1);
    const lx1 = Math.max(box.x0, box.x1);
    const ly0 = Math.min(box.y0, box.y1);
    const ly1 = Math.max(box.y0, box.y1);
    if (lx1 - lx0 < 6 && ly1 - ly0 < 6) return;
    const captured = new Set<string>();
    const nodeEls = cont.querySelectorAll<SVGGElement>("g[data-slug]");
    nodeEls.forEach((el) => {
      const bbox = el.getBoundingClientRect();
      const cx = bbox.left + bbox.width / 2 - containerRect.left;
      const cy = bbox.top + bbox.height / 2 - containerRect.top;
      if (cx >= lx0 && cx <= lx1 && cy >= ly0 && cy <= ly1) {
        const slug = el.dataset.slug;
        if (slug) captured.add(slug);
      }
    });
    selectedSlugs = captured;
  }
  function onContainerMouseLeave() {
    if (lassoActive) {
      lassoActive = false;
      lassoLive = null;
    }
  }

  // ──────────────── Connect popover positioning ────────────────
  let connectPopoverPos = $derived.by(() => {
    if (!connectPrompt || !containerRef) return null;
    const rect = containerRef.getBoundingClientRect();
    const left = rect ? connectPrompt.x - rect.left : connectPrompt.x;
    const top = rect ? connectPrompt.y - rect.top : connectPrompt.y;
    const WIDTH = 280;
    const containerW = rect?.width ?? WIDTH;
    const x = Math.min(left, containerW - WIDTH - 8);
    const y = Math.max(8, top - 8);
    return { x: Math.max(8, x), y };
  });

  async function pickConnectType(type: LinkType) {
    const p = connectPrompt;
    connectPrompt = null;
    if (p && onAddLink) {
      try {
        await onAddLink(p.from, p.to, type);
      } catch (e) {
        console.error("drag-to-connect failed", e);
      }
    }
  }

  async function applyLassoTag(tag: string) {
    const slugs = Array.from(selectedSlugs);
    selectedSlugs = new Set();
    if (onBulkTag) {
      try {
        await onBulkTag(slugs, tag);
      } catch (e) {
        console.error("bulk tag failed", e);
      }
    }
  }
  async function lassoAddToPath(path: string) {
    const slugs = Array.from(selectedSlugs);
    selectedSlugs = new Set();
    if (onBulkAddToPath) {
      try {
        await onBulkAddToPath(slugs, path);
      } catch (e) {
        console.error("bulk add to path failed", e);
      }
    }
  }
</script>

<!-- ─────────────────────────── snippets ─────────────────────────── -->

{#snippet chip(slug: string, prefix: string, click: (slug: string) => void)}
  {@const title = titleBySlug.get(slug) ?? slug}
  {@const isMain = slug === mainNoteSlug}
  <button
    type="button"
    onclick={() => click(slug)}
    class={`text-left px-2.5 py-1 text-xs rounded-md border transition truncate max-w-[280px] ${
      isMain
        ? "border-yel bg-yelp/30 text-char hover:bg-yelp/50"
        : "border-bd bg-s1 text-t1 hover:border-bd2 hover:bg-s2"
    }`}
    title={title}
    data-prefix={prefix}
  >
    {title}
  </button>
{/snippet}

{#snippet denseGateBanner(count: number, view: HighNView, onSetView: (v: HighNView) => void, onForce: () => void)}
  <div class="px-3 py-2 border-b border-bd bg-yelp/30 text-2xs text-t2 leading-relaxed flex items-baseline gap-2 flex-wrap">
    <span aria-hidden="true" class="text-yeld">⚠</span>
    <span>
      {count.toLocaleString()} notes is past the smooth-rendering point for
      the force graph. Showing a reduced view so the rest of the UI stays
      responsive.
    </span>
    <div class="ml-auto flex items-center gap-2 shrink-0">
      <div class="flex items-center border border-bd rounded-sm overflow-hidden">
        <button
          type="button"
          onclick={() => onSetView("neighborhood")}
          class={`px-2 h-5 text-2xs font-mono ${view === "neighborhood" ? "bg-yelp text-yeld" : "text-t2 hover:text-char hover:bg-s2"}`}
          title="Static radial graph: active note centered, direct connections in a ring-3"
        >neighborhood</button>
        <button
          type="button"
          onclick={() => onSetView("list")}
          class={`px-2 h-5 text-2xs font-mono ${view === "list" ? "bg-yelp text-yeld" : "text-t2 hover:text-char hover:bg-s2"}`}
          title="Typed-connection chip list — fastest, scales to any vault size"
        >list</button>
      </div>
      <button
        type="button"
        onclick={onForce}
        class="underline decoration-dotted underline-offset-2 text-yeld hover:text-char"
        title="Render the full force-directed graph despite the perf hit"
      >full graph</button>
    </div>
  </div>
{/snippet}

{#snippet staticView(activeSlugIn: string | null, expandedIn: boolean, onSelectIn: (slug: string) => void, onExpandIn: (() => void) | null, h: number | null, withBanner: boolean)}
  {@const containerStyle = h != null ? `height: ${h}px` : ""}
  <div class="relative w-full overflow-hidden flex flex-col" style={containerStyle}>
    <div class="flex items-center gap-2 px-3 py-2 border-b border-bd bg-s1/50">
      <div class="text-2xs font-mono uppercase tracking-wider text-t3">
        {t("sidebar.graph.staticHeader")}
      </div>
      {#if activeSlugIn}
        <div class="text-2xs text-t3 font-mono ml-auto">
          {t(
            totalForActive === 1
              ? "sidebar.graph.staticCountOne"
              : "sidebar.graph.staticCountMany",
            { count: String(totalForActive) },
          )}
        </div>
      {/if}
      {#if !expandedIn && onExpandIn}
        <button
          onclick={onExpandIn}
          class="ml-2 text-2xs text-t2 hover:text-char px-1.5 py-0.5 rounded-sm border border-bd hover:border-bd2"
          title={t("sidebar.graph.expandTitle")}
        >
          {t("sidebar.graph.expandButton")}
        </button>
      {/if}
    </div>

    {#if withBanner && tooDense}
      {@render denseGateBanner(totalNodes, highNView, persistHighNView, () => persistForceAtHighN(true))}
    {/if}

    <div class="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4">
      {#if !activeSlugIn}
        <div class="text-xs text-t2 leading-relaxed">
          {t("sidebar.graph.staticPickANote")}
        </div>
      {:else if totalForActive === 0}
        <div class="text-xs text-t2 leading-relaxed">
          {t("sidebar.graph.staticNoConnections")}
        </div>
      {:else}
        {#each TYPES as kind (kind)}
          {@const b = grouped[kind]}
          {#if b.outgoing.length > 0 || b.incoming.length > 0}
            <section>
              <div class="flex items-center gap-2 mb-2">
                <span
                  class="inline-block w-2 h-2 rounded-full"
                  style:background={LINK_TYPE_COLORS[kind]}
                  aria-hidden="true"
                ></span>
                <span class="text-2xs font-mono uppercase tracking-wider text-t3">
                  {LINK_TYPE_LABELS[kind]}
                </span>
              </div>
              {#if b.outgoing.length > 0}
                <div class="mb-2">
                  <div class="text-2xs text-t3 mb-1">
                    {t("sidebar.graph.staticOutgoing")}
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    {#each b.outgoing as s (`out-${s}`)}
                      {@render chip(s, "out", onSelectIn)}
                    {/each}
                  </div>
                </div>
              {/if}
              {#if b.incoming.length > 0}
                <div>
                  <div class="text-2xs text-t3 mb-1">
                    {t("sidebar.graph.staticIncoming")}
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    {#each b.incoming as s (`in-${s}`)}
                      {@render chip(s, "in", onSelectIn)}
                    {/each}
                  </div>
                </div>
              {/if}
            </section>
          {/if}
        {/each}
      {/if}
    </div>
  </div>
{/snippet}

{#snippet neighborhoodView(expandedIn: boolean, onSelectIn: (slug: string) => void, onExpandIn: (() => void) | null, h: number | null)}
  {@const containerStyle = h != null ? `height: ${h}px` : ""}
  <div class="relative w-full overflow-hidden flex flex-col" style={containerStyle}>
    <div class="flex items-center gap-2 px-3 py-2 border-b border-bd bg-s1/50">
      <div class="text-2xs font-mono uppercase tracking-wider text-t3">
        neighborhood
      </div>
      {#if neighborhoodCenter}
        <div class="text-2xs text-t3 font-mono ml-auto">
          {neighbors.length === 1 ? "1 connection" : `${neighbors.length} connections`}
        </div>
      {/if}
      {#if !expandedIn && onExpandIn}
        <button
          onclick={onExpandIn}
          class="ml-2 text-2xs text-t2 hover:text-char px-1.5 py-0.5 rounded-sm border border-bd hover:border-bd2"
          title={t("sidebar.graph.expandTitle")}
        >
          {t("sidebar.graph.expandButton")}
        </button>
      {/if}
    </div>

    {#if tooDense}
      {@render denseGateBanner(totalNodes, highNView, persistHighNView, () => persistForceAtHighN(true))}
    {/if}

    {#if !neighborhoodCenter}
      <div class="flex-1 flex items-center justify-center px-6 text-xs text-t2 text-center leading-relaxed">
        {t("sidebar.graph.staticPickANote")}
      </div>
    {:else if neighbors.length === 0}
      <div class="flex-1 flex items-center justify-center px-6 text-xs text-t2 text-center leading-relaxed">
        {t("sidebar.graph.staticNoConnections")}
      </div>
    {:else}
      <div class="flex-1 min-h-0 overflow-hidden flex flex-col">
        <svg viewBox={`0 0 ${NW} ${NH}`} preserveAspectRatio="xMidYMid meet" class="w-full h-full">
          {#each neighborhoodVisible as n, i (`e-${n.slug}`)}
            {@const angle = (i / neighborhoodVisible.length) * Math.PI * 2 - Math.PI / 2}
            {@const nx = ncx + nR * Math.cos(angle)}
            {@const ny = ncy + nR * Math.sin(angle)}
            <line
              x1={ncx}
              y1={ncy}
              x2={nx}
              y2={ny}
              stroke={LINK_TYPE_COLORS[n.type]}
              stroke-width={1.5}
              opacity={0.55}
            />
          {/each}
          <g>
            <circle
              cx={ncx}
              cy={ncy}
              r={N_CENTER_R}
              fill="var(--yelp)"
              stroke="var(--yel)"
              stroke-width={2}
            />
            <text
              x={ncx}
              y={ncy}
              text-anchor="middle"
              dy="0.35em"
              font-size={11}
              fill="var(--char)"
              font-weight={600}
              style:pointer-events="none"
              style:user-select="none"
            >
              {trimLabel(titleBySlug.get(neighborhoodCenter) ?? neighborhoodCenter, 14)}
            </text>
          </g>
          {#each neighborhoodVisible as n, i (`n-${n.slug}`)}
            {@const angle = (i / neighborhoodVisible.length) * Math.PI * 2 - Math.PI / 2}
            {@const nx = ncx + nR * Math.cos(angle)}
            {@const ny = ncy + nR * Math.sin(angle)}
            {@const label = trimLabel(titleBySlug.get(n.slug) ?? n.slug, 16)}
            {@const isMain = n.slug === mainNoteSlug}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <g onclick={() => onSelectIn(n.slug)} style:cursor="pointer">
              <circle
                cx={nx}
                cy={ny}
                r={N_NODE_R}
                fill={isMain ? "var(--yelp)" : "var(--s1)"}
                stroke={LINK_TYPE_COLORS[n.type]}
                stroke-width={isMain ? 2 : 1.5}
              />
              <title>{titleBySlug.get(n.slug) ?? n.slug}</title>
              <text
                x={nx}
                y={ny + N_NODE_R + 12}
                text-anchor="middle"
                font-size={10}
                fill="var(--t2)"
                style:pointer-events="none"
                style:user-select="none"
              >
                {label}
              </text>
            </g>
          {/each}
        </svg>
        {#if neighborhoodHidden > 0}
          <div class="px-3 py-1.5 border-t border-bd bg-s1/40 text-2xs text-t3 text-center">
            + {neighborhoodHidden} more connection{neighborhoodHidden === 1 ? "" : "s"} — open one
            to keep exploring, or switch to the list view.
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

<!-- Helper icons rendered as snippets -->
{#snippet recenterIcon()}
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
    <circle cx="6" cy="6" r="1.5" />
    <path d="M6 1v2M6 9v2M1 6h2M9 6h2" stroke-linecap="round" />
  </svg>
{/snippet}

{#snippet expandIcon()}
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
    <path d="M1.5 4V1.5H4" /><path d="M8.5 4V1.5H6" /><path d="M1.5 6v2.5H4" /><path d="M8.5 6v2.5H6" />
  </svg>
{/snippet}

{#snippet spreadIcon()}
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="6" r="0.8" fill="currentColor" stroke="none" />
    <path d="M6 3.5V1M4.6 2.4L6 1l1.4 1.4" />
    <path d="M6 8.5V11M4.6 9.6L6 11l1.4-1.4" />
    <path d="M3.5 6H1M2.4 4.6L1 6l1.4 1.4" />
    <path d="M8.5 6H11M9.6 4.6L11 6l-1.4 1.4" />
  </svg>
{/snippet}

{#snippet connectModeIcon()}
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="3" cy="3" r="1.5" />
    <circle cx="9" cy="9" r="1.5" />
    <path d="M4 4l4 4" />
  </svg>
{/snippet}

{#snippet filterIcon()}
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
    <path d="M2 3h8M3.5 6h5M5 9h2" />
  </svg>
{/snippet}

{#snippet iconBtn(onClick: () => void, title: string, isActive: boolean | undefined, iconSnip: import("svelte").Snippet)}
  <button
    onclick={onClick}
    title={title}
    aria-label={title}
    class={`w-6 h-6 flex items-center justify-center rounded border transition ${
      isActive
        ? "bg-yelp border-yel text-yeld"
        : "bg-bg/85 border-bd text-t2 hover:text-char hover:bg-s2"
    }`}
  >
    {@render iconSnip()}
  </button>
{/snippet}

{#snippet legendSwatch(kind: "main" | "active" | "neighbor", label: string)}
  {@const styleStr =
    kind === "main"
      ? "background: var(--s2); border: 2px solid var(--home-ring);"
      : kind === "active"
      ? "background: var(--yel); border: 0;"
      : "background: var(--s2); border: 1px solid var(--bd2);"}
  <span class="flex items-center gap-1.5">
    <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={styleStr}></span>
    <span>{label}</span>
  </span>
{/snippet}

{#snippet linkLegend(color: string, label: string, dashed: boolean, type: LinkType, onHover: () => void, isActive: boolean)}
  {@const dashFor = (() => {
    let dash: string | undefined = dashed ? "3 3" : undefined;
    if (cbSafeFlag && type) {
      if (type === "challenges") dash = "8 3 2 3";
      else if (type === "came-from") dash = "1 4";
      else if (type === "open-question") dash = "4 4";
      else dash = undefined;
    }
    return dash;
  })()}
  <button
    type="button"
    onmouseenter={onHover}
    onfocus={onHover}
    class={`flex items-center gap-2 px-1 py-0.5 rounded text-left transition ${
      isActive ? "bg-yelp" : "hover:bg-s2"
    }`}
  >
    <svg width="22" height="4" viewBox="0 0 22 4">
      <line
        x1="0"
        y1="2"
        x2="22"
        y2="2"
        stroke={color}
        stroke-width={isActive ? "2.4" : "1.8"}
        stroke-linecap="round"
        stroke-dasharray={dashFor}
      />
    </svg>
    <span class={`italic font-serif text-[10px] ${isActive ? "text-char" : ""}`}>{label}</span>
  </button>
{/snippet}

{#snippet connectTypeBtn(label: string, color: string, onClick: () => void)}
  <button
    onclick={onClick}
    class="px-2 py-1.5 rounded-sm border border-bd bg-bg hover:bg-s2 text-t2 hover:text-char transition text-left flex items-center gap-1.5"
  >
    <span class="w-2 h-2 rounded-full shrink-0" style:background={`var(${color})`}></span>
    <span>{label}</span>
  </button>
{/snippet}

{#snippet coachMarks(expandedIn: boolean)}
  {#if coachVisible}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class={`absolute z-10 ${expandedIn ? "top-20 right-6 w-[320px]" : "bottom-3 right-3 w-[260px]"} bg-bg/95 border border-bd2 rounded-lg shadow-xl p-3 text-2xs animate-fadeIn`}
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="flex items-baseline justify-between mb-2">
        <div class="font-serif italic text-[11px] text-t3">
          {t("sidebar.graph.coachTitle")}
        </div>
        <button
          onclick={dismissCoach}
          class="text-t3 hover:text-char transition text-[10px]"
          title={t("sidebar.graph.coachDismissTitle")}
        >
          {t("sidebar.graph.coachDismiss")}
        </button>
      </div>
      <ul class="space-y-2">
        <li class="flex items-start gap-2 text-t2 leading-snug">
          <span class="mt-px text-yeld shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="3" cy="7" r="1.6" />
              <circle cx="11" cy="7" r="1.6" />
              <path d="M4.6 7h4.8M8.2 5.4L9.4 7 8.2 8.6" />
            </svg>
          </span>
          <span>{t("sidebar.graph.coachTip1")}</span>
        </li>
        <li class="flex items-start gap-2 text-t2 leading-snug">
          <span class="mt-px text-yeld shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="7" cy="7" r="2" />
              <path d="M7 2v1.5M7 10.5V12M2 7h1.5M10.5 7H12" />
            </svg>
          </span>
          <span>{t("sidebar.graph.coachTip2")}</span>
        </li>
        <li class="flex items-start gap-2 text-t2 leading-snug">
          <span class="mt-px text-yeld shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 7L6 3M2 7L6 11M2 7H12M12 7L8 3M12 7L8 11" />
            </svg>
          </span>
          <span>{t("sidebar.graph.coachTip3")}</span>
        </li>
      </ul>
    </div>
  {/if}
{/snippet}

{#snippet toolbar()}
  {@const stableLinks = graph?.links.length ?? 0}
  <div class="flex items-center gap-1 min-w-0">
    <span class="inline-flex items-center gap-1.5 text-2xs font-mono text-t2 min-w-0 truncate">
      <span class="w-1.5 h-1.5 rounded-full bg-yel shrink-0"></span>
      {#if activeSlug}
        <span class="truncate">
          <span class="text-char font-medium">{activeDegree}</span> {t("sidebar.graph.statDirect")}<span class="text-t3"> · </span>{Math.max(0, (graph?.notes.length ?? 0) - 1)} {t("sidebar.graph.statTotal")}
        </span>
      {:else}
        <span class="truncate">
          {t("sidebar.graph.statNotesLinks", {
            notes: String(graph?.notes.length ?? 0),
            links: String(stableLinks),
          })}
        </span>
      {/if}
    </span>
    <div class="ml-auto flex items-center gap-0.5 shrink-0">
      <div class="flex items-center border border-bd rounded-sm overflow-hidden mr-1">
        <button
          onclick={() => layoutMode = "force"}
          class={`px-2 h-6 text-2xs font-mono ${layoutMode === "force" ? "bg-yelp text-yeld" : "text-t2 hover:text-char hover:bg-s2"}`}
          title={t("sidebar.graph.layoutForceTip")}
        >{t("sidebar.graph.layoutForce")}</button>
        <button
          onclick={() => layoutMode = "chord"}
          class={`px-2 h-6 text-2xs font-mono ${layoutMode === "chord" ? "bg-yelp text-yeld" : "text-t2 hover:text-char hover:bg-s2"}`}
          title={t("sidebar.graph.layoutChordTip")}
        >{t("sidebar.graph.layoutChord")}</button>
      </div>
      {#if onAddLink}
        <button
          onclick={() => mode = mode === "connect" ? "view" : "connect"}
          title={mode === "connect" ? t("sidebar.graph.connectExitTip") : t("sidebar.graph.connectEnterTip")}
          class={`inline-flex items-center gap-1 px-2 h-6 rounded border transition ${
            mode === "connect"
              ? "bg-yeld text-bg border-yeld"
              : "bg-bg/85 border-bd text-t2 hover:text-char hover:bg-s2"
          }`}
        >
          {@render connectModeIcon()}
          <span class="text-2xs font-mono">
            {mode === "connect" ? t("sidebar.graph.connecting") : t("sidebar.graph.connect")}
          </span>
        </button>
      {/if}
      {@render iconBtn(
        () => nearbyOnly = !nearbyOnly,
        nearbyOnly ? t("sidebar.graph.nearbyAll") : t("sidebar.graph.nearbyOnly"),
        !nearbyOnly,
        filterIcon,
      )}
      {@render iconBtn(
        () => spread = !spread,
        spread ? t("sidebar.graph.spreadOff") : t("sidebar.graph.spreadOn"),
        spread,
        spreadIcon,
      )}
      {@render iconBtn(() => recenterFn(), t("sidebar.graph.recenter"), false, recenterIcon)}
      {#if !expanded && fillHeight !== true}
        {@render iconBtn(() => expanded = true, t("sidebar.graph.expand"), false, expandIcon)}
      {/if}
    </div>
  </div>
{/snippet}

{#snippet graphView(isExpanded: boolean, h: number | null)}
  {@const containerStyle = h != null ? `height: ${h}px` : ""}
  <div class="w-full h-full flex flex-col">
    {#if !isExpanded}
      <div class="px-2 pt-1.5 pb-1.5">{@render toolbar()}</div>
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={containerRef}
      class={`relative w-full flex-1 ${mode === "connect" ? "cursor-crosshair" : ""}`}
      style={containerStyle}
      onmousedown={onContainerMouseDown}
      onmousemove={onContainerMouseMove}
      onmouseup={onContainerMouseUp}
      onmouseleave={onContainerMouseLeave}
    >
      <svg bind:this={svgRef} class="w-full h-full"></svg>

      {#if connectDrag}
        <svg class="absolute inset-0 w-full h-full pointer-events-none" style:z-index="6">
          <defs>
            <marker id="connect-drag-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--yeld)" />
            </marker>
          </defs>
          <line
            x1={connectDrag.sx}
            y1={connectDrag.sy}
            x2={connectDrag.tx}
            y2={connectDrag.ty}
            stroke="var(--yeld)"
            stroke-width={2}
            stroke-dasharray="5 4"
            stroke-linecap="round"
            marker-end="url(#connect-drag-arrow)"
          />
          <circle cx={connectDrag.sx} cy={connectDrag.sy} r={4} fill="var(--yeld)" />
        </svg>
      {/if}

      {#if mode === "connect"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-yeld text-bg text-2xs font-serif italic shadow-lg flex items-center gap-2 animate-fadeIn"
          onmousedown={(e) => e.stopPropagation()}
        >
          {@render connectModeIcon()}
          <span>{t("sidebar.graph.connectBanner")}</span>
          <button
            onclick={() => mode = "view"}
            class="text-bg/80 hover:text-bg underline decoration-dotted"
          >
            {t("sidebar.graph.exit")}
          </button>
        </div>
      {/if}

      {@render coachMarks(isExpanded)}

      {#if isExpanded}
        <div class="absolute top-2 left-2 right-2 flex items-center gap-2 px-2 py-1.5 rounded-md bg-bg/85 border border-bd">
          {@render toolbar()}
        </div>
      {/if}

      {#if mainNoteSlug}
        <div class="absolute bottom-3 left-3 flex items-center gap-3 px-2.5 py-1.5 rounded-md bg-bg/90 border border-bd text-2xs font-mono text-t2">
          {@render legendSwatch("main", t("sidebar.graph.legendMain"))}
          {@render legendSwatch("active", t("sidebar.graph.legendActive"))}
          {@render legendSwatch("neighbor", t("sidebar.graph.legendNeighbor"))}
        </div>
      {/if}
      {#if isExpanded && (graph?.links.length ?? 0) > 0}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute top-14 left-3 flex flex-col gap-0.5 px-2.5 py-2 rounded-md bg-bg/90 border border-bd text-2xs font-mono text-t2"
          onmouseleave={() => highlightType = null}
        >
          <div class="font-serif italic text-[10px] text-t3 mb-1">
            {t("sidebar.graph.legendHint")}
          </div>
          {@render linkLegend("var(--yel)", t("sidebar.graph.legendSupports"), false, "supports", () => highlightType = "supports", highlightType === "supports")}
          {@render linkLegend("var(--danger)", t("sidebar.graph.legendChallenges"), false, "challenges", () => highlightType = "challenges", highlightType === "challenges")}
          {@render linkLegend("var(--yeld)", t("sidebar.graph.legendCameFrom"), false, "came-from", () => highlightType = "came-from", highlightType === "came-from")}
          {@render linkLegend("var(--ch2)", t("sidebar.graph.legendOpenQuestion"), true, "open-question", () => highlightType = "open-question", highlightType === "open-question")}
        </div>
      {/if}

      {#if isExpanded}
        <div class="absolute bottom-3 right-3 flex items-center justify-end">
          <div class="text-2xs text-t3 font-mono hidden md:block">
            {t("sidebar.graph.controlsHint")}
          </div>
        </div>
      {/if}

      {#if hover}
        <div
          class="absolute z-10 pointer-events-none px-2 py-1.5 rounded-md bg-char text-bg text-2xs shadow-lg max-w-[280px]"
          style:left="{hover.x + 10}px"
          style:top="{hover.y + 10}px"
        >
          <div class="font-medium">{hover.title}</div>
          {#if hover.sub}
            <div class="text-[10px] opacity-75 mt-0.5">{hover.sub}</div>
          {/if}
        </div>
      {/if}

      {#if connectPrompt && connectPopoverPos}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute z-30 w-[280px] bg-bg border border-bd2 rounded-lg shadow-xl p-3 text-xs animate-fadeIn"
          style:left="{connectPopoverPos.x}px"
          style:top="{connectPopoverPos.y}px"
          onmousedown={(e) => e.stopPropagation()}
        >
          <div class="font-serif italic text-[11px] text-t3 mb-2 leading-snug">
            {t("sidebar.graph.connectAsPrefix")}<span class="text-char not-italic">{connectPrompt.fromTitle}</span>{t("sidebar.graph.connectAsTo")}<span class="text-char not-italic">{connectPrompt.toTitle}</span>{t("sidebar.graph.connectAsSuffix")}
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            {@render connectTypeBtn(t("sidebar.graph.legendSupports"), "--yel", () => pickConnectType("supports"))}
            {@render connectTypeBtn(t("sidebar.graph.legendChallenges"), "--danger", () => pickConnectType("challenges"))}
            {@render connectTypeBtn(t("sidebar.graph.legendCameFrom"), "--yeld", () => pickConnectType("came-from"))}
            {@render connectTypeBtn(t("sidebar.graph.legendOpenQuestion"), "--ch2", () => pickConnectType("open-question"))}
          </div>
          <button
            onclick={() => connectPrompt = null}
            class="mt-2 text-2xs text-t3 hover:text-char transition block"
          >
            {t("sidebar.graph.connectCancel")}
          </button>
        </div>
      {/if}

      {#if lassoActive}
        <svg class="absolute inset-0 w-full h-full pointer-events-none" style:z-index="5">
          <rect
            bind:this={lassoRectRef}
            x={0}
            y={0}
            width={0}
            height={0}
            fill="var(--yelp)"
            fill-opacity={0.35}
            stroke="var(--yeld)"
            stroke-dasharray="4 4"
          />
        </svg>
      {/if}

      {#if selectedSlugs.size > 0}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-bg border border-bd2 rounded-lg shadow-xl px-3 py-2 flex items-center gap-2 text-xs animate-fadeIn"
          onmousedown={(e) => e.stopPropagation()}
        >
          <span class="font-serif italic text-2xs text-t3">
            {t("sidebar.graph.lassoSelected", { count: String(selectedSlugs.size) })}
          </span>
          <span class="text-t3">·</span>
          {#if lassoBarMode === "idle"}
            <button
              onclick={() => lassoBarMode = "tag"}
              class="px-2 py-1 rounded-sm text-t2 hover:bg-s2 hover:text-char transition"
            >
              {t("sidebar.graph.lassoTag")}
            </button>
            <button
              onclick={() => lassoBarMode = "path"}
              class="px-2 py-1 rounded-sm text-t2 hover:bg-s2 hover:text-char transition"
              disabled={(pathNames?.length ?? 0) === 0}
              title={(pathNames?.length ?? 0) === 0 ? t("sidebar.graph.lassoPathDisabled") : undefined}
            >
              {t("sidebar.graph.lassoPath")}
            </button>
          {:else if lassoBarMode === "tag"}
            <form
              onsubmit={(e) => {
                e.preventDefault();
                const tag = lassoTagValue.trim().replace(/^#/, "");
                if (tag) applyLassoTag(tag);
              }}
              class="flex items-center gap-1"
            >
              <!-- svelte-ignore a11y_autofocus -->
              <input
                autofocus
                bind:value={lassoTagValue}
                placeholder={t("sidebar.graph.lassoTagPlaceholder")}
                class="px-2 py-1 bg-s1 border border-bd rounded-sm text-char text-2xs focus:outline-hidden focus:border-yeld w-[140px]"
              />
              <button
                type="submit"
                class="px-2 py-1 bg-char text-bg rounded-sm text-2xs hover:bg-yeld transition"
              >
                {t("sidebar.graph.lassoApply")}
              </button>
            </form>
          {:else if lassoBarMode === "path"}
            <!-- svelte-ignore a11y_autofocus -->
            <select
              autofocus
              onchange={(e) => {
                const p = (e.currentTarget as HTMLSelectElement).value;
                if (p) lassoAddToPath(p);
              }}
              class="px-2 py-1 bg-s1 border border-bd rounded-sm text-char text-2xs focus:outline-hidden focus:border-yeld"
              value=""
            >
              <option value="" disabled>
                {t("sidebar.graph.lassoPickPath")}
              </option>
              {#each (pathNames ?? []) as n (n)}
                <option value={n}>{n}</option>
              {/each}
            </select>
          {/if}
          <button
            onclick={() => selectedSlugs = new Set()}
            class="ml-1 text-2xs text-t3 hover:text-char transition"
          >
            {t("sidebar.graph.lassoClear")}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<!-- ─────────────────────────── render ─────────────────────────── -->

{#if isEmpty}
  <div class="h-[300px] flex items-center justify-center px-4">
    <div class="text-center max-w-[240px]">
      <div class="mx-auto mb-3 w-10 h-10 rounded-full border border-dashed border-bd2 flex items-center justify-center text-t3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" />
          <line x1="8" y1="11" x2="16" y2="7" /><line x1="8" y1="13" x2="16" y2="17" />
        </svg>
      </div>
      <div class="text-xs text-t2 leading-relaxed">
        {t("sidebar.graph.emptyHeadline")}
      </div>
      <div class="text-2xs text-t3 mt-1 leading-relaxed">
        {t("sidebar.graph.emptyHint")}
      </div>
    </div>
  </div>
{:else if reducedMotion && graph}
  {@render staticView(
    activeSlug,
    !!fillHeight,
    onSelect,
    fillHeight ? null : () => expanded = true,
    fillHeight ? null : INLINE_HEIGHT,
    false,
  )}
  {#if expanded}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 bg-char/30 flex items-center justify-center animate-fadeIn"
      onmousedown={() => expanded = false}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="w-[min(1000px,94vw)] h-[min(820px,92vh)] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-slideUp"
        onmousedown={(e) => e.stopPropagation()}
      >
        <div class="px-5 py-3 border-b border-bd bg-s1 flex items-center gap-3">
          <div class="font-serif text-lg text-char">{t("sidebar.graph.expandedTitle")}</div>
          <div class="text-2xs text-t3 font-mono">
            {t(
              graph.links.length === 1
                ? "sidebar.graph.expandedMetaOne"
                : "sidebar.graph.expandedMetaMany",
              { notes: String(totalNodes), links: String(graph.links.length) },
            )}
          </div>
          <button
            onclick={() => expanded = false}
            class="ml-auto w-8 h-8 flex items-center justify-center rounded-sm hover:bg-s2 text-t2 hover:text-char"
            aria-label={t("sidebar.graph.closeAria")}
          >×</button>
        </div>
        <div class="flex-1 min-h-0 relative">
          {@render staticView(
            activeSlug,
            true,
            (slug: string) => { expanded = false; onSelect(slug); },
            null,
            null,
            false,
          )}
        </div>
      </div>
    </div>
  {/if}
{:else if tooDense && graph}
  {#if highNView === "neighborhood"}
    {@render neighborhoodView(
      !!fillHeight,
      onSelect,
      fillHeight ? null : () => expanded = true,
      fillHeight ? null : INLINE_HEIGHT,
    )}
  {:else}
    {@render staticView(
      activeSlug,
      !!fillHeight,
      onSelect,
      fillHeight ? null : () => expanded = true,
      fillHeight ? null : INLINE_HEIGHT,
      true,
    )}
  {/if}
  {#if expanded}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 bg-char/30 flex items-center justify-center animate-fadeIn"
      onmousedown={() => expanded = false}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="w-[min(1000px,94vw)] h-[min(820px,92vh)] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-slideUp"
        onmousedown={(e) => e.stopPropagation()}
      >
        <div class="px-5 py-3 border-b border-bd bg-s1 flex items-center gap-3">
          <div class="font-serif text-lg text-char">{t("sidebar.graph.expandedTitle")}</div>
          <div class="text-2xs text-t3 font-mono">
            {t(
              graph.links.length === 1
                ? "sidebar.graph.expandedMetaOne"
                : "sidebar.graph.expandedMetaMany",
              { notes: String(totalNodes), links: String(graph.links.length) },
            )}
          </div>
          <button
            onclick={() => expanded = false}
            class="ml-auto w-8 h-8 flex items-center justify-center rounded-sm hover:bg-s2 text-t2 hover:text-char"
            aria-label={t("sidebar.graph.closeAria")}
          >×</button>
        </div>
        <div class="flex-1 min-h-0 relative">
          {#if highNView === "neighborhood"}
            {@render neighborhoodView(
              true,
              (slug: string) => { expanded = false; onSelect(slug); },
              null,
              null,
            )}
          {:else}
            {@render staticView(
              activeSlug,
              true,
              (slug: string) => { expanded = false; onSelect(slug); },
              null,
              null,
              true,
            )}
          {/if}
        </div>
      </div>
    </div>
  {/if}
{:else if graph}
  {#if !expanded}
    {#if useSigma}
      <SigmaForceGraph
        {graph}
        {activeSlug}
        {mainNoteSlug}
        {onSelect}
        fillHeight={!!fillHeight}
      />
    {:else}
      {#key "inline"}
        {@render graphView(!!fillHeight, fillHeight ? null : INLINE_HEIGHT)}
      {/key}
    {/if}
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 bg-bg flex items-center justify-center animate-fadeIn"
      onmousedown={() => expanded = false}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="w-screen h-screen bg-bg overflow-hidden flex flex-col animate-fadeIn"
        onmousedown={(e) => e.stopPropagation()}
      >
        <div class="px-5 py-3 border-b border-bd bg-s1 flex items-center gap-3">
          <div class="font-serif text-lg text-char">{t("sidebar.graph.expandedTitle")}</div>
          <div class="text-2xs text-t3 font-mono">
            {t(
              graph.links.length === 1
                ? "sidebar.graph.expandedMetaOne"
                : "sidebar.graph.expandedMetaMany",
              { notes: String(totalNodes), links: String(graph.links.length) },
            )}
          </div>
          <button
            onclick={() => expanded = false}
            class="ml-auto w-8 h-8 flex items-center justify-center rounded-sm hover:bg-s2 text-t2 hover:text-char"
            aria-label={t("sidebar.graph.closeAria")}
          >×</button>
        </div>
        <div class="flex-1 min-h-0 relative">
          {#if useSigma}
            <SigmaForceGraph
              {graph}
              {activeSlug}
              {mainNoteSlug}
              {onSelect}
              fillHeight
            />
          {:else}
            {#key "expanded"}
              {@render graphView(true, null)}
            {/key}
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}
