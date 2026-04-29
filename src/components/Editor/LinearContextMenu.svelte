<script lang="ts">
  import { onDestroy } from "svelte";
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

  const WIDTH = 240;
  const ROW_H = 30;
  const SUBMENU_OPEN_DELAY = 180;

  let hoverIdx = $state<number | null>(null);
  let openSubIdx = $state<number | null>(null);
  let subHoverIdx = $state<number | null>(null);
  let parentRect = $state<DOMRect | null>(null);
  let rowRefs: (HTMLButtonElement | null)[] = [];
  let openSubTimer: number | null = null;

  $effect(() => {
    void open;
    void x;
    void y;
    hoverIdx = null;
    openSubIdx = null;
    subHoverIdx = null;
  });

  onDestroy(() => {
    if (openSubTimer) window.clearTimeout(openSubTimer);
  });

  function scheduleSubmenuOpen(idx: number) {
    if (openSubTimer) window.clearTimeout(openSubTimer);
    openSubTimer = window.setTimeout(() => {
      const btn = rowRefs[idx];
      if (btn) parentRect = btn.getBoundingClientRect();
      openSubIdx = idx;
      subHoverIdx = null;
    }, SUBMENU_OPEN_DELAY);
  }

  function cancelSubmenuOpen() {
    if (openSubTimer) {
      window.clearTimeout(openSubTimer);
      openSubTimer = null;
    }
  }

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (openSubIdx != null) {
          openSubIdx = null;
          subHoverIdx = null;
          return;
        }
        onClose();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (openSubIdx != null && subHoverIdx != null) {
          const sub = items[openSubIdx]?.submenu;
          const it = sub?.[subHoverIdx];
          if (it && !it.disabled) it.onSelect?.();
          return;
        }
        if (hoverIdx != null) {
          const it = items[hoverIdx];
          if (it && !it.disabled) {
            if (it.submenu) {
              const btn = rowRefs[hoverIdx];
              if (btn) parentRect = btn.getBoundingClientRect();
              openSubIdx = hoverIdx;
              subHoverIdx = 0;
            } else {
              it.onSelect?.();
            }
          }
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = openSubIdx != null ? (items[openSubIdx].submenu ?? []) : items;
        const cur = openSubIdx != null ? subHoverIdx : hoverIdx;
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const base = cur == null ? (dir > 0 ? -1 : list.length) : cur;
        for (let step = 1; step <= list.length; step++) {
          const next = (base + step * dir + list.length) % list.length;
          if (!list[next].disabled) {
            if (openSubIdx != null) subHoverIdx = next;
            else hoverIdx = next;
            break;
          }
        }
        return;
      }
      if (e.key === "ArrowRight" && hoverIdx != null) {
        const it = items[hoverIdx];
        if (it?.submenu) {
          e.preventDefault();
          cancelSubmenuOpen();
          const btn = rowRefs[hoverIdx];
          if (btn) parentRect = btn.getBoundingClientRect();
          openSubIdx = hoverIdx;
          subHoverIdx = 0;
        }
        return;
      }
      if (e.key === "ArrowLeft" && openSubIdx != null) {
        e.preventDefault();
        openSubIdx = null;
        subHoverIdx = null;
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let height = $derived(items.length * ROW_H + 10);
  let clampedX = $derived(Math.min(x, window.innerWidth - WIDTH - 8));
  let clampedY = $derived(Math.min(y, window.innerHeight - height - 8));

  let submenuPos = $derived.by(() => {
    if (openSubIdx == null || !parentRect) return null;
    const sub = items[openSubIdx]?.submenu ?? [];
    const subHeight = sub.length * ROW_H + 10;
    const wantLeft = parentRect.right + 2;
    const flipLeft = wantLeft + WIDTH > window.innerWidth - 8;
    const left = flipLeft ? parentRect.left - WIDTH - 2 : wantLeft;
    let top = Math.min(parentRect.top, window.innerHeight - subHeight - 8);
    top = Math.max(8, top);
    return { left, top };
  });
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
      class="absolute bg-bg border border-bd2 rounded-md shadow-xl py-1 animate-fadeIn"
      style:left="{Math.max(8, clampedX)}px"
      style:top="{Math.max(8, clampedY)}px"
      style:width="{WIDTH}px"
      onmousedown={(e) => e.stopPropagation()}
      role="menu"
      tabindex="-1"
    >
      {#each items as it, i (it.id)}
        {@const selected = i === hoverIdx && !it.disabled}
        {@const isParent = !!it.submenu}
        {@const isOpenParent = openSubIdx === i}
        <button
          bind:this={rowRefs[i]}
          type="button"
          disabled={it.disabled}
          onmouseenter={() => {
            if (it.disabled) return;
            hoverIdx = i;
            if (isParent) {
              scheduleSubmenuOpen(i);
            } else {
              cancelSubmenuOpen();
              openSubIdx = null;
              subHoverIdx = null;
            }
          }}
          onmouseleave={() => {
            if (isParent) cancelSubmenuOpen();
          }}
          onclick={() => {
            if (it.disabled) return;
            if (isParent) {
              cancelSubmenuOpen();
              const btn = rowRefs[i];
              if (btn) parentRect = btn.getBoundingClientRect();
              openSubIdx = i;
              subHoverIdx = null;
            } else {
              it.onSelect?.();
            }
          }}
          class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors
            {selected || isOpenParent ? 'bg-yelp text-char' : 'text-ch2'}
            {it.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-s2'}
            [&_svg]:w-3.5 [&_svg]:h-3.5"
        >
          <span class="w-4 h-4 flex items-center justify-center {selected || isOpenParent ? 'text-char' : 'text-t2'}">
            <RadialIcon id={it.icon} size={14} />
          </span>
          <span class="flex-1 truncate">{it.label}</span>
          {#if isParent}
            <span class="font-mono text-[12px] text-t3 -mr-1">▸</span>
          {:else if it.sublabel}
            <span class="font-mono text-[10px] text-t3">{it.sublabel}</span>
          {/if}
        </button>
      {/each}
    </div>

    {#if openSubIdx != null && submenuPos && items[openSubIdx]?.submenu}
      <div
        class="absolute bg-bg border border-bd2 rounded-md shadow-xl py-1 animate-fadeIn"
        style:left="{submenuPos.left}px"
        style:top="{submenuPos.top}px"
        style:width="{WIDTH}px"
        onmousedown={(e) => e.stopPropagation()}
        onmouseleave={() => cancelSubmenuOpen()}
        role="menu"
        tabindex="-1"
      >
        {#each items[openSubIdx].submenu ?? [] as it, i (it.id)}
          {@const selected = i === subHoverIdx && !it.disabled}
          <button
            type="button"
            disabled={it.disabled}
            onmouseenter={() => { if (!it.disabled) subHoverIdx = i; }}
            onclick={() => { if (!it.disabled) it.onSelect?.(); }}
            class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors
              {selected ? 'bg-yelp text-char' : 'text-ch2'}
              {it.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-s2'}
              [&_svg]:w-3.5 [&_svg]:h-3.5"
          >
            <span class="w-4 h-4 flex items-center justify-center {selected ? 'text-char' : 'text-t2'}">
              <RadialIcon id={it.icon} size={14} />
            </span>
            <span class="flex-1 truncate">{it.label}</span>
            {#if it.sublabel}
              <span class="font-mono text-[10px] text-t3">{it.sublabel}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
