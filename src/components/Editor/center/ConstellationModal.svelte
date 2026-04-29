<script lang="ts">
  import { tr, type StringKey } from "../../../lib/i18n/index.svelte";
  import { fireCenterAction, type CenterActionId } from "./actions";

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();
  let t = $derived(tr());

  interface Petal {
    id: CenterActionId;
    i18nLabel: StringKey;
    position: number;
  }

  const PETALS: Petal[] = [
    { id: "newNote", i18nLabel: "modals.constellation.btn.newNote", position: 0 },
    { id: "newPath", i18nLabel: "modals.constellation.btn.newPath", position: 1 },
    { id: "todayJournal", i18nLabel: "modals.constellation.btn.todayJournal", position: 2 },
    { id: "outline-solid", i18nLabel: "modals.constellation.btn.outline-solid", position: 3 },
    { id: "constellation", i18nLabel: "modals.constellation.btn.constellation", position: 4 },
    { id: "focus", i18nLabel: "modals.constellation.btn.focus", position: 5 },
    { id: "livePreview", i18nLabel: "modals.constellation.btn.livePreview", position: 6 },
    { id: "scratchpad", i18nLabel: "modals.constellation.btn.scratchpad", position: 7 },
  ];

  const POSITION_OFFSETS: Array<{ left: string; top: string }> = [
    { left: "50%", top: "calc(50% - 140px)" },
    { left: "calc(50% + 99px)", top: "calc(50% - 99px)" },
    { left: "calc(50% + 140px)", top: "50%" },
    { left: "calc(50% + 99px)", top: "calc(50% + 99px)" },
    { left: "50%", top: "calc(50% + 140px)" },
    { left: "calc(50% - 99px)", top: "calc(50% + 99px)" },
    { left: "calc(50% - 140px)", top: "50%" },
    { left: "calc(50% - 99px)", top: "calc(50% - 99px)" },
  ];

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function fire(id: CenterActionId) {
    onClose();
    window.setTimeout(() => fireCenterAction(id), 0);
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-180 flex items-center justify-center bg-char/30 backdrop-blur-xs animate-fadeIn"
    onmousedown={onClose}
    role="dialog"
    aria-modal="true"
    aria-label={t("modals.constellation.title")}
    tabindex="-1"
  >
    <div
      class="relative w-[460px] h-[460px]"
      style:animation="zoomIn 280ms cubic-bezier(0.2, 0.9, 0.4, 1.2)"
      onmousedown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div
        aria-hidden="true"
        class="absolute top-1/2 left-1/2 w-[400px] h-[400px] mt-[-200px] ml-[-200px] rounded-full border border-dashed border-bd2 opacity-40 pointer-events-none"
      ></div>
      <div
        aria-hidden="true"
        class="absolute top-1/2 left-1/2 w-[280px] h-[280px] mt-[-140px] ml-[-140px] rounded-full border border-dashed border-bd2 pointer-events-none"
      ></div>

      <div
        aria-hidden="true"
        class="absolute top-1/2 left-1/2 w-24 h-24 -mt-12 -ml-12 rounded-full bg-bg border border-bd2 grid place-items-center shadow-2xl"
      >
        <svg width="46" height="46" viewBox="0 0 46 46">
          <circle cx="14" cy="14" r="1.5" fill="currentColor" opacity="0.32" />
          <circle cx="23" cy="14" r="1.5" fill="currentColor" opacity="0.32" />
          <circle cx="32" cy="14" r="1.5" fill="currentColor" opacity="0.32" />
          <circle cx="14" cy="23" r="1.5" fill="currentColor" opacity="0.32" />
          <circle cx="23" cy="23" r="3.0" fill="currentColor" />
          <circle cx="32" cy="23" r="1.5" fill="currentColor" opacity="0.32" />
          <circle cx="14" cy="32" r="1.5" fill="currentColor" opacity="0.32" />
          <circle cx="23" cy="32" r="1.5" fill="currentColor" opacity="0.32" />
          <circle cx="32" cy="32" r="1.5" fill="currentColor" opacity="0.32" />
        </svg>
      </div>

      <span
        class="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[18px] font-serif italic text-[13px] text-bg bg-char/70 px-3 py-1 rounded-full whitespace-nowrap pointer-events-none"
      >
        {t("modals.constellation.centerLabel")}
      </span>

      {#each PETALS as petal (petal.id)}
        {@const pos = POSITION_OFFSETS[petal.position]}
        <button
          type="button"
          onclick={() => fire(petal.id)}
          class="group absolute w-16 h-16 -mt-8 -ml-8 rounded-full bg-bg border border-bd2 grid place-items-center shadow-md cursor-pointer transition-transform duration-200 hover:scale-110 hover:bg-yelp hover:border-yel focus:outline-hidden focus:border-yel"
          style:left={pos.left}
          style:top={pos.top}
        >
          <span class="text-yeld">
            {#if petal.id === "newNote"}
              <svg class="w-[22px] h-[22px]" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6">
                <line x1="11" y1="4" x2="11" y2="18" />
                <line x1="4" y1="11" x2="18" y2="11" />
              </svg>
            {:else if petal.id === "newPath"}
              <svg class="w-[22px] h-[22px]" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M5 17 V5" />
                <path d="M5 5 q5 0 7 6" />
                <path d="M5 5 q5 0 7 12" />
              </svg>
            {:else if petal.id === "todayJournal"}
              <svg class="w-[22px] h-[22px]" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="5" width="16" height="14" rx="2" />
                <line x1="8" y1="3" x2="8" y2="6" />
                <line x1="14" y1="3" x2="14" y2="6" />
                <line x1="3" y1="10" x2="19" y2="10" />
              </svg>
            {:else if petal.id === "outline-solid"}
              <svg class="w-[22px] h-[22px]" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4">
                <rect x="3" y="3" width="16" height="16" rx="2" />
                <path d="M3 8h16" />
                <path d="M8 3v16" />
              </svg>
            {:else if petal.id === "constellation"}
              <svg class="w-[22px] h-[22px]" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="3" />
                <circle cx="5" cy="6" r="1.4" />
                <circle cx="17" cy="6" r="1.4" />
                <circle cx="5" cy="16" r="1.4" />
                <circle cx="17" cy="16" r="1.4" />
              </svg>
            {:else if petal.id === "focus"}
              <svg class="w-[22px] h-[22px]" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 11 q9 -8 18 0" />
                <path d="M2 11 q9 8 18 0" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            {:else if petal.id === "livePreview"}
              <svg class="w-[22px] h-[22px]" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 3h16v8h-16z" />
                <path d="M3 13h16v6h-16z" stroke-dasharray="3 3" />
              </svg>
            {:else if petal.id === "scratchpad"}
              <svg class="w-[22px] h-[22px]" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M5 4 L15 4 L17 6 L17 18 L5 18 Z" />
                <line x1="8" y1="9" x2="13" y2="9" />
                <line x1="8" y1="13" x2="13" y2="13" />
              </svg>
            {/if}
          </span>
          <span class="absolute top-full left-1/2 -translate-x-1/2 mt-2 font-mono text-[10.5px] tracking-wider text-char bg-bg px-2.5 py-1 rounded-full border border-bd whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none">
            {t(petal.i18nLabel)}
          </span>
        </button>
      {/each}

      <div class="absolute -bottom-10 left-1/2 -translate-x-1/2 font-mono text-[11px] tracking-wider text-bg/70">
        <kbd class="font-mono bg-white/20 px-1.5 py-0.5 rounded-sm">esc</kbd>{" "}
        {t("modals.constellation.escHint")}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes zoomIn {
    0% {
      opacity: 0;
      transform: scale(0.62);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
