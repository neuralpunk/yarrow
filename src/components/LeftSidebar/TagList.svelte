<script lang="ts">
  import type { TagCount } from "../../lib/types";
  import { ChevronRightIcon } from "../../lib/iconsSvelte";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    tags: TagCount[];
    activeTag: string | null;
    onSelect: (tag: string | null) => void;
  }

  let { tags, activeTag, onSelect }: Props = $props();
  let t = $derived(tr());

  let open = $state(true);
</script>

{#if tags.length > 0}
  <div class="mt-5 pt-5 pb-2 border-t border-bd/20">
    <button
      onclick={() => (open = !open)}
      class="w-full text-left px-4 mb-1 flex items-center gap-1.5 text-2xs uppercase tracking-wider text-t3 font-semibold hover:text-t2 transition"
    >
      <span
        class="inline-flex items-center transition-transform"
        style:transform={open ? "rotate(90deg)" : "none"}
      >
        <ChevronRightIcon />
      </span>
      <span>{t("sidebar.tags.title")}</span>
      <span class="text-t3/60 font-mono normal-case tracking-normal">
        · {tags.length}
      </span>
    </button>
    {#if open}
      <ul class="px-2 space-y-0.5">
        {#each tags as tg (tg.tag)}
          {@const isActive = activeTag === tg.tag}
          <li>
            <button
              onclick={() => onSelect(isActive ? null : tg.tag)}
              class="w-full text-left px-2.5 py-1 rounded text-xs flex items-center gap-2 transition {isActive
                ? 'bg-yelp text-yeld'
                : 'text-t2 hover:bg-s2 hover:text-char'}"
            >
              <span class="font-mono text-t3">#</span>
              <span class="truncate flex-1">{tg.tag}</span>
              <span class="text-2xs text-t3 font-mono">{tg.count}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
