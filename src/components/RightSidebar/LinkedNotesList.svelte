<script lang="ts">
  import type { Link, LinkType } from "../../lib/types";
  import { LINK_TYPE_COLORS, LINK_TYPE_LABELS } from "../../lib/types";
  import { PlusIcon, XIcon } from "../../lib/iconsSvelte";
  import EmptyState from "../EmptyState.svelte";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    links: Link[];
    titleMap: Record<string, string>;
    snippetMap: Record<string, string>;
    onNavigate: (slug: string) => void;
    onAdd: () => void;
    onRemove: (to: string, linkType: LinkType) => void;
  }

  let { links, titleMap, snippetMap, onNavigate, onAdd, onRemove }: Props = $props();
  let t = $derived(tr());
</script>

<div class="flex-1 overflow-y-auto p-3">
  <div class="flex items-center justify-between mb-2">
    <div class="text-2xs uppercase tracking-wider text-t3 font-semibold">
      {t("sidebar.linked.title")}
    </div>
    <button
      onclick={onAdd}
      class="y-tip w-6 h-6 flex items-center justify-center text-t2 hover:text-char hover:bg-s2 rounded-sm transition"
      data-tip={t("sidebar.linked.addTip")}
      data-tip-align="right"
      aria-label={t("sidebar.linked.addAria")}
    >
      <PlusIcon />
    </button>
  </div>

  {#if links.length === 0}
    <EmptyState
      kind="links"
      hint={t("sidebar.linked.emptyHint")}
      action={{ label: t("sidebar.linked.addAction"), onClick: onAdd }}
      size="tight"
      class="px-0"
    />
  {/if}

  <ul class="space-y-2">
    {#each links as l (`${l.target}-${l.type}`)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <li
        class="group bg-bg rounded-lg border border-bd hover:border-bd2 hover:bg-s1 transition p-2.5 cursor-pointer"
        onclick={() => onNavigate(l.target)}
      >
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            style:background-color={LINK_TYPE_COLORS[l.type] ?? "var(--t3)"}
          ></span>
          <span class="text-[11px] uppercase tracking-wide text-t3 font-mono">
            {LINK_TYPE_LABELS[l.type]}
          </span>
          <button
            onclick={(e) => {
              e.stopPropagation();
              onRemove(l.target, l.type);
            }}
            class="ml-auto text-t3 hover:text-danger opacity-0 group-hover:opacity-100 transition"
            title={t("sidebar.linked.removeTitle")}
            aria-label={t("sidebar.linked.removeTitle")}
          >
            <XIcon />
          </button>
        </div>
        <div class="mt-1 text-sm text-char font-medium truncate">
          {titleMap[l.target] ?? l.target}
        </div>
        {#if snippetMap[l.target]}
          <div class="mt-1 text-2xs text-t2 line-clamp-2 leading-snug">
            {snippetMap[l.target]}
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  {#if links.length > 0}
    <button
      onclick={onAdd}
      class="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs border border-dashed border-bd2 text-t2 hover:bg-yelp hover:text-yeld hover:border-yel transition"
    >
      <PlusIcon />
      <span>{t("sidebar.linked.addAnother")}</span>
    </button>
  {/if}
</div>
