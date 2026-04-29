<script module lang="ts">
  export type RailOverlay = "map" | "links" | "history" | "paths" | "outline-solid";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    BranchHereIcon,
    ConnectIcon,
    HistoryIcon,
    NewDirectionIcon,
    ScratchpadIcon,
    SettingsIcon,
  } from "../lib/iconsSvelte";
  import { showRawMarkdown } from "../lib/editorPrefs.svelte";
  import { railExpanded } from "../lib/uiPrefs.svelte";
  import { SK } from "../lib/platform.svelte";
  import { tr } from "../lib/i18n/index.svelte";
  import type { ModeConfig } from "../lib/modes";
  import { shortRailLabel } from "../lib/railLabel";

  const RAIL_WIDTH_COLLAPSED = 56;
  const RAIL_WIDTH_EXPANDED = 132;

  interface Props {
    activeOverlay: RailOverlay | null;
    scratchpadOpen: boolean;
    mappingEnabled?: boolean;
    mode?: ModeConfig;
    personaSlot?: Snippet;
    onOpen: (k: RailOverlay) => void;
    onToggleScratchpad: () => void;
    onOpenSettings: () => void;
    onOpenKits?: () => void;
    onOpenTagBrowser?: () => void;
    onBranchHere?: () => void;
    onSetReadingWriting?: (writing: boolean) => void;
  }

  let {
    activeOverlay,
    scratchpadOpen,
    mappingEnabled = true,
    mode,
    personaSlot,
    onOpen,
    onToggleScratchpad,
    onOpenSettings,
    onOpenKits,
    onOpenTagBrowser,
    onBranchHere,
    onSetReadingWriting,
  }: Props = $props();
  let t = $derived(tr());

  let writing = $derived(showRawMarkdown.value);

  function flip() {
    const next = !writing;
    if (onSetReadingWriting) onSetReadingWriting(next);
    else showRawMarkdown.set(next);
  }

  let showPathFeatures = $derived(mode ? mode.pathFeatures : true);
  let showKits = $derived(mode ? mode.kits : true);
</script>

{#snippet railButton(active: boolean, onClick: () => void, label: string, body: Snippet)}
  <button
    onclick={onClick}
    aria-label={label}
    data-tip={label}
    data-tip-short={shortRailLabel(label)}
    data-tip-align="right"
    data-active={active ? "true" : "false"}
    class="y-tip rail-btn w-10 h-10 flex items-center justify-center rounded-full {active
      ? 'bg-yelp text-yeld'
      : 'text-t1 hover:bg-s2 hover:text-char'}"
  >
    {@render body()}
  </button>
{/snippet}

<aside
  style:width="{railExpanded.expanded ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COLLAPSED}px"
  class="rail-shell shrink-0 border-l border-bd bg-s1 flex flex-col items-center py-4 gap-1.5{railExpanded.expanded
    ? ' rail-expanded'
    : ''}"
