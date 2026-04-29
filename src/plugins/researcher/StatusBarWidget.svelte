<script lang="ts">
  // Researcher-persona status-bar widget. Renders only when the
  // active note has at least one `??` marker.

  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    questionCount: number;
    onOpen: () => void;
  }

  let { questionCount, onOpen }: Props = $props();

  let t = $derived(tr());
</script>

{#if questionCount > 0}
  <button
    type="button"
    onclick={onOpen}
    title={t("plugin.researcher.status.title", { count: String(questionCount) })}
    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 transition"
  >
    <span class="font-bold">??</span>
    <span>{questionCount.toLocaleString()}</span>
  </button>
{/if}
