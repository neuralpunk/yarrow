<script lang="ts">
  // Clinician-persona rail buttons. Three buttons:
  //
  //   1. Sensitive notes — modal listing every PHI-class note.
  //   2. Follow-ups — modal listing every #review/#followup/#todo/#wip note.
  //   3. New session note — opens the kit picker.
  //
  // Persona accent colour: teal (`text-teal-700`).

  import type { Snippet } from "svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import type { NoteSummary } from "../../lib/types";
  import { shortRailLabel } from "../../lib/railLabel";
  import { filterFollowUps, filterSensitive } from "./clinical";

  interface Props {
    notes: NoteSummary[];
    onOpenSensitive: () => void;
    onOpenFollowUps: () => void;
    onOpenSessionKit: () => void;
  }

  let { notes, onOpenSensitive, onOpenFollowUps, onOpenSessionKit }: Props = $props();

  let t = $derived(tr());
  let sensitiveCount = $derived(filterSensitive(notes).length);
  let followUpCount = $derived(filterFollowUps(notes).length);
</script>

{#snippet personaRailButton(active: boolean, onClick: () => void, label: string, badge: string | null, icon: Snippet)}
  {@const tone = active ? "bg-yelp text-yeld" : "text-teal-700 hover:bg-s2"}
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
        class="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-teal-700 text-bg text-[9px] font-mono leading-[14px] text-center pointer-events-none"
      >
        {Number(badge) > 99 ? "99+" : badge}
      </span>
    {/if}
  </button>
{/snippet}

{#snippet shieldIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 1.5 L12 3v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V3z" />
  </svg>
{/snippet}

{#snippet clipboardIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="8" height="9.5" rx="1" />
    <rect x="5" y="1.5" width="4" height="2.2" rx="0.5" />
    <path d="M5.2 8 L6.4 9.2 L9 6.5" />
  </svg>
{/snippet}

{#snippet newSessionIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2h6l2 2v8H3z" />
    <path d="M9 2v2h2" />
    <line x1="5.5" y1="7" x2="8.5" y2="7" />
    <line x1="7" y1="5.5" x2="7" y2="8.5" />
    <line x1="5" y1="10" x2="9" y2="10" />
  </svg>
{/snippet}

<div class="w-5 h-px bg-bd my-1"></div>
{@render personaRailButton(
  false,
  onOpenSensitive,
  t("plugin.clinician.rail.sensitive", { count: String(sensitiveCount) }),
  sensitiveCount > 0 ? String(sensitiveCount) : null,
  shieldIcon,
)}
{@render personaRailButton(
  false,
  onOpenFollowUps,
  t("plugin.clinician.rail.followups", { count: String(followUpCount) }),
  followUpCount > 0 ? String(followUpCount) : null,
  clipboardIcon,
)}
{@render personaRailButton(
  false,
  onOpenSessionKit,
  t("plugin.clinician.rail.newSession"),
  null,
  newSessionIcon,
)}