>
  {#snippet collapseToggleIcon()}
    {#if railExpanded.expanded}
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 3l4.5 4L5 11" />
      </svg>
    {:else}
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 3L4.5 7l4.5 4" />
      </svg>
    {/if}
  {/snippet}
  {@render railButton(
    false,
    () => railExpanded.set(!railExpanded.expanded),
    railExpanded.expanded ? t("sidebar.rail.collapse") : t("sidebar.rail.expand"),
    collapseToggleIcon,
  )}

  <div class="w-5 h-px bg-bd my-1"></div>

  {#snippet flipIcon()}
    {#if writing}
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.2 1.8l2 2L5 11l-3 1 1-3 7.2-7.2z" />
        <path d="M9 3l2 2" />
      </svg>
    {:else}
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="4" cy="10" r="2.6" />
        <circle cx="12" cy="10" r="2.6" />
        <path d="M6.6 10h2.8M2 7.5l1.3-3.2M14 7.5l-1.3-3.2" />
      </svg>
    {/if}
  {/snippet}
  {@render railButton(
    writing,
    flip,
    writing ? t("sidebar.rail.writingMode") : t("sidebar.rail.readingMode"),
    flipIcon,
  )}

  <div class="w-5 h-px bg-bd my-1"></div>

  {#if showPathFeatures && mappingEnabled}
    {#snippet mapIcon()}
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="3" cy="3" r="1.6" />
        <circle cx="11" cy="3" r="1.6" />
        <circle cx="7" cy="11" r="1.6" />
        <path d="M4.2 4.1L5.8 9.7M8.2 9.7L9.8 4.1M4.6 3h4.8" />
      </svg>
    {/snippet}
    {@render railButton(activeOverlay === "map", () => onOpen("map"), t("sidebar.rail.map"), mapIcon)}
    {#snippet linksIcon()}
      <ConnectIcon size={20} weight="regular" />
    {/snippet}
    {@render railButton(activeOverlay === "links", () => onOpen("links"), t("sidebar.rail.links"), linksIcon)}
  {/if}

  {#snippet outlineIcon()}
    <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="2" y1="3.5" x2="12" y2="3.5" />
      <line x1="4" y1="7" x2="11" y2="7" />
      <line x1="6" y1="10.5" x2="10" y2="10.5" />
    </svg>
  {/snippet}
  {@render railButton(activeOverlay === "outline-solid", () => onOpen("outline-solid"), t("sidebar.rail.outline-solid"), outlineIcon)}

  {#snippet historyIcon()}
    <HistoryIcon size={20} weight="regular" />
  {/snippet}
  {@render railButton(activeOverlay === "history", () => onOpen("history"), t("sidebar.rail.history"), historyIcon)}

  {#if showPathFeatures && mappingEnabled}
    {#snippet pathsIcon()}
      <NewDirectionIcon size={20} weight="regular" />
    {/snippet}
    {@render railButton(activeOverlay === "paths", () => onOpen("paths"), t("sidebar.rail.paths"), pathsIcon)}
  {/if}
  {#if showPathFeatures && mappingEnabled && onBranchHere}
    {#snippet branchHereIcon()}
      <BranchHereIcon size={20} weight="regular" />
    {/snippet}
    {@render railButton(false, onBranchHere, t("sidebar.rail.branchHere", { shortcut: SK.newDirection }), branchHereIcon)}
  {/if}

  {#if personaSlot}{@render personaSlot()}{/if}

  <div class="w-5 h-px bg-bd my-1"></div>

  {#if onOpenTagBrowser}
    {#snippet tagsIcon()}
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 7.5 L2 2.5 a0.5 0.5 0 0 1 0.5 -0.5 L7.5 2 L12.5 7 L7 12.5 Z" />
        <circle cx="4.5" cy="4.5" r="0.85" />
      </svg>
    {/snippet}
    {@render railButton(false, onOpenTagBrowser, t("sidebar.rail.tags"), tagsIcon)}
  {/if}

  {#if onOpenKits && showKits}
    {#snippet kitsIcon()}
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3.5" y="2" width="7" height="8.5" rx="1" />
        <path d="M2 4.5v6.2c0 .55.45 1 1 1h6.2" />
        <path d="M6 5.5h2.5M6 7.5h2.5" />
      </svg>
    {/snippet}
    {@render railButton(false, onOpenKits, t("sidebar.rail.kits"), kitsIcon)}
  {/if}

  {#snippet scratchpadIconSnippet()}
    <ScratchpadIcon size={20} weight="regular" />
  {/snippet}
  {@render railButton(scratchpadOpen, onToggleScratchpad, t("sidebar.rail.scratchpad", { shortcut: SK.scratchpad }), scratchpadIconSnippet)}

  <div class="w-5 h-px bg-bd my-1"></div>

  {#snippet settingsIconSnippet()}
    <SettingsIcon size={20} weight="regular" />
  {/snippet}
  {@render railButton(false, onOpenSettings, t("sidebar.rail.settings"), settingsIconSnippet)}

  <div class="flex-1"></div>
</aside>
