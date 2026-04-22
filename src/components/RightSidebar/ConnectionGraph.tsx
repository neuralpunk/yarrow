import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Graph, LinkType } from "../../lib/types";

function themeColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

interface Props {
  graph: Graph | null;
  activeSlug: string | null;
  /** The workspace's starting note. Rendered in a distinct color so "home"
   *  is legible at a glance in every Map view. */
  mainNoteSlug?: string | null;
  onSelect: (slug: string) => void;
  /** Fill the parent container instead of using the inline fixed height. */
  fillHeight?: boolean;
  /** See ViewProps; threaded through as-is. */
  onAddLink?: (from: string, to: string, type: LinkType) => Promise<void> | void;
  onBulkTag?: (slugs: string[], tag: string) => Promise<void> | void;
  onBulkAddToPath?: (slugs: string[], pathName: string) => Promise<void> | void;
  pathNames?: string[];
}

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

const INLINE_HEIGHT = 300;
const NODE_MARGIN = 18;

export default function ConnectionGraph({
  graph,
  activeSlug,
  mainNoteSlug,
  onSelect,
  fillHeight,
  onAddLink,
  onBulkTag,
  onBulkAddToPath,
  pathNames,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  // Close on Escape while expanded
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const totalNodes = graph?.notes.length ?? 0;

  // Only the truly-empty case (no notes at all) keeps the placeholder.
  // Any vault with notes — even a workspace with zero connections yet —
  // renders the graph so the user can start linking interactively via
  // connect mode. The forceLink with an empty links array is a valid
  // D3 setup: nodes float under charge + collision and the user can
  // drag between them to create the first edge.
  if (!graph || totalNodes === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center px-4">
        <div className="text-center max-w-[240px]">
          <div className="mx-auto mb-3 w-10 h-10 rounded-full border border-dashed border-bd2 flex items-center justify-center text-t3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" />
              <line x1="8" y1="11" x2="16" y2="7" /><line x1="8" y1="13" x2="16" y2="17" />
            </svg>
          </div>
          <div className="text-xs text-t2 leading-relaxed">
            Create a few notes, then come back here.
          </div>
          <div className="text-2xs text-t3 mt-1 leading-relaxed">
            The Map shows every note in your vault — even the disconnected ones — so you can drag them into relationships.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <GraphView
        key="inline"
        graph={graph}
        activeSlug={activeSlug}
        mainNoteSlug={mainNoteSlug ?? null}
        onSelect={onSelect}
        height={fillHeight ? null : INLINE_HEIGHT}
        expanded={!!fillHeight}
        onExpand={fillHeight ? undefined : () => setExpanded(true)}
        onAddLink={onAddLink}
        onBulkTag={onBulkTag}
        onBulkAddToPath={onBulkAddToPath}
        pathNames={pathNames}
      />
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-char/30 backdrop-blur-[3px] flex items-center justify-center animate-fadeIn"
          onMouseDown={() => setExpanded(false)}
        >
          <div
            className="w-[min(1200px,94vw)] h-[min(820px,92vh)] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-slideUp"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-bd bg-s1 flex items-center gap-3">
              <div className="font-serif text-lg text-char">Connections graph</div>
              <div className="text-2xs text-t3 font-mono">
                {totalNodes} notes · {graph.links.length} connection{graph.links.length === 1 ? "" : "s"} · click a node to open it · esc to close
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded hover:bg-s2 text-t2 hover:text-char"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-h-0 relative">
              <GraphView
                key="expanded"
                graph={graph}
                activeSlug={activeSlug}
                mainNoteSlug={mainNoteSlug ?? null}
                onSelect={(slug) => { setExpanded(false); onSelect(slug); }}
                height={null}
                expanded={true}
                onAddLink={onAddLink}
                onBulkTag={onBulkTag}
                onBulkAddToPath={onBulkAddToPath}
                pathNames={pathNames}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ViewProps {
  graph: Graph;
  activeSlug: string | null;
  mainNoteSlug: string | null;
  onSelect: (slug: string) => void;
  height: number | null; // null → fill container
  expanded: boolean;
  onExpand?: () => void;
  /** Drag-to-connect: called when the user drops one node on another.
   *  Opens a small in-graph popover that lets them pick the link type;
   *  the graph itself calls this with the chosen type. */
  onAddLink?: (from: string, to: string, type: LinkType) => Promise<void> | void;
  /** Bulk tag assignment from the lasso's action bar. */
  onBulkTag?: (slugs: string[], tag: string) => Promise<void> | void;
  /** Bulk "add to existing path" from the lasso's action bar. */
  onBulkAddToPath?: (slugs: string[], pathName: string) => Promise<void> | void;
  /** All path names, for the lasso bar's path picker. Optional so we
   *  fall back to "no paths yet" when the vault has only the root. */
  pathNames?: string[];
}

function GraphView({
  graph,
  activeSlug,
  mainNoteSlug,
  onSelect,
  height,
  expanded,
  onExpand,
  onAddLink,
  onBulkTag,
  onBulkAddToPath,
  pathNames,
}: ViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recenterRef = useRef<() => void>(() => {});
  const [nearbyOnly, setNearbyOnly] = useState(!expanded);
  const [hover, setHover] = useState<Hover | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  /** Graph interaction mode. In `view` mode dragging a node repositions
   *  it (the original behavior). In `connect` mode dragging draws a
   *  rubber-band from the node toward the cursor, and releasing on
   *  another node opens the typed-link popover. The mode toggle in the
   *  toolbar flips this; the whole simulation's drag handler reads from
   *  `modeRef` so changing modes takes effect without rebinding D3. */
  const [mode, setMode] = useState<"view" | "connect">("view");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  /** Layout mode: "force" is the default force-directed radial web;
   *  "chord" pins every node on a single outer ring and routes links as
   *  beziers through the centre. Persisted per-browser so writers who
   *  prefer one view don't have to re-pick it every session. */
  const [layoutMode, setLayoutMode] = useState<"force" | "chord">(() => {
    try {
      const v = localStorage.getItem("yarrow.mapLayoutMode");
      return v === "chord" ? "chord" : "force";
    } catch { return "force"; }
  });
  const layoutModeRef = useRef(layoutMode);
  layoutModeRef.current = layoutMode;
  useEffect(() => {
    try { localStorage.setItem("yarrow.mapLayoutMode", layoutMode); } catch {}
  }, [layoutMode]);
  /** In chord layout, clicking a node is a *highlight* gesture rather than
   *  a navigation — the whole point of the chord view is to scan
   *  relationships at a glance, so yanking the user into the clicked
   *  note's editor defeats the purpose. Toggles: click a node to focus,
   *  click it again or click empty canvas to clear. In force mode this
   *  stays null and the original click-opens-note behaviour returns. */
  const [chordFocus, setChordFocus] = useState<string | null>(null);
  const chordFocusRef = useRef<string | null>(null);
  chordFocusRef.current = chordFocus;
  // Clear the chord highlight when leaving chord layout — the feature
  // is specific to that view.
  useEffect(() => {
    if (layoutMode !== "chord") setChordFocus(null);
  }, [layoutMode]);
  /** Legend hover — when set, edges of that type stay lit and other
   *  edges fade. Turns the Map into a question-answerer: hovering
   *  "challenges" reveals exactly your doubts. */
  const [highlightType, setHighlightType] = useState<LinkType | null>(null);
  const highlightTypeRef = useRef<LinkType | null>(null);
  highlightTypeRef.current = highlightType;

  /** Rubber-band state while dragging in connect mode. Coordinates are
   *  container-relative (in px from the container's top-left) so the
   *  overlay SVG can render the line without needing to replicate the
   *  zoom transform. Source is captured once at drag start from the
   *  node's bounding rect — we pin the node during the drag so the
   *  line origin stays put. */
  const [connectDrag, setConnectDrag] = useState<
    | { fromSlug: string; sx: number; sy: number; tx: number; ty: number }
    | null
  >(null);
  /** Drag-to-connect popover state. Set when the user drops one node on
   *  another — screen coords locate the popover, `from`/`to` drive the
   *  eventual link creation. */
  const [connectPrompt, setConnectPrompt] = useState<
    | { from: string; to: string; fromTitle: string; toTitle: string; x: number; y: number }
    | null
  >(null);
  // Refs onto the D3 selections so the highlight-by-legend useEffect
  // below can re-apply `stroke-opacity` / `stroke-width` without
  // rebinding the simulation.
  const linkSelRef = useRef<d3.Selection<SVGPathElement, Link, SVGGElement, unknown> | null>(null);
  const nodeSelRef = useRef<d3.Selection<SVGGElement, Node, SVGGElement, unknown> | null>(null);
  /** Lasso / multi-select state. `box` is the active rubber-band while
   *  the user drags, `slugs` is the finalized selection. */
  const [lasso, setLasso] = useState<
    | { x0: number; y0: number; x1: number; y1: number }
    | null
  >(null);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  // Ref mirror of the latest `onAddLink` callback so the D3 drag handler
  // always sees the current version without rebinding the simulation.
  const onAddLinkRef = useRef(onAddLink);
  onAddLinkRef.current = onAddLink;
  const onBulkTagRef = useRef(onBulkTag);
  onBulkTagRef.current = onBulkTag;
  const onBulkAddToPathRef = useRef(onBulkAddToPath);
  onBulkAddToPathRef.current = onBulkAddToPath;

  const { adj, distances } = useMemo(() => {
    const adj: Record<string, Set<string>> = {};
    const distances: Record<string, number> = {};
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
  }, [graph, activeSlug]);

  // Track container size so the expanded view fills the modal and resizes.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const h = height ?? rect.height;
      setSize({ w: rect.width, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (size.w === 0 || size.h === 0) return;

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
    for (const e of graph.links) {
      degree[e.from] = (degree[e.from] ?? 0) + 1;
      degree[e.to] = (degree[e.to] ?? 0) + 1;
    }

    const allNodes: Node[] = graph.notes.map((n) => ({
      slug: n.slug,
      title: n.title,
      isActive: n.slug === activeSlug,
      isMain: !!mainNoteSlug && n.slug === mainNoteSlug,
      distance: distances[n.slug] ?? Infinity,
      degree: degree[n.slug] ?? 0,
    }));

    // The nearby-only filter only makes sense once the graph has some
    // links — in a vault with zero connections, "show me notes within 2
    // hops of the active one" would hide every note except the active
    // one. Fall through to showing every note so the user can drag
    // between them to create the first edges.
    const hasAnyLinks = graph.links.length > 0;
    const visibleNodes = nearbyOnly && activeSlug && hasAnyLinks
      ? allNodes.filter((n) => n.distance <= 2)
      : allNodes;
    const visibleSlugs = new Set(visibleNodes.map((n) => n.slug));
    const visibleLinks: Link[] = graph.links
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

    // Chord layout: every non-active node sits on a single outer ring. We
    // pin with fx/fy so the force simulation can't drift them — forces still
    // run (cheap, and keeps the tick handler wired for rendering), they just
    // can't move anything. Nodes are sorted for a stable angular order
    // (distance asc, then degree desc) so related nodes cluster together
    // instead of scattering alphabetically around the ring.
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

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${heightPx}`);
    svg.selectAll("*").remove();
    // Click on empty canvas clears a chord-mode focus. Node clicks call
    // `e.stopPropagation()` so this only fires when the click really was
    // on the background.
    svg.on("click", () => {
      if (layoutModeRef.current === "chord") setChordFocus(null);
    });

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    const g = zoomLayer.append("g");

    // Editorial style: one quiet edge color, no arrows, no direction. The
    // Color each edge by its link type so the graph reads as grammar,
    // not just topology — the same palette the ConnectPopover uses
    // when the user picks a type during drag-to-connect. Falls back to
    // the plum accent if a future type shows up we don't know about.
    const linkColor = (t: LinkType): string => {
      switch (t) {
        case "supports":
          return themeColor("--yel", "#c97a3a");
        case "challenges":
          return themeColor("--danger", "#c43d5b");
        case "came-from":
          return themeColor("--yeld", "#a85cc9");
        case "open-question":
          return themeColor("--ch2", "#5c6dc9");
        default:
          return themeColor("--yel", "#7A4E6E");
      }
    };
    const linkSel = g
      .append("g")
      .attr("fill", "none")
      .selectAll<SVGPathElement, Link>("path")
      .data(visibleLinks)
      .join("path")
      .attr("stroke", (d) => linkColor(d.type))
      .attr("stroke-opacity", 0.55)
      .attr("stroke-width", expanded ? 1.5 : 1.2)
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", (d) => (d.type === "open-question" ? "4 4" : null))
      .attr("pointer-events", "none");
    linkSelRef.current = linkSel;

    const nodeSel = g
      .append("g")
      .selectAll<SVGGElement, Node>("g")
      .data(visibleNodes)
      .join("g")
      .attr("cursor", "pointer")
      // Tag each node with its slug so the lasso rubber-band can
      // hit-test via `querySelectorAll("g[data-slug]")`.
      .attr("data-slug", (d) => d.slug)
      .on("click", (e, d) => {
        // In connect mode the gesture is drag-only: a stray click
        // (especially a quick mousedown→mouseup with no movement) used
        // to open the clicked note, which yanked the user out of the
        // graph mid-task. Suppress navigation while connecting; the
        // user can flip back to view mode to open notes.
        if (modeRef.current === "connect") return;
        // In chord layout, a click is a *highlight* gesture, not a
        // navigation — click the same node again (or empty canvas) to
        // clear. We stop propagation so the canvas-level click handler
        // doesn't race our toggle and instantly clear the focus.
        if (layoutModeRef.current === "chord") {
          e.stopPropagation();
          setChordFocus((cur) => (cur === d.slug ? null : d.slug));
          return;
        }
        onSelect(d.slug);
      })
      .on("mouseenter", function (event, d) {
        const rect = containerRef.current!.getBoundingClientRect();
        const connCount = adj[d.slug]?.size ?? 0;
        const mainTag = d.isMain ? "★ main · " : "";
        const hint =
          modeRef.current === "connect" ? "drag to connect"
          : layoutModeRef.current === "chord" ? "click to highlight connections"
          : "click to open";
        setHover({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          title: d.title,
          sub: `${mainTag}${connCount} connection${connCount === 1 ? "" : "s"} · ${hint}`,
        });
      })
      .on("mousemove", function (event) {
        const rect = containerRef.current!.getBoundingClientRect();
        setHover((h) => (h ? { ...h, x: event.clientX - rect.left, y: event.clientY - rect.top } : h));
      })
      .on("mouseleave", () => setHover(null));

    const activeFill = themeColor("--yel", "#7A4E6E");
    const activeText = themeColor("--on-yel", "#FFFFFF");
    const neighborFill = themeColor("--s2", "#E8E4DA");
    const neighborStroke = themeColor("--bd2", "rgba(30,28,22,0.18)");
    const textColor = themeColor("--char", "#22201C");
    const mutedText = themeColor("--t2", "#5A5550");
    // Warm gold specifically for the workspace's main note. Distinct from
    // the plum `--yel` used for the active node so "main" reads even when
    // you're viewing a different note — and reads doubly when main *is*
    // the active note (plum fill + gold ring).
    const mainColor = "#D4A04A";

    // Bigger, flatter, editorial circles. The active note is plum-filled; all
    // neighbors share the same muted paper chip treatment regardless of
    // distance. The workspace's main note wears a gold ring on top so it's
    // always locatable.
    const radiusFor = (d: Node) => {
      if (d.isActive) return expanded ? 52 : 38;
      if (d.isMain) return expanded ? 42 : 32;
      if (d.distance === 1) return expanded ? 38 : 28;
      return expanded ? 32 : 24;
    };

    nodeSel
      .append("circle")
      .attr("r", radiusFor)
      .attr("fill", (d) => (d.isActive ? activeFill : neighborFill))
      .attr("stroke", (d) => {
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

    // Gold ★ anchor mark on the main note, centered above its label so
    // the "this is home" cue reads even when the title fills the chip.
    nodeSel
      .filter((d) => d.isMain)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", (d) => -radiusFor(d) - 6)
      .attr("font-size", 12)
      .attr("fill", mainColor)
      .text("★");

    // Labels live INSIDE the circles — italic serif, wrapped to two lines
    // when the title is long so the chip stays compact.
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
        .attr("fill", d.isActive ? activeText : textColor)
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
      // Outside-circle caption for far-ring nodes (distance > 2) that skip
      // the inside label in favor of something readable against the canvas.
      if (!d.isActive && d.distance > 2) {
        sel
          .append("text")
          .attr("y", r + 14)
          .attr("text-anchor", "middle")
          .attr("font-family", "'Source Serif 4', ui-serif, Georgia, serif")
          .attr("font-style", "italic")
          .attr("font-size", expanded ? 10.5 : 9.5)
          .attr("fill", mutedText)
          .attr("opacity", 0.7)
          .attr("pointer-events", "none")
          .text(truncate(d.title, expanded ? 22 : 16));
      }
    });

    const simulation = d3
      .forceSimulation<Node>(visibleNodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(visibleLinks)
          .id((d) => d.slug)
          .distance((l) => {
            const s = l.source as Node;
            const t = l.target as Node;
            if (s.isActive || t.isActive) return ringR1;
            return expanded ? 110 : 72;
          })
          .strength(0.35),
      )
      .force("charge", d3.forceManyBody<Node>().strength((d) => (d.isActive ? -600 : expanded ? -360 : -240)))
      // Radial ring positioning is a by-neighborhood concept — it only
      // makes sense when there are links to compute distances from.
      // Without links every node has `distance: Infinity` so we swap in
      // a simple `forceCenter` instead; nodes spread evenly via charge
      // + collision and the user can drag them into relationships.
      .force(
        "radial",
        hasAnyLinks
          ? d3.forceRadial<Node>((d) => {
              if (d.isActive) return 0;
              if (d.distance === 1) return ringR1;
              if (d.distance === 2) return ringR2;
              return ringR2 + 40;
            }, cx, cy).strength(0.55)
          : (d3.forceCenter(cx, cy).strength(0.03) as any),
      )
      // Collision radius matches the actual drawn circle + breathing room —
      // no more overlapping chips.
      .force("collide", d3.forceCollide<Node>((d) => {
        if (d.isActive) return (expanded ? 52 : 38) + 10;
        if (d.distance === 1) return (expanded ? 38 : 28) + 8;
        return (expanded ? 32 : 24) + 6;
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
        if (layoutModeRef.current === "chord") {
          // Chord: curve each link toward the canvas centre. We bend the
          // midpoint 35% of the way to (cx,cy) — enough to read as a chord
          // instead of a straight line, gentle enough to not over-curl.
          const mx = (x0 + x1) / 2 + (cx - (x0 + x1) / 2) * 0.7;
          const my = (y0 + y1) / 2 + (cy - (y0 + y1) / 2) * 0.7;
          return `M${x0},${y0} Q${mx},${my} ${x1},${y1}`;
        }
        // Force mode: straight lines, trimmed at the circle edges so the
        // stroke butts cleanly against each chip instead of piercing through.
        return `M${x0},${y0} L${x1},${y1}`;
      });
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    const drag = d3
      .drag<SVGGElement, Node>()
      .on("start", function (event, d) {
        if (modeRef.current === "connect") {
          if (!onAddLinkRef.current) return;
          // Pin the node for the duration of the drag so the line
          // origin doesn't drift as the simulation keeps running.
          d.fx = d.x;
          d.fy = d.y;
          // Capture the source center in container-relative coords by
          // walking the DOM — avoids re-implementing the zoom transform.
          const container = containerRef.current;
          const nodeEl = this as SVGGElement;
          if (!container) return;
          const cRect = container.getBoundingClientRect();
          const nRect = nodeEl.getBoundingClientRect();
          const sx = nRect.left + nRect.width / 2 - cRect.left;
          const sy = nRect.top + nRect.height / 2 - cRect.top;
          const src = event.sourceEvent as MouseEvent | undefined;
          const tx = src ? src.clientX - cRect.left : sx;
          const ty = src ? src.clientY - cRect.top : sy;
          setConnectDrag({ fromSlug: d.slug, sx, sy, tx, ty });
          return;
        }
        // Chord layout pins every non-active node on the ring via fx/fy.
        // The reposition behaviour below would clobber those pins, so a
        // mere click (D3 fires drag-start even for no-movement clicks)
        // would unpin the node on "end" and let the simulation drift it
        // off the ring. Skip the drag machinery entirely in chord mode —
        // the click handler on the node handles highlight toggling, and
        // dragging has no meaning when positions are fixed.
        if (layoutModeRef.current === "chord") return;
        // View mode: existing reposition behavior.
        if (d.isActive) return;
        if (!event.active) simulation.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        if (modeRef.current === "connect") {
          const container = containerRef.current;
          if (!container) return;
          const cRect = container.getBoundingClientRect();
          const src = event.sourceEvent as MouseEvent | undefined;
          if (!src) return;
          const tx = src.clientX - cRect.left;
          const ty = src.clientY - cRect.top;
          setConnectDrag((prev) => (prev ? { ...prev, tx, ty } : prev));
          return;
        }
        // Chord layout is strictly pinned — no drag-to-reposition.
        if (layoutModeRef.current === "chord") return;
        if (d.isActive) return;
        d.fx = clampX(event.x);
        d.fy = clampY(event.y);
      })
      .on("end", (event, d) => {
        if (modeRef.current === "connect") {
          setConnectDrag(null);
          // Release the source pin so the simulation can settle again.
          d.fx = null;
          d.fy = null;
          if (!onAddLinkRef.current) return;
          const src = event.sourceEvent as MouseEvent | undefined;
          if (!src) return;
          // Hit-test every visible node in simulation coords — snap to
          // the nearest within a generous threshold.
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
          const alreadyLinked = graph.links.some(
            (l) =>
              (l.from === d.slug && l.to === best!.n.slug) ||
              (l.from === best!.n.slug && l.to === d.slug),
          );
          if (alreadyLinked) return;
          setConnectPrompt({
            from: d.slug,
            to: best.n.slug,
            fromTitle: d.title,
            toTitle: best.n.title,
            x: src.clientX,
            y: src.clientY,
          });
          return;
        }
        // Chord layout: never unpin — the ring positions are the whole
        // point of this layout, and nulling fx/fy here would let the
        // simulation drift every clicked node toward the centre.
        if (layoutModeRef.current === "chord") return;
        // View mode (force layout): unpin so the simulation carries the
        // node back into place.
        if (d.isActive) return;
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeSel.call(drag as any);
    nodeSelRef.current = nodeSel;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3])
      // Suppress zoom's pan behavior on shift-drag so the lasso can
      // claim that gesture without fighting the canvas pan.
      .filter((e: any) => !e.shiftKey)
      .on("zoom", (e) => zoomLayer.attr("transform", e.transform.toString()));
    svg.call(zoom as any);

    recenterRef.current = () => {
      svg.transition().duration(260).call((zoom as any).transform, d3.zoomIdentity);
      for (const n of visibleNodes) {
        if (!n.isActive) { n.fx = null; n.fy = null; }
      }
      simulation.alpha(0.6).restart();
    };

    return () => {
      simulation.stop();
    };
  }, [graph, activeSlug, onSelect, nearbyOnly, adj, distances, size.w, size.h, expanded, layoutMode]);

  // Link-type highlighter: when the user hovers a legend row, lift
  // matching edges and dim the rest. Nodes that don't touch any
  // matching edge also fade so attention follows the colors. Reading
  // from refs means we don't rebuild the simulation on each hover.
  useEffect(() => {
    const linkSel = linkSelRef.current;
    const nodeSel = nodeSelRef.current;
    if (!linkSel || !nodeSel) return;
    const baseLinkWidth = expanded ? 1.5 : 1.2;
    const boostLinkWidth = expanded ? 2.5 : 2;
    // Legend-type highlight takes precedence; chord-click focus is a
    // fallback highlighter so the two can't fight over the same paint.
    if (highlightType === null && chordFocus === null) {
      linkSel
        .attr("stroke-opacity", 0.55)
        .attr("stroke-width", baseLinkWidth);
      nodeSel.attr("opacity", 1);
      return;
    }
    if (highlightType !== null) {
      const touches = new Set<string>();
      linkSel.each(function (d) {
        if (d.type === highlightType) {
          const s = typeof d.source === "string" ? d.source : (d.source as Node).slug;
          const t = typeof d.target === "string" ? d.target : (d.target as Node).slug;
          if (s) touches.add(s);
          if (t) touches.add(t);
        }
      });
      linkSel
        .attr("stroke-opacity", (d) => (d.type === highlightType ? 0.95 : 0.08))
        .attr("stroke-width", (d) =>
          d.type === highlightType ? boostLinkWidth : baseLinkWidth,
        );
      nodeSel.attr("opacity", (n) => (touches.has(n.slug) ? 1 : 0.2));
      return;
    }
    // Chord focus: edges incident to the focused node shine; all other
    // edges fade, and nodes that aren't the focus or one of its direct
    // neighbours dim so the user sees a clean local neighbourhood.
    const focus = chordFocus!;
    const neighbors = new Set<string>([focus]);
    linkSel.each(function (d) {
      const s = typeof d.source === "string" ? d.source : (d.source as Node).slug;
      const t = typeof d.target === "string" ? d.target : (d.target as Node).slug;
      if (s === focus) neighbors.add(t);
      if (t === focus) neighbors.add(s);
    });
    linkSel
      .attr("stroke-opacity", (d) => {
        const s = typeof d.source === "string" ? d.source : (d.source as Node).slug;
        const t = typeof d.target === "string" ? d.target : (d.target as Node).slug;
        return (s === focus || t === focus) ? 0.95 : 0.06;
      })
      .attr("stroke-width", (d) => {
        const s = typeof d.source === "string" ? d.source : (d.source as Node).slug;
        const t = typeof d.target === "string" ? d.target : (d.target as Node).slug;
        return (s === focus || t === focus) ? boostLinkWidth : baseLinkWidth;
      });
    nodeSel.attr("opacity", (n) => (neighbors.has(n.slug) ? 1 : 0.22));
  }, [highlightType, chordFocus, expanded]);

  const activeDegree = activeSlug ? (adj[activeSlug]?.size ?? 0) : 0;

  // Inline (narrow sidebar) uses a compact toolbar above the canvas so the
  // controls can never overlap the graph. Expanded mode floats them since
  // there's plenty of room.
  const Toolbar = (
    <div className="flex items-center gap-1 min-w-0">
      <span className="inline-flex items-center gap-1.5 text-2xs font-mono text-t2 min-w-0 truncate">
        <span className="w-1.5 h-1.5 rounded-full bg-yel shrink-0" />
        {activeSlug ? (
          <span className="truncate">
            <span className="text-char font-medium">{activeDegree}</span> direct
            <span className="text-t3"> · </span>
            {Math.max(0, graph.notes.length - 1)} total
          </span>
        ) : (
          <span className="truncate">
            {graph.notes.length} notes · {graph.links.length} links
          </span>
        )}
      </span>
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        {/* Layout mode segmented control: force (default, radial force-
            directed) vs chord (all notes pinned on an outer ring, edges
            curve through the centre). Both modes support connect-drag. */}
        <div className="flex items-center border border-bd rounded overflow-hidden mr-1">
          <button
            onClick={() => setLayoutMode("force")}
            className={`px-2 h-6 text-2xs font-mono ${layoutMode === "force" ? "bg-yelp text-yeld" : "text-t2 hover:text-char hover:bg-s2"}`}
            title="Force-directed layout — the default radial web"
          >force</button>
          <button
            onClick={() => setLayoutMode("chord")}
            className={`px-2 h-6 text-2xs font-mono ${layoutMode === "chord" ? "bg-yelp text-yeld" : "text-t2 hover:text-char hover:bg-s2"}`}
            title="Chord layout — every note on an outer ring, edges through centre"
          >chord</button>
        </div>
        {onAddLink && (
          <button
            onClick={() => setMode((m) => (m === "connect" ? "view" : "connect"))}
            title={
              mode === "connect"
                ? "Exit connect mode — drags will reposition notes again"
                : "Connect mode — drag from one note to another to link them"
            }
            className={`inline-flex items-center gap-1 px-2 h-6 rounded border transition ${
              mode === "connect"
                ? "bg-yeld text-bg border-yeld"
                : "bg-bg/85 border-bd text-t2 hover:text-char hover:bg-s2"
            }`}
          >
            <ConnectModeIcon />
            <span className="text-2xs font-mono">
              {mode === "connect" ? "connecting" : "connect"}
            </span>
          </button>
        )}
        <IconBtn
          onClick={() => setNearbyOnly((v) => !v)}
          title={nearbyOnly ? "Show every note" : "Focus on nearby notes"}
          active={!nearbyOnly}
        >
          <FilterIcon />
        </IconBtn>
        <IconBtn onClick={() => recenterRef.current()} title="Re-center graph">
          <RecenterIcon />
        </IconBtn>
        {!expanded && onExpand && (
          <IconBtn onClick={onExpand} title="Expand — see the full graph">
            <ExpandIcon />
          </IconBtn>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col">
      {!expanded && (
        <div className="px-2 pt-1.5 pb-1.5">{Toolbar}</div>
      )}
      <div
        ref={containerRef}
        className={`relative w-full flex-1 ${
          mode === "connect" ? "cursor-crosshair" : ""
        }`}
        style={height != null ? { height } : undefined}
        onMouseDown={(e) => {
          // Shift-drag begins a lasso. Zoom behavior is filtered out for
          // shift events above, so this is safe — pan and lasso can't
          // both fire.
          if (!e.shiftKey) return;
          // Ignore if the mousedown started on a node: the user wanted
          // to drag the node, not box-select.
          if ((e.target as Element).closest("g[data-slug]")) return;
          const rect = containerRef.current!.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          setLasso({ x0: x, y0: y, x1: x, y1: y });
          setSelectedSlugs(new Set());
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseMove={(e) => {
          if (!lasso) return;
          const rect = containerRef.current!.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          setLasso({ ...lasso, x1: x, y1: y });
        }}
        onMouseUp={() => {
          if (!lasso) return;
          const box = lasso;
          setLasso(null);
          const containerRect = containerRef.current!.getBoundingClientRect();
          const lx0 = Math.min(box.x0, box.x1);
          const lx1 = Math.max(box.x0, box.x1);
          const ly0 = Math.min(box.y0, box.y1);
          const ly1 = Math.max(box.y0, box.y1);
          // Ignore tiny drags (stray shift-clicks) so the action bar
          // doesn't appear for a single pixel of motion.
          if (lx1 - lx0 < 6 && ly1 - ly0 < 6) return;
          const captured = new Set<string>();
          const nodeEls = containerRef.current!.querySelectorAll<SVGGElement>(
            "g[data-slug]",
          );
          nodeEls.forEach((el) => {
            const bbox = el.getBoundingClientRect();
            const cx = bbox.left + bbox.width / 2 - containerRect.left;
            const cy = bbox.top + bbox.height / 2 - containerRect.top;
            if (cx >= lx0 && cx <= lx1 && cy >= ly0 && cy <= ly1) {
              const slug = el.dataset.slug;
              if (slug) captured.add(slug);
            }
          });
          setSelectedSlugs(captured);
        }}
        onMouseLeave={() => {
          // If the cursor leaves the container mid-drag, abandon the
          // lasso rather than leaving it stuck on screen.
          if (lasso) setLasso(null);
        }}
      >
        <svg ref={svgRef} className="w-full h-full" />

        {/* Rubber-band line drawn while the user is dragging in connect
            mode. Rendered as a container-relative overlay so it doesn't
            need to replicate the zoom transform — the source point was
            captured in container coords at drag start (node pinned). */}
        {connectDrag && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 6 }}
          >
            <defs>
              <marker
                id="connect-drag-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="var(--yeld)" />
              </marker>
            </defs>
            <line
              x1={connectDrag.sx}
              y1={connectDrag.sy}
              x2={connectDrag.tx}
              y2={connectDrag.ty}
              stroke="var(--yeld)"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinecap="round"
              markerEnd="url(#connect-drag-arrow)"
            />
            <circle
              cx={connectDrag.sx}
              cy={connectDrag.sy}
              r={4}
              fill="var(--yeld)"
            />
          </svg>
        )}

        {/* Mode banner: a small floating chip that names the current
            mode so the user never has to guess what a drag will do.
            Only visible in connect mode — view mode is the default and
            doesn't need a label. */}
        {mode === "connect" && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-yeld text-bg text-2xs font-serif italic shadow-lg flex items-center gap-2 animate-fadeIn"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ConnectModeIcon />
            <span>Connect mode — drag a note onto another to link them</span>
            <button
              onClick={() => setMode("view")}
              className="text-bg/80 hover:text-bg underline decoration-dotted"
            >
              exit
            </button>
          </div>
        )}

        {/* Coach marks: appear when the graph is sparse enough that a new
            user might not know it's interactive. Dismissable; stays hidden
            after the user opts out or after the vault grows past a few
            connections. */}
        <CoachMarks totalLinks={graph.links.length} expanded={!!expanded} />

        {expanded && (
          <div className="absolute top-2 left-2 right-2 flex items-center gap-2 px-2 py-1.5 rounded-md bg-bg/85 backdrop-blur border border-bd">
            {Toolbar}
          </div>
        )}

        {/* Legend — identifies the gold-ringed main note so the Map never
            leaves the user guessing which circle is "home." In expanded
            mode we also show the link-type color key so the typed edges
            read as grammar, not just topology. */}
        {mainNoteSlug && (
          <div className="absolute bottom-3 left-3 flex items-center gap-3 px-2.5 py-1.5 rounded-md bg-bg/90 backdrop-blur border border-bd text-2xs font-mono text-t2">
            <LegendSwatch kind="main" label="main" />
            <LegendSwatch kind="active" label="you're here" />
            <LegendSwatch kind="neighbor" label="connected" />
          </div>
        )}
        {expanded && graph.links.length > 0 && (
          <div
            className="absolute top-14 left-3 flex flex-col gap-0.5 px-2.5 py-2 rounded-md bg-bg/90 backdrop-blur border border-bd text-2xs font-mono text-t2"
            onMouseLeave={() => setHighlightType(null)}
          >
            <div className="font-serif italic text-[10px] text-t3 mb-1">
              hover a kind to filter
            </div>
            <LinkLegend
              color="var(--yel)"
              label="supports"
              onHover={() => setHighlightType("supports")}
              active={highlightType === "supports"}
            />
            <LinkLegend
              color="var(--danger)"
              label="challenges"
              onHover={() => setHighlightType("challenges")}
              active={highlightType === "challenges"}
            />
            <LinkLegend
              color="var(--yeld)"
              label="came from"
              onHover={() => setHighlightType("came-from")}
              active={highlightType === "came-from"}
            />
            <LinkLegend
              color="var(--ch2)"
              label="open question"
              dashed
              onHover={() => setHighlightType("open-question")}
              active={highlightType === "open-question"}
            />
          </div>
        )}

        {expanded && (
          <div className="absolute bottom-3 right-3 flex items-center justify-end">
            <div className="text-2xs text-t3 font-mono hidden md:block">
              scroll to zoom · drag to pan · click a node to open
            </div>
          </div>
        )}

        {hover && (
          <div
            className="absolute z-10 pointer-events-none px-2 py-1.5 rounded-md bg-char text-bg text-2xs shadow-lg max-w-[280px]"
            style={{ left: hover.x + 10, top: hover.y + 10 }}
          >
            <div className="font-medium">{hover.title}</div>
            {hover.sub && <div className="text-[10px] opacity-75 mt-0.5">{hover.sub}</div>}
          </div>
        )}

        {/* Drag-to-connect popover — appears when a node is released on
            another. Four typed-link options; click creates the wikilink
            (via AppShell's onAddLink handler) and dismisses. */}
        {connectPrompt && (
          <ConnectPopover
            data={connectPrompt}
            containerRef={containerRef}
            onPick={async (type) => {
              const p = connectPrompt;
              setConnectPrompt(null);
              if (p && onAddLinkRef.current) {
                try {
                  await onAddLinkRef.current(p.from, p.to, type);
                } catch (e) {
                  console.error("drag-to-connect failed", e);
                }
              }
            }}
            onCancel={() => setConnectPrompt(null)}
          />
        )}

        {/* Lasso rubber-band — rendered in SVG overlay so it follows the
            zoom/pan. Kept simple: axis-aligned rectangle. */}
        {lasso && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 5 }}
          >
            <rect
              x={Math.min(lasso.x0, lasso.x1)}
              y={Math.min(lasso.y0, lasso.y1)}
              width={Math.abs(lasso.x1 - lasso.x0)}
              height={Math.abs(lasso.y1 - lasso.y0)}
              fill="var(--yelp)"
              fillOpacity={0.35}
              stroke="var(--yeld)"
              strokeDasharray="4 4"
            />
          </svg>
        )}

        {/* Lasso action bar — shown after the user releases a lasso with
            one or more nodes captured. Offers bulk tag / add-to-path /
            cancel. */}
        {selectedSlugs.size > 0 && (
          <LassoActionBar
            count={selectedSlugs.size}
            pathNames={pathNames ?? []}
            onApplyTag={async (tag) => {
              const slugs = Array.from(selectedSlugs);
              setSelectedSlugs(new Set());
              if (onBulkTagRef.current) {
                try {
                  await onBulkTagRef.current(slugs, tag);
                } catch (e) {
                  console.error("bulk tag failed", e);
                }
              }
            }}
            onAddToPath={async (path) => {
              const slugs = Array.from(selectedSlugs);
              setSelectedSlugs(new Set());
              if (onBulkAddToPathRef.current) {
                try {
                  await onBulkAddToPathRef.current(slugs, path);
                } catch (e) {
                  console.error("bulk add to path failed", e);
                }
              }
            }}
            onClear={() => setSelectedSlugs(new Set())}
          />
        )}
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  title,
  children,
  active,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-6 h-6 flex items-center justify-center rounded border transition ${
        active
          ? "bg-yelp border-yel text-yeld"
          : "bg-bg/85 border-bd text-t2 hover:text-char hover:bg-s2"
      }`}
    >
      {children}
    </button>
  );
}

function ConnectModeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M4 4l4 4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2 3h8M3.5 6h5M5 9h2" />
    </svg>
  );
}

function LinkLegend({
  color,
  label,
  dashed,
  onHover,
  active,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  onHover?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onFocus={onHover}
      className={`flex items-center gap-2 px-1 py-0.5 rounded text-left transition ${
        active ? "bg-yelp" : "hover:bg-s2"
      }`}
    >
      <svg width="22" height="4" viewBox="0 0 22 4">
        <line
          x1="0"
          y1="2"
          x2="22"
          y2="2"
          stroke={color}
          strokeWidth={active ? "2.4" : "1.8"}
          strokeLinecap="round"
          strokeDasharray={dashed ? "3 3" : undefined}
        />
      </svg>
      <span
        className={`italic font-serif text-[10px] ${
          active ? "text-char" : ""
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function LegendSwatch({ kind, label }: { kind: "main" | "active" | "neighbor"; label: string }) {
  const styles: Record<typeof kind, React.CSSProperties> = {
    main: {
      background: "var(--s2)",
      border: "2px solid #D4A04A",
    },
    active: {
      background: "var(--yel)",
      border: "0",
    },
    neighbor: {
      background: "var(--s2)",
      border: "1px solid var(--bd2)",
    },
  };
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={styles[kind]}
      />
      <span>{label}</span>
    </span>
  );
}

function RecenterIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="6" cy="6" r="1.5" />
      <path d="M6 1v2M6 9v2M1 6h2M9 6h2" strokeLinecap="round" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M1.5 4V1.5H4" /><path d="M8.5 4V1.5H6" /><path d="M1.5 6v2.5H4" /><path d="M8.5 6v2.5H6" />
    </svg>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Wrap a title into at most `maxLines` lines, each ≤ `maxChars`. Breaks on
 * word boundaries; falls back to a truncated single line when the word
 * doesn't fit.
 */
function wrapLabel(s: string, maxChars: number, maxLines: number): string[] {
  const words = s.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length <= maxChars) {
      cur = candidate;
    } else if (!cur) {
      // Single word longer than the cap — keep it whole on its own line,
      // we'll truncate at the end if we exceed maxLines.
      cur = w;
      lines.push(cur);
      cur = "";
    } else {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1 && (cur.length > maxChars || words.indexOf(w) < words.length - 1)) {
        // Final allowed line: pack remaining words and truncate.
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

/**
 * Small overlay with three tips that teach graph interactions. Shown
 * when the graph is sparse (≤ 3 edges) and the user hasn't dismissed it
 * yet. Dismissed state is persisted globally in localStorage so the
 * tips don't re-appear after someone's clicked through them once, even
 * if they temporarily open an empty workspace.
 */
const COACH_DISMISS_KEY = "yarrow.graphCoach.dismissed";

function CoachMarks({ totalLinks, expanded }: { totalLinks: number; expanded: boolean }) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COACH_DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;
  if (totalLinks > 3) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(COACH_DISMISS_KEY, "true");
    } catch {}
    setDismissed(true);
  };

  const tips = [
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="3" cy="7" r="1.6" />
          <circle cx="11" cy="7" r="1.6" />
          <path d="M4.6 7h4.8M8.2 5.4L9.4 7 8.2 8.6" />
        </svg>
      ),
      text: "Click “connect” in the toolbar, then drag one note onto another to link them. Flip back to view mode when you're done.",
    },
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7" cy="7" r="2" />
          <path d="M7 2v1.5M7 10.5V12M2 7h1.5M10.5 7H12" />
        </svg>
      ),
      text: "Click any note to center the graph on it — neighbors pull closer, distant ideas fade back.",
    },
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 7L6 3M2 7L6 11M2 7H12M12 7L8 3M12 7L8 11" />
        </svg>
      ),
      text: "Shift+drag on empty space to lasso several notes — then tag them or add them to a path in one move.",
    },
  ];

  return (
    <div
      className={`absolute z-10 ${expanded ? "top-20 right-6 w-[320px]" : "bottom-3 right-3 w-[260px]"} bg-bg/95 backdrop-blur border border-bd2 rounded-lg shadow-xl p-3 text-2xs animate-fadeIn`}
      // Don't swallow graph clicks; the dismiss button handles its own click.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="font-serif italic text-[11px] text-t3">
          Your graph is still growing —
        </div>
        <button
          onClick={dismiss}
          className="text-t3 hover:text-char transition text-[10px]"
          title="Hide these tips"
        >
          dismiss
        </button>
      </div>
      <ul className="space-y-2">
        {tips.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-t2 leading-snug">
            <span className="mt-[1px] text-yeld shrink-0">{t.icon}</span>
            <span>{t.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Floating popover that appears when the user drops one node onto
 * another. Offers the four typed-link kinds; Esc cancels. Positioned in
 * container-relative coordinates from the drop point so it lands where
 * the user's attention already is.
 */
function ConnectPopover({
  data,
  containerRef,
  onPick,
  onCancel,
}: {
  data: {
    from: string;
    to: string;
    fromTitle: string;
    toTitle: string;
    x: number;
    y: number;
  };
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPick: (type: LinkType) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Translate screen coords into container-local coords so the popover
  // lives in the absolute-positioned overlay layer and clips correctly.
  const rect = containerRef.current?.getBoundingClientRect();
  const left = rect ? data.x - rect.left : data.x;
  const top = rect ? data.y - rect.top : data.y;

  const WIDTH = 280;
  // Clamp so the popover doesn't run off the right edge of the graph.
  const containerW = rect?.width ?? WIDTH;
  const x = Math.min(left, containerW - WIDTH - 8);
  const y = Math.max(8, top - 8);

  return (
    <div
      className="absolute z-30 w-[280px] bg-bg border border-bd2 rounded-lg shadow-xl p-3 text-xs animate-fadeIn"
      style={{ left: Math.max(8, x), top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="font-serif italic text-[11px] text-t3 mb-2 leading-snug">
        connect <span className="text-char not-italic">{data.fromTitle}</span>{" "}
        to <span className="text-char not-italic">{data.toTitle}</span> as…
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <ConnectTypeBtn label="supports" color="--yel" onClick={() => onPick("supports")} />
        <ConnectTypeBtn label="challenges" color="--danger" onClick={() => onPick("challenges")} />
        <ConnectTypeBtn label="came from" color="--yeld" onClick={() => onPick("came-from")} />
        <ConnectTypeBtn label="open question" color="--ch2" onClick={() => onPick("open-question")} />
      </div>
      <button
        onClick={onCancel}
        className="mt-2 text-2xs text-t3 hover:text-char transition block"
      >
        cancel
      </button>
    </div>
  );
}

function ConnectTypeBtn({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1.5 rounded border border-bd bg-bg hover:bg-s2 text-t2 hover:text-char transition text-left flex items-center gap-1.5"
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: `var(${color})` }}
      />
      <span>{label}</span>
    </button>
  );
}

/**
 * Floating bar shown while one or more nodes are selected via the
 * lasso. Offers bulk tag assignment and bulk path-membership through
 * an inline input / picker. "Clear" empties the selection.
 */
function LassoActionBar({
  count,
  pathNames,
  onApplyTag,
  onAddToPath,
  onClear,
}: {
  count: number;
  pathNames: string[];
  onApplyTag: (tag: string) => void;
  onAddToPath: (path: string) => void;
  onClear: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "tag" | "path">("idle");
  const [tagValue, setTagValue] = useState("");
  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-bg border border-bd2 rounded-lg shadow-xl px-3 py-2 flex items-center gap-2 text-xs animate-fadeIn"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="font-serif italic text-2xs text-t3">
        {count} selected
      </span>
      <span className="text-t3">·</span>
      {mode === "idle" && (
        <>
          <button
            onClick={() => setMode("tag")}
            className="px-2 py-1 rounded text-t2 hover:bg-s2 hover:text-char transition"
          >
            Tag…
          </button>
          <button
            onClick={() => setMode("path")}
            className="px-2 py-1 rounded text-t2 hover:bg-s2 hover:text-char transition"
            disabled={pathNames.length === 0}
            title={pathNames.length === 0 ? "Create a path first" : undefined}
          >
            Add to path…
          </button>
        </>
      )}
      {mode === "tag" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = tagValue.trim().replace(/^#/, "");
            if (t) onApplyTag(t);
          }}
          className="flex items-center gap-1"
        >
          <input
            autoFocus
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            placeholder="tag name"
            className="px-2 py-1 bg-s1 border border-bd rounded text-char text-2xs focus:outline-none focus:border-yeld w-[140px]"
          />
          <button
            type="submit"
            className="px-2 py-1 bg-char text-bg rounded text-2xs hover:bg-yeld transition"
          >
            apply
          </button>
        </form>
      )}
      {mode === "path" && (
        <select
          autoFocus
          onChange={(e) => {
            const p = e.target.value;
            if (p) onAddToPath(p);
          }}
          className="px-2 py-1 bg-s1 border border-bd rounded text-char text-2xs focus:outline-none focus:border-yeld"
          defaultValue=""
        >
          <option value="" disabled>
            pick a path…
          </option>
          {pathNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={onClear}
        className="ml-1 text-2xs text-t3 hover:text-char transition"
      >
        clear
      </button>
    </div>
  );
}
