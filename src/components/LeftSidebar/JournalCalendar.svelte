<script lang="ts">
  import { api } from "../../lib/tauri";
  import { todayIso } from "../../lib/format";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (dateIso: string) => void;
    activeDate?: string;
    anchor?: DOMRect | null;
  }

  let { open, onClose, onPick, activeDate, anchor }: Props = $props();
  let t = $derived(tr());

  function isoOf(y: number, m: number, d: number): string {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  function parseIso(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  let dates = $state<Set<string>>(new Set());
  // svelte-ignore state_referenced_locally
  let cursor = $state<{ y: number; m: number }>(
    (() => {
      const d = activeDate ? parseIso(activeDate) : new Date();
      return { y: d.getFullYear(), m: d.getMonth() };
    })(),
  );
  let today = todayIso();

  $effect(() => {
    if (!open) return;
    api
      .listDailyDates()
      .then((ds) => (dates = new Set(ds)))
      .catch(() => {});
  });

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let grid = $derived.by(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ iso: isoOf(cursor.y, cursor.m, d), day: d });
    }
    return cells;
  });

  let monthLabel = $derived(
    new Date(cursor.y, cursor.m, 1).toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    }),
  );

  function shift(delta: number) {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    cursor = { y: d.getFullYear(), m: d.getMonth() };
  }

  let popoverStyle = $derived.by(() => {
    if (!anchor) return null;
    const CARD_W = 320;
    const CARD_H_ESTIMATE = 380;
    const GAP = 6;
    const PAD = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.left;
    if (left + CARD_W > vw - PAD) left = vw - CARD_W - PAD;
    if (left < PAD) left = PAD;
    let top = anchor.bottom + GAP;
    if (top + CARD_H_ESTIMATE > vh - PAD) {
      top = Math.max(PAD, anchor.top - CARD_H_ESTIMATE - GAP);
    }
    return { left, top, width: CARD_W };
  });
</script>

{#if open}
  <div
    class={anchor
      ? "fixed inset-0 z-50"
      : "fixed inset-0 z-50 bg-char/30 flex items-center justify-center"}
    onmousedown={onClose}
    role="presentation"
  >
    {#if popoverStyle}
      <div
        class="bg-bg border border-bd rounded-xl shadow-2xl p-4 fixed"
        style:left="{popoverStyle.left}px"
        style:top="{popoverStyle.top}px"
        style:width="{popoverStyle.width}px"
        onmousedown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        {#snippet body()}
          <div class="flex items-center mb-3">
            <button
              onclick={() => shift(-1)}
              class="w-7 h-7 rounded-sm hover:bg-s2 text-t2"
              aria-label={t("sidebar.calendar.prevMonth")}
            >‹</button>
            <div class="flex-1 text-center font-serif text-base text-char">
              {monthLabel}
            </div>
            <button
              onclick={() => shift(1)}
              class="w-7 h-7 rounded-sm hover:bg-s2 text-t2"
              aria-label={t("sidebar.calendar.nextMonth")}
            >›</button>
          </div>

          <div class="grid grid-cols-7 text-center text-2xs text-t3 font-mono mb-1">
            {#each [
              t("sidebar.calendar.dayS"),
              t("sidebar.calendar.dayM"),
              t("sidebar.calendar.dayT"),
              t("sidebar.calendar.dayW"),
              t("sidebar.calendar.dayT"),
              t("sidebar.calendar.dayF"),
              t("sidebar.calendar.dayS"),
            ] as d, i (i)}
              <div class="py-0.5">{d}</div>
            {/each}
          </div>

          <div class="grid grid-cols-7 gap-0.5">
            {#each grid as cell, i (i)}
              {#if !cell}
                <div></div>
              {:else}
                {@const has = dates.has(cell.iso)}
                {@const isToday = cell.iso === today}
                {@const isActive = cell.iso === activeDate}
                <button
                  onclick={() => {
                    onPick(cell.iso);
                    onClose();
                  }}
                  class="relative aspect-square text-xs rounded transition flex items-center justify-center {isActive
                    ? 'bg-yel text-on-yel font-medium'
                    : isToday
                      ? 'bg-yelp text-yeld'
                      : has
                        ? 'text-char hover:bg-s2'
                        : 'text-t3 hover:bg-s2'}"
                  title={cell.iso}
                >
                  <span>{cell.day}</span>
                  {#if has && !isActive}
                    <span class="absolute bottom-1 w-1 h-1 rounded-full bg-yel"></span>
                  {/if}
                </button>
              {/if}
            {/each}
          </div>

          <div class="mt-3 pt-3 border-t border-bd flex items-center justify-between text-2xs text-t3">
            <button
              onclick={() => {
                onPick(today);
                onClose();
              }}
              class="hover:text-char"
            >
              {t("sidebar.calendar.jumpToday")}
            </button>
            <span class="font-mono">{t("sidebar.calendar.entries", { count: String(dates.size) })}</span>
          </div>
        {/snippet}
        {@render body()}
      </div>
    {:else}
      <div
        class="bg-bg border border-bd rounded-xl shadow-2xl p-4 w-[320px]"
        onmousedown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        <div class="flex items-center mb-3">
          <button
            onclick={() => shift(-1)}
            class="w-7 h-7 rounded-sm hover:bg-s2 text-t2"
            aria-label={t("sidebar.calendar.prevMonth")}
          >‹</button>
          <div class="flex-1 text-center font-serif text-base text-char">
            {monthLabel}
          </div>
          <button
            onclick={() => shift(1)}
            class="w-7 h-7 rounded-sm hover:bg-s2 text-t2"
            aria-label={t("sidebar.calendar.nextMonth")}
          >›</button>
        </div>

        <div class="grid grid-cols-7 text-center text-2xs text-t3 font-mono mb-1">
          {#each [
            t("sidebar.calendar.dayS"),
            t("sidebar.calendar.dayM"),
            t("sidebar.calendar.dayT"),
            t("sidebar.calendar.dayW"),
            t("sidebar.calendar.dayT"),
            t("sidebar.calendar.dayF"),
            t("sidebar.calendar.dayS"),
          ] as d, i (i)}
            <div class="py-0.5">{d}</div>
          {/each}
        </div>

        <div class="grid grid-cols-7 gap-0.5">
          {#each grid as cell, i (i)}
            {#if !cell}
              <div></div>
            {:else}
              {@const has = dates.has(cell.iso)}
              {@const isToday = cell.iso === today}
              {@const isActive = cell.iso === activeDate}
              <button
                onclick={() => {
                  onPick(cell.iso);
                  onClose();
                }}
                class="relative aspect-square text-xs rounded transition flex items-center justify-center {isActive
                  ? 'bg-yel text-on-yel font-medium'
                  : isToday
                    ? 'bg-yelp text-yeld'
                    : has
                      ? 'text-char hover:bg-s2'
                      : 'text-t3 hover:bg-s2'}"
                title={cell.iso}
              >
                <span>{cell.day}</span>
                {#if has && !isActive}
                  <span class="absolute bottom-1 w-1 h-1 rounded-full bg-yel"></span>
                {/if}
              </button>
            {/if}
          {/each}
        </div>

        <div class="mt-3 pt-3 border-t border-bd flex items-center justify-between text-2xs text-t3">
          <button
            onclick={() => {
              onPick(today);
              onClose();
            }}
            class="hover:text-char"
          >
            {t("sidebar.calendar.jumpToday")}
          </button>
          <span class="font-mono">{t("sidebar.calendar.entries", { count: String(dates.size) })}</span>
        </div>
      </div>
    {/if}
  </div>
{/if}
