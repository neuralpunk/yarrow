<script module lang="ts">
  const PREVIEW_CACHE_MAX = 40;
  const previewCache = new Map<string, { title: string; body: string }>();

  export function getCachedPreview(slug: string) {
    const hit = previewCache.get(slug);
    if (hit) {
      previewCache.delete(slug);
      previewCache.set(slug, hit);
    }
    return hit;
  }

  export function cachePreview(slug: string, value: { title: string; body: string }) {
    if (previewCache.has(slug)) previewCache.delete(slug);
    previewCache.set(slug, value);
    while (previewCache.size > PREVIEW_CACHE_MAX) {
      const oldest = previewCache.keys().next().value;
      if (oldest === undefined) break;
      previewCache.delete(oldest);
    }
  }

  export function excerptForPreview(body: string): string {
    const cleaned = body
      .split("\n")
      .filter((l) => !l.trim().startsWith("---"))
      .join("\n")
      .trimStart();
    if (cleaned.length <= 480) return cleaned;
    return cleaned.slice(0, 480).replace(/\s+\S*$/, "") + "…";
  }

  export interface WikilinkPreviewData {
    x: number;
    y: number;
    placeAbove: boolean;
    title: string;
    body: string;
    slug?: string;
    missing?: boolean;
    mode?: "hover" | "click";
  }
</script>

<script lang="ts">
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    data: WikilinkPreviewData;
    currentPath: string;
    pathNotes?: Record<string, string[]>;
    onBranchHere?: (slug: string) => void;
    onOpen?: (slug: string) => void;
    onEnter?: () => void;
    onLeave?: () => void;
  }

  let {
    data,
    currentPath,
    pathNotes,
    onBranchHere,
    onOpen,
    onEnter,
    onLeave,
  }: Props = $props();
  let t = $derived(tr());

  let isClick = $derived(data.mode === "click");
  let containerRef = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!isClick || !onLeave) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onLeave();
      }
    };
    const onDown = (e: MouseEvent) => {
      const el = containerRef;
      if (!el) return;
      if (!el.contains(e.target as Node)) onLeave();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  });

  let excerpt = $derived(excerptForPreview(data.body));

  let membership = $derived.by(() => {
    if (!data.slug || !pathNotes) return null;
    const slug = data.slug;
    const allBranches = Object.keys(pathNotes);
    const here: string[] = [];
    const absent: string[] = [];
    for (const b of allBranches) {
      if ((pathNotes[b] || []).includes(slug)) here.push(b);
      else absent.push(b);
    }
    if (allBranches.length === 0) return null;
    return { here, absent, total: allBranches.length };
  });

  function handleOpen() {
    if (isClick && data.slug && onOpen) onOpen(data.slug);
  }
</script>

{#if data.missing}
  <div
    bind:this={containerRef}
    style:left="{data.x}px"
    style:top="{data.y}px"
    style:transform={data.placeAbove ? "translateY(-100%)" : undefined}
    class="fixed z-40 {isClick ? '' : 'pointer-events-none'} w-[300px] bg-bg border border-bd2 rounded-lg shadow-2xl p-3 animate-fadeIn"
  >
    <div class="text-2xs uppercase tracking-wider text-t3 font-semibold mb-1">
      {t("modals.wikilinkPreview.noNoteYet")}
    </div>
    <div class="font-serif text-base text-char truncate">{data.title}</div>
    <div class="text-2xs text-t2 mt-1.5 leading-relaxed">
      {t("modals.wikilinkPreview.noNoteHint")}
    </div>
  </div>
{:else}
  <div
    bind:this={containerRef}
    style:left="{data.x}px"
    style:top="{data.y}px"
    style:transform={data.placeAbove ? "translateY(-100%)" : undefined}
    class="fixed z-40 w-[380px] max-h-[340px] overflow-hidden bg-bg border border-bd2 rounded-lg shadow-2xl animate-fadeIn flex flex-col"
    onmousedown={(e) => e.stopPropagation()}
    onmouseenter={isClick ? undefined : onEnter}
    onmouseleave={isClick ? undefined : onLeave}
    role="presentation"
  >
    <button
      type="button"
      onclick={handleOpen}
      disabled={!isClick}
      class="px-3.5 pt-3 pb-2 border-b border-bd flex items-center gap-2 w-full text-left {isClick
        ? 'hover:bg-s1 transition cursor-pointer'
        : ''}"
      title={isClick ? t("modals.wikilinkPreview.openTitle") : undefined}
    >
      <div class="font-serif text-base text-char leading-tight truncate flex-1">
        {data.title}
      </div>
      <span class="text-2xs text-t3 font-mono shrink-0">{t("modals.wikilinkPreview.clickToOpen")}</span>
    </button>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      onclick={isClick ? handleOpen : undefined}
      class="px-3.5 py-2.5 text-xs text-char whitespace-pre-wrap leading-relaxed overflow-y-auto flex-1 {isClick
        ? 'cursor-pointer hover:bg-s1/40 transition'
        : 'pointer-events-none'}"
    >
      {#if excerpt}
        {excerpt}
      {:else}
        <span class="italic text-t3">{t("modals.wikilinkPreview.empty")}</span>
      {/if}
    </div>

    {#if membership}
      <div class="border-t border-bd px-3.5 py-2 bg-s1/60 text-2xs">
        <div class="flex items-baseline gap-2">
          <span class="text-t3 font-mono tracking-wider">{t("modals.wikilinkPreview.appliesOn")}</span>
          <span class="text-char">
            {membership.total === 1
              ? t("modals.wikilinkPreview.appliesPath", { here: String(membership.here.length), total: String(membership.total) })
              : t("modals.wikilinkPreview.appliesPaths", { here: String(membership.here.length), total: String(membership.total) })}
          </span>
        </div>
        <div class="mt-1 flex flex-wrap gap-1">
          {#each membership.here as b (b)}
            <span
              class="text-2xs px-1.5 py-0.5 rounded-full font-serif italic truncate max-w-[140px] {b === currentPath
                ? 'bg-yel text-on-yel'
                : 'bg-yelp text-yeld'}"
              title={b === currentPath ? t("modals.wikilinkPreview.currentPath") : b}
            >
              {b}
            </span>
          {/each}
          {#each membership.absent as b (b)}
            <span
              class="text-2xs px-1.5 py-0.5 rounded-full font-serif italic truncate max-w-[140px] text-t3 border border-dashed border-bd2 line-through decoration-bd2"
              title={t("modals.wikilinkPreview.notOn", { name: b })}
            >
              {b}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if data.slug && onBranchHere}
      <div class="border-t border-bd px-2 py-1.5 bg-bg flex items-center">
        <button
          onclick={() => onBranchHere(data.slug!)}
          class="w-full text-left px-2.5 py-1 text-xs text-t2 hover:text-char hover:bg-s2 rounded-sm flex items-center gap-2"
          title={t("modals.wikilinkPreview.startPathTitle")}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="3" cy="3" r="1.5" />
            <circle cx="3" cy="11" r="1.5" />
            <circle cx="11" cy="7" r="1.5" />
            <path d="M3 4.5v5M4.3 3.7l5.4 2.6" />
          </svg>
          <span>{t("modals.wikilinkPreview.startPath")}</span>
        </button>
      </div>
    {/if}
  </div>
{/if}
