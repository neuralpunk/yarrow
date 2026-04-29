<script lang="ts">
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    decisionCount: number;
    onOpen: () => void;
  }

  let { decisionCount, onOpen }: Props = $props();

  let t = $derived(tr());
</script>

{#if decisionCount > 0}
  <button
    type="button"
    onclick={onOpen}
    title={t("plugin.developer.status.title", { count: String(decisionCount) })}
    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border border-sky-700/40 bg-sky-700/10 text-sky-800 hover:bg-sky-700/20 transition"
  >
    <span class="font-bold">#</span>
    <span>{t("plugin.developer.status.shortLabel", { count: decisionCount.toLocaleString() })}</span>
  </button>
{/if}
