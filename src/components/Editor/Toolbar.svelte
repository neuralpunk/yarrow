<script lang="ts">
  import { NewDirectionIcon, JournalIcon } from "../../lib/iconsSvelte";
  import type { PathCollection } from "../../lib/types";
  import { isGhostPath } from "../../lib/types";
  import { buildPathColorMap, colorForPath, isRoot } from "../../lib/pathAwareness";
  import { tr } from "../../lib/i18n/index.svelte";
  import { SK } from "../../lib/platform.svelte";

  interface Props {
    collections: PathCollection[];
    rootName: string;
    currentPath: string;
    checkpointCount: number;
    dirty: boolean;
    lastSavedAt?: number;
    mappingEnabled?: boolean;
    onSwitchPath: (name: string) => void;
    onBranchFromHere: () => void;
    onOpenPaths: () => void;
    onComparePaths?: () => void;
    onOpenMap: () => void;
    onEditCurrentCondition: () => void;
    focusMode?: boolean;
    onExitFocus?: () => void;
    dailyDate?: string | null;
    onOpenJournalCalendar?: (anchor: DOMRect) => void;
    onBack?: () => void;
    backLabel?: string | null;
    backShortcut?: string;
  }

  let {
    collections,
    rootName,
    currentPath,
    checkpointCount,
    dirty,
    lastSavedAt,
    mappingEnabled = true,
    onSwitchPath,
    onBranchFromHere,
    onOpenPaths,
    onComparePaths,
    onOpenMap,
    onEditCurrentCondition,
    focusMode = false,
    onExitFocus,
    dailyDate = null,
    onOpenJournalCalendar,
    onBack,
    backLabel = null,
    backShortcut,
  }: Props = $props();

  let t = $derived(tr());

  let dailyLabel = $derived.by(() => {
    if (!dailyDate) return null;
    const [y, m, d] = dailyDate.split("-").map(Number);
    if (!y || !m || !d) return dailyDate;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric",
    });
  });

  let active = $derived(currentPath || rootName || "main");
  let byName = $derived.by(() => {
    const m = new Map<string, PathCollection>();
    for (const c of collections) m.set(c.name, c);
    return m;
  });
  let activeCol = $derived(byName.get(active) ?? null);
  let condition = $derived((activeCol?.condition || "").trim());
  let colorOverrides = $derived(buildPathColorMap(collections));
  let color = $derived(colorForPath(active, { overrides: colorOverrides }));
  let root = $derived(active === rootName || isRoot(active));

  let justSaved = $state(false);
  $effect(() => {
    if (!lastSavedAt) return;
    justSaved = true;
    const handle = window.setTimeout(() => (justSaved = false), 2500);
    return () => window.clearTimeout(handle);
  });

  let saveLabel = $derived(
    dirty
      ? t("editor.toolbar.editing")
      : justSaved
      ? t("editor.toolbar.savedJustNow")
      : t("editor.toolbar.saved"),
  );
  let saveDotColor = $derived(dirty ? "var(--yel)" : justSaved ? "var(--yel)" : "var(--accent2)");

  let switcherOpen = $state(false);
  let switcherRef = $state<HTMLDivElement | null>(null);
  $effect(() => {
    if (!switcherOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!switcherRef?.contains(e.target as Node)) switcherOpen = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") switcherOpen = false;
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  });

  // PathSwitcher state
  let filter = $state("");
  let filterInputRef = $state<HTMLInputElement | null>(null);
  $effect(() => {
    if (!switcherOpen) return;
    filter = "";
    const h = window.setTimeout(() => filterInputRef?.focus(), 20);
    return () => window.clearTimeout(h);
  });

  let liveOrdered = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    const match = (c: PathCollection) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.condition.toLowerCase().includes(q);
    const live = collections.filter((c) => !isGhostPath(c, rootName, collections) && match(c));
    live.sort((a, b) => {
      if (a.name === active) return -1;
      if (b.name === active) return 1;
      const aRoot = a.name === rootName ? 1 : 0;
      const bRoot = b.name === rootName ? 1 : 0;
      if (aRoot !== bRoot) return bRoot - aRoot;
      return (b.created_at || 0) - (a.created_at || 0);
    });
    return live;
  });
  let ghostOrdered = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    const match = (c: PathCollection) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.condition.toLowerCase().includes(q);
    const ghost = collections.filter((c) => isGhostPath(c, rootName, collections) && match(c));
    ghost.sort((a, b) => {
      const aEra = a.parent || a.name;
      const bEra = b.parent || b.name;
      if (aEra !== bEra) return bEra.localeCompare(aEra);
      const aAnchor = a.name === aEra ? -1 : 0;
      const bAnchor = b.name === bEra ? -1 : 0;
      if (aAnchor !== bAnchor) return aAnchor - bAnchor;
      return (b.created_at || 0) - (a.created_at || 0);
    });
    return ghost;
  });

  let onCurrentRoot = $derived(active === rootName);

  function pickPath(name: string) {
    switcherOpen = false;
    onSwitchPath(name);
  }
