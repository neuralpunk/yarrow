<script lang="ts">
  // Cooking-persona rail buttons. Three buttons:
  //
  //   1. Cook mode — bigger text, screen stays awake.
  //   2. Recipe clipper — opens the recipe-URL clipper modal.
  //   3. Add to shopping list — sends `## Ingredients` to the workspace shopping list.
  //
  // Persona accent colour: warm orange (`text-orange-600`).

  import type { Snippet } from "svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import { cookMode } from "../../lib/editorPrefs.svelte";
  import { shortRailLabel } from "../../lib/railLabel";

  interface Props {
    /** Whether an active note is open. The shopping-list button is
     *  disabled when no note is open. */
    hasActiveNote: boolean;
    onClipRecipe: () => void;
    onAddToShoppingList: () => void;
  }

  let { hasActiveNote, onClipRecipe, onAddToShoppingList }: Props = $props();

  let t = $derived(tr());
  let cookOn = $derived(cookMode.value);
</script>

{#snippet personaRailButton(active: boolean, disabled: boolean, onClick: () => void, label: string, icon: Snippet)}
  {@const tone = disabled
    ? "text-t3 cursor-not-allowed opacity-50"
    : active
    ? "bg-yelp text-yeld"
    : "text-orange-600 hover:bg-s2"}
  <button
    type="button"
    onclick={disabled ? undefined : onClick}
    aria-label={label}
    aria-disabled={disabled || undefined}
    data-tip={label}
    data-tip-short={shortRailLabel(label)}
    data-tip-align="right"
    data-active={active ? "true" : "false"}
    class="y-tip rail-btn w-9 h-9 flex items-center justify-center rounded-full transition {tone}"
  >
    {@render icon()}
  </button>
{/snippet}

{#snippet potIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 1.5 q-0.6 0.8 0 1.6" />
    <path d="M7 1.2 q-0.6 0.9 0 1.9" />
    <path d="M9 1.5 q-0.6 0.8 0 1.6" />
    <path d="M3 5 h8" />
    <path d="M3.5 5 v3.5 a1.6 1.6 0 0 0 1.6 1.6 h3.8 a1.6 1.6 0 0 0 1.6 -1.6 V5" />
    <path d="M2 6 h1.5" />
    <path d="M10.5 6 H12" />
  </svg>
{/snippet}

{#snippet clipboardIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="8" height="9.5" rx="1" />
    <rect x="5" y="1.5" width="4" height="2.2" rx="0.5" />
    <line x1="5" y1="6.5" x2="9" y2="6.5" />
    <line x1="5" y1="9" x2="9" y2="9" />
  </svg>
{/snippet}

{#snippet cartIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 2 H3 L4.5 9 H11 L12.5 4 H4" />
    <circle cx="5.5" cy="11.5" r="0.7" />
    <circle cx="10" cy="11.5" r="0.7" />
  </svg>
{/snippet}

<div class="w-5 h-px bg-bd my-1"></div>
{@render personaRailButton(
  cookOn,
  false,
  () => cookMode.toggle(),
  cookOn ? t("plugin.cooking.rail.cookModeOn") : t("plugin.cooking.rail.cookModeOff"),
  potIcon,
)}
{@render personaRailButton(
  false,
  false,
  onClipRecipe,
  t("plugin.cooking.rail.clipRecipe"),
  clipboardIcon,
)}
{@render personaRailButton(
  false,
  !hasActiveNote,
  onAddToShoppingList,
  hasActiveNote ? t("plugin.cooking.rail.addToShopping") : t("plugin.cooking.rail.addToShoppingDisabled"),
  cartIcon,
)}
