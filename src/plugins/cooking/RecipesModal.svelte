<script lang="ts">
  // Cooking plugin — recipe library modal.

  import Modal from "../../components/Modal.svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import type { NoteSummary } from "../../lib/types";
  import { relativeTime } from "../../lib/format";
  import { filterRecipes, RECIPE_TAG_LIST } from "./cooking";

  interface Props {
    open: boolean;
    onClose: () => void;
    notes: NoteSummary[];
    onSelect: (slug: string) => void;
    onClip: () => void;
  }

  let { open, onClose, notes, onSelect, onClip }: Props = $props();

  let t = $derived(tr());
  let recipes = $derived(filterRecipes(notes));
</script>

<Modal
  {open}
  {onClose}
  title={t("plugin.cooking.recipes.title")}
  width="w-[560px]"
>
  <div class="text-2xs text-t2 mb-4 leading-relaxed">
    {t("plugin.cooking.recipes.intro", {
      tags: RECIPE_TAG_LIST.map((s) => `#${s}`).join(" · "),
    })}
  </div>

  <div class="flex items-baseline justify-between mb-2">
    <span class="text-[10px] uppercase tracking-wider text-t3 font-mono">
      {t("plugin.cooking.recipes.listLabel", { count: String(recipes.length) })}
    </span>
    <button
      type="button"
      onclick={() => {
        onClip();
        onClose();
      }}
      class="text-2xs font-mono px-2.5 py-1 rounded-full bg-orange-600 text-bg hover:bg-orange-700 transition"
    >
      {t("plugin.cooking.recipes.clip")}
    </button>
  </div>

  {#if recipes.length === 0}
    <div class="text-sm text-t3 italic px-2 py-6 text-center">
      {t("plugin.cooking.recipes.empty")}
    </div>
  {:else}
    <ul class="space-y-1 max-h-[55vh] overflow-y-auto pr-1">
      {#each recipes as n (n.slug)}
        <li>
          <button
            type="button"
            onclick={() => {
              onSelect(n.slug);
              onClose();
            }}
            class="w-full text-left grid grid-cols-[1fr_auto] gap-3 items-baseline px-3 py-2 rounded-md border border-bd bg-s1 hover:border-bd2 transition"
          >
            <div class="min-w-0">
              <div class="text-sm text-char truncate">{n.title || n.slug}</div>
              {#if n.excerpt}
                <div class="text-2xs text-t2 truncate mt-0.5">{n.excerpt}</div>
              {/if}
            </div>
            <div class="text-2xs text-t3 font-mono whitespace-nowrap">
              {relativeTime(n.modified)}
            </div>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</Modal>
