<script lang="ts">
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";
  import Modal from "./Modal.svelte";
  import { tr } from "../lib/i18n/index.svelte";
  import type { NoteSummary } from "../lib/types";
  import {
    TAG_KIND_ALIASES,
    TAG_LEGEND,
    tagKind,
    tagPillClass,
    type TagKind,
  } from "../lib/tagStyles";

  interface Props {
    open: boolean;
    onClose: () => void;
    notes: NoteSummary[];
    activeSlug?: string | null;
    activeTags?: string[];
    onToggleTag?: (tag: string) => void | Promise<void>;
  }

  let {
    open,
    onClose,
    notes,
    activeSlug = null,
    activeTags,
    onToggleTag,
  }: Props = $props();
  let t = $derived(tr());

  interface TagRow {
    tag: string;
    count: number;
    kind: TagKind | null;
  }

  function aggregate(ns: NoteSummary[]): TagRow[] {
    const counts = new Map<string, number>();
    for (const n of ns) {
      if (!n.tags) continue;
      for (const raw of n.tags) {
        const tag = raw.trim();
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const out: TagRow[] = [];
    for (const [tag, count] of counts) {
      out.push({ tag, count, kind: tagKind(tag) });
    }
    const kindOrder: Record<TagKind, number> = {
      sensitive: 0,
      attention: 1,
      question: 2,
      decision: 3,
      draft: 4,
      mature: 5,
      archived: 6,
    };
    out.sort((a, b) => {
      if (a.kind && !b.kind) return -1;
      if (!a.kind && b.kind) return 1;
      if (a.kind && b.kind && a.kind !== b.kind) {
        return kindOrder[a.kind] - kindOrder[b.kind];
      }
      return a.tag.localeCompare(b.tag);
    });
    return out;
  }

  let rows = $derived(aggregate(notes));
  let activeSet = $derived(
    new Set((activeTags ?? []).map((s) => s.toLowerCase())),
  );
  let justCopied = $state<string | null>(null);
  let canToggle = $derived(activeSlug != null && onToggleTag != null);

  async function copyTag(tag: string) {
    try {
      await writeText(`#${tag}`);
    } catch { /* clipboard may be off */ }
    justCopied = tag;
    window.setTimeout(() => {
      if (justCopied === tag) justCopied = null;
    }, 1100);
  }

  async function onClickPill(tag: string) {
    if (canToggle && onToggleTag) {
      await onToggleTag(tag);
    } else {
      await copyTag(tag);
    }
  }

  function isOn(tag: string): boolean {
    return activeSet.has(tag.toLowerCase());
  }

  function tipFor(tag: string, copied: boolean): string {
    if (copied) return t("modals.tagBrowser.copied");
    if (canToggle) {
      return isOn(tag)
        ? t("modals.tagBrowser.removeHint", { tag })
        : t("modals.tagBrowser.addHint", { tag });
    }
    return t("modals.tagBrowser.copyHint", { tag });
  }
</script>

<Modal {open} {onClose} title={t("modals.tagBrowser.title")} width="w-[560px]">
  {#snippet children()}
    <div class="text-2xs text-t2 mb-3 leading-snug">
      {canToggle ? t("modals.tagBrowser.introAdd") : t("modals.tagBrowser.intro")}
    </div>

    <!-- Legend -->
    <div class="mb-3.5">
      <div class="text-[10px] uppercase tracking-wider text-t3 mb-1.5 font-mono">
        {t("modals.tagBrowser.legendTitle")}
      </div>
      <div class="grid grid-cols-1 gap-1">
        {#each TAG_LEGEND as entry (entry.kind)}
          {@const canonical = TAG_KIND_ALIASES[entry.kind][0]}
          {@const on = isOn(canonical)}
          {@const copied = justCopied === canonical}
          {@const aliases = TAG_KIND_ALIASES[entry.kind].slice(1)}
          <div class="flex items-center gap-3 px-1.5 py-1 rounded-md border border-bd bg-s1">
            <div class="w-[88px] shrink-0 flex justify-start">
              <button
                type="button"
                onclick={() => onClickPill(canonical)}
                oncontextmenu={(e) => { e.preventDefault(); copyTag(canonical); }}
                title={tipFor(canonical, copied)}
                class="text-[10px] font-mono px-1.5 py-px rounded-full whitespace-nowrap transition {tagPillClass(canonical)} {on
                  ? 'ring-2 ring-yel'
                  : copied
                  ? 'ring-2 ring-bd2'
                  : 'hover:ring-1 hover:ring-bd2'}"
              >
                #{canonical}
                {#if on}<span class="ml-1">✓</span>{/if}
              </button>
            </div>
            <div class="flex-1 min-w-0 leading-tight">
              <span class="text-xs text-char">{t(entry.labelKey)}</span>
              <span class="text-2xs text-t2 ml-1.5">{t(entry.descriptionKey)}</span>
            </div>
            {#if aliases.length > 0}
              <div
                class="text-[10px] text-t3 font-mono whitespace-nowrap truncate max-w-[140px] shrink-0"
                title={aliases.join(", ")}
              >
                {aliases.join(" · ")}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Workspace tags -->
    <div>
      <div class="text-[10px] uppercase tracking-wider text-t3 mb-1.5 font-mono flex items-baseline justify-between">
        <span>{t("modals.tagBrowser.tagsTitle")}</span>
        <span>{t("modals.tagBrowser.tagsCount", { count: String(rows.length) })}</span>
      </div>
      {#if rows.length === 0}
        <div class="text-sm text-t3 italic px-2 py-4 text-center">
          {t("modals.tagBrowser.empty")}
        </div>
      {:else}
        <div class="flex flex-wrap gap-1 max-h-[240px] overflow-y-auto pr-1">
          {#each rows as row (row.tag)}
            {@const on = isOn(row.tag)}
            {@const copied = justCopied === row.tag}
            <button
              type="button"
              onclick={() => onClickPill(row.tag)}
              oncontextmenu={(e) => { e.preventDefault(); copyTag(row.tag); }}
              title={tipFor(row.tag, copied)}
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono transition {tagPillClass(row.tag)} {on
                ? 'ring-2 ring-yel'
                : copied
                ? 'ring-2 ring-bd2'
                : 'hover:ring-1 hover:ring-bd2'}"
            >
              <span>#{row.tag}</span>
              <span class="text-t3 opacity-70">{row.count}</span>
              {#if on}<span class="opacity-80">✓</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
      <div class="text-2xs text-t3 mt-2 leading-snug">
        {canToggle ? t("modals.tagBrowser.hintToggle") : t("modals.tagBrowser.hintCopyOnly")}
      </div>
    </div>
  {/snippet}
</Modal>
