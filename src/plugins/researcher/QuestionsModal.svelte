<script lang="ts">
  // Researcher plugin — open-questions modal.
  //
  // A focused list of the `??` markers in the active note.

  import Modal from "../../components/Modal.svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import type { OpenQuestion } from "../../lib/forkDetection";

  interface Props {
    open: boolean;
    onClose: () => void;
    noteTitle: string;
    questions: OpenQuestion[];
    onJump: (line: number) => void;
  }

  let { open, onClose, noteTitle, questions, onJump }: Props = $props();

  let t = $derived(tr());
</script>

<Modal
  {open}
  {onClose}
  title={t("plugin.researcher.questions.title")}
  width="w-[520px]"
>
  <div class="text-2xs text-t2 mb-4 leading-relaxed">
    {t("plugin.researcher.questions.intro", { title: noteTitle })}
  </div>
  {#if questions.length === 0}
    <div class="text-sm text-t3 italic px-2 py-6 text-center">
      {t("plugin.researcher.questions.empty")}
    </div>
  {:else}
    <ul class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
      {#each questions as q, i (`${q.line}-${i}`)}
        <li>
          <button
            type="button"
            onclick={() => {
              onJump(q.line);
              onClose();
            }}
            class="w-full text-left grid grid-cols-[40px_1fr] gap-3 items-baseline px-3 py-2 rounded-md border border-bd bg-s1 hover:border-bd2 transition"
          >
            <span class="text-2xs text-t3 font-mono">
              {t("plugin.researcher.questions.lineLabel", { line: String(q.line) })}
            </span>
            <span class="text-sm text-char leading-snug">
              ?? <span class="text-t2 italic">{q.text}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="text-2xs text-t3 mt-3 leading-snug">
    {t("plugin.researcher.questions.tip")}
  </div>
</Modal>
