<script module lang="ts">
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
</script>

<script lang="ts">
  import type { NoteSummary, PathCollection } from "../../lib/types";
  import { isGhostPath } from "../../lib/types";
  import { relativeTime } from "../../lib/format";
  import { tr } from "../../lib/i18n/index.svelte";

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
    currentPathName?: string;
    onDropNoteOnPath?: (pathName: string, slug: string) => Promise<void> | void;
  }

  let {
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
  }: Props = $props();

  let t = $derived(tr());

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

  const ROW_H_BASE = 120;
  const COL_W = 300;
  const PAD_L = 90;
  const PAD_R = 320;
  const PAD_T = 70;
  const PAD_B = 90;
  const CARD_W = 260;
  const GHOST_COL_W = 360;

  function readDisplayMode(): "ink" | "ribbon" {
    try {
      const v = localStorage.getItem("yarrow.forkingRoadMode");
      if (v === "ribbon" || v === "blueprint" || v === "pill") return "ribbon";
      return "ink";
    } catch {
      return "ink";
    }
  }

  let displayMode = $state<"ink" | "ribbon">(readDisplayMode());
  $effect(() => {
    try {
      localStorage.setItem("yarrow.forkingRoadMode", displayMode);
    } catch { /* quota */ }
  });

  let ROW_H = $derived(displayMode === "ribbon" ? 72 : ROW_H_BASE);

  let hovered = $state<string | null>(null);
  let dropTarget = $state<string | null>(null);
  let hoverAnchor = $state<DOMRect | null>(null);

  let baselineMembers = $derived.by(() => {
    if (!currentPathName) return undefined;
    return collections.find((c) => c.name === currentPathName)?.members;
  });

  $effect(() => {
    if (selectedPath) return;
    const slugs = hovered
      ? collections.find((c) => c.name === hovered)?.members ?? null
      : null;
    window.dispatchEvent(
      new CustomEvent("yarrow:path-highlight", { detail: { slugs } }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("yarrow:path-highlight", { detail: { slugs: null } }),
      );
    };
  });

  let titleFor = $derived.by(() => {
    const m = new Map<string, string>();
    for (const n of notes) m.set(n.slug, n.title || n.slug);
    return m;
  });

  let tree = $derived.by(() => {
    const map = new Map<string, Node>();
    const live = collections.filter((c) => !isGhostPath(c, rootName, collections));
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
      n.children.sort((a, b) => (b.coll.created_at || 0) - (a.coll.created_at || 0));
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
    // Position the nodes inside the tree derivation. Doing this here
    // (instead of via a separate $effect that mutates n.x / n.y on
    // plain objects) is essential: Svelte 5 only re-renders the SVG
    // {#each flat} block when the array reference itself changes.
    // Plain-property mutations on $derived array elements are not
    // tracked, so previously the positions were correct in memory
    // but the template kept showing the initial 0,0 values until
    // some unrelated reactive change forced an each-block re-render
    // (e.g. toggling displayMode swaps an {#if} branch). Reading
    // liveOffsetX / liveYShift / ROW_H here makes them dependencies
    // of `tree`, so changes flow through to the template.
    for (const n of flat) {
      n.x = liveOffsetX + n.depth * COL_W;
      n.y = PAD_T + liveYShift + n.rowIndex * ROW_H + ROW_H / 2;
    }
    return { flat, maxDepth, rootNode };
  });

  let flat = $derived(tree.flat);
  let maxDepth = $derived(tree.maxDepth);
  let rootNode = $derived(tree.rootNode);

  let ghostGens = $derived.by(() => {
    const groups = new Map<string, PathCollection[]>();
    for (const c of collections) {
      if (!isGhostPath(c, rootName, collections)) continue;
      const era = c.parent || c.name;
      const arr = groups.get(era) ?? [];
      arr.push(c);
      groups.set(era, arr);
    }
    const eras = [...groups.entries()].map(([era, gens]) => {
      const sorted = gens.slice().sort((a, b) => {
        if (a.name === era) return -1;
        if (b.name === era) return 1;
        return (b.created_at || 0) - (a.created_at || 0);
      });
      const mostRecent = Math.max(...sorted.map((c) => c.created_at || 0));
      return { era, collections: sorted, mostRecent };
    });
    eras.sort((a, b) => b.mostRecent - a.mostRecent);
    return eras;
  });

  let liveOffsetX = $derived(PAD_L + ghostGens.length * GHOST_COL_W);

  let maxPeersAbove = $derived.by(() => {
    let m = 0;
    for (const g of ghostGens) {
      const peers = Math.max(0, g.collections.length - 1);
      const above = Math.ceil(peers / 2);
      if (above > m) m = above;
    }
    return m;
  });
  let liveYShift = $derived(maxPeersAbove * ROW_H);

  let ghostPositions = $derived.by(() => {
    const m = new Map<string, { x: number; y: number; coll: PathCollection; isAnchor: boolean; eraIndex: number }>();
    if (!rootNode) return m;
    ghostGens.forEach((g, idx) => {
      const colX = liveOffsetX - (idx + 1) * GHOST_COL_W;
      const anchorY = rootNode!.y;
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
  });

  let ghostYRange = $derived.by(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of ghostPositions.values()) {
      if (p.y < min) min = p.y;
      if (p.y > max) max = p.y;
    }
    return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 };
  });

  let width = $derived(
    Math.max(PAD_L + (maxDepth + 1) * COL_W + PAD_R + ghostGens.length * GHOST_COL_W, 800),
  );
  let height = $derived(
    Math.max(
      PAD_T + PAD_B + 260,
      PAD_T + liveYShift + flat.length * ROW_H + PAD_B + (pendingForkParent ? ROW_H : 0),
      ghostYRange.max + PAD_B + 80,
    ),
  );

  let byName = $derived.by(() => {
    const m = new Map<string, Node>();
    for (const n of flat) m.set(n.coll.name, n);
    return m;
  });

  let highlight = $derived.by(() => {
    const s = new Set<string>();
    const name = hovered || selectedPath;
    if (!name) return s;
    const node = byName.get(name);
    if (!node) return s;
    let cur: Node | null = node;
    while (cur) {
      s.add(cur.coll.name);
      cur = cur.parent;
    }
    const walk = (n: Node) => {
      s.add(n.coll.name);
      for (const c of n.children) walk(c);
    };
    walk(node);
    return s;
  });

  let hasActive = $derived(highlight.size > 0);

  function strokeFor(n: Node): number {
    const count = n.coll.members.length;
    return 2 + Math.min(8, Math.sqrt(count) * 2);
  }
  function colorFor(n: Node): string {
    if (n.coll.color) return n.coll.color;
    if (n.coll.name === rootName) return "var(--yel)";
    let h = 0;
    for (let i = 0; i < n.coll.name.length; i++) h = (h * 31 + n.coll.name.charCodeAt(i)) >>> 0;
    const hue = 280 + (h % 70);
    return `hsl(${hue} 26% 62%)`;
  }
  function ribbonPath(x1: number, y1: number, x2: number, y2: number, w1: number, w2: number): string {
    const mx = (x1 + x2) / 2;
    return [
      `M ${x1} ${y1 - w1 / 2}`,
      `C ${mx} ${y1 - w1 / 2}, ${mx} ${y2 - w2 / 2}, ${x2} ${y2 - w2 / 2}`,
      `L ${x2} ${y2 + w2 / 2}`,
      `C ${mx} ${y2 + w2 / 2}, ${mx} ${y1 + w1 / 2}, ${x1} ${y1 + w1 / 2}`,
      "Z",
    ].join(" ");
  }

  // ── pan / zoom ──
  let viewportRef = $state<HTMLDivElement | null>(null);
  let transformRef = $state<HTMLDivElement | null>(null);
  let zoom = $state(1);
  let pan = $state({ x: 0, y: 0 });
  let liveZoom = 1;
  let livePan = { x: 0, y: 0 };
  function applyTransform() {
    const el = transformRef;
    if (!el) return;
    el.style.transform = `translate(${livePan.x}px, ${livePan.y}px) scale(${liveZoom})`;
  }
  $effect(() => {
    livePan = pan;
    liveZoom = zoom;
    applyTransform();
  });

  let panState: null | { x0: number; y0: number; px: number; py: number } = null;

  // Track viewport size via ResizeObserver. Reading `clientWidth` /
  // `clientHeight` directly inside the centering effect is racy: on
  // first paint the modal hasn't laid out yet and reads zero, which
  // poisons the fit-to-content math. Reactive scalars (rather than a
  // `$state` object) so Svelte's fine-grained tracking sees every
  // mutation reliably.
  let vpW = $state(0);
  let vpH = $state(0);
  $effect(() => {
    const el = viewportRef;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      vpW = rect.width;
      vpH = rect.height;
    };
    measure();
    // Belt-and-suspenders: getBoundingClientRect immediately after
    // mount can return 0 in Tauri's webkit2gtk before the modal's
    // flex chain has resolved its first layout pass. Schedule one
    // rAF retry so the auto-fit effect picks up real dimensions on
    // the next paint.
    requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  // Card geometry in canvas coords: destinationCard renders a 260×84 rect
  // at (n.x + 22, n.y - 40), so each node's bounding box is:
  //   left: n.x + 22, right: n.x + 282, top: n.y - 40, bottom: n.y + 44.
  // Ghost positions use the same offset; their cards render at
  //   (g.x + 22, g.y - 40). Returns null if no positioned content.
  function contentBounds(): { l: number; r: number; t: number; b: number } | null {
    if (!rootNode) return null;
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    let any = false;
    for (const n of flat) {
      // Skip nodes whose positions haven't been computed yet (the
      // position-apply effect runs separately; on the first frame
      // n.x/n.y may still be the initial 0).
      if (n.x === 0 && n.y === 0 && n !== rootNode) continue;
      const nl = n.x + 22, nr = n.x + 22 + CARD_W;
      const nt = n.y - 40, nb = n.y + 44;
      if (nl < l) l = nl;
      if (nr > r) r = nr;
      if (nt < t) t = nt;
      if (nb > b) b = nb;
      any = true;
    }
    for (const g of ghostPositions.values()) {
      const gl = g.x + 22, gr = g.x + 22 + CARD_W;
      const gt = g.y - 40, gb = g.y + 44;
      if (gl < l) l = gl;
      if (gr > r) r = gr;
      if (gt < t) t = gt;
      if (gb > b) b = gb;
      any = true;
    }
    if (!any) return null;
    return { l, r, t, b };
  }

  // Pan + zoom so the full content bounding box sits inside the viewport
  // with breathing room. Caps zoom at 1 so a tiny single-card graph
  // doesn't balloon to fill the viewport — instead it sits at native
  // size, centered.
  function fitToContent(): boolean {
    if (vpW <= 0 || vpH <= 0) return false;
    const box = contentBounds();
    if (!box) return false;
    const padX = 80;
    const padY = 60;
    const cw = box.r - box.l + padX * 2;
    const ch = box.b - box.t + padY * 2;
    const z = Math.max(0.4, Math.min(1, Math.min(vpW / cw, vpH / ch)));
    const cxContent = (box.l + box.r) / 2;
    const cyContent = (box.t + box.b) / 2;
    zoom = z;
    pan = {
      x: vpW / 2 - cxContent * z,
      y: vpH / 2 - cyContent * z,
    };
    return true;
  }

  // Auto-fit while the user hasn't taken control. As soon as they
  // wheel-zoom, drag-pan, or hit an arrow / +/- key, this flips and
  // we stop overriding their view. The Fit button still calls
  // fitToContent() directly (and resets the flag) so they can recover.
  let userInteracted = $state(false);

  // Re-fit whenever the viewport or the laid-out tree changes, until
  // the user takes control. Positions are now baked into the `tree`
  // derivation (see comment there), so reading `flat` here is enough
  // to react to repositioned nodes — no rAF retry needed.
  $effect(() => {
    void vpW; void vpH;
    void rootNode;
    void flat;
    void displayMode;
    void liveOffsetX; void liveYShift;
    if (userInteracted) return;
    fitToContent();
  });

  let rafHandle: number | null = null;
  function scheduleApply() {
    if (rafHandle !== null) return;
    rafHandle = requestAnimationFrame(() => {
      rafHandle = null;
      applyTransform();
    });
  }
  $effect(() => () => {
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
  });

  let wheelSyncTimer: number | null = null;
  function onWheel(e: WheelEvent) {
    const el = viewportRef;
    if (!el) return;
    e.preventDefault();
    userInteracted = true;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    const z = liveZoom;
    const p = livePan;
    const nextZoom = Math.max(0.4, Math.min(2.5, z * (1 + delta)));
    if (nextZoom === z) return;
    const wx = (mx - p.x) / z;
    const wy = (my - p.y) / z;
    liveZoom = nextZoom;
    livePan = { x: mx - wx * nextZoom, y: my - wy * nextZoom };
    scheduleApply();
    if (wheelSyncTimer) window.clearTimeout(wheelSyncTimer);
    wheelSyncTimer = window.setTimeout(() => {
      zoom = liveZoom;
      pan = livePan;
    }, 120);
  }
  $effect(() => () => {
    if (wheelSyncTimer) window.clearTimeout(wheelSyncTimer);
  });

  function onPanStart(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-road-interactive]")) return;
    panState = { x0: e.clientX, y0: e.clientY, px: livePan.x, py: livePan.y };
    (e.currentTarget as HTMLElement).style.cursor = "grabbing";
  }
  function onPanMove(e: MouseEvent) {
    const s = panState;
    if (!s) return;
    userInteracted = true;
    livePan = { x: s.px + (e.clientX - s.x0), y: s.py + (e.clientY - s.y0) };
    scheduleApply();
  }
  function onPanEnd(e: MouseEvent) {
    if (panState) {
      panState = null;
      (e.currentTarget as HTMLElement).style.cursor = "";
      pan = livePan;
    }
  }

  function resetView() {
    // Reset the interaction flag so subsequent viewport changes
    // (modal resize, content add/remove) auto-refit again until
    // the next user pan/zoom.
    userInteracted = false;
    fitToContent();
  }

  let clickStartedAt: { x: number; y: number } | null = null;
  function onCanvasMouseDown(e: MouseEvent) {
    clickStartedAt = { x: e.clientX, y: e.clientY };
    onPanStart(e);
  }
  function onCanvasClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-road-interactive]")) return;
    const s = clickStartedAt;
    if (s && (Math.abs(e.clientX - s.x) > 3 || Math.abs(e.clientY - s.y) > 3)) return;
    onSelect(null);
  }

  $effect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (target && target.isContentEditable);
      if (editable) return;
      if (ev.key === "Escape") onSelect(null);
      if (ev.key === "0" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        resetView();
      }
      if (ev.key === "+" || ev.key === "=") {
        ev.preventDefault();
        userInteracted = true;
        zoom = Math.min(2.5, zoom * 1.15);
      }
      if (ev.key === "-" || ev.key === "_") {
        ev.preventDefault();
        userInteracted = true;
        zoom = Math.max(0.4, zoom / 1.15);
      }
      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        userInteracted = true;
        pan = { x: pan.x + 60, y: pan.y };
      }
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        userInteracted = true;
        pan = { x: pan.x - 60, y: pan.y };
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        userInteracted = true;
        pan = { x: pan.x, y: pan.y + 60 };
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        userInteracted = true;
        pan = { x: pan.x, y: pan.y - 60 };
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let archivedNames = $derived(
    new Set(collections.filter((c) => c.archived).map((c) => c.name)),
  );

  let dimByName = $derived.by(() => {
    const m = new Map<string, number>();
    for (const c of collections) {
      let v = 1;
      if (hasActive && !highlight.has(c.name)) v = 0.22;
      else if (archivedNames.has(c.name)) v = 0.45;
      m.set(c.name, v);
    }
    return m;
  });
  function dimFor(name: string): number {
    return dimByName.get(name) ?? 1;
  }

  // ── pendingForkStub local input state ──
  let pendingValue = $state("");
  let pendingInputRef = $state<HTMLInputElement | null>(null);
  $effect(() => {
    if (pendingForkParent) {
      pendingValue = "";
      const tid = window.setTimeout(() => pendingInputRef?.focus(), 40);
      return () => window.clearTimeout(tid);
    }
  });

  function gainedTooltipKey(g: number): "paths.road.gainedTooltipOne" | "paths.road.gainedTooltipMany" {
    return g === 1 ? "paths.road.gainedTooltipOne" : "paths.road.gainedTooltipMany";
  }
  function lostTooltipKey(l: number): "paths.road.lostTooltipOne" | "paths.road.lostTooltipMany" {
    return l === 1 ? "paths.road.lostTooltipOne" : "paths.road.lostTooltipMany";
  }
