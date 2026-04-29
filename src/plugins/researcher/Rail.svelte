<script lang="ts">
  // Researcher-persona rail buttons. Mounted in the rail's
  // persona slot when `mode.persona === "researcher"`. Three buttons:
  //
  //   1. Open Questions — opens a modal listing the active note's `??` markers.
  //   2. Sources — workspace-wide list of notes tagged with one of
  //      the recognised source kinds. Shows a count badge.
  //   3. New Source — scaffolds a fresh source-card note and opens it.
  //
  // Persona accent colour: emerald (`text-emerald-600`).

  import type { Snippet } from "svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import type { NoteSummary } from "../../lib/types";
  import { shortRailLabel } from "../../lib/railLabel";
  import { filterSources } from "./sources";

  interface Props {
    notes: NoteSummary[];
    questionCount: number;
    onOpenQuestions: () => void;
    onOpenSources: () => void;
    onCreateSource: () => void;
  }

  let {
    notes,
    questionCount,
    onOpenQuestions,
    onOpenSources,
    onCreateSource,
  }: Props = $props();

  let t = $derived(tr());
  let sourceCount = $derived(filterSources(notes).length);
</script>

{#snippet personaRailButton(active: boolean, onClick: () => void, label: string, badge: string | null, icon: Snippet)}
  {@const tone = active ? "bg-yelp text-yeld" : "text-emerald-600 hover:bg-s2"}
  <button
    type="button"
    onclick={onClick}
    aria-label={label}
    data-tip={label}
    data-tip-short={shortRailLabel(label)}
    data-tip-align="right"
    data-active={active ? "true" : "false"}
    class="y-tip rail-btn relative w-9 h-9 flex items-center justify-center rounded-full transition {tone}"
  >
    {@render icon()}
    {#if badge}
      <span
        class="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-emerald-600 text-bg text-[9px] font-mono leading-[14px] text-center pointer-events-none"
      >
        {Number(badge) > 99 ? "99+" : badge}
      </span>
    {/if}
  </button>
{/snippet}

{#snippet questionIcon()}
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
    <path d="M4 5a3 3 0 1 1 4.5 2.6c-.7.4-1.5.9-1.5 1.7V10" />
    <circle cx="7" cy="12" r="0.6" fill="currentColor" />
  </svg>
{/snippet}

{#snippet sourcesIcon()}
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
    <rect x="3" y="2" width="8" height="3" rx="0.5" />
    <rect x="3" y="6" width="8" height="3" rx="0.5" />
    <rect x="3" y="10" width="8" height="2.4" rx="0.5" />
  </svg>
{/snippet}

{#snippet newSourceIcon()}
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
    <path d="M3.5 2h5l2 2v8h-7z" />
    <path d="M8.5 2v2h2" />
    <path d="M9.5 8h2.5" />
    <path d="M10.75 6.75v2.5" />
  </svg>
{/snippet}

<div class="w-5 h-px bg-bd my-1"></div>
{@render personaRailButton(
  false,
  onOpenQuestions,
  t("plugin.researcher.rail.questions", { count: String(questionCount) }),
  questionCount > 0 ? String(questionCount) : null,
  questionIcon,
)}
{@render personaRailButton(
  false,
  onOpenSources,
  t("plugin.researcher.rail.sources", { count: String(sourceCount) }),
  sourceCount > 0 ? String(sourceCount) : null,
  sourcesIcon,
)}
{@render personaRailButton(
  false,
  onCreateSource,
  t("plugin.researcher.rail.newSource"),
  null,
  newSourceIcon,
)}