</script>

{#snippet backButton()}
  {#if onBack}
    <button
      type="button"
      onclick={onBack}
      class="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-md text-[12px] text-t2 hover:bg-s2 hover:text-char transition shrink-0"
      title={
        backLabel
          ? t("editor.toolbar.backTitle", { title: backLabel, shortcut: backShortcut ?? "" })
          : t("editor.toolbar.backTitleEmpty", { shortcut: backShortcut ?? "" })
      }
      aria-label={t("editor.toolbar.backAria")}
    >
      <span aria-hidden="true" style:font-size="13px">‹</span>
      <span>{t("editor.toolbar.back")}</span>
    </button>
  {/if}
{/snippet}

{#snippet journalPill()}
  {#if dailyDate && onOpenJournalCalendar}
    <button
      type="button"
      onclick={(e) => {
        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        onOpenJournalCalendar(rect);
      }}
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] text-yeld bg-yelp/60 hover:bg-yelp transition border border-yel/25"
      title={t("editor.toolbar.journalJump")}
    >
      <JournalIcon size={13} />
      <span class="font-serif">{dailyLabel}</span>
      <span class="text-t3 text-[11px]">▾</span>
    </button>
  {/if}
{/snippet}

{#snippet zenChip()}
  {#if focusMode}
    <div
      class="flex items-center gap-2.5 pl-3 pr-1.5 py-1.5 rounded-full bg-yelp border border-yeld/30 shrink-0"
      title={t("editor.toolbar.zenTitle")}
      style:-webkit-font-smoothing="antialiased"
      style:-moz-osx-font-smoothing="grayscale"
      style:text-rendering="optimizeLegibility"
    >
      <span class="relative flex items-center justify-center">
        <span class="absolute inline-block w-2 h-2 rounded-full bg-yel opacity-60 animate-ping"></span>
        <span class="relative inline-block w-1.5 h-1.5 rounded-full bg-yel"></span>
      </span>
      <span class="font-serif italic text-[14px] text-yeld leading-[1.1] tracking-[0.01em]">
        {t("editor.toolbar.zenLabel")}
      </span>
      <button
        type="button"
        onclick={onExitFocus}
        class="font-mono text-[11px] text-yeld hover:text-char hover:bg-bg px-2 py-1 rounded-full border border-yeld/35 hover:border-yeld transition leading-none"
        title={t("editor.toolbar.zenExitTitle", { shortcut: SK.focusToggle })}
      >
        {t("editor.toolbar.zenExit")}
      </button>
    </div>
  {/if}
{/snippet}

{#snippet saveStatus()}
  <div class="flex items-center gap-3 text-2xs text-t3 shrink-0 whitespace-nowrap">
    <span class="font-mono">{t("editor.toolbar.checkpoints", { count: String(checkpointCount) })}</span>
    <span class="flex items-center gap-1.5 transition-[color] duration-500">
      <span aria-hidden="true" class="inline-block rounded-full" style:width="5px" style:height="5px" style:background={saveDotColor}></span>
      <span class={justSaved && !dirty ? "text-yeld" : ""}>{saveLabel}</span>
    </span>
  </div>
{/snippet}

{#snippet graphIcon()}
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
    <circle cx="3" cy="3" r="1.5" />
    <circle cx="3" cy="11" r="1.5" />
    <circle cx="11" cy="7" r="1.5" />
    <path d="M3 4.5v5M4.3 3.7l5.4 2.6M4.3 10.3l5.4-2.6" />
  </svg>
{/snippet}

{#snippet connectionsMapIcon()}
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="3" cy="3" r="1.6" />
    <circle cx="11" cy="3" r="1.6" />
    <circle cx="7" cy="11" r="1.6" />
    <path d="M4.2 4.1L5.8 9.7M8.2 9.7L9.8 4.1M4.6 3h4.8" />
  </svg>
{/snippet}

{#snippet compareIcon()}
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.5" y="2" width="4.5" height="10" rx="0.8" />
    <rect x="8" y="2" width="4.5" height="10" rx="0.8" />
    <path d="M7 2.5v9" stroke-dasharray="1.2 1.3" />
  </svg>
{/snippet}

{#if !mappingEnabled}
  <div class="toolbar h-11 flex items-center px-6 gap-2 text-xs border-b border-bd bg-bg">
    {@render backButton()}
    {@render journalPill()}
    <div class="flex-1"></div>
    {@render zenChip()}
    {@render saveStatus()}
  </div>
{:else}
  <div class="toolbar h-11 flex items-center px-6 gap-2 text-xs border-b border-bd bg-bg">
    {@render backButton()}
    <div class="relative" bind:this={switcherRef}>
      <button
        type="button"
        onclick={() => (switcherOpen = !switcherOpen)}
        class="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full hover:bg-s2 transition group max-w-[480px]"
        title={t("editor.toolbar.switchPath")}
      >
        <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-bg" style:background={color}></span>
        <span class="font-serif text-[15px] text-char leading-none whitespace-nowrap">{active}</span>
        {#if !root}
          {#if condition}
            <span class="font-serif italic text-[13px] text-yeld truncate max-w-[300px] leading-none" title={condition}>"{condition}"</span>
          {:else}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              class="font-serif italic text-[12px] text-t3 truncate leading-none"
              onclick={(e) => { e.stopPropagation(); onEditCurrentCondition(); }}
              role="button"
              tabindex="0"
              title={t("editor.toolbar.namePathTitle")}
            >
              {t("editor.toolbar.namePathPrompt")}
            </span>
          {/if}
        {/if}
        {#if root && collections.length <= 1}
          <span class="text-2xs italic text-t3 leading-none">{t("editor.toolbar.onlyPath")}</span>
        {/if}
        <svg class="text-t3 group-hover:text-char shrink-0" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      {#if switcherOpen}
        <div class="absolute left-0 top-full mt-1 z-50 w-[380px] bg-bg border border-bd2 rounded-lg shadow-2xl py-1.5 animate-fadeIn">
          <div class="px-3 pt-1.5 pb-2">
            <input
              bind:this={filterInputRef}
              type="text"
              bind:value={filter}
              placeholder={t("editor.pathSwitcher.placeholder", { count: String(collections.length) })}
              class="w-full px-2.5 py-1.5 bg-s1 border border-bd rounded-md text-char text-xs placeholder:text-t3 focus:outline-hidden focus:border-yel"
            />
          </div>
          {#if !onCurrentRoot}
            <button
              type="button"
              onclick={() => pickPath(rootName)}
              class="w-full text-left px-3.5 py-1.5 text-xs text-yeld hover:bg-yelp flex items-center gap-2 border-b border-bd"
              title={t("editor.pathSwitcher.backToRootTitle")}
            >
              <span class="inline-block w-2 h-2 rounded-full bg-yel"></span>
              <span class="font-medium">{t("editor.pathSwitcher.backToRoot", { root: rootName })}</span>
            </button>
          {/if}
          <ul class="max-h-[360px] overflow-y-auto">
            {#if liveOrdered.length === 0 && ghostOrdered.length === 0}
              <li class="px-3.5 py-3 text-xs text-t3 italic">{t("editor.pathSwitcher.noMatches")}</li>
            {/if}
            {#each liveOrdered as c (c.name)}
              {@const cond = c.condition.trim()}
              {@const itemColor = colorOverrides[c.name] ?? (c.name === rootName ? "var(--yel)" : colorForPath(c.name))}
              {@const isActive = c.name === active}
              {@const isRootItem = c.name === rootName}
              <li>
                <button
                  type="button"
                  onclick={() => pickPath(c.name)}
                  class="w-full text-left px-3.5 py-2 flex items-start gap-2.5 transition {isActive ? 'bg-yelp/60' : 'hover:bg-s2/70'}"
                >
                  <span class="inline-block w-2.5 h-2.5 rounded-full mt-1 shrink-0" style:background={itemColor}></span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                      <span class="font-serif text-[14.5px] text-char truncate">{c.name}</span>
                      {#if isActive}
                        <span class="text-2xs font-mono text-yeld tracking-wider">{t("editor.pathSwitcher.you")}</span>
                      {/if}
                      {#if isRootItem && !isActive}
                        <span class="text-2xs font-mono text-t3 tracking-wider">{t("editor.pathSwitcher.main")}</span>
                      {/if}
                    </div>
                    {#if cond}
                      <div class="text-2xs text-yeld italic truncate mt-0.5">"{cond}"</div>
                    {:else if !isRootItem}
                      <div class="text-2xs text-t3 italic truncate mt-0.5">{t("editor.pathSwitcher.unnamedPath")}</div>
                    {/if}
                    <div class="text-2xs text-t3 mt-1 font-mono">
                      {c.members.length === 1
                        ? t("editor.pathSwitcher.notesCountOne", { count: String(c.members.length) })
                        : t("editor.pathSwitcher.notesCountOther", { count: String(c.members.length) })}
                    </div>
                  </div>
                </button>
              </li>
            {/each}
            {#if ghostOrdered.length > 0}
              <li class="px-3.5 pt-3 pb-1 text-2xs font-mono uppercase tracking-[0.18em] text-t3 border-t border-bd mt-1">
                {t("editor.pathSwitcher.ghostsHeader")}
              </li>
            {/if}
            {#each ghostOrdered as c (c.name)}
              {@const cond = c.condition.trim()}
              {@const isActive = c.name === active}
              {@const era = c.parent || c.name}
              {@const isAnchor = c.name === era}
              <li>
                <button
                  type="button"
                  onclick={() => pickPath(c.name)}
                  class="w-full text-left px-3.5 py-2 flex items-start gap-2.5 transition opacity-75 hover:opacity-100 {isActive ? 'bg-yelp/60' : 'hover:bg-s2/70'}"
                >
                  <span class="inline-block w-2.5 h-2.5 rounded-full mt-1 shrink-0 border border-dashed border-t3" style:background="transparent"></span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                      <span class="font-serif italic text-[14.5px] text-t2 truncate">{c.name}</span>
                      {#if isAnchor}
                        <span class="text-2xs font-mono text-t3 tracking-wider">{t("editor.pathSwitcher.wasMain")}</span>
                      {/if}
                    </div>
                    {#if cond}
                      <div class="text-2xs text-t3 italic truncate mt-0.5">"{cond}"</div>
                    {/if}
                    <div class="text-2xs text-t3 mt-1 font-mono">
                      {c.members.length === 1
                        ? t("editor.pathSwitcher.ghostNotesOne", { count: String(c.members.length) })
                        : t("editor.pathSwitcher.ghostNotesOther", { count: String(c.members.length) })}
                    </div>
                  </div>
                </button>
              </li>
            {/each}
          </ul>
          <div class="border-t border-bd mt-1 pt-1">
            <button
              type="button"
              onclick={() => { switcherOpen = false; onOpenPaths(); }}
              class="w-full text-left px-3.5 py-2 text-xs text-t2 hover:bg-s2 hover:text-char flex items-center gap-2 transition"
            >
              {@render graphIcon()}
              <span>{t("editor.toolbar.openPathsGraph")}</span>
            </button>
          </div>
        </div>
      {/if}
    </div>

    {#if !root && rootName}
      <button
        type="button"
        onclick={() => onSwitchPath(rootName)}
        class="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border border-yel/70 text-yeld hover:bg-yelp transition group"
        title={t("editor.toolbar.backToRoot", { root: rootName })}
      >
        <span class="inline-block w-2 h-2 rounded-full shrink-0" style:background="var(--yel)"></span>
        <span class="font-serif text-[12.5px] leading-none whitespace-nowrap">{t("editor.toolbar.backArrow", { root: rootName })}</span>
      </button>
    {/if}

    <div class="ml-1 flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onclick={onBranchFromHere}
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] text-t2 hover:bg-s2 hover:text-char transition"
        title={t("editor.toolbar.branchThisTitle", { shortcut: "⌘⇧B" })}
      >
        <NewDirectionIcon />
        <span>{t("editor.toolbar.branchThis")}</span>
      </button>
      <button
        type="button"
        onclick={onOpenMap}
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] text-t2 hover:bg-s2 hover:text-char transition"
        title={t("editor.toolbar.connectionsMapTitle")}
      >
        {@render connectionsMapIcon()}
        <span>{t("editor.toolbar.connectionsMap")}</span>
      </button>
      <button
        type="button"
        onclick={onOpenPaths}
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] text-t2 hover:bg-s2 hover:text-char transition"
        title={t("editor.toolbar.pathsTitle")}
      >
        {@render graphIcon()}
        <span>{t("editor.toolbar.paths")}</span>
      </button>
      {#if onComparePaths && collections.length > 1}
        <button
          type="button"
          onclick={onComparePaths}
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] text-t2 hover:bg-s2 hover:text-char transition"
          title={t("editor.toolbar.compareTitle")}
        >
          {@render compareIcon()}
          <span>{t("editor.toolbar.compare")}</span>
        </button>
      {/if}
      {@render journalPill()}
    </div>

    <div class="flex-1"></div>
    {@render zenChip()}
    {@render saveStatus()}
  </div>
{/if}