</script>

{#snippet signpost(condition: string, sx: number, sy: number, onSignClick: () => void, emphasize: boolean)}
  {@const label = condition || t("paths.road.signpostName")}
  {@const maxChars = 38}
  {@const display = label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label}
  {@const textW = Math.max(80, display.length * 6.2 + 20)}
  {@const named = !!condition}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <g
    onclick={(e) => {
      e.stopPropagation();
      onSignClick();
    }}
    style:cursor="pointer"
    data-road-interactive
  >
    <rect
      x={sx - textW / 2}
      y={sy - 12}
      width={textW}
      height={22}
      rx={11}
      fill="var(--bg-soft)"
      stroke={named ? "var(--yel)" : "var(--bd2)"}
      stroke-width={emphasize ? 1.6 : 1}
      stroke-dasharray={named ? undefined : "3 3"}
    />
    <text
      x={sx}
      y={sy + 3}
      text-anchor="middle"
      class="serif"
      font-style={named ? "italic" : "normal"}
      style:font-size="12px"
      style:fill={named ? "var(--yeld)" : "var(--t3)"}
      style:pointer-events="none"
    >
      {display}
    </text>
  </g>
{/snippet}

{#snippet destinationCard(name: string, condition: string, mainNoteTitle: string | null, isRoot: boolean, isSelected: boolean, isCurrent: boolean, isDropTarget: boolean, memberCount: number, diffFromCurrent: { gained: number; lost: number } | undefined, createdAt: number, cx: number, cy: number, cwidth: number)}
  {@const h = 84}
  {@const stroke = isDropTarget
    ? "var(--yel)"
    : isRoot
    ? "var(--yel)"
    : isSelected
    ? "var(--yel2)"
    : "var(--bd)"}
  {@const sw = isDropTarget ? 2.5 : isRoot ? 2 : isSelected ? 1.6 : 1}
  {@const bg = isDropTarget ? "var(--yelp)" : isSelected ? "var(--yelp)" : "var(--bg-soft)"}
  <g>
    <rect x={cx} y={cy} width={cwidth} height={h} rx={8} fill={bg} stroke={stroke} stroke-width={sw} />
    <text
      x={cx + 14}
      y={cy + 22}
      class="serif"
      style:font-size="15px"
      style:fill="var(--char)"
      style:font-weight={isRoot ? "600" : "500"}
    >
      {name}
    </text>
    {#if condition}
      <text
        x={cx + 14}
        y={cy + 40}
        class="serif"
        style:font-size="11px"
        style:fill="var(--yeld)"
        style:font-style="italic"
      >
        {condition.length > 36 ? condition.slice(0, 35) + "…" : condition}
      </text>
    {/if}
    {#if mainNoteTitle}
      <text x={cx + 14} y={cy + 58} class="mono" style:font-size="10px" style:fill="var(--t2)">
        ★ {mainNoteTitle.length > 32 ? mainNoteTitle.slice(0, 31) + "…" : mainNoteTitle}
      </text>
    {/if}
    <text x={cx + 14} y={cy + h - 10} class="mono" style:font-size="10px" style:fill="var(--t3)">
      {memberCount === 1
        ? t("paths.road.cardCreated", { count: String(memberCount), when: relativeTime(createdAt) })
        : t("paths.road.cardCreatedPlural", { count: String(memberCount), when: relativeTime(createdAt) })}
    </text>
    {#if isRoot}
      <text
        x={cx + cwidth - 14}
        y={cy + 22}
        text-anchor="end"
        class="mono"
        style:font-size="9px"
        style:fill="var(--yeld)"
        style:letter-spacing="0.18em"
      >
        {t("paths.road.cardMain")}
      </text>
    {/if}
    {#if isCurrent}
      <text
        x={cx + cwidth - 14}
        y={cy + h - 10}
        text-anchor="end"
        class="mono"
        style:font-size="9px"
        style:fill="var(--yeld)"
        style:letter-spacing="0.18em"
      >
        {t("paths.road.cardYouAreHere")}
      </text>
    {/if}
    {#if diffFromCurrent && !isCurrent && (diffFromCurrent.gained > 0 || diffFromCurrent.lost > 0)}
      <g>
        <title>
          {t("paths.road.diffTooltip", {
            name,
            gained: String(diffFromCurrent.gained),
            gainedNoteWord: diffFromCurrent.gained === 1
              ? t("paths.road.diffNoteWord")
              : t("paths.road.diffNoteWordPlural"),
            lost: String(diffFromCurrent.lost),
          })}
        </title>
        <rect
          x={cx + cwidth - 78}
          y={cy + h - 22}
          width={64}
          height={16}
          rx={8}
          fill="var(--bg)"
          stroke="var(--bd)"
        />
        {#if diffFromCurrent.gained > 0}
          <g>
            <title>
              {t(gainedTooltipKey(diffFromCurrent.gained), { count: String(diffFromCurrent.gained) })}
            </title>
            <text
              x={cx + cwidth - 70}
              y={cy + h - 10}
              class="mono"
              style:font-size="10px"
              style:fill="var(--yeld)"
              style:font-weight="600"
            >
              +{diffFromCurrent.gained}
            </text>
          </g>
        {/if}
        {#if diffFromCurrent.lost > 0}
          <g>
            <title>
              {t(lostTooltipKey(diffFromCurrent.lost), { count: String(diffFromCurrent.lost) })}
            </title>
            <text
              x={cx + cwidth - 18}
              y={cy + h - 10}
              text-anchor="end"
              class="mono"
              style:font-size="10px"
              style:fill="var(--danger)"
              style:font-weight="600"
            >
              −{diffFromCurrent.lost}
            </text>
          </g>
        {/if}
      </g>
    {/if}
  </g>
{/snippet}

{#snippet destinationRibbon(name: string, condition: string, color: string, isRoot: boolean, isSelected: boolean, isCurrent: boolean, isDropTarget: boolean, memberCount: number, rx: number, ry: number)}
  {@const nameW = Math.min(180, Math.max(80, name.length * 7 + 26))}
  {@const w = nameW + 38}
  {@const h = 28}
  {@const stroke = isDropTarget
    ? "var(--yel)"
    : isSelected
    ? "var(--yel2)"
    : isRoot
    ? "var(--yel)"
    : color}
  {@const sw = isDropTarget ? 2.2 : isSelected || isRoot ? 1.6 : 1}
  {@const bg = isDropTarget ? "var(--yelp)" : isSelected ? "var(--yelp)" : "var(--bg-soft)"}
  <g>
    <rect
      x={rx}
      y={ry}
      width={w}
      height={h}
      rx={h / 2}
      fill={bg}
      stroke={stroke}
      stroke-width={sw}
      fill-opacity={isSelected || isDropTarget ? 1 : 0.85}
    />
    <circle cx={rx + 13} cy={ry + h / 2} r={4} fill={color} />
    <text
      x={rx + 24}
      y={ry + 19}
      class="serif"
      style:font-size="13.5px"
      style:fill={isSelected || isDropTarget ? "var(--yeld)" : "var(--char)"}
      style:font-weight={isRoot ? "600" : "500"}
    >
      {name.length > 24 ? name.slice(0, 23) + "…" : name}
    </text>
    <text x={rx + w - 10} y={ry + 18} text-anchor="end" class="mono" style:font-size="10px" style:fill="var(--t3)">
      {memberCount}
    </text>
    {#if isCurrent}
      <circle cx={rx + w + 8} cy={ry + h / 2} r={3} fill="var(--yeld)">
        <title>{t("paths.road.youAreHereTooltip")}</title>
      </circle>
    {/if}
    {#if condition}
      <text
        x={rx + 24}
        y={ry + h + 12}
        class="serif"
        style:font-size="10.5px"
        style:fill="var(--t2)"
        style:font-style="italic"
      >
        {condition.length > 34 ? condition.slice(0, 33) + "…" : `if ${condition.replace(/^if /i, "")}`}
      </text>
    {/if}
  </g>
{/snippet}

{#snippet ghostCard(name: string, condition: string, isAnchor: boolean, isSelected: boolean, memberCount: number, createdAt: number, gx: number, gy: number, gwidth: number)}
  {@const h = 78}
  {@const stroke = isSelected ? "var(--yel2)" : "var(--t3)"}
  {@const sw = isSelected ? 1.6 : 1}
  <g>
    <rect
      x={gx}
      y={gy}
      width={gwidth}
      height={h}
      rx={8}
      fill="var(--bg)"
      stroke={stroke}
      stroke-width={sw}
      stroke-dasharray="4 3"
    />
    <text
      x={gx + 14}
      y={gy + 22}
      class="serif"
      style:font-size="14px"
      style:fill="var(--t2)"
      style:font-weight={isAnchor ? "600" : "500"}
    >
      {name}
    </text>
    {#if condition}
      <text
        x={gx + 14}
        y={gy + 40}
        class="serif"
        style:font-size="11px"
        style:fill="var(--t3)"
        style:font-style="italic"
      >
        “{condition.length > 34 ? condition.slice(0, 33) + "…" : condition}”
      </text>
    {/if}
    <text
      x={gx + 14}
      y={gy + h - 10}
      class="mono"
      style:font-size="9px"
      style:fill="var(--t3)"
      style:letter-spacing="0.12em"
    >
      {memberCount === 1
        ? t("paths.road.cardGhostMeta", { count: String(memberCount), when: relativeTime(createdAt) })
        : t("paths.road.cardGhostMetaPlural", { count: String(memberCount), when: relativeTime(createdAt) })}
    </text>
    {#if isAnchor}
      <text
        x={gx + gwidth - 14}
        y={gy + 22}
        text-anchor="end"
        class="mono"
        style:font-size="9px"
        style:fill="var(--t3)"
        style:letter-spacing="0.18em"
      >
        {t("paths.road.cardWasMain")}
      </text>
    {/if}
  </g>
{/snippet}

{#if !rootNode}
  <div class="w-full h-full flex items-center justify-center p-10 text-t3 italic">
    {t("paths.road.loading")}
  </div>
{:else}
  {@const _rootNode = rootNode}
  {@const pendingHelpParts = t("paths.road.pendingHelp").split("{parent}")}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={viewportRef}
    class="relative w-full h-full overflow-hidden bg-bg"
    style:cursor="grab"
    style:touch-action="none"
    onwheel={onWheel}
    onmousedown={onCanvasMouseDown}
    onmousemove={onPanMove}
    onmouseup={onPanEnd}
    onmouseleave={onPanEnd}
    onclick={onCanvasClick}
  >
    <div
      class="absolute top-3 right-3 z-10 flex items-center gap-1 bg-s1/95 border border-bd rounded-md shadow-xs px-1 py-1"
      data-road-interactive
    >
      <div class="flex items-center border border-bd rounded-sm overflow-hidden mr-1">
        <button
          onclick={(e) => {
            e.stopPropagation();
            displayMode = "ink";
          }}
          class="px-2 h-6 text-2xs {displayMode === 'ink' ? 'bg-yelp text-yeld' : 'text-t2 hover:text-char hover:bg-s2'}"
          title={t("paths.road.modeInkTitle")}
        >{t("paths.road.modeInk")}</button>
        <button
          onclick={(e) => {
            e.stopPropagation();
            displayMode = "ribbon";
          }}
          class="px-2 h-6 text-2xs {displayMode === 'ribbon' ? 'bg-yelp text-yeld' : 'text-t2 hover:text-char hover:bg-s2'}"
          title={t("paths.road.modeRibbonTitle")}
        >{t("paths.road.modeRibbon")}</button>
      </div>
      <button
        onclick={(e) => {
          e.stopPropagation();
          userInteracted = true;
          zoom = Math.min(2.5, zoom * 1.15);
        }}
        class="w-7 h-7 text-t2 hover:text-char hover:bg-s2 rounded-sm flex items-center justify-center"
      >+</button>
      <button
        onclick={(e) => {
          e.stopPropagation();
          userInteracted = true;
          zoom = Math.max(0.4, zoom / 1.15);
        }}
        class="w-7 h-7 text-t2 hover:text-char hover:bg-s2 rounded-sm flex items-center justify-center"
      >−</button>
      <div class="mx-1 text-2xs font-mono text-t3 tabular-nums w-10 text-center">
        {Math.round(zoom * 100)}%
      </div>
      <button
        onclick={(e) => {
          e.stopPropagation();
          resetView();
        }}
        class="px-2 h-7 text-2xs text-t2 hover:text-char hover:bg-s2 rounded-sm"
      >{t("paths.road.fit")}</button>
    </div>

    <div
      bind:this={transformRef}
      style:transform="translate({pan.x}px, {pan.y}px) scale({zoom})"
      style:transform-origin="0 0"
      style:width="{width}px"
      style:height="{height}px"
      style:will-change="transform"
    >
      <svg width={width} height={height} viewBox="0 0 {width} {height}">
        <!-- depth gridlines -->
        {#each Array.from({ length: maxDepth + 1 }) as _, d (d)}
          <line
            x1={liveOffsetX + d * COL_W}
            x2={liveOffsetX + d * COL_W}
            y1={PAD_T - 20}
            y2={height - PAD_B + 20}
            stroke="var(--bd)"
            stroke-dasharray="2 6"
            opacity={0.35}
          />
        {/each}

        <!-- Ghost connectors -->
        {#each [...ghostPositions.values()] as g (`ghost-conn-${g.coll.name}`)}
          {@const parentName = g.coll.parent}
          {@const parentGhost = parentName ? ghostPositions.get(parentName) : null}
          {@const x2 = parentGhost
            ? parentGhost.x + 22 + CARD_W
            : !parentName || parentName === _rootNode.coll.name
            ? _rootNode.x - 14
            : _rootNode.x - 14}
          {@const y2 = parentGhost ? parentGhost.y : _rootNode.y}
          {@const x1 = g.x + 22 + CARD_W}
          {@const y1 = g.y}
          {@const cx = (x1 + x2) / 2}
          {@const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
          <path
            d={d}
            stroke="var(--t3)"
            stroke-width={2}
            stroke-dasharray="4 5"
            fill="none"
            opacity={0.45}
          />
        {/each}

        <!-- ghost cards -->
        {#each [...ghostPositions.values()] as g (`ghost-${g.coll.name}`)}
          {@const isSelected = selectedPath === g.coll.name}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            data-road-interactive
            onmouseenter={() => (hovered = g.coll.name)}
            onmouseleave={() => {
              if (hovered === g.coll.name) hovered = null;
            }}
            onclick={(e) => {
              e.stopPropagation();
              onSelect(g.coll.name === selectedPath ? null : g.coll.name);
            }}
            style:cursor="pointer"
            style:opacity={hovered === g.coll.name || isSelected ? 0.95 : 0.55}
          >
            <circle
              cx={g.x}
              cy={g.y}
              r={g.isAnchor ? 8 : 6}
              fill="var(--bg)"
              stroke="var(--t3)"
              stroke-width={1.6}
              stroke-dasharray="3 3"
            />
            {@render ghostCard(
              g.coll.name,
              g.coll.condition,
              g.isAnchor,
              isSelected,
              g.coll.members.length,
              g.coll.created_at,
              g.x + 22,
              g.y - 40,
              CARD_W,
            )}
          </g>
        {/each}

        <!-- Root anchor stub -->
        {#if ghostGens.length === 0}
          <g opacity={dimFor(_rootNode.coll.name)}>
            <line
              x1={_rootNode.x - 48}
              y1={_rootNode.y}
              x2={_rootNode.x - 14}
              y2={_rootNode.y}
              stroke={colorFor(_rootNode)}
              stroke-width={strokeFor(_rootNode)}
              stroke-linecap="round"
            />
            <circle cx={_rootNode.x - 48} cy={_rootNode.y} r={11} fill="var(--yel)" />
            <text
              x={_rootNode.x - 48}
              y={_rootNode.y - 22}
              text-anchor="middle"
              style:font-size="10px"
              style:fill="var(--yeld)"
              style:letter-spacing="0.2em"
              class="mono"
            >
              {t("paths.road.cardMain")}
            </text>
          </g>
        {/if}

        <!-- fork connectors -->
        {#each flat as n (`edge-${n.coll.name}`)}
          {#if n.parent}
            {@const p = n.parent}
            {@const color = colorFor(n)}
            {@const parentColor = colorFor(p)}
            {@const x1 = p.x + 14}
            {@const y1 = p.y}
            {@const x2 = n.x - 14}
            {@const y2 = n.y}
            {@const cx = (x1 + x2) / 2}
            {@const cubic = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
            {@const gradId = `edge-grad-${n.coll.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
            {@const w1 = strokeFor(p)}
            {@const w2 = Math.max(2, strokeFor(n) * 0.7)}
            <g opacity={dimFor(n.coll.name)}>
              {#if displayMode === "ink"}
                <path
                  d={ribbonPath(x1, y1, x2, y2, w1, w2)}
                  fill={color}
                  fill-opacity={0.55}
                  stroke={color}
                  stroke-opacity={0.9}
                  stroke-width={0.6}
                />
              {:else}
                <defs>
                  <linearGradient id={gradId} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color={parentColor} />
                    <stop offset="100%" stop-color={color} />
                  </linearGradient>
                </defs>
                <path
                  d={cubic}
                  stroke="url(#{gradId})"
                  stroke-opacity={0.9}
                  stroke-width={2}
                  fill="none"
                  stroke-linecap="round"
                />
              {/if}
              {#if !n.coll.condition}
                {@render signpost(
                  n.coll.condition,
                  cx,
                  (y1 + y2) / 2 - 8,
                  () => onEditCondition(n.coll.name, n.coll.condition),
                  highlight.has(n.coll.name),
                )}
              {/if}
            </g>
          {/if}
        {/each}

        <!-- nodes -->
        {#each flat as n (`node-${n.coll.name}`)}
          {@const isRoot = n.coll.name === rootName}
          {@const isSelected = selectedPath === n.coll.name}
          {@const color = colorFor(n)}
          {@const bx = displayMode === "ink" ? n.x + 22 + CARD_W + 10 : n.x + 178}
          {@const mainNoteTitle = n.coll.main_note ? titleFor.get(n.coll.main_note) || n.coll.main_note : null}
          <g opacity={dimFor(n.coll.name)} data-road-interactive style:transition="opacity 140ms">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <g
              onmouseenter={(e) => {
                hovered = n.coll.name;
                const r = (e.currentTarget as SVGGElement).getBoundingClientRect();
                hoverAnchor = r;
              }}
              onmouseleave={() => {
                if (hovered === n.coll.name) hovered = null;
                hoverAnchor = null;
              }}
              onclick={(e) => {
                e.stopPropagation();
                onSelect(n.coll.name === selectedPath ? null : n.coll.name);
              }}
              ondragover={(e) => {
                if (!onDropNoteOnPath) return;
                if (!e.dataTransfer || !e.dataTransfer.types.includes("application/x-yarrow-note")) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                if (dropTarget !== n.coll.name) dropTarget = n.coll.name;
              }}
              ondragleave={() => {
                if (dropTarget === n.coll.name) dropTarget = null;
              }}
              ondrop={(e) => {
                if (!onDropNoteOnPath) return;
                const slug = e.dataTransfer?.getData("application/x-yarrow-note") || "";
                dropTarget = null;
                if (!slug) return;
                e.preventDefault();
                void onDropNoteOnPath(n.coll.name, slug);
              }}
              style:cursor="pointer"
            >
              {#if displayMode === "ink"}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isRoot || isSelected ? 10 : 7}
                  fill={isRoot ? "var(--yel)" : "var(--bg)"}
                  stroke={color}
                  stroke-width={isRoot || isSelected ? 3 : 2}
                />
                {#if isRoot}
                  <circle cx={n.x} cy={n.y} r={16} fill="none" stroke="var(--yel)" stroke-opacity={0.28} stroke-width={2} />
                {/if}
                {@render destinationCard(
                  n.coll.name,
                  n.coll.condition,
                  mainNoteTitle,
                  isRoot,
                  isSelected,
                  n.coll.name === currentPathName,
                  dropTarget === n.coll.name,
                  n.coll.members.length,
                  currentPathName && n.coll.name !== currentPathName
                    ? pathDiffCounts(baselineMembers, n.coll.members)
                    : undefined,
                  n.coll.created_at,
                  n.x + 22,
                  n.y - 40,
                  CARD_W,
                )}
              {:else}
                {@render destinationRibbon(
                  n.coll.name,
                  n.coll.condition,
                  color,
                  isRoot,
                  isSelected,
                  n.coll.name === currentPathName,
                  dropTarget === n.coll.name,
                  n.coll.members.length,
                  n.x - 8,
                  n.y - 16,
                )}
              {/if}
            </g>

            {#if !pendingForkParent}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <g
                onclick={(e) => {
                  e.stopPropagation();
                  onAddFork(n.coll.name);
                }}
                style:cursor="pointer"
                data-road-interactive
              >
                <circle cx={bx} cy={n.y} r={10} fill="var(--yel)" />
                <text
                  x={bx}
                  y={n.y + 4}
                  text-anchor="middle"
                  style:font-size="13px"
                  style:fill="var(--on-yel)"
                  style:font-weight="600"
                  style:pointer-events="none"
                >+</text>
              </g>
            {/if}
          </g>
        {/each}

        <!-- pending fork stub -->
        {#if pendingForkParent && byName.get(pendingForkParent)}
          {@const parent = byName.get(pendingForkParent)!}
          {@const stubX = parent.x + COL_W}
          {@const stubY = PAD_T + liveYShift + flat.length * ROW_H + ROW_H / 2}
          {@const x1 = parent.x + 14}
          {@const y1 = parent.y}
          {@const x2 = stubX - 14}
          {@const y2 = stubY}
          {@const cx = (x1 + x2) / 2}
          {@const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
          <g class="animate-fadeIn" data-road-interactive>
            <path
              d={d}
              stroke="var(--yel)"
              stroke-width={3}
              stroke-dasharray="4 4"
              fill="none"
              stroke-linecap="round"
              opacity={0.75}
            />
            <circle cx={stubX} cy={stubY} r={8} fill="var(--bg)" stroke="var(--yel)" stroke-width={2.2} />
            <foreignObject x={stubX + 16} y={stubY - 28} width={380} height={64}>
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                class="flex flex-col gap-1"
                onmousedown={(e) => e.stopPropagation()}
              >
                <input
                  bind:this={pendingInputRef}
                  bind:value={pendingValue}
                  onkeydown={(e) => {
                    if (e.key === "Enter" && !e.isComposing) {
                      e.preventDefault();
                      onCommitPendingFork(pendingValue);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      onCancelPendingFork();
                    }
                  }}
                  placeholder={t("paths.road.pendingPlaceholder")}
                  class="w-full px-3 py-1.5 bg-bg border border-yel rounded-md text-char text-sm font-serif italic placeholder:not-italic placeholder:text-t3/70 shadow-md outline-hidden"
                />
                <div class="text-2xs text-t3 italic pl-1">
                  {pendingHelpParts[0]}<span class="text-t2">{parent.coll.name}</span>{pendingHelpParts[1] ?? ""}
                </div>
              </div>
            </foreignObject>
          </g>
        {/if}
      </svg>
    </div>

    {#if hovered && hoverAnchor && !selectedPath}
      {@const coll = collections.find((c) => c.name === hovered)}
      {#if coll}
        {@const baseline = baselineMembers ? new Set(baselineMembers) : null}
        {@const candidate = new Set(coll.members)}
        {@const gained = baseline ? coll.members.filter((s) => !baseline.has(s)) : []}
        {@const lost = baselineMembers ? baselineMembers.filter((s) => !candidate.has(s)) : []}
        {@const W = 280}
        {@const right = hoverAnchor.right + 12 + W <= window.innerWidth}
        {@const popLeft = right
          ? hoverAnchor.right + 12
          : Math.max(8, hoverAnchor.left - W - 12)}
        {@const popTop = Math.max(
          8,
          Math.min(window.innerHeight - 8 - 280, hoverAnchor.top + hoverAnchor.height / 2 - 100),
        )}
        {@const isCurrent = hovered === currentPathName}
        <div
          class="fixed z-50 pointer-events-none w-[280px] bg-bg border border-bd2 rounded-lg shadow-2xl p-3 animate-fadeIn"
          style:left="{popLeft}px"
          style:top="{popTop}px"
        >
          <div class="text-2xs font-mono uppercase tracking-wider text-t3 mb-1">
            {isCurrent ? t("paths.road.popoverCurrent") : t("paths.road.popoverPreview")}
          </div>
          <div class="font-serif text-base text-char truncate" title={coll.name}>
            {coll.name}
          </div>
          {#if coll.condition}
            <div class="text-2xs text-yeld italic mt-0.5 truncate" title={coll.condition}>
              "{coll.condition}"
            </div>
          {/if}
          <div class="text-2xs text-t3 mt-1">
            {coll.members.length === 1
              ? t("paths.road.popoverNote", { count: String(coll.members.length) })
              : t("paths.road.popoverNotePlural", { count: String(coll.members.length) })}
          </div>

          {#if !isCurrent && currentPathName && (gained.length > 0 || lost.length > 0)}
            <div class="mt-2 pt-2 border-t border-bd flex items-center gap-3 text-2xs font-mono">
              {#if gained.length > 0}
                <span class="text-yeld">{t("paths.road.popoverGained", { count: String(gained.length) })}</span>
              {/if}
              {#if lost.length > 0}
                <span class="text-danger">{t("paths.road.popoverLost", { count: String(lost.length) })}</span>
              {/if}
            </div>
          {/if}

          <div class="mt-2 pt-2 border-t border-bd">
            <div class="text-2xs font-mono uppercase tracking-wider text-t3 mb-1">
              {t("paths.road.popoverInPath")}
            </div>
            <ul class="text-xs text-char space-y-0.5 max-h-40 overflow-hidden">
              {#each coll.members.slice(0, 7) as slug (slug)}
                <li class="truncate">
                  {#if coll.main_note === slug}
                    <span class="text-yeld mr-1">★</span>
                  {/if}
                  {titleFor.get(slug) ?? slug}
                </li>
              {/each}
              {#if coll.members.length > 7}
                <li class="text-2xs italic text-t3">
                  {t("paths.road.popoverMore", { count: String(coll.members.length - 7) })}
                </li>
              {/if}
            </ul>
          </div>
          <div class="mt-2 text-2xs italic text-t3">{t("paths.road.popoverHint")}</div>
        </div>
      {/if}
    {/if}
  </div>
{/if}
