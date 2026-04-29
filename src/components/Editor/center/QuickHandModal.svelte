<script lang="ts">
  import { tr, type StringKey } from "../../../lib/i18n/index.svelte";
  import { fireCenterAction, type CenterActionId } from "./actions";

  interface Props {
    open: boolean;
    onClose: () => void;
    onCustomize?: () => void;
  }

  let { open, onClose, onCustomize }: Props = $props();
  let t = $derived(tr());

  interface QHEntry {
    id: CenterActionId;
    i18nLabel: StringKey;
    i18nKeys: StringKey;
  }

  const QH_ENTRIES: QHEntry[] = [
    { id: "newNote", i18nLabel: "modals.quickHand.btn.newNote", i18nKeys: "modals.quickHand.keys.newNote" },
    { id: "newPath", i18nLabel: "modals.quickHand.btn.newPath", i18nKeys: "modals.quickHand.keys.newPath" },
    { id: "todayJournal", i18nLabel: "modals.quickHand.btn.todayJournal", i18nKeys: "modals.quickHand.keys.todayJournal" },
    { id: "outline-solid", i18nLabel: "modals.quickHand.btn.outline-solid", i18nKeys: "modals.quickHand.keys.outline-solid" },
    { id: "livePreview", i18nLabel: "modals.quickHand.btn.livePreview", i18nKeys: "modals.quickHand.keys.livePreview" },
    { id: "focus", i18nLabel: "modals.quickHand.btn.focus", i18nKeys: "modals.quickHand.keys.focus" },
    { id: "constellation", i18nLabel: "modals.quickHand.btn.constellation", i18nKeys: "modals.quickHand.keys.constellation" },
    { id: "scratchpad", i18nLabel: "modals.quickHand.btn.scratchpad", i18nKeys: "modals.quickHand.keys.scratchpad" },
    { id: "palette", i18nLabel: "modals.quickHand.btn.palette", i18nKeys: "modals.quickHand.keys.palette" },
  ];

  let subtitleKey: StringKey = (() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "modals.quickHand.subtitle.morning";
    if (h >= 12 && h < 18) return "modals.quickHand.subtitle.afternoon";
    if (h >= 18 && h < 23) return "modals.quickHand.subtitle.evening";
    return "modals.quickHand.subtitle.late";
  })();

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
    aria-labelledby="quick-hand-title"
    tabindex="-1"
  >
    <div
      class="w-[560px] max-w-[calc(100vw-48px)] bg-bg border border-bd2 rounded-[22px] shadow-2xl px-11 pt-9 pb-7 relative animate-slideUp"
      onmousedown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div
        class="absolute top-[-22px] left-1/2 -translate-x-1/2 w-11 h-11 rounded-[14px] bg-bg border border-bd2 grid place-items-center shadow-md"
        aria-hidden="true"
      >
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="7" cy="7" r="0.8" fill="currentColor" opacity="0.32" />
          <circle cx="11" cy="7" r="0.8" fill="currentColor" opacity="0.32" />
          <circle cx="15" cy="7" r="0.8" fill="currentColor" opacity="0.32" />
          <circle cx="7" cy="11" r="0.8" fill="currentColor" opacity="0.32" />
          <circle cx="11" cy="11" r="1.6" fill="currentColor" />
          <circle cx="15" cy="11" r="0.8" fill="currentColor" opacity="0.32" />
          <circle cx="7" cy="15" r="0.8" fill="currentColor" opacity="0.32" />
          <circle cx="11" cy="15" r="0.8" fill="currentColor" opacity="0.32" />
          <circle cx="15" cy="15" r="0.8" fill="currentColor" opacity="0.32" />
        </svg>
      </div>

      <h2
        id="quick-hand-title"
        class="text-center font-serif text-[30px] leading-tight tracking-tight text-char mt-3 mb-1"
      >
        {t("modals.quickHand.title")}
      </h2>
      <p class="text-center text-t2 text-[13.5px] italic mb-7 font-serif">
        {t(subtitleKey)}
      </p>

      <div class="grid grid-cols-3 gap-3">
        {#each QH_ENTRIES as entry (entry.id)}
          <button
            type="button"
            onclick={() => fire(entry.id)}
            class="bg-bg-soft border border-bd rounded-[14px] px-2 pt-[18px] pb-[14px] flex flex-col items-center gap-2 cursor-pointer transition-all duration-150 hover:border-yel hover:bg-yelp hover:-translate-y-0.5 active:translate-y-0 text-char focus:outline-hidden focus:border-yel"
          >
            <span class="w-7 h-7 grid place-items-center text-yeld">
              {#if entry.id === "newNote"}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              {:else if entry.id === "newPath"}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
                  <path d="M5 18 V6" />
                  <path d="M5 6 q5 0 7 6" />
                  <path d="M5 6 q5 0 7 12" />
                  <circle cx="13" cy="6" r="1.4" />
                  <circle cx="13" cy="12" r="1.4" />
                  <circle cx="13" cy="18" r="1.4" />
                </svg>
              {:else if entry.id === "todayJournal"}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="4" y="6" width="16" height="14" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="6" />
                  <line x1="15" y1="3" x2="15" y2="6" />
                  <line x1="4" y1="11" x2="20" y2="11" />
                </svg>
              {:else if entry.id === "outline-solid"}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M4 9h16" />
                  <path d="M9 4v16" />
                </svg>
              {:else if entry.id === "livePreview"}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                  <path d="M4 4h16v8h-16z" />
                  <path d="M4 14h16v6h-16z" stroke-dasharray="3 3" />
                </svg>
              {:else if entry.id === "focus"}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 12 q9 -8 18 0" />
                  <path d="M3 12 q9 8 18 0" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              {:else if entry.id === "constellation"}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="3.5" />
                  <circle cx="6" cy="7" r="1.6" />
                  <circle cx="18" cy="7" r="1.6" />
                  <circle cx="6" cy="17" r="1.6" />
                  <circle cx="18" cy="17" r="1.6" />
                  <line x1="9" y1="9" x2="6.8" y2="7.6" />
                  <line x1="15" y1="9" x2="17.2" y2="7.6" />
                  <line x1="9" y1="15" x2="6.8" y2="16.4" />
                  <line x1="15" y1="15" x2="17.2" y2="16.4" />
                </svg>
              {:else if entry.id === "scratchpad"}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <path d="M5 4 L17 4 L19 6 L19 20 L5 20 Z" />
                  <line x1="9" y1="10" x2="15" y2="10" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              {:else if entry.id === "palette"}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M7 11 L9.5 13 L7 15" />
                  <line x1="12" y1="15" x2="17" y2="15" />
                </svg>
              {/if}
            </span>
            <span class="font-serif font-medium text-[13.5px] leading-tight tracking-tight text-center">
              {t(entry.i18nLabel)}
            </span>
            <span class="font-mono text-[9.5px] tracking-wider text-t3 uppercase">
              {t(entry.i18nKeys)}
            </span>
          </button>
        {/each}
      </div>

      <div class="mt-[26px] pt-[18px] border-t border-bd flex items-center justify-between text-[12.5px] text-t3">
        {#if onCustomize}
          <button
            type="button"
            onclick={() => {
              onClose();
              window.setTimeout(() => onCustomize(), 0);
            }}
            class="font-serif text-[13px] italic text-yel hover:text-yel2 cursor-pointer bg-transparent border-none p-0"
          >
            {t("modals.quickHand.customize")}
          </button>
        {:else}
          <span></span>
        {/if}
        <span>
          <kbd class="font-mono text-[10.5px] bg-s1 border border-bd px-1.5 py-0.5 rounded-sm text-t2">
            esc
          </kbd>{" "}
          {t("modals.quickHand.escHint")}
        </span>
      </div>
    </div>
  </div>
{/if}
