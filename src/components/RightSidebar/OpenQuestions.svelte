<script lang="ts">
  import type { OpenQuestion } from "../../lib/forkDetection";
  import { HelpIcon } from "../../lib/iconsSvelte";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    questions: OpenQuestion[];
    onJump: (line: number) => void;
  }

  let { questions, onJump }: Props = $props();
  let t = $derived(tr());
</script>

{#if questions.length > 0}
  <div class="border-t border-bd px-3 py-3">
    <div class="flex items-center justify-between mb-2">
      <div class="text-2xs uppercase tracking-wider text-t3 font-semibold">
        {t("sidebar.questions.title")}
      </div>
      <span
        class="y-tip text-t3 inline-flex"
        data-tip={t("sidebar.questions.helpTip")}
        data-tip-align="right"
      >
        <HelpIcon />
      </span>
    </div>
    <ul class="space-y-1">
      {#each questions as q, i (`${q.line}-${i}`)}
        <li>
          <button
            onclick={() => onJump(q.line)}
            class="w-full text-left flex gap-2 items-start p-2 rounded-sm hover:bg-s2 text-xs transition"
          >
            <span class="shrink-0 mt-0.5 font-mono text-[10px] font-semibold text-yeld bg-yelp rounded-sm px-1 py-0.5">
              ??
            </span>
            <span class="text-ch2 line-clamp-2 leading-snug">{q.text}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}
