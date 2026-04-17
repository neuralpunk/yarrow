import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { Graph, LinkType } from "../../lib/types";

function themeColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function linkColor(type: LinkType): string {
  switch (type) {
    case "supports": return themeColor("--yel", "#e8b820");
    case "challenges": return "#d97706";
    case "came-from": return themeColor("--t3", "#a09c6c");
    case "open-question": return themeColor("--yeld", "#b8900e");
  }
}

interface Props {
  graph: Graph | null;
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

interface Node extends d3.SimulationNodeDatum {
  slug: string;
  title: string;
  isActive: boolean;
  distance: number;
}
interface Link extends d3.SimulationLinkDatum<Node> {
  type: LinkType;
}

const HEIGHT = 260;
const NODE_MARGIN = 14; // padding so labels don't get clipped

export default function ConnectionGraph({ graph, activeSlug, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recenterRef = useRef<() => void>(() => {});
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (!graph || !svgRef.current || !containerRef.current) return;
    if (graph.notes.length === 0) {
      setEmpty(true);
      return;
    }
    setEmpty(false);

    const width = containerRef.current.clientWidth;
    const height = HEIGHT;
    const minX = NODE_MARGIN;
    const maxX = width - NODE_MARGIN;
    const minY = NODE_MARGIN;
    const maxY = height - NODE_MARGIN;
    const clampX = (x: number) => Math.min(maxX, Math.max(minX, x));
    const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));

    const adj: Record<string, Set<string>> = {};
    for (const e of graph.links) {
      adj[e.from] = adj[e.from] || new Set();
      adj[e.to] = adj[e.to] || new Set();
      adj[e.from].add(e.to);
      adj[e.to].add(e.from);
    }
    const distances: Record<string, number> = {};
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

    const nodes: Node[] = graph.notes.map((n) => ({
      slug: n.slug,
      title: n.title,
      isActive: n.slug === activeSlug,
      distance: distances[n.slug] ?? 3,
    }));
    const nodeIds = new Set(nodes.map((n) => n.slug));
    const links: Link[] = graph.links
      .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map((e) => ({
        source: e.from,
        target: e.to,
        type: e.type,
      }));

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    const g = zoomLayer.append("g");

    const linkSel = g
      .append("g")
      .attr("stroke-opacity", 0.55)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => linkColor(d.type))
      .attr("stroke-dasharray", (d) => (d.type === "open-question" ? "4 3" : "0"))
      .attr("stroke-width", 1.4);

    const nodeSel = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_e, d) => onSelect(d.slug));

    const activeFill = themeColor("--yel", "#e8b820");
    const inactiveFill = themeColor("--yelp", "#fef6cc");
    const activeStroke = themeColor("--yeld", "#b8900e");
    const inactiveStroke = themeColor("--bd", "#ddd5a0");
    const textColor = themeColor("--ch2", "#3a3820");

    nodeSel
      .append("circle")
      .attr("r", (d) => (d.isActive ? 9 : 5))
      .attr("fill", (d) => (d.isActive ? activeFill : inactiveFill))
      .attr("stroke", (d) => (d.isActive ? activeStroke : inactiveStroke))
      .attr("stroke-width", 1.5)
      .attr("opacity", (d) => {
        if (d.isActive) return 1;
        const dist = d.distance;
        if (dist <= 1) return 1;
        if (dist === 2) return 0.7;
        return 0.45;
      });

    nodeSel
      .append("text")
      .attr("dy", (d) => (d.isActive ? 22 : 16))
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => (d.isActive ? 11 : 9))
      .attr("fill", textColor)
      .attr("opacity", (d) => {
        if (d.isActive) return 1;
        if (d.distance <= 1) return 0.85;
        return 0.5;
      })
      .text((d) => truncate(d.title, 20));

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(links)
          .id((d) => d.slug)
          .distance((l: any) => {
            const s = l.source as Node;
            const t = l.target as Node;
            if (s.isActive || t.isActive) return 60;
            return 80;
          })
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<Node>(22));

    simulation.on("tick", () => {
      // Clamp every node inside the viewport so they can never drift off-screen.
      for (const n of nodes) {
        if (n.x != null) n.x = clampX(n.x);
        if (n.y != null) n.y = clampY(n.y);
      }
      linkSel
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Drag (with clamping so users can't yeet nodes off the canvas)
    const drag = d3
      .drag<SVGGElement, Node>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = clampX(event.x);
        d.fy = clampY(event.y);
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeSel.call(drag as any);

    // Zoom/pan
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3])
      .on("zoom", (e) => zoomLayer.attr("transform", e.transform.toString()));
    svg.call(zoom as any);

    // Expose recenter: reset zoom, unstick nodes, and bump the simulation.
    recenterRef.current = () => {
      svg.transition().duration(260).call((zoom as any).transform, d3.zoomIdentity);
      for (const n of nodes) {
        n.fx = null;
        n.fy = null;
      }
      simulation.alpha(0.6).restart();
    };

    return () => {
      simulation.stop();
    };
  }, [graph, activeSlug, onSelect]);

  const noLinks = !graph || graph.links.length === 0;
  if (empty || !graph || graph.notes.length === 0 || noLinks) {
    return (
      <div className="h-[260px] flex items-center justify-center px-4">
        <div className="text-center max-w-[220px]">
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
            Links appear here as a living map.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden">
      <svg ref={svgRef} className="w-full h-[260px]" />
      <button
        onClick={() => recenterRef.current()}
        className="absolute top-1 right-1 y-tip bg-bg/80 backdrop-blur border border-bd rounded-md px-2 py-1 text-2xs text-t2 hover:text-char hover:bg-bg transition"
        data-tip="Re-center graph"
        aria-label="Re-center graph"
      >
        re-center
      </button>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
