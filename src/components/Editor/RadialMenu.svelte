<script lang="ts">
  import { tick } from "svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import { fireCenterAction } from "./center/actions";
  import { readGestureBinding } from "../../lib/gesturePrefs.svelte";
  import RadialIcon from "./RadialIcon.svelte";
  import type { RadialMenuItem } from "./radialItems";

  interface Props {
    open: boolean;
    x: number;
    y: number;
    items: RadialMenuItem[];
    onClose: () => void;
  }

  let { open, x, y, items, onClose }: Props = $props();
  let t = $derived(tr());

  const OUTER = 134;
  const INNER = 46;
  const LABEL_RADIUS = (OUTER + INNER) / 2;
  const SVG_SIZE = 284;
  const LONG_PRESS_MS = 380;
  const DOUBLE_CLICK_MS = 280;

  let hoverIdx = $state<number | null>(null);
  let pressing = $state(false);
  let wrapperRef = $state<HTMLDivElement | null>(null);
  let svgRef = $state<SVGSVGElement | null>(null);

  let longPressFired = false;
  let longPressTimer: number | null = null;
  let singleClickTimer: number | null = null;
  let lastClickAt = 0;

  $effect(() => {
    if (!open || !wrapperRef) return;
    const el = wrapperRef;
    el.style.transform = "translate(-50%, -50%)";
    let raf = 0;
    tick().then(() => {
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const centreX = rect.left + rect.width / 2;
        const centreY = rect.top + rect.height / 2;
        const dx = Math.round(x - centreX);
        const dy = Math.round(y - centreY);
        el.style.transform =
          `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      });
    });
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  });

  $effect(() => {
    void open;
    void x;
    void y;
    hoverIdx = null;
  });

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter" && hoverIdx != null) {
        e.preventDefault();
        const it = items[hoverIdx];
        if (it && !it.disabled) it.onSelect?.();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const base = hoverIdx == null ? -1 : hoverIdx;
        const delta = e.shiftKey ? -1 : 1;
        hoverIdx = (base + delta + items.length) % items.length;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  $effect(() => {
    if (!pressing) return;
    const onUp = () => {
      pressing = false;
      if (longPressTimer != null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (longPressFired) {
        longPressFired = false;
        return;
      }
      if (hoverIdx != null) {
        const it = items[hoverIdx];
        if (it && !it.disabled) {
          it.onSelect?.();
          return;
        }
      }
      const now = Date.now();
      const sinceLast = now - lastClickAt;
      if (sinceLast < DOUBLE_CLICK_MS && singleClickTimer != null) {
        window.clearTimeout(singleClickTimer);
        singleClickTimer = null;
        lastClickAt = 0;
        fireCenterAction(readGestureBinding("doubleTap"));
        onClose();
        return;
      }
      lastClickAt = now;
      singleClickTimer = window.setTimeout(() => {
        singleClickTimer = null;
        lastClickAt = 0;
        fireCenterAction(readGestureBinding("tap"));
        onClose();
      }, DOUBLE_CLICK_MS);
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  });

  $effect(() => {
    if (!open || !svgRef) return;
    const el = svgRef;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 1 : -1;
      const n = items.length;
      if (n === 0) return;
      const base = hoverIdx == null ? -1 : hoverIdx;
      hoverIdx = (base + delta + n) % n;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  $effect(() => {
    if (open) return;
    if (longPressTimer != null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (singleClickTimer != null) {
      window.clearTimeout(singleClickTimer);
      singleClickTimer = null;
    }
    pressing = false;
    longPressFired = false;
    lastClickAt = 0;
  });

  let half = SVG_SIZE / 2;

  let clampedX = $derived(Math.min(Math.max(4, x), window.innerWidth - 4));
  let clampedY = $derived(Math.min(Math.max(4, y), window.innerHeight - 4));

  let wedges = $derived.by(() => {
    const N = items.length;
    if (N === 0) return [];
    const startAng = -Math.PI / 2 - Math.PI / N;
    const step = (2 * Math.PI) / N;
    const largeArc = step > Math.PI ? 1 : 0;
    return items.map((it, i) => {
      const a0 = startAng + i * step;
      const a1 = a0 + step;
      const am = (a0 + a1) / 2;
      const x0o = half + OUTER * Math.cos(a0);
      const y0o = half + OUTER * Math.sin(a0);
      const x1o = half + OUTER * Math.cos(a1);
      const y1o = half + OUTER * Math.sin(a1);
      const x0i = half + INNER * Math.cos(a0);
      const y0i = half + INNER * Math.sin(a0);
      const x1i = half + INNER * Math.cos(a1);
      const y1i = half + INNER * Math.sin(a1);
      const d = [
        `M ${x0i} ${y0i}`,
        `L ${x0o} ${y0o}`,
        `A ${OUTER} ${OUTER} 0 ${largeArc} 1 ${x1o} ${y1o}`,
        `L ${x1i} ${y1i}`,
        `A ${INNER} ${INNER} 0 ${largeArc} 0 ${x0i} ${y0i}`,
        "Z",
      ].join(" ");
      const lx = half + LABEL_RADIUS * Math.cos(am);
      const ly = half + LABEL_RADIUS * Math.sin(am);
      return { d, lx, ly, item: it, idx: i };
    });
  });

  function onCenterMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    longPressFired = false;
    pressing = true;
    if (longPressTimer != null) window.clearTimeout(longPressTimer);
    longPressTimer = window.setTimeout(() => {
      longPressFired = true;
      pressing = false;
      longPressTimer = null;
      if (singleClickTimer != null) {
        window.clearTimeout(singleClickTimer);
        singleClickTimer = null;
        lastClickAt = 0;
      }
      fireCenterAction(readGestureBinding("longPress"));
      onClose();
    }, LONG_PRESS_MS);
  }

  const STILL_GHOST = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ];
  const STILL_MAIN = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0], [0,  0], [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ];
</script>

{#if open}
  <div
    class="fixed inset-0 z-200"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
    oncontextmenu={(e) => {
      e.preventDefault();
      onClose();
    }}
    role="presentation"
  >
    <div
      bind:this={wrapperRef}
      class="radial-menu-wrapper absolute"
      style:left="{clampedX}px"
      style:top="{clampedY}px"
      style:width="{SVG_SIZE}px"
      style:height="{SVG_SIZE}px"
      style:transform="translate(-50%, -50%)"
      style:transform-origin="center center"
      onmousedown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <svg
        bind:this={svgRef}
        width={SVG_SIZE}
        height={SVG_SIZE}
        class="radial-menu animate-radialIn"
      >
        {#each wedges as w (w.item.id)}
          {@const selected = hoverIdx === w.idx}
          {@const dis = !!w.item.disabled}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g
            class="radial-wedge {selected ? 'is-selected' : ''} {dis ? 'is-disabled' : ''}"
            onmouseenter={() => { if (!dis) hoverIdx = w.idx; }}
            onmouseleave={() => { if (hoverIdx === w.idx) hoverIdx = null; }}
            onclick={() => { if (!dis) w.item.onSelect?.(); }}
            role="menuitem"
            tabindex="-1"
          >
            <path d={w.d} />
            <foreignObject
              x={w.lx - 58}
              y={w.ly - 36}
              width={116}
              height={72}
              pointer-events="none"
            >
              <div class="radial-label">
                <div class="radial-icon"><RadialIcon id={w.item.icon} /></div>
                <div class="radial-text">{w.item.label}</div>
                {#if w.item.sublabel}
                  <div class="radial-sub">{w.item.sublabel}</div>
                {/if}
              </div>
            </foreignObject>
          </g>
        {/each}

        <g class={pressing ? "radial-center-pressing" : ""}>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <circle
            cx={half}
            cy={half}
            r={INNER - 3}
            class="radial-center"
            onmousedown={onCenterMouseDown}
            oncontextmenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          />
          <circle
            cx={half}
            cy={half}
            r={INNER - 3}
            class="radial-center-fill"
            transform="rotate(-90 {half} {half})"
            pointer-events="none"
          />
          <title>{t("editor.radial.stillPointTitle")}</title>
          <g class="radial-still-point" pointer-events="none">
            {#each STILL_GHOST as [dx, dy]}
              <circle cx={half + dx * 4} cy={half + dy * 4} r={0.55} class="radial-still-ghost" />
            {/each}
            {#each STILL_MAIN as [dx, dy]}
              {@const isCore = dx === 0 && dy === 0}
              <circle cx={half + dx * 8} cy={half + dy * 8} r={isCore ? 2.4 : 1.3} class={isCore ? "radial-still-dot" : "radial-still-muted"} />
            {/each}
          </g>
        </g>
      </svg>
    </div>
  </div>
{/if}
