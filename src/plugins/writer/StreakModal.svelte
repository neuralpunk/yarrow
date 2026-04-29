<script lang="ts">
  import Modal from "../../components/Modal.svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import { setStreakGoal, resetStreak, writingStreak } from "./streak.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let t = $derived(tr());

  // svelte-ignore state_referenced_locally
  let goalDraft = $state<string>(String(writingStreak.goal));

  // Re-sync the input draft if the modal is opened after a streak
  // change happened elsewhere (cross-tab edit, Settings reset, etc.)
  $effect(() => {
    if (open) goalDraft = String(writingStreak.goal);
  });

  let goalNum = $derived(Number(goalDraft));
  let goalValid = $derived(Number.isFinite(goalNum) && goalNum >= 50 && goalNum <= 10000);
  let dirty = $derived(goalValid && goalNum !== writingStreak.goal);

  let pct = $derived(Math.min(100, (writingStreak.todayWords / writingStreak.goal) * 100));
  let hit = $derived(writingStreak.todayWords >= writingStreak.goal);

  function commit() {
    if (!dirty) return;
    setStreakGoal(goalNum);
  }

  function reset() {
    if (!confirm(t("plugin.writer.streak.confirmReset"))) return;
    resetStreak();
    goalDraft = String(250);
  }
</script>

<Modal {open} {onClose} title={t("plugin.writer.streak.title")} width="w-[420px]">
  <div class="text-2xs text-t2 mb-4 leading-relaxed">
    {t("plugin.writer.streak.intro")}
  </div>

  <!-- ── Today's progress ── -->
  <div class="mb-5">
    <div class="flex items-baseline justify-between mb-2">
      <span class="text-[10px] uppercase tracking-wider text-t3 font-mono">
        {t("plugin.writer.streak.today")}
      </span>
      <span class="font-mono text-xs text-char">
        {t("plugin.writer.streak.todayCounter", {
          count: writingStreak.todayWords.toLocaleString(),
          goal: writingStreak.goal.toLocaleString(),
        })}
      </span>
    </div>
    <div class="h-2 rounded-full bg-s2 border border-bd overflow-hidden">
      <div
        class="h-full transition-all {hit ? 'bg-emerald-500' : 'bg-yel'}"
        style:width="{pct}%"
      ></div>
    </div>
    <div class="text-2xs text-t3 mt-1.5 italic">
      {hit
        ? t("plugin.writer.streak.todayHit")
        : t("plugin.writer.streak.todayRemaining", {
            count: Math.max(0, writingStreak.goal - writingStreak.todayWords).toLocaleString(),
          })}
    </div>
  </div>

  <!-- ── Streak stats ── -->
  <div class="grid grid-cols-2 gap-3 mb-5">
    <div class="px-3 py-2.5 rounded-md border border-bd bg-s1">
      <div class="text-[10px] uppercase tracking-wider text-t3 font-mono mb-0.5">
        {t("plugin.writer.streak.current")}
      </div>
      <div class="font-serif text-2xl text-char leading-none">
        {writingStreak.streakLength}
      </div>
      <div class="text-2xs text-t2 mt-1">
        {writingStreak.streakLength === 1
          ? t("plugin.writer.streak.daySingle")
          : t("plugin.writer.streak.dayPlural")}
      </div>
    </div>
    <div class="px-3 py-2.5 rounded-md border border-bd bg-s1">
      <div class="text-[10px] uppercase tracking-wider text-t3 font-mono mb-0.5">
        {t("plugin.writer.streak.longest")}
      </div>
      <div class="font-serif text-2xl text-char leading-none">
        {writingStreak.longestStreak}
      </div>
      <div class="text-2xs text-t2 mt-1">
        {writingStreak.longestStreak === 1
          ? t("plugin.writer.streak.daySingle")
          : t("plugin.writer.streak.dayPlural")}
      </div>
    </div>
  </div>

  <!-- ── Goal editor ── -->
  <div class="mb-4">
    <label class="block">
      <span class="text-[10px] uppercase tracking-wider text-t3 font-mono">
        {t("plugin.writer.streak.goalLabel")}
      </span>
      <div class="flex gap-2 mt-1.5">
        <input
          type="number"
          min="50"
          max="10000"
          step="50"
          bind:value={goalDraft}
          onkeydown={(e) => {
            if (e.key === "Enter" && !e.isComposing) commit();
          }}
          class="flex-1 px-2.5 py-1.5 bg-bg border border-bd rounded-md text-char text-sm font-mono focus:outline-hidden focus:border-yel"
        />
        <button
          type="button"
          onclick={commit}
          disabled={!dirty}
          class="px-3 py-1.5 rounded-md text-xs font-mono transition {dirty
            ? 'bg-yel text-yeld hover:bg-yelp'
            : 'bg-s2 text-t3 cursor-not-allowed'}"
        >
          {t("plugin.writer.streak.save")}
        </button>
      </div>
    </label>
    <div class="text-2xs text-t3 mt-1.5 leading-snug">
      {t("plugin.writer.streak.goalHint")}
    </div>
  </div>

  <!-- ── Reset ── -->
  <div class="pt-3 border-t border-bd flex justify-end">
    <button
      type="button"
      onclick={reset}
      class="text-2xs text-t3 hover:text-danger transition"
    >
      {t("plugin.writer.streak.reset")}
    </button>
  </div>
</Modal>
