<script lang="ts">
  import { tr } from "../lib/i18n/index.svelte";

  export interface Tab {
    slug: string | null;
    title: string;
  }

  interface Props {
    tabs: Tab[];
    activeIndex: number;
    onSwitch: (index: number) => void;
    onClose: (index: number) => void;
    onNewTab: () => void;
  }

  let { tabs, activeIndex, onSwitch, onClose, onNewTab }: Props = $props();
  let t = $derived(tr());
</script>

<div
  class="flex items-stretch border-b border-bd bg-s1/60 select-none"
  role="tablist"
  aria-label={t("appshell.tabs.label")}
>
  {#each tabs as tab, i (i)}
    {@const isActive = i === activeIndex}
    <div
      class="group relative flex items-center min-w-[120px] max-w-[220px] border-r border-bd/60 {isActive
        ? 'bg-bg text-char shadow-[inset_0_-2px_0_var(--yel)]'
        : 'bg-transparent text-t2 hover:bg-s2/60 hover:text-ch2'}"
      role="tab"
      aria-selected={isActive}
    >
      <button
        type="button"
        class="flex-1 min-w-0 text-left px-3 py-1.5 font-serif text-[13px] truncate"
        title={tab.title}
        onclick={() => onSwitch(i)}
        onmousedown={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            onClose(i);
          }
        }}
      >
        {tab.title || t("appshell.tabs.untitled")}
      </button>
      {#if tabs.length > 1}
        <button
          type="button"
          class="shrink-0 mr-1 w-5 h-5 rounded-sm flex items-center justify-center text-t3 opacity-0 group-hover:opacity-100 hover:bg-s3 hover:text-char transition"
          title={t("appshell.tabs.close")}
          aria-label={t("appshell.tabs.close")}
          onclick={(e) => {
            e.stopPropagation();
            onClose(i);
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
            <line x1="2" y1="2" x2="8" y2="8" />
            <line x1="8" y1="2" x2="2" y2="8" />
          </svg>
        </button>
      {/if}
    </div>
  {/each}
  <button
    type="button"
    class="shrink-0 px-2 py-1.5 text-t3 hover:bg-s2/60 hover:text-char transition"
    title={t("appshell.tabs.newTab")}
    aria-label={t("appshell.tabs.newTab")}
    onclick={onNewTab}
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
      <line x1="6" y1="2" x2="6" y2="10" />
      <line x1="2" y1="6" x2="10" y2="6" />
    </svg>
  </button>
</div>
