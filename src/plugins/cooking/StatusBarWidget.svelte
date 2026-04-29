<script lang="ts">
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    recipeCount: number;
    onOpen: () => void;
  }

  let { recipeCount, onOpen }: Props = $props();

  let t = $derived(tr());
</script>

{#if recipeCount > 0}
  <button
    type="button"
    onclick={onOpen}
    title={t("plugin.cooking.status.title", { count: String(recipeCount) })}
    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border border-orange-600/40 bg-orange-600/10 text-orange-700 hover:bg-orange-600/20 transition"
  >
    <span>{t("plugin.cooking.status.shortLabel", { count: recipeCount.toLocaleString() })}</span>
  </button>
{/if}
