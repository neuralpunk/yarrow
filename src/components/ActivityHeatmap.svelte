<script lang="ts">
  import { api } from "../lib/tauri";
  import type { ActivityDay } from "../lib/types";
  import { tr, type StringKey } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();
  let t = $derived(tr());

  const CELL = 12;
  const GAP = 2;

  const WINDOWS: Array<{ labelKey: StringKey; days: number }> = [
    { labelKey: "modals.activity.window90", days: 90 },
    { labelKey: "modals.activity.window6Months", days: 183 },
    { labelKey: "modals.activity.window1Year", days: 365 },
  ];

  const WEEKDAY_KEYS: StringKey[] = [
    "modals.activity.weekdaySun",
    "modals.activity.weekdayMon",
    "modals.activity.weekdayTue",
    "modals.activity.weekdayWed",
    "modals.activity.weekdayThu",
    "modals.activity.weekdayFri",
    "modals.activity.weekdaySat",
  ];

  const INTENSITY_BG = [
    "var(--s2)",
    "color-mix(in srgb, var(--yeld) 25%, var(--s1))",
    "color-mix(in srgb, var(--yeld) 50%, var(--s1))",
    "color-mix(in srgb, var(--yeld) 75%, var(--s1))",
    "var(--yeld)",
  ];

  function fmtDateLong(iso: string): string {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function expand(days: number, raw: ActivityDay[]): ActivityDay[] {
    const byDate = new Map(raw.map((d) => [d.date, d.count]));
    const out: ActivityDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
      out.push({ date: iso, count: byDate.get(iso) ?? 0 });
    }
    return out;
  }

  function intensity(count: number, max: number): number {
    if (count <= 0) return 0;
    if (max <= 1) return 4;
    const frac = count / max;
    if (frac >= 0.8) return 4;
    if (frac >= 0.55) return 3;
    if (frac >= 0.3) return 2;
    return 1;
  }

  let days = $state(365);
  let data = $state<ActivityDay[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let hovered = $state<ActivityDay | null>(null);

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  $effect(() => {
    if (!open) return;
    const requestedDays = days;
    let cancelled = false;
    loading = true;
    error = null;
    api
      .writingActivity(requestedDays)
      .then((r) => {
        if (!cancelled) data = r;
      })
      .catch((e) => {
        if (!cancelled) error = String(e);
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  let expanded = $derived(expand(days, data));

  let stats = $derived.by(() => {
    const total = expanded.reduce((acc, d) => acc + d.count, 0);
    const activeDays = expanded.filter((d) => d.count > 0).length;
    const max = expanded.reduce((m, d) => Math.max(m, d.count), 0);
    let streak = 0;
    for (let i = expanded.length - 1; i >= 0; i--) {
      if (expanded[i].count > 0) streak++;
      else break;
    }
    let best = 0;
    let run = 0;
    for (const d of expanded) {
      if (d.count > 0) {
        run++;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    return { total, activeDays, max, streak, best };
  });

  let grid = $derived.by(() => {
    if (expanded.length === 0)
      return {
        weeks: [] as (ActivityDay | null)[][],
        months: [] as { col: number; label: string }[],
      };
    const firstDay = new Date(expanded[0].date + "T00:00:00");
    const firstWeekday = firstDay.getDay();
    const cells: (ActivityDay | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    cells.push(...expanded);
    const weeks: (ActivityDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    const months: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const first = week.find((c) => c !== null) ?? null;
      if (!first) return;
      const d = new Date(first.date + "T00:00:00");
      if (d.getMonth() !== lastMonth) {
        months.push({
          col,
          label: d.toLocaleDateString(undefined, { month: "short" }),
        });
        lastMonth = d.getMonth();
      }
    });
    return { weeks, months };
  });

  let allEmpty = $derived(expanded.every((d) => d.count === 0));
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
    onmousedown={onClose}
    role="presentation"
  >
    <div
      class="bg-bg border border-bd2 rounded-xl shadow-2xl w-full max-w-[880px] max-h-[90vh] flex flex-col"
      onmousedown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="flex items-baseline justify-between px-6 pt-5 pb-3 border-b border-bd">
        <div>
          <h2 class="font-serif text-2xl text-char">{t("modals.activity.title")}</h2>
          <p class="font-serif italic text-xs text-t3 mt-0.5">
            {t("modals.activity.subtitle")}
          </p>
        </div>
        <div class="flex items-center gap-1 text-xs">
          {#each WINDOWS as w (w.days)}
            <button
              onclick={() => (days = w.days)}
              class="px-2.5 py-1 rounded-md transition {days === w.days
                ? 'bg-char text-bg'
                : 'text-t2 hover:bg-s2 hover:text-char'}"
            >
              {t(w.labelKey)}
            </button>
          {/each}
        </div>
      </div>

      <div class="px-6 py-5 overflow-auto">
        {#if error}
          <div class="text-xs text-danger font-mono">{error}</div>
        {:else if loading && allEmpty}
          <div class="text-xs text-t3 font-serif italic py-8 text-center">
            {t("modals.activity.reading")}
          </div>
        {:else}
          <div class="grid grid-cols-4 gap-4 mb-5">
            <div class="bg-s1 rounded-md px-3 py-2 border border-bd">
              <div class="font-serif italic text-2xs text-t3">{t("modals.activity.checkpoints")}</div>
              <div class="font-serif text-2xl text-char leading-none mt-1">{stats.total}</div>
            </div>
            <div class="bg-s1 rounded-md px-3 py-2 border border-bd">
              <div class="font-serif italic text-2xs text-t3">{t("modals.activity.activeDays")}</div>
              <div class="font-serif text-2xl text-char leading-none mt-1">{stats.activeDays}</div>
            </div>
            <div class="bg-s1 rounded-md px-3 py-2 border border-bd">
              <div class="font-serif italic text-2xs text-t3">{t("modals.activity.currentStreak")}</div>
              <div class="font-serif text-2xl text-char leading-none mt-1">
                {stats.streak}
                <span class="font-sans text-xs text-t2 not-italic ml-1.5">
                  {stats.streak === 1 ? t("modals.activity.dayUnit") : t("modals.activity.daysUnit")}
                </span>
              </div>
            </div>
            <div class="bg-s1 rounded-md px-3 py-2 border border-bd">
              <div class="font-serif italic text-2xs text-t3">{t("modals.activity.longestStreak")}</div>
              <div class="font-serif text-2xl text-char leading-none mt-1">
                {stats.best}
                <span class="font-sans text-xs text-t2 not-italic ml-1.5">
                  {stats.best === 1 ? t("modals.activity.dayUnit") : t("modals.activity.daysUnit")}
                </span>
              </div>
            </div>
          </div>

          <div class="relative">
            <div
              class="flex text-2xs text-t3 font-mono mb-1 pl-7"
              style:gap="{GAP}px"
            >
              {#each grid.weeks as _, col}
                {@const m = grid.months.find((mm) => mm.col === col)}
                <div
                  style:width="{CELL}px"
                  style:flex-shrink="0"
                  class="text-left"
                >
                  {m ? m.label : ""}
                </div>
              {/each}
            </div>

            <div class="flex" style:gap="{GAP}px">
              <div
                class="flex flex-col text-2xs text-t3 font-mono mr-1"
                style:gap="{GAP}px"
              >
                {#each WEEKDAY_KEYS as k, i (k)}
                  <div
                    style:height="{CELL}px"
                    style:line-height="{CELL}px"
                  >
                    {i % 2 === 1 ? t(k) : ""}
                  </div>
                {/each}
              </div>
              {#each grid.weeks as week, col (col)}
                <div class="flex flex-col" style:gap="{GAP}px">
                  {#each Array.from({ length: 7 }) as _, row}
                    {@const cell = week[row] ?? null}
                    {#if !cell}
                      <div
                        style:width="{CELL}px"
                        style:height="{CELL}px"
                      ></div>
                    {:else}
                      {@const step = intensity(cell.count, stats.max)}
                      <div
                        onmouseenter={() => (hovered = cell)}
                        onmouseleave={() => {
                          if (hovered === cell) hovered = null;
                        }}
                        style:width="{CELL}px"
                        style:height="{CELL}px"
                        style:background-color={INTENSITY_BG[step]}
                        class="rounded-[2px] transition hover:outline-solid hover:outline-1 hover:outline-yeld"
                        role="presentation"
                      ></div>
                    {/if}
                  {/each}
                </div>
              {/each}
            </div>

            <div class="flex items-center justify-between mt-4">
              <div class="text-2xs text-t3 font-serif italic min-h-[18px]">
                {#if hovered}
                  {hovered.count === 1
                    ? t("modals.activity.tooltipOne", { count: String(hovered.count), date: fmtDateLong(hovered.date) })
                    : t("modals.activity.tooltipMany", { count: String(hovered.count), date: fmtDateLong(hovered.date) })}
                {:else}
                  {t("modals.activity.hoverHint")}
                {/if}
              </div>
              <div class="flex items-center gap-1.5 text-2xs text-t3 font-mono">
                <span>{t("modals.activity.legendLess")}</span>
                {#each INTENSITY_BG as bg, i (i)}
                  <div
                    style:width="{CELL}px"
                    style:height="{CELL}px"
                    style:background-color={bg}
                    class="rounded-[2px]"
                  ></div>
                {/each}
                <span>{t("modals.activity.legendMore")}</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="px-6 py-3 border-t border-bd flex items-center justify-between">
        <span class="font-serif italic text-2xs text-t3">
          {t("modals.activity.escClose")}
        </span>
        <button
          onclick={onClose}
          class="px-3 py-1.5 text-xs rounded-md text-t2 hover:bg-s2 hover:text-char transition"
        >
          {t("modals.activity.close")}
        </button>
      </div>
    </div>
  </div>
{/if}
