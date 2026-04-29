<script lang="ts">
  import type { NoteSummary } from "../../lib/types";
  import { dailyLabel, todayIso } from "../../lib/format";
  import { JournalIcon } from "../../lib/iconsSvelte";
  import { SK } from "../../lib/platform.svelte";
  import JournalCalendar from "./JournalCalendar.svelte";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    entries: NoteSummary[];
    activeSlug: string | null;
    onOpenDaily: (dateIso: string) => void;
  }

  let { entries, activeSlug, onOpenDaily }: Props = $props();
  let t = $derived(tr());

  let today = todayIso();
  let todaySlug = $derived(`daily/${today}`);
  let todayActive = $derived(activeSlug === todaySlug);
  let calOpen = $state(false);
  let activeDate = $derived(
    activeSlug && activeSlug.startsWith("daily/")
      ? activeSlug.slice("daily/".length)
      : undefined,
  );

  let recent = $derived(entries.filter((e) => e.slug !== todaySlug).slice(0, 5));
</script>

<div class="mt-5 pt-5 border-t border-bd/20">
  <div class="flex items-center justify-between px-4 mb-2">
    <div class="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wider text-t3 font-semibold">
      <JournalIcon size={12} />
      <span>{t("sidebar.journal.title")}</span>
    </div>
    <button
      onclick={() => (calOpen = true)}
      class="text-2xs text-t3 hover:text-char transition"
      title={t("sidebar.journal.calendarTooltip")}
    >
      {t("sidebar.journal.calendar")}
    </button>
  </div>
  <JournalCalendar
    open={calOpen}
    onClose={() => (calOpen = false)}
    onPick={onOpenDaily}
    {activeDate}
  />

  <div class="px-2">
    <button
      onclick={() => onOpenDaily(today)}
      class="y-tip w-full text-left px-3 py-2 rounded transition flex items-center gap-2 text-xs {todayActive
        ? 'bg-yelp text-yeld'
        : 'text-t2 hover:bg-s2 hover:text-char'}"
      data-tip={t("sidebar.journal.todayTooltip", { shortcut: SK.jumpToday })}
    >
      <span class="w-1.5 h-1.5 rounded-full shrink-0 {todayActive ? 'bg-yel' : 'bg-bd2'}"></span>
      <span class="font-medium">{t("sidebar.journal.today")}</span>
      <span class="ml-auto text-2xs text-t3 font-mono">{today}</span>
    </button>
  </div>

  {#if recent.length > 0}
    <ul class="px-2 mt-1 space-y-0.5">
      {#each recent as e (e.slug)}
        {@const iso = e.slug.replace(/^daily\//, "")}
        {@const active = e.slug === activeSlug}
        <li>
          <button
            onclick={() => onOpenDaily(iso)}
            class="w-full text-left px-3 py-1.5 rounded text-xs transition flex items-center gap-2 {active
              ? 'bg-s3 text-char'
              : 'text-t2 hover:bg-s2 hover:text-char'}"
          >
            <span>{dailyLabel(e.slug)}</span>
            {#if e.excerpt}
              <span class="ml-auto truncate text-2xs text-t3 max-w-[120px]">
                {e.excerpt}
              </span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
