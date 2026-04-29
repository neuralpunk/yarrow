<script lang="ts">
  // Researcher plugin — sources list modal.
  //
  // Lists every workspace note tagged with one of the recognised
  // source kinds, sorted most-recently-modified first.

  import Modal from "../../components/Modal.svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import type { NoteSummary } from "../../lib/types";
  import { relativeTime } from "../../lib/format";
  import { filterSources, SOURCE_TAG_NAMES } from "./sources";

  interface Props {
    open: boolean;
    onClose: () => void;
    notes: NoteSummary[];
    onSelect: (slug: string) => void;
    onCreate: () => void;
  }

  let { open, onClose, notes, onSelect, onCreate }: Props = $props();

  let t = $derived(tr());
  let sources = $derived(filterSources(notes));
</script>

<Modal
  {open}
  {onClose}
  title={t("plugin.researcher.sources.title")}
  width="w-[560px]"
>
  <div class="text-2xs text-t2 mb-4 leading-relaxed">
    {t("plugin.researcher.sources.intro", {
      tags: SOURCE_TAG_NAMES.map((s) => `#${s}`).join(" · "),
    })}
  </div>

  <div class="flex items-baseline justify-between mb-2">
    <span class="text-[10px] uppercase tracking-wider text-t3 font-mono">
      {t("plugin.researcher.sources.listLabel")}
    </span>
    <button
      type="button"
      onclick={() => {
        onCreate();
        onClose();
      }}
      class="text-2xs font-mono px-2.5 py-1 rounded-full bg-emerald-600 text-bg hover:bg-emerald-700 transition"
    >
      {t("plugin.researcher.sources.create")}
    </button>
  </div>

  {#if sources.length === 0}
    <div class="text-sm text-t3 italic px-2 py-6 text-center">
      {t("plugin.researcher.sources.empty")}
    </div>
  {:else}
    <ul class="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
      {#each sources as n (n.slug)}
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
              <div class="text-sm text-char truncate">
                {n.title || n.slug}
              </div>
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
