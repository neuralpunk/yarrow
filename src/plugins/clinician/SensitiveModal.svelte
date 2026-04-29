<script lang="ts">
  import Modal from "../../components/Modal.svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import type { NoteSummary } from "../../lib/types";
  import { relativeTime } from "../../lib/format";
  import { filterSensitive } from "./clinical";

  interface Props {
    open: boolean;
    onClose: () => void;
    notes: NoteSummary[];
    onSelect: (slug: string) => void;
  }

  let { open, onClose, notes, onSelect }: Props = $props();

  let t = $derived(tr());
  let sensitive = $derived(filterSensitive(notes));
</script>

<Modal
  {open}
  {onClose}
  title={t("plugin.clinician.sensitive.title")}
  width="w-[560px]"
>
  <div class="text-2xs text-t2 mb-4 leading-relaxed">
    {t("plugin.clinician.sensitive.intro")}
  </div>

  <div class="text-[10px] uppercase tracking-wider text-t3 mb-2 font-mono flex items-baseline justify-between">
    <span>
      {t("plugin.clinician.sensitive.listLabel", { count: String(sensitive.length) })}
    </span>
  </div>

  {#if sensitive.length === 0}
    <div class="text-sm text-t3 italic px-2 py-6 text-center">
      {t("plugin.clinician.sensitive.empty")}
    </div>
  {:else}
    <ul class="space-y-1 max-h-[55vh] overflow-y-auto pr-1">
      {#each sensitive as n (n.slug)}
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

  <div class="text-2xs text-t3 mt-3 leading-snug">
    {t("plugin.clinician.sensitive.note")}
  </div>
</Modal>
