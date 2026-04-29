<script lang="ts">
  // Writer-persona rail buttons. Lives in the persona slot of the
  // right rail when `mode.persona === "writer"`. Rendered as a
  // fragment so the rail's own divider/spacing rules carry through.
  //
  // Two buttons today (manuscript export ships in a future 3.x release):
  //
  //   1. Typewriter mode toggle — flips the existing typewriter pref.
  //      Highlighted when active.
  //   2. Streak / word goal — opens the StreakModal so the user can
  //      see today's progress and edit the daily goal.

  import type { Snippet } from "svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import { typewriterMode } from "../../lib/editorPrefs.svelte";
  import { shortRailLabel } from "../../lib/railLabel";
  import { writingStreak } from "./streak.svelte";

  interface Props {
    onOpenStreak: () => void;
  }

  let { onOpenStreak }: Props = $props();

  let t = $derived(tr());
  let tw = $derived(typewriterMode.value);
  let hit = $derived(writingStreak.todayWords >= writingStreak.goal);
</script>

{#snippet personaRailButton(active: boolean, onClick: () => void, label: string, hit_: boolean, icon: Snippet)}
  {@const tone = active
    ? "bg-yelp text-yeld"
    : hit_
    ? "text-emerald-600 hover:bg-s2"
    : "writer-rail-tone hover:bg-s2"}
  <button
    type="button"
    onclick={onClick}
    aria-label={label}
    data-tip={label}
    data-tip-short={shortRailLabel(label)}
    data-tip-align="right"
    data-active={active ? "true" : "false"}
    class="y-tip rail-btn w-9 h-9 flex items-center justify-center rounded-full transition {tone}"
  >
    {@render icon()}
  </button>
{/snippet}

{#snippet typewriterIcon()}
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="2" y="6" width="10" height="5" rx="1" />
    <path d="M3.5 6V3.5h7V6" />
    <line x1="4" y1="8.5" x2="10" y2="8.5" />
    <circle cx="4" cy="11.8" r="0.4" fill="currentColor" />
    <circle cx="6" cy="11.8" r="0.4" fill="currentColor" />
    <circle cx="8" cy="11.8" r="0.4" fill="currentColor" />
    <circle cx="10" cy="11.8" r="0.4" fill="currentColor" />
  </svg>
{/snippet}

{#snippet streakIcon()}
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="currentColor"
    stroke="none"
  >
    <rect x="2" y="9" width="2" height="3" rx="0.5" />
    <rect x="5" y="7" width="2" height="5" rx="0.5" />
    <rect x="8" y="5" width="2" height="7" rx="0.5" />
    <rect x="11" y="3" width="2" height="9" rx="0.5" />
  </svg>
{/snippet}

<div class="w-5 h-px bg-bd my-1"></div>
{@render personaRailButton(
  tw,
  () => typewriterMode.toggle(),
  tw ? t("plugin.writer.rail.typewriterOn") : t("plugin.writer.rail.typewriterOff"),
  false,
  typewriterIcon,
)}
{@render personaRailButton(
  false,
  onOpenStreak,
  t("plugin.writer.rail.streak", {
    count: String(writingStreak.streakLength),
    goal: writingStreak.goal.toLocaleString(),
    today: writingStreak.todayWords.toLocaleString(),
  }),
  hit,
  streakIcon,
)}
