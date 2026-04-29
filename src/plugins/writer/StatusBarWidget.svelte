<script lang="ts">
  // Writer-persona status-bar widget. Renders a small pill showing
  // today's progress toward the daily word goal + the current streak
  // length. Click jumps to the Streak modal (parent provides the
  // open handler).
  //
  // Mounted in AppShell only when `mode.persona === "writer"`.

  import { tr } from "../../lib/i18n/index.svelte";
  import { writingStreak } from "./streak.svelte";

  interface Props {
    onOpen: () => void;
  }

  let { onOpen }: Props = $props();

  let t = $derived(tr());
  let hit = $derived(writingStreak.todayWords >= writingStreak.goal);
  let pct = $derived(Math.min(100, (writingStreak.todayWords / writingStreak.goal) * 100));
  let title = $derived(
    t("plugin.writer.status.title", {
      count: writingStreak.todayWords.toLocaleString(),
      goal: writingStreak.goal.toLocaleString(),
      streak: String(writingStreak.streakLength),
    }),
  );
</script>

<button
  type="button"
  onclick={onOpen}
  {title}
  class="group relative flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border transition {hit
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
    : 'border-bd bg-s1 hover:border-bd2 text-t2'}"
>
  <span class="inline-block w-2 h-2 rounded-full overflow-hidden bg-s2 border border-bd relative">
    <span
      class="absolute inset-y-0 left-0 {hit ? 'bg-emerald-500' : 'bg-amber-500'}"
      style:width="{pct}%"
    ></span>
  </span>
  <span>
    {t("plugin.writer.status.todayShort", {
      count: writingStreak.todayWords.toLocaleString(),
      goal: writingStreak.goal.toLocaleString(),
    })}
  </span>
  {#if writingStreak.streakLength > 0}
    <span class="text-t3">·</span>
    <span title={t("plugin.writer.status.streakTitle")}>
      {t("plugin.writer.status.streakShort", {
        count: String(writingStreak.streakLength),
      })}
    </span>
  {/if}
</button>
