<script lang="ts">
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    followUpCount: number;
    onOpen: () => void;
  }

  let { followUpCount, onOpen }: Props = $props();

  let t = $derived(tr());
</script>

{#if followUpCount > 0}
  <button
    type="button"
    onclick={onOpen}
    title={t("plugin.clinician.status.title", { count: String(followUpCount) })}
    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border border-teal-700/40 bg-teal-700/10 text-teal-800 hover:bg-teal-700/20 transition"
  >
    <span>{t("plugin.clinician.status.shortLabel", { count: followUpCount.toLocaleString() })}</span>
  </button>
{/if}
