<script lang="ts">
  // Developer-persona rail buttons. Three buttons:
  //
  //   1. Decision Log — modal listing every `#decision`-tagged note.
  //   2. New ADR — scaffolds a fresh Architecture Decision Record.
  //   3. Code highlighting — toggles the `codeHighlight` extra.
  //
  // Persona accent colour: slate blue (`text-sky-700`).

  import type { Snippet } from "svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import type { NoteSummary } from "../../lib/types";
  import { extraCodeHighlight } from "../../lib/extraPrefs.svelte";
  import { shortRailLabel } from "../../lib/railLabel";
  import { filterDecisions } from "./adr";

  interface Props {
    notes: NoteSummary[];
    onOpenDecisions: () => void;
    onCreateAdr: () => void;
  }

  let { notes, onOpenDecisions, onCreateAdr }: Props = $props();

  let t = $derived(tr());
  let codeOn = $derived(extraCodeHighlight.value);
  let decisionCount = $derived(filterDecisions(notes).length);
</script>

{#snippet personaRailButton(active: boolean, onClick: () => void, label: string, badge: string | null, icon: Snippet)}
  {@const tone = active ? "bg-yelp text-yeld" : "text-sky-700 hover:bg-s2"}
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
        class="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-sky-700 text-bg text-[9px] font-mono leading-[14px] text-center pointer-events-none"
      >
        {Number(badge) > 99 ? "99+" : badge}
      </span>
    {/if}
  </button>
{/snippet}

{#snippet decisionIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <line x1="7" y1="2" x2="7" y2="12" />
    <line x1="3" y1="12" x2="11" y2="12" />
    <line x1="2" y1="4" x2="12" y2="4" />
    <path d="M2 4l-1.4 3a2 2 0 0 0 2.8 0L2 4z" />
    <path d="M12 4l1.4 3a2 2 0 0 1-2.8 0L12 4z" />
  </svg>
{/snippet}

{#snippet newAdrIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2h6l2 2v8H3z" />
    <path d="M9 2v2h2" />
    <line x1="5" y1="7" x2="9" y2="7" />
    <line x1="5" y1="9.5" x2="8" y2="9.5" />
    <line x1="11.5" y1="2.5" x2="11.5" y2="5" />
    <line x1="10.25" y1="3.75" x2="12.75" y2="3.75" />
  </svg>
{/snippet}

{#snippet codeIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 4 L2 7 L5 10" />
    <path d="M9 4 L12 7 L9 10" />
  </svg>
{/snippet}

<div class="w-5 h-px bg-bd my-1"></div>
{@render personaRailButton(
  false,
  onOpenDecisions,
  t("plugin.developer.rail.decisions", { count: String(decisionCount) }),
  decisionCount > 0 ? String(decisionCount) : null,
  decisionIcon,
)}
{@render personaRailButton(
  false,
  onCreateAdr,
  t("plugin.developer.rail.newAdr"),
  null,
  newAdrIcon,
)}
{@render personaRailButton(
  codeOn,
  () => extraCodeHighlight.toggle(),
  codeOn ? t("plugin.developer.rail.codeHighlightOn") : t("plugin.developer.rail.codeHighlightOff"),
  null,
  codeIcon,
)}
