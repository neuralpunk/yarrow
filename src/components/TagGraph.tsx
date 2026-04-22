import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Graph } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  graph: Graph | null;
  /** Click a tag to jump to the notes filtered by it. Closes the modal. */
  onPickTag: (tag: string) => void;
}

interface TagNode extends d3.SimulationNodeDatum {
  tag: string;
  count: number;
  /** Cluster index assigned greedily so each connected group gets its own
   *  color accent in the graph. */
  cluster: number;
}
interface TagLink extends d3.SimulationLinkDatum<TagNode> {
  weight: number;
}

// Editorial accent palette — same vibe as pathAwareness but seeded off
// cluster index so sibling tags share a family instead of flickering.
const CLUSTER_HUES = [38, 168, 214, 292, 12, 136, 254, 76];

function themeVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

/** Build tag nodes + co-occurrence links from a Graph snapshot. A link's
 *  weight is the number of notes that contain both tags. */
function buildTagModel(graph: Graph | null): {
  nodes: TagNode[];
  links: TagLink[];
} {
  if (!graph) return { nodes: [], links: [] };
  const counts = new Map<string, number>();
  for (const n of graph.notes) {
    for (const t of n.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (counts.size === 0) return { nodes: [], links: [] };

  const pairs = new Map<string, number>();
  for (const n of graph.notes) {
    const ts = Array.from(new Set(n.tags ?? [])).sort();
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const key = `${ts[i]}\u0000${ts[j]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }

  // Assign clusters via union-find over the link adjacency. Tags that
  // never co-occur land in their own singleton cluster.
  const tagList = Array.from(counts.keys()).sort();
  const parent = new Map<string, string>();
  const find = (a: string): string => {
    let r = parent.get(a) ?? a;
    while (r !== (parent.get(r) ?? r)) r = parent.get(r) ?? r;
    parent.set(a, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const t of tagList) parent.set(t, t);
  for (const key of pairs.keys()) {
    const [a, b] = key.split("\u0000");
    union(a, b);
  }
  const clusterIndex = new Map<string, number>();
  let next = 0;
  for (const t of tagList) {
    const root = find(t);
    if (!clusterIndex.has(root)) clusterIndex.set(root, next++);
  }

  const nodes: TagNode[] = tagList.map((tag) => ({
    tag,
    count: counts.get(tag) ?? 0,
    cluster: clusterIndex.get(find(tag)) ?? 0,
  }));

  const links: TagLink[] = [];
  for (const [key, weight] of pairs) {
    const [a, b] = key.split("\u0000");
    links.push({ source: a, target: b, weight });
  }

  return { nodes, links };
}

export default function TagGraph({ open, onClose, graph, onPickTag }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const recenterRef = useRef<(() => void) | null>(null);
  const [hovered, setHovered] = useState<TagNode | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { nodes, links } = useMemo(() => buildTagModel(graph), [graph]);

  useEffect(() => {
    if (!open || !svgRef.current || nodes.length === 0) return;
    const svgEl = svgRef.current;
    const width = svgEl.clientWidth || 820;
    const height = svgEl.clientHeight || 520;
    const cx = width / 2;
    const cy = height / 2;

    const textColor = themeVar("--char", "#262523");
    const mutedText = themeVar("--t3", "#8a8278");
    const bg = themeVar("--bg", "#fbf9f4");
    const border = themeVar("--bd2", "#d7cfc1");

    const maxCount = nodes.reduce((m, n) => Math.max(m, n.count), 0);
    const nodeRadius = (n: TagNode) => {
      const base = 14;
      const scale = maxCount <= 1 ? 0 : 12 * (n.count / maxCount);
      return base + scale;
    };
    const clusterColor = (c: number) => {
      const hue = CLUSTER_HUES[c % CLUSTER_HUES.length];
      return `hsl(${hue}, 58%, 52%)`;
    };

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const zoomLayer = svg.append("g");

    const linkSel = zoomLayer
      .append("g")
      .attr("stroke-linecap", "round")
      .selectAll<SVGLineElement, TagLink>("line")
      .data(links)
      .join("line")
      .attr("stroke", border)
      .attr("stroke-opacity", 0.55)
      .attr("stroke-width", (l) => 0.8 + Math.min(l.weight, 5) * 0.5);

    const nodeSel = zoomLayer
      .append("g")
      .selectAll<SVGGElement, TagNode>("g")
      .data(nodes, (d) => (d as TagNode).tag)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_e, d) => {
        onPickTag(d.tag);
      })
      .on("mouseenter", (_e, d) => setHovered(d))
      .on("mouseleave", () => setHovered(null));

    nodeSel
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", bg)
      .attr("stroke", (d) => clusterColor(d.cluster))
      .attr("stroke-width", 2);

    nodeSel
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-family", "'Source Serif 4', ui-serif, Georgia, serif")
      .attr("font-size", (d) => (nodeRadius(d) >= 20 ? 12.5 : 11))
      .attr("font-style", "italic")
      .attr("fill", textColor)
      .attr("pointer-events", "none")
      .text((d) => `#${d.tag}`);

    nodeSel
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", (d) => nodeRadius(d) + 12)
      .attr("font-family", "'JetBrains Mono', ui-monospace, monospace")
      .attr("font-size", 9.5)
      .attr("fill", mutedText)
      .attr("pointer-events", "none")
      .text((d) => `${d.count}`);

    const sim = d3
      .forceSimulation<TagNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<TagNode, TagLink>(links)
          .id((d) => d.tag)
          .distance((l) => 80 - Math.min(l.weight, 6) * 4)
          .strength(0.3),
      )
      .force("charge", d3.forceManyBody<TagNode>().strength(-240))
      .force("center", d3.forceCenter(cx, cy))
      .force(
        "collide",
        d3.forceCollide<TagNode>((d) => nodeRadius(d) + 14),
      );

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as TagNode).x ?? 0)
        .attr("y1", (d) => (d.source as TagNode).y ?? 0)
        .attr("x2", (d) => (d.target as TagNode).x ?? 0)
        .attr("y2", (d) => (d.target as TagNode).y ?? 0);
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    const drag = d3
      .drag<SVGGElement, TagNode>()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeSel.call(drag);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (e) => zoomLayer.attr("transform", e.transform.toString()));
    svg.call(zoom);

    recenterRef.current = () => {
      svg.transition().duration(260).call(zoom.transform, d3.zoomIdentity);
      for (const n of nodes) {
        n.fx = null;
        n.fy = null;
      }
      sim.alpha(0.6).restart();
    };

    return () => {
      sim.stop();
    };
  }, [open, nodes, links, onPickTag]);

  if (!open) return null;

  const totalTags = nodes.length;
  const totalLinks = links.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-bd2 rounded-xl shadow-2xl w-full max-w-[960px] h-[72vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between px-6 pt-5 pb-3 border-b border-bd">
          <div>
            <h2 className="font-serif text-2xl text-char">Tag graph</h2>
            <p className="font-serif italic text-xs text-t3 mt-0.5">
              {totalTags > 0
                ? `${totalTags} tag${totalTags === 1 ? "" : "s"} · ${totalLinks} co-occurrence${totalLinks === 1 ? "" : "s"} — click a tag to filter the note list`
                : "no tags yet"}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => recenterRef.current?.()}
              className="px-2.5 py-1 rounded-md text-t2 hover:bg-s2 hover:text-char transition"
            >
              Recenter
            </button>
          </div>
        </div>

        <div className="flex-1 relative">
          {totalTags === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-[320px] px-6">
                <div className="mx-auto mb-3 w-10 h-10 rounded-full border border-dashed border-bd2 flex items-center justify-center text-t3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 12l-8 8L4 12l8-8z" />
                  </svg>
                </div>
                <div className="text-sm text-t2 leading-relaxed">
                  Tag a few notes to see how ideas cluster.
                </div>
                <div className="text-2xs text-t3 mt-1 leading-relaxed">
                  Use the chip row under a note's title — tags that show up on the same notes will draw themselves together here.
                </div>
              </div>
            </div>
          ) : (
            <>
              <svg ref={svgRef} width="100%" height="100%" className="block" />
              {hovered && (
                <div className="absolute top-3 left-3 bg-char text-bg text-2xs px-2.5 py-1.5 rounded-md shadow-lg pointer-events-none">
                  <div className="font-serif italic text-sm">#{hovered.tag}</div>
                  <div className="font-mono text-[10px] opacity-80">
                    on {hovered.count} {hovered.count === 1 ? "note" : "notes"}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-bd flex items-center justify-between">
          <span className="font-serif italic text-2xs text-t3">
            Drag a tag to reposition · scroll to zoom · Esc to close
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md text-t2 hover:bg-s2 hover:text-char transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
