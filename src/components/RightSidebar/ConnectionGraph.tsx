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

export default function ConnectionGraph({ graph, activeSlug, mainNoteSlug, onSelect, fillHeight }: Props) {
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
  const totalLinks = graph?.links.length ?? 0;

  if (!graph || totalNodes === 0 || totalLinks === 0) {
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
            Connect this note to see how ideas relate.
          </div>
          <div className="text-2xs text-t3 mt-1 leading-relaxed">
            Links between notes build a living map of your thinking.
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
                {totalNodes} notes · {totalLinks} connection{totalLinks === 1 ? "" : "s"} · click a node to open it · esc to close
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
}

function GraphView({ graph, activeSlug, mainNoteSlug, onSelect, height, expanded, onExpand }: ViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recenterRef = useRef<() => void>(() => {});
  const [nearbyOnly, setNearbyOnly] = useState(!expanded);
  const [hover, setHover] = useState<Hover | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

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

    const visibleNodes = nearbyOnly && activeSlug
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

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${heightPx}`);
    svg.selectAll("*").remove();

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    const g = zoomLayer.append("g");

    // Editorial style: one quiet edge color, no arrows, no direction. The
    // typed-link metadata still exists in the data but the map is about
    // *proximity*, not grammar. Dashed stays for open-questions so that the
    // single exception to "everything is connected" reads at a glance.
    const edgeColor = themeColor("--yel", "#7A4E6E");
    const linkSel = g
      .append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(visibleLinks)
      .join("path")
      .attr("stroke", edgeColor)
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", expanded ? 1.25 : 1)
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", (d) => (d.type === "open-question" ? "4 4" : null))
      .attr("pointer-events", "none");

    const nodeSel = g
      .append("g")
      .selectAll("g")
      .data(visibleNodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_e, d) => onSelect(d.slug))
      .on("mouseenter", function (event, d) {
        const rect = containerRef.current!.getBoundingClientRect();
        const connCount = adj[d.slug]?.size ?? 0;
        const mainTag = d.isMain ? "★ main · " : "";
        setHover({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          title: d.title,
          sub: `${mainTag}${connCount} connection${connCount === 1 ? "" : "s"} · click to open`,
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
      .force("radial", d3.forceRadial<Node>((d) => {
        if (d.isActive) return 0;
        if (d.distance === 1) return ringR1;
        if (d.distance === 2) return ringR2;
        return ringR2 + 40;
      }, cx, cy).strength(0.55))
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
        // Straight lines, trimmed at the circle edges so the stroke butts
        // cleanly against each chip instead of piercing through it.
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
        return `M${sx + sox},${sy + soy} L${tx - tox},${ty - toy}`;
      });
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    const drag = d3
      .drag<SVGGElement, Node>()
      .on("start", (event, d) => {
        if (d.isActive) return;
        if (!event.active) simulation.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        if (d.isActive) return;
        d.fx = clampX(event.x);
        d.fy = clampY(event.y);
      })
      .on("end", (event, d) => {
        if (d.isActive) return;
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeSel.call(drag as any);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3])
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
  }, [graph, activeSlug, onSelect, nearbyOnly, adj, distances, size.w, size.h, expanded]);

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
        className="relative w-full flex-1"
        style={height != null ? { height } : undefined}
      >
        <svg ref={svgRef} className="w-full h-full" />

        {expanded && (
          <div className="absolute top-2 left-2 right-2 flex items-center gap-2 px-2 py-1.5 rounded-md bg-bg/85 backdrop-blur border border-bd">
            {Toolbar}
          </div>
        )}

        {/* Legend — identifies the gold-ringed main note so the Map never
            leaves the user guessing which circle is "home." */}
        {mainNoteSlug && (
          <div className="absolute bottom-3 left-3 flex items-center gap-3 px-2.5 py-1.5 rounded-md bg-bg/90 backdrop-blur border border-bd text-2xs font-mono text-t2">
            <LegendSwatch kind="main" label="main" />
            <LegendSwatch kind="active" label="you're here" />
            <LegendSwatch kind="neighbor" label="connected" />
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

function FilterIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2 3h8M3.5 6h5M5 9h2" />
    </svg>
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
