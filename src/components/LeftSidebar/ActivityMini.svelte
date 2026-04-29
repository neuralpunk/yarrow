<script lang="ts">
  import { api } from "../../lib/tauri";
  import type { ActivityDay } from "../../lib/types";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    onOpen: () => void;
  }

  let { onOpen }: Props = $props();
  let t = $derived(tr());

  const DAYS = 14;
  const CELL_HEIGHT = 20;

  const INTENSITY_BG = [
    "var(--s2)",
    "color-mix(in srgb, var(--yeld) 25%, var(--s1))",
    "color-mix(in srgb, var(--yeld) 50%, var(--s1))",
    "color-mix(in srgb, var(--yeld) 75%, var(--s1))",
    "var(--yeld)",
  ];

  function intensity(count: number, max: number): number {
    if (count <= 0) return 0;
    if (max <= 1) return 4;
    const frac = count / max;
    if (frac >= 0.8) return 4;
    if (frac >= 0.55) return 3;
    if (frac >= 0.3) return 2;
    return 1;
  }

  function padDays(raw: ActivityDay[]): ActivityDay[] {
    const byDate = new Map(raw.map((d) => [d.date, d.count]));
    const out: ActivityDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
      out.push({ date: iso, count: byDate.get(iso) ?? 0 });
    }
    return out;
  }

  function shortDate(iso: string): string {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  let data = $state<ActivityDay[] | null>(null);

  $effect(() => {
    let alive = true;
    api
      .writingActivity(DAYS)
      .then((d) => {
        if (alive) data = d;
      })
      .catch(() => {
        if (alive) data = [];
      });
    return () => {
      alive = false;
    };
  });

  let padded = $derived(data ? padDays(data) : null);
  let max = $derived(padded ? padded.reduce((m, d) => Math.max(m, d.count), 0) : 0);
  let total = $derived(padded ? padded.reduce((s, d) => s + d.count, 0) : 0);
  let streak = $derived.by(() => {
    if (!padded) return 0;
    let n = 0;
    for (let i = padded.length - 1; i >= 0; i--) {
      if (padded[i].count > 0) n++;
      else break;
    }
    return n;
  });
</script>

<div class="mt-5 pt-5 pb-2 border-t border-bd/20">
  <div class="flex items-baseline justify-between px-4 mb-2">
    <div class="text-2xs uppercase tracking-wider text-t3 font-semibold">
      {t("sidebar.activity.title")}
    </div>
    <div class="text-[10px] text-t3 font-mono">
      {t("sidebar.activity.window", { days: String(DAYS) })}
    </div>
  </div>
  <button
    onclick={onOpen}
    title={t("sidebar.activity.openTooltip")}
    class="w-full px-4 py-2 text-left hover:bg-s2/60 transition group"
  >
    {#if padded}
      <div class="flex gap-[2px]">
        {#each padded as d (d.date)}
          <div
            title={t(
              d.count === 1
                ? "sidebar.activity.cellTooltipOne"
                : "sidebar.activity.cellTooltipMany",
              { count: String(d.count), date: shortDate(d.date) },
            )}
            style:flex="1 1 0"
            style:height="{CELL_HEIGHT}px"
            style:background-color={INTENSITY_BG[intensity(d.count, max)]}
            class="rounded-[2px] min-w-[8px]"
          ></div>
        {/each}
      </div>
    {:else}
      <div class="w-full rounded-[2px] bg-s2 animate-pulse" style:height="{CELL_HEIGHT}px"></div>
    {/if}
    <div class="mt-2 flex items-baseline justify-between text-[10px] text-t3 font-mono">
      {#if padded}
        <span>
          <span class="text-char font-medium">{total}</span>{" "}
          {t(
            total === 1 ? "sidebar.activity.totalOne" : "sidebar.activity.totalMany",
          )}
        </span>
        {#if streak > 0}
          <span class="text-yeld">
            {t("sidebar.activity.streak", { n: String(streak) })}
          </span>
        {/if}
      {:else}
        <span class="italic text-t3">{t("sidebar.activity.loading")}</span>
      {/if}
    </div>
  </button>
</div>
