<script lang="ts">
  import { tr } from "../../../lib/i18n/index.svelte";
  import { parseDuration } from "../../../lib/timers";

  interface Props {
    open: boolean;
    onClose: () => void;
    onInsert: (markdown: string) => void;
  }

  let { open, onClose, onInsert }: Props = $props();
  let t = $derived(tr());

  interface Preset {
    duration: string;
    i18nLabel:
      | "modals.timerPicker.preset.10m"
      | "modals.timerPicker.preset.15m"
      | "modals.timerPicker.preset.30m"
      | "modals.timerPicker.preset.1h";
  }

  const PRESETS: Preset[] = [
    { duration: "1h", i18nLabel: "modals.timerPicker.preset.1h" },
    { duration: "30m", i18nLabel: "modals.timerPicker.preset.30m" },
    { duration: "15m", i18nLabel: "modals.timerPicker.preset.15m" },
    { duration: "10m", i18nLabel: "modals.timerPicker.preset.10m" },
  ];

  let duration = $state("");
  let label = $state("");
  let customMode = $state(false);
  let error = $state<string | null>(null);
  let customRef = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!open) return;
    duration = "";
    label = "";
    customMode = false;
    error = null;
  });

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function insertWith(dur: string) {
    const parsed = parseDuration(dur);
    if (parsed == null || parsed === 0) {
      error = t("modals.timerPicker.errBadDuration");
      return;
    }
    const trimmedLabel = label.trim();
    const linkLabel = trimmedLabel || dur;
    const md = `[${linkLabel}](timer:${dur})`;
    onInsert(md);
    onClose();
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-180 flex items-center justify-center bg-char/30 backdrop-blur-xs animate-fadeIn"
    onmousedown={onClose}
    role="dialog"
    aria-modal="true"
    aria-labelledby="timer-picker-title"
    tabindex="-1"
  >
    <div
      class="w-[460px] max-w-[calc(100vw-48px)] bg-bg border border-bd2 rounded-[20px] shadow-2xl px-9 pt-8 pb-6 relative animate-slideUp"
      onmousedown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <h2
        id="timer-picker-title"
        class="text-center font-serif text-[26px] leading-tight tracking-tight text-char mb-1"
      >
        {t("modals.timerPicker.title")}
      </h2>
      <p class="text-center text-t2 text-[13px] italic mb-5 font-serif">
        {t("modals.timerPicker.subtitle")}
      </p>

      <label for="timer-label-input" class="block text-2xs uppercase tracking-wider text-t3 mb-1.5">
        {t("modals.timerPicker.labelCaption")}
      </label>
      <input
        id="timer-label-input"
        type="text"
        bind:value={label}
        placeholder={t("modals.timerPicker.labelPlaceholder")}
        class="w-full px-3 py-2 text-sm bg-bg-soft border border-bd2 rounded-md text-char focus:outline-hidden focus:border-yel mb-4"
      />

      <div class="block text-2xs uppercase tracking-wider text-t3 mb-1.5">
        {t("modals.timerPicker.durationCaption")}
      </div>
      <div class="grid grid-cols-5 gap-2 mb-3">
        {#each PRESETS as p (p.duration)}
          <button
            type="button"
            onclick={() => insertWith(p.duration)}
            class="px-3 py-3 bg-bg-soft border border-bd rounded-md font-mono text-sm text-char hover:bg-yelp hover:border-yel hover:text-yeld transition-all duration-150 active:scale-95"
          >
            {t(p.i18nLabel)}
          </button>
        {/each}
        <button
          type="button"
          onclick={() => {
            customMode = true;
            window.setTimeout(() => customRef?.focus(), 0);
          }}
          class="px-3 py-3 border rounded-md font-serif italic text-sm transition-all duration-150 active:scale-95 {customMode
            ? 'bg-yelp border-yel text-yeld'
            : 'bg-bg-soft border-bd-dashed border-bd text-t2 hover:bg-yelp hover:border-yel hover:text-yeld'}"
        >
          {t("modals.timerPicker.preset.custom")}
        </button>
      </div>

      {#if customMode}
        <div class="mt-2 mb-2">
          <input
            bind:this={customRef}
            type="text"
            bind:value={duration}
            oninput={() => (error = null)}
            placeholder={t("modals.timerPicker.customPlaceholder")}
            onkeydown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                insertWith(duration);
              }
            }}
            class="w-full px-3 py-2 text-sm font-mono bg-bg border border-bd2 rounded-md text-char focus:outline-hidden focus:border-yel"
          />
          <p class="text-2xs text-t3 mt-1.5 italic font-serif">
            {t("modals.timerPicker.customHint")}
          </p>
        </div>
      {/if}

      {#if error}
        <div class="text-xs text-char mt-3 px-3 py-2 bg-danger/10 border border-danger/30 rounded-md leading-relaxed">
          {error}
        </div>
      {/if}

      <div class="mt-5 pt-4 border-t border-bd flex items-center justify-between">
        <span class="text-2xs text-t3 italic font-serif">
          {t("modals.timerPicker.hint")}
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            onclick={onClose}
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
          >
            {t("modals.timerPicker.cancel")}
          </button>
          {#if customMode}
            <button
              type="button"
              onclick={() => insertWith(duration)}
              disabled={!duration.trim()}
              class="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-60"
            >
              {t("modals.timerPicker.insert")}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
